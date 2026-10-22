// Lógica pura (sin pantallas): fácil de probar y de reutilizar si algún día pasas a Expo.
import { mesDe } from './formato.js'

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
