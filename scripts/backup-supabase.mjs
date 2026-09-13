import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destinationValue = (process.env.AGM_BACKUP_DIR || "").trim();
if (!destinationValue) {
  console.error("Define AGM_BACKUP_DIR con una carpeta cifrada fuera del repositorio.");
  process.exit(1);
}

const destination = resolve(destinationValue);
if (destination === root || destination.startsWith(root + "/") || destination.startsWith(root + "\\")) {
  console.error("El respaldo no puede guardarse dentro del repositorio.");
  process.exit(1);
}

const runtimeCandidates = process.platform === "win32"
  ? ["docker.exe", "podman.exe"]
  : ["docker", "podman"];
const hasContainerRuntime = runtimeCandidates.some((command) => {
  const result = spawnSync(command, ["--version"], { stdio: "ignore" });
  return result.status === 0;
});
if (!hasContainerRuntime) {
  console.error(
    "El respaldo oficial de Supabase necesita Docker Desktop o Podman disponible y en ejecución.",
  );
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = join(destination, `agm-supabase-${stamp}`);
mkdirSync(backupDir, { recursive: true, mode: 0o700 });

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const base = ["--yes", "supabase@2.117.0", "db", "dump", "--linked"];
const run = (extra) => execFileSync(npx, [...base, ...extra], { cwd: root, stdio: "inherit" });

run(["--file", join(backupDir, "schema.sql")]);
run(["--role-only", "--file", join(backupDir, "roles.sql")]);
run(["--data-only", "--use-copy", "--file", join(backupDir, "data.sql")]);

const names = ["schema.sql", "roles.sql", "data.sql"];
const manifest = names.map((name) => {
  const file = join(backupDir, name);
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  return `${hash}  ${name}`;
}).join("\n");
writeFileSync(join(backupDir, "manifest.sha256"), `${manifest}\n`, { mode: 0o600 });
writeFileSync(
  join(backupDir, "README.txt"),
  [
    "Respaldo lógico AGM Rent a Car.",
    "Conservar cifrado, con acceso restringido y fuera del repositorio.",
    "Verificar restauración trimestral en un proyecto aislado.",
    `Ruta relativa: ${relative(destination, backupDir)}`,
  ].join("\n") + "\n",
  { mode: 0o600 },
);
console.log(`Respaldo creado en ${backupDir}`);
