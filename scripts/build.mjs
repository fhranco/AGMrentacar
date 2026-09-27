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

const getFingerprint = (content) =>
  createHash("sha256").update(content).digest("hex").slice(0, 8);

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
const sourceFingerprint = getFingerprint(source);
const visibleCommit = commit === "sin-git" ? sourceFingerprint : commit.slice(0, 7);
const builtAt = new Date().toISOString();
const release = {
  commit: commit === "sin-git" ? `sha256-${sourceFingerprint}` : commit,
  profile: production ? "production" : "preview",
  built_at: builtAt,
};
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
  .replaceAll("assets/fonts/", "fonts/")
  .concat(`
.agm-turnstile-wrap {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  min-height: 4.0625rem;
  padding: 0.25rem 0;
}
.agm-turnstile-wrap .cf-turnstile {
  width: min(100%, 20rem);
}
`);
writeFileSync(compiledCssPath, compiledCss);

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com",
  "style-src 'self'",
  "font-src 'self' data:",
  "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
  "connect-src 'self' https://pteogwhauodbxudywsdm.supabase.co https://challenges.cloudflare.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src https://www.openstreetmap.org https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
].join("; ");

const publicCmsSource = existsSync(join(root, "assets", "public-cms.js"))
  ? readFileSync(join(root, "assets", "public-cms.js"), "utf8")
  : "";

const cssVersion = commit !== "sin-git" ? visibleCommit : getFingerprint(compiledCss);
const appJsVersion = commit !== "sin-git" ? visibleCommit : getFingerprint(appMatch[1]);
const cmsJsVersion = commit !== "sin-git" ? visibleCommit : getFingerprint(publicCmsSource);

let html = source
  .replace(styleMatch[0], "")
  .replace(/\s*<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/, "")
  .replace(configMatch[0], "")
  .replace(appMatch[0], "")
  .replace(
    "</head>",
    `    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}" />\n    <link rel="stylesheet" href="assets/site.css?v=${cssVersion}" />\n  </head>`,
  )
  .replace(
    '<script src="assets/public-cms.js" defer></script>\n  </body>',
    `    <script src="assets/app.js?v=${appJsVersion}" defer></script>\n    <script src="assets/public-cms.js?v=${cmsJsVersion}" defer></script>\n  </body>`,
  )
  .replace(
    releaseMarker,
    "",
  )
  .replace(
    turnstileMarker,
    turnstileSiteKey
      ? `<div class="agm-turnstile-wrap" aria-label="Verificación de seguridad"><div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-action="request_quote" data-theme="light" data-size="flexible" data-appearance="always"></div></div>`
      : "",
  );

if (turnstileSiteKey) {
  html = html.replace(
    "</head>",
    '    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" defer></script>\n  </head>',
  );
}

writeFileSync(join(distPath, "index.html"), html);
writeFileSync(join(distPath, "assets", "app.js"), `${appMatch[1]}\n`);
if (existsSync(join(root, "assets", "public-cms.js"))) {
  cpSync(
    join(root, "assets", "public-cms.js"),
    join(distPath, "assets", "public-cms.js"),
  );
}
if (existsSync(join(root, "assets", "fonts"))) {
  cpSync(join(root, "assets", "fonts"), join(distPath, "assets", "fonts"), {
    recursive: true,
  });
}
cpSync(join(root, "assets", "images"), join(distPath, "assets", "images"), {
  recursive: true,
});
cpSync(join(root, "deploy", "apache.htaccess"), join(distPath, ".htaccess"));
const commitDate = (() => {
  try {
    return execFileSync("git", ["log", "-1", "--format=%cs"], {
      cwd: root,
      encoding: "utf8",
    }).trim();
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
})();

for (const staticRootFile of [
  "favicon.ico",
  "favicon.svg",
  "apple-touch-icon.png",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
]) {
  const filePath = join(root, staticRootFile);
  if (existsSync(filePath)) {
    cpSync(filePath, join(distPath, staticRootFile));
  }
}

const sitemapDistPath = join(distPath, "sitemap.xml");
if (existsSync(sitemapDistPath)) {
  const sitemapRaw = readFileSync(sitemapDistPath, "utf8");
  const sitemapUpdated = sitemapRaw.replace(
    /<lastmod>[^<]+<\/lastmod>/,
    `<lastmod>${commitDate}</lastmod>`,
  );
  writeFileSync(sitemapDistPath, sitemapUpdated);
}
if (existsSync(join(root, "admin"))) {
  cpSync(join(root, "admin"), join(distPath, "admin"), { recursive: true });
}

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
