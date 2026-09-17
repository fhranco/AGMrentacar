-- Agrega trazabilidad del consentimiento de datos personales según Ley N° 21.719
alter table public.reservations
  add column if not exists privacy_consent boolean not null default false,
  add column if not exists privacy_consent_at timestamptz,
  add column if not exists privacy_policy_version text default '2026-v1';

comment on column public.reservations.privacy_consent is 'Indica aceptación explícita de la política de datos según Ley N° 21.719';
comment on column public.reservations.privacy_consent_at is 'Marca de tiempo en que el titular otorgó el consentimiento';
comment on column public.reservations.privacy_policy_version is 'Versión de la política de privacidad aceptada al momento de la solicitud';
