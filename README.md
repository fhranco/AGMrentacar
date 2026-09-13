# AGM Rent a Car

Sitio web de AGM Rent a Car para cotizaciones y arriendo de vehículos en
Punta Arenas y la Región de Magallanes.

## Sitio y control de calidad

La página principal está en `code.html`. `index.html` dirige automáticamente a
esa página para permitir el despliegue desde la raíz del dominio.

Para instalar y verificar el proyecto de forma reproducible:

```sh
npm ci
npm run verify
```

El paquete de producción se genera únicamente con Turnstile configurado:

```sh
TURNSTILE_SITE_KEY="clave_publica" npm run build
```

Se despliega sólo el contenido de `dist/`, nunca la raíz del repositorio.

## Reservas

El cotizador registra solicitudes en Supabase mediante la Edge Function
`request-quote`. El correo es el canal formal para cotizaciones y
confirmaciones; WhatsApp se utiliza únicamente para soporte.

La arquitectura y la secuencia operativa están documentadas en `SUPABASE.md`.

## Documentación operativa

- `docs/AUDITORIA_PREPRODUCCION.md`: dictamen, controles y bloqueadores.
- `docs/MANUAL_OPERATIVO.md`: despliegue manual, respaldos, restauración,
  cambios multiplataforma y reversión.
- `AGENTS.md`: reglas canónicas para Codex, Antigravity y otras herramientas.
- `SECURITY.md`: tratamiento de secretos e incidentes.
