-- AGM Rent a Car: ampliación de idioma preferido del cliente.
-- Permite registrar 'pt' (portugués) además de 'es' y 'en' para mantener paridad con el frontend.

alter table public.customers
  drop constraint if exists customers_preferred_language_check;

alter table public.customers
  add constraint customers_preferred_language_check
  check (preferred_language in ('es', 'en', 'pt'));

comment on column public.customers.preferred_language is 'Idioma de preferencia para comunicaciones y cotizaciones (es, en, pt)';
