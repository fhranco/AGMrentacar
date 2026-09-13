# Seguridad

## Reporte privado

No publiques vulnerabilidades, credenciales ni datos de clientes en un issue.
Repórtalos directamente al responsable técnico designado por AGM y limita el
detalle a las personas que resolverán el incidente.

## Secretos

- Sólo la clave publicable de Supabase puede estar en el frontend.
- `service_role`, claves de Turnstile, correo, DNS y servidor se guardan en un
  gestor de contraseñas y como secretos de la plataforma correspondiente.
- Los respaldos se cifran y nunca se guardan en Git ni dentro del directorio web.

## Respuesta a incidente

1. Detener el formulario o volver a la última versión estable.
2. Preservar registros y anotar hora, alcance y versión afectada.
3. Revocar y rotar las credenciales comprometidas.
4. Corregir en una rama, revisar y probar antes de volver a publicar.
5. Evaluar exposición de datos y obligaciones legales con un responsable.
6. Registrar causa, impacto, solución y medida preventiva sin incluir secretos.
