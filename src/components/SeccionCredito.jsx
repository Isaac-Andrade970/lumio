import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, guardarCredito, borrarCredito, guardarCuota, borrarCuota } from '../db.js'
import { tarjetasUsadas } from '../lib/calculos.js'
import { resumenCredito, interesEstimado, restantesDe } from '../lib/credito.js'
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
        Configurar tarjeta de crédito
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
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], [])

  const [montoPago, setMontoPago] = useState(0) // 0 = pagar todo lo pendiente
  const [cuentaPago, setCuentaPago] = useState('') // desde qué cuenta pagaste
  const aPagarAhora = montoPago || r.pendiente
  const faltaria = Math.max(r.pendiente - aPagarAhora, 0) // lo que quedaría sin pagar con este pago
  const interesFaltante = interesEstimado(faltaria, config.tasaMensual)

  const pagosDelEstado = (config.pagos ?? []).filter((p) => p.periodo === r.periodoAnterior.hasta)
  const tasaTexto = String(config.tasaMensual ?? 0).replace('.', ',')

  // Guarda el pago; si elegiste cuenta, se descuenta de su saldo
  function registrarPago() {
    const pago = { periodo: r.periodoAnterior.hasta, monto: aPagarAhora, cuenta: cuentaPago || null, momento: Date.now() }
    guardarCredito({ ...config, pagos: [...(config.pagos ?? []), pago] })
    setMontoPago(0)
  }

  // Quita el último pago de este estado de cuenta (por si te equivocaste)
  function deshacerUltimoPago() {
    const ultimo = pagosDelEstado.at(-1)
    guardarCredito({ ...config, pagos: (config.pagos ?? []).filter((p) => p !== ultimo) })
  }

  return (
    <section className="rounded-3xl bg-white p-5 dark:bg-stone-900">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="truncate font-semibold text-stone-900 dark:text-stone-100">{config.nombre}</h2>
        <button onClick={alEditar} className="shrink-0 text-sm font-medium text-teal-700 dark:text-teal-300">
          Editar
        </button>
      </div>

      {/* 1) Estado de cuenta ya cerrado: lo que hay que pagar */}
      <div className="rounded-2xl bg-stone-50 p-4 dark:bg-stone-800">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Estado de cuenta{r.oficial ? ' · según tu banco' : ''}
        </p>
        <p className="text-3xl font-semibold tracking-tight text-stone-900 tabular-nums dark:text-stone-50">
          {formatearPesos(r.aPagar)}
        </p>
        {r.oficial && r.saldoFavor > 0 && (
          <p className="mt-1 text-sm font-medium text-emerald-700 dark:text-emerald-400">
            Saldo a favor {formatearPesos(r.saldoFavor)}: pagaste de más y se descuenta del próximo estado de cuenta.
          </p>
        )}
        {!r.oficial && r.favorAplicado > 0 && (
          <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
            Ya descuenta {formatearPesos(r.favorAplicado)} de tu saldo a favor{r.saldoFavor > 0 ? ` (te quedan ${formatearPesos(r.saldoFavor)} a favor)` : ''}.
          </p>
        )}
        {r.estadoOficial?.cupo && (
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            Cupo disponible {formatearPesos(r.estadoOficial.cupo.disponible)} de {formatearPesos(r.estadoOficial.cupo.total)}
          </p>
        )}
        <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
          Compras del {fechaCorta(r.periodoAnterior.desde)} al {fechaCorta(r.periodoAnterior.hasta)}: {formatearPesos(r.compras)}
          {r.cuotas > 0 && ` · Cuotas: ${formatearPesos(r.cuotas)}`}
          {r.comision > 0 && ` · Comisión: ${formatearPesos(r.comision)}`}
        </p>
        {r.arrastre > 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Incluye {formatearPesos(r.arrastre)} que no pagaste del estado anterior + {formatearPesos(r.interesArrastre)} de interés (aprox.)
          </p>
        )}

        {/* Estado del pago */}
        <div className="mt-3 text-sm">
          {r.aPagar === 0 ? (
            <p className="font-medium text-teal-700 dark:text-teal-300">Nada que pagar este mes</p>
          ) : r.pagado ? (
            <p className="font-medium text-teal-700 dark:text-teal-300">✓ Pagado {r.pagadoMonto > 0 && `(${formatearPesos(r.pagadoMonto)})`}</p>
          ) : r.pagadoMonto > 0 ? (
            <p className="text-stone-700 dark:text-stone-300">
              Pagaste {formatearPesos(r.pagadoMonto)} · te faltan <span className="font-semibold">{formatearPesos(r.pendiente)}</span> antes del{' '}
              {fechaCorta(r.fechaPago)}
            </p>
          ) : (
            r.aPagar > 0 && (
              <p className="text-stone-700 dark:text-stone-300">
                Paga antes del <span className="font-semibold">{fechaCorta(r.fechaPago)}</span>
              </p>
            )
          )}
          {pagosDelEstado.length > 0 && (
            <button onClick={deshacerUltimoPago} className="mt-1 text-xs text-stone-500 underline dark:text-stone-400">
              Deshacer último pago
            </button>
          )}
        </div>
      </div>

      {/* Registrar un pago: el total o una parte */}
      {!r.pagado && r.pendiente > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={montoPago ? formatearPesos(montoPago, { mostrar: true }) : ''}
              placeholder={formatearPesos(r.pendiente)}
              onChange={(e) => setMontoPago(Math.min(leerMonto(e.target.value), r.pendiente))}
              aria-label="Cuánto pagaste"
              className="min-w-0 flex-1 rounded-lg bg-stone-100 px-3 py-2 text-base tabular-nums outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
            />
            {cuentas.length > 0 && (
              <select
                value={cuentaPago}
                onChange={(e) => setCuentaPago(e.target.value)}
                aria-label="Cuenta desde la que pagaste"
                className="min-w-0 flex-1 rounded-lg bg-stone-100 px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
              >
                <option value="">Desde…</option>
                {cuentas.map((c) => (
                  <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>
            )}
          </div>
          <button
            onClick={registrarPago}
            disabled={cuentas.length > 0 && !cuentaPago}
            className="w-full rounded-xl bg-teal-700 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {faltaria > 0 ? `Registrar pago de ${formatearPesos(aPagarAhora)}` : 'Ya lo pagué (total)'}
          </button>

          {/* Qué pasa con lo que no pagues */}
          {faltaria > 0 ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Te faltarían {formatearPesos(faltaria)}: pasan al estado del {fechaCorta(r.proximaFechaPago)}
              {config.tasaMensual > 0
                ? ` con aprox. ${formatearPesos(interesFaltante)} de interés (${tasaTexto}% mensual).`
                : ' con interés (agrega la tasa en Editar para estimarlo).'}
            </p>
          ) : (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Escribe un monto menor si no pagas todo. Pagando el total no pagas interés por tus compras en 1 cuota.
            </p>
          )}
        </div>
      )}

      {/* 2) Período en curso */}
      <div className="mt-4 flex items-baseline justify-between px-1">
        <div>
          <p className="text-sm text-stone-500 dark:text-stone-400">Usado desde el {fechaCorta(r.periodoActual.desde)}</p>
          <p className="text-xs text-stone-400">Se factura el {fechaCorta(r.periodoActual.hasta)}</p>
        </div>
        <p className="text-xl font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(r.usadoActual)}</p>
      </div>

      {/* Lo que se viene: lo usado + cuotas + comisión + lo que no pagaste (puede subir si sigues comprando) */}
      <div className="mt-2 flex items-baseline justify-between px-1">
        <p className="text-sm text-stone-500 dark:text-stone-400">Próximo estado de cuenta (estimado)</p>
        <p className="font-semibold text-stone-700 tabular-nums dark:text-stone-300">{formatearPesos(r.proximoEstimado)}</p>
      </div>
      <p className="px-1 text-xs text-stone-400">
        A pagar el {fechaCorta(r.proximaFechaPago)}
        {r.proximoArrastre > 0 && ` · incluye ${formatearPesos(r.proximoArrastre)} pendiente con interés`}
      </p>

      <CuotasCredito tarjeta={config.nombre} cuotas={r.listaCuotas} mesBase={r.mesBase} deuda={r.deudaCuotas} />
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
    .map((c) => ({ ...c, restantes: restantesDe(c, mesBase) }))
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
                  {c.desde && c.desde > mesBase
                    ? `${c.restantes} cuotas · empieza en ${nombreMes(c.desde).toLowerCase()}`
                    : c.restantes === 1
                      ? 'Última cuota'
                      : `Quedan ${c.restantes} cuotas · hasta ${nombreMes(c.hasta).toLowerCase()}`}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">{formatearPesos(c.monto)}</p>
              {/* Las cuotas que vienen de un gasto se cambian editando ese gasto; las anotadas a mano se pueden quitar */}
              {c.deCompra ? (
                <span className="w-6" aria-hidden="true" />
              ) : (
                <button
                  onClick={() => borrarCuota(c.id)}
                  aria-label={`Quitar cuota de ${c.descripcion}`}
                  className="-mr-2 grid size-8 place-items-center rounded-full text-stone-400 active:bg-stone-100 dark:active:bg-stone-800"
                >
                  ✕
                </button>
              )}
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
              value={monto ? formatearPesos(monto, { mostrar: true }) : ''}
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
            value={comision ? formatearPesos(comision, { mostrar: true }) : ''}
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
