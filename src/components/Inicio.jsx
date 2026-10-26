import { resumenDelMes, gastosPorCategoria } from '../lib/calculos.js'
import { buscarCategoria } from '../lib/categorias.js'
import { formatearPesos, hoyISO, mesDe } from '../lib/formato.js'
import FilaMovimiento from './FilaMovimiento.jsx'
import CuentasInicio from './CuentasInicio.jsx'

// Pantalla de inicio: cuentas, top categorías y últimos movimientos
export default function Inicio({ movimientos, alVerTodo, alCargarEjemplo, alEditar }) {
  const mes = mesDe(hoyISO())
  const { gastos } = resumenDelMes(movimientos, mes)
  const top = gastosPorCategoria(movimientos, mes).slice(0, 3)
  const ultimos = [...movimientos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0))
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* Disponible por cuenta, deuda de crédito y resumen del mes (se ve aunque aún no haya movimientos) */}
      <CuentasInicio movimientos={movimientos} />

      {movimientos.length === 0 && (
        <div className="mt-8 text-center">
          <p className="mb-2 text-5xl" aria-hidden="true">👛</p>
          <h2 className="mb-1 text-lg font-semibold text-stone-900 dark:text-stone-100">Aún no hay movimientos</h2>
          <p className="mb-6 text-stone-500 dark:text-stone-400">Toca el botón + para anotar tu primer gasto.</p>
          <button onClick={alCargarEjemplo} className="text-sm font-medium text-teal-700 underline dark:text-teal-300">
            O carga datos de ejemplo para probar
          </button>
        </div>
      )}

      {/* Dónde se fue la plata */}
      {top.length > 0 && (
        <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
          <h2 className="mb-3 font-semibold text-stone-900 dark:text-stone-100">Donde más gastas este mes</h2>
          <ul className="space-y-3">
            {top.map(({ categoria, total }) => {
              const cat = buscarCategoria(categoria)
              const pct = gastos ? Math.round((total / gastos) * 100) : 0
              return (
                <li key={categoria}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-stone-700 dark:text-stone-300">
                      <span aria-hidden="true">{cat.emoji}</span> {cat.nombre}
                    </span>
                    <span className="tabular-nums text-stone-500 dark:text-stone-400">
                      {formatearPesos(total)} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800">
                    <div className="h-2 rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Últimos movimientos */}
      {ultimos.length > 0 && (
        <section className="rounded-3xl bg-white px-5 pt-4 pb-2 dark:bg-stone-900">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-stone-900 dark:text-stone-100">Últimos movimientos</h2>
            <button onClick={alVerTodo} className="text-sm font-medium text-teal-700 dark:text-teal-300">
              Ver todo
            </button>
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {ultimos.map((m) => (
              <FilaMovimiento key={m.id} mov={m} alEditar={alEditar} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
