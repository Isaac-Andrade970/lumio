import { useRef, useState } from 'react'
import { buscarCategoria } from '../lib/categorias.js'
import { formatearPesos } from '../lib/formato.js'

const ANCHO_BOTON = 84 // lo que se abre al deslizar: el botón Borrar
const UMBRAL_BORRAR = 190 // deslizar más que esto borra de una vez (como en Mail)

// Una fila de la lista: inicial, nombre (la nota o la categoría), detalle y monto.
// Tocarla abre la edición. Si se puede borrar, se desliza hacia la izquierda: aparece "Borrar",
// y si la deslizas hasta el fondo se borra sola.
export default function FilaMovimiento({ mov, alEditar, alBorrar }) {
  const cat = buscarCategoria(mov.categoria)
  const esIngreso = mov.tipo === 'ingreso'
  const esTransferencia = mov.tipo === 'transferencia'
  // Título: la nota si la escribiste (ej. "Lider"); si no, la categoría
  const titulo = esTransferencia ? 'Transferencia' : mov.nota || cat.nombre
  // Debajo del título: la categoría (si el título es la nota) y la cuenta, separados por " · "
  const detalle = esTransferencia
    ? [`${mov.medioPago || 'Otra cuenta'} → ${mov.destino || 'Otra cuenta'}`, mov.nota].filter(Boolean).join(' · ')
    : [mov.nota ? cat.nombre : null, mov.medioPago].filter(Boolean).join(' · ')
  // Signo y color del monto: + verde (ingreso), − (gasto), sin signo y gris (transferencia)
  const signo = esTransferencia ? '' : esIngreso ? '+' : '−'
  const colorMonto = esTransferencia
    ? 'text-stone-500 dark:text-stone-400'
    : esIngreso
      ? 'text-emerald-700 dark:text-emerald-400'
      : 'text-stone-900 dark:text-stone-100'

  // ---- Deslizar ----
  const [desplazado, setDesplazado] = useState(0) // 0 = cerrada · negativo = movida a la izquierda
  const [arrastrando, setArrastrando] = useState(false)
  const toque = useRef(null) // { x, y, base, horizontal }
  const recienDeslizada = useRef(false)
  const actual = useRef(0) // último desplazamiento (el estado puede ir un dibujo atrasado)

  function mover_a(valor) {
    actual.current = valor
    setDesplazado(valor)
  }

  function inicio(e) {
    if (!alBorrar) return
    toque.current = { x: e.clientX, y: e.clientY, base: actual.current, horizontal: null, id: e.pointerId }
  }

  function mover(e) {
    const t = toque.current
    if (!t) return
    const dx = e.clientX - t.x
    const dy = e.clientY - t.y
    // Decide una vez si el gesto es horizontal (deslizar) o vertical (scroll de la lista)
    if (t.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) t.horizontal = Math.abs(dx) > Math.abs(dy)
    if (!t.horizontal) return
    if (!arrastrando) {
      setArrastrando(true)
      e.currentTarget.setPointerCapture?.(t.id) // sigue el dedo aunque salga de la fila
    }
    mover_a(Math.min(0, Math.max(t.base + dx, -window.innerWidth)))
  }

  function fin() {
    const t = toque.current
    toque.current = null
    if (!t?.horizontal) return
    setArrastrando(false)
    recienDeslizada.current = true
    const final = actual.current
    if (final < -UMBRAL_BORRAR) {
      mover_a(0)
      alBorrar(mov)
    } else {
      mover_a(final < -ANCHO_BOTON / 2 ? -ANCHO_BOTON : 0)
    }
  }

  function tocar() {
    if (recienDeslizada.current) {
      recienDeslizada.current = false
      return
    }
    if (actual.current !== 0) return mover_a(0) // si estaba abierta, tocar la cierra
    alEditar(mov)
  }

  const abierta = desplazado !== 0

  return (
    <li className="relative overflow-hidden">
      {alBorrar && (
        <button
          onClick={() => {
            mover_a(0)
            alBorrar(mov)
          }}
          tabIndex={abierta ? 0 : -1}
          aria-hidden={!abierta}
          className="absolute inset-y-1 right-0 flex items-center justify-end rounded-xl bg-red-600 pr-4 text-sm font-semibold text-white"
          style={{ width: Math.max(ANCHO_BOTON, -desplazado) }}
        >
          Borrar
        </button>
      )}
      <button
        onClick={tocar}
        onPointerDown={inicio}
        onPointerMove={mover}
        onPointerUp={fin}
        onPointerCancel={fin}
        aria-label={alBorrar ? `${titulo} ${signo}${formatearPesos(mov.monto)}. Desliza a la izquierda para borrar` : undefined}
        className={`relative flex w-full min-w-0 items-center gap-3 bg-white py-2.5 text-left touch-pan-y select-none dark:bg-stone-900 ${arrastrando ? '' : 'transition-transform duration-200'}`}
        style={{ transform: `translateX(${desplazado}px)` }}
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
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium text-stone-900 dark:text-stone-100">{titulo}</span>
          {detalle && <span className="block truncate text-xs text-stone-500 dark:text-stone-400">{detalle}</span>}
        </span>
        <span className={`text-[15px] font-semibold tabular-nums ${colorMonto}`}>
          {signo}
          {formatearPesos(mov.monto)}
        </span>
      </button>
    </li>
  )
}
