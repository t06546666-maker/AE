import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Add network_id to INSERT INTO public.orders
old_block = """  INSERT INTO public.orders (
    order_no, customer_id, merchant_id, amount, location,
    reward_points, is_returning, source, idempotency_key
  )
  VALUES (
    'AE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_customer.id, p_merchant_id, p_amount, coalesce(nullif(p_location, ''), 'In-store'),
    v_points, v_prior_orders > 0, p_source, p_idempotency_key
  )"""

new_block = """  INSERT INTO public.orders (
    order_no, customer_id, merchant_id, network_id, amount, location,
    reward_points, is_returning, source, idempotency_key
  )
  VALUES (
    'AE-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    v_customer.id, p_merchant_id, v_customer.network_id, p_amount, coalesce(nullif(p_location, ''), 'In-store'),
    v_points, v_prior_orders > 0, p_source, p_idempotency_key
  )"""

sql = sql.replace(old_block, new_block)

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
