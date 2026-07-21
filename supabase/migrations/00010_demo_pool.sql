-- Demo account pool + round-robin claim RPC.
-- Additive only; safe to apply to any project (prod or demo) — table stays empty
-- unless a seed script populates it. No RLS policies => invisible to direct
-- queries from anon/authenticated; access is via the SECURITY DEFINER function.

CREATE TABLE IF NOT EXISTS public.demo_account_pool (
  phone text PRIMARY KEY,
  last_assigned_at timestamptz
);

ALTER TABLE public.demo_account_pool ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_demo_account()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_phone text;
BEGIN
  -- Prefer accounts with NO active booking so the visitor can book fresh.
  SELECT p.phone INTO v_phone
  FROM public.demo_account_pool p
  JOIN public.profiles prof ON prof.phone = p.phone
  LEFT JOIN public.bookings b ON b.user_id = prof.id AND b.cancelled_at IS NULL
  WHERE b.id IS NULL
  ORDER BY p.last_assigned_at NULLS FIRST, p.phone
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Fallback: every account already has a booking; return least-recently-assigned.
  IF v_phone IS NULL THEN
    SELECT phone INTO v_phone
    FROM public.demo_account_pool
    ORDER BY last_assigned_at NULLS FIRST, phone
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
  END IF;

  IF v_phone IS NULL THEN
    RAISE EXCEPTION 'No demo accounts available';
  END IF;

  UPDATE public.demo_account_pool
  SET last_assigned_at = now()
  WHERE phone = v_phone;

  RETURN v_phone;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_demo_account() TO anon, authenticated;
