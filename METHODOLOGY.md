# Metodología de AETHER

Cómo se obtienen los datos, cómo se calculan las puntuaciones y qué **no** se
puede concluir de ellas.

Este documento existe porque hasta octubre de 2026 no había ninguno. Las
3.264 puntuaciones del panel (204 países × 16 categorías) y las 176 etiquetas
de riesgo del globo estaban escritas a mano, y los 1.600 indicadores que las
acompañaban tampoco tenían origen: había entradas como «Karoshi»,
«Bunkers/hab. 1 de 10» o «Nobeles/cápita alto». Ninguna se podía comprobar y
ninguna se actualizaba.

Lo que hay ahora es más corto y menos espectacular, pero se puede auditar
dato a dato.

---

## 1. De dónde salen los datos

Siete catálogos de cinco instituciones, todos públicos y todos sin clave de acceso. El fichero
`data/latest.json` guarda para **cada** dato su valor, su unidad, su año, la
fuente, el enlace y el momento en que se descargó.

| Fuente | Qué aporta | Licencia |
|---|---|---|
| **Banco Mundial · WDI** | 38 indicadores de desarrollo | CC BY 4.0 |
| **Banco Mundial · WGI** | 5 de gobernanza (estabilidad, estado de derecho, corrupción, eficacia, rendición de cuentas) | CC BY 4.0 |
| **OMS / Banco Mundial · UHC** | Índice de cobertura sanitaria universal | CC BY 4.0 |
| **Comisión Europea · JRC · INFORM Risk** | 11 dimensiones ya normalizadas de 0 a 10, comparables entre países | Reutilización con atribución (Decisión 2011/833/UE) |
| **ND-GAIN (Notre Dame)** | Vulnerabilidad y preparación climáticas | CC BY-NC-SA 4.0 |
| **FMI · COFER** | Composición por monedas de las reservas oficiales | Reutilización con atribución |
| **Tesoro de EEUU · TIC** | Tenedores extranjeros de deuda estadounidense | Dominio público |

El trabajo `.github/workflows/datos.yml` las descarga **todos los lunes**,
valida el resultado contra `data/schema/aether-datos.schema.json` y lo
confirma solo si pasa. Se puede reproducir en local con `npm run datos`.

### Por qué no está ACLED

Se planteó incluirlo, porque es la mejor fuente de datos de conflicto
georreferenciados. Queda fuera por la licencia: su API exige registro con
clave y sus condiciones no permiten redistribuir los datos descargados, que
es exactamente lo que haría este repositorio al publicarlos en una página
pública. Usarlo habría significado incumplir sus términos.

### Territorios sin serie oficial

Taiwán, el Sáhara Occidental y la Guayana Francesa aparecen en el panel y no
tienen datos: no son miembros de las instituciones que publican estas series,
o no se publican por separado. Está anotado en `sin_fuente` dentro del propio
fichero de datos, con el motivo de cada uno.

---

## 2. Los 60 indicadores y su dirección de riesgo

Cada indicador declara si un valor alto significa más riesgo, menos riesgo, o
ninguna de las dos cosas:

- **`mas_riesgo`** — inflación, homicidios, subnutrición, PM2,5.
- **`menos_riesgo`** — esperanza de vida, acceso a electricidad, estado de
  derecho.
- **`ambiguo`** — **se muestra pero no puntúa.**

Los seis ambiguos son el crecimiento de la población, la tasa de fecundidad,
el saldo migratorio, el porcentaje de población urbana, las remesas recibidas
y la producción pesquera.

El motivo es que no tienen una dirección única. 1,1 hijos por mujer es un
problema demográfico; 6,8 también lo es, por razones opuestas. Las remesas
sostienen a millones de hogares y a la vez miden dependencia del exterior.
Asignarles una dirección para que puntuaran habría producido un número de
aspecto técnico y contenido arbitrario, que es justo lo que este trabajo
viene a quitar. Se publican con su valor y su fuente, y se quedan fuera del
cálculo.

---

## 3. Cómo se calcula una puntuación

Todo el cálculo está en `src/core/scoring.js` y se ejecuta en el navegador
sobre `data/latest.json`. No hay puntuaciones precalculadas en ningún sitio.

### Paso 1 · Cada indicador se convierte en un percentil de riesgo

Para un indicador dado, se ordenan todos los países que tienen dato y se
asigna a cada uno su posición en la distribución, de 0 a 100. Si el indicador
declara `menos_riesgo`, el orden se invierte.

Se usa la función de distribución empírica con **media de empates**: un país
que empata con otros tres queda en el centro del tramo que ocupan los cuatro.

**Por qué percentiles y no una normalización lineal al rango.** Los
indicadores no comparten escala. Las patentes de residentes van de 1 a más de
un millón; normalizando al rango, China quedaría en 100 y 190 países por
debajo de 2, con lo que el indicador dejaría de distinguir entre ellos. El
percentil es inmune a los valores extremos.

**Consecuencia del método, que conviene tener presente:** el percentil solo
mira el **orden**. Si todos los países empeoran a la vez, los percentiles no
se mueven. Mide posición relativa, no deterioro absoluto. Y, por lo mismo, el
campo `escala: 'log'` del registro **no influye** en la puntuación: tomar
logaritmos no cambia el orden. Solo sirve para presentar el número.

### Paso 2 · La puntuación de una categoría

Media de los percentiles de sus indicadores disponibles. Un país al que le
falta un indicador se puntúa con los que tiene, y eso se refleja en la
confianza (apartado 4), no en un valor inventado.

Los pesos están en `PESOS_INDICADOR`. Todos valen 1 salvo dos:

| Indicador | Peso | Motivo |
|---|---|---|
| Riesgo INFORM | 2 | Es un índice compuesto: ya agrega amenaza, vulnerabilidad y capacidad de respuesta. |
| Vulnerabilidad climática (ND-GAIN) | 2 | Agrega 36 indicadores. |

Darles el mismo peso que a un dato suelto los diluiría; el doble refleja que
resumen más información.

### Paso 3 · La puntuación de un país

Media de sus 16 categorías, con los pesos de `PESOS_CATEGORIA`.

**Todas las categorías pesan 1, y es una decisión, no un descuido.** Para
poner la economía por encima de los océanos hace falta una fuente que
justifique *cuánto* por encima, y no la hay. Antes que inventar una jerarquía
con aire técnico, se deja explícito que pesan igual y se publica la tabla
para que cambiarla sea un cambio visible en un único sitio del código.

### Paso 4 · Puesto y categoría destacada

La puntuación compuesta es una media de percentiles, y **eso la comprime
hacia el centro**: con 16 categorías el rango real observado va de 27 a 74,
no de 0 a 100. Leer «74» como «74 de 100 de riesgo posible» sería un error.
Por eso cada país lleva además:

- su **puesto** entre los 217 países con puntuación, que sí es interpretable;
- su **categoría destacada**: la de mayor riesgo, que es lo que de verdad
  distingue a Ucrania de Bélgica, porque la media de 16 categorías las
  acerca y el máximo las separa.

Para titular, una categoría necesita **al menos dos indicadores con dato**.
Esta regla se añadió al ver el resultado sin ella: la categoría destacada de
Ucrania salía «salud mental», porque esa categoría tiene un solo indicador
—la tasa de suicidio, de 2021— y un percentil suelto es mucho más extremo
que una media de cuatro. Con la regla sale «geopolítica», que es lo que miden
sus datos: amenaza humana 10 sobre 10 y población desarraigada 10 sobre 10.

### Niveles

| Puntuación | Nivel |
|---|---|
| ≤ 35 | BAJO |
| 36–55 | MEDIO |
| 56–75 | ALTO |
| > 75 | CRÍTICO |

Son los umbrales que ya usaba el globo. Con los datos de octubre de 2026
**ningún país alcanza CRÍTICO**: el máximo compuesto es 74 (Eritrea). Eso no
es un fallo del cálculo, es la compresión descrita arriba. El nivel CRÍTICO
sí aparece en categorías concretas, donde no hay promediado entre dominios.

---

## 4. Confianza

Cada puntuación lleva una etiqueta de confianza, y la interfaz dice **por
qué**, no solo que sea baja. Depende de dos cosas:

- **Cobertura:** cuántos de los indicadores posibles tenían dato.
- **Antigüedad:** la mediana de los años de esos datos.

| Nivel | Condición |
|---|---|
| **alta** | ≥ 80 % de los indicadores y mediana de los últimos 4 años |
| **media** | ≥ 50 % y mediana de los últimos 8 años |
| **baja** | por debajo de eso |

En la primera ejecución: 206 países con confianza alta, 10 media, 1 baja.

---

## 5. Límites de comparabilidad

Esto es lo que un panel de riesgo suele no contar. Diez indicadores llevan
una nota que se muestra junto al dato y que está en el campo `nota` del
registro:

- **Reservas en meses de importaciones** — no es comparable para los miembros
  de una unión monetaria, cuyas reservas guarda el banco central común, ni
  para los emisores de moneda de reserva, que no necesitan acumularlas. Es el
  motivo de que España y Estados Unidos destaquen en FINANZAS.
- **Deuda pública** — es del gobierno *central*, no del conjunto de las
  administraciones. En los países con mucho gasto descentralizado queda por
  debajo de la deuda pública total.
- **Mortalidad por suicidio** — última estimación comparable de la OMS: 2021.
  Depende de la calidad del registro de causas de muerte, que varía mucho.
- **Gini y pobreza** — el año del dato va de 1992 a 2025 según el país,
  porque salen de encuestas de hogares que no se hacen al mismo tiempo en
  todas partes.
- **Emisiones de CO₂ por habitante** — excluyen el uso de la tierra y la
  silvicultura (LULUCF), que en los países con mucha deforestación es una
  parte grande de sus emisiones.
- **Población de 65 años o más** — único indicador que puntúa en DEMO: la
  puntuación de esa categoría es, en la práctica, el percentil de este dato.
- **Deuda externa (% del PNB)** — el Banco Mundial solo la publica para
  países de renta baja y media; falta para los de renta alta, no porque no
  tengan deuda externa.
- **Importación neta de energía** — negativa en los exportadores netos.
- **Producción pesquera** — volumen absoluto, que depende del tamaño del país
  y de su litoral. Por eso no puntúa.

### Años distintos en el mismo mapa

Se toma de cada país **el último valor disponible**, que no es el mismo año
para todos. Un mapa de inflación puede mezclar 2025 con 2021. La alternativa
—usar solo el último año con dato para *todos*— habría dejado fuera a decenas
de países. Se eligió cubrir más países y **publicar el año de cada dato**, que
va en el fichero, en la interfaz y en este documento.

---

## 6. Qué no es esto

- **No es una predicción.** No hay modelo temporal: son los últimos datos
  publicados, ordenados.
- **No mide deterioro absoluto.** Los percentiles miden posición relativa
  (apartado 3).
- **No es una fuente primaria.** Todo viene de las instituciones de la
  tabla, y cada dato enlaza a la suya. Si un número parece raro, el enlace
  lleva al original.
- **No cubre lo que no se mide.** Faltan dominios enteros con datos
  comparables malos o inexistentes: salud mental tiene un indicador,
  bioseguridad no tiene nada sobre laboratorios, y la ciberseguridad no
  aparece porque no hay serie pública comparable entre países.

---

## 7. Reproducirlo

```bash
npm ci
npm run datos            # descarga de los siete catálogos (~2 min)
npm run datos:validar    # valida contra el esquema
```

El resultado debe coincidir con `data/latest.json` salvo en los datos que las
fuentes hayan publicado entre medias. Las instantáneas con fecha
(`data/aether-AAAA-MM-DD.json`) se conservan para poder comparar.

---

*Última revisión de este documento: 17 de octubre de 2026.*
