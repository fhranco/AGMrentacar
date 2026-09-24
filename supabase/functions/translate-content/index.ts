import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://fhranco.github.io",
  "https://orange-squid-480505.hostingersite.com",
  "https://agmrentacar.cl",
  "https://www.agmrentacar.cl",
]);

type ResourceType = "vehicle_model" | "blog_post";
type TargetLocale = "en" | "pt";

type TranslateRequest = {
  resource_type?: unknown;
  resource_id?: unknown;
  target_locales?: unknown;
};

interface TranslationProvider {
  name: string;
  isConfigured(): boolean;
  translate(
    texts: Record<string, string>,
    fromLang: string,
    toLang: string,
  ): Promise<Record<string, string>>;
}

class ModularTranslationProvider implements TranslationProvider {
  name = "modular-translation-provider";

  isConfigured(): boolean {
    const key = Deno.env.get("TRANSLATION_API_KEY") || "";
    return key.trim().length > 0;
  }

  async translate(
    texts: Record<string, string>,
    fromLang: string,
    toLang: string,
  ): Promise<Record<string, string>> {
    if (!this.isConfigured()) {
      throw new Error(
        "PROVEEDOR_NO_CONFIGURADO: Falta clave TRANSLATION_API_KEY en Supabase Secrets.",
      );
    }

    // Abstracción preparada para Google Cloud Translation API, DeepL, etc.
    // En esta fase preliminar sin proveedor externo seleccionado, la función
    // reporta de forma segura que el proveedor no está activo aún.
    throw new Error(
      `PROVEEDOR_PENDIENTE_INTEGRACION: Proveedor configurado para traducir de ${fromLang} a ${toLang}, pero el cliente HTTP concreto aún no ha sido activado.`,
    );
  }
}

const corsHeaders = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://agmrentacar.cl",
    "Access-Control-Allow-Headers": "apikey, content-type, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
};

const json = (req: Request, body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders(req) });

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return json(req, { error: "Método no permitido." }, 405);
  }

  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(req, { error: "Se requiere token de autenticación (Bearer)." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error("Faltan variables de entorno de Supabase.");
    return json(req, { error: "Configuración interna del servidor no disponible." }, 500);
  }

  // 1. Validar identidad con el cliente del usuario
  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json(req, { error: "Sesión inválida o expirada." }, 401);
  }

  // 2. Validar que pertenece a personal activo mediante staff_profiles
  const { data: staffProfile, error: staffError } = await userClient
    .from("staff_profiles")
    .select("user_id, role, active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (staffError || !staffProfile) {
    return json(req, { error: "No autorizado. Se requiere personal activo de AGM." }, 403);
  }

  // 3. Validar payload de solicitud
  let payload: TranslateRequest;
  try {
    payload = await req.json();
  } catch {
    return json(req, { error: "La solicitud no contiene un JSON válido." }, 400);
  }

  const resourceType = payload.resource_type as ResourceType;
  if (resourceType !== "vehicle_model" && resourceType !== "blog_post") {
    return json(
      req,
      { error: "resource_type no válido. Solo se permite 'vehicle_model' o 'blog_post'." },
      400,
    );
  }

  const resourceId = Number(payload.resource_id);
  if (!Number.isInteger(resourceId) || resourceId <= 0) {
    return json(req, { error: "resource_id debe ser un entero positivo." }, 400);
  }

  if (!Array.isArray(payload.target_locales) || payload.target_locales.length === 0) {
    return json(req, { error: "target_locales debe ser un arreglo con al menos un idioma ('en' o 'pt')." }, 400);
  }

  const validTargets = new Set<TargetLocale>(["en", "pt"]);
  const targetLocales: TargetLocale[] = [];
  for (const loc of payload.target_locales) {
    if (typeof loc === "string" && validTargets.has(loc as TargetLocale)) {
      if (!targetLocales.includes(loc as TargetLocale)) {
        targetLocales.push(loc as TargetLocale);
      }
    } else {
      return json(
        req,
        { error: `Idioma destino no permitido: '${loc}'. Solo se admite 'en' y 'pt'. 'es' es el maestro.` },
        400,
      );
    }
  }

  // 4. Con el usuario autenticado y verificado como personal activo,
  // inicializamos el cliente administrativo para operaciones seguras de traducción.
  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  const provider = new ModularTranslationProvider();
  const results: Array<{ locale: TargetLocale; status: "translated" | "failed"; message?: string }> = [];

  if (resourceType === "vehicle_model") {
    const { data: esRow, error: esError } = await adminClient
      .from("vehicle_model_translations")
      .select("id, vehicle_model_id, display_name, category_name, short_description, description, seo_title, meta_description, source_hash")
      .eq("vehicle_model_id", resourceId)
      .eq("locale", "es")
      .maybeSingle();

    if (esError || !esRow) {
      return json(
        req,
        { error: "Contenido maestro en español no encontrado para el modelo de vehículo indicado." },
        404,
      );
    }

    for (const targetLocale of targetLocales) {
      const translatableTexts: Record<string, string> = {
        display_name: esRow.display_name || "",
        category_name: esRow.category_name || "",
        short_description: esRow.short_description || "",
        description: esRow.description || "",
        seo_title: esRow.seo_title || "",
        meta_description: esRow.meta_description || "",
      };

      try {
        const translated = await provider.translate(translatableTexts, "es", targetLocale);
        const { error: upsertError } = await adminClient
          .from("vehicle_model_translations")
          .upsert(
            {
              vehicle_model_id: resourceId,
              locale: targetLocale,
              display_name: translated.display_name,
              category_name: translated.category_name,
              short_description: translated.short_description,
              description: translated.description,
              seo_title: translated.seo_title,
              meta_description: translated.meta_description,
              translation_source: "automatic",
              translation_status: "translated",
              source_hash: esRow.source_hash,
              translated_at: new Date().toISOString(),
            },
            { onConflict: "vehicle_model_id,locale" },
          );

        if (upsertError) {
          throw upsertError;
        }

        results.push({ locale: targetLocale, status: "translated" });
      } catch (err) {
        console.error(`Fallo de traducción para vehicle_model ${resourceId} a ${targetLocale}:`, err);

        // Operación desacoplada: el contenido maestro en ES NUNCA se revierte.
        // Se marca el estado en 'failed' sin sobreescribir texto con mensajes internos de error.
        await adminClient
          .from("vehicle_model_translations")
          .upsert(
            {
              vehicle_model_id: resourceId,
              locale: targetLocale,
              translation_source: "automatic",
              translation_status: "failed",
            },
            { onConflict: "vehicle_model_id,locale" },
          );

        results.push({
          locale: targetLocale,
          status: "failed",
          message: "La traducción automática no pudo completarse. El contenido maestro en español permanece intacto.",
        });
      }
    }
  } else if (resourceType === "blog_post") {
    const { data: esRow, error: esError } = await adminClient
      .from("blog_post_translations")
      .select("id, blog_post_id, title, excerpt, content, seo_title, meta_description, source_hash")
      .eq("blog_post_id", resourceId)
      .eq("locale", "es")
      .maybeSingle();

    if (esError || !esRow) {
      return json(
        req,
        { error: "Contenido maestro en español no encontrado para el artículo de blog indicado." },
        404,
      );
    }

    for (const targetLocale of targetLocales) {
      const translatableTexts: Record<string, string> = {
        title: esRow.title || "",
        excerpt: esRow.excerpt || "",
        content: esRow.content || "",
        seo_title: esRow.seo_title || "",
        meta_description: esRow.meta_description || "",
      };

      try {
        const translated = await provider.translate(translatableTexts, "es", targetLocale);
        const { error: upsertError } = await adminClient
          .from("blog_post_translations")
          .upsert(
            {
              blog_post_id: resourceId,
              locale: targetLocale,
              title: translated.title,
              excerpt: translated.excerpt,
              content: translated.content,
              seo_title: translated.seo_title,
              meta_description: translated.meta_description,
              translation_source: "automatic",
              translation_status: "translated",
              source_hash: esRow.source_hash,
              translated_at: new Date().toISOString(),
            },
            { onConflict: "blog_post_id,locale" },
          );

        if (upsertError) {
          throw upsertError;
        }

        results.push({ locale: targetLocale, status: "translated" });
      } catch (err) {
        console.error(`Fallo de traducción para blog_post ${resourceId} a ${targetLocale}:`, err);

        await adminClient
          .from("blog_post_translations")
          .upsert(
            {
              blog_post_id: resourceId,
              locale: targetLocale,
              translation_source: "automatic",
              translation_status: "failed",
            },
            { onConflict: "blog_post_id,locale" },
          );

        results.push({
          locale: targetLocale,
          status: "failed",
          message: "La traducción automática no pudo completarse. El contenido maestro en español permanece intacto.",
        });
      }
    }
  }

  return json(req, {
    resource_type: resourceType,
    resource_id: resourceId,
    results,
  });
};

export default {
  fetch(req: Request) {
    const origin = req.headers.get("origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return Response.json({ error: "Origen no permitido." }, { status: 403 });
    }
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    return handler(req);
  },
};
