-- Editing the business setup from Settings, in one transaction.
--
-- Same payload as create_business_with_setup(), except staff and services
-- may carry the "id" of an existing row:
-- {
--   "business": { "name", "vertical", "area", "address", "phone" },
--   "staff":    [{ "key": "<id or temp key>", "id": "<uuid, existing only>", "name", "title" }],
--   "services": [{ "id": "<uuid, existing only>", "name", "duration_min", "price_paise", "staff_keys": [...] }],
--   "hours":    [{ "weekday": 1, "start_time": "09:00", "end_time": "13:30" }]
-- }
--
-- Staff and services left out are deactivated, not deleted: past and
-- upcoming appointments still point at them. "hours" replaces the
-- business-wide opening hours; hours set for one staff member are kept.
-- Existing appointments are never moved or cancelled by an edit.

create function public.update_business_setup(target uuid, payload jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  b jsonb := payload -> 'business';
  staff_ids jsonb := '{}'::jsonb;
  kept_staff uuid[] := '{}';
  kept_services uuid[] := '{}';
  item jsonb;
  row_id uuid;
  staff_key text;
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.is_owner(target) then
    raise exception 'not_owner' using errcode = '42501';
  end if;

  if jsonb_array_length(coalesce(payload -> 'staff', '[]')) not between 1 and 10
     or jsonb_array_length(coalesce(payload -> 'services', '[]')) not between 1 and 50
     or jsonb_array_length(coalesce(payload -> 'hours', '[]')) not between 1 and 28 then
    raise exception 'invalid_payload_size' using errcode = '22023';
  end if;

  update public.businesses set
    name = b ->> 'name',
    vertical = coalesce(b ->> 'vertical', vertical::text)::public.business_vertical,
    area = nullif(b ->> 'area', ''),
    address = nullif(b ->> 'address', ''),
    phone = nullif(b ->> 'phone', '')
  where id = target;

  for item in select * from jsonb_array_elements(payload -> 'staff') loop
    if item ? 'id' then
      update public.staff set name = item ->> 'name', title = nullif(item ->> 'title', ''), active = true
      where id = (item ->> 'id')::uuid and business_id = target
      returning id into row_id;
      if row_id is null then
        raise exception 'unknown_staff' using errcode = '22023';
      end if;
    else
      insert into public.staff (business_id, name, title)
      values (target, item ->> 'name', nullif(item ->> 'title', ''))
      returning id into row_id;
    end if;
    staff_ids := staff_ids || jsonb_build_object(item ->> 'key', row_id);
    kept_staff := kept_staff || row_id;
  end loop;

  update public.staff set active = false where business_id = target and active and not (id = any (kept_staff));
  -- A removed person can't be offered for any service, even an unchanged one.
  delete from public.service_staff where business_id = target and not (staff_id = any (kept_staff));

  for item in select * from jsonb_array_elements(payload -> 'services') loop
    if item ? 'id' then
      update public.services set
        name = item ->> 'name',
        duration_min = (item ->> 'duration_min')::int,
        price_paise = (item ->> 'price_paise')::int,
        active = true
      where id = (item ->> 'id')::uuid and business_id = target
      returning id into row_id;
      if row_id is null then
        raise exception 'unknown_service' using errcode = '22023';
      end if;
    else
      insert into public.services (business_id, name, duration_min, price_paise)
      values (target, item ->> 'name', (item ->> 'duration_min')::int, (item ->> 'price_paise')::int)
      returning id into row_id;
    end if;
    kept_services := kept_services || row_id;

    delete from public.service_staff where service_id = row_id;
    for staff_key in select jsonb_array_elements_text(coalesce(item -> 'staff_keys', '[]')) loop
      if not staff_ids ? staff_key then
        raise exception 'unknown_staff_key: %', staff_key using errcode = '22023';
      end if;
      insert into public.service_staff (business_id, service_id, staff_id)
      values (target, row_id, (staff_ids ->> staff_key)::uuid)
      on conflict do nothing;
    end loop;
  end loop;

  update public.services set active = false where business_id = target and active and not (id = any (kept_services));

  delete from public.availability_rules where business_id = target and staff_id is null;
  insert into public.availability_rules (business_id, weekday, start_time, end_time)
  select target, (h ->> 'weekday')::smallint, (h ->> 'start_time')::time, (h ->> 'end_time')::time
  from jsonb_array_elements(payload -> 'hours') h;
end;
$$;

revoke all on function public.update_business_setup(uuid, jsonb) from public, anon;
grant execute on function public.update_business_setup(uuid, jsonb) to authenticated;
