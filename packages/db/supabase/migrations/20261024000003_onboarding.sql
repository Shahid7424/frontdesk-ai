-- Onboarding in one transaction.
--
-- Creating a business touches six tables. Doing it as separate API calls
-- means a network blip can leave a half-created business (services with no
-- staff, a business with no owner). One function = all or nothing.
--
-- Payload shape (validated with Zod in the app before it gets here):
-- {
--   "business": { "name", "slug", "vertical", "area", "address", "phone" },
--   "staff":    [{ "key": "s1", "name": "Dr. Mehta", "title": "Physician" }],
--   "services": [{ "name", "duration_min", "price_paise", "staff_keys": ["s1"] }],
--   "hours":    [{ "weekday": 1, "start_time": "09:00", "end_time": "13:30" }]
-- }
-- "key" is a temporary client-side id so services can point at staff that
-- don't have database ids yet.

create function public.create_business_with_setup(payload jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  b jsonb := payload -> 'business';
  new_business uuid;
  staff_ids jsonb := '{}'::jsonb;
  item jsonb;
  new_id uuid;
  staff_key text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- MVP: one business per owner. Also makes a double-clicked submit harmless.
  if exists (select 1 from public.members where user_id = uid and role = 'owner') then
    raise exception 'already_onboarded' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(payload -> 'staff', '[]')) not between 1 and 10
     or jsonb_array_length(coalesce(payload -> 'services', '[]')) not between 1 and 50
     or jsonb_array_length(coalesce(payload -> 'hours', '[]')) not between 1 and 28 then
    raise exception 'invalid_payload_size' using errcode = '22023';
  end if;

  insert into public.businesses (name, slug, vertical, area, address, phone)
  values (
    b ->> 'name',
    b ->> 'slug',
    coalesce(b ->> 'vertical', 'clinic')::public.business_vertical,
    nullif(b ->> 'area', ''),
    nullif(b ->> 'address', ''),
    nullif(b ->> 'phone', '')
  )
  returning id into new_business;

  insert into public.members (business_id, user_id, role) values (new_business, uid, 'owner');

  for item in select * from jsonb_array_elements(payload -> 'staff') loop
    insert into public.staff (business_id, name, title)
    values (new_business, item ->> 'name', nullif(item ->> 'title', ''))
    returning id into new_id;
    staff_ids := staff_ids || jsonb_build_object(item ->> 'key', new_id);
  end loop;

  for item in select * from jsonb_array_elements(payload -> 'services') loop
    insert into public.services (business_id, name, duration_min, price_paise)
    values (new_business, item ->> 'name', (item ->> 'duration_min')::int, (item ->> 'price_paise')::int)
    returning id into new_id;

    for staff_key in select jsonb_array_elements_text(coalesce(item -> 'staff_keys', '[]')) loop
      if not staff_ids ? staff_key then
        raise exception 'unknown_staff_key: %', staff_key using errcode = '22023';
      end if;
      insert into public.service_staff (business_id, service_id, staff_id)
      values (new_business, new_id, (staff_ids ->> staff_key)::uuid);
    end loop;
  end loop;

  insert into public.availability_rules (business_id, weekday, start_time, end_time)
  select new_business, (h ->> 'weekday')::smallint, (h ->> 'start_time')::time, (h ->> 'end_time')::time
  from jsonb_array_elements(payload -> 'hours') h;

  return new_business;
end;
$$;

revoke all on function public.create_business_with_setup(jsonb) from public, anon;
grant execute on function public.create_business_with_setup(jsonb) to authenticated;
