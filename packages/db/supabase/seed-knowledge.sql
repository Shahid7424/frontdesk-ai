-- Knowledge base for the demo clinic (Sunrise Family Clinic): the source of
-- truth for the RAG eval questions in packages/db/test/search.test.ts.
--
-- Safe to run again: it replaces the demo clinic's demo documents only.
-- On Supabase cloud, paste it into SQL Editor and run it once after
-- seed.sql. Chunks are stored without embeddings, so search is keyword
-- only until you click "Re-index" in the dashboard (with GEMINI_API_KEY set).

delete from public.documents
where business_id = '00000000-0000-4000-a000-000000000001'
  and id in ('00000000-0000-4000-a003-000000000001', '00000000-0000-4000-a003-000000000002');

insert into public.documents (id, business_id, name, kind, status, chunk_count) values
  ('00000000-0000-4000-a003-000000000001', '00000000-0000-4000-a000-000000000001', 'Clinic FAQ', 'text', 'ready', 6),
  ('00000000-0000-4000-a003-000000000002', '00000000-0000-4000-a000-000000000001', 'Patient guide.pdf', 'pdf', 'ready', 4);

insert into public.chunks (business_id, document_id, chunk_index, page, content) values
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 0, null,
   'Fees: General consultation ₹500, chest & asthma consultation ₹800, lung function test (PFT) ₹1,200, physiotherapy ₹700 per session. Follow-up within 7 days is free.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 1, null,
   'Timings: Mon to Sat 9:00 AM – 1:30 PM and 5:00 PM – 9:00 PM. Sunday 10:00 AM – 1:00 PM, only Dr. Mehta.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 2, null,
   'Address and parking: 2nd floor, Sai Plaza, Baner Road, near Balewadi Phata. Lift available. Two-wheeler parking in front, car parking in the basement.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 3, null,
   'Reports: PFT reports are ready in 30 minutes. Blood test reports from the partner lab come on WhatsApp within 24 hours.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 4, null,
   'Payments: UPI, cards and cash accepted. Cashless insurance is not available for OPD; we give a bill for reimbursement.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000001', 5, null,
   'PFT preparation: Avoid inhalers 4 hours before a lung function test if your doctor allows, no heavy meal 2 hours before, wear loose clothes.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000002', 0, 1,
   'Your first visit: Bring old prescriptions, reports, X-ray or CT films, and a list of the medicines you take now. Please come 10 minutes early to register.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000002', 1, 2,
   'Cancellation and rescheduling: You can cancel or reschedule free of charge up to 2 hours before your appointment. Advance payments are refunded to the original payment method within 5 to 7 working days.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000002', 2, 2,
   'Home visits are not available. For patients who cannot travel, Dr. Mehta offers a video consultation for ₹600.'),
  ('00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a003-000000000002', 3, 3,
   'Vaccines: Flu and pneumonia vaccines are given on weekdays from 10:00 AM to 1:00 PM. Walk in, no appointment needed.');
