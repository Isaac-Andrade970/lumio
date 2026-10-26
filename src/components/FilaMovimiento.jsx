import { buscarCategoria } from '../lib/categorias.js'
import { formatearPesos } from '../lib/formato.js'
import { Iconos } from './Marco.jsx'

// Una fila de la lista: inicial, nombre (la nota o la categoría), detalle y monto.
// Tocarla abre la edición; la ✕ la borra.
export default function FilaMovimiento({ mov, alEditar, alBorrar }) {
  const cat = buscarCategoria(mov.categoria)
  const esIngreso = mov.tipo === 'ingreso'
  const esTransferencia = mov.tipo === 'transferencia'
  // Título: la nota si la escribiste (ej. "Lider"); si no, la categoría
  const titulo = esTransferencia ? 'Transferencia' : mov.nota || cat.nombre
  // Debajo del título: la categoría (si el título es la nota) y la cuenta, separados por " · "
  const detalle = esTransferencia
    ? [`${mov.medioPago} → ${mov.destino}`, mov.nota].filter(Boolean).join(' · ')
    : [mov.nota ? cat.nombre : null, mov.medioPago].filter(Boolean).join(' · ')
  // Signo y color del monto: + verde (ingreso), − (gasto), sin signo y gris (transferencia)
  const signo = esTransferencia ? '' : esIngreso ? '+' : '−'
  const colorMonto = esTransferencia
    ? 'text-stone-500 dark:text-stone-400'
    : esIngreso
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-stone-900 dark:text-stone-100'

  return (
    <li className="flex items-center gap-1">
      <button
        onClick={() => alEditar(mov)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-2.5 text-left active:bg-stone-50 dark:active:bg-stone-800"
      >
        <span
          className={`grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
            esTransferencia
              ? 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400'
              : esIngreso
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300'
          }`}
          aria-hidden="true"
        >
          {esTransferencia ? '⇄' : titulo.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-medium text-stone-900 dark:text-stone-100">{titulo}</p>
          {detalle && <p className="truncate text-xs text-stone-500 dark:text-stone-400">{detalle}</p>}
        </div>
        <p className={`text-[15px] font-semibold tabular-nums ${colorMonto}`}>
          {signo}
          {formatearPesos(mov.monto)}
        </p>
      </button>
      {alBorrar && (
        <button
          onClick={() => alBorrar(mov)}
          aria-label={`Borrar ${titulo} ${formatearPesos(mov.monto)}`}
          className="-mr-2 grid size-9 place-items-center rounded-full text-stone-400 active:bg-stone-100 dark:active:bg-stone-800"
        >
          <Iconos.cerrar />
        </button>
      )}
    </li>
  )
}
