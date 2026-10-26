import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'
import { resumenDelMes } from '../lib/calculos.js'
import { resumenCuentas } from '../lib/cuentas.js'
import { formatearPesos, fechaCorta, hoyISO, mesDe, nombreMes } from '../lib/formato.js'

// Recuadro principal de Inicio: plata disponible en tus cuentas + lo que debes en crédito + resumen del mes
// Las cuentas se configuran en Ajustes (alAjustes abre esa pantalla)
export default function CuentasInicio({ movimientos, alAjustes }) {
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], null) // null = todavía cargando
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const cuotas = useLiveQuery(() => db.cuotas.toArray(), [], [])

  const mes = mesDe(hoyISO())
  const { ingresos, gastos } = resumenDelMes(movimientos, mes)

  if (cuentas === null) return null

  const r = resumenCuentas(cuentas, movimientos, creditos, cuotas)

  return (
    <section className="rounded-3xl bg-teal-700 p-5 text-white">
      {cuentas.length === 0 ? (
        <>
          <p className="text-sm text-teal-100">Configura tus cuentas para ver cuánta plata tienes en cada una.</p>
          <button onClick={alAjustes} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-800">
            Configurar mis cuentas
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-teal-100">Disponible</p>
            <button onClick={alAjustes} className="text-sm font-medium text-teal-100 underline">
              Editar
            </button>
          </div>
          <p className={`text-4xl font-semibold tracking-tight tabular-nums ${r.disponible < 0 ? 'text-amber-200' : ''}`}>
            {formatearPesos(r.disponible)}
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {r.cuentas.map((c) => (
              <li key={c.nombre} className="flex justify-between gap-3">
                <span className="truncate text-teal-100">{c.nombre === 'Efectivo' ? '💵' : '💳'} {c.nombre}</span>
                <span className="shrink-0 font-medium tabular-nums">{formatearPesos(c.saldo)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Tarjetas de crédito: no es plata tuya, es lo que debes */}
      {r.deudas.length > 0 && (
        <ul className="mt-4 space-y-2">
          {r.deudas.map((d) => (
            <li key={d.nombre} className="flex items-center justify-between gap-3 rounded-2xl bg-white/10 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">💳 {d.nombre}</p>
                <p className="text-xs text-teal-100">
                  {d.estimado ? 'Próximo estado (estimado)' : 'Por pagar'} · {fechaCorta(d.fecha)}
                </p>
              </div>
              <span className="shrink-0 font-semibold tabular-nums">{formatearPesos(d.monto)}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Resumen del mes */}
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-teal-100">Ingresos de {nombreMes(mes).split(' ')[0].toLowerCase()}</p>
          <p className="text-lg font-semibold tabular-nums">{formatearPesos(ingresos)}</p>
        </div>
        <div className="rounded-2xl bg-white/10 p-3">
          <p className="text-teal-100">Gastos de {nombreMes(mes).split(' ')[0].toLowerCase()}</p>
          <p className="text-lg font-semibold tabular-nums">{formatearPesos(gastos)}</p>
        </div>
      </div>
    </section>
  )
}
