-- AGM Rent a Car: Arquitectura de contenido multilingüe (Vehículos y Blog).
-- Establece la fuente de verdad multilingüe (ES maestro, EN/PT automáticos)
-- con detección de cambios vía source_hash determinista y RLS de personal activo.

-- 1. MODELOS DE VEHÍCULOS: TRADUCCIONES
-- vehicle_models conserva display_name y description como campos legacy/fallback.
-- vehicle_model_translations pasa a ser la fuente canónica multilingüe.

create table public.vehicle_model_translations (
  id bigint generated always as identity primary key,
  vehicle_model_id bigint not null references public.vehicle_models (id) on delete cascade,
  locale text not null check (locale in ('es', 'en', 'pt')),
  display_name text,
  category_name text,
  short_description text,
  description text,
  seo_title text,
  meta_description text,
  translation_source text not null default 'automatic'
    check (translation_source in ('original', 'automatic', 'manual')),
  source_hash text,
  translation_status text not null default 'pending'
    check (translation_status in ('original', 'pending', 'translated', 'reviewed', 'stale', 'failed')),
  translated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_model_translations_model_locale_key unique (vehicle_model_id, locale),
  constraint vehicle_model_translations_display_name_check check (
    translation_status in ('pending', 'failed')
    or (display_name is not null and length(trim(display_name)) > 0)
  )
);

create index vehicle_model_translations_model_id_idx
  on public.vehicle_model_translations (vehicle_model_id);
create index vehicle_model_translations_locale_idx
  on public.vehicle_model_translations (locale);

-- 2. BLOG: POSTS Y TRADUCCIONES
create table public.blog_posts (
  id bigint generated always as identity primary key,
  slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  featured_image_path text,
  author_id uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc);

create table public.blog_post_translations (
  id bigint generated always as identity primary key,
  blog_post_id bigint not null references public.blog_posts (id) on delete cascade,
  locale text not null check (locale in ('es', 'en', 'pt')),
  title text,
  excerpt text,
  content text,
  seo_title text,
  meta_description text,
  translation_source text not null default 'automatic'
    check (translation_source in ('original', 'automatic', 'manual')),
  source_hash text,
  translation_status text not null default 'pending'
    check (translation_status in ('original', 'pending', 'translated', 'reviewed', 'stale', 'failed')),
  translated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint blog_post_translations_post_locale_key unique (blog_post_id, locale),
  constraint blog_post_translations_title_check check (
    translation_status in ('pending', 'failed')
    or (title is not null and length(trim(title)) > 0)
  )
);

create index blog_post_translations_post_id_idx
  on public.blog_post_translations (blog_post_id);
create index blog_post_translations_locale_idx
  on public.blog_post_translations (locale);

-- 3. TRIGGERS DE UPDATED_AT
create trigger vehicle_model_translations_set_updated_at
before update on public.vehicle_model_translations
for each row execute function private.set_updated_at();

create trigger blog_posts_set_updated_at
before update on public.blog_posts
for each row execute function private.set_updated_at();

create trigger blog_post_translations_set_updated_at
before update on public.blog_post_translations
for each row execute function private.set_updated_at();

-- 4. FUNCIONES Y TRIGGERS DE SOURCE_HASH Y STALE DETERMINISTAS
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
    -- Hash determinista basado en JSONB de los campos traducibles
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
    -- Conserva translation_source (por ejemplo, 'manual' se conserva pero su status pasa a 'stale')
    if tg_op = 'UPDATE' and old.source_hash is distinct from v_hash then
      update public.vehicle_model_translations
      set translation_status = 'stale',
          updated_at = now()
      where vehicle_model_id = new.vehicle_model_id
        and locale in ('en', 'pt')
        and translation_status in ('translated', 'reviewed', 'manual', 'stale');
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.handle_vehicle_model_translation_hash()
  from public, anon, authenticated;

create trigger vehicle_model_translations_handle_hash
before insert or update on public.vehicle_model_translations
for each row execute function private.handle_vehicle_model_translation_hash();

create or replace function private.handle_blog_post_translation_hash()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  if new.locale = 'es' then
    -- Hash determinista basado en JSONB de los campos traducibles
    v_hash := md5(jsonb_build_object(
      'title', coalesce(new.title, ''),
      'excerpt', coalesce(new.excerpt, ''),
      'content', coalesce(new.content, ''),
      'seo_title', coalesce(new.seo_title, ''),
      'meta_description', coalesce(new.meta_description, '')
    )::text);

    new.source_hash := v_hash;
    new.translation_source := 'original';
    new.translation_status := 'original';

    -- Si cambió el contenido en español, marcar traducciones existentes como 'stale'
    if tg_op = 'UPDATE' and old.source_hash is distinct from v_hash then
      update public.blog_post_translations
      set translation_status = 'stale',
          updated_at = now()
      where blog_post_id = new.blog_post_id
        and locale in ('en', 'pt')
        and translation_status in ('translated', 'reviewed', 'manual', 'stale');
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.handle_blog_post_translation_hash()
  from public, anon, authenticated;

create trigger blog_post_translations_handle_hash
before insert or update on public.blog_post_translations
for each row execute function private.handle_blog_post_translation_hash();

-- 5. RLS Y PERMISOS
alter table public.vehicle_model_translations enable row level security;
alter table public.blog_posts enable row level security;
alter table public.blog_post_translations enable row level security;

revoke all on table public.vehicle_model_translations from anon, authenticated;
revoke all on table public.blog_posts from anon, authenticated;
revoke all on table public.blog_post_translations from anon, authenticated;

grant select on table
  public.vehicle_model_translations,
  public.blog_posts,
  public.blog_post_translations
  to anon, authenticated;

grant select, insert, update, delete on table
  public.vehicle_model_translations,
  public.blog_posts,
  public.blog_post_translations
  to authenticated;

grant usage, select on sequence
  public.vehicle_model_translations_id_seq,
  public.blog_posts_id_seq,
  public.blog_post_translations_id_seq
  to authenticated;

-- Políticas vehicle_model_translations
create policy vehicle_model_translations_public_read
on public.vehicle_model_translations
for select to anon, authenticated
using (
  exists (
    select 1 from public.vehicle_models vm
    where vm.id = vehicle_model_translations.vehicle_model_id
      and vm.active = true
  )
  and translation_status in ('original', 'translated', 'reviewed')
);

create policy vehicle_model_translations_staff_read
on public.vehicle_model_translations
for select to authenticated
using ((select private.is_staff()));

create policy vehicle_model_translations_staff_insert
on public.vehicle_model_translations
for insert to authenticated
with check ((select private.is_staff()));

create policy vehicle_model_translations_staff_update
on public.vehicle_model_translations
for update to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy vehicle_model_translations_staff_delete
on public.vehicle_model_translations
for delete to authenticated
using ((select private.is_staff()));

-- Políticas blog_posts
create policy blog_posts_public_read
on public.blog_posts
for select to anon, authenticated
using (
  status = 'published'
  and published_at is not null
  and published_at <= now()
);

create policy blog_posts_staff_read
on public.blog_posts
for select to authenticated
using ((select private.is_staff()));

create policy blog_posts_staff_insert
on public.blog_posts
for insert to authenticated
with check ((select private.is_staff()));

create policy blog_posts_staff_update
on public.blog_posts
for update to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy blog_posts_staff_delete
on public.blog_posts
for delete to authenticated
using ((select private.is_staff()));

-- Políticas blog_post_translations
create policy blog_post_translations_public_read
on public.blog_post_translations
for select to anon, authenticated
using (
  exists (
    select 1 from public.blog_posts bp
    where bp.id = blog_post_translations.blog_post_id
      and bp.status = 'published'
      and bp.published_at is not null
      and bp.published_at <= now()
  )
  and translation_status in ('original', 'translated', 'reviewed')
);

create policy blog_post_translations_staff_read
on public.blog_post_translations
for select to authenticated
using ((select private.is_staff()));

create policy blog_post_translations_staff_insert
on public.blog_post_translations
for insert to authenticated
with check ((select private.is_staff()));

create policy blog_post_translations_staff_update
on public.blog_post_translations
for update to authenticated
using ((select private.is_staff()))
with check ((select private.is_staff()));

create policy blog_post_translations_staff_delete
on public.blog_post_translations
for delete to authenticated
using ((select private.is_staff()));

-- 6. POBLADO INICIAL DE TRANSICIÓN PARA MODELOS EXISTENTES EN VEHICLE_MODELS
-- Se crea la traducción en español desde los campos existentes (fuente de transición)
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
on conflict (vehicle_model_id, locale) do nothing;

-- Se crean las filas pendientes para EN y PT sin contenido falso
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
on conflict (vehicle_model_id, locale) do nothing;
