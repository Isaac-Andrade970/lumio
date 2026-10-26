import { NOVEDADES, VERSION } from '../version.js'

// Hoja con las novedades. Sale sola una vez después de cada actualización, o desde Ajustes → Novedades.
export default function Novedades({ alCerrar }) {
  const [actual, ...anteriores] = NOVEDADES

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-end">
      <button aria-label="Cerrar" onClick={alCerrar} className="fondo-entrar absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-label="Novedades"
        className="hoja-entrar safe-bottom relative mx-auto max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white px-5 pt-3 shadow-2xl dark:bg-stone-900"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />

        <p className="text-xs font-semibold tracking-wide text-teal-700 uppercase dark:text-teal-300">Novedades · v{VERSION}</p>
        <h2 className="mt-1 text-2xl font-bold text-stone-900 dark:text-stone-50">{actual.titulo}</h2>
        <ul className="mt-4 space-y-3">
          {actual.cambios.map((c) => (
            <li key={c} className="flex gap-3 text-stone-700 dark:text-stone-300">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-teal-600" aria-hidden="true" />
              <span>{c}</span>
            </li>
          ))}
        </ul>

        <button onClick={alCerrar} className="mt-6 w-full rounded-2xl bg-teal-700 py-3.5 font-semibold text-white">
          Entendido
        </button>

        {/* Historial de versiones anteriores */}
        <details className="mt-4 mb-2">
          <summary className="cursor-pointer text-sm text-stone-500 dark:text-stone-400">Versiones anteriores</summary>
          <div className="mt-3 space-y-4">
            {anteriores.map((v) => (
              <div key={v.version}>
                <p className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                  v{v.version} · {v.titulo}
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-stone-600 dark:text-stone-400">
                  {v.cambios.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}
