import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { exec, execSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Compilar vista previa antes de levantar el servidor
console.log("Compilando vista previa...");
try {
  execSync("node scripts/build.mjs", { cwd: root, stdio: "inherit" });
} catch (err) {
  console.error("Error al compilar el proyecto:", err.message);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
};

const requestHandler = (req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";

  let filePath = join(dist, urlPath);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, "index.html");
  } else if (!existsSync(filePath) && existsSync(filePath + ".html")) {
    filePath = filePath + ".html";
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(readFileSync(filePath));
  } else {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found");
  }
};

const initialPort = Number(process.env.PORT) || 5000;

function startServer(port, maxAttempts = 10) {
  const server = createServer(requestHandler);

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`⚠️  Puerto ${port} ocupado (habitual por AirPlay en macOS). Probando puerto ${port + 1}...`);
      if (maxAttempts > 0) {
        startServer(port + 1, maxAttempts - 1);
      } else {
        console.error("No se encontró ningún puerto disponible.");
        process.exit(1);
      }
    } else {
      console.error("Error en el servidor:", err.message);
      process.exit(1);
    }
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(`\n🚀 Servidor local AGM listo en: ${url}`);
    console.log(`Abriendo navegador...\n(Presiona Ctrl + C para detener el servidor)\n`);
    exec(`open ${url}`, () => {});
  });
}

startServer(initialPort);
