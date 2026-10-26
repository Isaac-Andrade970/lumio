// Cálculos de tarjeta de crédito: períodos de facturación, fecha de pago e interés estimado.
// Todo trabaja con fechas en texto "AAAA-MM-DD", igual que el resto de la app.
import { hoyISO } from './formato.js'

// Fecha con un día del mes, ajustado si el mes es más corto (día 31 en febrero -> 28 o 29)
function fechaConDia(anio, mes, dia) {
  const ultimoDia = new Date(anio, mes + 1, 0).getDate() // día 0 del mes siguiente = último día de este mes
  return new Date(anio, mes, Math.min(dia, ultimoDia), 12)
}

function aISO(fecha) {
  return hoyISO(fecha)
}

function diaSiguiente(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return aISO(new Date(a, m - 1, d + 1, 12))
}

// Fecha de cierre de un mes dado (mes puede salirse de 0..11, Date lo ajusta)
function cierreDelMes(anio, mes, diaCierre) {
  const base = new Date(anio, mes, 1, 12) // normaliza año y mes
  return aISO(fechaConDia(base.getFullYear(), base.getMonth(), diaCierre))
}

// Devuelve los dos períodos de facturación respecto de "hoy":
//   anterior: el último ya cerrado (es lo que se paga ahora)
//   actual:   el que está en curso (se facturará en el próximo cierre)
// Cada uno es { desde, hasta } con ambas fechas incluidas.
export function periodosCredito(hoy, diaCierre) {
  const [a, m] = hoy.split('-').map(Number)
  let mesCierre = m - 1 // mes (0-11) del próximo cierre
  if (hoy > cierreDelMes(a, mesCierre, diaCierre)) mesCierre += 1 // ya pasó el cierre de este mes

  const cierreActual = cierreDelMes(a, mesCierre, diaCierre)
  const cierreAnterior = cierreDelMes(a, mesCierre - 1, diaCierre)
  const cierreAntesDelAnterior = cierreDelMes(a, mesCierre - 2, diaCierre)

  return {
    actual: { desde: diaSiguiente(cierreAnterior), hasta: cierreActual },
    anterior: { desde: diaSiguiente(cierreAntesDelAnterior), hasta: cierreAnterior },
  }
}

// Fecha de pago del estado de cuenta que cerró en "fechaCierre"
// (el primer "diaPago" que viene después del cierre)
export function fechaDePago(fechaCierre, diaPago) {
  const [a, m] = fechaCierre.split('-').map(Number)
  const mismoMes = aISO(fechaConDia(a, m - 1, diaPago))
  return mismoMes > fechaCierre ? mismoMes : aISO(fechaConDia(a, m, diaPago))
}

// ¿Son la misma tarjeta? Ignora mayúsculas y espacios de más ("crédito banco c " = "Crédito Banco C")
export function mismaTarjeta(a, b) {
  const normalizar = (texto) => (texto ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return normalizar(a) !== '' && normalizar(a) === normalizar(b)
}

// Suma de gastos hechos con una tarjeta entre dos fechas (incluidas)
export function gastadoConTarjeta(movimientos, tarjeta, { desde, hasta }) {
  let total = 0
  for (const m of movimientos) {
    if (m.tipo === 'gasto' && mismaTarjeta(m.medioPago, tarjeta) && m.fecha >= desde && m.fecha <= hasta) total += m.monto
  }
  return total
}

// Interés aproximado de un mes sobre lo que quede sin pagar. tasaMensual en %, por ejemplo 3.2
export function interesEstimado(saldoPendiente, tasaMensual) {
  if (saldoPendiente <= 0 || !tasaMensual) return 0
  return Math.round(saldoPendiente * (tasaMensual / 100))
}

// ---- Cuotas ----
// Una cuota comprometida: { id, tarjeta, descripcion, monto, hasta }
// "hasta" es el mes ("AAAA-MM") en que pagas la última cuota.

// Cuántas cuotas quedan desde "mesDesde" hasta "mesHasta", ambos incluidos ('2026-11' a '2027-04' = 6)
export function cuotasRestantes(mesHasta, mesDesde) {
  const [aH, mH] = mesHasta.split('-').map(Number)
  const [aD, mD] = mesDesde.split('-').map(Number)
  return Math.max(0, aH * 12 + mH - (aD * 12 + mD) + 1)
}

// Cuotas de una tarjeta que todavía se cobran en el estado de cuenta que se paga en "mesPago"
export function cuotasVigentes(cuotas, tarjeta, mesPago) {
  return cuotas.filter((c) => mismaTarjeta(c.tarjeta, tarjeta) && c.hasta >= mesPago)
}

function sumarCuotas(lista) {
  return lista.reduce((suma, c) => suma + c.monto, 0)
}

// Todo lo que muestra la sección de crédito, a partir de la configuración de la tarjeta.
// config = { nombre, diaCierre, diaPago, tasaMensual, comision, pagadoHasta }
export function resumenCredito(movimientos, config, hoy = hoyISO(), cuotas = []) {
  const { actual, anterior } = periodosCredito(hoy, config.diaCierre)
  const comision = config.comision || 0

  // Estado de cuenta ya cerrado
  const fechaPago = fechaDePago(anterior.hasta, config.diaPago)
  const compras = gastadoConTarjeta(movimientos, config.nombre, anterior)
  const cuotasDelEstado = sumarCuotas(cuotasVigentes(cuotas, config.nombre, fechaPago.slice(0, 7)))
  const pagado = config.pagadoHasta === anterior.hasta // se marcó "Ya lo pagué" para este estado de cuenta

  // Próximo estado de cuenta (estimado: puede subir si sigues comprando)
  const proximaFechaPago = fechaDePago(actual.hasta, config.diaPago)
  const usadoActual = gastadoConTarjeta(movimientos, config.nombre, actual)
  const vigentesProximo = cuotasVigentes(cuotas, config.nombre, proximaFechaPago.slice(0, 7))

  // Lo que falta pagar en cuotas: desde el estado de cuenta pendiente (o el próximo, si ya pagaste)
  const mesBase = (pagado ? proximaFechaPago : fechaPago).slice(0, 7)
  const deudaCuotas = cuotas
    .filter((c) => mismaTarjeta(c.tarjeta, config.nombre))
    .reduce((suma, c) => suma + c.monto * cuotasRestantes(c.hasta, mesBase), 0)

  return {
    periodoAnterior: anterior,
    periodoActual: actual,
    compras,
    cuotas: cuotasDelEstado,
    comision,
    aPagar: compras + cuotasDelEstado + comision,
    fechaPago,
    pagado,
    usadoActual,
    proximaFechaPago,
    proximoEstimado: usadoActual + sumarCuotas(vigentesProximo) + comision,
    mesBase,
    deudaCuotas,
  }
}
