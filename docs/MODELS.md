# Modelos 3D — pendientes y convenciones

Lista de modelos `.glb` para hacer en Blender (en otra sesión). Estilo objetivo:
**SimCity BuildIt** — low-poly, colores vivos y saturados, formas redondeadas y
amigables, sombras suaves. Sin texturas complejas: color plano por material
alcanza (el motor ya ilumina y proyecta sombras).

## Convenciones técnicas (importante para que encajen solos)

- **Formato**: `.glb` (binario, con materiales embebidos). Carpeta `public/models/`.
- **Escala**: no importa el tamaño absoluto. El motor **normaliza** cada modelo a
  una casilla de 1×1 en planta (manteniendo la proporción de alto) y lo apoya en
  el piso. O sea: modelá con las proporciones reales y nosotros lo ajustamos.
- **Footprint (planta)**: un modelo 1×1 ocupa una casilla; uno 2×2 debe estar
  modelado con planta cuadrada para llenar 2×2; 3×3 ídem. Ver la columna "tamaño".
- **Origen / centrado**: centrá el modelo en el origen XZ y apoyalo sobre y=0
  (base en el piso). El motor recentra igual, pero ayuda para previsualizar.
- **Orientación del "frente"**: el frente del edificio mira hacia **−Z (norte)**.
  Así las entradas dan a la calle de forma consistente.
- **Polígonos**: bajo (cientos, no miles). Es un juego de ciudad con muchos a la vez.
- **Chimeneas**: en fábricas/centrales, dejá la cima de la chimenea como el punto
  más alto del modelo — ahí nace el humo (el motor emite desde `boundingBox.max.y`).

### Convención de CALLES (auto-tiling) — para puentes también

El motor elige y **rota** la pieza de calle según los vecinos. Orientación base:
- `road_straight`: corre **norte-sur** (a lo largo de Z).
- `road_corner`: conecta **N + E**.
- `road_tee`: conecta **N + E + S** (le falta el oeste).
- `road_end`: punta abierta hacia el **norte** (conecta solo al sur).
- `road_cross`: las cuatro direcciones.

Los **puentes** deben seguir la MISMA convención que `road_straight` (correr N-S en
su orientación base) para que el sistema los rote igual.

---

## ★★★ PAISAJE COMPLETO DE LA CIUDAD — `landscape.glb` (PRIORIDAD MÁXIMA) ✅ HECHO 🏞️

> **HECHO:** `public/models/landscape.glb` (6.2 MB, ~44k tris, fuente editable en
> `assets-src/landscape.blend`). Heightfield 400×400 (decorado hasta el borde) con:
> meseta jugable 48×48 perfectamente plana en y=0 (pasto verde vivo), **mar+playa
> de arena** al sur (Blender −Y / glTF +Z), **cordillera nevada** al norte (Blender
> +Y / glTF −Z, picos ~60u con roca gris y nieve sólo en cimas), **colinas verdes**
> al este/oeste que suben en los bordes para tapar el horizonte, ~240 **pinos
> low-poly** sembrados en laderas y faldas. Sombreado AO horneado en **vertex-colors**
> (1 material vertex-color para el terreno + material de agua turquesa + material de
> pinos). Plano de agua incluido a y=−0.8 (dejá olas al shader del motor). Sin
> reescalar, sin rotar (convención terreno), origen en (0,0,0). ✅ **Ya wireado en el
> motor**: se carga 1 vez en el origen y oculta el pasto/océano/terreno por-casilla.
>
> **✅ PINOS CORREGIDOS (2026-06-02):** re-exportado. (a) Ya **no salen negros**:
> los pinos van como **objeto separado** dentro del glb con material propio verde
> (`pine_fol`, Metallic 0) y **sin** atributo de vertex-color (antes heredaban el
> negro del terreno al estar unidos). Normales recalculadas hacia afuera. (b) Ya
> **no son gigantes**: bajados a **~1.6–2.8 unidades** de alto (escala variada entre
> árboles), proporcionados a una casa de 1×1.

**Cambio de enfoque.** Dejamos de dibujar el terreno con cubitos por casilla (agua =
cubo azul, montaña = cubo marrón: feo, tipo Minecraft). En su lugar queremos **UN
solo modelo gigante** con TODO el paisaje de la ciudad hecho a mano en Blender —
estilo **SimCity BuildIt**: enorme, con cordillera nevada al fondo, mar que llega
al horizonte, playa, colinas verdes y bosques enmarcando. **Construimos ENCIMA**:
el motor coloca los edificios sobre la zona plana central y se superponen al
paisaje. Que al verlo sea **una locura** — casi realista, buena iluminación, que dé
ganas de jugar solo por mirarlo.

> Este es el **asset estrella**. A diferencia de los edificios (low-poly, cientos de
> tris), acá podés gastar más polígonos (decenas de miles está bien: es UN modelo,
> se carga una vez) y cuidar la iluminación/horneado. Vale la pena que quede hermoso.

### Medidas EXACTAS (críticas — si no, los edificios flotan o se hunden)

El motor centra el modelo en el origen del mundo `(0,0,0)`. La cuadrícula de
construcción es **48×48 casillas de 1 unidad**, centrada en el origen:

- **Zona jugable (meseta plana):** un cuadrado de **48 × 48 unidades**, esquinas en
  **X ∈ [−24, +24]** y **Z ∈ [−24, +24]**. Esta zona tiene que ser **PERFECTAMENTE
  PLANA y a y = 0** (la superficie donde se apoyan los edificios). Ni un bache:
  cualquier relieve acá hace flotar/hundir las construcciones.
- **Pasto de la meseta:** verde césped vivo, plano. Puede tener una sutilísima
  variación de tono (manchas de pasto más claro/oscuro) **pintada en el material o
  vertex-color**, pero la GEOMETRÍA debe ser plana a y=0.
- **Origen / centro:** el centro del cuadro jugable coincide con `(0,0,0)`. Apoyá
  todo de modo que la meseta quede en **y = 0** exacto. (El motor NO reescala este
  modelo: respeta tus unidades 1:1. 1 unidad Blender = 1 casilla = 1 "metro".)
- **Extensión total (paisaje decorativo):** que se extienda MUY lejos para que la
  cámara nunca vea el borde. Apuntá a **~800 × 800 unidades** en total (de −400 a
  +400). Todo lo que esté **fuera del cuadro [−24,+24]** es decorado (no se
  construye ahí): ahí van montañas, mar, colinas, bosque.

### Composición del paisaje (alrededor de la meseta jugable)

Pensalo como una bandeja: la ciudad en el centro, rodeada de naturaleza que sube al
fondo y baja al mar adelante.

| Zona | Dónde | Qué va |
|---|---|---|
| **Meseta ciudad** | X,Z ∈ [−24,+24], y=0, plana | Pasto liso. Acá construye el jugador. |
| **Borde costero (sur, Z ≈ +24)** | una franja del lado +Z | La meseta **baja suave** a una **playa de arena** y luego al **MAR**, que se extiende hasta el horizonte (Z hacia +400). Olas suaves, espuma en la orilla. Azul turquesa lindo. |
| **Cordillera (norte, Z ≈ −24)** | detrás de la ciudad, lado −Z | **Cadena de montañas** que sube de punta a punta, **picos nevados** (blanco arriba, roca gris-marrón, pinos verdes en la base). Alturas variadas, majestuosa. Alto: 40–80 unidades. |
| **Colinas laterales (este/oeste, X ≈ ±24)** | costados | **Colinas verdes onduladas** con manchones de **bosque** (pinos/robles low-poly), algún risco. Enmarcan la ciudad y tapan el horizonte de los lados. |
| **Transiciones** | bordes de la meseta | El pasto plano de la ciudad se funde con suavidad en las colinas/playa (un pequeño talud), para que no haya un escalón duro entre lo plano y lo natural. |

> **Coherencia con el juego (importante):** el motor necesita saber dónde hay MAR
> (para que los puertos pidan agua al lado) y dónde montaña (no se construye). Para
> eso, el **mar y la montaña que toquen el cuadro jugable deben alinearse a la grilla**:
> el agua que entra al cuadro [−24,+24] que ocupe **filas/columnas completas de 1
> unidad** (ej.: las últimas ~6 filas del lado +Z son mar). Así el motor marca esas
> casillas como `water`/`mountain` y todo calza. La parte del mar/montaña que está
> **fuera** del cuadro es puro decorado, libre.

### Estilo, materiales e iluminación (que quede "tremendo")

- **Paleta SimCity BuildIt:** colores vivos y saturados pero armónicos. Césped
  verde primaveral, mar turquesa, arena cálida, roca gris-cálida, nieve blanco-azulada.
- **Low-poly estilizado, no realista-fotográfico:** facetas limpias, formas
  redondeadas y amigables. Pero con suficiente subdivisión en montañas/colinas para
  que se lea el relieve (no cubos).
- **Iluminación HORNEADA recomendada:** como el motor ilumina con su propia luz, lo
  que más sube la calidad es **hornear ambient occlusion / sombras suaves a textura
  o a vertex-color** (grietas de montaña oscuras, base de árboles con sombra, AO en
  los valles). Eso da el look "casi realista, buena iluminación" sin depender del
  engine. Materiales mayormente **color plano + AO horneado**.
- **Agua:** material azul turquesa, leve transparencia/brillo. La animación de olas
  la puedo hacer yo en el motor (shader) si dejás el mar como una superficie limpia;
  o podés hornear un ondulado sutil en la malla.
- **Nieve:** blanca con un toque azulado en sombra; borde irregular donde se mezcla
  con la roca (no una línea recta).
- **Emissive (opcional):** si dejás algún detalle (faros costeros, etc.) marcalo
  emissive para el futuro ciclo día/noche.

### Export

- **Formato:** `.glb` (binario, materiales y texturas embebidas). Va en
  `public/models/landscape.glb`.
- **Escala:** 1 unidad Blender = 1 casilla. **No reescalar al exportar**: aplicá
  transforms (Ctrl+A → All Transforms) para que las medidas sean reales.
- **Origen:** centro del cuadro jugable en `(0,0,0)`, meseta en `y=0`.
- **Optimización:** una sola malla (o pocas) con materiales compartidos; si usás
  muchos árboles, conviene que sean instancias / un mismo material para no inflar.

### Cómo lo conecto en el motor (referencia para mí, futura sesión)

Cuando exista `landscape.glb`: cargarlo UNA vez, posicionarlo en el origen sin
reescalar; **reemplaza** los planos infinitos de pasto + el slab de océano + el
terreno por-casilla. El motor seguirá marcando como `water`/`mountain` las casillas
del cuadro que el paisaje cubre con mar/montaña (alineadas a la grilla, ver nota
arriba), para que puertos y construcción respeten el relieve. La meseta plana hace
que los edificios apoyen perfecto.

> **Superseded:** la ficha **2b (mountain/sea por casilla)** queda OBSOLETA con este
> enfoque — ya no hace falta dibujar cubos de montaña ni de mar sueltos; los reemplaza
> este paisaje único. (Los `tree_*`, `rock_*`, `bush` de la 2) siguen sirviendo como
> decoración que el jugador coloca sobre la meseta.)

---

## YA HECHOS (66 modelos) — referencia de estilo

No hay que rehacerlos; sirven de guía de paleta y proporción.
`residential_1..5`, `commercial_1..3`, `industrial_1..3`,
`road_straight/corner/tee/cross/end`, `factory_s/m/l`,
`office, bank, mall, hotel, park, plaza, museum, stadium, monument, amusement,
police, fire, clinic, school, government, hospital, university, power, water, gas,
cafe, diner, restaurant, cinema, market, casino, kiosk, boutique, pharmacy,
gasstation, dealership, busstop, tramstop, metro, sandpit, cement, brickkiln,
sawmill, steelmill, electronics, buildyard, hardware, export, techco, techpark,
church, library, airport`.

---

## NUEVOS — por prioridad

### 0a) CALLES por nivel (calle → avenida → autopista) — MUY pedido ✅ HECHO (10/10)
Hoy las 3 jerarquías usan el MISMO modelo y solo cambia un poco la altura/color, así
que al mejorar una calle "se ve igual". Quiero un modelo distinto por nivel. El motor
ya está cableado: para una pieza base `X` y un nivel `L` (1 = avenida, 2 = autopista)
busca el archivo **`X_L`**; si no existe, usa la pieza base (calle). O sea, alcanza
con dibujar los que quieras y aparecen solos.

Por cada pieza base (`road_straight`, `road_corner`, `road_tee`, `road_cross`,
`road_end`) — misma orientación/convención que la base:

| archivo | nivel | notas |
|---|---|---|
| `road_straight_1`, `road_corner_1`, `road_tee_1`, `road_cross_1`, `road_end_1` | Avenida | 2 carriles c/lado, líneas centrales, cordón. Un poco más ancha/alta que la calle. |
| `road_straight_2`, `road_corner_2`, `road_tee_2`, `road_cross_2`, `road_end_2` | Autopista | Calzada amplia, separador central, guardarraíl; estética de vía rápida. |

> Mínimo viable para que se note: al menos `road_straight_1/_2` y `road_cross_1/_2`.
> Las esquinas/tees pueden venir después (caen al modelo base mientras tanto).

### 0b) ESCOMBROS / RUINAS de catástrofe — el `building_burnt` actual queda NEGRO ✅ HECHO (building_burnt rehecho + _2 + _3)
Cuando una catástrofe (incendio/meteorito/tornado/huracán) golpea un edificio, queda
como **ruina reparable** y se muestra `building_burnt`. El actual se ve casi negro y
feo. Quiero ruinas que se lean como **escombros**: muros derrumbados, vigas, polvo,
gris-marrón claro con tiznado (NO un bloque negro). El motor escala el de 1×1 al
footprint, pero para que no se estire quiero variantes por tamaño:

| archivo | tamaño | notas |
|---|---|---|
| `building_burnt` | 1×1 | **Rehacer**: escombros low-poly (cascotes, una pared a medio caer, vigas), gris-marrón claro algo tiznado. Reparable, no "quemado total negro". |
| `building_burnt_2` | 2×2 | Ruina para edificios 2×2 (el motor usa `building_burnt_N` si existe; si no, escala el 1×1). |
| `building_burnt_3` | 3×3 | Ruina para edificios 3×3. |
| `rubble` (ya existe) | 1×1 | Pila de escombros sueltos. *Opcional:* si querés, lo uso como decoración/cascotes extra alrededor de la ruina. |

### 0c) Energías renovables (YA están en el juego con cubo de respaldo) ✅ HECHO (solar, wind, hydro)
Funcionan ya (energía limpia, sin humo); les falta el modelo lindo. El motor las
carga en silencio: apenas existan los `.glb`, aparecen.
| archivo | tamaño | notas |
|---|---|---|
| `solar` | 2×2 | Campo de paneles solares (bajo, azulado). |
| `wind` | 1×1 | Aerogenerador alto (torre blanca + aspas). |
| `hydro` | 2×2 | Represa hidroeléctrica (muro de cemento; va junto al agua). |

### 0d) Aire y espectáculo (YA funcionan con geometría procedural)
Aviones, dirigible, circuito y autos de carrera **ya andan** con formas low-poly
hechas en código. Estos modelos son OPCIONALES y los reemplazan por algo lindo
apenas existan. Convención: "frente" hacia −Z.
| archivo | estado | notas |
|---|---|---|
| `race_track` | ✅ HECHO | Circuito 3×3 (atracción). Carga en silencio: aparece apenas lo dibujes. |
| `race_car` | procedural | Auto de carrera (hoy es un autito de cajas; da vueltas en los días de evento). |
| `plane` | procedural | Avión (hoy fuselaje+alas de cajas; despega del aeropuerto y cruza el cielo). |
| `blimp` | procedural | Dirigible (hoy elipsoide+góndola; ronda lento la ciudad). |
| `balloon` | ✅ HECHO + cableado | Globo aerostático: aparece cuando la ciudad tiene gente (turismo), deriva lento y sube/baja. |

> Ya implementado: el aeropuerto emite aviones; el circuito hace "días de evento"
> con autos dando vueltas y renta extra; el dirigible es ambiente permanente.

### 0e) Tráfico urbano y peatones (YA funcionan con cajas instanciadas) 🚗🚶
`render/TrafficFx.ts` hace circular autitos por las calles (mano derecha, doblan
en los cruces) y peatones por las veredas, con InstancedMesh (un draw call por
tipo). Hoy son CAJAS de colores; con modelos low-poly quedaría BuildIt total.
**OJO**: como van instanciados, ideal UN solo mesh con pocos vértices (<300) y
material simple (vertex colors o un único color — el motor pinta cada instancia
con `setColorAt`, así que conviene modelarlos en GRIS CLARO neutro para teñirlos).
Convención: "frente" hacia +X, apoyados en y=0, largo del auto ≈ 0.34 (la casilla mide 1).
| archivo | estado | notas |
|---|---|---|
| `car_small` | procedural (cajas) | Autito genérico (sedán/hatch redondeadito). Se tiñe por instancia: modelar en gris claro. |
| `person` | procedural (cajas) | Peatón low-poly (cápsula con cabeza basta). También teñido por instancia. |

### 1) Puentes y cruces de agua (desbloquea construir cruzando ríos)
| archivo | tamaño | notas |
|---|---|---|
| `bridge_straight` | 1×1 | Puente plano sobre agua. Corre N-S (como road_straight). Pilares cortos a los lados. |
| `bridge_ramp` | 1×1 | Rampa de subida del nivel del suelo al puente (opcional, queda más prolijo). |

### 2) Paisaje / naturaleza (decoración, "más paisajes")
Modelos chicos, varios por casilla está bien (el motor puede repartirlos).
| archivo | tamaño | notas |
|---|---|---|
| `tree_pine` | <1×1 | Pino low-poly. Para zonas frías/montaña. |
| `tree_oak` | <1×1 | Árbol frondoso redondeado. |
| `tree_palm` | <1×1 | Palmera. Para costa/playa. |
| `rock_small` / `rock_large` | <1×1 | Rocas para montaña y bordes. |
| `bush` | <1×1 | Arbusto/matorral. |
| `beach_sand` | 1×1 | Casilla de arena (borde de agua → playa). |
| `flowers` | <1×1 | Cantero decorativo. |

### 2b) ~~TERRENO: montaña y agua por casilla~~ — ⛔ OBSOLETO (lo reemplaza `landscape.glb`, ver sección ★★★ arriba) 🏔️🌊
Hoy el terreno se dibuja con CUBOS de color: el agua es un cubo azul plano (feo,
tipo Minecraft) y la montaña un cubo marrón (los "bloques de la esquina" que viste
son eso: montañas). La **playa ya usa `beach_sand`** ✅. Faltan estos dos, que el
motor cargará en silencio apenas existan (convención: ocupan 1×1, base en y=0):

| archivo | tamaño | notas |
|---|---|---|
| `mountain` | 1×1 | **Montaña/cerro** low-poly con **zonas de NIEVE en el pico** (blanco arriba, roca gris-marrón abajo, algo de verde en la base). El motor la escala ×1.5, la rota y la repite **de punta a punta** para formar la cordillera, con picos de distinta altura — así que con 1 modelo lindo alcanza. Que se vea como relieve, NO un cubo. |
| `sea` | 1×1 | **Superficie de mar/agua**: plano casi a ras del suelo (altura ~0.06), azul lindo, con leve ondulado/biselado en los bordes para que no se vea como cubos pegados. (Lo uso para el mar Y los ríos.) Si querés, una versión con espuma en el borde costero queda genial pero es opcional. |

> Cuando estén, los conecto igual que `beach_sand` (mapa `TERRAIN_MODEL` en
> `CityRenderer`): `mountain → mountain.glb`, `water → sea.glb`.

### 2c) Barcos (tráfico de agua — próximo) 🚢⛴️
Cuando esté el agua linda, agregamos barcos que navegan el mar/ríos (ambiente +
los de contenedores ligados al puerto). Animación mía (como aviones/autos); los
modelos van a falta. Convención: "frente" hacia +Z (como aviones/autos).
| archivo | notas |
|---|---|
| `boat` | Barquito/lancha de paseo (ambiente, navega el mar). |
| `cargo_ship` | Barco de contenedores (sale del puerto/terminal, navega cargado). |
| `sailboat` | Velero (opcional, ambiente costero). |

### 3) Estilos de residencia (zonas con onda distinta)
Cada estilo es una escalera de niveles (como `residential_1..5`). Empezamos con 3
estilos; el jugador "pinta" un barrio con un estilo.
| archivo | tamaño | notas |
|---|---|---|
| `res_suburb_1..3` | 1×1 | Casas bajas con jardín, estilo suburbio. |
| `res_eco_1..3` | 1×1 | Verde, techos con paneles solares, mucha vegetación. |
| `res_luxury_1..3` | 1×1 | Torres de vidrio premium, pileta, moderno. |
| (futuro) `res_downtown_1..5` | 1×1 | Bloques densos de centro urbano. |

### 3b) Locales comerciales / comida temática (reemplazan la "zona comercial")
La zona comercial genérica se elimina: el comercio se arma con **locales puntuales
bien identificables** que el jugador coloca. Cada uno con su modelo distintivo.
| archivo | tamaño | notas |
|---|---|---|
| `pizzeria` | 1×1 | Cartel de pizza, horno. Comida. |
| `burger` | 1×1 | Hamburguesería estilo fast-food. Comida. |
| `hotdog` | 1×1 | Panchería / carrito-local. Comida. |
| `icecream` | 1×1 | Heladería, colores pastel. Comida. |
| `sushi` | 1×1 | Local de sushi. Comida (premium). |
| `bakery` | 1×1 | Panadería. Comida. |
| `coffee` | 1×1 | Cafetería (alternativa al café actual). Comida. |
| `supermarket` | 2×2 | Supermercado grande (más cobertura de comida). |
| `clothing` | 1×1 | Tienda de ropa. Comercio. |
| `electronics_store` | 1×1 | Local de electrónica. Comercio. |
| `bookstore` | 1×1 | Librería comercial. Comercio. |
| `furniture` | 2×2 | Mueblería (grande, más empleos). Comercio. |
| `shopping_center` | 3×3 | Centro comercial grande (mucho empleo + cobertura). |

> Idea de diseño: edificios **más grandes = más cobertura/empleo** (un supermercado
> 2×2 cubre más que una panadería 1×1; un shopping 3×3 cubre un barrio entero).

### 4) Ciencia e investigación (nuevo árbol de progreso)
| archivo | tamaño | notas |
|---|---|---|
| `research_lab` | 1×1 | Laboratorio pequeño, antena/parabólica. |
| `science_park` | 2×2 | Campus de I+D, edificios de vidrio + verde. |
| `observatory` | 1×1 | Cúpula de observatorio. |
| `space_center` | 3×3 | Centro espacial con torre de lanzamiento (capstone científico). |
| `rocket` | — | Cohete (efecto de lanzamiento; puede ser pieza aparte animable). |

### 5) Superhéroe (desbloqueo especial, estilo Superman)
| archivo | tamaño | notas |
|---|---|---|
| `hero_hq` | 2×2 | Cuartel del héroe (tipo "Salón de la Justicia"), emblema al frente. |
| `hero_statue` | 1×1 | Estatua del héroe (monumento que sube felicidad). |
| `hero_beacon` | 1×1 | Faro/señal para invocarlo (tipo Bati-señal). |
| `hero_figure` | — | El héroe en sí (figura voladora, capa). Pose de vuelo. Bajo poly. |

### 6) Catástrofes — modelos de apoyo
La mayoría de las catástrofes son **efectos de partículas** (no necesitan modelo):
tornado, huracán, fuego, humo de incendio → los hago con shaders/partículas.
Sí necesito estos modelos:
| archivo | tamaño | notas |
|---|---|---|
| `meteor` | — | Roca/meteorito incandescente que cae (con estela la hago yo). ✅ HECHO, ya se usa. |
| `crater` | 1×1 | Cráter en el suelo. (Por ahora NO se usa: el edificio dañado queda como ruina reparable, no como cráter.) |
| `rubble` | 1×1 | Escombros sueltos. (Por ahora NO se usa, ver `building_burnt`.) |
| `building_burnt` | 1×1 | **Ruina genérica**: se muestra sobre CUALQUIER edificio dañado por una catástrofe (incendio/meteorito/tornado/huracán) hasta que se repara. ✅ Ya se usa, escalado al footprint. *Mejora opcional:* variantes `building_burnt_2` (2×2) y `building_burnt_3` (3×3) para que las ruinas grandes no se vean estiradas. |

### 7) Emergencias (respuesta a catástrofes)
| archivo | tamaño | notas |
|---|---|---|
| `disaster_shelter` | 1×1 | Refugio antidesastres (reduce daños/víctimas en el radio). |
| (reusar `fire` ya hecho) | | La estación de bomberos combate incendios. |

---

## Notas para el modelado
- Mantené una **paleta común** entre estilos (que un barrio eco y uno lujo se
  noten distintos pero pertenezcan a la misma ciudad).
- Para edificios 2×2 y 3×3, modelá pensando que se ven **desde arriba en ángulo**
  (cámara isométrica/orbital), así que el techo importa.
- Si un modelo tiene partes que deberían "prenderse" de noche (ventanas), podés
  marcarlas con un material **emissive** — más adelante agrego ciclo día/noche.
