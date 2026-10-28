-- Demo tenant: Sunrise Family Clinic (fictional). Powers /demo and the
-- first eval set. Fixed UUIDs keep evals and tests stable across resets.
-- It has no owner: real owners create their own business via onboarding.

insert into public.businesses (id, slug, name, vertical, area, address, phone, accent_color)
values (
  '00000000-0000-4000-a000-000000000001',
  'sunrise-clinic',
  'Sunrise Family Clinic',
  'clinic',
  'Baner, Pune',
  '2nd floor, Sai Plaza, Baner Road, near Balewadi Phata, Pune 411045',
  '+91 98XXX XXX21',
  '#0f766e'
);

insert into public.staff (id, business_id, name, title) values
  ('00000000-0000-4000-a001-000000000001', '00000000-0000-4000-a000-000000000001', 'Dr. Anjali Mehta', 'General Physician'),
  ('00000000-0000-4000-a001-000000000002', '00000000-0000-4000-a000-000000000001', 'Dr. Rohan Kulkarni', 'Pulmonologist'),
  ('00000000-0000-4000-a001-000000000003', '00000000-0000-4000-a000-000000000001', 'Nisha Patil', 'Physiotherapist');

insert into public.services (id, business_id, name, duration_min, price_paise) values
  ('00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a000-000000000001', 'General consultation', 15, 50000),
  ('00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a000-000000000001', 'Chest & asthma consultation', 20, 80000),
  ('00000000-0000-4000-a002-000000000003', '00000000-0000-4000-a000-000000000001', 'Lung function test (PFT)', 30, 120000),
  ('00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a000-000000000001', 'Physiotherapy session', 45, 70000),
  ('00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a000-000000000001', 'Follow-up (within 7 days)', 10, 0);

insert into public.service_staff (business_id, service_id, staff_id) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000001', '00000000-0000-4000-a001-000000000001'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000002', '00000000-0000-4000-a001-000000000002'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000003', '00000000-0000-4000-a001-000000000002'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000004', '00000000-0000-4000-a001-000000000003'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a001-000000000001'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a002-000000000005', '00000000-0000-4000-a001-000000000002');

-- Mon-Sat 9:00-13:30 and 17:00-21:00, Sunday 10:00-13:00 (Dr. Mehta only).
insert into public.availability_rules (business_id, staff_id, weekday, start_time, end_time)
select '00000000-0000-4000-a000-000000000001'::uuid, null, d, s, e
from generate_series(1, 6) d,
     (values ('09:00'::time, '13:30'::time), ('17:00'::time, '21:00'::time)) as shifts(s, e);

insert into public.availability_rules (business_id, staff_id, weekday, start_time, end_time) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a001-000000000001', 0, '10:00', '13:00');

-- Knowledge base documents are in seed-knowledge.sql.
