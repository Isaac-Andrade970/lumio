import { useState } from 'react'
import { agruparPorDia } from '../lib/calculos.js'
import { formatearPesos, nombreDia } from '../lib/formato.js'
import FilaMovimiento from './FilaMovimiento.jsx'

// Lista completa, agrupada por día, con filtro por tipo y búsqueda
export default function Movimientos({ movimientos, alEditar, alBorrar }) {
  const [filtro, setFiltro] = useState('todos')
  const [busqueda, setBusqueda] = useState('')

  const texto = busqueda.trim().toLowerCase()
  const filtrados = movimientos.filter(
    (m) =>
      (filtro === 'todos' || m.tipo === filtro) &&
      (!texto || m.nota?.toLowerCase().includes(texto) || m.categoria.includes(texto)),
  )
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

      <div className="flex gap-2">
        {[
          ['todos', 'Todos'],
          ['gasto', 'Gastos'],
          ['ingreso', 'Ingresos'],
        ].map(([valor, etiqueta]) => (
          <button
            key={valor}
            onClick={() => setFiltro(valor)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filtro === valor
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                : 'bg-white text-stone-600 dark:bg-stone-900 dark:text-stone-300'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {grupos.length === 0 && (
        <p className="mt-10 text-center text-stone-500 dark:text-stone-400">No hay movimientos que mostrar.</p>
      )}

      {grupos.map((g) => (
        <section key={g.fecha} className="rounded-3xl bg-white px-5 pt-3 pb-1 dark:bg-stone-900">
          <div className="flex justify-between text-sm">
            <h2 className="font-medium text-stone-500 dark:text-stone-400">{nombreDia(g.fecha)}</h2>
            <span className="tabular-nums text-stone-400">
              {g.totalDia >= 0 ? '+' : '−'}
              {formatearPesos(Math.abs(g.totalDia))}
            </span>
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
