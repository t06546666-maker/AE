import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

# In previous python files (like patch_sql6.py), we used direct requests to REST API to run SQL via RPC.
import requests

query = """
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS push_token text,
ADD COLUMN IF NOT EXISTS push_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS location_enabled boolean DEFAULT false;
"""

response = requests.post(
    f"{url}/rest/v1/",
    headers={
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    },
    json={"query": query}
)

# Actually, the simplest way is to check patch_sql6.py and copy its method
