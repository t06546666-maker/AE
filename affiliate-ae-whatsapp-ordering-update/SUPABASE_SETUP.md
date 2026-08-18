# Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase-schema.sql`, and run it.
3. Open **Authentication > Users** and create the first admin user with an email and password.
4. Run this in **SQL Editor**, replacing the email:

```sql
insert into public.profiles (id, full_name, role)
select id, 'Admin User', 'admin'
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
set full_name = excluded.full_name, role = 'admin', merchant_id = null;
```

5. Open **Project Settings > API** and add these values to `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

The service-role key must only exist in the backend `.env`. Never place it in
`public/index.html` or commit it to source control.

6. Restart the server:

```powershell
npm start
```

Sign in with the admin user. Admins can create merchants from the Merchants
screen; each merchant receives a separate account linked only to that store.
