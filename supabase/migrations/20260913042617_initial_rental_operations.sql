-- AGM Rent a Car: catálogo, inventario por unidad, reservas y comunicaciones.
-- Todas las fechas se almacenan con zona horaria y los importes en CLP son exactos.

create extension if not exists btree_gist with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;

create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'agent'
    check (role in ('agent', 'manager', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.locations (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  kind text not null
    check (kind in ('airport', 'office', 'hotel', 'apartment', 'custom')),
  address text,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_categories (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_models (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.vehicle_categories (id),
  slug text not null unique,
  make text not null,
  model text not null,
  display_name text not null,
  transmission text not null check (transmission in ('manual', 'automatic')),
  drivetrain text not null check (drivetrain in ('4x2', '4x4', 'awd')),
  fuel_type text not null default 'gasoline'
    check (fuel_type in ('gasoline', 'diesel', 'hybrid', 'electric')),
  seats smallint not null check (seats between 1 and 12),
  luggage_capacity smallint not null default 0
    check (luggage_capacity between 0 and 12),
  air_conditioning boolean not null default true,
  image_url text,
  description text,
  usage_tags text[] not null default '{}',
  active boolean not null default true,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.vehicle_units (
  id bigint generated always as identity primary key,
  model_id bigint not null references public.vehicle_models (id),
  internal_code text not null unique,
  license_plate text unique,
  model_year smallint check (model_year between 2000 and 2100),
  color text,
  odometer_km integer not null default 0 check (odometer_km >= 0),
  status text not null default 'active'
    check (status in ('active', 'maintenance', 'retired')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  full_name text not null,
  email text not null,
  phone text,
  tax_id text,
  preferred_language text not null default 'es'
    check (preferred_language in ('es', 'en')),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(btrim(email)))
);

create unique index customers_email_unique_idx on public.customers (email);

create table public.reservations (
  id bigint generated always as identity primary key,
  public_id uuid not null default gen_random_uuid() unique,
  reference_code text not null default (
    'AGM-' || to_char(clock_timestamp(), 'YYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
  ) unique,
  customer_id bigint not null references public.customers (id),
  requested_category_id bigint references public.vehicle_categories (id),
  requested_model_id bigint references public.vehicle_models (id),
  assigned_unit_id bigint references public.vehicle_units (id),
  pickup_location_id bigint not null references public.locations (id),
  return_location_id bigint not null references public.locations (id),
  pickup_at timestamptz not null,
  return_at timestamptz not null,
  customer_type text not null default 'tourism'
    check (customer_type in ('tourism', 'business', 'mining')),
  company_name text,
  company_tax_id text,
  status text not null default 'requested'
    check (
      status in (
        'requested', 'reviewing', 'quoted', 'confirmed', 'checked_out',
        'completed', 'cancelled', 'rejected', 'expired'
      )
    ),
  source text not null default 'web'
    check (source in ('web', 'email', 'phone', 'admin')),
  quoted_total_clp numeric(12, 0) check (quoted_total_clp >= 0),
  customer_notes text,
  internal_notes text,
  quoted_at timestamptz,
  confirmed_at timestamptz,
  checked_out_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  assigned_to_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (return_at > pickup_at),
  check (
    customer_type <> 'business'
    or (company_name is not null and company_tax_id is not null)
  ),
  check (
    status not in ('confirmed', 'checked_out', 'completed')
    or assigned_unit_id is not null
  )
);

create table public.unit_calendar_blocks (
  id bigint generated always as identity primary key,
  unit_id bigint not null references public.vehicle_units (id),
  reservation_id bigint references public.reservations (id) on delete cascade,
  block_type text not null
    check (block_type in ('reservation', 'maintenance', 'manual_hold')),
  status text not null default 'active'
    check (status in ('active', 'released')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (block_type = 'reservation' and reservation_id is not null)
    or (block_type <> 'reservation' and reservation_id is null)
  ),
  constraint unit_calendar_blocks_no_overlap
    exclude using gist (
      unit_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (status = 'active')
);

create unique index unit_calendar_blocks_active_reservation_idx
  on public.unit_calendar_blocks (reservation_id)
  where reservation_id is not null and status = 'active';

create table public.reservation_status_history (
  id bigint generated always as identity primary key,
  reservation_id bigint not null references public.reservations (id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  changed_by_user_id uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

create table public.communications (
  id bigint generated always as identity primary key,
  reservation_id bigint not null references public.reservations (id) on delete cascade,
  channel text not null check (channel in ('email', 'whatsapp', 'phone', 'internal')),
  purpose text not null
    check (purpose in ('quote', 'confirmation', 'documentation', 'support', 'internal')),
  direction text not null check (direction in ('inbound', 'outbound')),
  recipient text,
  subject text,
  body text,
  delivery_status text not null default 'queued'
    check (delivery_status in ('queued', 'sent', 'delivered', 'failed', 'not_applicable')),
  external_id text,
  sent_at timestamptz,
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (channel <> 'whatsapp' or purpose = 'support')
);

-- Índices de relaciones y búsquedas operativas frecuentes.
create index vehicle_models_category_id_idx on public.vehicle_models (category_id);
create index vehicle_units_model_id_idx on public.vehicle_units (model_id);
create index vehicle_units_active_model_idx on public.vehicle_units (model_id)
  where status = 'active';
create index reservations_customer_id_idx on public.reservations (customer_id);
create index reservations_requested_category_id_idx on public.reservations (requested_category_id);
create index reservations_requested_model_id_idx on public.reservations (requested_model_id);
create index reservations_assigned_unit_id_idx on public.reservations (assigned_unit_id);
create index reservations_pickup_location_id_idx on public.reservations (pickup_location_id);
create index reservations_return_location_id_idx on public.reservations (return_location_id);
create index reservations_created_by_user_id_idx on public.reservations (created_by_user_id);
create index reservations_assigned_to_user_id_idx on public.reservations (assigned_to_user_id);
create index reservations_status_pickup_at_idx on public.reservations (status, pickup_at);
create index reservations_open_queue_idx on public.reservations (created_at)
  where status in ('requested', 'reviewing', 'quoted');
create index unit_calendar_blocks_unit_id_idx on public.unit_calendar_blocks (unit_id);
create index unit_calendar_blocks_reservation_id_idx on public.unit_calendar_blocks (reservation_id);
create index reservation_status_history_reservation_id_idx
  on public.reservation_status_history (reservation_id, changed_at desc);
create index reservation_status_history_changed_by_user_id_idx
  on public.reservation_status_history (changed_by_user_id);
create index communications_reservation_id_idx
  on public.communications (reservation_id, created_at desc);
create index communications_created_by_user_id_idx
  on public.communications (created_by_user_id);
create index communications_queued_idx on public.communications (created_at)
  where delivery_status = 'queued';

-- Utilidades internas.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create trigger staff_profiles_set_updated_at before update on public.staff_profiles
for each row execute function private.set_updated_at();
create trigger locations_set_updated_at before update on public.locations
for each row execute function private.set_updated_at();
create trigger vehicle_categories_set_updated_at before update on public.vehicle_categories
for each row execute function private.set_updated_at();
create trigger vehicle_models_set_updated_at before update on public.vehicle_models
for each row execute function private.set_updated_at();
create trigger vehicle_units_set_updated_at before update on public.vehicle_units
for each row execute function private.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
for each row execute function private.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations
for each row execute function private.set_updated_at();
create trigger unit_calendar_blocks_set_updated_at before update on public.unit_calendar_blocks
for each row execute function private.set_updated_at();

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1
    from public.staff_profiles
    where user_id = (select auth.uid()) and active
  );
$$;

revoke execute on function private.is_staff() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_staff() to authenticated;

create or replace function private.record_reservation_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.status is distinct from new.status then
    insert into public.reservation_status_history (
      reservation_id,
      from_status,
      to_status,
      changed_by_user_id
    ) values (
      new.id,
      case when tg_op = 'INSERT' then null else old.status end,
      new.status,
      (select auth.uid())
    );
  end if;
  return new;
end;
$$;

revoke execute on function private.record_reservation_status_change()
  from public, anon, authenticated;

create trigger reservations_record_status
after insert or update of status on public.reservations
for each row execute function private.record_reservation_status_change();

create or replace function private.sync_reservation_calendar_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('confirmed', 'checked_out') then
    insert into public.unit_calendar_blocks (
      unit_id,
      reservation_id,
      block_type,
      status,
      starts_at,
      ends_at,
      reason,
      created_by_user_id
    ) values (
      new.assigned_unit_id,
      new.id,
      'reservation',
      'active',
      new.pickup_at,
      new.return_at,
      'Reserva ' || new.reference_code,
      (select auth.uid())
    )
    on conflict (reservation_id) where reservation_id is not null and status = 'active'
    do update set
      unit_id = excluded.unit_id,
      starts_at = excluded.starts_at,
      ends_at = excluded.ends_at,
      updated_at = now();
  else
    update public.unit_calendar_blocks
    set status = 'released', updated_at = now()
    where reservation_id = new.id and status = 'active';
  end if;
  return new;
end;
$$;

revoke execute on function private.sync_reservation_calendar_block()
  from public, anon, authenticated;

create trigger reservations_sync_calendar
after insert or update of status, assigned_unit_id, pickup_at, return_at
on public.reservations
for each row execute function private.sync_reservation_calendar_block();

-- Operación atómica usada desde backend/Edge Function: asigna unidad y confirma.
create or replace function private.confirm_reservation(
  p_reservation_id bigint,
  p_unit_id bigint
)
returns public.reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.reservations;
begin
  if not exists (
    select 1 from public.vehicle_units
    where id = p_unit_id and status = 'active'
  ) then
    raise exception 'La unidad no está disponible para asignación';
  end if;

  update public.reservations
  set assigned_unit_id = p_unit_id,
      status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now())
  where id = p_reservation_id
    and status in ('requested', 'reviewing', 'quoted')
  returning * into v_reservation;

  if not found then
    raise exception 'La reserva no existe o no puede confirmarse desde su estado actual';
  end if;

  return v_reservation;
end;
$$;

revoke execute on function private.confirm_reservation(bigint, bigint)
  from public, anon, authenticated;
grant execute on function private.confirm_reservation(bigint, bigint) to service_role;

-- RLS y privilegios: el público solo lee catálogo activo; las escrituras son internas.
alter table public.staff_profiles enable row level security;
alter table public.locations enable row level security;
alter table public.vehicle_categories enable row level security;
alter table public.vehicle_models enable row level security;
alter table public.vehicle_units enable row level security;
alter table public.customers enable row level security;
alter table public.reservations enable row level security;
alter table public.unit_calendar_blocks enable row level security;
alter table public.reservation_status_history enable row level security;
alter table public.communications enable row level security;

revoke all on table public.staff_profiles from anon, authenticated;
revoke all on table public.locations from anon, authenticated;
revoke all on table public.vehicle_categories from anon, authenticated;
revoke all on table public.vehicle_models from anon, authenticated;
revoke all on table public.vehicle_units from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.reservations from anon, authenticated;
revoke all on table public.unit_calendar_blocks from anon, authenticated;
revoke all on table public.reservation_status_history from anon, authenticated;
revoke all on table public.communications from anon, authenticated;

grant select on table public.locations, public.vehicle_categories, public.vehicle_models
  to anon, authenticated;
grant select, insert, update on table
  public.locations,
  public.vehicle_categories,
  public.vehicle_models,
  public.vehicle_units,
  public.customers,
  public.reservations,
  public.unit_calendar_blocks,
  public.communications
  to authenticated;
grant select on table public.staff_profiles, public.reservation_status_history
  to authenticated;

grant usage, select on sequence
  public.locations_id_seq,
  public.vehicle_categories_id_seq,
  public.vehicle_models_id_seq,
  public.vehicle_units_id_seq,
  public.customers_id_seq,
  public.reservations_id_seq,
  public.unit_calendar_blocks_id_seq,
  public.reservation_status_history_id_seq,
  public.communications_id_seq
  to authenticated;

create policy locations_public_read on public.locations
for select to anon, authenticated using (active);
create policy locations_staff_read on public.locations
for select to authenticated using ((select private.is_staff()));
create policy locations_staff_insert on public.locations
for insert to authenticated with check ((select private.is_staff()));
create policy locations_staff_update on public.locations
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy vehicle_categories_public_read on public.vehicle_categories
for select to anon, authenticated using (active);
create policy vehicle_categories_staff_read on public.vehicle_categories
for select to authenticated using ((select private.is_staff()));
create policy vehicle_categories_staff_insert on public.vehicle_categories
for insert to authenticated with check ((select private.is_staff()));
create policy vehicle_categories_staff_update on public.vehicle_categories
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy vehicle_models_public_read on public.vehicle_models
for select to anon, authenticated using (active);
create policy vehicle_models_staff_read on public.vehicle_models
for select to authenticated using ((select private.is_staff()));
create policy vehicle_models_staff_insert on public.vehicle_models
for insert to authenticated with check ((select private.is_staff()));
create policy vehicle_models_staff_update on public.vehicle_models
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy staff_profiles_staff_read on public.staff_profiles
for select to authenticated using ((select private.is_staff()));

create policy vehicle_units_staff_read on public.vehicle_units
for select to authenticated using ((select private.is_staff()));
create policy vehicle_units_staff_insert on public.vehicle_units
for insert to authenticated with check ((select private.is_staff()));
create policy vehicle_units_staff_update on public.vehicle_units
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy customers_staff_read on public.customers
for select to authenticated using ((select private.is_staff()));
create policy customers_staff_insert on public.customers
for insert to authenticated with check ((select private.is_staff()));
create policy customers_staff_update on public.customers
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy reservations_staff_read on public.reservations
for select to authenticated using ((select private.is_staff()));
create policy reservations_staff_insert on public.reservations
for insert to authenticated with check ((select private.is_staff()));
create policy reservations_staff_update on public.reservations
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy unit_calendar_blocks_staff_read on public.unit_calendar_blocks
for select to authenticated using ((select private.is_staff()));
create policy unit_calendar_blocks_staff_insert on public.unit_calendar_blocks
for insert to authenticated with check ((select private.is_staff()));
create policy unit_calendar_blocks_staff_update on public.unit_calendar_blocks
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
create policy reservation_status_history_staff_read
on public.reservation_status_history
for select to authenticated using ((select private.is_staff()));

create policy communications_staff_read on public.communications
for select to authenticated using ((select private.is_staff()));
create policy communications_staff_insert on public.communications
for insert to authenticated with check ((select private.is_staff()));
create policy communications_staff_update on public.communications
for update to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));
