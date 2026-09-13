import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];
const ignored = new Set([".git", "node_modules", "dist", ".build-temp"]);
const textExtensions = new Set([
  ".html", ".js", ".mjs", ".json", ".md", ".toml", ".sql", ".yml", ".yaml",
  ".npmrc", ".gitignore",
]);

const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry) || entry.startsWith("._")) continue;
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else files.push(absolute);
  }
};
walk(root);

const contents = files
  .filter((file) => textExtensions.has(file.slice(file.lastIndexOf("."))) || file.endsWith(".gitignore"))
  .map((file) => [file, readFileSync(file, "utf8")]);

const secretPatterns = [
  ["clave secreta de Supabase", /sb_secret_[A-Za-z0-9_-]{12,}/],
  ["service role asignada", /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s<]+/],
  ["clave privada", /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
  ["token personal de GitHub", /github_pat_[A-Za-z0-9_]{20,}/],
];
for (const [file, content] of contents) {
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(content)) {
      failures.push(`${label} encontrada en ${relative(root, file)}`);
    }
  }
}

const source = readFileSync(join(root, "code.html"), "utf8");
const functionSource = readFileSync(
  join(root, "supabase", "functions", "request-quote", "index.ts"),
  "utf8",
);
const supabaseConfig = readFileSync(join(root, "supabase", "config.toml"), "utf8");
const migration = readFileSync(
  join(root, "supabase", "migrations", "20260913042617_initial_rental_operations.sql"),
  "utf8",
);

if (/target="_blank"/.test(source) && !/rel="noopener noreferrer"[^>]*target="_blank"|target="_blank"[^>]*rel="noopener noreferrer"/.test(source)) {
  failures.push("Hay enlaces target=_blank sin protección noopener/noreferrer.");
}
if (/\son[a-z]+\s*=/.test(source)) failures.push("Hay manejadores JavaScript inline.");
if (/style=/.test(source)) failures.push("Quedan estilos inline en code.html.");
if (!/sb_publishable_[A-Za-z0-9_-]+/.test(source)) failures.push("Falta la clave publicable de Supabase.");
if (!functionSource.includes("TURNSTILE_SECRET_KEY") || !functionSource.includes("/siteverify")) {
  failures.push("La función pública no implementa validación Turnstile del lado servidor.");
}
if (!functionSource.includes('result.action === "request_quote"') || !functionSource.includes("ALLOWED_TURNSTILE_HOSTNAMES")) {
  failures.push("Turnstile no valida la acción y el hostname esperados.");
}
if (functionSource.includes('"*"') && functionSource.includes("Access-Control-Allow-Origin")) {
  failures.push("CORS permite cualquier origen.");
}
if (!functionSource.includes("Una solicitud pública nunca sobrescribe")) {
  failures.push("No está protegida la identidad de clientes existentes.");
}
if (!supabaseConfig.includes("auto_expose_new_tables = false")) {
  failures.push("Las tablas nuevas podrían exponerse automáticamente.");
}
const publicTables = [...migration.matchAll(/create table public\./g)].length;
const rlsTables = [...migration.matchAll(/enable row level security/g)].length;
if (publicTables !== rlsTables) {
  failures.push(`RLS incompleto: ${publicTables} tablas públicas y ${rlsTables} activaciones.`);
}

const distHtmlPath = join(root, "dist", "index.html");
if (existsSync(join(root, "dist")) && statSync(join(root, "dist")).isDirectory()) {
  const distHtml = readFileSync(distHtmlPath, "utf8");
  if (distHtml.includes("cdn.tailwindcss.com")) failures.push("El paquete usa Tailwind CDN.");
  if (/<script(?![^>]*\ssrc=)[^>]*>/i.test(distHtml)) failures.push("El paquete contiene JavaScript inline.");
  if (/<style[\s>]/i.test(distHtml) || /style=/.test(distHtml)) failures.push("El paquete contiene CSS inline.");
  if (!distHtml.includes("Content-Security-Policy")) failures.push("Falta CSP en el paquete.");
  if (!readFileSync(join(root, "dist", ".htaccess"), "utf8").includes("Strict-Transport-Security")) {
    failures.push("Falta HSTS en la configuración Apache.");
  }
  const distCss = readFileSync(join(root, "dist", "assets", "site.css"), "utf8");
  if (distCss.includes("assets/assets/images/") || distCss.includes("url(assets/images/")) {
    failures.push("Las imágenes de fondo tienen una ruta incorrecta en el CSS compilado.");
  }
}

for (const placeholder of ["Términos y Condiciones", "Políticas de Privacidad", "Coberturas y Seguros"]) {
  const expression = new RegExp(`href="#"[^>]*>[^<]*${placeholder}|${placeholder}[\\s\\S]{0,120}href="#"`, "i");
  if (expression.test(source)) warnings.push(`El enlace “${placeholder}” aún es provisional.`);
}
warnings.push("El correo automático y Turnstile deben activarse antes de aceptar tráfico real.");

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (failures.length) {
  for (const failure of failures) console.error(`FALLO: ${failure}`);
  process.exit(1);
}
console.log("AUDITORÍA AUTOMÁTICA: APROBADA");
