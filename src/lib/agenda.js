// Gastos fijos y agenda de "Próximos pagos".
// Un gasto fijo: { id, nombre, monto, dia (1-31), categoria, medioPago }
import { claveComercio } from './reglas.js'
import { hoyISO, mesDe, sumarMeses } from './formato.js'

// Fecha de un día del mes, ajustada si el mes es más corto (día 31 en noviembre -> 30)
export function fechaDelMes(mesISO, dia) {
  const [a, m] = mesISO.split('-').map(Number)
  const ultimo = new Date(a, m, 0).getDate()
  return `${mesISO}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`
}

// ¿Ya pagaste este gasto fijo en el mes? Sí si lo anotaste desde la agenda (fijoId),
// o si hay un gasto del mismo comercio por un monto parecido (±15%), por ejemplo uno que llegó por Wallet.
export function pagadoEnMes(fijo, movimientos, mesISO) {
  const clave = claveComercio(fijo.nombre)
  return movimientos.some((m) => {
    if (m.tipo !== 'gasto' || mesDe(m.fecha) !== mesISO) return false
    if (m.fijoId === fijo.id) return true
    const mismoComercio = clave && claveComercio(m.nota ?? '') === clave
    return mismoComercio && Math.abs(m.monto - fijo.monto) <= fijo.monto * 0.15
  })
}

// Próximo pago de un gasto fijo: este mes si no lo has pagado (aunque ya haya pasado el día: queda "atrasado"),
// o el próximo mes si ya lo pagaste.
export function proximoDeFijo(fijo, movimientos, hoy = hoyISO()) {
  const mes = mesDe(hoy)
  if (!pagadoEnMes(fijo, movimientos, mes)) {
    const fecha = fechaDelMes(mes, fijo.dia)
    return { fecha, atrasado: fecha < hoy }
  }
  return { fecha: fechaDelMes(sumarMeses(mes, 1), fijo.dia), atrasado: false }
}

// Agenda: gastos fijos + pago de cada tarjeta de crédito + cuotas que terminan, ordenados por fecha.
// tarjetas: [{ nombre, resumen }] donde resumen viene de resumenCredito()
export function proximosPagos({ fijos = [], movimientos = [], tarjetas = [], hoy = hoyISO(), dias = 40 }) {
  const limite = sumarDias(hoy, dias)
  const lista = []

  for (const f of fijos) {
    const { fecha, atrasado } = proximoDeFijo(f, movimientos, hoy)
    if (fecha <= limite) {
      lista.push({ clave: `fijo-${f.id}`, tipo: 'fijo', fecha, atrasado, titulo: f.nombre, detalle: f.medioPago || 'Gasto fijo', monto: f.monto, fijo: f })
    }
  }

  for (const { nombre, resumen: r } of tarjetas) {
    if (r.pendiente > 0) {
      lista.push({ clave: `tarjeta-${nombre}`, tipo: 'tarjeta', fecha: r.fechaPago, atrasado: r.fechaPago < hoy, titulo: 'Estado de cuenta', detalle: nombre, monto: r.pendiente })
    } else if (r.proximoEstimado > 0 && r.proximaFechaPago <= limite) {
      lista.push({ clave: `tarjeta-${nombre}`, tipo: 'tarjeta', fecha: r.proximaFechaPago, atrasado: false, titulo: 'Próximo estado (estimado)', detalle: nombre, monto: r.proximoEstimado, estimado: true })
    }
    // Cuotas que se pagan por última vez en el próximo pago: buena noticia, se libera esa plata
    const mesPago = (r.pendiente > 0 ? r.fechaPago : r.proximaFechaPago).slice(0, 7)
    const terminan = r.listaCuotas.filter((c) => c.hasta === mesPago)
    if (terminan.length > 0) {
      lista.push({
        clave: `fin-cuotas-${nombre}`,
        tipo: 'finCuotas',
        fecha: r.pendiente > 0 ? r.fechaPago : r.proximaFechaPago,
        titulo: terminan.length === 1 ? `Última cuota: ${terminan[0].descripcion}` : `Últimas cuotas: ${terminan.map((c) => c.descripcion).join(', ')}`,
        detalle: nombre,
        liberado: terminan.reduce((s, c) => s + c.monto, 0),
        monto: null,
      })
    }
  }

  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

// Cuánto tienes comprometido de aquí a fin de mes: gastos fijos sin pagar + tarjetas que vencen este mes
export function comprometidoDelMes(agenda, hoy = hoyISO()) {
  const mes = mesDe(hoy)
  return agenda.filter((p) => p.monto && mesDe(p.fecha) <= mes).reduce((s, p) => s + p.monto, 0)
}

function sumarDias(fechaISO, dias) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return hoyISO(new Date(a, m - 1, d + dias, 12))
}
