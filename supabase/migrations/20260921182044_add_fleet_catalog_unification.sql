-- AGM Rent a Car: Unificación de catálogo de flota y corrección de trigger de stale.
-- 1. Permite drivetrain y fuel_type nulos para modelos sin especificaciones técnicas confirmadas por AGM.
-- 2. Desactiva Hyundai Accent (modelo de seed legacy).
-- 3. Inserta los 3 modelos reales del frontend (Nissan Kicks, Ford Territory, Mazda CX-5) con drivetrain y fuel_type = NULL.
-- 4. Genera sus traducciones maestras en español y pendientes en inglés y portugués.

-- 1. ESQUEMA: Permitir valores NULL en drivetrain y fuel_type cuando no estén demostrados
alter table public.vehicle_models
  alter column drivetrain drop not null;

alter table public.vehicle_models
  alter column fuel_type drop not null;

alter table public.vehicle_models
  alter column fuel_type drop default;

-- 2. CORRECCIÓN TRIGGER: Refinar la comprobación de translation_status a estados válidos
create or replace function private.handle_vehicle_model_translation_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if new.locale = 'es' then
    v_hash := md5(jsonb_build_object(
      'display_name', coalesce(new.display_name, ''),
      'category_name', coalesce(new.category_name, ''),
      'short_description', coalesce(new.short_description, ''),
      'description', coalesce(new.description, ''),
      'seo_title', coalesce(new.seo_title, ''),
      'meta_description', coalesce(new.meta_description, '')
    )::text);

    new.source_hash := v_hash;
    new.translation_source := 'original';
    new.translation_status := 'original';

    -- Si cambió el contenido en español, marcar traducciones existentes como 'stale'
    -- Conserva translation_source (ej: 'manual' se preserva y su status pasa a 'stale')
    if tg_op = 'UPDATE' and old.source_hash is distinct from v_hash then
      update public.vehicle_model_translations
      set translation_status = 'stale',
          updated_at = now()
      where vehicle_model_id = new.vehicle_model_id
        and locale in ('en', 'pt')
        and translation_status in ('translated', 'reviewed', 'stale');
    end if;
  end if;

  return new;
end;
$$;

-- 3. CATEGORÍAS: Asegurar categoría suv-crossover en paridad con el frontend
insert into public.vehicle_categories (slug, name, description, sort_order)
values ('suv-crossover', 'SUV • Crossover', 'Vehículos ágiles y modernos para ciudad y rutas patagónicas.', 15)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order;

-- 4. DESACTIVAR HYUNDAI ACCENT (preservando historial y relaciones)
update public.vehicle_models
set active = false, updated_at = now()
where slug = 'hyundai-accent';

-- 5. INSERTAR LOS 3 MODELOS REALES DEL FRONTEND CON ESPECIFICACIONES VERIFICADAS
-- drivetrain y fuel_type quedan en NULL al no estar confirmados documentalmente por AGM
insert into public.vehicle_models (
  category_id,
  slug,
  make,
  model,
  display_name,
  transmission,
  drivetrain,
  fuel_type,
  seats,
  luggage_capacity,
  air_conditioning,
  image_url,
  description,
  usage_tags,
  sort_order,
  active
) values
  (
    (select id from public.vehicle_categories where slug = 'suv-crossover'),
    'nissan-kicks',
    'Nissan',
    'Kicks',
    'Nissan Kicks',
    'automatic',
    null,
    null,
    5,
    2,
    true,
    'assets/images/nissan-kicks.jpg',
    'Ágil, moderna y eficiente para recorrer Punta Arenas y la Patagonia.',
    array['suv-crossover', 'turismo'],
    10,
    true
  ),
  (
    (select id from public.vehicle_categories where slug = 'suv-familiar'),
    'ford-territory',
    'Ford',
    'Territory',
    'Ford Territory',
    'automatic',
    null,
    null,
    5,
    3,
    true,
    'assets/images/ford-territory.jpg',
    'Gran espacio interior, confort premium y tecnología para viajes largos.',
    array['suv-crossover', 'suv-familiar', 'turismo'],
    20,
    true
  ),
  (
    (select id from public.vehicle_categories where slug = 'suv-familiar'),
    'mazda-cx-5',
    'Mazda',
    'CX-5',
    'Mazda CX-5',
    'automatic',
    null,
    null,
    5,
    3,
    true,
    'assets/images/mazda-cx5.jpg',
    'Elegancia, estabilidad superior y máximo confort para recorrer el sur.',
    array['suv-crossover', 'suv-familiar', 'turismo'],
    30,
    true
  )
on conflict (slug) do update set
  category_id = excluded.category_id,
  make = excluded.make,
  model = excluded.model,
  display_name = excluded.display_name,
  transmission = excluded.transmission,
  drivetrain = excluded.drivetrain,
  fuel_type = excluded.fuel_type,
  seats = excluded.seats,
  luggage_capacity = excluded.luggage_capacity,
  air_conditioning = excluded.air_conditioning,
  image_url = excluded.image_url,
  description = excluded.description,
  usage_tags = excluded.usage_tags,
  sort_order = excluded.sort_order,
  active = true;

-- Actualizar orden de los modelos restantes
update public.vehicle_models set sort_order = 40, updated_at = now() where slug = 'toyota-rav4';
update public.vehicle_models set sort_order = 50, updated_at = now() where slug = 'toyota-4runner';
update public.vehicle_models set sort_order = 60, updated_at = now() where slug = 'mazda-bt-50';

-- 6. POBLAR TRADUCCIONES PARA LOS 3 NUEVOS MODELOS
-- Español (contenido maestro con source_hash calculado por trigger)
insert into public.vehicle_model_translations (
  vehicle_model_id,
  locale,
  display_name,
  category_name,
  description,
  translation_source,
  translation_status
)
select
  vm.id,
  'es',
  coalesce(nullif(trim(vm.display_name), ''), vm.make || ' ' || vm.model),
  vc.name,
  vm.description,
  'original',
  'original'
from public.vehicle_models vm
left join public.vehicle_categories vc on vc.id = vm.category_id
where vm.slug in ('nissan-kicks', 'ford-territory', 'mazda-cx-5')
on conflict (vehicle_model_id, locale) do nothing;

-- Inglés y Portugués (pendientes de traducción, sin strings falsos)
insert into public.vehicle_model_translations (
  vehicle_model_id,
  locale,
  display_name,
  translation_source,
  translation_status
)
select
  vm.id,
  l.locale,
  null,
  'automatic',
  'pending'
from public.vehicle_models vm
cross join (values ('en'), ('pt')) as l(locale)
where vm.slug in ('nissan-kicks', 'ford-territory', 'mazda-cx-5')
on conflict (vehicle_model_id, locale) do nothing;
