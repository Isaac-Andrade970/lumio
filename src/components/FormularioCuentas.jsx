import { useState } from 'react'
import { guardarCuenta, borrarCuenta } from '../db.js'
import { mismaTarjeta } from '../lib/credito.js'
import { formatearPesos, hoyISO, leerMonto } from '../lib/formato.js'

// Formulario: una fila por cuenta con su saldo de HOY (lo que dice la app de tu banco)
export default function FormularioCuentas({ cuentas, sugeridas, alTerminar }) {
  // Copia editable: las cuentas existentes + las sugeridas que todavía no están (con saldo vacío)
  const [filas, setFilas] = useState(() => {
    const existentes = cuentas.map((c) => ({ nombre: c.nombre, saldo: null, original: c }))
    const nuevas = sugeridas
      .filter((s) => !cuentas.some((c) => mismaTarjeta(c.nombre, s)))
      .map((s) => ({ nombre: s, saldo: null, original: null }))
    return [...existentes, ...nuevas]
  })
  const [error, setError] = useState('')

  function cambiar(i, cambios) {
    setFilas((f) => f.map((fila, j) => (j === i ? { ...fila, ...cambios } : fila)))
    setError('')
  }

  async function guardar(e) {
    e.preventDefault()
    const ahora = Date.now()
    for (const fila of filas) {
      const nombre = fila.nombre.trim()
      // Fila nueva sin saldo: se ignora (no es una de tus cuentas)
      if (!fila.original && fila.saldo === null) continue
      if (!nombre) return setError('Cada cuenta necesita un nombre')

      if (fila.original && nombre !== fila.original.nombre) await borrarCuenta(fila.original.nombre)
      if (fila.saldo === null) {
        // No cambiaste el saldo: se mantiene la base anterior (solo puede haber cambiado el nombre)
        await guardarCuenta({ ...fila.original, nombre })
      } else {
        // Saldo nuevo: desde ahora Lumio cuenta a partir de este monto
        await guardarCuenta({ nombre, saldoInicial: fila.saldo, fechaSaldo: hoyISO(), momentoSaldo: ahora })
      }
    }
    alTerminar()
  }

  async function quitar(i) {
    const fila = filas[i]
    if (fila.original) await borrarCuenta(fila.original.nombre)
    setFilas((f) => f.filter((_, j) => j !== i))
  }

  const campo =
    'min-w-0 rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'

  return (
    <form onSubmit={guardar} className="space-y-3 rounded-3xl bg-white p-5 dark:bg-stone-900">
      <div>
        <h2 className="font-semibold text-stone-900 dark:text-stone-100">Mis cuentas</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Escribe cuánto tienes <span className="font-medium">hoy</span> en cada una (mira la app de tu banco). Desde ahora Lumio
          descuenta tus gastos y suma tus ingresos. Las tarjetas de crédito no van aquí.
        </p>
      </div>

      {filas.map((fila, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={fila.nombre}
            onChange={(e) => cambiar(i, { nombre: e.target.value })}
            placeholder="Nombre (como en Wallet)"
            aria-label="Nombre de la cuenta"
            className={`${campo} flex-1`}
          />
          <input
            inputMode="numeric"
            value={fila.saldo !== null ? formatearPesos(fila.saldo, { mostrar: true }) : ''}
            onChange={(e) => cambiar(i, { saldo: e.target.value.trim() === '' ? null : leerMonto(e.target.value) })}
            placeholder={fila.original ? 'Sin cambio' : 'Saldo hoy'}
            aria-label={`Saldo de hoy en ${fila.nombre || 'la cuenta'}`}
            className={`${campo} w-32 tabular-nums`}
          />
          <button
            type="button"
            onClick={() => quitar(i)}
            aria-label={`Quitar ${fila.nombre}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-stone-400 active:bg-stone-100 dark:active:bg-stone-800"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setFilas((f) => [...f, { nombre: '', saldo: null, original: null }])}
        className="text-sm font-medium text-teal-700 dark:text-teal-300"
      >
        + Agregar cuenta
      </button>

      <p className="text-xs text-stone-500 dark:text-stone-400">
        Las cuentas con saldo vacío no se agregan. Si ya existe y la dejas vacía, su saldo no cambia.
      </p>
      <p className="h-4 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2.5 font-semibold text-white">Guardar</button>
        <button type="button" onClick={alTerminar} className="rounded-xl bg-stone-100 px-4 py-2.5 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
          Cancelar
        </button>
      </div>
    </form>
  )
}
