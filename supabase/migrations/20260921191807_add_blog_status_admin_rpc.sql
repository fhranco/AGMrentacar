-- AGM Rent a Car: Hotfix Fase 3.1 — RPC para actualización exclusiva de estado de blog
-- Permite cambiar el estado (draft, published, archived) sin tocar contenido ni traducciones.

create or replace function public.admin_set_blog_status(
  p_blog_post_id bigint,
  p_status text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_post_id bigint;
  v_status text;
  v_existing_published_at timestamptz;
  v_published_at timestamptz;
  v_es_title text;
  v_es_content text;
begin
  if auth.uid() is null or not (select private.is_staff()) then
    raise exception 'Acceso no autorizado. Se requiere personal activo.';
  end if;

  if p_blog_post_id is null then
    raise exception 'El identificador del artículo es obligatorio.';
  end if;

  v_status := lower(trim(p_status));
  if v_status not in ('draft', 'published', 'archived') then
    raise exception 'Estado inválido. Debe ser draft, published o archived.';
  end if;

  -- Obtener estado actual y fecha de publicación
  select published_at into v_existing_published_at
  from public.blog_posts
  where id = p_blog_post_id;

  if not found then
    raise exception 'Artículo con ID % no encontrado.', p_blog_post_id;
  end if;

  -- Si el nuevo estado es published, validar que ES tenga título y contenido
  if v_status = 'published' then
    select nullif(trim(title), ''), nullif(trim(content), '')
    into v_es_title, v_es_content
    from public.blog_post_translations
    where blog_post_id = p_blog_post_id and locale = 'es';

    if v_es_title is null or v_es_content is null then
      raise exception 'Para publicar un artículo se exige al menos Título y Contenido en español.';
    end if;

    -- Si es primera publicación, asignar now(), de lo contrario conservar fecha
    v_published_at := coalesce(v_existing_published_at, now());
  else
    -- En draft o archived conservar published_at histórico
    v_published_at := v_existing_published_at;
  end if;

  -- Actualizar únicamente status, published_at y updated_at sin tocar traducciones
  update public.blog_posts
  set status = v_status,
      published_at = v_published_at,
      updated_at = now()
  where id = p_blog_post_id
  returning id into v_post_id;

  return v_post_id;
end;
$$;

revoke execute on function public.admin_set_blog_status(bigint, text) from public, anon;
grant execute on function public.admin_set_blog_status(bigint, text) to authenticated;
