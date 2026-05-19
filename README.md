# Vinilo Mío

Landing page y configurador de pedidos para **Vinilo Mío** — discos de vinilo decorativos personalizados, hechos a mano en CDMX.

## Vista previa

![Hero: disco girando sobre fondo negro con el título "Tu historia, en vinilo."](https://raw.githubusercontent.com/matiashidalgo/vinilomio/main/preview.png)

## Características

- **Configurador en 5 pasos** — tamaño, etiqueta personalizada, funda, marco y datos del cliente
- **Vista previa en vivo** — SVG reactivo que refleja cada selección en tiempo real
- **Recibo animado** — desglose de precios con contador animado
- **Carga de imágenes** — foto para la etiqueta (recortada en círculo) y portada de la funda
- **Envío de pedido por correo** — abre el cliente de correo con el resumen completo listo para enviar
- **Exportación a PDF** — ticket de pedido con estética vintage (fondo negro, tipografía crema/dorada)
- **Diseño responsivo** — funciona en móvil y escritorio

## Stack

Vanilla JS · HTML · CSS — sin frameworks, sin dependencias locales.

| Dependencia | Uso | Carga |
|---|---|---|
| [jsPDF 2.5.1](https://github.com/parallax/jsPDF) | Generación de PDF | CDN |
| [html2canvas 1.4.1](https://html2canvas.hertzen.com/) | Snapshot del vinilo para el PDF | CDN |
| Google Fonts | Playfair Display, DM Sans, Unna, Caveat, Courier Prime | CDN |

## Uso local

```bash
# Opción 1 — abrir directamente
open index.html

# Opción 2 — servidor local (necesario para carga de imágenes cross-origin en PDF)
python3 -m http.server 5577
# → http://localhost:5577
```

## Estructura

```
vinilomio/
├── index.html      # Marcado semántico + imports CDN
├── styles.css      # Tokens de diseño, layout, animaciones, responsivo
└── app.js          # Estado, configurador, vista previa, mailto, PDF
```

## Configuración del pedido

Los pedidos se envían a `hg.matias.a@gmail.com` vía `mailto:`. Para cambiar el destinatario, edita la constante `MAILTO` en `app.js`:

```js
const MAILTO = 'hg.matias.a@gmail.com';
```

## Precios

Los precios son configurables desde el objeto `PRICE` en `app.js`:

```js
const PRICE = {
  size:     { "7": 299, "12": 499 },
  qr:       50,
  own:      150,
  sleeve:   { none: 0, basic: 80, designed: 180 },
  sleeveBack: 80,
  framed:   220,
  shipping: { standard: 120, express: 220 },
};
```

---

Hecho con amor · CDMX · [vinilomio.mx](https://www.instagram.com/vinilomio.mx)
