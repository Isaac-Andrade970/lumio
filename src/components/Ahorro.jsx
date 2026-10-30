import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, guardarMeta, borrarMeta } from '../db.js'
import { proyectarAhorro } from '../lib/calculos.js'
import { progresoMeta } from '../lib/metas.js'
import { formatearPesos, leerMonto, hoyISO, mesDe, sumarMeses, nombreMes } from '../lib/formato.js'

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
      <SeccionMetas />

      <h2 className="px-1 pt-2 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">Simulador</h2>
      {/* Cuánto ahorrar al mes */}
      <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
        <label htmlFor="mensual" className="text-sm text-stone-500 dark:text-stone-400">
          Si ahorro cada mes
        </label>
        <input
          id="mensual"
          inputMode="numeric"
          value={formatearPesos(mensual, { mostrar: true })}
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
                  {formatearPesos(r.total, { mostrar: true })}
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
                  {formatearPesos(r.aportado, { mostrar: true })} tuyos + <span className="text-teal-700 dark:text-teal-300">{formatearPesos(r.intereses, { mostrar: true })} de interés</span>
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

// ---- Metas de ahorro ----

function SeccionMetas() {
  const metas = useLiveQuery(() => db.metas.toArray(), [], [])
  const [creando, setCreando] = useState(false)

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">Mis metas</h2>
        {!creando && (
          <button onClick={() => setCreando(true)} className="text-sm font-medium text-teal-700 dark:text-teal-300">
            + Nueva meta
          </button>
        )}
      </div>

      {creando && <FormularioMeta alTerminar={() => setCreando(false)} />}

      {metas.length === 0 && !creando && (
        <button
          onClick={() => setCreando(true)}
          className="w-full rounded-3xl border border-dashed border-teal-600 p-5 text-left text-sm text-teal-800 dark:border-teal-400 dark:text-teal-200"
        >
          <span className="block font-semibold">Crea tu primera meta</span>
          <span className="block text-teal-700 dark:text-teal-300">Por ejemplo: "Viaje · $600.000 para marzo". Lumio te dice cuánto apartar cada mes.</span>
        </button>
      )}

      {metas.map((m) => (
        <TarjetaMeta key={m.id} meta={m} />
      ))}
    </section>
  )
}

function TarjetaMeta({ meta }) {
  const p = progresoMeta(meta)
  const [aporte, setAporte] = useState(0)
  const [abierta, setAbierta] = useState(false)

  async function aportar(e) {
    e.preventDefault()
    if (aporte <= 0) return
    await guardarMeta({ ...meta, aportes: [...(meta.aportes ?? []), { monto: aporte, fecha: hoyISO() }] })
    setAporte(0)
    setAbierta(false)
  }

  async function deshacerUltimo() {
    await guardarMeta({ ...meta, aportes: (meta.aportes ?? []).slice(0, -1) })
  }

  return (
    <article className="rounded-3xl bg-white p-5 dark:bg-stone-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-stone-900 dark:text-stone-100">{meta.nombre}</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">Para {nombreMes(meta.mesLimite).toLowerCase()}</p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-lg font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(p.ahorrado)}</span>
          <span className="block text-xs text-stone-500 tabular-nums dark:text-stone-400">de {formatearPesos(meta.objetivo)}</span>
        </p>
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800" role="progressbar" aria-valuenow={p.porcentaje} aria-valuemin={0} aria-valuemax={100}>
        <div className="boton-morado h-full rounded-full transition-[width] duration-500" style={{ width: `${p.porcentaje}%`, boxShadow: 'none' }} />
      </div>

      <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
        {p.cumplida
          ? '¡Meta cumplida!'
          : p.vencida
            ? `Se pasó la fecha: te faltan ${formatearPesos(p.falta)}.`
            : `Te faltan ${formatearPesos(p.falta)}: aparta ${formatearPesos(p.porMes)} al mes durante ${p.meses} ${p.meses === 1 ? 'mes' : 'meses'}.`}
      </p>

      {abierta ? (
        <form onSubmit={aportar} className="mt-3 flex gap-2">
          <input
            autoFocus
            inputMode="numeric"
            value={aporte ? formatearPesos(aporte, { mostrar: true }) : ''}
            onChange={(e) => setAporte(leerMonto(e.target.value))}
            placeholder="¿Cuánto apartaste?"
            aria-label={`Aporte a ${meta.nombre}`}
            className="min-w-0 flex-1 rounded-xl bg-stone-100 px-3 py-2 text-base tabular-nums outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
          <button type="submit" className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Sumar</button>
        </form>
      ) : (
        <div className="mt-3 flex items-center gap-4 text-sm">
          {!p.cumplida && (
            <button onClick={() => setAbierta(true)} className="font-semibold text-teal-700 dark:text-teal-300">+ Aportar</button>
          )}
          {(meta.aportes ?? []).length > 0 && (
            <button onClick={deshacerUltimo} className="text-stone-500 dark:text-stone-400">Deshacer último</button>
          )}
          <button onClick={() => borrarMeta(meta.id)} className="ml-auto text-stone-400">Borrar meta</button>
        </div>
      )}
    </article>
  )
}

function FormularioMeta({ alTerminar }) {
  const [nombre, setNombre] = useState('')
  const [objetivo, setObjetivo] = useState(0)
  const [mesLimite, setMesLimite] = useState(sumarMeses(mesDe(hoyISO()), 6))
  const [error, setError] = useState('')

  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ponle un nombre a la meta')
    if (objetivo <= 0) return setError('¿Cuánto quieres juntar?')
    await guardarMeta({ nombre: nombre.trim(), objetivo, mesLimite, aportes: [], creado: Date.now() })
    alTerminar()
  }

  const campo = 'w-full rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'
  return (
    <form onSubmit={guardar} className="space-y-3 rounded-3xl bg-white p-5 dark:bg-stone-900">
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Viaje)" aria-label="Nombre de la meta" maxLength={40} className={campo} />
      <input
        inputMode="numeric"
        value={objetivo ? formatearPesos(objetivo, { mostrar: true }) : ''}
        onChange={(e) => setObjetivo(leerMonto(e.target.value))}
        placeholder="¿Cuánto quieres juntar?"
        aria-label="Monto de la meta"
        className={`${campo} tabular-nums`}
      />
      <label className="block text-sm text-stone-600 dark:text-stone-300">
        ¿Para cuándo?
        <input type="month" value={mesLimite} min={mesDe(hoyISO())} onChange={(e) => e.target.value && setMesLimite(e.target.value)} className={`${campo} mt-1`} />
      </label>
      <p className="h-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2.5 font-semibold text-white">Crear meta</button>
        <button type="button" onClick={alTerminar} className="rounded-xl bg-stone-100 px-4 py-2.5 text-stone-700 dark:bg-stone-800 dark:text-stone-200">Cancelar</button>
      </div>
    </form>
  )
}
