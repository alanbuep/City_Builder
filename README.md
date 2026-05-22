# City_Builder

Juego de construcción de ciudades estilo SimCity / Cities: Skylines, hecho con **Three.js + TypeScript + Vite**.

## Cómo correrlo

Requiere [pnpm](https://pnpm.io/).

```bash
pnpm install
pnpm dev        # servidor de desarrollo en http://127.0.0.1:5180/
pnpm build      # build de producción
pnpm typecheck  # chequeo de tipos
```

## Controles

- **Click izquierdo**: construir / seleccionar (según la herramienta)
- **Click derecho**: rotar la cámara
- **Rueda**: zoom · **Click central**: desplazar

## Qué hay

- Zonas **Residencial / Comercial / Industrial** con demanda RCI y crecimiento por niveles.
- **Servicios** (policía, bomberos, gobierno) con cobertura por área y población.
- **Amenidades** (parques, plazas, estadios, museos) que suben el valor del suelo.
- **Carreteras** con niveles y **tráfico**.
- **Demografía** (niños/adultos, empleo/desempleo) y economía con impuestos y mantenimiento.
- Edificios **multi-casilla**, dos modos de juego (Simulación / Constructor).

## Arquitectura

La simulación (`src/sim/`) es independiente del motor gráfico (`src/render/`, Three.js), así
que la lógica del juego se puede probar sin navegador (`pnpm dlx tsx scripts/smoke.ts`).
