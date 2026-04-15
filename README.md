# ONPE Visual · Perú Elige 2026

Dashboard electoral en vivo de las Elecciones Generales Perú 2026 con datos reales del API de la ONPE.

- 📊 Conteo oficial de actas en tiempo real
- 🗺️ Mapa coroplético por departamento (D3 + TopoJSON) con animación puzzle-piece
- 🎭 Banner de 2da vuelta con countdown dinámico al 7 de junio
- 🚨 Alerta de brecha crítica entre 2° y 3° lugar
- 🇵🇪 Tema claro "Perú" con colores de la bandera
- 🔁 Auto-refresh cada 60s desde la ONPE

## Stack
- React 19 + TypeScript + Vite
- D3.js 7 · TopoJSON · Chart.js
- Playwright (scraper)
- Bun

## Desarrollo

```bash
bun install
bun run scrape        # obtiene datos reales ONPE → public/data/onpe.json
bun run dev           # dev server en http://localhost:5173
```

Para auto-refresh continuo durante el escrutinio:

```bash
bun run scrape:watch  # actualiza cada 60s
```

## Build

```bash
bun run build         # scrape + typecheck + vite build
```

## Estructura

```
src/
├── App.tsx
├── components/           # Hero, MapDept, ProjectionChart, etc.
├── data/
│   ├── candidates.ts     # colores, iniciales, orden
│   ├── mock.ts           # fallback si el scraper no corrió
│   └── source.ts         # fetch /data/onpe.json cada 60s
└── styles/dashboard.css

scripts/
└── scrape-onpe.mjs       # scraper Playwright → public/data/onpe.json

public/
├── candidates/           # fotos (fujimori.jpg, rla.jpg, etc.)
└── data/                 # onpe.json generado
```

## Fotos de candidatos

Colocar archivos `.jpg` cuadrados (300×300+) en `public/candidates/`:
`fujimori.jpg`, `rla.jpg`, `sanchez.jpg`, `nieto.jpg`, `belmont.jpg`.

Si faltan, el avatar cae automáticamente a iniciales.

## Fuente de datos

`https://resultadoelectoral.onpe.gob.pe/presentacion-backend/*`

El scraper hidrata sesión con Playwright, descubre los ubigeos de los 25 departamentos + extranjero, y para cada uno pide totales + participantes vía `tipoFiltro=ubigeo_nivel_01`.
