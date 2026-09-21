-- AGM Rent a Car: Normalización de usage_tags para Toyota RAV4
-- Asegura que Toyota RAV4 responda a los filtros canónicos 'suv-4x4' y 'suv-familiar'
-- reemplazando el tag ambiguo 'familiar' por 'suv-familiar'.

update public.vehicle_models
set
  usage_tags = array['suv-4x4', 'suv-familiar', 'turismo'],
  updated_at = now()
where slug = 'toyota-rav4';
