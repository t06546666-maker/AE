-- Add new earning and redemption configurations to the merchants table
ALTER TABLE public.merchants
ADD COLUMN IF NOT EXISTS earn_points_per_100 INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS redeem_discount_per_100 INTEGER DEFAULT 5;

-- Create point_redemptions table to track redemption transactions
CREATE TABLE IF NOT EXISTS public.point_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  transaction_amount NUMERIC(12,2) NOT NULL CHECK (transaction_amount >= 0),
  points_redeemed INTEGER NOT NULL CHECK (points_redeemed > 0),
  discount_percentage NUMERIC(5,2) NOT NULL CHECK (discount_percentage >= 0),
  discount_amount NUMERIC(12,2) NOT NULL CHECK (discount_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS and add policies
ALTER TABLE public.point_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read all point redemptions" ON public.point_redemptions;
CREATE POLICY "admins read all point redemptions" ON public.point_redemptions FOR ALL
USING (public.current_profile_role() = 'admin');

DROP POLICY IF EXISTS "merchants read own point redemptions" ON public.point_redemptions;
CREATE POLICY "merchants read own point redemptions" ON public.point_redemptions FOR SELECT
USING (merchant_id = public.current_merchant_id());

-- Update process_purchase RPC function to use the new exact point calculation logic
CREATE OR REPLACE FUNCTION public.process_purchase(
  p_idempotency_key text,
  p_customer_code text,
  p_merchant_id uuid,
  p_amount numeric,
  p_location text,
  p_source text,
  p_points_per_100 integer -- the merchant's configured earn_points_per_100
)
RETURNS TABLE (
  order_id uuid,
  order_no text,
  customer_id uuid,
  customer_code text,
  customer_name text,
  customer_phone text,
  customer_email text,
  merchant_name text,
  amount numeric,
  points_earned numeric,
  total_points numeric,
  qr_scans integer,
  is_returning boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer public.customers%rowtype;
  v_membership public.customer_merchants%rowtype;
  v_merchant_name text;
  v_order public.orders%rowtype;
  v_points numeric;
  v_prior_orders integer;
  v_eligible_amount numeric;
BEGIN
  IF p_amount < 0 THEN RAISE EXCEPTION 'Purchase amount must be greater than or equal to zero'; END IF;
  IF p_source NOT IN ('registration', 'qr', 'manual') THEN RAISE EXCEPTION 'Invalid purchase source'; END IF;

  SELECT * INTO v_customer
  FROM public.customers
  WHERE customers.customer_code = p_customer_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  SELECT name INTO v_merchant_name FROM public.merchants WHERE id = p_merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant not found'; END IF;

  BEGIN
    INSERT INTO public.customer_merchants (customer_id, merchant_id)
    VALUES (v_customer.id, p_merchant_id);
  EXCEPTION WHEN unique_violation THEN
    -- Do nothing on conflict
  END;

  SELECT * INTO v_membership
  FROM public.customer_merchants
  WHERE customer_merchants.customer_id = v_customer.id AND customer_merchants.merchant_id = p_merchant_id
  FOR UPDATE;

  SELECT count(*) INTO v_prior_orders
  FROM public.orders
  WHERE orders.customer_id = v_customer.id AND orders.merchant_id = p_merchant_id;

  -- 1. Minimum purchase ₹100, Maximum eligible ₹10,000
  IF p_amount < 100 THEN
    v_eligible_amount := 0;
  ELSIF p_amount > 10000 THEN
    v_eligible_amount := 10000;
  ELSE
    v_eligible_amount := p_amount;
  END IF;

  -- 2. Pro-rata points calculation: Floor((Amount / 100) * points_per_100)
  IF v_eligible_amount > 0 THEN
    v_points := floor((v_eligible_amount / 100.0) * p_points_per_100);
  ELSE
    v_points := 0;
  END IF;

  INSERT INTO public.orders (
    order_no, customer_id, merchant_id, network_id, amount, location,
    reward_points, is_returning, source, idempotency_key
  )
  VALUES (
    'AE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_customer.id, p_merchant_id, v_customer.network_id, p_amount, coalesce(nullif(p_location, ''), 'In-store'),
    v_points, v_prior_orders > 0, p_source, p_idempotency_key
  )
  RETURNING * INTO v_order;

  -- Only add reward points if > 0 (this updates the global and membership balances safely)
  IF v_points > 0 THEN
    UPDATE public.customers
    SET reward_points = reward_points + v_points
    WHERE customers.id = v_customer.id;
  END IF;

  UPDATE public.customer_merchants
  SET reward_points = reward_points + v_points,
      qr_scans = customer_merchants.qr_scans + CASE WHEN p_source = 'qr' THEN 1 ELSE 0 END
  WHERE customer_merchants.customer_id = v_customer.id AND customer_merchants.merchant_id = p_merchant_id
  RETURNING * INTO v_membership;

  RETURN QUERY SELECT
    v_order.id, v_order.order_no, v_customer.id, v_customer.customer_code,
    v_customer.name, v_customer.phone, coalesce(v_customer.email, ''),
    v_merchant_name, v_order.amount, v_order.reward_points,
    v_membership.reward_points, v_membership.qr_scans,
    v_order.is_returning, v_order.created_at;
END;
$$;

-- RPC to deduct points safely
CREATE OR REPLACE FUNCTION public.deduct_customer_points(p_customer_id UUID, p_merchant_id UUID, p_points NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.customers
  SET reward_points = reward_points - p_points
  WHERE id = p_customer_id;
  
  UPDATE public.customer_merchants
  SET reward_points = reward_points - p_points
  WHERE customer_id = p_customer_id AND merchant_id = p_merchant_id;
END;
$$;
