-- FrontDesk AI: initial schema
--
-- Multi-tenancy rules, enforced by the database rather than by app code:
--   1. Every tenant table has business_id, and RLS only shows rows of
--      businesses the signed-in user is a member of.
--   2. Child rows reference parents by (id, business_id), so a row can never
--      point at another tenant's staff, service or customer, even if the
--      server has a bug.
--   3. The widget and webhooks never use the anon key; they go through the
--      server with the service role and an explicit business_id.

create schema if not exists extensions;
create extension if not exists vector with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.business_vertical as enum ('clinic', 'salon', 'coaching', 'other');
create type public.member_role as enum ('owner', 'staff');
create type public.channel as enum ('web', 'whatsapp');
create type public.booking_source as enum ('web', 'whatsapp', 'dashboard', 'walk_in');
create type public.appointment_status as enum ('pending_payment', 'confirmed', 'completed', 'cancelled', 'no_show');
create type public.conversation_status as enum ('ai', 'needs_human', 'human', 'resolved');
create type public.message_role as enum ('customer', 'ai', 'owner', 'tool');
create type public.document_kind as enum ('pdf', 'url', 'text');
create type public.document_status as enum ('pending', 'processing', 'ready', 'failed');
create type public.payment_status as enum ('created', 'paid', 'expired', 'cancelled');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tenants and people
-- ---------------------------------------------------------------------------

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  -- Public id used in the widget script tag. Not a secret.
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  name text not null check (length(name) between 2 and 120),
  vertical public.business_vertical not null default 'clinic',
  area text,
  address text,
  phone text,
  timezone text not null default 'Asia/Kolkata',
  accent_color text not null default '#0f766e' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  ai_enabled boolean not null default true,
  -- AI behaviour toggles (Hinglish, handoff rules, advance payment).
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger businesses_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

create table public.members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index members_user_id_idx on public.members (user_id);

-- People who can be booked (doctors, stylists, teachers). Not app users.
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  title text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create index staff_business_id_idx on public.staff (business_id);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  description text,
  duration_min integer not null check (duration_min between 5 and 480),
  price_paise integer not null default 0 check (price_paise >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create index services_business_id_idx on public.services (business_id);

-- Which staff can perform which service.
create table public.service_staff (
  business_id uuid not null,
  service_id uuid not null,
  staff_id uuid not null,
  primary key (service_id, staff_id),
  foreign key (service_id, business_id) references public.services (id, business_id) on delete cascade,
  foreign key (staff_id, business_id) references public.staff (id, business_id) on delete cascade
);
create index service_staff_business_id_idx on public.service_staff (business_id);

-- Weekly opening hours. staff_id null = applies to the whole business.
-- Split shifts (9-1:30, 5-9) are two rows for the same weekday.
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  staff_id uuid,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  check (end_time > start_time),
  foreign key (staff_id, business_id) references public.staff (id, business_id) on delete cascade
);
create index availability_rules_business_id_idx on public.availability_rules (business_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  phone text,
  name text,
  created_at timestamptz not null default now(),
  unique (id, business_id),
  unique (business_id, phone)
);

-- ---------------------------------------------------------------------------
-- Bookings and payments
-- ---------------------------------------------------------------------------

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  service_id uuid not null,
  staff_id uuid not null,
  customer_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending_payment',
  source public.booking_source not null,
  amount_paise integer not null default 0 check (amount_paise >= 0),
  -- A pending_payment slot is held until this time, then released.
  hold_expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (id, business_id),
  foreign key (service_id, business_id) references public.services (id, business_id),
  foreign key (staff_id, business_id) references public.staff (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id),
  -- The real double-booking guarantee: two live appointments for the same
  -- staff member can never overlap, no matter how many requests race.
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed'))
);
create index appointments_business_starts_idx on public.appointments (business_id, starts_at);

create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  appointment_id uuid not null,
  -- Razorpay payment link id; unique so a retried webhook can't double-apply.
  provider_link_id text unique,
  amount_paise integer not null check (amount_paise > 0),
  status public.payment_status not null default 'created',
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  foreign key (appointment_id, business_id) references public.appointments (id, business_id) on delete cascade
);
create index payments_business_id_idx on public.payments (business_id);

-- ---------------------------------------------------------------------------
-- Knowledge base (RAG)
-- ---------------------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null,
  kind public.document_kind not null,
  storage_path text,
  source_url text,
  status public.document_status not null default 'pending',
  error text,
  chunk_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, business_id)
);
create index documents_business_id_idx on public.documents (business_id);

create table public.chunks (
  id bigint generated always as identity primary key,
  business_id uuid not null,
  document_id uuid not null,
  content text not null,
  -- 768 dims: Gemini text-embedding-004, or OpenAI text-embedding-3-small
  -- with dimensions=768. Null until the ingestion job embeds it.
  embedding extensions.vector(768),
  -- 'simple' config (no stemming) works better than 'english' for Hinglish.
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  created_at timestamptz not null default now(),
  foreign key (document_id, business_id) references public.documents (id, business_id) on delete cascade
);
create index chunks_business_id_idx on public.chunks (business_id);
create index chunks_fts_idx on public.chunks using gin (fts);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  customer_id uuid,
  channel public.channel not null,
  status public.conversation_status not null default 'ai',
  last_message_at timestamptz not null default now(),
  -- Running LLM cost, so the dashboard can show cost per conversation.
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id),
  foreign key (customer_id, business_id) references public.customers (id, business_id)
);
create index conversations_inbox_idx on public.conversations (business_id, last_message_at desc);

create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  conversation_id uuid not null,
  role public.message_role not null,
  content text not null,
  -- Citations, tool calls, slot ids etc.
  metadata jsonb not null default '{}'::jsonb,
  model text,
  input_tokens integer,
  output_tokens integer,
  cost_usd numeric(10, 6),
  -- WhatsApp message id. Unique per business so webhook retries are no-ops.
  external_id text,
  created_at timestamptz not null default now(),
  unique (business_id, external_id),
  foreign key (conversation_id, business_id) references public.conversations (id, business_id) on delete cascade
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);
