-- Day 4 + 5: knowledge base ingestion and hybrid search.
--
-- Flow: the owner uploads a PDF (or types a quick answer) → a documents row
-- in 'pending' → a background job extracts text, chunks it, embeds the
-- chunks and flips the row to 'ready'. The agent then searches chunks with
-- search_chunks(), which fuses keyword and vector results.

alter table public.documents
  -- Quick answers keep their text here, so re-indexing never needs the original.
  add column content text check (length(content) <= 20000),
  add column size_bytes integer check (size_bytes >= 0),
  -- Which model embedded the chunks; null = keyword search only.
  add column embedding_model text,
  add column attempts smallint not null default 0,
  add column updated_at timestamptz not null default now();

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.chunks
  add column chunk_index integer not null default 0,
  -- 1-based PDF page, for citations. Null for typed text.
  add column page integer check (page > 0);

create index chunks_document_idx on public.chunks (document_id, chunk_index);

-- Uploaded PDFs live in a private bucket under <business_id>/<document_id>.pdf.
-- No storage policies: browsers never touch the bucket directly; the server
-- checks membership and uses the service role. Skipped on plain Postgres (tests).
do $$
begin
  if exists (select from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('documents', 'documents', false, 10485760, array['application/pdf'])
    on conflict (id) do nothing;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Hybrid search
-- ---------------------------------------------------------------------------
--
-- Keyword search finds exact words ("PFT", "₹500", a doctor's name) that
-- embeddings blur; vector search finds paraphrases ("kab khulta hai" →
-- timings) that keywords miss. Each returns its top 20 for this business,
-- and Reciprocal Rank Fusion merges them: score = Σ 1 / (60 + rank). RRF
-- needs no score calibration between the two, which is why it's the
-- usual default.
--
-- p_terms are prefix-matched and OR-ed (the app strips filler words), so
-- "fees kitni" matches a chunk that says "Fees:". p_embedding is optional:
-- without it this is plain keyword search.
create function public.search_chunks(
  p_business_id uuid,
  p_terms text[],
  p_embedding extensions.vector(768) default null,
  p_limit integer default 5
)
returns table (
  id bigint,
  document_id uuid,
  document_name text,
  page integer,
  content text,
  keyword_rank integer,
  vector_rank integer,
  score double precision
)
language plpgsql stable
set search_path = ''
as $$
#variable_conflict use_column
declare
  tsq tsquery;
begin
  -- With many tenants, HNSW returns the globally nearest rows and the
  -- business filter runs after, which can leave a small business with no
  -- vector hits. pgvector 0.8+ keeps scanning until the limit is met.
  -- Older versions don't know the setting, so ignore the error there.
  begin
    perform set_config('hnsw.iterative_scan', 'relaxed_order', true);
  exception when others then
    null;
  end;

  -- Keep letters/digits only, so a term can never inject tsquery syntax.
  select to_tsquery('simple', string_agg(t || ':*', ' | '))
    into tsq
  from (
    select distinct regexp_replace(lower(raw), '[^[:alnum:]ऀ-ॿ]', '', 'g') as t
    from unnest(coalesce(p_terms, '{}')) raw
  ) cleaned
  where length(t) > 1;

  return query
  with keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, tsq) desc, c.id)::integer as r
    from public.chunks c
    where tsq is not null and c.business_id = p_business_id and c.fts @@ tsq
    order by r
    limit 20
  ),
  semantic as (
    select c.id, row_number() over (order by c.embedding operator(extensions.<=>) p_embedding, c.id)::integer as r
    from public.chunks c
    where p_embedding is not null and c.business_id = p_business_id and c.embedding is not null
    order by c.embedding operator(extensions.<=>) p_embedding
    limit 20
  ),
  fused as (
    select coalesce(k.id, s.id) as id, k.r as kr, s.r as sr,
           coalesce(1.0 / (60 + k.r), 0) + coalesce(1.0 / (60 + s.r), 0) as score
    from keyword k
    full outer join semantic s on s.id = k.id
  )
  select c.id, c.document_id, d.name, c.page, c.content, f.kr, f.sr, f.score::double precision
  from fused f
  join public.chunks c on c.id = f.id
  join public.documents d on d.id = c.document_id and d.business_id = c.business_id
  where d.status = 'ready'
  order by f.score desc, c.id
  limit least(greatest(p_limit, 1), 10);
end;
$$;

-- Only the server calls this (with an explicit business id), never browsers.
revoke all on function public.search_chunks(uuid, text[], extensions.vector, integer) from public, anon, authenticated;
grant execute on function public.search_chunks(uuid, text[], extensions.vector, integer) to service_role;
