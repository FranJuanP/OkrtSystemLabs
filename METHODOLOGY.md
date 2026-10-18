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
| **UCDP** (Uppsala) | Muertos por violencia organizada: 12 meses y media de 3 años | CC BY 4.0 |
| **ND-GAIN (Notre Dame)** | Vulnerabilidad y preparación climáticas | CC BY-NC-SA 4.0 |
| **FMI · COFER** | Composición por monedas de las reservas oficiales | Reutilización con atribución |
| **Tesoro de EEUU · TIC** | Tenedores extranjeros de deuda estadounidense | Dominio público |
| **OMS · Disease Outbreak News** | Brotes notificados, para el feed de Signal | Reutilización con atribución |
| **Natural Earth** | Centroides de los territorios sin coordenadas de capital | Dominio público |

El trabajo `.github/workflows/datos.yml` las descarga **todos los lunes**,
valida el resultado contra `data/schema/aether-datos.schema.json` y lo
confirma solo si pasa. Se puede reproducir en local con `npm run datos`.

### Conflicto armado: UCDP, por descarga directa

Era el hueco más visible del conjunto, y se notaba en el resultado: antes de
incorporarlo, Ucrania salía en el puesto 57 de 217 e Israel en el 194.

**No se usa la API del UCDP**, que exige un token que hay que pedir por
correo. Se usan sus **descargas directas**, que son CC BY 4.0 y no piden
registro:

| Conjunto | Qué cubre | Cadencia |
|---|---|---|
| **GED Global** | años completos, 1989 hasta el último cerrado | anual |
| **Candidate Events** | el año en curso | mensual |

**Las versiones no están escritas en el código.** Se leen de la página de
descargas en cada ejecución: UCDP publica una versión de GED al año y una de
Candidate al mes, y fijar `ged261` aquí sería garantizar que esto se queda
desfasado sin que nadie se entere.

Tres medidas por país:

- **Muertos en el territorio**, desglosados además por los **tres tipos de
  violencia organizada** que distingue el UCDP (estatal, no estatal y
  unilateral contra civiles), porque el nivel mínimo depende del tipo y no solo
  del total.
- **Muertos en los conflictos en los que el país es parte**, mismo periodo. Ver
  más abajo.
- **Media de los tres últimos años completos** en el territorio, de GED. Junto
  a la primera distingue una violencia reciente de una sostenida: un país puede
  tener un año tranquilo tras una guerra larga, y al revés.

#### Qué periodo es «el periodo»

Esto costó un susto, y conviene contarlo entero.

La idea de partida era una **ventana móvil de 12 meses**, contada hacia atrás
desde la última fecha que trae Candidate y no desde hoy: si el fichero va con un
mes de retraso, «hoy» metería un mes vacío y bajaría el recuento
artificialmente.

El problema es que **Candidate no es acumulativo**. La documentación invita a
leerlo como «el año en curso», pero la versión 26.0.8 trae **2.275 eventos de
seis semanas** —del 31 de julio al 9 de septiembre de 2026—, no de los nueve
meses transcurridos. Cada entrega mensual es un incremento, no el año entero.

Con GED cerrando en el 31 de diciembre de 2025, la ventana de 12 meses quedaba
así:

```
2025-09-09 ────── GED ──────▶ 2025-12-31    3,7 meses con datos
2026-01-01 ─── sin datos ───▶ 2026-07-30    7 meses vacíos
2026-07-31 ─ Candidate ─────▶ 2026-09-09    1,3 meses con datos
```

Cinco meses de cobertura presentados como doce. El efecto es sistemático y de
un solo signo: **16 de los 18 países que se desviaban más del 50 % de su media
de tres años lo hacían a la baja**, entre un −53 % y un −95 %. Rusia aparecía
con 266 muertos, Siria con 173, el Líbano con 127. No se habían calmado: les
faltaban siete meses.

Así que la cifra que se publica es **el máximo entre la ventana de 12 meses y el
último año natural cerrado de GED**, y se publica el bloque **entero** del tramo
que gana —total, desglose por tipo y cifra de parte—, porque mezclar tramos
daría un desglose que no suma su propio total.

Hoy eso significa que **53 de los 217 países** llevan el año 2025 completo y los
164 restantes la ventana. La ficha del país **dice cuál**: «muertos (año 2025)»
frente a «muertos (12 meses)», y el *tooltip* da las dos cifras y el motivo.

Es un arreglo, no una solución elegante. La solución elegante sería una ventana
de 12 meses de verdad, y no la hay mientras el hueco exista: lo único honesto es
publicar el periodo mejor cubierto y **decir cuál es**.

**Un cero es un cero.** Que el UCDP no registre eventos en Noruega es
información, no una laguna, así que los 217 países llevan dato y no solo los
113 que aparecen en sus ficheros.

#### Parte en el conflicto, y no solo sede del conflicto

Contar solo lo que ocurre **dentro** de un país deja fuera la mitad de la
pregunta. Rusia tuvo 4.412 muertos por violencia organizada en su territorio en
2025; en la guerra en la que es parte, 93.823. Israel tuvo 38 en su territorio y
15.271 en los conflictos en los que es parte. Describir a
cualquiera de los dos con la primera cifra sería exacto y, a la vez, falso.

No hace falta ningún criterio propio para medirlo: **GED y Candidate traen los
actores de cada evento**. `side_a` y `side_b` dan los nombres, y `gwnoa` y
`gwnob` el número Gleditsch-Ward del gobierno cuando una de las partes lo es.
Para cada evento de violencia **estatal** (`type_of_violence = 1`) se suma su
estimación de muertos a los gobiernos que aparecen como parte, ocurra donde
ocurra.

Los actores con número Gleditsch-Ward se llaman todos **«Government of X»**, así
que basta leer ese patrón y resolver el nombre del país con la misma tabla que
ya se usa para el resto; no hace falta una tabla nueva de equivalencias.

Con una excepción que apareció al extender el cálculo a los años completos: el
UCDP escribe las **coaliciones en el mismo campo, separadas por comas**. La
invasión de Irak sale como «Government of Australia, Government of United
Kingdom, Government of United States of America». Sin partir esa cadena no
empareja con ningún país y la coalición entera se pierde, así que el campo se
divide por comas y cada trozo se resuelve por separado.

Dos consecuencias que conviene decir en voz alta:

- **No reparte culpas.** Un muerto en Ucrania suma a Ucrania y a Rusia, sin
  dividirse entre los dos. La cifra responde a «en cuánta violencia armada está
  metido este gobierno», no a quién la causó. Para eso haría falta un juicio que
  el dato no contiene.
- **Un territorio sin gobierno codificado sale a cero.** Palestina aparece con 0
  como parte, porque en el conflicto «Israel: Palestine» quien el UCDP codifica
  enfrente de Israel son Hamás y la Yihad Islámica, actores no estatales sin
  número Gleditsch-Ward. No es una laguna del cálculo: es lo que dice el dato, y
  por eso en su ficha la cifra informativa es la del territorio (14.511).

Las dos cifras se guardan **por separado** en `latest.json`
(`conflicto.territorio_12m` y `conflicto.parte_12m`), y la ficha del país las
enseña con su etiqueta. No se suman nunca: sumarlas contaría dos veces los
muertos de una guerra en el propio territorio.

#### Sudán, o por qué «en el territorio» y «como parte» se separan tanto

Es el ejemplo que mejor explica la diferencia entre las dos medidas, y conviene
tenerlo a mano porque a primera vista parece un error del cálculo.

En 2025 el UCDP sitúa **68.210 muertos en Sudán** y solo **6.806** en conflictos
en los que el gobierno sudanés es parte. Desglosado por díada, lo que pasa es
esto:

| tipo | díada | muertos |
|---|---|---|
| 3 · unilateral | SFA – Civilians | 60.748 |
| 1 · estatal | Government of Sudan – SFA | 4.978 |
| 1 · estatal | Government of Sudan – RSF | 1.748 |
| 3 · unilateral | Government of Sudan – Civilians | 348 |
| 3 · unilateral | RSF – Civilians | 176 |

El **89 %** de los muertos son **violencia unilateral contra civiles**, que por
definición del UCDP no es un conflicto estatal y por tanto no tiene partes. La
mayor parte corresponde a la toma de El Fasher de finales de octubre de 2025 y
a las matanzas posteriores.

El emparejamiento funciona: la díada estatal lleva `gwnoa = 625`, Sudán, y sus
muertos se suman al gobierno sudanés como parte. Que la cifra de parte sea mucho
menor **no es un fallo del cruce**: es que casi toda esa violencia no es un
conflicto entre partes.

**SFA** es la *Sudan Founding Alliance*, constituida el 23 de febrero de 2025 e
integrada por las RSF, el SPLM/A-North y grupos de Darfur. Desde entonces el
UCDP deja de codificar a las **RSF como actor independiente** y pasa a usar la
alianza, que es por qué el nombre de la díada cambia a mitad de serie. Está en
las fichas del propio UCDP: <https://ucdp.uu.se/actor/8635> y
<https://ucdp.uu.se/onesided/18623>.

#### Gaza y Cisjordania

El UCDP **no tiene «Palestina» como país**: codifica los eventos por el
territorio donde ocurren y los de Gaza y Cisjordania salen bajo
`country = "Israel"`. Dejarlo así diría que Israel tuvo 27.535 muertos por
violencia organizada en 2023 sin aclarar que la inmensa mayoría son
palestinos muertos en Gaza, y que Palestina tuvo cero. Las dos cosas serían
engañosas.

No hace falta inventar nada para separarlos: **el propio UCDP etiqueta la
provincia** en `adm_1`, y dice «Gaza Strip» y «West Bank». Esos eventos se
asignan a PSE, que es justo lo que el Banco Mundial llama «Ribera Occidental
y Gaza». De los 36.185 muertos que el UCDP sitúa en Israel en 2024-2025,
**36.068 están etiquetados como Gaza o Cisjordania**.

Es la única reasignación que se hace, usa la geografía del propio dato y no
un criterio propio.

#### Citación

La licencia CC BY 4.0 obliga a citar, y la cita aparece también en la página
de metodología:

> Davies, Shawn, Garoun Engström, Therese Pettersson & Magnus Öberg (2024).
> *Organized violence 1989-2023, and the prevalence of organized crime
> groups.* Journal of Peace Research 61(4).
>
> Sundberg, Ralph & Erik Melander (2013). *Introducing the UCDP Georeferenced
> Event Dataset.* Journal of Peace Research 50(4).

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

**Territorios sin coordenadas de capital.** El globo coloca cada marcador en
la capital, que publica el Banco Mundial, y seis territorios no la traen:
Palestina, las Islas del Canal, Curazao, Gibraltar, San Martín y Sint Maarten.
No se dibujaban. Ahora se colocan con el **centroide de su geometría según
Natural Earth** —la pieza de mayor área, para que el punto caiga dentro de
algo real y no entre Cisjordania y Gaza—. Cada país declara en
`origen_coordenadas` si su punto es una capital o un centroide: no son lo
mismo.

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

### Paso 3 · El índice de un país: mitad el conjunto, mitad lo peor

$$\text{índice} = 0{,}5 \times \overline{\text{16 categorías}} \;+\; 0{,}5 \times \overline{\text{las 3 peores}}$$

**Por qué no solo la media.** La media de las 16 esconde justo lo que
importa. Ucrania tenía GEO en 85 y acababa con 53, porque sus otras quince
categorías la arrastraban al centro: un país puede estar en una situación
crítica por un dominio y razonablemente bien en los demás, y promediarlo todo
lo disuelve.

**Por qué no solo lo peor.** Un país con un problema serio y todo lo demás
impecable se leería igual que uno con problemas en todas partes. El conjunto
también dice algo.

Mitad y mitad. Los pesos están en `PESO_CONJUNTO`, `PESO_PEORES` y
`CUANTAS_PEORES`, en un solo sitio, y cada país publica su desglose: cuánto
viene de cada mitad y cuáles son sus tres categorías peores.

Con este cambio el rango del índice pasa de 27–74 a **44–85**.

La media de las 16 usa los pesos de `PESOS_CATEGORIA`.

**Todas las categorías pesan 1, y es una decisión, no un descuido.** Para
poner la economía por encima de los océanos hace falta una fuente que
justifique *cuánto* por encima, y no la hay. Antes que inventar una jerarquía
con aire técnico, se deja explícito que pesan igual y se publica la tabla
para que cambiarla sea un cambio visible en un único sitio del código.

### Paso 4 · Puesto y categoría destacada

El índice sigue siendo una combinación de percentiles, así que **sigue
comprimido**: el rango observado va de 44 a 85, no de 0 a 100. Leer «85» como
«85 de 100 de riesgo posible» sería un error. Por eso cada país lleva además:

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

### Niveles: una clasificación **relativa**

Los niveles no son umbrales fijos: son **tramos de la distribución**.

| Nivel | Qué significa | Países |
|---|---|---|
| **CRÍTICO** | el 5 % con más riesgo | 12 |
| **ALTO** | entre el 5 % y el 20 % | 31 |
| **MEDIO** | entre el 20 % y el 50 % | 71 |
| **BAJO** | la mitad con menos riesgo | 103 |

Antes eran umbrales absolutos heredados del globo (≤35 bajo, ≤55 medio, ≤75
alto, resto crítico). Con el índice comprimido hacia el centro **CRÍTICO no lo
alcanzaba nadie**: la escala decía cuatro niveles teniendo tres.

**Esto cambia lo que significa la etiqueta, y conviene decirlo claro:**
«CRÍTICO» ya no quiere decir «ha superado un listón», quiere decir «está entre
los doce países con más riesgo medido». **Siempre habrá un 5 % en crítico**,
incluso si el mundo entero mejorase; y si el mundo entero empeorase, seguiría
habiendo un 50 % en «bajo». La interfaz lo dice junto a cada nivel.

Dos países con el mismo índice caen siempre en el mismo nivel: la posición se
calcula con cuántos tienen un índice **mayor**, no con el puesto en la lista.
Sin eso, Papua Nueva Guinea y Corea del Norte —ambos con 79— salían uno
CRÍTICO y el otro ALTO porque el corte caía justo entre los dos.

Dónde cae cada corte en puntos de índice se publica en `cortes`, dentro del
propio cálculo, para quien prefiera leerlo como un número.

#### Nivel mínimo por conflicto activo

Una clasificación relativa tiene un punto ciego: un país en guerra cuyos demás
indicadores sean razonables puede acabar en mitad de la tabla. Eso es
literalmente lo que pasaba antes de incorporar al UCDP.

Se parte de **los umbrales del propio UCDP** —1.000 muertos al año es *guerra*,
de 25 a 999 es *conflicto menor*—, que son el estándar del campo desde hace
décadas, y se aplican **según el tipo de violencia**, porque solo la estatal es
guerra en la clasificación del UCDP:

| Muertos en 12 meses | Qué se cuenta | Dónde | Nivel mínimo |
|---|---|---|---|
| **1.000 o más** | violencia estatal (`type_of_violence = 1`) | en el territorio | **CRÍTICO** |
| **1.000 o más** | entre grupos no estatales (`2`) | en el territorio | **ALTO** |
| **1.000 o más** | unilateral contra civiles (`3`) | en el territorio | **ALTO** |
| **1.000 o más** | conflictos estatales en los que es parte | en cualquier parte | **ALTO** |
| **de 25 a 999** | cualquier tipo | en el territorio | **ALTO** |

Gana la regla **más severa** de las que cumple; a igual nivel, la de más
muertos, que es la que mejor lo explica.

El desglose por tipo importa, y no es un detalle teórico: **México** tiene 7.843
muertos en su territorio en 2025, de los que **7.767 son violencia entre grupos
no estatales y 0 estatal**. Con un umbral único sobre el total salía CRÍTICO,
junto a Ucrania y Sudán. Con el desglose sale ALTO, que es lo que dice el dato:
hay una violencia criminal enorme y no una guerra.

Y el mismo criterio explica por qué **Sudán no sube por el umbral**: sus 68.210
muertos son en un 89 % violencia unilateral contra civiles, que da suelo ALTO y
no CRÍTICO. Sudán ya es CRÍTICO por percentil, así que el suelo no cambia nada;
pero si no lo fuese, la etiqueta diría «violencia contra civiles» y no
«guerra», porque eso es lo que mide el dato.

**Es un suelo, no un techo:** si el percentil ya sitúa al país más arriba,
manda el percentil. Y se aplica a la **etiqueta**, no al índice: el número
sigue siendo la combinación de las categorías y se puede seguir explicando
como tal.

Cuando se aplica, la ficha del país lo dice con la cifra —*«nivel elevado por
conflicto activo (UCDP): 89.413 muertos en 2025 (guerra)»*, o *«parte en
conflicto armado activo (UCDP): 15.271 muertos en 2025»*— y muestra además
dónde caería por percentil. Sin eso, un CRÍTICO junto a un índice de 71 no
habría forma de entenderlo.

Con los datos de octubre de 2026 se eleva el nivel de **25 países**, y el
reparto deja de ser exactamente 5/15/30/50 —queda en 20/45/53/99—: los tramos
pasan a ser un mínimo, no una cuota.

#### El ranking va por nivel, no por índice

Desde que el conflicto impone un suelo, ordenar la lista por índice la dejaba
**incoherente consigo misma**: Ucrania, etiquetada CRÍTICO, aparecía por debajo
de una veintena de países etiquetados ALTO, porque su índice (71) es menor que
el de ellos. Y la etiqueta es lo que el usuario lee.

Así que el ranking ordena primero por **nivel final** (CRÍTICO, ALTO, MEDIO,
BAJO) y dentro de cada nivel por índice. Los países cuyo nivel viene del umbral
de conflicto llevan una **↑** junto al nombre, y su *tooltip* da el motivo —el
mismo texto que la ficha—. Sin esa marca, ver a Israel (índice 55) por encima
de países con 70 parecería un error de cálculo.

La barra de cada fila sigue midiendo el **índice**, que es lo que mide: en un
país elevado se ve corta a propósito, y la flecha explica por qué está donde
está.

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

## 4 bis. Velocidad: hacia dónde se mueve cada categoría

El motor usa una «velocidad» por país y categoría para proyectar y para
ajustar la puntuación de las tarjetas. Era **una tabla escrita a mano con
valores para diez países**; los otros 207 usaban los del mundo, de modo que la
velocidad de Nigeria era la misma que la de Noruega.

Ahora se calcula. Para cada indicador que puntúa y que tiene valor anterior:

$$v = \frac{v_1 - v_0}{|v_0|\,(y_1 - y_0)} \times (\text{+1 si sube el riesgo, −1 si lo baja})$$

y la velocidad de la categoría es la **mediana** de las de sus indicadores.

**Mediana y no media** porque basta un indicador que pase de 0,1 a 0,3 para
que un cambio relativo del 200 % domine la media de toda la categoría. La
mediana no se deja arrastrar por un solo denominador pequeño.

Se recorta a ±0,6, que es el rango en el que se movía la tabla anterior y para
el que está calibrada la aritmética del motor. Cada categoría publica **de
cuántos indicadores** sale su velocidad: con cero, es un cero declarado y no
una medición de estabilidad.

**Dos cautelas.** Un hueco de más de diez años entre los dos valores no cuenta
como tendencia: repartir ese cambio por año da un número que parece una
velocidad y no lo es. Y las dimensiones de INFORM y ND-GAIN no traen valor
anterior —vienen de una sola publicación—, así que las categorías que dependen
mucho de ellas tienen velocidades apoyadas en pocos indicadores.

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

## 5 bis. Los otros dos ficheros de datos

Además de los indicadores de riesgo, hay dos conjuntos que se descargan solos
y que conviene no confundir con ellos.

### `data/events.json` — los eventos de Signal

Lo escribe un trabajo cada media hora con las cuatro fuentes de Signal: USGS
(sismos), NASA EONET (eventos naturales abiertos), ReliefWeb (informes
humanitarios) y GDELT (prensa geopolítica). Sirve de respaldo: cuando una
fuente no responde desde el navegador, Signal muestra esta lectura **marcada
como última lectura y con la hora de la descarga**, en lugar de no mostrar
nada.

**ReliefWeb no funciona.** Su API v1, que es la que la página consultaba,
devuelve `410 Gone` («The API version 'v1' has been decommissioned»), y la v2
responde `403` a cualquier *appname* que ReliefWeb no haya aprobado
previamente. La fuente aparece como «fuente retirada», no como «sin
conexión», porque no hay nada que reintentar. Para recuperarla hay que
solicitar un appname en <https://apidoc.reliefweb.int/> y ponerlo en
`URLS.reliefweb`. Mientras tanto, la categoría SALUD del feed se queda sin
fuente: era la única que la alimentaba.

### `data/vector.json` — flujos y saldos financieros

Aquí la distinción que importa es **saldo frente a flujo**:

- Un **saldo** (*stock*) es lo que hay acumulado en un instante: las reservas
  oficiales, la deuda del Tesoro en manos extranjeras.
- Un **flujo** es lo que se mueve en un periodo: las remesas de un año, las
  entradas de inversión directa, las exportaciones.

Se miden en unidades distintas —dólares frente a dólares por año— y **no se
suman ni se comparan**. El diagrama anterior las mezclaba en la misma escala
y calculaba porcentajes «del total» sobre la suma de ambas.

Ahora son seis bloques separados y etiquetados, tres saldos y tres flujos,
cada uno con su periodo y su fuente. Y cada bloque **conserva**: el reparto
se construye como «los N primeros más el resto», y el resto sale *por
diferencia* con el total de la propia fuente, no estimado. Los residuos se
publican en el propio fichero y `tests/vector.mjs` los comprueba.

Dos totales que parecen contradecirse y no lo son: las reservas por país
(17,9 billones, Banco Mundial) y las reservas por moneda (13,2 billones,
COFER) miden cosas distintas —la primera incluye oro y todas las reservas; la
segunda, solo las divisas cuya moneda declara el país tenedor—.

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
