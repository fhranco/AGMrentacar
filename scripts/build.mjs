import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = join(root, "code.html");
const distPath = join(root, "dist");
const tempPath = join(root, ".build-temp");
const production = process.argv.includes("--production");
const turnstileSiteKey = (process.env.TURNSTILE_SITE_KEY || "").trim();
const releaseMarker = "<!-- BUILD_VERSION -->";
const turnstileMarker = "<!-- TURNSTILE_WIDGET -->";

if (production && !turnstileSiteKey) {
  console.error(
    "Falta TURNSTILE_SITE_KEY. El paquete de producción se bloquea sin protección antibots.",
  );
  process.exit(1);
}

const source = readFileSync(sourcePath, "utf8");
const styleMatch = source.match(/<style>([\s\S]*?)<\/style>/);
const configMatch = source.match(
  /<script id="tailwind-config">\s*tailwind\.config\s*=\s*([\s\S]*?)\s*;\s*<\/script>/,
);
const appMatch = [...source.matchAll(/<script>\s*([\s\S]*?)\s*<\/script>/g)]
  .find((match) => match[1].includes('document.addEventListener("DOMContentLoaded"'));

if (
  !styleMatch ||
  !configMatch ||
  !appMatch ||
  !source.includes(releaseMarker) ||
  !source.includes(turnstileMarker)
) {
  throw new Error("No se pudieron separar los estilos o el JavaScript de code.html.");
}

const commit = (() => {
  try {
    return execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return "sin-git";
  }
})();
const builtAt = new Date().toISOString();
const release = {
  commit,
  profile: production ? "production" : "preview",
  built_at: builtAt,
};
const visibleCommit = commit === "sin-git" ? commit : commit.slice(0, 7);
const localBuildParts = Object.fromEntries(
  new Intl.DateTimeFormat("es-CL", {
    timeZone: "America/Punta_Arenas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date(builtAt))
    .map(({ type, value }) => [type, value]),
);
const visibleBuiltAt = `${localBuildParts.day}/${localBuildParts.month}/${localBuildParts.year} ${localBuildParts.hour}:${localBuildParts.minute}`;
const visibleRelease = `PREVIEW CLIENTE · v0.1 · ${visibleCommit} · STAGING · ${visibleBuiltAt}`;

rmSync(distPath, { recursive: true, force: true });
rmSync(tempPath, { recursive: true, force: true });
mkdirSync(join(distPath, "assets"), { recursive: true });
mkdirSync(tempPath, { recursive: true });

const inputCss = [
  "@tailwind base;",
  "@tailwind components;",
  "@tailwind utilities;",
  styleMatch[1],
].join("\n");
const tailwindConfig = [
  `const config = ${configMatch[1]};`,
  `config.content = [${JSON.stringify(sourcePath)}];`,
  "module.exports = config;",
].join("\n");

writeFileSync(join(tempPath, "input.css"), inputCss);
writeFileSync(join(tempPath, "tailwind.config.cjs"), tailwindConfig);

const tailwindBinary = join(
  root,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tailwindcss.cmd" : "tailwindcss",
);

execFileSync(
  tailwindBinary,
  [
    "-i",
    join(tempPath, "input.css"),
    "-c",
    join(tempPath, "tailwind.config.cjs"),
    "-o",
    join(distPath, "assets", "site.css"),
    "--minify",
  ],
  { cwd: root, stdio: "inherit" },
);

const compiledCssPath = join(distPath, "assets", "site.css");
const compiledCss = readFileSync(compiledCssPath, "utf8")
  .replaceAll("assets/images/", "images/")
  .concat(`
:root { --preview-banner-height: 2.75rem; }
.agm-preview-banner {
  position: fixed;
  inset: 0 0 auto;
  z-index: 70;
  min-height: var(--preview-banner-height);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-bottom: 3px solid #8ae600;
  background: #052a40;
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(5, 42, 64, 0.28);
  font-size: 0.75rem;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: 0.08em;
  text-align: center;
  text-transform: uppercase;
}
body > header { top: var(--preview-banner-height) !important; }
body > main { padding-top: calc(7rem + var(--preview-banner-height)) !important; }
@media (max-width: 639px) {
  :root { --preview-banner-height: 4rem; }
  .agm-preview-banner {
    padding: 0.5rem 0.75rem;
    font-size: 0.6875rem;
    letter-spacing: 0.055em;
  }
}
`);
writeFileSync(compiledCssPath, compiledCss);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data:",
  "connect-src 'self' https://pteogwhauodbxudywsdm.supabase.co https://challenges.cloudflare.com",
  "frame-src https://www.openstreetmap.org https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

let html = source
  .replace(styleMatch[0], "")
  .replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, "")
  .replace(configMatch[0], "")
  .replace(appMatch[0], "")
  .replace(
    "</head>",
    `    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />\n    <link rel="stylesheet" href="assets/site.css" />\n  </head>`,
  )
  .replace(
    "</body>",
    '    <script src="assets/app.js" defer></script>\n  </body>',
  )
  .replace(
    releaseMarker,
    `<aside class="agm-preview-banner" aria-label="Entorno de revisión">${visibleRelease}</aside>`,
  )
  .replace(
    turnstileMarker,
    turnstileSiteKey
      ? `<div class="lg:col-span-12 flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-action="request_quote"></div><p class="font-body-sm text-[12px] text-slate-500">Verificación de seguridad requerida para enviar la solicitud.</p></div>`
      : "",
  );

if (turnstileSiteKey) {
  html = html.replace(
    "</head>",
    '    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>\n  </head>',
  );
}

writeFileSync(join(distPath, "index.html"), html);
writeFileSync(join(distPath, "assets", "app.js"), `${appMatch[1]}\n`);
cpSync(join(root, "assets", "images"), join(distPath, "assets", "images"), {
  recursive: true,
});
cpSync(join(root, "deploy", "apache.htaccess"), join(distPath, ".htaccess"));

writeFileSync(
  join(distPath, "release.json"),
  JSON.stringify(release, null, 2) + "\n",
);

const files = [];
const walk = (directory) => {
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else files.push(absolute);
  }
};
walk(distPath);

const manifest = files
  .filter((file) => !file.endsWith("manifest.sha256"))
  .sort()
  .map((file) => {
    const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
    return `${hash}  ${relative(distPath, file).replaceAll("\\", "/")}`;
  })
  .join("\n");
writeFileSync(join(distPath, "manifest.sha256"), `${manifest}\n`);

rmSync(tempPath, { recursive: true, force: true });
console.log(`Paquete ${production ? "de producción" : "de vista previa"} creado en dist/.`);
