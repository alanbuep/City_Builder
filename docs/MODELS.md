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
| `meteor` | — | Roca/meteorito incandescente que cae (con estela la hago yo). |
| `crater` | 1×1 | Cráter en el suelo (estado del terreno tras el impacto). |
| `rubble` | 1×1 | Escombros/edificio derrumbado (tras una catástrofe). |
| `building_burnt` | 1×1 | Edificio quemado/ennegrecido (mientras se reconstruye). |

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
