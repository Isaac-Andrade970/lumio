import { useState } from 'react'
import { agruparPorDia, tarjetaDe, tarjetasUsadas, SIN_TARJETA } from '../lib/calculos.js'
import { formatearPesos, nombreDia } from '../lib/formato.js'
import { mismaTarjeta } from '../lib/credito.js'
import FilaMovimiento from './FilaMovimiento.jsx'

// Lista completa, agrupada por día, con filtro por tipo y búsqueda
export default function Movimientos({ movimientos, alEditar, alBorrar }) {
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')
  const [tarjeta, setTarjeta] = useState('todas')

  // Opciones del filtro: tus tarjetas, y "Sin indicar" solo si hay movimientos sin tarjeta
  const tarjetas = tarjetasUsadas(movimientos)
  if (movimientos.some((m) => tarjetaDe(m) === SIN_TARJETA)) tarjetas.push(SIN_TARJETA)

  const texto = busqueda.trim().toLowerCase()
  const filtrados = movimientos.filter(
    (m) =>
      (filtro === 'todos' || m.tipo === filtro) &&
      (tarjeta === 'todas' || mismaTarjeta(tarjetaDe(m), tarjeta) || mismaTarjeta(m.destino, tarjeta)) &&
      (!texto || m.nota?.toLowerCase().includes(texto) || m.categoria.includes(texto)),
  )
  // Total de gastos de lo que se está mostrando (útil al filtrar por tarjeta)
  const totalGastado = filtrados.filter((m) => m.tipo === 'gasto').reduce((suma, m) => suma + m.monto, 0)
  const grupos = agruparPorDia(filtrados)

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nota o categoría"
        className="w-full rounded-xl bg-white px-4 py-2.5 text-base outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-teal-600 dark:bg-stone-900 dark:text-white"
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {[
          ['todos', 'Todos'],
          ['gasto', 'Gastos'],
          ['ingreso', 'Ingresos'],
          ['transferencia', 'Transferencias'],
        ].map(([valor, etiqueta]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium ${
              filtro === valor
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                : 'bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-300'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* Filtro por tarjeta: solo aparece si ya usaste alguna */}
      {tarjetas.length > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {['todas', ...tarjetas].map((t) => (
            <button
              key={t}
              onClick={() => setTarjeta(t)}
              className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                tarjeta === t
                  ? 'border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-400 dark:bg-teal-950 dark:text-teal-200'
                  : 'border-stone-200 text-stone-500 dark:border-stone-700 dark:text-stone-400'
              }`}
            >
              {t === 'todas' ? '💳 Todas las tarjetas' : t}
            </button>
          ))}
        </div>
      )}

      {tarjeta !== 'todas' && (
        <p className="px-1 text-sm text-stone-500 dark:text-stone-400">
          Gastado con {tarjeta}: <span className="font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(totalGastado)}</span>
        </p>
      )}

      {grupos.length === 0 && (
        <p className="mt-10 text-center text-stone-500 dark:text-stone-400">No hay movimientos que mostrar.</p>
      )}

      {grupos.map((g) => (
        <section key={g.fecha} className="rounded-3xl bg-white px-5 pt-3 pb-1 dark:bg-stone-900">
          <div className="flex justify-between text-sm">
            <h2 className="font-medium text-stone-500 dark:text-stone-400">{nombreDia(g.fecha)}</h2>
            {/* Total del día (no se muestra si ese día solo hubo transferencias entre tus cuentas) */}
            {g.movimientos.some((m) => m.tipo !== 'transferencia') && (
              <span className="tabular-nums text-stone-400">
                {g.totalDia >= 0 ? '+' : '−'}
                {formatearPesos(Math.abs(g.totalDia))}
              </span>
            )}
          </div>
          <ul className="divide-y divide-stone-100 dark:divide-stone-800">
            {g.movimientos.map((m) => (
              <FilaMovimiento key={m.id} mov={m} alEditar={alEditar} alBorrar={alBorrar} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
