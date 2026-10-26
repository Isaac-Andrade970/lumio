import { useState } from 'react'

// Tarjeta para conectar Lumio con la bandeja de pagos de Wallet.
// Si ya está conectada, solo muestra el estado y un botón para desconectar.
export default function ConexionWallet({ conectada, alConectar, alDesconectar }) {
  const [abierta, setAbierta] = useState(false)
  const [clave, setClave] = useState('')
  const [error, setError] = useState('')
  const [probando, setProbando] = useState(false)

  async function conectar(e) {
    e.preventDefault() // evita que el formulario recargue la página
    if (!clave.trim()) return setError('Escribe tu clave')
    setProbando(true)
    try {
      await alConectar(clave.trim()) // App prueba la clave contra Supabase antes de guardarla
      setAbierta(false)
      setClave('')
    } catch (err) {
      setError(err.message === 'Clave incorrecta' ? 'Clave incorrecta' : 'No se pudo conectar. Revisa tu internet.')
    } finally {
      setProbando(false) // "finally" se ejecuta siempre, haya error o no
    }
  }

  if (conectada) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-teal-50 px-4 py-2.5 text-sm text-teal-800 dark:bg-teal-950 dark:text-teal-200">
        <span>
          Pagos de Wallet: automáticos
        </span>
        <button onClick={alDesconectar} className="text-xs font-medium underline">
          Desconectar
        </button>
      </div>
    )
  }

  if (!abierta) {
    return (
      <button
        onClick={() => setAbierta(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-teal-600 py-2.5 text-sm font-medium text-teal-700 active:bg-teal-50 dark:border-teal-400 dark:text-teal-300 dark:active:bg-teal-950"
      >
        Conectar pagos de Wallet
      </button>
    )
  }

  return (
    <form onSubmit={conectar} className="rounded-xl bg-white p-4 dark:bg-stone-900">
      <label htmlFor="clave-wallet" className="text-sm text-stone-600 dark:text-stone-300">
        Clave de tu bandeja (la misma del atajo)
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="clave-wallet"
          type="password"
          autoComplete="off"
          value={clave}
          onChange={(e) => {
            setClave(e.target.value)
            setError('')
          }}
          className="min-w-0 flex-1 rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
        />
        <button disabled={probando} className="rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50">
          {probando ? '...' : 'Conectar'}
        </button>
      </div>
      <p className="mt-1 h-4 text-xs text-red-600 dark:text-red-400" role="alert">
        {error}
      </p>
    </form>
  )
}
