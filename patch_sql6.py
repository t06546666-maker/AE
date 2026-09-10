import re

with open('supabase-rewards-engine-update.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

# Add DROP FUNCTION before CREATE OR REPLACE FUNCTION
drop_stmt = "DROP FUNCTION IF EXISTS public.process_purchase(text, text, uuid, numeric, text, text, integer);\n\nCREATE OR REPLACE FUNCTION public.process_purchase("

sql = sql.replace("CREATE OR REPLACE FUNCTION public.process_purchase(", drop_stmt)

with open('supabase-rewards-engine-update.sql', 'w', encoding='utf-8') as f:
    f.write(sql)
