import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, aplicarImportacion, guardarCuenta, guardarPreferencia, guardarRegla } from '../db.js'
import { lineasDePdf } from '../lib/pdf.js'
import { leerDocumento } from '../lib/lectores.js'
import { prepararImportacion, adivinarDestino, contarPropuestas } from '../lib/importar.js'
import { reglaDesde } from '../lib/reglas.js'
import { CATEGORIAS, buscarCategoria } from '../lib/categorias.js'
import { formatearPesos, fechaCorta } from '../lib/formato.js'
import { Iconos } from './Marco.jsx'

const NUEVA = '__nueva__'

const ETIQUETAS = {
  nuevo: { texto: 'Nuevo', clase: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200' },
  existente: { texto: 'Ya lo tienes', clase: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300' },
  completar: { texto: 'Se completa', clase: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
  omitido: { texto: 'Se omite', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200' },
}

// Pantalla para importar cartolas y estados de cuenta en PDF.
// El PDF se abre dentro del teléfono: no se sube a ningún lado y no se guarda (solo los movimientos que elijas).
export default function ImportarCartola({ movimientos, alCerrar }) {
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], [])
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const cuotas = useLiveQuery(() => db.cuotas.toArray(), [], [])
  const reglas = useLiveQuery(() => db.reglas.toArray(), [], [])
  const titularGuardado = useLiveQuery(async () => (await db.preferencias.get('titular'))?.valor ?? '', [], '')

  const [archivos, setArchivos] = useState([]) // cola de PDFs elegidos
  const [indice, setIndice] = useState(0)
  const [paso, setPaso] = useState('elegir') // elegir · leyendo · clave · revisar · listo
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState('')
  const [doc, setDoc] = useState(null)
  const [destino, setDestino] = useState(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [cambios, setCambios] = useState({}) // id -> { incluir?, categoria? }
  const [ajustarSaldo, setAjustarSaldo] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [resumenFinal, setResumenFinal] = useState([])
  const entrada = useRef(null)

  const titular = titularGuardado || doc?.titular || ''
  const nombreDestino = destino === NUEVA ? nombreNuevo.trim() : destino

  // Propuestas: se recalculan si cambias la cuenta de destino o llegan datos nuevos
  const plan = useMemo(() => {
    if (!doc || !nombreDestino) return null
    return prepararImportacion(doc, { cuentas, creditos, cuotas, movimientos, reglas, titular, destino: nombreDestino })
  }, [doc, nombreDestino, cuentas, creditos, cuotas, movimientos, reglas, titular])

  const propuestas = (plan?.propuestas ?? []).map((p) => ({
    ...p,
    incluir: cambios[p.id]?.incluir ?? p.incluir,
    categoria: cambios[p.id]?.categoria ?? p.datos?.categoria,
  }))
  const cuenta = contarPropuestas(propuestas)

  async function abrir(archivo, clave) {
    setPaso('leyendo')
    setError('')
    try {
      const lineas = await lineasDePdf(await archivo.arrayBuffer(), clave)
      const leido = leerDocumento(lineas)
      setDoc(leido)
      setCambios({})
      setAjustarSaldo(true)
      const sugerido = adivinarDestino(leido, { cuentas, creditos })
      setDestino(sugerido ?? ((leido.tipo === 'tarjeta' ? creditos : cuentas).length === 0 ? NUEVA : null))
      setNombreNuevo(leido.tipo === 'tarjeta' ? `Crédito ${leido.banco}` : `Cuenta ${leido.banco}`)
      setPaso('revisar')
    } catch (e) {
      if (e.codigo === 'contrasena' || e.codigo === 'contrasena-incorrecta') {
        setError(e.codigo === 'contrasena-incorrecta' ? 'Contraseña incorrecta. Intenta de nuevo.' : '')
        setPaso('clave')
      } else {
        setError(e.message)
        setPaso('error')
      }
    }
  }

  function elegirArchivos(e) {
    const lista = [...(e.target.files ?? [])]
    e.target.value = ''
    if (lista.length === 0) return
    setArchivos(lista)
    setIndice(0)
    setContrasena('')
    abrir(lista[0])
  }

  function siguiente() {
    const proximo = indice + 1
    if (proximo < archivos.length) {
      setIndice(proximo)
      setDoc(null)
      abrir(archivos[proximo], contrasena) // los PDF del mismo banco suelen tener la misma clave
    } else {
      setPaso('listo')
    }
  }

  async function importar() {
    setGuardando(true)
    try {
      if (!titularGuardado && doc.titular) await guardarPreferencia('titular', doc.titular)
      // Cuenta nueva: parte con el saldo final de la cartola
      if (destino === NUEVA && doc.tipo === 'cartola') {
        await guardarCuenta({ nombre: nombreDestino, saldoInicial: doc.saldoFinal ?? 0, fechaSaldo: doc.hasta, momentoSaldo: Date.now() + 1, digitos: doc.digitos })
      }
      const elegidas = propuestas
        .filter((p) => p.incluir)
        .map((p) => (p.tipo === 'movimiento' && p.categoria ? { ...p, datos: { ...p.datos, categoria: p.categoria } } : p))
      const agregados = await aplicarImportacion(plan, elegidas, { ajustarSaldo: ajustarSaldo && destino !== NUEVA })
      // Categorías que cambiaste a mano: Lumio las aprende para la próxima
      for (const p of elegidas) {
        if (p.tipo === 'movimiento' && cambios[p.id]?.categoria) {
          const regla = reglaDesde({ ...p.datos, nota: p.detalleBanco })
          if (regla) await guardarRegla(regla)
        }
      }
      setResumenFinal((r) => [...r, `${titulo(doc)}: ${agregados} movimientos nuevos`])
      siguiente()
    } catch (e) {
      setError(`No se pudo guardar: ${e.message}`)
    } finally {
      setGuardando(false)
    }
  }

  const opcionesDestino = doc?.tipo === 'tarjeta' ? creditos : cuentas
  const puedeImportar = plan && doc.verificacion.ok && nombreDestino && cuenta.elegidos > 0 && !guardando

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <button aria-label="Cerrar" onClick={alCerrar} className="fondo-entrar absolute inset-0 bg-black/40" />
      <div
        role="dialog"
        aria-label="Importar cartola"
        className="hoja-entrar safe-bottom relative mx-auto flex max-h-[95dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-stone-100 shadow-2xl dark:bg-stone-950"
      >
        <div className="cabecera shrink-0 px-5 pt-3 pb-5 text-white">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/30" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-teal-300">{archivos.length > 1 ? `Archivo ${indice + 1} de ${archivos.length}` : 'Cartola o estado de cuenta'}</p>
              <h2 className="truncate text-xl font-semibold">{doc ? titulo(doc) : 'Importar PDF del banco'}</h2>
            </div>
            <button onClick={alCerrar} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-teal-100">
              <Iconos.cerrar />
            </button>
          </div>
          {doc && (
            <p className="mt-1 text-sm text-teal-200">
              {fechaCorta(doc.desde)} al {fechaCorta(doc.hasta)} · {doc.tipo === 'tarjeta' ? `tarjeta ····${doc.digitos}` : `cuenta ····${doc.digitos}`}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
          <input ref={entrada} type="file" accept="application/pdf,.pdf" multiple onChange={elegirArchivos} className="hidden" />

          {paso === 'elegir' && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-white p-4 text-sm text-stone-600 dark:bg-stone-900 dark:text-stone-300">
                <p className="mb-2">Lumio lee por ahora:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Cartola de cuenta corriente del Banco de Chile</li>
                  <li>Cartola de cuenta corriente del Banco Falabella</li>
                  <li>Estado de cuenta de tarjeta de crédito del Banco de Chile</li>
                </ul>
                <p className="mt-3 text-xs text-stone-500 dark:text-stone-400">
                  El PDF se abre en tu iPhone: no se sube a ningún lado y no se guarda. Antes de importar ves todo y eliges qué entra.
                </p>
              </div>
              <button onClick={() => entrada.current?.click()} className="boton-morado w-full rounded-2xl py-4 text-lg font-semibold text-white">
                Elegir PDF
              </button>
              <p className="text-center text-xs text-stone-500 dark:text-stone-400">Puedes elegir varios a la vez, en cualquier orden.</p>
            </div>
          )}

          {paso === 'leyendo' && <p className="py-10 text-center text-stone-500 dark:text-stone-400">Leyendo el PDF…</p>}

          {paso === 'clave' && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                abrir(archivos[indice], contrasena)
              }}
              className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900"
            >
              <p className="font-medium text-stone-900 dark:text-stone-100">Este PDF tiene contraseña</p>
              <p className="text-sm text-stone-500 dark:text-stone-400">Es la misma con la que lo abres siempre. Se usa solo para abrirlo aquí y no se guarda.</p>
              <input
                autoFocus
                type="password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                aria-label="Contraseña del PDF"
                className="w-full rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
              />
              <p className="h-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
              <button type="submit" disabled={!contrasena} className="w-full rounded-xl bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-50">
                Abrir
              </button>
            </form>
          )}

          {paso === 'error' && (
            <div className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900">
              <p className="text-stone-900 dark:text-stone-100" role="alert">{error}</p>
              <button onClick={siguiente} className="w-full rounded-xl bg-stone-100 py-2.5 font-medium text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                {indice + 1 < archivos.length ? 'Saltar este archivo' : 'Volver'}
              </button>
            </div>
          )}

          {paso === 'revisar' && doc && (
            <div className="space-y-3">
              {/* Verificación */}
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${doc.verificacion.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'}`}
              >
                {doc.verificacion.ok ? '✓ ' : ''}
                {doc.verificacion.mensaje}
                {!doc.verificacion.ok && ' Por seguridad no se importará.'}
              </div>

              {/* A qué cuenta o tarjeta va */}
              <div className="space-y-2 rounded-2xl bg-white p-4 dark:bg-stone-900">
                <label htmlFor="destino" className="text-sm font-semibold text-stone-700 dark:text-stone-300">
                  {doc.tipo === 'tarjeta' ? 'Tarjeta de crédito en Lumio' : 'Cuenta en Lumio'}
                </label>
                <select
                  id="destino"
                  value={destino ?? ''}
                  onChange={(e) => setDestino(e.target.value || null)}
                  className="w-full rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none dark:bg-stone-800 dark:text-white"
                >
                  <option value="">Elige…</option>
                  {opcionesDestino.map((c) => (
                    <option key={c.nombre} value={c.nombre}>{c.nombre}{c.digitos ? ` ····${c.digitos}` : ''}</option>
                  ))}
                  <option value={NUEVA}>{doc.tipo === 'tarjeta' ? '+ Nueva tarjeta' : '+ Nueva cuenta'}</option>
                </select>
                {destino === NUEVA && (
                  <input
                    value={nombreNuevo}
                    onChange={(e) => setNombreNuevo(e.target.value)}
                    aria-label="Nombre de la nueva cuenta"
                    className="w-full rounded-xl bg-stone-100 px-3 py-2.5 text-base outline-none dark:bg-stone-800 dark:text-white"
                  />
                )}
                {destino === NUEVA && doc.tipo === 'cartola' && (
                  <p className="text-xs text-stone-500 dark:text-stone-400">Parte con el saldo final de la cartola: {formatearPesos(doc.saldoFinal ?? 0)}.</p>
                )}
              </div>

              {doc.tipo === 'tarjeta' && <DatosTarjeta doc={doc} plan={plan} />}

              {plan?.ajusteSaldo && (
                <label className="flex items-start gap-3 rounded-2xl bg-white p-4 text-sm dark:bg-stone-900">
                  <input type="checkbox" checked={ajustarSaldo} onChange={(e) => setAjustarSaldo(e.target.checked)} className="mt-0.5 size-4 accent-teal-700" />
                  <span className="text-stone-700 dark:text-stone-300">
                    Ajustar el saldo de <span className="font-medium">{plan.ajusteSaldo.cuenta}</span> a{' '}
                    <span className="font-semibold">{formatearPesos(plan.ajusteSaldo.saldo)}</span> (saldo del banco al {fechaCorta(plan.ajusteSaldo.fecha)})
                  </span>
                </label>
              )}

              {plan && (
                <>
                  <p className="px-1 text-sm text-stone-500 dark:text-stone-400">
                    {cuenta.nuevos} nuevos · {cuenta.existentes} ya los tienes{cuenta.completar ? ` · ${cuenta.completar} se completan` : ''}
                    {cuenta.omitidos ? ` · ${cuenta.omitidos} se omiten` : ''}
                  </p>
                  <ul className="divide-y divide-stone-100 rounded-2xl bg-white px-3 dark:divide-stone-800 dark:bg-stone-900">
                    {propuestas.map((p) => (
                      <FilaPropuesta
                        key={p.id}
                        p={p}
                        alCambiar={(c) => setCambios((todo) => ({ ...todo, [p.id]: { ...todo[p.id], ...c } }))}
                      />
                    ))}
                  </ul>
                </>
              )}

              <p className="h-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
            </div>
          )}

          {paso === 'listo' && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">Listo</p>
              {resumenFinal.map((r) => (
                <p key={r} className="text-sm text-stone-600 dark:text-stone-300">{r}</p>
              ))}
              <button onClick={alCerrar} className="w-full rounded-xl bg-teal-700 py-2.5 font-semibold text-white">Cerrar</button>
            </div>
          )}
        </div>

        {paso === 'revisar' && (
          <div className="shrink-0 border-t border-stone-200 bg-stone-100 px-4 pt-3 dark:border-stone-800 dark:bg-stone-950">
            <div className="flex gap-2">
              {archivos.length > 1 && (
                <button onClick={siguiente} className="rounded-2xl bg-white px-4 py-3.5 font-medium text-stone-700 dark:bg-stone-900 dark:text-stone-200">
                  Saltar
                </button>
              )}
              <button
                onClick={importar}
                disabled={!puedeImportar}
                className="boton-morado flex-1 rounded-2xl py-3.5 text-lg font-semibold text-white disabled:opacity-40 disabled:shadow-none"
              >
                {guardando ? 'Guardando…' : `Importar ${cuenta.elegidos}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function titulo(doc) {
  return doc.tipo === 'tarjeta' ? `Estado de cuenta ${doc.banco}` : `Cartola N° ${doc.numero} · ${doc.banco}`
}

// Lo que dice el banco en el estado de cuenta (se guarda en la configuración de la tarjeta)
function DatosTarjeta({ doc, plan }) {
  const favor = doc.total < 0
  return (
    <div className="space-y-1 rounded-2xl bg-white p-4 text-sm dark:bg-stone-900">
      <div className="flex justify-between">
        <span className="text-stone-500 dark:text-stone-400">{favor ? 'Saldo a favor' : 'Total facturado'}</span>
        <span className="font-semibold text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(Math.abs(doc.total ?? 0))}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-stone-500 dark:text-stone-400">Pagar hasta</span>
        <span className="text-stone-900 dark:text-stone-100">{fechaCorta(doc.pagarHasta)}</span>
      </div>
      {doc.cupo && (
        <div className="flex justify-between">
          <span className="text-stone-500 dark:text-stone-400">Cupo disponible</span>
          <span className="text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(doc.cupo.disponible)}</span>
        </div>
      )}
      <p className="pt-1 text-xs text-stone-500 dark:text-stone-400">
        {plan?.esUltimo === false
          ? 'Es un estado de cuenta antiguo: se guardan sus compras y pagos como historial.'
          : 'Se actualizan las fechas de cierre y pago, la tasa y la comisión de tu tarjeta.'}
      </p>
    </div>
  )
}

function FilaPropuesta({ p, alCambiar }) {
  const etiqueta = ETIQUETAS[p.estado]
  const editable = p.estado !== 'omitido'
  const conCategoria = p.tipo === 'movimiento' && p.datos?.tipo !== 'transferencia' && p.estado === 'nuevo'
  const lista = CATEGORIAS[p.datos?.tipo] ?? []
  return (
    <li className="py-2.5">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={p.incluir}
          disabled={!editable}
          onChange={(e) => alCambiar({ incluir: e.target.checked })}
          aria-label={`Incluir ${p.titulo}`}
          className="mt-1 size-4 shrink-0 accent-teal-700"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`truncate text-sm font-medium ${p.incluir ? 'text-stone-900 dark:text-stone-100' : 'text-stone-500 dark:text-stone-400'}`}>{p.titulo}</p>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">
              {p.signo}
              {formatearPesos(p.monto)}
            </p>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
            <span>{fechaCorta(p.fecha)}</span>
            <span className={`rounded-full px-2 py-0.5 font-medium ${etiqueta.clase}`}>{etiqueta.texto}</span>
            {p.motivo && <span>{p.motivo}</span>}
          </div>
          {conCategoria && p.incluir && (
            <select
              value={p.categoria}
              onChange={(e) => alCambiar({ categoria: e.target.value })}
              aria-label={`Categoría de ${p.titulo}`}
              className="mt-1.5 rounded-lg bg-stone-100 px-2 py-1 text-sm outline-none dark:bg-stone-800 dark:text-white"
            >
              {lista.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              {!lista.some((c) => c.id === p.categoria) && <option value={p.categoria}>{buscarCategoria(p.categoria).nombre}</option>}
            </select>
          )}
        </div>
      </div>
    </li>
  )
}
