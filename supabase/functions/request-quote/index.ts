import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const ALLOWED_ORIGINS = new Set([
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://fhranco.github.io",
  "https://orange-squid-480505.hostingersite.com",
  "https://agmrentacar.cl",
  "https://www.agmrentacar.cl",
  "https://ag-mrentacar.vercel.app",
]);
const ALLOWED_TURNSTILE_HOSTNAMES = new Set([
  "agmrentacar.cl",
  "www.agmrentacar.cl",
  "orange-squid-480505.hostingersite.com",
  "fhranco.github.io",
  "localhost",
  "127.0.0.1",
  "ag-mrentacar.vercel.app",
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
  vehicle_slug?: unknown;
  pickup_at?: unknown;
  return_at?: unknown;
  customer_notes?: unknown;
  privacy_consent?: unknown;
  privacy_policy_version?: unknown;
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

const TURNSTILE_VERIFY_TIMEOUT_MS = 8_000;

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
        signal: AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      console.error("Turnstile Siteverify request failed", {
        status: response.status,
      });
      return false;
    }

    const result = await response.json();
    return (
      result.success === true &&
      result.action === "request_quote" &&
      ALLOWED_TURNSTILE_HOSTNAMES.has(result.hostname)
    );
  } catch {
    console.error("Turnstile validation failed");
    return false;
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatPuntaArenasDateTime = (date: Date): string =>
  new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Punta_Arenas",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);

type CustomerEmailInput = {
  fullName: string;
  email: string;
  referenceCode: string;
  vehicleName: string;
  pickupLocationName: string;
  returnLocationName: string;
  pickupAt: Date;
  returnAt: Date;
};

type CustomerEmailContent = {
  subject: string;
  html: string;
  text: string;
};

const buildCustomerEmail = (input: CustomerEmailInput): CustomerEmailContent => {
  const safeName = escapeHtml(input.fullName);
  const safeRefCode = escapeHtml(input.referenceCode);
  const safeVehicle = escapeHtml(input.vehicleName);
  const safePickupLoc = escapeHtml(input.pickupLocationName);
  const safeReturnLoc = escapeHtml(input.returnLocationName);
  const pickupTimeStr = escapeHtml(formatPuntaArenasDateTime(input.pickupAt));
  const returnTimeStr = escapeHtml(formatPuntaArenasDateTime(input.returnAt));

  const pickupTimePlain = formatPuntaArenasDateTime(input.pickupAt);
  const returnTimePlain = formatPuntaArenasDateTime(input.returnAt);

  const subject = `Recibimos tu solicitud · ${input.referenceCode}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud recibida</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; text-align: left;">
          <!-- HEADER -->
          <tr>
            <td style="background-color: #0D5E8E; padding: 24px 32px; border-bottom: 4px solid #8AE600;">
              <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">AGM RENT A CAR</p>
              <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 700; color: #ffffff;">Solicitud recibida</h1>
            </td>
          </tr>
          <!-- BODY CONTENT -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #1e293b;">
                Hola, <strong>${safeName}</strong>.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 22px; color: #334155;">
                Recibimos correctamente tu solicitud de cotización. Nuestro equipo revisará la disponibilidad y los antecedentes enviados.
              </p>

              <!-- CÓDIGO DE SOLICITUD -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1E80B7; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #64748b; text-transform: uppercase;">Código de solicitud</span>
                    <span style="display: block; font-size: 22px; font-weight: 700; color: #0D5E8E; letter-spacing: 1px; margin-top: 4px;">${safeRefCode}</span>
                  </td>
                </tr>
              </table>

              <!-- RESUMEN -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; margin-bottom: 24px; font-size: 14px;">
                <tr>
                  <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; width: 40%; border-bottom: 1px solid #e2e8f0;">Vehículo</td>
                  <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${safeVehicle}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Retiro</td>
                  <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${safePickupLoc}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Fecha y hora de retiro</td>
                  <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${pickupTimeStr}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Devolución</td>
                  <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${safeReturnLoc}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569;">Fecha y hora de devolución</td>
                  <td style="padding: 10px 14px; color: #0f172a;">${returnTimeStr}</td>
                </tr>
              </table>

              <!-- AVISO CRÍTICO -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px; font-size: 13px; line-height: 20px; color: #92400e;">
                    <strong>Información importante:</strong> Esta solicitud todavía no constituye una reserva confirmada. AGM revisará la disponibilidad y te enviará la cotización formal por correo.
                  </td>
                </tr>
              </table>

              <!-- SIGUIENTES PASOS -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a;">¿Qué ocurre ahora?</h2>
                <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 20px; color: #334155;">
                  <li style="margin-bottom: 6px;">Revisaremos la disponibilidad del vehículo solicitado.</li>
                  <li style="margin-bottom: 6px;">Prepararemos tu cotización.</li>
                  <li style="margin-bottom: 6px;">Recibirás la propuesta formal por correo.</li>
                  <li style="margin-bottom: 0;">La reserva quedará confirmada únicamente cuando AGM complete el proceso de confirmación correspondiente.</li>
                </ol>
              </div>

              <!-- CONTACTO -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px 20px; margin-bottom: 8px;">
                <h2 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #0f172a;">¿Necesitas agregar información a tu solicitud?</h2>
                <p style="margin: 0 0 6px 0; font-size: 13px; line-height: 20px; color: #475569;">
                  Correo: <a href="mailto:reservas@agmrentacar.cl" style="color: #0D5E8E; font-weight: 600; text-decoration: underline;">reservas@agmrentacar.cl</a>
                </p>
                <p style="margin: 0; font-size: 13px; line-height: 20px; color: #475569;">
                  Teléfonos: <a href="tel:+56966571218" style="color: #0D5E8E; font-weight: 600; text-decoration: underline;">+56 9 6657 1218</a> &middot; <a href="tel:+56966571211" style="color: #0D5E8E; font-weight: 600; text-decoration: underline;">+56 9 6657 1211</a>
                </p>
              </div>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #64748b; text-align: center;">
              <p style="margin: 0 0 4px 0; font-weight: 600; color: #475569;">AGM Rent a Car SpA &middot; Punta Arenas &middot; Región de Magallanes</p>
              <p style="margin: 0; color: #94a3b8;">Recibiste este correo porque enviaste una solicitud de cotización a través de agmrentacar.cl.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "AGM RENT A CAR",
    "Solicitud recibida",
    "",
    `Hola, ${input.fullName}.`,
    "",
    "Recibimos correctamente tu solicitud de cotización. Nuestro equipo revisará la disponibilidad y los antecedentes enviados.",
    "",
    `Código de solicitud: ${input.referenceCode}`,
    "",
    "RESUMEN DE LA SOLICITUD",
    "--------------------------------------------------",
    `Vehículo: ${input.vehicleName}`,
    `Retiro: ${input.pickupLocationName}`,
    `Fecha y hora de retiro: ${pickupTimePlain}`,
    `Devolución: ${input.returnLocationName}`,
    `Fecha y hora de devolución: ${returnTimePlain}`,
    "",
    "INFORMACIÓN IMPORTANTE:",
    "Esta solicitud todavía no constituye una reserva confirmada. AGM revisará la disponibilidad y te enviará la cotización formal por correo.",
    "",
    "¿QUÉ OCURRE AHORA?",
    "1. Revisaremos la disponibilidad del vehículo solicitado.",
    "2. Prepararemos tu cotización.",
    "3. Recibirás la propuesta formal por correo.",
    "4. La reserva quedará confirmada únicamente cuando AGM complete el proceso de confirmación correspondiente.",
    "",
    "¿NECESITAS AGREGAR INFORMACIÓN A TU SOLICITUD?",
    "Correo: reservas@agmrentacar.cl",
    "Teléfonos: +56 9 6657 1218 / +56 9 6657 1211",
    "",
    "--------------------------------------------------",
    "AGM Rent a Car SpA",
    "Punta Arenas · Región de Magallanes",
    "Recibiste este correo porque enviaste una solicitud de cotización a través de agmrentacar.cl.",
  ].join("\n");

  return { subject, html, text };
};

const normalizePhoneDigits = (value: string): string =>
  value.replace(/\D/g, "");

const formatCustomerType = (type: string): string => {
  switch (type) {
    case "tourism":
      return "Turismo";
    case "business":
      return "Empresa";
    case "mining":
      return "Faena";
    default:
      return type;
  }
};

type InternalEmailInput = {
  reservationId: number;
  referenceCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  customerType: string;
  companyName: string | null;
  companyTaxId: string | null;
  vehicleName: string;
  pickupLocationName: string;
  returnLocationName: string;
  pickupAt: Date;
  returnAt: Date;
};

const buildInternalEmail = (input: InternalEmailInput): CustomerEmailContent => {
  const safeName = escapeHtml(input.fullName);
  const safeEmail = escapeHtml(input.email);
  const safePhone = input.phone ? escapeHtml(input.phone) : null;
  const safeRefCode = escapeHtml(input.referenceCode);
  const safeReservationId = escapeHtml(String(input.reservationId));
  const safeVehicle = escapeHtml(input.vehicleName);
  const safePickupLoc = escapeHtml(input.pickupLocationName);
  const safeReturnLoc = escapeHtml(input.returnLocationName);
  const customerTypeLabel = escapeHtml(formatCustomerType(input.customerType));
  const isBusiness = input.customerType === "business";
  const safeCompanyName = input.companyName ? escapeHtml(input.companyName) : "";
  const safeCompanyTaxId = input.companyTaxId ? escapeHtml(input.companyTaxId) : "";

  const pickupTimeStr = escapeHtml(formatPuntaArenasDateTime(input.pickupAt));
  const returnTimeStr = escapeHtml(formatPuntaArenasDateTime(input.returnAt));

  const pickupTimePlain = formatPuntaArenasDateTime(input.pickupAt);
  const returnTimePlain = formatPuntaArenasDateTime(input.returnAt);

  const phoneDigits = input.phone ? normalizePhoneDigits(input.phone) : "";
  const hasPhone = Boolean(phoneDigits);
  const telTarget =
    input.phone?.trim().startsWith("+") && phoneDigits
      ? `+${phoneDigits}`
      : phoneDigits;

  const subject = `Nueva solicitud web · ${input.referenceCode}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nueva solicitud de cotización</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f6f8; padding: 24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; text-align: left;">
          <!-- HEADER -->
          <tr>
            <td style="background-color: #0D5E8E; padding: 24px 32px; border-bottom: 4px solid #8AE600;">
              <p style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">AGM RENT A CAR</p>
              <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 700; color: #ffffff;">Nueva solicitud de cotización</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #cbd5e1;">Solicitud recibida desde agmrentacar.cl</p>
            </td>
          </tr>
          <!-- BODY CONTENT -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <!-- CÓDIGO DE SOLICITUD E ID INTERNO -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #1E80B7; border-radius: 6px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #64748b; text-transform: uppercase;">Código de solicitud</span>
                    <span style="display: block; font-size: 22px; font-weight: 700; color: #0D5E8E; letter-spacing: 1px; margin-top: 4px;">${safeRefCode}</span>
                    <span style="display: block; font-size: 12px; color: #64748b; margin-top: 6px;">ID interno: <strong>#${safeReservationId}</strong></span>
                  </td>
                </tr>
              </table>

              <!-- CLIENTE -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Cliente</h2>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0;">Nombre</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${safeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Correo</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;"><a href="mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(`Cotización AGM ${input.referenceCode}`)}" style="color: #0D5E8E; text-decoration: underline;">${safeEmail}</a></td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Teléfono</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${safePhone ? safePhone : '<span style="color: #94a3b8;">No informado</span>'}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569;">Tipo</td>
                    <td style="padding: 10px 14px; color: #0f172a; font-weight: 600;">${customerTypeLabel}</td>
                  </tr>
                </table>
              </div>

              ${isBusiness ? `
              <!-- EMPRESA -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Empresa</h2>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0;">Razón social</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${safeCompanyName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569;">RUT</td>
                    <td style="padding: 10px 14px; color: #0f172a;">${safeCompanyTaxId}</td>
                  </tr>
                </table>
              </div>
              ` : ""}

              <!-- SOLICITUD -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Solicitud</h2>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;">
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0;">Vehículo</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-weight: 600;">${safeVehicle}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Retiro</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${safePickupLoc}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Fecha y hora de retiro</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${pickupTimeStr}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0;">Devolución</td>
                    <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0;">${safeReturnLoc}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 14px; background-color: #f8fafc; font-weight: 600; color: #475569;">Fecha y hora de devolución</td>
                    <td style="padding: 10px 14px; color: #0f172a;">${returnTimeStr}</td>
                  </tr>
                </table>
              </div>

              <!-- ACCIONES DE CONTACTO -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">Acciones de contacto directo</h2>
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <a href="mailto:${encodeURIComponent(input.email)}?subject=${encodeURIComponent(`Cotización AGM ${input.referenceCode}`)}" style="display: inline-block; background-color: #0D5E8E; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 4px; margin-right: 8px; margin-bottom: 6px;">Responder por correo</a>
                      ${hasPhone ? `
                      <a href="tel:${telTarget}" style="display: inline-block; background-color: #ffffff; color: #0f172a; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 4px; border: 1px solid #cbd5e1; margin-right: 8px; margin-bottom: 6px;">Llamar</a>
                      <a href="https://api.whatsapp.com/send?phone=${encodeURIComponent(phoneDigits)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #25D366; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 4px; margin-bottom: 6px;">WhatsApp</a>
                      ` : ""}
                    </td>
                  </tr>
                </table>
              </div>

              <!-- PRÓXIMA ACCIÓN RECOMENDADA -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-left: 4px solid #1E80B7; border-radius: 6px; margin-bottom: 8px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <span style="display: block; font-size: 11px; font-weight: 700; letter-spacing: 1px; color: #1e40af; text-transform: uppercase;">Próxima acción recomendada</span>
                    <span style="display: block; font-size: 13px; line-height: 20px; color: #1e3a8a; margin-top: 4px;">Revisar disponibilidad, preparar cotización y responder al cliente utilizando el código de solicitud.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 32px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 18px; color: #64748b; text-align: center;">
              <p style="margin: 0; font-weight: 600; color: #475569;">AGM Rent a Car &middot; Sistema Operativo de Reservas</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textParts = [
    "AGM RENT A CAR",
    "Nueva solicitud de cotización",
    "Solicitud recibida desde agmrentacar.cl",
    "",
    `Código de solicitud: ${input.referenceCode}`,
    `ID interno: #${input.reservationId}`,
    "",
    "CLIENTE",
    "--------------------------------------------------",
    `Nombre: ${input.fullName}`,
    `Correo: ${input.email}`,
    `Teléfono: ${input.phone || "No informado"}`,
    `Tipo: ${formatCustomerType(input.customerType)}`,
  ];

  if (isBusiness) {
    textParts.push(
      "",
      "EMPRESA",
      "--------------------------------------------------",
      `Razón social: ${input.companyName || "No informada"}`,
      `RUT: ${input.companyTaxId || "No informado"}`,
    );
  }

  textParts.push(
    "",
    "SOLICITUD",
    "--------------------------------------------------",
    `Vehículo: ${input.vehicleName}`,
    `Retiro: ${input.pickupLocationName}`,
    `Fecha y hora de retiro: ${pickupTimePlain}`,
    `Devolución: ${input.returnLocationName}`,
    `Fecha y hora de devolución: ${returnTimePlain}`,
    "",
    "ACCIONES DE CONTACTO",
    "--------------------------------------------------",
    `Responder por correo: ${input.email}`,
  );

  if (hasPhone) {
    textParts.push(
      `Llamar: ${input.phone}`,
      `WhatsApp: https://api.whatsapp.com/send?phone=${phoneDigits}`,
    );
  }

  textParts.push(
    "",
    "PRÓXIMA ACCIÓN RECOMENDADA",
    "--------------------------------------------------",
    "Revisar disponibilidad, preparar cotización y responder al cliente utilizando el código de solicitud.",
  );

  const text = textParts.join("\n");

  return { subject, html, text };
};

const RESEND_FROM = "AGM Rent a Car <reservas@agmrentacar.cl>";

type EmailSendResult =
  | {
      ok: true;
      id: string;
    }
  | {
      ok: false;
      status?: number;
    };

type SendResendEmailOptions = {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

const sendResendEmail = async ({
  apiKey,
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendResendEmailOptions): Promise<EmailSendResult> => {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to,
        subject,
        html,
        text,
      }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const payload = await response.json();
    if (typeof payload?.id === "string" && payload.id.trim()) {
      return { ok: true, id: payload.id.trim() };
    }

    return { ok: false, status: response.status };
  } catch {
    return { ok: false };
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
    const vehicleSlug = textValue(payload.vehicle_slug, 100);
    const notes = textValue(payload.customer_notes, 1200) || null;
    const pickupAt = new Date(textValue(payload.pickup_at, 40));
    const returnAt = new Date(textValue(payload.return_at, 40));

    const validCustomerTypes = new Set(["tourism", "business", "mining"]);
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (payload.privacy_consent !== true) {
      return json(
        req,
        { error: "Debes aceptar la Política de Tratamiento de Datos Personales para continuar (Ley N° 21.719)." },
        422,
      );
    }

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
      .select("id, slug, name")
      .in("slug", requestedSlugs)
      .eq("active", true);

    if (locationsError || locations?.length !== requestedSlugs.length) {
      console.error("Location lookup failed", locationsError);
      return json(req, { error: "Una de las ubicaciones no está disponible." }, 422);
    }

    const locationIds = new Map(locations.map((item) => [item.slug, item.id]));
    const locationNames = new Map(
      locations.map((item) => [item.slug, item.name]),
    );

    let requestedModelId: number | null = null;
    let requestedVehicleName = "Recomendación AGM";

    if (vehicleSlug) {
      const { data: vehicleModel, error: vehicleModelError } =
        await ctx.supabaseAdmin
          .from("vehicle_models")
          .select("id, slug, display_name")
          .eq("slug", vehicleSlug)
          .eq("active", true)
          .maybeSingle();

      if (vehicleModelError) {
        console.error("Vehicle model lookup failed", vehicleModelError);
        return json(req, { error: "No pudimos procesar la solicitud." }, 500);
      }

      if (!vehicleModel) {
        return json(
          req,
          { error: "El vehículo seleccionado no está disponible." },
          422,
        );
      }

      requestedModelId = vehicleModel.id;
      requestedVehicleName = vehicleModel.display_name;
    }

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
        requested_model_id: requestedModelId,
        pickup_location_id: locationIds.get(pickupSlug),
        return_location_id: locationIds.get(returnSlug),
        pickup_at: pickupAt.toISOString(),
        return_at: returnAt.toISOString(),
        customer_type: customerType,
        company_name: companyName,
        company_tax_id: companyTaxId,
        customer_notes: notes,
        privacy_consent: true,
        privacy_consent_at: new Date().toISOString(),
        privacy_policy_version: textValue(payload.privacy_policy_version, 40) || "2026-v1",
        source: "web",
        status: "requested",
      })
      .select("id, reference_code")
      .single();

    if (reservationError || !reservation) {
      console.error("Reservation insert failed", reservationError);
      return json(req, { error: "No pudimos crear la solicitud." }, 500);
    }

    const pickupLocationName = locationNames.get(pickupSlug);
    const returnLocationName = locationNames.get(returnSlug);

    if (!pickupLocationName || !returnLocationName) {
      console.error("Location name mapping failed");
      return json(req, { error: "No pudimos procesar la solicitud." }, 500);
    }

    const customerEmail = buildCustomerEmail({
      fullName,
      email,
      referenceCode: reservation.reference_code,
      vehicleName: requestedVehicleName,
      pickupLocationName,
      returnLocationName,
      pickupAt,
      returnAt,
    });

    const internalEmail = buildInternalEmail({
      reservationId: reservation.id,
      referenceCode: reservation.reference_code,
      fullName,
      email,
      phone,
      customerType,
      companyName,
      companyTaxId,
      vehicleName: requestedVehicleName,
      pickupLocationName,
      returnLocationName,
      pickupAt,
      returnAt,
    });

    const summary = [
      `Solicitud ${reservation.reference_code}`,
      `Cliente: ${fullName}`,
      `Correo: ${email}`,
      phone ? `Teléfono: ${phone}` : null,
      `Vehículo: ${requestedVehicleName}`,
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

    const { data: customerCommunication, error: customerCommunicationError } =
      await ctx.supabaseAdmin
        .from("communications")
        .insert({
          reservation_id: reservation.id,
          channel: "email",
          purpose: "quote",
          direction: "outbound",
          recipient: email,
          subject: customerEmail.subject,
          body: customerEmail.text,
          delivery_status: "queued",
        })
        .select("id")
        .single();

    if (customerCommunicationError) {
      console.error(
        "Customer email communication log failed",
        customerCommunicationError,
      );
    }

    const { data: internalCommunication, error: internalCommunicationError } =
      await ctx.supabaseAdmin
        .from("communications")
        .insert({
          reservation_id: reservation.id,
          channel: "email",
          purpose: "internal",
          direction: "outbound",
          recipient: "reservas@agmrentacar.cl",
          subject: internalEmail.subject,
          body: internalEmail.text,
          delivery_status: "queued",
        })
        .select("id")
        .single();

    if (internalCommunicationError) {
      console.error(
        "Internal email communication log failed",
        internalCommunicationError,
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not configured");

      if (customerCommunication?.id) {
        const { error: updateError } = await ctx.supabaseAdmin
          .from("communications")
          .update({ delivery_status: "failed" })
          .eq("id", customerCommunication.id);

        if (updateError) {
          console.error("Customer communication update failed", updateError);
        }
      } else {
        console.error("Customer email result could not be persisted");
      }

      if (internalCommunication?.id) {
        const { error: updateError } = await ctx.supabaseAdmin
          .from("communications")
          .update({ delivery_status: "failed" })
          .eq("id", internalCommunication.id);

        if (updateError) {
          console.error("Internal communication update failed", updateError);
        }
      } else {
        console.error("Internal email result could not be persisted");
      }
    } else {
      const [customerSendResult, internalSendResult] = await Promise.all([
        sendResendEmail({
          apiKey: resendApiKey,
          to: email,
          subject: customerEmail.subject,
          html: customerEmail.html,
          text: customerEmail.text,
          idempotencyKey: `agm-quote-customer/${reservation.reference_code}`,
        }),
        sendResendEmail({
          apiKey: resendApiKey,
          to: "reservas@agmrentacar.cl",
          subject: internalEmail.subject,
          html: internalEmail.html,
          text: internalEmail.text,
          idempotencyKey: `agm-quote-internal/${reservation.reference_code}`,
        }),
      ]);

      if (!customerSendResult.ok) {
        console.error(
          "Customer email send failed",
          customerSendResult.status !== undefined
            ? { status: customerSendResult.status }
            : undefined,
        );
      }

      if (customerCommunication?.id) {
        const updatePayload = customerSendResult.ok
          ? {
              delivery_status: "sent",
              external_id: customerSendResult.id,
              sent_at: new Date().toISOString(),
            }
          : {
              delivery_status: "failed",
            };

        const { error: updateError } = await ctx.supabaseAdmin
          .from("communications")
          .update(updatePayload)
          .eq("id", customerCommunication.id);

        if (updateError) {
          console.error("Customer communication update failed", updateError);
        }
      } else {
        console.error("Customer email result could not be persisted");
      }

      if (!internalSendResult.ok) {
        console.error(
          "Internal email send failed",
          internalSendResult.status !== undefined
            ? { status: internalSendResult.status }
            : undefined,
        );
      }

      if (internalCommunication?.id) {
        const updatePayload = internalSendResult.ok
          ? {
              delivery_status: "sent",
              external_id: internalSendResult.id,
              sent_at: new Date().toISOString(),
            }
          : {
              delivery_status: "failed",
            };

        const { error: updateError } = await ctx.supabaseAdmin
          .from("communications")
          .update(updatePayload)
          .eq("id", internalCommunication.id);

        if (updateError) {
          console.error("Internal communication update failed", updateError);
        }
      } else {
        console.error("Internal email result could not be persisted");
      }
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
