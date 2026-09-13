# AGM Rent a Car

Sitio web de AGM Rent a Car para cotizaciones y arriendo de vehículos en
Punta Arenas y la Región de Magallanes.

## Sitio

La página principal está en `code.html`. `index.html` dirige automáticamente a
esa página para permitir el despliegue desde la raíz del dominio.

Para verla localmente:

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Luego abre `http://127.0.0.1:4173/`.

## Reservas

El cotizador registra solicitudes en Supabase mediante la Edge Function
`request-quote`. El correo es el canal formal para cotizaciones y
confirmaciones; WhatsApp se utiliza únicamente para soporte.

La arquitectura y la secuencia operativa están documentadas en `SUPABASE.md`.

