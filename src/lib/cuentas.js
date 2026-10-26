// Saldo real de tus cuentas (débito, efectivo...).
// Una cuenta: { nombre, saldoInicial, fechaSaldo: 'AAAA-MM-DD', momentoSaldo: 1761000000000 }
// El saldo inicial es lo que tenías cuando lo anotaste; desde ese momento Lumio suma y resta.
import { mismaTarjeta, resumenCredito } from './credito.js'
import { hoyISO } from './formato.js'

// ¿Este movimiento ocurrió después de que anotaste el saldo? (si no, ya estaba incluido en el saldo inicial)
function esPosterior(mov, cuenta) {
  if (mov.fecha > cuenta.fechaSaldo) return true
  return mov.fecha === cuenta.fechaSaldo && (mov.creado ?? 0) > cuenta.momentoSaldo
}

// Saldo actual de una cuenta
// creditos: configuraciones de tarjetas de crédito, con sus pagos [{ monto, cuenta, momento }]
export function saldoDeCuenta(cuenta, movimientos, creditos = []) {
  let saldo = cuenta.saldoInicial
  for (const m of movimientos) {
    if (!mismaTarjeta(m.medioPago, cuenta.nombre) || !esPosterior(m, cuenta)) continue
    saldo += m.tipo === 'ingreso' ? m.monto : -m.monto
  }
  // Pagos de tarjeta de crédito hechos desde esta cuenta
  for (const credito of creditos) {
    for (const pago of credito.pagos ?? []) {
      if (mismaTarjeta(pago.cuenta, cuenta.nombre) && pago.momento > cuenta.momentoSaldo) saldo -= pago.monto
    }
  }
  return saldo
}

// Todo lo que muestra el recuadro de Inicio
export function resumenCuentas(cuentas, movimientos, creditos = [], cuotas = [], hoy = hoyISO()) {
  const conSaldo = cuentas.map((c) => ({ nombre: c.nombre, saldo: saldoDeCuenta(c, movimientos, creditos) }))

  // Cada tarjeta de crédito: lo pendiente del estado de cuenta, o si ya está pagado, lo estimado del próximo
  const deudas = creditos.map((config) => {
    const r = resumenCredito(movimientos, config, hoy, cuotas)
    return r.pendiente > 0
      ? { nombre: config.nombre, monto: r.pendiente, fecha: r.fechaPago, estimado: false }
      : { nombre: config.nombre, monto: r.proximoEstimado, fecha: r.proximaFechaPago, estimado: true }
  })

  return {
    cuentas: conSaldo,
    disponible: conSaldo.reduce((suma, c) => suma + c.saldo, 0),
    deudas,
  }
}
