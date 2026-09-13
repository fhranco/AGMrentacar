# Manual operativo y de despliegue

Este documento permite que una persona o una herramienta como Antigravity,
Gemini, Copilot o Codex continúe el proyecto sin depender del equipo original.
Las reglas canónicas para agentes están en `AGENTS.md`.

## 1. Arquitectura y fuente de verdad

- Sitio estático: `code.html` y `assets/images/`.
- Compilación segura: `scripts/build.mjs`; genera `dist/`.
- Backend: proyecto Supabase `pteogwhauodbxudywsdm`.
- Cambios de base de datos: `supabase/migrations/`.
- Entrada pública: Edge Function `request-quote`.
- Repositorio: `https://github.com/fhranco/AGMrentacar`.

Nunca editar `dist/`, nunca subir la raíz al servidor y nunca modificar una
migración aplicada. El correo es el canal formal; WhatsApp es sólo soporte.

## 2. Entornos

| Entorno | Uso | Datos reales |
|---|---|---|
| Local | Desarrollo en cada equipo | No |
| GitHub Pages | Vista previa temporal | Evitar |
| Producción | Dominio AGM y paquete `dist/` | Sí |

Requisitos en macOS, Linux o Windows: Git, Node.js 22 LTS y acceso autorizado a
Supabase. Para crear o restaurar volcados también se necesita Docker Desktop o
Podman instalado, iniciado y disponible en la terminal. Se usa `npx` con una
versión fija para no depender de una instalación global.

## 3. Flujo de cambios desde cualquier plataforma

1. Actualizar la copia y crear una rama con un nombre descriptivo.
2. Ejecutar `npm ci` para instalar exactamente `package-lock.json`.
3. Hacer el cambio sólo en archivos fuente.
4. Ejecutar `npm run verify`.
5. Revisar que Git no incluya `.env`, respaldos, `dist/` ni datos personales.
6. Subir la rama y exigir que el control “Calidad y seguridad” termine en verde.
7. Integrar mediante revisión. La rama `main` es la versión aprobada.

Los comandos Git y npm son iguales en Terminal, PowerShell y CMD. Las variables
de entorno cambian:

```sh
# macOS/Linux
TURNSTILE_SITE_KEY="clave_publica" npm run build
```

```powershell
# Windows PowerShell
$env:TURNSTILE_SITE_KEY="clave_publica"
npm run build
Remove-Item Env:TURNSTILE_SITE_KEY
```

## 4. Activación segura de Turnstile

1. Crear un widget en Cloudflare Turnstile sólo para `agmrentacar.cl` y
   `www.agmrentacar.cl`; agregar el dominio de pruebas únicamente si seguirá
   controlado.
2. La *site key* es pública y sólo se usa al construir el sitio.
3. La *secret key* se guarda en el gestor de contraseñas y en secretos de
   Supabase. Nunca se escribe en `.env.example`, Git o el servidor web.
4. Desde un equipo confiable, crear temporalmente un archivo fuera del
   repositorio con:

```text
TURNSTILE_SECRET_KEY=valor_secreto
TURNSTILE_REQUIRED=true
```

5. Cargarlo con `npx --yes supabase@2.117.0 secrets set --env-file RUTA_SEGURA`
   y eliminar el archivo temporal cuando quede custodiado en el gestor.
6. Volver a desplegar la función:
   `npx --yes supabase@2.117.0 functions deploy request-quote`.
7. Confirmar que una petición sin token sea rechazada y que el formulario real
   cree una única solicitud.

La verificación de Turnstile es obligatoriamente del lado servidor. Sus tokens
son de un solo uso y caducan; mostrar el widget sin comprobar el token no protege
el formulario.

## 5. Construcción y publicación manual

1. Desde `main`, con el árbol limpio: `npm ci` y `npm run verify`.
2. Definir `TURNSTILE_SITE_KEY` y ejecutar `npm run build`.
3. Ejecutar otra vez `npm run audit`.
4. Guardar juntos `dist/release.json` y `dist/manifest.sha256` como evidencia.
5. Subir **el contenido de `dist/`**, incluido `.htaccess`, por SFTP/SSH o por el
   administrador HTTPS del hosting. No usar FTP sin cifrado.

### Servidor con SSH y versiones

- Crear `/var/www/agm/releases/<commit>` y subir allí el paquete.
- Propietario: usuario de despliegue; directorios `755`, archivos `644`.
- Validar el manifiesto dentro de la carpeta con
  `sha256sum -c manifest.sha256` (Linux) o `shasum -a 256 -c manifest.sha256`
  (macOS).
- Apuntar el enlace `/var/www/agm/current` a la nueva versión de forma atómica.
- Usar `deploy/nginx.conf.example` como base, instalar un certificado real,
  validar configuración y recargar Nginx.
- Conservar al menos las dos versiones anteriores para reversión inmediata.

### Hosting cPanel/Apache sin SSH

- Descargar una copia de la versión actual antes de tocar `public_html`.
- Vaciar sólo los archivos conocidos de la versión anterior, no otras carpetas
  del hosting.
- Subir el contenido de `dist/`, comprobar que `.htaccess` también se cargó y
  revisar permisos.
- Si falla una prueba, restaurar la copia anterior completa.

No activar HSTS hasta confirmar que el dominio y todos los subdominios incluidos
funcionan permanentemente con HTTPS. La plantilla lo incluye para el estado
final; si existen subdominios sin HTTPS, resolverlos antes.

## 6. Prueba posterior al despliegue

- HTTP redirige a HTTPS y no genera bucles detrás de proxy/CDN.
- Certificado válido para ambos dominios.
- Inicio, navegación, categorías, imágenes, mapa y diseño móvil funcionan.
- Consola del navegador sin violaciones inesperadas de CSP.
- Encabezados presentes: HSTS, CSP, `nosniff`, `DENY`, referrer y permissions.
- Una cotización válida devuelve referencia y aparece una vez en Supabase.
- Una cotización sin Turnstile falla.
- Un origen no autorizado falla.
- El correo formal llega al cliente y al equipo; respuesta y rebote están
  probados. WhatsApp se presenta sólo como soporte.
- Registrar fecha, commit, responsable, resultado y versión anterior.

## 7. Respaldo y restauración

### Estrategia 3-2-1

Mantener tres copias, en dos medios y una fuera del sitio:

- Código: GitHub más una copia local cifrada y los paquetes de cada release.
- Base: respaldo lógico diario cifrado fuera del repositorio.
- Documentos/archivos futuros de Storage: copia separada; los respaldos de base
  no contienen los objetos de Storage.

En el plan gratuito de Supabase no se debe suponer que existe un respaldo diario
descargable. Ejecutar desde un equipo vinculado:

```sh
# macOS/Linux
AGM_BACKUP_DIR="/ruta/cifrada/externa" npm run backup:supabase
```

```powershell
# Windows PowerShell
$env:AGM_BACKUP_DIR="D:\RespaldosCifrados\AGM"
npm run backup:supabase
Remove-Item Env:AGM_BACKUP_DIR
```

El comando genera esquema, roles, datos y firmas SHA-256. Retención recomendada:
14 diarios, 8 semanales y 12 mensuales. Automatizarlo en un equipo/servidor
administrado, alertar fallos y cifrar el destino. Objetivo inicial sugerido:
RPO 24 horas y RTO 4 horas; AGM debe aprobarlos según impacto comercial.

Antes del primer respaldo, comprobar `docker --version` o `podman --version`.
Si el comando no está disponible, instalar y abrir el motor de contenedores; no
considerar cumplido el control de respaldo hasta obtener los archivos, verificar
sus firmas y completar una restauración.

Cada trimestre, restaurar el último respaldo en un proyecto Supabase aislado,
validar recuentos y flujo de calendario, documentar tiempo y luego eliminar el
entorno de prueba. Un respaldo no probado no es una garantía de recuperación.

Los planes pagados ofrecen respaldos administrados con retención según plan y
pueden añadir recuperación a un punto en el tiempo. Confirmar siempre la
configuración vigente en la documentación oficial:
`https://supabase.com/docs/guides/platform/backups`.

## 8. Cambios de base de datos

1. Respaldar y comprobar el manifiesto.
2. Crear una migración nueva; nunca reescribir las aplicadas.
3. Probar localmente y revisar RLS, índices y restricciones.
4. Vincular el proyecto con `npx --yes supabase@2.117.0 link` si es necesario.
5. Revisar con `npx --yes supabase@2.117.0 db push --dry-run`.
6. Aplicar con `npx --yes supabase@2.117.0 db push`.
7. Desplegar funciones afectadas y ejecutar
   `npx --yes supabase@2.117.0 db advisors --linked`.
8. Ejecutar una prueba real controlada y registrar el resultado.

Las migraciones productivas se corrigen hacia adelante. Restaurar toda la base
se reserva para incidentes graves y se decide con el responsable de datos.

## 9. Reversión

- Sitio con SSH: volver el enlace `current` al release anterior y recargar.
- cPanel: restaurar la copia descargada antes del cambio.
- Edge Function: volver al commit conocido y desplegar esa versión.
- Base de datos: crear una migración correctiva; no borrar datos ni ejecutar una
  restauración general sin evaluar las solicitudes recibidas desde el cambio.

Tras revertir, probar formulario y calendario, preservar registros y abrir un
informe de incidente.

## 10. Accesos y operación cotidiana

- Una cuenta por persona; nada de contraseñas compartidas.
- MFA obligatorio para GitHub, Supabase, Cloudflare, hosting, correo y registrador.
- Acceso mínimo y baja inmediata al terminar una relación laboral/proveedor.
- Revisar accesos cada trimestre y rotar claves ante cualquier sospecha.
- No copiar datos personales a hojas, chats o herramientas de IA.
- Revisar diariamente nuevas solicitudes y respaldos; semanalmente rebotes,
  errores y reservas próximas; mensualmente accesos y capacidad.

## 11. Lista final de aprobación

Sólo autorizar producción cuando:

- todos los bloqueadores de `docs/AUDITORIA_PREPRODUCCION.md` estén marcados;
- `npm run verify` y el control de GitHub estén verdes;
- exista respaldo restaurado con éxito;
- haya responsable y reversión identificados;
- el dominio definitivo supere todas las pruebas de la sección 6.

Registrar la aprobación en un issue o acta sin secretos ni datos personales.
