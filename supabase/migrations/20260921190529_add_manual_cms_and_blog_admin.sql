-- AGM Rent a Car: Fase 3 — Gestión multilingüe manual de Flota + Blog administrativo
-- 1. Corrige la condición de stale en el trigger handle_blog_post_translation_hash
-- 2. Define RPCs transaccionales con SECURITY INVOKER para guardado atómico de flota y blog
-- 3. Importa los 3 artículos legacy existentes de code.html en estado draft con author_id = NULL

-- 1. CORRECCIÓN TRIGGER BLOG: Refinar la comprobación de translation_status a estados válidos
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
    -- Conserva translation_source (ej: 'manual' se preserva y su status pasa a 'stale')
    if tg_op = 'UPDATE' and old.source_hash is distinct from v_hash then
      update public.blog_post_translations
      set translation_status = 'stale',
          updated_at = now()
      where blog_post_id = new.blog_post_id
        and locale in ('en', 'pt')
        and translation_status in ('translated', 'reviewed', 'stale');
    end if;
  end if;

  return new;
end;
$$;

-- 2. RPC TRANSACCIONAL: GUARDADO ATÓMICO DE MODELO DE VEHÍCULO (DATOS TÉCNICOS + ES MAESTRO)
create or replace function public.admin_save_vehicle_model(
  p_vehicle_model_id bigint,
  p_display_name text,
  p_category_name text,
  p_short_description text,
  p_description text,
  p_seo_title text,
  p_meta_description text,
  p_category_id bigint,
  p_transmission text,
  p_drivetrain text,
  p_fuel_type text,
  p_seats integer,
  p_luggage_capacity integer,
  p_air_conditioning boolean,
  p_sort_order integer,
  p_active boolean
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_model_id bigint;
begin
  if auth.uid() is null or not (select private.is_staff()) then
    raise exception 'Acceso no autorizado. Se requiere personal activo.';
  end if;

  if p_vehicle_model_id is null then
    raise exception 'El identificador del modelo de vehículo es obligatorio.';
  end if;

  -- Actualizar datos técnicos y campos legacy de vehicle_models
  update public.vehicle_models
  set category_id = p_category_id,
      display_name = nullif(trim(p_display_name), ''),
      transmission = p_transmission,
      drivetrain = nullif(trim(p_drivetrain), ''),
      fuel_type = nullif(trim(p_fuel_type), ''),
      seats = p_seats,
      luggage_capacity = p_luggage_capacity,
      air_conditioning = coalesce(p_air_conditioning, false),
      description = nullif(trim(p_description), ''),
      sort_order = coalesce(p_sort_order, 100),
      active = coalesce(p_active, true),
      updated_at = now()
  where id = p_vehicle_model_id
  returning id into v_model_id;

  if v_model_id is null then
    raise exception 'Modelo de vehículo con ID % no encontrado.', p_vehicle_model_id;
  end if;

  -- Guardar o actualizar versión maestra en español
  insert into public.vehicle_model_translations (
    vehicle_model_id,
    locale,
    display_name,
    category_name,
    short_description,
    description,
    seo_title,
    meta_description,
    translation_source,
    translation_status
  ) values (
    v_model_id,
    'es',
    nullif(trim(p_display_name), ''),
    nullif(trim(p_category_name), ''),
    nullif(trim(p_short_description), ''),
    nullif(trim(p_description), ''),
    nullif(trim(p_seo_title), ''),
    nullif(trim(p_meta_description), ''),
    'original',
    'original'
  )
  on conflict (vehicle_model_id, locale) do update set
    display_name = excluded.display_name,
    category_name = excluded.category_name,
    short_description = excluded.short_description,
    description = excluded.description,
    seo_title = excluded.seo_title,
    meta_description = excluded.meta_description,
    translation_source = 'original',
    translation_status = 'original',
    updated_at = now();

  return v_model_id;
end;
$$;

-- 3. RPC TRANSACCIONAL: GUARDADO MANUAL DE TRADUCCIÓN DE VEHÍCULO (EN / PT)
create or replace function public.admin_save_vehicle_translation(
  p_vehicle_model_id bigint,
  p_locale text,
  p_display_name text,
  p_category_name text,
  p_short_description text,
  p_description text,
  p_seo_title text,
  p_meta_description text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_es_hash text;
  v_is_empty boolean;
  v_disp_name text;
  v_desc text;
  v_trans_id bigint;
begin
  if auth.uid() is null or not (select private.is_staff()) then
    raise exception 'Acceso no autorizado. Se requiere personal activo.';
  end if;

  if p_locale not in ('en', 'pt') then
    raise exception 'Solo se admiten traducciones en inglés (en) o portugués (pt).';
  end if;

  -- Obtener hash maestro ES
  select source_hash into v_es_hash
  from public.vehicle_model_translations
  where vehicle_model_id = p_vehicle_model_id and locale = 'es';

  if v_es_hash is null then
    raise exception 'No existe versión maestra en español para este modelo de vehículo.';
  end if;

  v_disp_name := nullif(trim(p_display_name), '');
  v_desc := nullif(trim(p_description), '');

  v_is_empty := (v_disp_name is null and v_desc is null
                 and nullif(trim(p_category_name), '') is null
                 and nullif(trim(p_short_description), '') is null
                 and nullif(trim(p_seo_title), '') is null
                 and nullif(trim(p_meta_description), '') is null);

  if v_is_empty then
    -- Estado pending con campos en NULL
    insert into public.vehicle_model_translations (
      vehicle_model_id,
      locale,
      display_name,
      category_name,
      short_description,
      description,
      seo_title,
      meta_description,
      translation_source,
      translation_status,
      source_hash,
      translated_at
    ) values (
      p_vehicle_model_id,
      p_locale,
      null,
      null,
      null,
      null,
      null,
      null,
      'manual',
      'pending',
      null,
      null
    )
    on conflict (vehicle_model_id, locale) do update set
      display_name = null,
      category_name = null,
      short_description = null,
      description = null,
      seo_title = null,
      meta_description = null,
      translation_source = 'manual',
      translation_status = 'pending',
      source_hash = null,
      translated_at = null,
      updated_at = now()
    returning id into v_trans_id;
  else
    -- Validar mínimos para reviewed: display_name y description
    if v_disp_name is null or v_desc is null then
      raise exception 'Para marcar la traducción como revisada se exige al menos Nombre visible y Descripción.';
    end if;

    insert into public.vehicle_model_translations (
      vehicle_model_id,
      locale,
      display_name,
      category_name,
      short_description,
      description,
      seo_title,
      meta_description,
      translation_source,
      translation_status,
      source_hash,
      translated_at
    ) values (
      p_vehicle_model_id,
      p_locale,
      v_disp_name,
      nullif(trim(p_category_name), ''),
      nullif(trim(p_short_description), ''),
      v_desc,
      nullif(trim(p_seo_title), ''),
      nullif(trim(p_meta_description), ''),
      'manual',
      'reviewed',
      v_es_hash,
      now()
    )
    on conflict (vehicle_model_id, locale) do update set
      display_name = excluded.display_name,
      category_name = excluded.category_name,
      short_description = excluded.short_description,
      description = excluded.description,
      seo_title = excluded.seo_title,
      meta_description = excluded.meta_description,
      translation_source = 'manual',
      translation_status = 'reviewed',
      source_hash = v_es_hash,
      translated_at = now(),
      updated_at = now()
    returning id into v_trans_id;
  end if;

  return v_trans_id;
end;
$$;

-- 4. RPC TRANSACCIONAL: GUARDADO ATÓMICO DE ARTÍCULO DEL BLOG (METADATA + ES MAESTRO)
create or replace function public.admin_save_blog_post(
  p_blog_post_id bigint,
  p_slug text,
  p_status text,
  p_featured_image_path text,
  p_title text,
  p_excerpt text,
  p_content text,
  p_seo_title text,
  p_meta_description text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post_id bigint;
  v_slug text;
  v_title text;
  v_content text;
  v_status text;
  v_existing_published_at timestamptz;
  v_published_at timestamptz;
begin
  if auth.uid() is null or not (select private.is_staff()) then
    raise exception 'Acceso no autorizado. Se requiere personal activo.';
  end if;

  v_slug := lower(trim(p_slug));
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'El slug no es válido. Solo debe contener letras minúsculas, números y guiones sencillos.';
  end if;

  v_status := coalesce(p_status, 'draft');
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'Estado de publicación inválido. Debe ser draft, published o archived.';
  end if;

  v_title := nullif(trim(p_title), '');
  v_content := nullif(trim(p_content), '');

  if v_status = 'published' then
    if v_title is null or v_content is null then
      raise exception 'Para publicar un artículo se exige al menos Título y Contenido en español.';
    end if;
  end if;

  if p_blog_post_id is null then
    -- Crear nuevo artículo
    if v_status = 'published' then
      v_published_at := now();
    else
      v_published_at := null;
    end if;

    insert into public.blog_posts (
      slug,
      status,
      featured_image_path,
      author_id,
      published_at
    ) values (
      v_slug,
      v_status,
      nullif(trim(p_featured_image_path), ''),
      auth.uid(),
      v_published_at
    )
    returning id into v_post_id;

    -- Crear filas de traducción: ES original, EN y PT pending
    insert into public.blog_post_translations (
      blog_post_id,
      locale,
      title,
      excerpt,
      content,
      seo_title,
      meta_description,
      translation_source,
      translation_status
    ) values (
      v_post_id,
      'es',
      v_title,
      nullif(trim(p_excerpt), ''),
      v_content,
      nullif(trim(p_seo_title), ''),
      nullif(trim(p_meta_description), ''),
      'original',
      'original'
    );

    insert into public.blog_post_translations (
      blog_post_id,
      locale,
      title,
      translation_source,
      translation_status
    ) values
      (v_post_id, 'en', null, 'manual', 'pending'),
      (v_post_id, 'pt', null, 'manual', 'pending');

  else
    -- Actualizar artículo existente
    select published_at into v_existing_published_at
    from public.blog_posts
    where id = p_blog_post_id;

    if not found then
      raise exception 'Artículo con ID % no encontrado.', p_blog_post_id;
    end if;

    if v_status = 'published' then
      v_published_at := coalesce(v_existing_published_at, now());
    else
      v_published_at := v_existing_published_at;
    end if;

    update public.blog_posts
    set slug = v_slug,
        status = v_status,
        featured_image_path = nullif(trim(p_featured_image_path), ''),
        published_at = v_published_at,
        updated_at = now()
    where id = p_blog_post_id
    returning id into v_post_id;

    -- Guardar o actualizar traducción ES
    insert into public.blog_post_translations (
      blog_post_id,
      locale,
      title,
      excerpt,
      content,
      seo_title,
      meta_description,
      translation_source,
      translation_status
    ) values (
      v_post_id,
      'es',
      v_title,
      nullif(trim(p_excerpt), ''),
      v_content,
      nullif(trim(p_seo_title), ''),
      nullif(trim(p_meta_description), ''),
      'original',
      'original'
    )
    on conflict (blog_post_id, locale) do update set
      title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      seo_title = excluded.seo_title,
      meta_description = excluded.meta_description,
      translation_source = 'original',
      translation_status = 'original',
      updated_at = now();
  end if;

  return v_post_id;
end;
$$;

-- 5. RPC TRANSACCIONAL: GUARDADO MANUAL DE TRADUCCIÓN DE BLOG (EN / PT)
create or replace function public.admin_save_blog_translation(
  p_blog_post_id bigint,
  p_locale text,
  p_title text,
  p_excerpt text,
  p_content text,
  p_seo_title text,
  p_meta_description text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_es_hash text;
  v_is_empty boolean;
  v_title text;
  v_content text;
  v_trans_id bigint;
begin
  if auth.uid() is null or not (select private.is_staff()) then
    raise exception 'Acceso no autorizado. Se requiere personal activo.';
  end if;

  if p_locale not in ('en', 'pt') then
    raise exception 'Solo se admiten traducciones en inglés (en) o portugués (pt).';
  end if;

  select source_hash into v_es_hash
  from public.blog_post_translations
  where blog_post_id = p_blog_post_id and locale = 'es';

  if v_es_hash is null then
    raise exception 'No existe versión maestra en español para este artículo del blog.';
  end if;

  v_title := nullif(trim(p_title), '');
  v_content := nullif(trim(p_content), '');

  v_is_empty := (v_title is null and v_content is null
                 and nullif(trim(p_excerpt), '') is null
                 and nullif(trim(p_seo_title), '') is null
                 and nullif(trim(p_meta_description), '') is null);

  if v_is_empty then
    insert into public.blog_post_translations (
      blog_post_id,
      locale,
      title,
      excerpt,
      content,
      seo_title,
      meta_description,
      translation_source,
      translation_status,
      source_hash,
      translated_at
    ) values (
      p_blog_post_id,
      p_locale,
      null,
      null,
      null,
      null,
      null,
      'manual',
      'pending',
      null,
      null
    )
    on conflict (blog_post_id, locale) do update set
      title = null,
      excerpt = null,
      content = null,
      seo_title = null,
      meta_description = null,
      translation_source = 'manual',
      translation_status = 'pending',
      source_hash = null,
      translated_at = null,
      updated_at = now()
    returning id into v_trans_id;
  else
    if v_title is null or v_content is null then
      raise exception 'Para marcar la traducción como revisada se exige al menos Título y Contenido.';
    end if;

    insert into public.blog_post_translations (
      blog_post_id,
      locale,
      title,
      excerpt,
      content,
      seo_title,
      meta_description,
      translation_source,
      translation_status,
      source_hash,
      translated_at
    ) values (
      p_blog_post_id,
      p_locale,
      v_title,
      nullif(trim(p_excerpt), ''),
      v_content,
      nullif(trim(p_seo_title), ''),
      nullif(trim(p_meta_description), ''),
      'manual',
      'reviewed',
      v_es_hash,
      now()
    )
    on conflict (blog_post_id, locale) do update set
      title = excluded.title,
      excerpt = excluded.excerpt,
      content = excluded.content,
      seo_title = excluded.seo_title,
      meta_description = excluded.meta_description,
      translation_source = 'manual',
      translation_status = 'reviewed',
      source_hash = v_es_hash,
      translated_at = now(),
      updated_at = now()
    returning id into v_trans_id;
  end if;

  return v_trans_id;
end;
$$;

-- 6. PERMISOS DE RPCS
revoke execute on function public.admin_save_vehicle_model(bigint, text, text, text, text, text, text, bigint, text, text, text, integer, integer, boolean, integer, boolean) from public, anon;
grant execute on function public.admin_save_vehicle_model(bigint, text, text, text, text, text, text, bigint, text, text, text, integer, integer, boolean, integer, boolean) to authenticated;

revoke execute on function public.admin_save_vehicle_translation(bigint, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_vehicle_translation(bigint, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_save_blog_post(bigint, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_blog_post(bigint, text, text, text, text, text, text, text, text) to authenticated;

revoke execute on function public.admin_save_blog_translation(bigint, text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_blog_translation(bigint, text, text, text, text, text, text) to authenticated;

-- 7. IMPORTACIÓN DE ARTÍCULOS LEGACY DE CODE.HTML (ESTADO DRAFT, AUTHOR_ID = NULL)

-- Artículo 1: Torres del Paine
insert into public.blog_posts (
  slug,
  status,
  featured_image_path,
  author_id,
  published_at
) values (
  'torres-del-paine',
  'draft',
  'assets/images/blog-torres-del-paine.jpg',
  null,
  null
)
on conflict (slug) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  excerpt,
  content,
  translation_source,
  translation_status
)
select
  bp.id,
  'es',
  'Ruta Punta Arenas a Torres del Paine en auto: Guía completa 2026',
  'Distancias kilométricas, paradas estratégicas en Puerto Natales, abastecimiento de combustible y mejores miradores fotográficos para tu itinerario.',
  'Viajar en auto desde Punta Arenas hacia el Parque Nacional Torres del Paine es una de las experiencias viales más fascinantes de Sudamérica. La libertad de detenerse ante lagunas glaciares, estancias históricas y miradores panorámicos hace que arrendar un vehículo sea la alternativa preferida por viajeros de todo el mundo.

Distancias y Tiempos de Conducción:
- Punta Arenas a Puerto Natales: 248 km por la Ruta 9 Norte (100% pavimentada, tiempo estimado: 2h 45m a 3h).
- Puerto Natales a Torres del Paine (Portería Laguna Amarga): 112 km por Ruta 9 Norte / Y-150 (pavimento y tramos de ripio consolidado, tiempo estimado: 1h 45m).
- Puerto Natales a Torres del Paine (Portería Serrano): 80 km por Ruta Y-290 (paisaje del Río Serrano y Glaciar Grey).

1. Reabastecimiento de Combustible (Dato Crítico):
Dentro del Parque Nacional Torres del Paine NO existen estaciones de servicio. Por ello, es imperativo llenar el estanque al salir de Punta Arenas y volver a llenar el estanque al 100% en Puerto Natales antes de ingresar al parque. Los vehículos AGM cuentan con excelente autonomía para realizar el circuito completo y regresar a Puerto Natales con total tranquilidad.

2. Paradas y Miradores Recomendados:
- Villa Tehuelches (km 100): Histórico asentamiento pionero, ideal para una pausa de café y empanadas tradicionales.
- Cueva del Milodón: A 24 km de Puerto Natales, sendero arqueológico y monumento natural imperdible.
- Mirador Lago Sarmiento: Primera vista majestuosa del macizo Paine y rebaños de guanacos silvestres.
- Mirador Cuernos y Salto Grande: Sendero breve de 15 minutos que conecta el Lago Nordenskjöld con el Lago Pehoé.

3. ¿Qué vehículo elegir?
Aunque la ruta principal está pavimentada, dentro del parque los caminos secundarios son de ripio y gravilla. Recomendamos modelos SUV con buen despeje o tracción total como Nissan Kicks, Ford Territory, Toyota RAV4 o Toyota 4Runner, que brindan excelente aislamiento acústico, visibilidad elevada y confort para toda la familia.',
  'original',
  'original'
from public.blog_posts bp
where bp.slug = 'torres-del-paine'
on conflict (blog_post_id, locale) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  translation_source,
  translation_status
)
select
  bp.id,
  l.locale,
  null,
  'manual',
  'pending'
from public.blog_posts bp
cross join (values ('en'), ('pt')) as l(locale)
where bp.slug = 'torres-del-paine'
on conflict (blog_post_id, locale) do nothing;


-- Artículo 2: Cruce a Argentina
insert into public.blog_posts (
  slug,
  status,
  featured_image_path,
  author_id,
  published_at
) values (
  'cruce-argentina',
  'draft',
  'assets/images/blog-cruce-argentina.jpg',
  null,
  null
)
on conflict (slug) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  excerpt,
  content,
  translation_source,
  translation_status
)
select
  bp.id,
  'es',
  'Cómo cruzar a Argentina en vehículo de arriendo: El Calafate y Ushuaia',
  'Todo sobre los pasos fronterizos Río Don Guillermo e Integración Austral, gestión del permiso aduanero notarial y seguro Mercosur obligatorio con AGM.',
  'Muchos viajeros sueñan con unir en un solo viaje los colosos del sur: Torres del Paine en Chile y el Glaciar Perito Moreno (El Calafate) o la mítica Ushuaia en Argentina. En AGM Rent a Car facilitamos este cruce internacional gestionando toda la documentación aduanera requerida.

Documentación Obligatoria para Cruzar:
- Permiso Notarial de Salida: Documento legal emitido por AGM Rent a Car autorizando al conductor a cruzar la frontera ante Aduanas de Chile y Argentina.
- Seguro Internacional R.C. Mercosur: Póliza obligatoria exigida por ley argentina que cubre responsabilidad civil contra terceros en el extranjero.
- Documento de Identidad: Cédula de identidad chilena o pasaporte original vigente de todos los ocupantes.
- Padrón y Documentos del Vehículo: Proporcionados en la guantera por AGM en regla y al día.

1. Pasos Fronterizos Estratégicos:
- Paso Río Don Guillermo (Cerro Castillo / Cancha Carrera): El paso por excelencia para conectar Puerto Natales / Torres del Paine con El Calafate (290 km aprox.). Trámite aduanero ágil durante la temporada alta.
- Paso Integración Austral (Monte Aymond): Ubicado a 63 km al norte de Punta Arenas por la Ruta 255. Conecta con Río Gallegos y es el paso obligatorio para continuar hacia Tierra del Fuego (Ruta 3 argentina hacia Río Grande y Ushuaia).

2. Plazos y Anticipación:
Recuerda solicitar tu cruce con un mínimo de 72 horas hábiles de anticipación a tu fecha de retiro. Esto permite a nuestro equipo notarial emitir los poderes y gestionar la póliza internacional sin demoras en tu itinerario.

3. Normativa Fitosanitaria (SAG y SENASA):
Al retornar a Chile, el Servicio Agrícola y Ganadero (SAG) realiza inspección estricta. Está estrictamente prohibido ingresar frutas frescas, verduras, semillas, miel o carnes sin procesar. Declara siempre todo alimento procesado que lleves en el formulario aduanero.',
  'original',
  'original'
from public.blog_posts bp
where bp.slug = 'cruce-argentina'
on conflict (blog_post_id, locale) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  translation_source,
  translation_status
)
select
  bp.id,
  l.locale,
  null,
  'manual',
  'pending'
from public.blog_posts bp
cross join (values ('en'), ('pt')) as l(locale)
where bp.slug = 'cruce-argentina'
on conflict (blog_post_id, locale) do nothing;


-- Artículo 3: Conducción en Patagonia
insert into public.blog_posts (
  slug,
  status,
  featured_image_path,
  author_id,
  published_at
) values (
  'conduccion-patagonia',
  'draft',
  'assets/images/blog-conduccion-patagonia.jpg',
  null,
  null
)
on conflict (slug) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  excerpt,
  content,
  translation_source,
  translation_status
)
select
  bp.id,
  'es',
  'Guía para conducir con viento, escarcha y ripio en Magallanes',
  'Recomendaciones clave ante ráfagas patagónicas, cuidado con puertas al abrir, neumáticos con clavos en temporada fría y conducción en caminos de grava.',
  'Manejar por la Patagonia es una aventura extraordinaria que requiere conocer y respetar las particularidades del clima austral. Desde las famosas ráfagas de viento de la pampa hasta la escarcha matutina, aquí te compartimos las claves de oro de los conductores locales.

El Viento Austral: Cómo dominarlo:
- Sujeción de puertas: Al detenerte y descender del vehículo, toma la puerta con ambas manos con firmeza. Una ráfaga súbita puede abrirla con violencia y descalzar las bisagras.
- Conducción en ruta: Mantén siempre ambas manos firmes en el volante. Al adelantar camiones de carga o salir de zonas resguardadas por colinas, prepárate para la corrección suave del volante ante el golpe de viento lateral.
- Velocidad moderada: Con vientos superiores a 80 km/h, reduce la velocidad crucero a 90 o 80 km/h.

1. Manejo Seguro en Caminos de Ripio (Grava):
Gran parte de los accesos a estancias y reservas naturales son caminos de ripio consolidado:
- Distancia de seguridad: Mantén al menos 50 a 70 metros de distancia del vehículo que te antecede para evitar que las piedras sueltas golpeen tu parabrisas o carrocería.
- No exceder los 60 - 70 km/h: El ripio suelto disminuye la adherencia de frenado. Frena con suavidad y usa el freno de motor en descensos.

2. Conducción en Invierno: Escarcha y Nieve:
Durante los meses de mayo a septiembre, la escarcha es habitual en las mañanas y noches:
- Neumáticos con clavos y cadenas: En AGM Rent a Car equipamos nuestros vehículos con neumáticos espigados (clavos) y proveemos cadenas para nieve en invierno.
- Cuidado con la «escarcha negra»: Es una capa de hielo transparente que se forma sobre el asfalto en zonas sombrías y puentes. Si sientes el volante liviano, no frenes bruscamente; suelta el acelerador suavemente y mantén la dirección recta.',
  'original',
  'original'
from public.blog_posts bp
where bp.slug = 'conduccion-patagonia'
on conflict (blog_post_id, locale) do nothing;

insert into public.blog_post_translations (
  blog_post_id,
  locale,
  title,
  translation_source,
  translation_status
)
select
  bp.id,
  l.locale,
  null,
  'manual',
  'pending'
from public.blog_posts bp
cross join (values ('en'), ('pt')) as l(locale)
where bp.slug = 'conduccion-patagonia'
on conflict (blog_post_id, locale) do nothing;
