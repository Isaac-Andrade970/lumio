import { buscarCategoria } from '../lib/categorias.js'
import { formatearPesos } from '../lib/formato.js'

// Una fila de la lista: emoji, categoría, nota y monto.
// Tocarla abre la edición; la ✕ la borra.
export default function FilaMovimiento({ mov, alEditar, alBorrar }) {
  const cat = buscarCategoria(mov.categoria)
  const esIngreso = mov.tipo === 'ingreso'

  return (
    <li className="flex items-center gap-1">
      <button
        onClick={() => alEditar(mov)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 text-left active:bg-stone-50 dark:active:bg-stone-800"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-100 text-lg dark:bg-stone-800" aria-hidden="true">
          {cat.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-stone-900 dark:text-stone-100">{cat.nombre}</p>
          {mov.nota && <p className="truncate text-sm text-stone-500 dark:text-stone-400">{mov.nota}</p>}
        </div>
        <p className={`font-semibold tabular-nums ${esIngreso ? 'text-teal-700 dark:text-teal-300' : 'text-stone-900 dark:text-stone-100'}`}>
          {esIngreso ? '+' : '−'}
          {formatearPesos(mov.monto)}
        </p>
      </button>
      {alBorrar && (
        <button
          onClick={() => alBorrar(mov)}
          aria-label={`Borrar ${cat.nombre} ${formatearPesos(mov.monto)}`}
          className="-mr-2 grid size-9 place-items-center rounded-full text-stone-400 active:bg-stone-100 dark:active:bg-stone-800"
        >
          ✕
        </button>
      )}
    </li>
  )
}