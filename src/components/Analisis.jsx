import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { gastosPorCategoria, resumenUltimosMeses, gastosHastaElDia, variacionPorcentual, gastosPorTarjeta } from '../lib/calculos.js'
import { buscarCategoria } from '../lib/categorias.js'
import SeccionCredito from './SeccionCredito.jsx'
import { formatearPesos, hoyISO, mesDe, sumarMeses, nombreMes, nombreMesCorto } from '../lib/formato.js'

// Un color por puesto: la categoría donde más gastas usa el primero, y así sucesivamente
const COLORES = ['#0f766e', '#f59e0b', '#6366f1', '#ec4899', '#14b8a6', '#84cc16', '#0ea5e9', '#f97316', '#a855f7', '#78716c']

// Pantalla de análisis: torta por categoría, barras por mes y comparación con el mes anterior
export default function Analisis({ movimientos }) {
  const hoy = hoyISO()
  const mes = mesDe(hoy)
  const mesAnterior = sumarMeses(mes, -1)
  const diaDeHoy = Number(hoy.slice(8, 10))

  // Todo son valores calculados a partir de "movimientos"
  const porCategoria = gastosPorCategoria(movimientos, mes).map((c, i) => ({
    ...c,
    ...buscarCategoria(c.categoria),
    color: COLORES[i % COLORES.length],
  }))
  const totalGastos = porCategoria.reduce((suma, c) => suma + c.total, 0)
  const porTarjeta = gastosPorTarjeta(movimientos, mes)

  const ultimosMeses = resumenUltimosMeses(movimientos, mes, 6).map((m) => ({
    ...m,
    etiqueta: nombreMesCorto(m.mes),
  }))

  // Comparación justa: este mes vs el anterior, ambos hasta el mismo día
  const gastoActual = gastosHastaElDia(movimientos, mes, diaDeHoy)
  const gastoAnterior = gastosHastaElDia(movimientos, mesAnterior, diaDeHoy)
  const variacion = variacionPorcentual(gastoActual, gastoAnterior)

  if (movimientos.length === 0) {
    return <p className="mt-16 text-center text-stone-500 dark:text-stone-400">Anota algunos movimientos para ver tu análisis.</p>
  }

  return (
    <div className="space-y-4">
      {/* Comparación con el mes anterior */}
      {variacion !== null && (
        <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
          <p className="text-sm text-stone-500 dark:text-stone-400">Comparado con {nombreMes(mesAnterior).toLowerCase()}</p>
          <p className="mt-1 text-lg font-semibold text-stone-900 dark:text-stone-100">
            {variacion === 0 && 'Vas gastando lo mismo'}
            {variacion > 0 && (
              <>Vas gastando <span className="text-amber-600 dark:text-amber-400">{variacion}% más</span></>
            )}
            {variacion < 0 && (
              <>Vas gastando <span className="text-teal-700 dark:text-teal-300">{Math.abs(variacion)}% menos</span></>
            )}
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {formatearPesos(gastoActual)} vs {formatearPesos(gastoAnterior)} al día {diaDeHoy}
          </p>
        </section>
      )}

      {/* Torta: en qué se va la plata este mes */}
      <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Gastos de {nombreMes(mes).toLowerCase()}</h2>
        {totalGastos === 0 ? (
          <p className="mt-3 text-stone-500 dark:text-stone-400">Aún no hay gastos este mes.</p>
        ) : (
          <>
            <div className="relative">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="total" nameKey="nombre" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                    {porCategoria.map((c) => (
                      <Cell key={c.categoria} fill={c.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {/* Total al centro de la dona */}
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-xs text-stone-500 dark:text-stone-400">Total</p>
                  <p className="font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(totalGastos)}</p>
                </div>
              </div>
            </div>
            <ul className="mt-2 space-y-2">
              {porCategoria.map((c) => (
                <li key={c.categoria} className="flex items-center gap-2 text-sm">
                  <span className="size-3 shrink-0 rounded-full" style={{ background: c.color }} />
                  <span className="flex-1 text-stone-700 dark:text-stone-300">
                    {c.emoji} {c.nombre}
                  </span>
                  <span className="tabular-nums text-stone-500 dark:text-stone-400">
                    {formatearPesos(c.total)} · {Math.round((c.total / totalGastos) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Por tarjeta: solo tiene sentido si este mes pagaste con más de una */}
      {porTarjeta.length > 1 && (
        <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
          <h2 className="mb-3 font-semibold text-stone-900 dark:text-stone-100">Por tarjeta</h2>
          <ul className="space-y-3">
            {porTarjeta.map(({ tarjeta, total }) => {
              const pct = Math.round((total / totalGastos) * 100)
              return (
                <li key={tarjeta}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate text-stone-700 dark:text-stone-300">
                      {tarjeta === 'Efectivo' ? '💵' : '💳'} {tarjeta}
                    </span>
                    <span className="shrink-0 tabular-nums text-stone-500 dark:text-stone-400">
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

      {/* Tarjetas de crédito: cuánto pagar, cuándo, y cuánto interés costaría no pagar el total */}
      <SeccionCredito movimientos={movimientos} />

      {/* Barras: ingresos vs gastos de los últimos 6 meses */}
      <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Últimos 6 meses</h2>
        <div className="mt-1 mb-2 flex gap-4 text-xs text-stone-500 dark:text-stone-400">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-teal-600" /> Ingresos</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-stone-400" /> Gastos</span>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={ultimosMeses} barGap={2}>
            <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fill: '#a8a29e', fontSize: 12 }} />
            <Tooltip
              formatter={(valor, nombre) => [formatearPesos(valor), nombre === 'ingresos' ? 'Ingresos' : 'Gastos']}
              cursor={{ fill: 'rgba(120,113,108,0.1)' }}
            />
            <Bar dataKey="ingresos" fill="#0d9488" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gastos" fill="#a8a29e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>
    </div>
  )
}
