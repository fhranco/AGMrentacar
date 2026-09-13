import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://fhranco.github.io",
  "https://agmrentacar.cl",
  "https://www.agmrentacar.cl",
]);
const ALLOWED_TURNSTILE_HOSTNAMES = new Set([
  "agmrentacar.cl",
  "www.agmrentacar.cl",
  "fhranco.github.io",
  "localhost",
  "127.0.0.1",
]);

type QuoteRequest = {
  full_name?: unknown;
  email?: unknown;
  phone?: unknown;
  customer_type?: unknown;
  company_name?: unknown;
  company_tax_id?: unknown;
  pickup_location_slug?: unknown;
  return_location_slug?: unknown;
  pickup_at?: unknown;
  return_at?: unknown;
  customer_notes?: unknown;
  turnstile_token?: unknown;
  website?: unknown;
};

const textValue = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

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

const verifyTurnstile = async (token: string, remoteIp: string) => {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY") || "";
  const required = Deno.env.get("TURNSTILE_REQUIRED") === "true";

  if (!secret || !token) return !required;

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
          response: token,
          remoteip: remoteIp || undefined,
        }),
      },
    );
    const result = await response.json();
    return response.ok &&
      result.success === true &&
      result.action === "request_quote" &&
      ALLOWED_TURNSTILE_HOSTNAMES.has(result.hostname);
  } catch (error) {
    console.error("Turnstile validation failed", error);
    return false;
  }
};

const handler = withSupabase(
  { auth: ["publishable"] },
  async (req, ctx) => {
    if (req.method !== "POST") {
      return json(req, { error: "Método no permitido." }, 405);
    }

    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > 20_000) {
      return json(req, { error: "La solicitud es demasiado grande." }, 413);
    }

    let payload: QuoteRequest;
    try {
      payload = await req.json();
    } catch {
      return json(req, { error: "La solicitud no contiene datos válidos." }, 400);
    }

    // Campo invisible para descartar bots sencillos sin guardar sus datos.
    if (textValue(payload.website, 200)) {
      return json(req, { received: true }, 202);
    }

    const turnstileToken = textValue(payload.turnstile_token, 2048);
    const remoteIp = textValue(
      req.headers.get("x-forwarded-for")?.split(",")[0],
      64,
    );
    if (!(await verifyTurnstile(turnstileToken, remoteIp))) {
      return json(req, { error: "No pudimos verificar la solicitud." }, 403);
    }

    const fullName = textValue(payload.full_name, 120);
    const email = textValue(payload.email, 254).toLowerCase();
    const phone = textValue(payload.phone, 40) || null;
    const customerType = textValue(payload.customer_type, 20);
    const companyName = textValue(payload.company_name, 160) || null;
    const companyTaxId = textValue(payload.company_tax_id, 30) || null;
    const pickupSlug = textValue(payload.pickup_location_slug, 80);
    const returnSlug = textValue(payload.return_location_slug, 80) || pickupSlug;
    const notes = textValue(payload.customer_notes, 1200) || null;
    const pickupAt = new Date(textValue(payload.pickup_at, 40));
    const returnAt = new Date(textValue(payload.return_at, 40));

    const validCustomerTypes = new Set(["tourism", "business", "mining"]);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (fullName.length < 3 || !emailPattern.test(email) || !pickupSlug) {
      return json(req, { error: "Revisa tu nombre, correo y lugar de retiro." }, 422);
    }

    if (!validCustomerTypes.has(customerType)) {
      return json(req, { error: "El tipo de cliente no es válido." }, 422);
    }

    if (customerType === "business" && (!companyName || !companyTaxId)) {
      return json(
        req,
        { error: "Para empresas necesitamos razón social y RUT." },
        422,
      );
    }

    const now = Date.now();
    const maxRentalMilliseconds = 180 * 24 * 60 * 60 * 1000;
    if (
      Number.isNaN(pickupAt.getTime()) ||
      Number.isNaN(returnAt.getTime()) ||
      pickupAt.getTime() < now - 15 * 60 * 1000 ||
      returnAt <= pickupAt ||
      returnAt.getTime() - pickupAt.getTime() > maxRentalMilliseconds
    ) {
      return json(req, { error: "Revisa las fechas y horas del arriendo." }, 422);
    }

    const requestedSlugs = [...new Set([pickupSlug, returnSlug])];
    const { data: locations, error: locationsError } = await ctx.supabaseAdmin
      .from("locations")
      .select("id, slug")
      .in("slug", requestedSlugs)
      .eq("active", true);

    if (locationsError || locations?.length !== requestedSlugs.length) {
      console.error("Location lookup failed", locationsError);
      return json(req, { error: "Una de las ubicaciones no está disponible." }, 422);
    }

    const locationIds = new Map(locations.map((item) => [item.slug, item.id]));

    let { data: customer, error: customerError } = await ctx.supabaseAdmin
      .from("customers")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!customerError && !customer) {
      const createdCustomer = await ctx.supabaseAdmin
        .from("customers")
        .insert({
          full_name: fullName,
          email,
          phone,
          tax_id: companyTaxId,
        })
        .select("id")
        .single();
      customer = createdCustomer.data;
      customerError = createdCustomer.error;
    }

    // Una solicitud pública nunca sobrescribe los datos de un cliente existente.
    // Si dos solicitudes crean el mismo correo a la vez, recuperamos el registro
    // que ganó la restricción única en vez de devolver un error innecesario.
    if (customerError && customerError.code === "23505") {
      const existingCustomer = await ctx.supabaseAdmin
        .from("customers")
        .select("id")
        .eq("email", email)
        .single();
      customer = existingCustomer.data;
      customerError = existingCustomer.error;
    }

    if (customerError || !customer) {
      console.error("Customer lookup or insert failed", customerError);
      return json(req, { error: "No pudimos registrar tus datos." }, 500);
    }

    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await ctx.supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      console.error("Rate limit lookup failed", countError);
      return json(req, { error: "No pudimos procesar la solicitud." }, 500);
    }

    if ((count || 0) >= 3) {
      return json(
        req,
        { error: "Ya recibimos varias solicitudes. Escríbenos por correo si necesitas ayuda." },
        429,
      );
    }

    const { data: reservation, error: reservationError } = await ctx.supabaseAdmin
      .from("reservations")
      .insert({
        customer_id: customer.id,
        pickup_location_id: locationIds.get(pickupSlug),
        return_location_id: locationIds.get(returnSlug),
        pickup_at: pickupAt.toISOString(),
        return_at: returnAt.toISOString(),
        customer_type: customerType,
        company_name: companyName,
        company_tax_id: companyTaxId,
        customer_notes: notes,
        source: "web",
        status: "requested",
      })
      .select("id, reference_code")
      .single();

    if (reservationError || !reservation) {
      console.error("Reservation insert failed", reservationError);
      return json(req, { error: "No pudimos crear la solicitud." }, 500);
    }

    const summary = [
      `Solicitud ${reservation.reference_code}`,
      `Cliente: ${fullName}`,
      `Correo: ${email}`,
      phone ? `Teléfono: ${phone}` : null,
      `Retiro: ${pickupAt.toISOString()}`,
      `Devolución: ${returnAt.toISOString()}`,
      notes ? `Notas: ${notes}` : null,
    ].filter(Boolean).join("\n");

    const { error: communicationError } = await ctx.supabaseAdmin
      .from("communications")
      .insert({
        reservation_id: reservation.id,
        channel: "internal",
        purpose: "quote",
        direction: "inbound",
        subject: `Solicitud web ${reservation.reference_code}`,
        body: summary,
        delivery_status: "not_applicable",
      });

    if (communicationError) {
      console.error("Communication log failed", communicationError);
    }

    return json(
      req,
      {
        received: true,
        reference_code: reservation.reference_code,
        message: "Solicitud recibida. AGM responderá formalmente por correo.",
      },
      201,
    );
  },
);

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
