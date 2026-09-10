import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Fix ON CONFLICT ambiguity by removing ON CONFLICT expression and using BEGIN/EXCEPTION
old_block = """  INSERT INTO public.customer_merchants (customer_id, merchant_id)
  VALUES (v_customer.id, p_merchant_id)
  ON CONFLICT (customer_id, merchant_id) DO NOTHING;"""

new_block = """  BEGIN
    INSERT INTO public.customer_merchants (customer_id, merchant_id)
    VALUES (v_customer.id, p_merchant_id);
  EXCEPTION WHEN unique_violation THEN
    -- Do nothing on conflict
  END;"""

sql = sql.replace(old_block, new_block)

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
