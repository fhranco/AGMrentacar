-- Datos públicos conocidos. Las unidades físicas se cargan cuando AGM entregue
-- códigos internos, patentes, año y kilometraje de cada vehículo.

insert into public.locations (slug, name, kind, sort_order)
values
  ('aeropuerto-punta-arenas', 'Aeropuerto de Punta Arenas', 'airport', 10),
  ('hotel-punta-arenas', 'Hotel en Punta Arenas', 'hotel', 20),
  ('departamento-punta-arenas', 'Departamento en Punta Arenas', 'apartment', 30),
  ('oficina-agm', 'Oficina AGM - Punta Arenas', 'office', 40)
on conflict (slug) do update set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  active = true;

insert into public.vehicle_categories (slug, name, description, sort_order)
values
  ('sedan', 'Sedán', 'Vehículos eficientes para ciudad y carretera.', 10),
  ('suv-4x4', 'SUV 4x4', 'SUV preparados para rutas australes.', 20),
  ('camioneta-4x4', 'Camionetas 4x4', 'Pick-up para aventura, empresas y faena.', 30),
  ('suv-familiar', 'SUV familiar', 'Vehículos amplios para viajes en familia.', 40),
  ('mineria', 'Camionetas para minería', 'Unidades configurables para operación y faena.', 50)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  active = true;

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
  image_url,
  description,
  usage_tags,
  sort_order
)
values
  (
    (select id from public.vehicle_categories where slug = 'sedan'),
    'hyundai-accent',
    'Hyundai',
    'Accent',
    'Hyundai Accent',
    'manual',
    '4x2',
    'gasoline',
    5,
    2,
    'https://agmrentacar.cl/wp-content/themes/agmrentacar/img/autos/accent-min.jpg',
    'Cómodo y eficiente para recorrer Punta Arenas.',
    array['sedan', 'turismo'],
    10
  ),
  (
    (select id from public.vehicle_categories where slug = 'suv-4x4'),
    'toyota-rav4',
    'Toyota',
    'RAV4',
    'Toyota RAV4',
    'automatic',
    '4x4',
    'gasoline',
    5,
    3,
    'https://agmrentacar.cl/wp-content/uploads/2017/11/98518.png',
    'Versátil, segura y preparada para rutas australes.',
    array['suv-4x4', 'turismo', 'familiar'],
    20
  ),
  (
    (select id from public.vehicle_categories where slug = 'suv-familiar'),
    'toyota-4runner',
    'Toyota',
    '4Runner',
    'Toyota 4Runner',
    'automatic',
    '4x4',
    'gasoline',
    7,
    4,
    'https://agmrentacar.cl/wp-content/themes/agmrentacar/img/autos/Toyota-4-Runner-min.jpg',
    'Potencia, espacio y confort para viajar en familia.',
    array['suv-4x4', 'suv-familiar', 'turismo'],
    30
  ),
  (
    (select id from public.vehicle_categories where slug = 'camioneta-4x4'),
    'mazda-bt-50',
    'Mazda',
    'BT-50',
    'Mazda BT-50',
    'manual',
    '4x4',
    'diesel',
    5,
    0,
    'https://agmrentacar.cl/wp-content/themes/agmrentacar/img/autos/Mazda-BT-50-min.jpg',
    'Robusta y confiable para aventura, trabajo o faena.',
    array['camioneta-4x4', 'mineria', 'empresa', 'faena'],
    40
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
  image_url = excluded.image_url,
  description = excluded.description,
  usage_tags = excluded.usage_tags,
  sort_order = excluded.sort_order,
  active = true;
