# Instrucciones canónicas para agentes

## Alcance

Este repositorio contiene el sitio público y el backend Supabase de AGM Rent a
Car. Antes de editar, leer `README.md`, `docs/MANUAL_OPERATIVO.md`,
`docs/AUDITORIA_PREPRODUCCION.md` y `SUPABASE.md`.

## Fuente de verdad

- `code.html`: fuente editable del sitio.
- `assets/images/`: imágenes propias del despliegue.
- `supabase/migrations/`: historial inmutable del esquema.
- `supabase/functions/request-quote/`: entrada pública de cotizaciones.
- `dist/`: artefacto generado; nunca editar ni versionar.

## Reglas obligatorias

1. No incluir claves secretas, `service_role`, tokens, respaldos ni datos reales
   de clientes en Git, el navegador, capturas o registros.
2. No permitir escrituras anónimas directas a tablas. Toda cotización pública
   pasa por `request-quote`; RLS permanece activado.
3. No modificar una migración que ya fue aplicada. Crear una migración nueva y
   reversible en lo posible.
4. El correo es el canal formal. WhatsApp sólo puede presentarse como soporte.
5. No inventar vehículos, patentes, precios, términos legales ni datos de AGM.
6. No publicar la raíz del repositorio. Sólo se despliega el contenido generado
   en `dist/`.
7. Para cambios de producción: respaldo, rama, revisión, `npm ci`,
   `npm run verify`, despliegue por versión, prueba funcional y registro.
8. No relajar CSP, CORS, RLS, validación, límites o Turnstile sin documentar el
   riesgo y aprobación humana explícita.

## Comandos portables

- Instalar: `npm ci`
- Verificar: `npm run verify`
- Construir producción: definir `TURNSTILE_SITE_KEY` y ejecutar `npm run build`
- Auditar: `npm run audit`
- Respaldar: definir `AGM_BACKUP_DIR` fuera del repositorio y ejecutar
  `npm run backup:supabase`

## Criterio de término

Un cambio no está terminado sólo porque compila. Debe conservar el flujo móvil,
pasar la auditoría, no revelar secretos, respetar el modelo de reservas y dejar
una vía explícita de reversión. Si afecta base de datos, correo, autenticación,
dominio o seguridad, actualizar también el manual y la auditoría.
