// Lógica pura (sin pantallas): fácil de probar y de reutilizar si algún día pasas a Expo.
import { mesDe, sumarMeses } from './formato.js'

// Totales de un mes: { ingresos, gastos, saldo }
export function resumenDelMes(movimientos, mesISO) {
  let ingresos = 0
  let gastos = 0
  for (const m of movimientos) {
    if (mesDe(m.fecha) !== mesISO) continue
    if (m.tipo === 'ingreso') ingresos += m.monto
    else gastos += m.monto
  }
  return { ingresos, gastos, saldo: ingresos - gastos }
}

// Gastos del mes agrupados por categoría, de mayor a menor: [{ categoria, total }]
export function gastosPorCategoria(movimientos, mesISO) {
  const totales = {}
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || mesDe(m.fecha) !== mesISO) continue
    totales[m.categoria] = (totales[m.categoria] ?? 0) + m.monto
  }
  return Object.entries(totales)
    .map(([categoria, total]) => ({ categoria, total }))
    .sort((a, b) => b.total - a.total)
}

// Agrupa por día (más reciente primero): [{ fecha, movimientos, totalDia }]
export function agruparPorDia(movimientos) {
  const ordenados = [...movimientos].sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0),
  )
  const grupos = []
  for (const m of ordenados) {
    let grupo = grupos.at(-1)
    if (!grupo || grupo.fecha !== m.fecha) {
      grupo = { fecha: m.fecha, movimientos: [], totalDia: 0 }
      grupos.push(grupo)
    }
    grupo.movimientos.push(m)
    grupo.totalDia += m.tipo === 'ingreso' ? m.monto : -m.monto
  }
  return grupos
}

// Categorías ordenadas por cuántas veces se usaron (las favoritas primero)
export function ordenarPorUso(categorias, movimientos) {
  const usos = {}
  for (const m of movimientos) usos[m.categoria] = (usos[m.categoria] ?? 0) + 1
  return [...categorias].sort((a, b) => (usos[b.id] ?? 0) - (usos[a.id] ?? 0))
}

// Lee datos que vienen en el link, para la futura automatización con Atajos:
// "#nuevo?monto=5990&comercio=Starbucks" -> { monto: 5990, nota: 'Starbucks' }
// Lo que va después de "#" nunca se envía a ningún servidor.
export function leerLinkNuevo(hash) {
  if (!hash.startsWith('#nuevo')) return null
  const params = new URLSearchParams(hash.split('?')[1] ?? '')
  const monto = parseInt(String(params.get('monto') ?? '').replace(/\D/g, ''), 10)
  return {
    monto: Number.isFinite(monto) ? monto : 0,
    nota: params.get('comercio') ?? params.get('nota') ?? '',
    tipo: params.get('tipo') === 'ingreso' ? 'ingreso' : 'gasto',
  }
}

// Proyecta cuánto juntas ahorrando "mensual" pesos durante "meses" meses.
// tasaAnual en %, por ejemplo 4. El interés se capitaliza cada mes (interés compuesto).
// Devuelve { total, aportado, intereses }
export function proyectarAhorro({ mensual, meses, tasaAnual = 0 }) {
  const tasaMensual = tasaAnual / 100 / 12
  let saldo = 0
  for (let mes = 1; mes <= meses; mes++) {
    saldo = saldo * (1 + tasaMensual) + mensual // lo que había crece, y se suma el aporte del mes
  }
  const total = Math.round(saldo)
  const aportado = mensual * meses
  return { total, aportado, intereses: total - aportado }
}

// Ingresos y gastos de los últimos "cantidad" meses, terminando en "mesFin" (el más antiguo primero).
// [{ mes: '2026-05', ingresos, gastos }, ...]
export function resumenUltimosMeses(movimientos, mesFin, cantidad = 6) {
  const meses = []
  for (let i = cantidad - 1; i >= 0; i--) {
    const mes = sumarMeses(mesFin, -i)
    meses.push({ mes, ...resumenDelMes(movimientos, mes) })
  }
  return meses
}

// Variación en % entre dos montos: 120 vs 100 -> 20. Si antes no había nada, devuelve null.
export function variacionPorcentual(actual, anterior) {
  if (!anterior) return null
  return Math.round(((actual - anterior) / anterior) * 100)
}

// Gastos de un mes contando solo hasta cierto día (para comparar meses de forma justa)
export function gastosHastaElDia(movimientos, mesISO, dia) {
  let total = 0
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || mesDe(m.fecha) !== mesISO) continue
    if (Number(m.fecha.slice(8, 10)) <= dia) total += m.monto
  }
  return total
}

// ---- Tarjetas (medio de pago) ----

// Nombre que se muestra cuando un movimiento no tiene medio de pago (por ejemplo, anotados antes de esta función)
export const SIN_TARJETA = 'Sin indicar'

// Con qué se pagó: "Visa Débito", "Efectivo"... o "Sin indicar"
export function tarjetaDe(mov) {
  return mov.medioPago?.trim() || SIN_TARJETA
}

// Lista de tarjetas distintas que aparecen en los movimientos, la más usada primero
export function tarjetasUsadas(movimientos) {
  const usos = {}
  for (const m of movimientos) {
    const nombre = m.medioPago?.trim()
    if (nombre) usos[nombre] = (usos[nombre] ?? 0) + 1
  }
  return Object.keys(usos).sort((a, b) => usos[b] - usos[a])
}

// Gastos del mes agrupados por tarjeta, de mayor a menor: [{ tarjeta, total }]
export function gastosPorTarjeta(movimientos, mesISO) {
  const totales = {}
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || mesDe(m.fecha) !== mesISO) continue
    const tarjeta = tarjetaDe(m)
    totales[tarjeta] = (totales[tarjeta] ?? 0) + m.monto
  }
  return Object.entries(totales)
    .map(([tarjeta, total]) => ({ tarjeta, total }))
    .sort((a, b) => b.total - a.total)
}