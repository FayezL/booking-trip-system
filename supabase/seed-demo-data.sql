-- Demo seed: 100 fake users + 2 trips + buses + rooms + ~40 bookings.
-- RUN ON THE DEMO DATABASE ONLY.
-- Idempotent (ON CONFLICT DO NOTHING); safe to re-run after cleanup.

BEGIN;

-- Drop the auth trigger so we control profile + head family_member creation.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- =====================================================================
-- 1. Demo users (100 patients, phones 09900010001–09900010100)
-- =====================================================================

DO $$
DECLARE
  g int;
  v_phone text;
  v_uuid uuid;
  v_first text;
  v_last text;
  v_full text;
  v_gender text;
  v_sector_code text;
  v_sector_id uuid;
  v_wheelchair boolean;
  v_transport text;
  v_servants int;
  male_names text[] := ARRAY[
    'Mina','Abanoub','Bishoy','Peter','George','Michael','Youssef','Karim',
    'Fady','Mark','Andrew','David','Steven','Tony','Adel','Emad',
    'Hany','Nabil','Raafat','Samir','Wagdy','Amin','Boutros','Fouad','Galal'
  ];
  female_names text[] := ARRAY[
    'Mary','Marina','Verena','Marianne','Angela','Mirna','Nancy','Sara',
    'Demiana','Irene','Maggie','Mona','Donia','Mariam','Carmen','Sylvia',
    'Vera','Martina','Fify','Sawsan','Neveen','Hala','Lilian','Rania','Dina'
  ];
  last_names text[] := ARRAY[
    'Sidhom','Bebawy','Messiha','Gayed','Wassef','Aziz','Mikhail','Salib',
    'Ibrahim','Marcus','Felix','Naguib','Samaan','Rofail','Ayad','Malek',
    'Hanna','Sobhy','Morkos','Farag'
  ];
BEGIN
  FOR g IN 1..100 LOOP
    v_phone := '0990001' || lpad(g::text, 4, '0');
    v_uuid := ('d0000000-0000-0000-0000-' || lpad(g::text, 12, '0'))::uuid;
    v_gender := CASE WHEN g <= 50 THEN 'Male' ELSE 'Female' END;
    v_first := CASE
      WHEN g <= 50 THEN male_names[((g - 1) % 25) + 1]
      ELSE female_names[((g - 51) % 25) + 1]
    END;
    v_last := last_names[((g - 1) % 20) + 1];
    v_full := v_first || ' ' || v_last;
    v_sector_code := lpad(((g - 1) % 15 + 1)::text, 2, '0');
    v_wheelchair := (g % 13 = 0);
    v_transport := CASE WHEN g % 7 = 0 THEN 'private' ELSE 'bus' END;
    v_servants := CASE WHEN g % 33 = 0 THEN 2 WHEN g % 11 = 0 THEN 1 ELSE 0 END;

    SELECT id INTO v_sector_id FROM public.sectors WHERE code = v_sector_code LIMIT 1;

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uuid,
      'authenticated',
      'authenticated',
      v_phone || '@church.local',
      crypt('demo123', gen_salt('bf')),
      now(), now(), now(),
      jsonb_build_object(
        'full_name', v_full,
        'gender', v_gender,
        'role', 'patient',
        'has_wheelchair', v_wheelchair
      )
    ) ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.profiles (
      id, phone, full_name, gender, role, has_wheelchair,
      transport_type, servants_needed, sector_id
    ) VALUES (
      v_uuid, v_phone, v_full, v_gender, 'patient', v_wheelchair,
      v_transport, v_servants, v_sector_id
    ) ON CONFLICT (id) DO NOTHING;

    -- Head family_members row (required by 00101 booking model)
    INSERT INTO public.family_members (
      head_user_id, full_name, gender, has_wheelchair, is_head,
      phone, role, transport_type, servants_needed
    ) VALUES (
      v_uuid, v_full, v_gender, v_wheelchair, true,
      v_phone, 'patient', v_transport, v_servants
    ) ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- =====================================================================
-- 2. Two demo trips (fixed UUIDs so cleanup can target them safely)
-- =====================================================================

INSERT INTO public.trips (id, title_ar, title_en, trip_date, is_open) VALUES
  ('a1000000-0000-0000-0000-000000000001',
   '[DEMO] رحلة دير الأنبا بيشوي',
   '[DEMO] Anba Bishoy Monastery Trip',
   CURRENT_DATE + 14, true),
  ('a1000000-0000-0000-0000-000000000002',
   '[DEMO] رحلة دير السيدة العذراء',
   '[DEMO] Virgin Mary Monastery Trip',
   CURRENT_DATE + 35, true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 3. Buses (4 per trip, ~45 capacity)
-- =====================================================================

INSERT INTO public.buses (id, trip_id, area_name_ar, area_name_en, capacity, leader_name, bus_label) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'شبرا',      'Shobra',     45, 'Mina Adel',   'Bus 1'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'مصر الجديدة','Heliopolis', 45, 'Peter Samir', 'Bus 2'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'المعادي',    'Maadi',      40, 'George Nabil','Bus 3'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'الزيتون',    'Zaitoun',    40, 'Karim Hany',  'Bus 4'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000002', 'شبرا',      'Shobra',     45, 'Mina Adel',   'Bus 1'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'مصر الجديدة','Heliopolis', 45, 'Peter Samir', 'Bus 2'),
  ('b1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'المعادي',    'Maadi',      40, 'George Nabil','Bus 3'),
  ('b1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'الزيتون',    'Zaitoun',    40, 'Karim Hany',  'Bus 4')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 4. Rooms (5 per trip: 3 male + 2 female)
-- =====================================================================

INSERT INTO public.rooms (id, trip_id, room_type, capacity, supervisor_name, room_label) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'Male',   8, 'Abouna Bishoy', 'Ground A'),
  ('c1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000001', 'Male',   8, 'Abouna Bishoy', 'Ground B'),
  ('c1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000001', 'Male',   6, 'Abouna Bishoy', 'Upper A'),
  ('c1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000001', 'Female', 8, 'Tasoni Mary',   'Ground C'),
  ('c1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000001', 'Female', 8, 'Tasoni Mary',   'Ground D'),
  ('c1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000002', 'Male',   8, 'Abouna Bishoy', 'Ground A'),
  ('c1000000-0000-0000-0000-000000000007', 'a1000000-0000-0000-0000-000000000002', 'Male',   8, 'Abouna Bishoy', 'Ground B'),
  ('c1000000-0000-0000-0000-000000000008', 'a1000000-0000-0000-0000-000000000002', 'Male',   6, 'Abouna Bishoy', 'Upper A'),
  ('c1000000-0000-0000-0000-000000000009', 'a1000000-0000-0000-0000-000000000002', 'Female', 8, 'Tasoni Mary',   'Ground C'),
  ('c1000000-0000-0000-0000-000000000010', 'a1000000-0000-0000-0000-000000000002', 'Female', 8, 'Tasoni Mary',   'Ground D')
ON CONFLICT (id) DO NOTHING;

-- =====================================================================
-- 5. Bookings on trip 1 (20 male + 20 female; ~16 with rooms)
--    Respects room gender: males -> Male rooms, females -> Female rooms.
-- =====================================================================

DO $$
DECLARE
  i int;
  v_user_uuid uuid;
  v_fm uuid;
  v_bus uuid;
  v_room uuid;
BEGIN
  FOR i IN 1..20 LOOP
    -- Male: user i, bus (i-1)%4+1, room for first 8
    v_user_uuid := ('d0000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    SELECT id INTO v_fm FROM public.family_members
      WHERE head_user_id = v_user_uuid AND is_head = true LIMIT 1;
    v_bus := ('b1000000-0000-0000-0000-00000000000' || ((i - 1) % 4 + 1)::text)::uuid;
    v_room := CASE
      WHEN i <= 3 THEN 'c1000000-0000-0000-0000-000000000001'::uuid
      WHEN i <= 6 THEN 'c1000000-0000-0000-0000-000000000002'::uuid
      WHEN i <= 8 THEN 'c1000000-0000-0000-0000-000000000003'::uuid
      ELSE NULL
    END;
    INSERT INTO public.bookings (user_id, trip_id, bus_id, room_id, family_member_id)
    VALUES (v_user_uuid, 'a1000000-0000-0000-0000-000000000001', v_bus, v_room, v_fm)
    ON CONFLICT DO NOTHING;

    -- Female: user 50+i, same bus, female room for first 8
    v_user_uuid := ('d0000000-0000-0000-0000-' || lpad((50 + i)::text, 12, '0'))::uuid;
    SELECT id INTO v_fm FROM public.family_members
      WHERE head_user_id = v_user_uuid AND is_head = true LIMIT 1;
    v_room := CASE
      WHEN i <= 4 THEN 'c1000000-0000-0000-0000-000000000004'::uuid
      WHEN i <= 8 THEN 'c1000000-0000-0000-0000-000000000005'::uuid
      ELSE NULL
    END;
    INSERT INTO public.bookings (user_id, trip_id, bus_id, room_id, family_member_id)
    VALUES (v_user_uuid, 'a1000000-0000-0000-0000-000000000001', v_bus, v_room, v_fm)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- =====================================================================
-- 6. Populate demo account pool (round-robin source)
-- =====================================================================

INSERT INTO public.demo_account_pool (phone)
SELECT phone FROM public.profiles WHERE phone LIKE '099%'
ON CONFLICT (phone) DO NOTHING;

-- =====================================================================
-- 7. Re-enable the auth trigger
-- =====================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMIT;

NOTICE 'Demo seed complete: 100 users, 2 trips, 8 buses, 10 rooms, 40 bookings.';
