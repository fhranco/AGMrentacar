# Auditoría de preproducción

Fecha de revisión: 13 de septiembre de 2026  
Alcance: sitio público, flujo de cotización, repositorio, Supabase y despliegue
manual. El sitio de GitHub Pages es una vista previa, no la aprobación final.

## Dictamen actual

**NO PUBLICAR PARA TRÁFICO REAL hasta cerrar todos los bloqueadores.** El código
queda preparado para producir un paquete endurecido, pero deliberadamente
impide construirlo sin la clave pública de Turnstile.

## Controles comprobados

- No se detectaron claves secretas, `service_role`, claves privadas ni tokens de
  GitHub en los archivos versionables.
- Todas las tablas públicas declaradas en la migración tienen RLS activado.
- Los visitantes sólo consultan el catálogo público; las escrituras pasan por
  una Edge Function con privilegios internos.
- CORS tiene una lista explícita de orígenes y rechaza otros orígenes.
- La función limita tamaño, longitud de campos, fechas, frecuencia y valida
  Turnstile del lado servidor cuando se exige.
- Una solicitud pública no sobrescribe los datos de un cliente ya existente.
- La confirmación y el bloqueo de una unidad son transaccionales; PostgreSQL
  impide períodos solapados.
- Las imágenes se sirven localmente y ya no dependen de la web antigua.
- El paquete elimina Tailwind CDN, JavaScript inline y CSS inline; incorpora CSP,
  HSTS, restricción de marcos y políticas de permisos.
- La integración continua instala dependencias bloqueadas y ejecuta la misma
  verificación en Linux con Node 22.

## Bloqueadores de producción

- [ ] Crear Turnstile para los dominios definitivos, cargar su secreto en
  Supabase y activar `TURNSTILE_REQUIRED=true`.
- [ ] Configurar correo transaccional, verificar SPF, DKIM y DMARC del dominio y
  probar recepción, rebote y respuesta. Hoy la solicitud se registra, pero no
  existe confirmación automática por correo.
- [ ] Reemplazar los tres enlaces legales provisionales por documentos aprobados:
  términos, privacidad y coberturas/seguros.
- [ ] Desactivar altas públicas de Supabase Auth; crear únicamente personal
  invitado, con MFA y mínimo privilegio.
- [ ] Cargar y validar inventario real de unidades, mantenciones y reglas de
  cotización. No se deben prometer unidades sólo por mostrar un modelo.
- [ ] Ejecutar un respaldo completo y un ensayo de restauración en un proyecto
  aislado; registrar duración y responsable. En la auditoría de este equipo el
  intento se bloqueó correctamente porque Docker/Podman aún no está instalado.
- [ ] Instalar HTTPS válido, redirección HTTP→HTTPS y verificar encabezados en el
  dominio definitivo.
- [ ] Instalar `deploy/github-actions-quality.yml` como
  `.github/workflows/quality.yml` usando una credencial GitHub con permiso de
  workflows. La credencial actual rechazó correctamente ese cambio.
- [ ] Aprobar la política de conservación y eliminación de datos personales.

## Riesgos residuales aceptables sólo con control

- El código es público en GitHub: la seguridad no puede depender de ocultar
  nombres de tablas o endpoints. Debe depender de RLS, validación y secretos.
- Google Fonts y el mapa de OpenStreetMap son terceros visibles para el
  navegador. Pueden autoalojarse si la política de privacidad lo exige.
- El límite actual es por correo; Turnstile es obligatorio antes de tráfico real
  para reducir automatización distribuida.
- La vista previa de GitHub puede seguir enviando solicitudes mientras su origen
  permanezca autorizado. Retirarlo de CORS al terminar la transición si deja de
  utilizarse como entorno controlado.

## Evidencia repetible

Ejecutar desde la raíz:

```sh
npm ci
npm run verify
```

La salida debe terminar en `AUDITORÍA AUTOMÁTICA: APROBADA`. Esta aprobación
automática no sustituye el cierre humano de los bloqueadores anteriores.
