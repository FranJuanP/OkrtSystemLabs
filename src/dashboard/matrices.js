/**
 * Saneamiento de las matrices del motor (T27).
 *
 * Dos problemas medidos, no sospechados:
 *
 * ── 1. CORR_MATRIX no era una matriz de correlación ──────────────────────
 *
 * Es simétrica, tiene unos en la diagonal y todos sus valores están en
 * [−1, 1], así que lo parece. Pero una matriz de correlación tiene que ser
 * además **semidefinida positiva**: si no lo es, describe un conjunto de
 * correlaciones que ningún conjunto de variables reales puede tener a la vez.
 * Es como declarar que A y B están correlacionados al 0,9, que B y C al 0,9,
 * y que A y C al 0,0: no existen tres variables así.
 *
 * Su espectro, calculado por Jacobi, tiene **un valor propio negativo:
 * −0,1484**. Los otros quince son positivos. Mientras haya uno negativo,
 * cualquier cálculo que trate la matriz como una correlación —una
 * factorización, una simulación correlada— puede producir varianzas
 * negativas.
 *
 * Se arregla con el método estándar: **recortar el valor propio negativo a
 * cero**, reconstruir la matriz y devolver la diagonal a unos. Eso da la
 * matriz semidefinida positiva más cercana a la original con diagonal
 * unitaria, y es bastante menos invasivo que encogerla hacia la identidad:
 * el encogimiento habría necesitado ε = 0,1292, es decir, acercar un 13 % a
 * cero TODAS las correlaciones.
 *
 * ── 2. RESILIENCE_WEIGHTS sumaba 1,20 ───────────────────────────────────
 *
 * El índice de resiliencia es una media ponderada que se usa como un valor de
 * 0 a 1: `1 − resilience·0,6` amortigua los shocks y `1 − resilience·0,4` los
 * atenúa al llegar. Con pesos que suman 1,20, un país perfecto habría dado
 * 1,20, y el recorte a 0,95 que había al final estaba tapando el problema:
 * el índice llegaba al techo antes de lo debido y todos los países buenos
 * quedaban indistinguibles ahí arriba.
 *
 * Se normalizan dividiendo por su suma. Los pesos **relativos** no cambian
 * —la ciencia sigue pesando nueve veces más que la alimentación—; lo que
 * cambia es que ahora el índice sí vive entre 0 y 1.
 */

/** Cholesky. Devuelve null si la matriz no es definida positiva. */
export function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (s <= 0) return null;
        L[i][j] = Math.sqrt(s);
      } else {
        L[i][j] = s / L[j][j];
      }
    }
  }
  return L;
}

export const esDefinidaPositiva = (A) => cholesky(A) !== null;

/** Simetría, diagonal y rango: lo que una correlación debe cumplir además. */
export function comprobarCorrelacion(A) {
  const n = A.length;
  let asimetricos = 0;
  let fueraDeRango = 0;
  let diagonalMal = 0;
  for (let i = 0; i < n; i++) {
    if (Math.abs(A[i][i] - 1) > 1e-9) diagonalMal++;
    for (let j = 0; j < n; j++) {
      if (Math.abs(A[i][j] - A[j][i]) > 1e-9) asimetricos++;
      if (A[i][j] < -1 || A[i][j] > 1) fueraDeRango++;
    }
  }
  return {
    simetrica: asimetricos === 0,
    diagonalUnos: diagonalMal === 0,
    enRango: fueraDeRango === 0,
    definidaPositiva: esDefinidaPositiva(A),
  };
}

/**
 * Valores y vectores propios de una matriz simétrica, por rotaciones de
 * Jacobi.
 *
 * Son 16×16: Jacobi converge en unas pocas pasadas y no hace falta traer una
 * librería de álgebra lineal para esto. Los vectores propios son las columnas
 * de `vectores`, en el mismo orden que `valores`.
 */
export function jacobiEigen(Ain, pasadas = 100) {
  const n = Ain.length;
  const A = Ain.map((r) => r.slice());
  // V acumula las rotaciones: sus columnas son los vectores propios.
  const V = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));

  for (let pasada = 0; pasada < pasadas; pasada++) {
    let fueraDeDiagonal = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) fueraDeDiagonal += A[i][j] * A[i][j];
    }
    if (fueraDeDiagonal < 1e-22) break;

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-18) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        // A ← Rᵀ A R
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        // V ← V R
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }

  return { valores: A.map((r, i) => r[i]), vectores: V };
}

/**
 * La matriz de correlación válida más cercana: recorta los valores propios
 * negativos, reconstruye y devuelve la diagonal a unos.
 *
 * @returns {{matriz:number[][], cambioMaximo:number, valoresPropios:number[],
 *            recortados:number, minimoOriginal:number, yaEraValida:boolean}}
 */
export function proyectarAPSD(A) {
  const n = A.length;
  const { valores, vectores } = jacobiEigen(A);
  const minimo = Math.min(...valores);

  if (esDefinidaPositiva(A)) {
    return {
      matriz: A.map((f) => f.slice()),
      cambioMaximo: 0,
      valoresPropios: [...valores].sort((a, b) => a - b),
      recortados: 0,
      minimoOriginal: minimo,
      yaEraValida: true,
    };
  }

  // Los negativos se recortan a un épsilon positivo, no a cero exacto, para
  // que Cholesky siga siendo posible en coma flotante.
  const PISO = 1e-8;
  let recortados = 0;
  const limpios = valores.map((v) => {
    if (v >= PISO) return v;
    recortados++;
    return PISO;
  });

  // M' = V · diag(limpios) · Vᵀ
  const M = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += vectores[i][k] * limpios[k] * vectores[j][k];
      M[i][j] = s;
    }
  }

  // Devolver la diagonal a unos: D^(−1/2) M' D^(−1/2). Sin esto la diagonal
  // queda algo por encima de 1 y la matriz deja de ser una correlación por
  // otro motivo distinto del que se acaba de arreglar.
  const d = M.map((fila, i) => 1 / Math.sqrt(fila[i]));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i][j] *= d[i] * d[j];
  }
  // Simetrizar: lo anterior deja diferencias del orden de 1e-16 entre
  // M[i][j] y M[j][i], y Cholesky es sensible a eso.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const m = (M[i][j] + M[j][i]) / 2;
      M[i][j] = m;
      M[j][i] = m;
    }
    M[i][i] = 1;
  }

  let cambioMaximo = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) cambioMaximo = Math.max(cambioMaximo, Math.abs(M[i][j] - A[i][j]));
  }

  return {
    matriz: M,
    cambioMaximo,
    valoresPropios: [...valores].sort((a, b) => a - b),
    recortados,
    minimoOriginal: minimo,
    yaEraValida: false,
  };
}

/** Normaliza un objeto de pesos para que sumen 1, conservando proporciones. */
export function normalizarPesos(pesos) {
  const suma = Object.values(pesos).reduce((a, b) => a + b, 0);
  if (!(suma > 0)) throw new Error('normalizarPesos: los pesos no suman nada positivo');
  const salida = {};
  for (const [k, v] of Object.entries(pesos)) salida[k] = v / suma;
  return { pesos: salida, sumaOriginal: suma };
}
