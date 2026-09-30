-- Place the existing LOADM test merchants around the supplied location.
-- Center: latitude 10.699335, longitude 76.7492411
-- Safe to run repeatedly; it only updates LOADM merchants.
with numbered as (
  select id, row_number() over (order by merchant_code) - 1 as n
  from public.merchants
  where merchant_code like 'LOADM%'
)
update public.merchants as m
set
  latitude = round((10.699335 + ((((numbered.n % 25) - 12)::numeric) * 0.0025))::numeric, 6),
  longitude = round((76.7492411 + ((((floor(numbered.n / 25)::int % 25) - 12)::numeric) * 0.0025))::numeric, 6)
from numbered
where m.id = numbered.id;

-- Verify the result.
select merchant_code, name, latitude, longitude
from public.merchants
where merchant_code like 'LOADM%'
order by merchant_code
limit 20;
