-- Mantiene el catálogo público para visitantes anónimos y evita evaluar
-- dos políticas permisivas para el personal autenticado.
drop policy if exists locations_public_read on public.locations;
create policy locations_public_read on public.locations
for select to anon using (active);

drop policy if exists vehicle_categories_public_read on public.vehicle_categories;
create policy vehicle_categories_public_read on public.vehicle_categories
for select to anon using (active);

drop policy if exists vehicle_models_public_read on public.vehicle_models;
create policy vehicle_models_public_read on public.vehicle_models
for select to anon using (active);
