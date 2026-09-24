-- Actualización de especificaciones técnicas solicitadas:
-- Nissan Kicks: transmisión manual, 3 maletas
-- Ford Territory: 4 maletas
-- Mazda CX-5: 4 maletas
-- Toyota RAV4: 4 maletas
-- Toyota 4Runner: 5 maletas

update public.vehicle_models
set transmission = 'manual',
    luggage_capacity = 3,
    updated_at = now()
where slug = 'nissan-kicks';

update public.vehicle_models
set luggage_capacity = 4,
    updated_at = now()
where slug in ('ford-territory', 'mazda-cx-5', 'toyota-rav4');

update public.vehicle_models
set luggage_capacity = 5,
    updated_at = now()
where slug = 'toyota-4runner';
