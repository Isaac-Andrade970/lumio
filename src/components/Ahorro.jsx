import { useState } from 'react'
import { proyectarAhorro } from '../lib/calculos.js'
import { formatearPesos, leerMonto } from '../lib/formato.js'

// Plazos que se muestran en el resultado
const PLAZOS = [
  { meses: 6, etiqueta: '6 meses' },
  { meses: 12, etiqueta: '1 año' },
  { meses: 60, etiqueta: '5 años' },
]

// Tasas de ejemplo para comparar escenarios (no son una recomendación)
const TASAS = [
  { valor: 0, etiqueta: 'Sin interés' },
  { valor: 4, etiqueta: '4% anual' },
  { valor: 8, etiqueta: '8% anual' },
]

// Simulador: "si ahorro X al mes, ¿cuánto tendré?"
export default function Ahorro() {
  // Estado: lo único que el usuario elige
  const [mensual, setMensual] = useState(50000)
  const [tasa, setTasa] = useState(0)

  // Valores calculados: se recalculan solos en cada dibujo, no se guardan en el estado
  const resultados = PLAZOS.map((p) => ({
    ...p,
    ...proyectarAhorro({ mensual, meses: p.meses, tasaAnual: tasa }),
  }))
  const mayor = resultados.at(-1).total || 1 // para dibujar las barras proporcionales

  return (
    <div className="space-y-4">
      {/* Cuánto ahorrar al mes */}
      <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
        <label htmlFor="mensual" className="text-sm text-stone-500 dark:text-stone-400">
          Si ahorro cada mes
        </label>
        <input
          id="mensual"
          inputMode="numeric"
          value={formatearPesos(mensual)}
          onChange={(e) => setMensual(Math.min(leerMonto(e.target.value), 10_000_000))}
          className="mt-1 w-full bg-transparent text-4xl font-semibold tracking-tight text-stone-900 tabular-nums outline-none dark:text-stone-50"
        />
        <input
          type="range"
          min="0"
          max="500000"
          step="5000"
          value={Math.min(mensual, 500000)}
          onChange={(e) => setMensual(Number(e.target.value))}
          aria-label="Ahorro mensual"
          className="mt-3 w-full accent-teal-700"
        />
        <div className="flex justify-between text-xs text-stone-400">
          <span>$0</span>
          <span>$500.000</span>
        </div>

        <p className="mt-4 mb-2 text-sm text-stone-500 dark:text-stone-400">Con interés</p>
        <div className="grid grid-cols-3 gap-2">
          {TASAS.map((t) => (
            <button
              key={t.valor}
              onClick={() => setTasa(t.valor)}
              className={`rounded-xl py-2 text-sm font-medium ${
                tasa === t.valor
                  ? 'bg-teal-700 text-white'
                  : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              {t.etiqueta}
            </button>
          ))}
        </div>
      </section>

      {/* Resultado */}
      <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
        <h2 className="mb-4 font-semibold text-stone-900 dark:text-stone-100">Tendrías</h2>
        <ul className="space-y-4">
          {resultados.map((r) => (
            <li key={r.meses}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-stone-500 dark:text-stone-400">En {r.etiqueta}</span>
                <span className="text-xl font-semibold text-stone-900 tabular-nums dark:text-stone-50">
                  {formatearPesos(r.total)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800">
                <div
                  className="h-2 rounded-full bg-teal-600 transition-[width] duration-300"
                  style={{ width: `${(r.total / mayor) * 100}%` }}
                />
              </div>
              {r.intereses > 0 && (
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {formatearPesos(r.aportado)} tuyos + <span className="text-teal-700 dark:text-teal-300">{formatearPesos(r.intereses)} de interés</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="px-2 text-center text-xs text-stone-400">
        Simulación referencial. Las tasas son ejemplos, no una recomendación de inversión.
      </p>
    </div>
  )
}