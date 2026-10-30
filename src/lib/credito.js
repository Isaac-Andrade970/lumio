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

function diaAnterior(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return aISO(new Date(a, m - 1, d - 1, 12))
}

// Período de facturación que contiene una fecha.
// Si importaste estados de cuenta, se usan sus fechas exactas (el banco las mueve cada mes);
// si no, se calcula con el día de cierre de la configuración.
// periodos: [{ desde, hasta, pagarHasta? }] sacados de los estados de cuenta
function periodoQueContiene(fecha, diaCierre, periodos) {
  const guardado = periodos.find((p) => p.desde <= fecha && fecha <= p.hasta)
  if (guardado) return { desde: guardado.desde, hasta: guardado.hasta }

  const [a, m] = fecha.split('-').map(Number)
  let mesCierre = m - 1 // mes (0-11) del próximo cierre
  if (fecha > cierreDelMes(a, mesCierre, diaCierre)) mesCierre += 1 // ya pasó el cierre de este mes
  let desde = diaSiguiente(cierreDelMes(a, mesCierre - 1, diaCierre))
  let hasta = cierreDelMes(a, mesCierre, diaCierre)
  // Que el período calculado no se monte con uno guardado de al lado
  for (const p of periodos) {
    if (p.hasta >= desde && p.hasta < fecha) desde = diaSiguiente(p.hasta)
    if (p.desde > fecha && p.desde <= hasta) hasta = diaAnterior(p.desde)
  }
  return { desde, hasta }
}

// Devuelve los dos períodos de facturación respecto de "hoy":
//   anterior: el último ya cerrado (es lo que se paga ahora)
//   actual:   el que está en curso (se facturará en el próximo cierre)
// Cada uno es { desde, hasta } con ambas fechas incluidas.
export function periodosCredito(hoy, diaCierre, periodos = []) {
  const actual = periodoQueContiene(hoy, diaCierre, periodos)
  const anterior = periodoQueContiene(diaAnterior(actual.desde), diaCierre, periodos)
  return { actual, anterior }
}

// Fecha de pago del estado de cuenta que cerró en "fechaCierre"
// (la que dice el estado de cuenta si lo importaste; si no, el primer "diaPago" después del cierre)
export function fechaDePago(fechaCierre, diaPago, periodos = []) {
  const guardado = periodos.find((p) => p.hasta === fechaCierre && p.pagarHasta)
  if (guardado) return guardado.pagarHasta
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
  const cierre = periodosCredito(fechaCompra, config.diaCierre, config.periodos).actual.hasta // cierre del período de la compra
  return fechaDePago(cierre, config.diaPago, config.periodos).slice(0, 7)
}

// Convierte los gastos en cuotas de esta tarjeta en cuotas comprometidas (se calculan, no se guardan)
export function cuotasDeCompras(movimientos, config) {
  return movimientos
    .filter((m) => m.tipo === 'gasto' && esEnCuotas(m) && mismaTarjeta(m.medioPago, config.nombre))
    .map((m) => {
      // primeraCuota viene del estado de cuenta (algunos bancos cobran la primera cuota un mes después)
      const desde = m.primeraCuota ?? primerMesDePago(m.fecha, config)
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
  const { actual: periodo, anterior: previo } = periodosCredito(cierre, config.diaCierre, config.periodos)
  const fechaPago = fechaDePago(cierre, config.diaPago, config.periodos)
  const compras = gastadoConTarjeta(movimientos, config.nombre, periodo)
  const cuotasDelMes = sumarCuotas(cuotasVigentes(cuotas, config.nombre, fechaPago.slice(0, 7)))
  const comision = config.comision || 0

  const pagadoMonto = pagadoAlEstado(config, cierre)

  // Si importaste el estado de cuenta de este período, manda lo que dice el banco.
  // Un total negativo es saldo a favor (pagaste de más): no hay nada que pagar.
  const oficial = (config.estados ?? []).find((e) => e.hasta === cierre)
  if (oficial) {
    const totalOficial = Math.max(oficial.total, 0)
    return {
      periodo, fechaPago, compras, cuotas: cuotasDelMes, comision, arrastre: 0, interes: 0,
      total: totalOficial, pagadoMonto, pendiente: Math.max(totalOficial - pagadoMonto, 0),
      oficial: true, saldoFavor: Math.max(-oficial.total, 0),
    }
  }

  // El estado anterior importa si registraste un pago parcial (lo que faltó pasa a este con interés)
  // o si viene de un estado de cuenta importado (puede dejar saldo a favor, que se descuenta de este).
  let arrastre = 0
  let interes = 0
  let favorPrevio = 0
  const huboPagoAlAnterior = (config.pagos ?? []).some((p) => p.periodo === previo.hasta)
  const hayEstadosAntes = (config.estados ?? []).some((e) => e.hasta <= previo.hasta)
  if ((huboPagoAlAnterior || hayEstadosAntes) && profundidad < 24) {
    // Función recursiva: el estado anterior también puede traer algo del suyo
    const anterior = estadoDeCuenta(movimientos, config, cuotas, previo.hasta, profundidad + 1)
    if (huboPagoAlAnterior) {
      arrastre = anterior.pendiente
      interes = interesEstimado(arrastre, config.tasaMensual)
    }
    favorPrevio = anterior.saldoFavor
  }

  const bruto = compras + cuotasDelMes + comision + arrastre + interes
  const total = Math.max(bruto - favorPrevio, 0)
  const saldoFavor = Math.max(favorPrevio - bruto, 0) // lo que sobra del saldo a favor pasa al siguiente
  // Compatibilidad: antes "Ya lo pagué" solo guardaba la fecha, sin monto -> se toma como pago completo
  const marcadoSinMonto = config.pagadoHasta === cierre && pagadoMonto === 0
  const pendiente = marcadoSinMonto ? 0 : Math.max(total - pagadoMonto, 0)

  return { periodo, fechaPago, compras, cuotas: cuotasDelMes, comision, arrastre, interes, total, pagadoMonto, pendiente, oficial: false, saldoFavor, favorAplicado: Math.min(favorPrevio, bruto) }
}

// Todo lo que muestra la sección de crédito, a partir de la configuración de la tarjeta.
// config = { nombre, diaCierre, diaPago, tasaMensual, comision, pagos: [{ periodo, monto, cuenta, momento }] }
export function resumenCredito(movimientos, config, hoy = hoyISO(), cuotasGuardadas = []) {
  const { actual, anterior } = periodosCredito(hoy, config.diaCierre, config.periodos)
  // Cuotas anotadas a mano + compras en cuotas hechas con esta tarjeta
  const cuotas = [...cuotasGuardadas, ...cuotasDeCompras(movimientos, config)]

  const cerrado = estadoDeCuenta(movimientos, config, cuotas, anterior.hasta) // el que se paga ahora
  const enCurso = estadoDeCuenta(movimientos, config, cuotas, actual.hasta) // el próximo (estimado)
  const pagado = (cerrado.total > 0 || cerrado.oficial) && cerrado.pendiente === 0

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
    oficial: cerrado.oficial, // true = los montos vienen del estado de cuenta importado
    saldoFavor: cerrado.saldoFavor, // lo que queda a tu favor después de este estado de cuenta
    favorAplicado: cerrado.favorAplicado ?? 0, // saldo a favor anterior que se descontó de este estado
    estadoOficial: (config.estados ?? []).find((e) => e.hasta === anterior.hasta) ?? null,
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
