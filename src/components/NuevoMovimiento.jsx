import { useState } from 'react'
import { CATEGORIAS, categoriaOtros } from '../lib/categorias.js'
import { ordenarPorUso } from '../lib/calculos.js'
import { formatearPesos, hoyISO } from '../lib/formato.js'
import { agregarMovimiento, esPosibleDuplicado } from '../db.js'

// Hoja que sube desde abajo para anotar un gasto o ingreso.
// "inicial" trae datos pre-rellenados (por ejemplo, desde un Atajo de Apple Pay).
export default function NuevoMovimiento({ inicial, movimientos, alCerrar, alGuardar }) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'gasto')
  const [monto, setMonto] = useState(inicial?.monto ?? 0)
  const [categoria, setCategoria] = useState(null)
  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [fecha, setFecha] = useState(hoyISO())
  const [error, setError] = useState('')
  const [avisoDuplicado, setAvisoDuplicado] = useState(false)

  const categorias = ordenarPorUso(CATEGORIAS[tipo], movimientos)

  function cambiarTipo(nuevo) {
    setTipo(nuevo)
    setCategoria(null) // las categorías de gasto e ingreso son distintas
  }

  // Teclado numérico propio: más grande y cómodo que el del sistema
  function tecla(valor) {
    setError('')
    setAvisoDuplicado(false)
    if (valor === 'borrar') return setMonto((m) => Math.floor(m / 10))
    if (valor === '000') return setMonto((m) => (m === 0 ? 0 : Math.min(m * 1000, 999_999_999)))
    setMonto((m) => Math.min(m * 10 + valor, 999_999_999))
  }

  async function guardar(forzar = false) {
    if (monto <= 0) return setError('Escribe un monto mayor a $0')
    const mov = {
      tipo,
      monto,
      categoria: categoria ?? categoriaOtros(tipo),
      fecha,
      nota: nota.trim(),
      origen: inicial?.origen ?? 'manual',
    }
    if (!forzar && (await esPosibleDuplicado(mov))) return setAvisoDuplicado(true)
    const id = await agregarMovimiento(mov)
    alGuardar({ ...mov, id })
  }

  const colorTipo = tipo === 'gasto' ? 'text-stone-900 dark:text-stone-50' : 'text-teal-700 dark:text-teal-300'

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      {/* Fondo oscuro: tocarlo cierra la hoja */}
      <button aria-label="Cerrar" onClick={alCerrar} className="fondo-entrar absolute inset-0 bg-black/40" />

      <div
        role="dialog"
        aria-label="Nuevo movimiento"
        className="hoja-entrar safe-bottom relative mx-auto w-full max-w-md rounded-t-3xl bg-white px-4 pt-3 shadow-2xl dark:bg-stone-900"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone-300 dark:bg-stone-700" />

        {/* Gasto / Ingreso */}
        <div className="mb-3 grid grid-cols-2 rounded-xl bg-stone-100 p-1 text-sm font-medium dark:bg-stone-800">
          {['gasto', 'ingreso'].map((t) => (
            <button
              key={t}
              onClick={() => cambiarTipo(t)}
              className={`rounded-lg py-2 capitalize transition-colors ${
                tipo === t
                  ? 'bg-white text-stone-900 shadow-sm dark:bg-stone-700 dark:text-white'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Monto */}
        <div className="mb-1 text-center">
          <p className={`text-5xl font-semibold tracking-tight tabular-nums ${monto ? colorTipo : 'text-stone-300 dark:text-stone-600'}`}>
            {tipo === 'ingreso' && monto ? '+' : ''}
            {formatearPesos(monto)}
          </p>
          <p className="h-5 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
        </div>

        {/* Categorías (las más usadas primero) */}
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoria(c.id)}
              className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
                categoria === c.id
                  ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200'
                  : 'border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300'
              }`}
            >
              <span className="text-xl" aria-hidden="true">{c.emoji}</span>
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Nota y fecha */}
        <div className="mb-3 flex gap-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            aria-label="Fecha"
            className="w-36 rounded-xl bg-stone-100 px-2 py-2.5 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
        </div>

        {/* Teclado numérico */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '000', 0, 'borrar'].map((t) => (
            <button
              key={t}
              onClick={() => tecla(t)}
              aria-label={t === 'borrar' ? 'Borrar' : String(t)}
              className="rounded-xl bg-stone-100 py-3 text-2xl font-medium text-stone-800 active:scale-95 active:bg-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:active:bg-stone-700"
            >
              {t === 'borrar' ? '⌫' : t}
            </button>
          ))}
        </div>

        {avisoDuplicado ? (
          <div className="mb-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="mb-2">Anotaste algo igual hace menos de un minuto. ¿Es un duplicado?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={alCerrar} className="rounded-lg bg-white py-2 font-medium dark:bg-stone-800">
                Sí, descartar
              </button>
              <button onClick={() => guardar(true)} className="rounded-lg bg-amber-600 py-2 font-medium text-white">
                No, guardar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => guardar()}
            className="w-full rounded-2xl bg-teal-700 py-4 text-lg font-semibold text-white active:scale-[0.98] active:bg-teal-800"
          >
            Guardar
          </button>
        )}
      </div>
    </div>
  )
}
