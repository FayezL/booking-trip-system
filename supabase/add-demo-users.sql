-- ============================================================
-- ADD DEMO USERS — 30 fake Coptic Christian users
-- All demo phones start with 099 for easy identification
-- All passwords: demo123
-- Run this in Supabase SQL Editor
-- ============================================================

BEGIN;

-- Temporarily disable the auth trigger (we insert profiles manually)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Insert demo users into auth.users
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_user_meta_data
) VALUES
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', '09900010001@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Mina Youssef","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', '09900010002@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Bishoy Adel","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', '09900010003@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Abanoub Raafat","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', '09900010004@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Michael Magdy","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', '09900010005@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Youssef Kamal","gender":"Male","role":"patient","has_wheelchair":true}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', '09900010006@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Samuel Atef","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', '09900010007@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"David Hani","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', '09900010008@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Paul Emad","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', '09900010009@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Anthony Makram","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated', '09900010010@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"John Waheed","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated', '09900010011@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Matthew Nabil","gender":"Male","role":"patient","has_wheelchair":true}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated', '09900010012@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Thomas Fadi","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000013', 'authenticated', 'authenticated', '09900010013@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Girgis Fouad","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000014', 'authenticated', 'authenticated', '09900010014@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Morcos Sherif","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000015', 'authenticated', 'authenticated', '09900010015@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Karas Sameh","gender":"Male","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000016', 'authenticated', 'authenticated', '09900010016@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Maryam George","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000017', 'authenticated', 'authenticated', '09900010017@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Martha Samir","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000018', 'authenticated', 'authenticated', '09900010018@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Demiana Fawzy","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000019', 'authenticated', 'authenticated', '09900010019@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Irene Ashraf","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000020', 'authenticated', 'authenticated', '09900010020@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Marina Nabil","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000021', 'authenticated', 'authenticated', '09900010021@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Catherine Emad","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000022', 'authenticated', 'authenticated', '09900010022@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Lucia Kamal","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000023', 'authenticated', 'authenticated', '09900010023@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Sarah Adel","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000024', 'authenticated', 'authenticated', '09900010024@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Rebecca Magdy","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000025', 'authenticated', 'authenticated', '09900010025@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Verena Morcos","gender":"Female","role":"patient","has_wheelchair":true}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000026', 'authenticated', 'authenticated', '09900010026@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Christine Medhat","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000027', 'authenticated', 'authenticated', '09900010027@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Angela Makram","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000028', 'authenticated', 'authenticated', '09900010028@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Elizabeth Boutros","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000029', 'authenticated', 'authenticated', '09900010029@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Victoria Bishoy","gender":"Female","role":"patient","has_wheelchair":false}'),
  ('00000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000030', 'authenticated', 'authenticated', '09900010030@church.local', crypt('demo123', gen_salt('bf')), now(), now(), now(), '{"full_name":"Rose Abanoub","gender":"Female","role":"patient","has_wheelchair":false}')
ON CONFLICT DO NOTHING;

-- Insert profiles
INSERT INTO profiles (id, phone, full_name, gender, role, has_wheelchair, transport_type, servants_needed, sector_id) VALUES
  ('d0000000-0000-0000-0000-000000000001', '09900010001', 'Mina Youssef', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '01' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000002', '09900010002', 'Bishoy Adel', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '01' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000003', '09900010003', 'Abanoub Raafat', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '03' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000004', '09900010004', 'Michael Magdy', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '02' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000005', '09900010005', 'Youssef Kamal', 'Male', 'patient', true, 'bus', 1, (SELECT id FROM sectors WHERE code = '06' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000006', '09900010006', 'Samuel Atef', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '03' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000007', '09900010007', 'David Hani', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '04' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000008', '09900010008', 'Paul Emad', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '05' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000009', '09900010009', 'Anthony Makram', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '07' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000010', '09900010010', 'John Waheed', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '01' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000011', '09900010011', 'Matthew Nabil', 'Male', 'patient', true, 'bus', 1, (SELECT id FROM sectors WHERE code = '08' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000012', '09900010012', 'Thomas Fadi', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '09' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000013', '09900010013', 'Girgis Fouad', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '10' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000014', '09900010014', 'Morcos Sherif', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '11' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000015', '09900010015', 'Karas Sameh', 'Male', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '12' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000016', '09900010016', 'Maryam George', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '01' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000017', '09900010017', 'Martha Samir', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '02' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000018', '09900010018', 'Demiana Fawzy', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '03' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000019', '09900010019', 'Irene Ashraf', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '13' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000020', '09900010020', 'Marina Nabil', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '04' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000021', '09900010021', 'Catherine Emad', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '14' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000022', '09900010022', 'Lucia Kamal', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '05' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000023', '09900010023', 'Sarah Adel', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '06' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000024', '09900010024', 'Rebecca Magdy', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '07' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000025', '09900010025', 'Verena Morcos', 'Female', 'patient', true, 'bus', 1, (SELECT id FROM sectors WHERE code = '15' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000026', '09900010026', 'Christine Medhat', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '08' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000027', '09900010027', 'Angela Makram', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '09' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000028', '09900010028', 'Elizabeth Boutros', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '10' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000029', '09900010029', 'Victoria Bishoy', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '11' LIMIT 1)),
  ('d0000000-0000-0000-0000-000000000030', '09900010030', 'Rose Abanoub', 'Female', 'patient', false, 'bus', 0, (SELECT id FROM sectors WHERE code = '12' LIMIT 1))
ON CONFLICT DO NOTHING;

-- Re-create the auth trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;
