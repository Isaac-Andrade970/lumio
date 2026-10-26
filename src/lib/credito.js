// Cálculos de tarjeta de crédito: períodos de facturación, fecha de pago e interés estimado.
// Todo trabaja con fechas en texto "AAAA-MM-DD", igual que el resto de la app.
import { hoyISO, sumarMeses } from './formato.js'

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

// ¿Este gasto se pagó en varias cuotas?
export function esEnCuotas(mov) {
  return (mov.cuotas ?? 1) > 1
}

// Suma de gastos hechos con una tarjeta entre dos fechas (incluidas).
// Las compras en cuotas NO se suman aquí: se cobran de a poco, como cuotas.
export function gastadoConTarjeta(movimientos, tarjeta, { desde, hasta }) {
  let total = 0
  for (const m of movimientos) {
    if (m.tipo !== 'gasto' || esEnCuotas(m) || !mismaTarjeta(m.medioPago, tarjeta)) continue
    if (m.fecha >= desde && m.fecha <= hasta) total += m.monto
  }
  return total
}

// Interés aproximado de un mes sobre lo que quede sin pagar. tasaMensual en %, por ejemplo 3.2
export function interesEstimado(saldoPendiente, tasaMensual) {
  if (saldoPendiente <= 0 || !tasaMensual) return 0
  return Math.round(saldoPendiente * (tasaMensual / 100))
}

// ---- Cuotas ----
// Una cuota comprometida: { id, tarjeta, descripcion, monto, hasta, desde? }
// "hasta" es el mes ("AAAA-MM") en que pagas la última cuota; "desde", el de la primera (opcional).

// Mes en que se paga la primera cuota de una compra: el estado de cuenta donde cae esa fecha
export function primerMesDePago(fechaCompra, config) {
  const cierre = periodosCredito(fechaCompra, config.diaCierre).actual.hasta // cierre del período de la compra
  return fechaDePago(cierre, config.diaPago).slice(0, 7)
}

// Convierte los gastos en cuotas de esta tarjeta en cuotas comprometidas (se calculan, no se guardan)
export function cuotasDeCompras(movimientos, config) {
  return movimientos
    .filter((m) => m.tipo === 'gasto' && esEnCuotas(m) && mismaTarjeta(m.medioPago, config.nombre))
    .map((m) => {
      const desde = primerMesDePago(m.fecha, config)
      return {
        id: `compra-${m.id}`,
        deCompra: true, // viene de un gasto: se cambia o se quita editando ese gasto
        tarjeta: config.nombre,
        descripcion: m.nota || 'Compra en cuotas',
        monto: m.valorCuota || Math.round(m.monto / m.cuotas),
        desde,
        hasta: sumarMeses(desde, m.cuotas - 1),
      }
    })
}

// Cuántas cuotas quedan desde "mesDesde" hasta "mesHasta", ambos incluidos ('2026-11' a '2027-04' = 6)
export function cuotasRestantes(mesHasta, mesDesde) {
  const [aH, mH] = mesHasta.split('-').map(Number)
  const [aD, mD] = mesDesde.split('-').map(Number)
  return Math.max(0, aH * 12 + mH - (aD * 12 + mD) + 1)
}

// Cuotas de una tarjeta que todavía se cobran en el estado de cuenta que se paga en "mesPago"
export function cuotasVigentes(cuotas, tarjeta, mesPago) {
  return cuotas.filter(
    (c) => mismaTarjeta(c.tarjeta, tarjeta) && (!c.desde || c.desde <= mesPago) && c.hasta >= mesPago,
  )
}

// Cuotas que quedan de una cuota comprometida, contando desde "mesBase" (o desde su primera cuota si es después)
export function restantesDe(cuota, mesBase) {
  const inicio = cuota.desde && cuota.desde > mesBase ? cuota.desde : mesBase
  return cuotasRestantes(cuota.hasta, inicio)
}

function sumarCuotas(lista) {
  return lista.reduce((suma, c) => suma + c.monto, 0)
}

// Cuánto se ha pagado a un estado de cuenta (identificado por su fecha de cierre)
export function pagadoAlEstado(config, cierre) {
  return (config.pagos ?? []).filter((p) => p.periodo === cierre).reduce((suma, p) => suma + p.monto, 0)
}

// Un estado de cuenta completo, identificado por su fecha de cierre.
// Si del estado anterior registraste un pago MENOR al total, lo que faltó pasa a este con interés.
// (Si no registraste ningún pago del anterior, se asume que lo pagaste completo y no se arrastra nada.)
export function estadoDeCuenta(movimientos, config, cuotas, cierre, profundidad = 0) {
  const { actual: periodo, anterior: previo } = periodosCredito(cierre, config.diaCierre)
  const fechaPago = fechaDePago(cierre, config.diaPago)
  const compras = gastadoConTarjeta(movimientos, config.nombre, periodo)
  const cuotasDelMes = sumarCuotas(cuotasVigentes(cuotas, config.nombre, fechaPago.slice(0, 7)))
  const comision = config.comision || 0

  let arrastre = 0
  let interes = 0
  const huboPagoAlAnterior = (config.pagos ?? []).some((p) => p.periodo === previo.hasta)
  if (huboPagoAlAnterior && profundidad < 24) {
    // Función recursiva: el estado anterior también puede traer algo del suyo
    arrastre = estadoDeCuenta(movimientos, config, cuotas, previo.hasta, profundidad + 1).pendiente
    interes = interesEstimado(arrastre, config.tasaMensual)
  }

  const total = compras + cuotasDelMes + comision + arrastre + interes
  const pagadoMonto = pagadoAlEstado(config, cierre)
  // Compatibilidad: antes "Ya lo pagué" solo guardaba la fecha, sin monto -> se toma como pago completo
  const marcadoSinMonto = config.pagadoHasta === cierre && pagadoMonto === 0
  const pendiente = marcadoSinMonto ? 0 : Math.max(total - pagadoMonto, 0)

  return { periodo, fechaPago, compras, cuotas: cuotasDelMes, comision, arrastre, interes, total, pagadoMonto, pendiente }
}

// Todo lo que muestra la sección de crédito, a partir de la configuración de la tarjeta.
// config = { nombre, diaCierre, diaPago, tasaMensual, comision, pagos: [{ periodo, monto, cuenta, momento }] }
export function resumenCredito(movimientos, config, hoy = hoyISO(), cuotasGuardadas = []) {
  const { actual, anterior } = periodosCredito(hoy, config.diaCierre)
  // Cuotas anotadas a mano + compras en cuotas hechas con esta tarjeta
  const cuotas = [...cuotasGuardadas, ...cuotasDeCompras(movimientos, config)]

  const cerrado = estadoDeCuenta(movimientos, config, cuotas, anterior.hasta) // el que se paga ahora
  const enCurso = estadoDeCuenta(movimientos, config, cuotas, actual.hasta) // el próximo (estimado)
  const pagado = cerrado.total > 0 && cerrado.pendiente === 0

  // Lo que falta pagar en cuotas: desde el estado de cuenta pendiente (o el próximo, si ya pagaste)
  const mesBase = (pagado ? enCurso.fechaPago : cerrado.fechaPago).slice(0, 7)
  const deudaCuotas = cuotas
    .filter((c) => mismaTarjeta(c.tarjeta, config.nombre))
    .reduce((suma, c) => suma + c.monto * restantesDe(c, mesBase), 0)

  return {
    periodoAnterior: anterior,
    periodoActual: actual,
    // Estado de cuenta cerrado
    compras: cerrado.compras,
    cuotas: cerrado.cuotas,
    comision: cerrado.comision,
    arrastre: cerrado.arrastre, // lo que no pagaste del estado anterior
    interesArrastre: cerrado.interes,
    aPagar: cerrado.total,
    pagadoMonto: cerrado.pagadoMonto,
    pendiente: cerrado.pendiente,
    fechaPago: cerrado.fechaPago,
    pagado,
    // Estado de cuenta en curso
    usadoActual: enCurso.compras,
    proximaFechaPago: enCurso.fechaPago,
    proximoEstimado: enCurso.total,
    proximoArrastre: enCurso.arrastre + enCurso.interes, // lo que pasa de este estado al próximo
    mesBase,
    deudaCuotas,
    listaCuotas: cuotas.filter((c) => mismaTarjeta(c.tarjeta, config.nombre)), // para mostrarlas
  }
}
