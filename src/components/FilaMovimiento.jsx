import { buscarCategoria } from '../lib/categorias.js'
import { formatearPesos } from '../lib/formato.js'

// Una fila de la lista: emoji, categoría, nota y monto. Botón para borrar.
export default function FilaMovimiento({ mov, alBorrar }) {
  const cat = buscarCategoria(mov.categoria)
  const esIngreso = mov.tipo === 'ingreso'

  return (
    <li className="flex items-center gap-3 py-2.5">
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
