import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://agmrentacar.cl",
  "https://www.agmrentacar.cl",
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

const handler = withSupabase(
  { auth: ["publishable"] },
  async (req, ctx) => {
    if (req.method !== "POST") {
      return json(req, { error: "Método no permitido." }, 405);
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

    const { data: customer, error: customerError } = await ctx.supabaseAdmin
      .from("customers")
      .upsert(
        {
          full_name: fullName,
          email,
          phone,
          tax_id: companyTaxId,
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (customerError || !customer) {
      console.error("Customer upsert failed", customerError);
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
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(req) });
    }
    return handler(req);
  },
};
