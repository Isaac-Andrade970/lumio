import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { resumenCuentas } from '../lib/cuentas.js'
import { resumenCredito, mismaTarjeta, restantesDe } from '../lib/credito.js'
import { formatearPesos, fechaCorta, hoyISO } from '../lib/formato.js'

// Colores de las tarjetas: las cuentas usan degradados morados/azules; el efectivo, verde (como el billete del logo);
// las tarjetas de crédito, morado casi negro para que se note que es deuda
const FONDOS_CUENTA = [
  'linear-gradient(135deg, #a78bfa 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #818cf8 0%, #4338ca 100%)',
  'linear-gradient(135deg, #c084fc 0%, #7e22ce 100%)',
  'linear-gradient(135deg, #60a5fa 0%, #1d4ed8 100%)',
]
const FONDO_EFECTIVO = 'linear-gradient(135deg, #34d399 0%, #047857 100%)'
const FONDO_CREDITO = 'linear-gradient(135deg, #3b2366 0%, #0f0820 100%)'

// Junta tus cuentas y tus tarjetas de crédito en una sola lista de "tarjetas" para la billetera
export function useTarjetas(movimientos) {
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], null) // null = todavía cargando
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const cuotas = useLiveQuery(() => db.cuotas.toArray(), [], [])
  if (cuentas === null) return null

  const hoy = hoyISO()
  const r = resumenCuentas(cuentas, movimientos, creditos, cuotas, hoy)
  let i = 0
  const deCuentas = r.cuentas.map((c) => {
    const efectivo = c.nombre === 'Efectivo'
    return {
      clave: `cuenta-${c.nombre}`,
      nombre: c.nombre,
      tipo: efectivo ? 'Efectivo' : 'Cuenta',
      rotulo: 'Saldo disponible',
      monto: c.saldo,
      fondo: efectivo ? FONDO_EFECTIVO : FONDOS_CUENTA[i++ % FONDOS_CUENTA.length],
    }
  })
  const deCreditos = creditos.map((config, k) => {
    const d = r.deudas[k]
    const resumen = resumenCredito(movimientos, config, hoy, cuotas)
    return {
      clave: `credito-${config.nombre}`,
      nombre: config.nombre,
      tipo: 'Crédito',
      rotulo: d.estimado
        ? d.monto > 0 ? `Próximo estado · ${fechaCorta(d.fecha)}` : 'Sin deuda por ahora'
        : `Por pagar · vence ${fechaCorta(d.fecha)}`,
      monto: d.monto,
      fondo: FONDO_CREDITO,
      credito: resumen,
    }
  })
  return { lista: [...deCuentas, ...deCreditos], disponible: r.disponible, hayCuentas: cuentas.length > 0 }
}

const ASOMA = 44 // cuánto se ve de cada tarjeta de atrás
const ALTO = 172 // alto de una tarjeta

// Tarjetas apiladas como en Wallet: la elegida va adelante y las demás asoman arriba
export function PilaTarjetas({ tarjetas, elegida, alElegir }) {
  const atras = tarjetas.filter((t) => t.clave !== elegida)
  const frente = tarjetas.find((t) => t.clave === elegida) ?? tarjetas[0]
  const orden = frente ? [...atras.filter((t) => t !== frente), frente] : atras

  return (
    <div className="relative" style={{ height: (orden.length - 1) * ASOMA + ALTO }}>
      {/* Se dibujan siempre en el mismo orden (por clave) para que React mueva las tarjetas en vez de recrearlas */}
      {tarjetas.map((t) => {
        const pos = orden.indexOf(t)
        const esFrente = t === frente
        return (
          <button
            key={t.clave}
            onClick={() => alElegir(t.clave)}
            aria-pressed={esFrente}
            aria-label={`Ver ${t.nombre}`}
            className="tarjeta-pila absolute inset-x-0 flex flex-col justify-between rounded-[22px] px-5 py-4 text-left text-white"
            style={{
              top: pos * ASOMA,
              height: ALTO,
              zIndex: pos,
              background: t.fondo,
              boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.2), 0 -8px 22px rgb(15 5 40 / 0.45)',
            }}
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="truncate text-[15px] font-semibold">{t.nombre}</span>
              <span className={`shrink-0 text-[11px] font-semibold tracking-widest uppercase ${t.tipo === 'Crédito' ? 'text-fuchsia-300' : 'text-white/80'}`}>
                {t.tipo}
              </span>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-xs text-white/80">{t.rotulo}</span>
              <span className="text-[28px] font-semibold tracking-tight tabular-nums">{formatearPesos(t.monto)}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

// Datos de la tarjeta elegida: para una cuenta, lo gastado y recibido este mes; para crédito, lo usado y las cuotas
export function datosDeTarjeta(t, movimientos, mes) {
  const ultimos = movimientos
    .filter((m) => mismaTarjeta(m.medioPago, t.nombre) || (m.tipo === 'transferencia' && mismaTarjeta(m.destino, t.nombre)))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0))
    .slice(0, 5)
  if (t.credito) {
    const r = t.credito
    const cuotas = r.listaCuotas
      .map((c) => ({ ...c, quedan: restantesDe(c, r.mesBase) }))
      .filter((c) => c.quedan > 0)
      .sort((a, b) => b.monto - a.monto)
    return {
      datos: [
        { titulo: 'Usado este período', valor: formatearPesos(r.usadoActual) },
        { titulo: 'Deuda en cuotas', valor: formatearPesos(r.deudaCuotas), destacado: r.deudaCuotas > 0 },
      ],
      cuotas,
      ultimos,
    }
  }
  const delMes = movimientos.filter((m) => m.fecha.startsWith(mes))
  const gastado = delMes
    .filter((m) => m.tipo === 'gasto' && mismaTarjeta(m.medioPago, t.nombre))
    .reduce((s, m) => s + m.monto, 0)
  const recibido = delMes
    .filter(
      (m) =>
        (m.tipo === 'ingreso' && mismaTarjeta(m.medioPago, t.nombre)) ||
        (m.tipo === 'transferencia' && mismaTarjeta(m.destino, t.nombre)),
    )
    .reduce((s, m) => s + m.monto, 0)
  return {
    datos: [
      { titulo: 'Gastado este mes', valor: formatearPesos(gastado) },
      { titulo: 'Recibido este mes', valor: formatearPesos(recibido) },
    ],
    ultimos,
  }
}
