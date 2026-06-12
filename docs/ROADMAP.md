# Roadmap — City Builder

Plan de evolución del juego. Norte estético y de jugabilidad: **SimCity BuildIt**
(mobile) — ciudad viva, colorida, con catástrofes, desbloqueos, progresión y
"momentos épicos" (el héroe, el cohete, el desastre que superás).

Estado base (Hitos 1–25, ya hechos): zonas R/C/I con crecimiento por demanda,
servicios/básicos/bienestar/comida, cadena de materiales con logística, tecnología
por hitos de población, obras con barra de progreso, rascacielos, transporte
público, complejos industriales, terreno (agua/montaña), y **gráficos glTF** con
auto-tiling de calles, resaltado de edificios al hover y **humo** en fábricas/
centrales (sesión de gráficos).

Arquitectura a respetar siempre: `sim/` sin Three.js (testeable en Node, sin
`Math.random`), `render/` para lo visual, `ui/` para DOM. Verificar cada cambio con
`pnpm typecheck` + `pnpm build` + `pnpm dlx tsx scripts/smoke.ts`. Siempre **pnpm**.

---

## Replanteo pedido por el usuario (2026-05-29) — PRIORIDAD

Feedback de juego que reordena lo cercano:

### R1 — Cobertura CUADRADA y más visible ✅ (hecho)
La influencia (servicios/comida/etc.) ahora es un **cuadrado** (distancia de
Chebyshev) en vez de un círculo → se tesela y permite cubrir áreas prolijamente.
El marcador al seleccionar se ve más fuerte (relleno + borde de color).

### R2 — Tamaños → más cobertura
Edificios de distintos tamaños con distinta cobertura: un local 1×1 cubre poco; un
supermercado 2×2 o un shopping 3×3 cubren más. Ya es configurable por `TileDef`
(radio por edificio); falta poblar las variantes y balancear.

### R3 — Sacar la "zona comercial" (y replantear zonas)
La zona comercial genérica no tiene sentido: el comercio ya está repartido en
locales puntuales (kiosco, banco, tienda, comidas…). Plan:
- **Quitar Commercial del menú de zonas** (deja de pintarse). La demanda comercial
  (barra C) pasa a ser la señal de "poné más locales", que se satisfacen ploppeando
  tiendas (sus `shopJobs` cuentan como empleo comercial).
- **Residencial** se vuelve el foco del zoneo, con **estilos/tipos** distintos
  (suburbio/eco/lujo + densidad) — ver Hito 29.
- Decidir si la **industria** sigue siendo zona (con su auto-fusión a fábrica) o
  también pasa a ser solo fábricas ploppables. (A confirmar con el usuario.)
- Compatibilidad: las partidas viejas con zonas C/I siguen funcionando (se cuentan);
  solo no se pintan nuevas.

### R4 — Locales de comida/comercio temáticos y bien identificables
Reemplazar lo genérico por locales con identidad: pizzería, hamburguesería,
panchería, heladería, sushi, panadería, supermercado, tienda de ropa, etc. Cada uno
con su modelo (ver `MODELS.md` §3b). Mecánicamente reusan `shopJobs` + `food`/
`amenity` + tamaño→cobertura; es sobre todo contenido + modelos.

### R5 — Menú de catástrofes reubicado ✅ (hecho)
Se movió al borde izquierdo para no taparse con el HUD/guardado de la derecha.

---

## Fase A — Profundidad de simulación

### Hito 26 — Catástrofes 🌪️🔥☄️ ✅ (hecho)
El feature "estrella" pedido. Lo hago incremental para no romper balance.

> **Estado:** Implementados los 4 tipos (incendio, meteorito, tornado, huracán) en
> `sim/Disasters.ts` (deterministas, `rand` inyectado). En vez de borrar, los
> edificios quedan **dañados** (ruina `building_burnt`, no funcionan) y se
> **REPARAN** pagando (`sim.repair` + botón en el Inspector) o se demuelen. VFX en
> `render/DisasterFx.ts` (meteorito que cae + onda, trompa de tornado, remolino de
> huracán) y **fuego de partículas** real en `render/FireSystem.ts` (reemplazó al
> sprite 🔥). Menú con botones por tipo + azar. Pendiente opcional: refugio
> antidesastres, sacudón de cámara, inundación del huracán.

- **Motor de desastres** (`sim/Disasters.ts`, engine-agnostic): un desastre tiene
  tipo, epicentro, radio, duración y daño/tick. Sin `Math.random` en sim → el
  disparo (cuándo/dónde) lo decide `Game` (browser) o el botón de "provocar".
- **Daño**: las casillas afectadas pasan a `building_burnt` / `rubble` (nuevos
  estados) o bajan de nivel; cortan energía/agua si caen centrales; suben alertas.
- **Tipos** (en orden de implementación):
  1. **Incendio** 🔥 — nace en una casilla (industria sin bomberos, o provocado),
     **se propaga** a vecinos con el tiempo; los bomberos en radio lo apagan más
     rápido. Es el más "sistémico" (propagación + respuesta) → primero.
  2. **Meteorito** ☄️ — impacto puntual: destruye un área, deja `crater`. Efecto
     de caída + onda expansiva.
  3. **Tornado** 🌪️ — se mueve por el mapa en una trayectoria, daña lo que toca.
  4. **Huracán** 🌀 — área grande, viento + inundación temporal en casillas bajas.
- **Respuesta/mitigación**: bomberos (ya existe), nuevo **refugio antidesastres**,
  y más adelante el **héroe** (Hito 28) que frena/mitiga.
- **VFX** (`render/`): partículas para fuego/humo de incendio (reuso `SmokeSystem`
  como base), embudo del tornado, estela del meteorito, sacudón de cámara.
- **UI**: panel/menú de catástrofes (provocar para probar + ¿modo "activadas al
  azar" on/off?), aviso grande (toast) cuando ocurre, contador de daños.
- **Reconstrucción**: las obras ya existen → un edificio dañado se reconstruye con
  una obra (gratis o con descuento). Esto cierra el loop.

### Hito 27 — Ciencia e investigación 🔬 ✅ (primera versión hecha)
Segundo eje de progreso, **paralelo** a la tecnología-por-población actual.

> **Estado:** 4 edificios nuevos (`ResearchLab`, `Observatory`, `SciencePark`,
> `SpaceCenter`) con campo `research` (puntos/mes, requieren energía). La ciencia se
> acumula (`sim.science`) y es una nueva **métrica de tecnología** (`science`): hitos
> "Parque científico" (ciencia ≥ 300) y "Programa espacial → Centro Espacial"
> (≥ 1500). Categoría 🔬 Ciencia en la toolbar, panel de ciencia en el HUD.
> Pendiente (mejora futura): árbol de investigación con NODOS que dan mejoras (no
> solo edificios) — energía limpia, antisísmica, logística — y lanzamiento de cohete.

- **Puntos de investigación (PI)**: edificios científicos generan PI/mes
  (`research_lab`, `science_park`, `observatory`, `space_center`). Universidad
  también aporta.
- **Árbol de investigación** (`sim/Research.ts`): nodos que se compran con PI y
  desbloquean mejoras (no solo edificios): p. ej. "energía limpia" (centrales menos
  contaminantes → menos humo), "mejor logística" (más rango de corralón),
  "ingeniería antisísmica" (menos daño por catástrofe), "transporte eficiente".
- Se integra con la tecnología actual: hoy los desbloqueos son por hito de pop;
  ahora algunos pasan a requerir **investigación** además.
- **Capstone**: `space_center` + lanzamiento de cohete = hito mayor (y posible
  requisito para desbloquear al héroe).
- **UI**: pantalla de árbol científico (nodos, costos en PI, dependencias).

### Hito 28 — El Héroe 🦸 (estilo Superman) ✅ (primera versión hecha)
"Momento épico" desbloqueable.

> **Estado:** 3 edificios (`HeroHQ` 2×2, `HeroBeacon`, `HeroStatue`) en categoría
> 🦸 Héroe, desbloqueados por el hito "El Héroe" (ciencia ≥ 3000). Mientras haya un
> **cuartel sano** (`def.hero`), `sim.hasHero` es true y el héroe **apaga los
> incendios de toda la ciudad** (DisasterSystem.heroActive → supresión global). Si una
> catástrofe daña el cuartel, el héroe desaparece hasta repararlo. Render en
> `render/HeroFx.ts`: `hero_figure` vuela rondando la ciudad y **acude al incendio**
> más cercano. Pendiente (mejora futura): que el beacon sea requisito/invocación,
> cinemática de aparición, y que mitigue también meteorito/tornado.

- **Desbloqueo**: condición fuerte — p. ej. población alta + investigación avanzada
  + construir `hero_hq`. Aparece con una cinemática simple (vuelo + música/toast).
- **Habilidades**: mientras está activo, **mitiga catástrofes** (apaga incendios,
  desvía meteoritos), sube **felicidad** en su radio, atrae turismo.
- **Invocación**: `hero_beacon` (tipo Bati-señal) lo llama cuando hay un desastre.
- **Render**: `hero_figure` volando (interpolación de posición hacia el desastre),
  capa/estela.
- Es contenido "de recompensa" → llega después de tener catástrofes + ciencia.

---

## Fase B — Variedad y personalización

### Hito 29 — Estilos de residencia / distritos 🏘️ ✅ (hecho)
Que la ciudad no sea toda igual (pedido del usuario).

> **Estado:** El residencial tiene un campo `style` (`default/eco/luxury/suburb`),
> NO tipos nuevos. Cada estilo: su escalera de modelos (`res_eco/luxury/suburb_1..3`,
> `residential_1..5` para el estándar) + sesgo en `RES_STYLE` (densidad `capMul`,
> tope `maxLevel`, sensibilidad a la contaminación `pollutionMul`, valor del suelo
> que irradia `landValue`). Estándar = único que llega a rascacielos (5); suburbio
> tope 2 (baja densidad); eco tope 3 + casi inmune a la contaminación; lujo tope 3 +
> alta densidad + irradia mucho valor. En la toolbar la categoría 🏠 Residencial
> tiene las 4 variantes; **arrastrar re-estiliza** barrios existentes gratis (pintar
> distritos). El inspector muestra el estilo. Se guarda/carga.

- **Estilos**: el residencial puede tener estilo `suburb` / `eco` / `luxury`
  (cada uno con su escalera `res_*_1..n`). El estilo es un dato extra del tile o
  del "distrito".
- **Herramienta de distrito**: pintar un área como un estilo; las zonas dentro
  crecen con esos modelos. (Sim igual; cambia el modelo elegido en `CityRenderer`.)
- Cada estilo puede tener un leve sesgo: eco = menos contaminación + un poco menos
  de capacidad; luxury = más valor del suelo + exige más servicios; suburb = baja
  densidad.
- **UI**: selector de estilo en la herramienta de zona residencial.

### Hito 30 — Paisaje y decoración 🌲 ⏳ (en progreso)

> **Hecho:** terreno natural rico en `generateTerrain` — **mar** en un borde con
> costa ondulada, **playas** (nuevo `TerrainKind 'beach'`, arena edificable), **río**
> que desemboca y **montañas** en la esquina lejana del mar. Edificios que exigen
> agua (`needsWater`): **represa hidroeléctrica** y **puerto/terminal de exportación**
> (`City.isNextToWater` + chequeo en `canPlaceSite`). **Energías renovables** (bonus):
> `SolarPlant`/`WindTurbine`/`HydroPlant`, energía limpia SIN contaminación, hito
> "♻️ Energías renovables" (pob ≥ 110).
> **También hecho:** herramienta de **paisaje** (🌳 árboles/🌿 arbustos/🌸 flores/🪨 rocas
> — ploppables instantáneos, sin calle; árbol elige palmera en la playa). **Tráfico
> aéreo** (`render/AirFx.ts`): aviones que despegan de los aeropuertos + dirigible de
> ambiente (procedurales). **Circuito de carreras** 🏁 (atracción 3×3) con **días de
> evento**: cada ~10 meses hay un fin de semana de carreras (renta extra + autos
> dando vueltas, `render/RaceFx.ts`; toast al arrancar).
> **Puentes ✅:** una calle sobre agua se vuelve un **puente** (`bridge_straight`,
> orientado según cruce horizontal/vertical); `terrainAllows` deja poner calles sobre
> agua (no montaña) y el resto solo en tierra/playa. Funcionan como calle normal
> (acceso, tráfico). Pendiente fino: rampas (`bridge_ramp`) en las orillas y puentes
> en curva/cruce (hoy se fuerzan rectos).
> **Pendiente:** modelos lindos de avión/dirigible/auto/circuito/globo (`MODELS.md`
> §0d) y cablear el **globo aerostático**.

#### Hito 30 (resto) — Paisaje y decoración 🌲
- **Herramienta de plantado**: árboles/rocas/arbustos/flores (modelos de MODELS.md)
  como decoración (suben deseabilidad, no dan empleos).
- **Más biomas/terreno**: playa (arena en bordes de agua), bosque, colinas; mejorar
  `generateTerrain` con variedad y quizá un selector de "tipo de mapa".
- **Puentes sobre agua** (estaba diferido): con `bridge_straight` + auto-tiling, la
  calle puede cruzar ríos → resuelve la limitación actual de mapas partidos.
- **Ciclo día/noche** (opcional): luz que rota; ventanas emissive se "prenden" de
  noche. Da mucho a la estética BuildIt.

---

## Fase C — Progresión y meta-juego

### Hito 31 — Niveles de ciudad y recompensas 🏆 ⏳ (en progreso)

> **Hecho:** **Expansión de mapa** (territorio por parcelas con fichas 🗝️ de
> hitos tecnológicos + catástrofes + hitos de población + misiones).
> **Misiones/objetivos** (`sim/Missions.ts`): 14 metas progresivas con premios
> en dinero y fichas, panel 🎯 en el HUD (las próximas 3 con barra), toast al
> cumplir, persisten en el save y son monotónicas (smoke #46).
> **Pendiente:** ¿XP/nivel de ciudad explícito? ¿logros/medallas cosméticos?

- **Nivel de ciudad / XP**: ganás XP por construir, crecer, superar catástrofes.
  Subir de nivel da recompensas (dinero, desbloqueos, slots de expansión).
- **Logros**: medallas por hitos.

### Hito 32 — Economía avanzada y comercio (opcional)
- Comercio entre "ciudades" o con el "mundo" (ampliar exportación actual).
- Impuestos ajustables por tipo de zona; presupuesto por servicio.

---

## Transversal (cuando convenga)
- **Sonido**: ✅ SFX sintetizados con WebAudio (`ui/Sound.ts`: construir, demoler,
  obra lista, desbloqueo, misión, catástrofe, reparar, seleccionar, error) +
  botón 🔊/🔇 persistente en la barra de guardado. Pendiente: música ambiente.
- **Celular**: ✅ controles táctiles (un dedo cámara con 🔍 / pinta con herramienta,
  dos dedos zoom+rotar, tap = acción), UI adaptada a pantalla chica (barra
  horizontal arriba, HUD plegable 📊), PWA instalable con modo offline (`sw.js` +
  manifest) y workflow de deploy a GitHub Pages (`.github/workflows/deploy.yml`).
- **Performance**: si la ciudad crece mucho, instanciar modelos repetidos
  (InstancedMesh) en vez de un mesh por casilla.
- **Cuentas/nube (Fase 2 de guardado)**: solo cuando haya usuarios reales; reusar
  el mismo `SaveData` JSON (Supabase es el candidato).
- **Code-splitting del bundle** (hoy ~700 kB): separar Three/GLTFLoader si molesta.

---

## Orden sugerido de ataque
1. **Hito 26 – Catástrofes** (incendio → meteorito → tornado → huracán). Lo más
   pedido y vistoso; reusa obras (reconstrucción) y `SmokeSystem` (VFX).
2. **Hito 27 – Ciencia** (genera el contexto para el héroe y mejoras anti-desastre).
3. **Hito 28 – Héroe** (recompensa que cierra A).
4. **Hito 29 – Estilos de residencia** y **Hito 30 – Paisaje/puentes** (variedad).
5. **Hito 31 – Niveles/expansión** (meta-juego que le da rejugabilidad).

> Cada Hito se puede partir en pasos chicos y verificables (como veníamos: una
> mecánica → smoke test → seguir). Los modelos 3D nuevos están en `MODELS.md`;
> mientras no estén, uso cubos/partículas de respaldo para no frenar.
