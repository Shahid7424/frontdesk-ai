-- Row Level Security
--
-- Membership is the single source of truth: a user sees a business's rows
-- only if a members row links them. The helpers are SECURITY DEFINER so
-- reading members inside a policy doesn't recurse into members' own RLS.

create function public.is_member(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.business_id = target and m.user_id = (select auth.uid())
  );
$$;

create function public.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.business_id = target and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

revoke all on function public.is_member(uuid), public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid) to authenticated;

-- The anon key ships to browsers. It gets nothing from public tables:
-- the widget talks to our API, which uses the service role server-side.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

alter table public.businesses enable row level security;
alter table public.members enable row level security;

-- Businesses are created only through create_business_with_setup(), which
-- also adds the creator as owner in the same transaction. So: no insert policy.
create policy "members can read their business" on public.businesses
  for select to authenticated using (public.is_member(id));
create policy "owners can update their business" on public.businesses
  for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));

create policy "members can see their team" on public.members
  for select to authenticated using (public.is_member(business_id));
create policy "owners manage the team" on public.members
  for all to authenticated using (public.is_owner(business_id)) with check (public.is_owner(business_id));

-- Every other tenant table follows the same rule: members get full access to
-- their business's rows, nobody else sees anything.
do $$
declare
  t text;
begin
  foreach t in array array[
    'staff', 'services', 'service_staff', 'availability_rules', 'customers',
    'appointments', 'payments', 'documents', 'chunks', 'conversations', 'messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "members only" on public.%I for all to authenticated
         using (public.is_member(business_id)) with check (public.is_member(business_id))',
      t
    );
  end loop;
end;
$$;
