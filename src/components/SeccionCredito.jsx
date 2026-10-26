import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, guardarCredito, borrarCredito, guardarCuota, borrarCuota } from '../db.js'
import { tarjetasUsadas } from '../lib/calculos.js'
import { resumenCredito, interesEstimado, cuotasRestantes } from '../lib/credito.js'
import { formatearPesos, fechaCorta, leerMonto, nombreMes } from '../lib/formato.js'

// Sección de tarjetas de crédito en Análisis.
// Este componente consulta la base de datos por su cuenta (no hace falta pasarle los datos desde App).
export default function SeccionCredito({ movimientos }) {
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const cuotas = useLiveQuery(() => db.cuotas.toArray(), [], [])
  const [editando, setEditando] = useState(null) // null = viendo · 'nueva' · o la configuración que se edita

  if (editando) {
    return (
      <FormularioCredito
        inicial={editando === 'nueva' ? null : editando}
        tarjetas={tarjetasUsadas(movimientos)}
        alTerminar={() => setEditando(null)}
      />
    )
  }

  if (creditos.length === 0) {
    return (
      <button
        onClick={() => setEditando('nueva')}
        className="flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-teal-600 py-4 text-sm font-medium text-teal-700 dark:border-teal-400 dark:text-teal-300"
      >
        <span aria-hidden="true">💳</span> Configurar tarjeta de crédito
      </button>
    )
  }

  return creditos.map((c) => (
    <ResumenCredito key={c.nombre} config={c} movimientos={movimientos} cuotas={cuotas} alEditar={() => setEditando(c)} />
  ))
}

// Lo que se muestra de cada tarjeta de crédito ya configurada
function ResumenCredito({ config, movimientos, cuotas, alEditar }) {
  const r = resumenCredito(movimientos, config, undefined, cuotas) // undefined = usar la fecha de hoy
  const [voyAPagar, setVoyAPagar] = useState(0) // para el simulador de "¿y si no pago el total?"

  const pendiente = Math.max(r.aPagar - voyAPagar, 0)
  const interes = interesEstimado(pendiente, config.tasaMensual)

  return (
    <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="truncate font-semibold text-stone-900 dark:text-stone-100">💳 {config.nombre}</h2>
        <button onClick={alEditar} className="shrink-0 text-sm font-medium text-teal-700 dark:text-teal-300">
          Editar
        </button>
      </div>

      {/* 1) Estado de cuenta ya cerrado: lo que hay que pagar */}
      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800">
        <p className="text-sm text-stone-500 dark:text-stone-400">Estado de cuenta</p>
        <p className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums dark:text-stone-50">
          {formatearPesos(r.aPagar)}
        </p>
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Compras del {fechaCorta(r.periodoAnterior.desde)} al {fechaCorta(r.periodoAnterior.hasta)}: {formatearPesos(r.compras)}
          {r.cuotas > 0 && ` · Cuotas: ${formatearPesos(r.cuotas)}`}
          {r.comision > 0 && ` · Comisión: ${formatearPesos(r.comision)}`}
        </p>

        {r.pagado ? (
          <p className="mt-3 text-sm font-medium text-teal-700 dark:text-teal-300">✓ Pagado</p>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-sm text-stone-700 dark:text-stone-300">
              Paga antes del <span className="font-semibold">{fechaCorta(r.fechaPago)}</span>
            </p>
            {r.aPagar > 0 && (
              <button
                onClick={() => guardarCredito({ ...config, pagadoHasta: r.periodoAnterior.hasta })}
                className="shrink-0 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Ya lo pagué
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2) Período en curso */}
      <div className="mt-3 flex items-baseline justify-between px-1">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Usado desde el {fechaCorta(r.periodoActual.desde)}</p>
          <p className="text-xs text-stone-400">Se factura el {fechaCorta(r.periodoActual.hasta)}</p>
        </div>
        <p className="text-xl font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(r.usadoActual)}</p>
      </div>

      {/* Lo que se viene: lo usado + cuotas que siguen + comisión (puede subir si sigues comprando) */}
      <div className="mt-2 flex items-baseline justify-between px-1">
        <p className="text-sm text-stone-500 dark:text-stone-400">Próximo estado de cuenta (estimado)</p>
        <p className="font-semibold text-stone-700 tabular-nums dark:text-stone-300">{formatearPesos(r.proximoEstimado)}</p>
      </div>
      <p className="px-1 text-xs text-stone-400">A pagar el {fechaCorta(r.proximaFechaPago)}</p>

      <CuotasCredito tarjeta={config.nombre} cuotas={cuotas.filter((c) => c.tarjeta === config.nombre)} mesBase={r.mesBase} deuda={r.deudaCuotas} />

      {/* 3) Simulador: qué pasa si no pago el total */}
      {!r.pagado && r.aPagar > 0 && (
        <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
          <p className="mb-2 text-sm font-medium text-stone-900 dark:text-stone-100">¿Y si no pago el total?</p>
          {config.tasaMensual > 0 ? (
            <>
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                Si pago
                <input
                  inputMode="numeric"
                  value={voyAPagar ? formatearPesos(voyAPagar) : ''}
                  placeholder={formatearPesos(r.aPagar)}
                  onChange={(e) => setVoyAPagar(Math.min(leerMonto(e.target.value), r.aPagar))}
                  className="min-w-0 flex-1 rounded-lg bg-stone-100 px-3 py-2 text-base tabular-nums outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
                />
              </label>
              {voyAPagar > 0 && pendiente > 0 ? (
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                  Quedarían <span className="font-semibold">{formatearPesos(pendiente)}</span> pendientes y pagarías aprox.{' '}
                  <span className="font-semibold text-amber-600 dark:text-amber-400">{formatearPesos(interes)} de interés</span> el próximo mes
                  ({String(config.tasaMensual).replace('.', ',')}% mensual).
                </p>
              ) : (
                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                  Pagando el total no pagas interés por tus compras en 1 cuota.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Agrega la tasa de interés de tu tarjeta en <span className="font-medium">Editar</span> para ver cuánto te costaría.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// Lista de cuotas comprometidas de una tarjeta, con formulario para agregar más
function CuotasCredito({ tarjeta, cuotas, mesBase, deuda }) {
  const [agregando, setAgregando] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState(0)
  const [hasta, setHasta] = useState('')
  const [error, setError] = useState('')

  // Solo se muestran las que todavía tienen cuotas por pagar, la que termina antes primero
  const vigentes = cuotas
    .map((c) => ({ ...c, restantes: cuotasRestantes(c.hasta, mesBase) }))
    .filter((c) => c.restantes > 0)
    .sort((a, b) => a.hasta.localeCompare(b.hasta))
  const totalMensual = vigentes.reduce((suma, c) => suma + c.monto, 0)

  async function agregar(e) {
    e.preventDefault()
    if (!descripcion.trim()) return setError('Escribe qué compraste')
    if (monto <= 0) return setError('Escribe el monto de la cuota')
    if (!/^\d{4}-\d{2}$/.test(hasta)) return setError('Elige el mes de la última cuota')
    await guardarCuota({ tarjeta, descripcion: descripcion.trim(), monto, hasta })
    setDescripcion('')
    setMonto(0)
    setHasta('')
    setError('')
    setAgregando(false)
  }

  const campo =
    'w-full rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'

  return (
    <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-stone-900 dark:text-stone-100">Cuotas comprometidas</p>
        {totalMensual > 0 && (
          <p className="text-sm tabular-nums text-stone-500 dark:text-stone-400">{formatearPesos(totalMensual)} al mes</p>
        )}
      </div>

      {vigentes.length > 0 && (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {vigentes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-stone-900 dark:text-stone-100">{c.descripcion}</p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {c.restantes === 1 ? 'Última cuota' : `Quedan ${c.restantes} cuotas`} · hasta {nombreMes(c.hasta).toLowerCase()}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">{formatearPesos(c.monto)}</p>
              <button
                onClick={() => borrarCuota(c.id)}
                aria-label={`Quitar cuota de ${c.descripcion}`}
                className="-mr-2 grid size-8 place-items-center rounded-full text-stone-400 active:bg-stone-100 dark:active:bg-stone-800"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {deuda > 0 && (
        <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Te quedan <span className="font-semibold">{formatearPesos(deuda)}</span> por pagar en cuotas.
        </p>
      )}

      {agregando ? (
        <form onSubmit={agregar} className="mt-3 space-y-2">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="¿Qué compraste? (ej. Perfume)" maxLength={40} className={campo} />
          <div className="grid grid-cols-2 gap-2">
            <input
              inputMode="numeric"
              value={monto ? formatearPesos(monto) : ''}
              onChange={(e) => setMonto(leerMonto(e.target.value))}
              placeholder="Cuota mensual"
              aria-label="Cuota mensual"
              className={campo}
            />
            <input type="month" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Mes de la última cuota" className={campo} />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400">El mes es cuando pagas la última cuota.</p>
          <p className="h-4 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2 text-sm font-semibold text-white">Agregar cuota</button>
            <button type="button" onClick={() => setAgregando(false)} className="rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setAgregando(true)} className="mt-2 text-sm font-medium text-teal-700 dark:text-teal-300">
          + Agregar cuota
        </button>
      )}
    </div>
  )
}

// Formulario para configurar una tarjeta de crédito
function FormularioCredito({ inicial, tarjetas, alTerminar }) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? tarjetas[0] ?? '')
  // Se escribe el nombre a mano si todavía no hay pagos con esa tarjeta (no aparece en la lista)
  const [escribiendo, setEscribiendo] = useState(tarjetas.length === 0 || (inicial && !tarjetas.includes(inicial.nombre)))
  const [diaCierre, setDiaCierre] = useState(String(inicial?.diaCierre ?? ''))
  const [diaPago, setDiaPago] = useState(String(inicial?.diaPago ?? ''))
  const [tasa, setTasa] = useState(inicial?.tasaMensual ? String(inicial.tasaMensual).replace('.', ',') : '')
  const [comision, setComision] = useState(inicial?.comision ?? 0)
  const [error, setError] = useState('')

  const esDia = (texto) => Number.isInteger(Number(texto)) && Number(texto) >= 1 && Number(texto) <= 31

  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Elige o escribe el nombre de la tarjeta')
    if (!esDia(diaCierre) || !esDia(diaPago)) return setError('Los días deben ser números del 1 al 31')
    const tasaNumero = tasa ? parseFloat(tasa.replace(',', '.')) : 0 // acepta "3,2" o "3.2"
    if (Number.isNaN(tasaNumero) || tasaNumero < 0 || tasaNumero > 10) return setError('La tasa mensual debe estar entre 0 y 10%')

    // Si cambiaste el nombre al editar, se borra la configuración con el nombre antiguo
    // y las cuotas pasan a la tarjeta con el nombre nuevo
    if (inicial && inicial.nombre !== nombre.trim()) {
      await borrarCredito(inicial.nombre)
      await db.cuotas.where('tarjeta').equals(inicial.nombre).modify({ tarjeta: nombre.trim() })
    }
    await guardarCredito({
      nombre: nombre.trim(),
      diaCierre: Number(diaCierre),
      diaPago: Number(diaPago),
      tasaMensual: tasaNumero,
      comision,
      pagadoHasta: inicial?.pagadoHasta ?? null,
    })
    alTerminar()
  }

  async function quitar() {
    await borrarCredito(inicial.nombre)
    alTerminar()
  }

  const campo =
    'w-full rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'
  const etiqueta = 'mb-1 block text-sm text-stone-600 dark:text-stone-300'

  return (
    <form onSubmit={guardar} className="space-y-3 rounded-3xl bg-white p-5 dark:bg-stone-900">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">Tarjeta de crédito</h2>

      <div>
        <label htmlFor="cr-nombre" className={etiqueta}>Tarjeta</label>
        {/* Se elige de la lista (tarjetas ya usadas) o se escribe el nombre si aún no hay pagos con ella */}
        {escribiendo ? (
          <>
            <input id="cr-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Crédito Banco C" className={campo} />
            <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
              Escríbelo igual que se llama en Wallet, para que los pagos se reconozcan solos.
              {tarjetas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setEscribiendo(false)
                    setNombre(tarjetas[0])
                  }}
                  className="ml-1 font-medium text-teal-700 underline dark:text-teal-300"
                >
                  Elegir de la lista
                </button>
              )}
            </p>
          </>
        ) : (
          <select
            id="cr-nombre"
            value={nombre}
            onChange={(e) => {
              if (e.target.value === '__otra') {
                setEscribiendo(true) // muestra el campo para escribir
                setNombre('')
              } else {
                setNombre(e.target.value)
              }
            }}
            className={campo}
          >
            {tarjetas.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
            <option value="__otra">Otra tarjeta (escribir nombre)…</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cr-cierre" className={etiqueta}>Día de facturación</label>
          <input id="cr-cierre" inputMode="numeric" value={diaCierre} onChange={(e) => setDiaCierre(e.target.value)} placeholder="20" className={campo} />
        </div>
        <div>
          <label htmlFor="cr-pago" className={etiqueta}>Día de pago</label>
          <input id="cr-pago" inputMode="numeric" value={diaPago} onChange={(e) => setDiaPago(e.target.value)} placeholder="5" className={campo} />
        </div>
        <div>
          <label htmlFor="cr-tasa" className={etiqueta}>Interés mensual (%)</label>
          <input id="cr-tasa" inputMode="decimal" value={tasa} onChange={(e) => setTasa(e.target.value)} placeholder="Opcional" className={campo} />
        </div>
        <div>
          <label htmlFor="cr-comision" className={etiqueta}>Comisión mensual</label>
          <input
            id="cr-comision"
            inputMode="numeric"
            value={comision ? formatearPesos(comision) : ''}
            onChange={(e) => setComision(leerMonto(e.target.value))}
            placeholder="$0"
            className={campo}
          />
        </div>
      </div>

      <p className="h-4 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>

      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2.5 font-semibold text-white">Guardar</button>
        <button type="button" onClick={alTerminar} className="rounded-xl bg-stone-100 px-4 py-2.5 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
          Cancelar
        </button>
      </div>
      {inicial && (
        <button type="button" onClick={quitar} className="w-full text-center text-xs text-red-600 dark:text-red-400">
          Quitar esta tarjeta de crédito
        </button>
      )}
    </form>
  )
}
