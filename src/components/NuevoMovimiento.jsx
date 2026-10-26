import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CATEGORIAS, categoriaOtros } from '../lib/categorias.js'
import { ordenarPorUso, tarjetasUsadas, unirTarjetas } from '../lib/calculos.js'
import { mismaTarjeta, primerMesDePago } from '../lib/credito.js'
import { formatearPesos, hoyISO, leerMonto, nombreMes, sumarMeses } from '../lib/formato.js'
import { Iconos } from './Marco.jsx'
import { db, agregarMovimiento, actualizarMovimiento, esPosibleDuplicado } from '../db.js'

const OPCIONES_CUOTAS = [1, 2, 3, 4, 6, 10, 12, 18, 24, 36]

// Hoja que sube desde abajo para anotar un gasto, un ingreso o una transferencia entre tus cuentas.
// "inicial" trae datos pre-rellenados (por ejemplo, desde un Atajo de Apple Pay).
export default function NuevoMovimiento({ inicial, movimientos, alCerrar, alGuardar }) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? 'gasto')
  const [monto, setMonto] = useState(inicial?.monto ?? 0)
  const [categoria, setCategoria] = useState(inicial?.categoria ?? null)
  const [nota, setNota] = useState(inicial?.nota ?? '')
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyISO())
  const [medioPago, setMedioPago] = useState(inicial?.medioPago ?? '')
  const [escribiendoTarjeta, setEscribiendoTarjeta] = useState(false)
  const [cuotas, setCuotas] = useState(inicial?.cuotas ?? 1)
  const [valorCuota, setValorCuota] = useState(inicial?.valorCuota ?? 0) // 0 = calcular monto ÷ cuotas
  const [destino, setDestino] = useState(inicial?.destino ?? '') // solo transferencias: cuenta que recibe
  const [escribiendoDestino, setEscribiendoDestino] = useState(false)
  const esTransferencia = tipo === 'transferencia'

  // Tus tarjetas de crédito configuradas en Análisis (aparecen aunque todavía no las hayas usado)
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], [])

  // Gasto: "Pagado con" = tarjetas ya usadas + tarjetas de crédito + tus cuentas + Efectivo
  // Ingreso: "Recibido en" = tus cuentas (débito, efectivo); nunca una tarjeta de crédito
  // Transferencia: "Desde" y "Hacia" = tus cuentas + Efectivo
  const editado = inicial?.medioPago ? [inicial.medioPago] : []
  const cuentasPropias = unirTarjetas(cuentas.map((c) => c.nombre), ['Efectivo'], editado, inicial?.destino ? [inicial.destino] : [])
  const mediosDePago =
    tipo === 'gasto'
      ? unirTarjetas(tarjetasUsadas(movimientos), creditos.map((c) => c.nombre), cuentas.map((c) => c.nombre), ['Efectivo'], editado)
      : esTransferencia
        ? cuentasPropias
        : unirTarjetas(cuentas.map((c) => c.nombre), editado)
  const destinos = cuentasPropias.filter((c) => !mismaTarjeta(c, medioPago)) // no se transfiere a la misma cuenta

  // Si lo que elegiste es una tarjeta de crédito configurada, se puede pagar en cuotas
  const credito = creditos.find((c) => mismaTarjeta(c.nombre, medioPago))
  const enCuotas = tipo === 'gasto' && credito && cuotas > 1
  const cuotaCalculada = enCuotas ? valorCuota || Math.round(monto / cuotas) : 0
  const primeraCuota = enCuotas ? primerMesDePago(fecha, credito) : null

  // Si "inicial" trae un id, es un movimiento que ya existe: estamos editando
  const editando = Boolean(inicial?.id)
  const [error, setError] = useState('')
  const [avisoDuplicado, setAvisoDuplicado] = useState(false)

  // Las más usadas primero; si editas, la categoría del movimiento va al principio para que se vea
  const categorias = ordenarPorUso(CATEGORIAS[tipo] ?? [], movimientos).sort(
    (a, b) => (b.id === inicial?.categoria) - (a.id === inicial?.categoria),
  )

  function cambiarTipo(nuevo) {
    setTipo(nuevo)
    setCategoria(null) // las categorías de gasto e ingreso son distintas
    setMedioPago('') // un ingreso no llega a una tarjeta de crédito, así que se vuelve a elegir
    setEscribiendoTarjeta(false)
    setCuotas(1)
    setDestino('')
    setEscribiendoDestino(false)
  }

  // Teclado numérico propio: más grande y cómodo que el del sistema
  function tecla(valor) {
    setError('')
    setAvisoDuplicado(false)
    if (valor === 'borrar') return setMonto((m) => Math.floor(m / 10))
    if (valor === '000') return setMonto((m) => (m === 0 ? 0 : Math.min(m * 1000, 999_999_999)))
    setMonto((m) => Math.min(m * 10 + valor, 999_999_999))
  }

  async function guardar(forzar = false) {
    if (monto <= 0) return setError('Escribe un monto mayor a $0')
    if (esTransferencia) {
      if (!medioPago.trim() || !destino.trim()) return setError('Elige desde qué cuenta y hacia cuál')
      if (mismaTarjeta(medioPago, destino)) return setError('Elige dos cuentas distintas')
    }
    const mov = {
      tipo,
      monto,
      categoria: esTransferencia ? 'transferencia' : (categoria ?? categoriaOtros(tipo)),
      destino: esTransferencia ? destino.trim() : '',
      fecha,
      nota: nota.trim(),
      medioPago: medioPago.trim(), // gasto: con qué pagaste · ingreso: dónde llegó · transferencia: desde dónde
      cuotas: enCuotas ? cuotas : 1,
      valorCuota: enCuotas ? cuotaCalculada : 0,
      origen: inicial?.origen ?? 'manual',
    }
    if (editando) {
      await actualizarMovimiento(inicial.id, mov)
      return alGuardar({ ...mov, id: inicial.id }, inicial) // "inicial" = cómo estaba antes
    }
    if (!forzar && (await esPosibleDuplicado(mov))) return setAvisoDuplicado(true)
    const id = await agregarMovimiento(mov)
    alGuardar({ ...mov, id })
  }


  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      {/* Fondo oscuro: tocarlo cierra la hoja */}
      <button aria-label="Cerrar" onClick={alCerrar} className="fondo-entrar absolute inset-0 bg-black/40" />

      <div
        role="dialog"
        aria-label="Nuevo movimiento"
        className="hoja-entrar safe-bottom relative mx-auto max-h-[95dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-stone-100 px-4 shadow-2xl dark:bg-stone-950"
      >
        {/* Parte morada de arriba: tipo y monto */}
        <div className="cabecera -mx-4 mb-4 rounded-t-3xl px-4 pt-3 pb-4 text-white">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/30" />

        {/* Gasto / Ingreso / Transferencia */}
        <div className="mb-3 grid grid-cols-3 rounded-xl bg-white/10 p-1 text-sm font-semibold">
          {[
            ['gasto', 'Gasto'],
            ['ingreso', 'Ingreso'],
            ['transferencia', 'Transferencia'],
          ].map(([t, etiqueta]) => (
            <button
              key={t}
              onClick={() => cambiarTipo(t)}
              className={`rounded-lg py-2 transition-colors ${
                tipo === t ? 'bg-white text-teal-950 shadow-sm' : 'text-teal-200'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {/* Monto */}
        <div className="mb-1 text-center">
          <p className={`text-5xl font-semibold tracking-tight tabular-nums ${monto ? '' : 'text-white/35'}`}>
            {tipo === 'ingreso' && monto ? '+' : ''}
            {formatearPesos(monto)}
          </p>
          <p className="h-5 text-sm text-red-300" role="alert">{error}</p>
        </div>
        </div>

        {/* Transferencias: explicación corta en vez de categorías */}
        {esTransferencia && (
          <p className="mb-3 text-center text-xs text-stone-500 dark:text-stone-400">
            Mueve plata entre tus cuentas (ej. retiro en cajero = débito → Efectivo). No cuenta como gasto.
            <br />
            Si le pagas a otra persona, usa <span className="font-medium">Gasto</span>.
          </p>
        )}

        {/* Categorías (las más usadas primero) */}
        {!esTransferencia && (
          <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoria(c.id)}
                className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                  categoria === c.id
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                }`}
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}

        {/* Pagado con / Recibido en. Tocar la opción elegida otra vez la quita. */}
        <div className="-mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
            {tipo === 'gasto' ? 'Pagado con' : tipo === 'ingreso' ? 'Recibido en' : 'Desde'}
          </span>
          {mediosDePago.map((m) => (
            <button
              key={m}
              onClick={() => {
                setMedioPago(mismaTarjeta(medioPago, m) ? '' : m)
                setEscribiendoTarjeta(false)
                setError('')
              }}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                mismaTarjeta(medioPago, m) && !escribiendoTarjeta
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-stone-200 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
              }`}
            >
              {m}
            </button>
          ))}
          <button
            onClick={() => {
              setEscribiendoTarjeta(true)
              setMedioPago('')
            }}
            className="shrink-0 rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs font-medium text-stone-500 dark:border-stone-600 dark:text-stone-400"
          >
            + Otra
          </button>
        </div>

        {/* Escribir una tarjeta que no está en la lista */}
        {escribiendoTarjeta && (
          <input
            autoFocus
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
            placeholder="Nombre de la tarjeta (como en Wallet)"
            maxLength={40}
            className="mb-3 w-full rounded-xl bg-white px-3 py-2 text-base outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
        )}

        {/* Transferencia: cuenta que recibe la plata */}
        {esTransferencia && (
          <div className="-mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
            <span className="shrink-0 text-xs text-stone-500 dark:text-stone-400">Hacia</span>
            {destinos.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setDestino(mismaTarjeta(destino, c) ? '' : c)
                  setEscribiendoDestino(false)
                  setError('')
                }}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                  mismaTarjeta(destino, c) && !escribiendoDestino
                    ? 'border-teal-700 bg-teal-700 text-white'
                    : 'border-stone-200 text-stone-600 dark:border-stone-700 dark:text-stone-300'
                }`}
              >
                {c}
              </button>
            ))}
            <button
              onClick={() => {
                setEscribiendoDestino(true)
                setDestino('')
              }}
              className="shrink-0 rounded-full border border-dashed border-stone-300 px-3 py-1 text-xs font-medium text-stone-500 dark:border-stone-600 dark:text-stone-400"
            >
              + Otra
            </button>
          </div>
        )}
        {esTransferencia && escribiendoDestino && (
          <input
            autoFocus
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="Nombre de la cuenta (ej. Ahorro)"
            maxLength={40}
            className="mb-3 w-full rounded-xl bg-white px-3 py-2 text-base outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
        )}

        {/* Cuotas: solo si pagaste con una tarjeta de crédito configurada */}
        {tipo === 'gasto' && credito && (
          <div className="mb-3 rounded-xl bg-white p-3 dark:bg-stone-900">
            <div className="flex items-center gap-2">
              <label htmlFor="cuotas" className="text-sm text-stone-600 dark:text-stone-300">En</label>
              <select
                id="cuotas"
                value={cuotas}
                onChange={(e) => {
                  setCuotas(Number(e.target.value))
                  setValorCuota(0) // vuelve a calcular la cuota
                }}
                className="rounded-lg bg-white px-2 py-1.5 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-700 dark:text-white"
              >
                {OPCIONES_CUOTAS.map((n) => (
                  <option key={n} value={n}>{n === 1 ? '1 cuota' : `${n} cuotas`}</option>
                ))}
              </select>
              {enCuotas && (
                <>
                  <span className="text-sm text-stone-600 dark:text-stone-300">de</span>
                  <input
                    inputMode="numeric"
                    value={formatearPesos(cuotaCalculada)}
                    onChange={(e) => setValorCuota(leerMonto(e.target.value))}
                    aria-label="Valor de cada cuota"
                    className="min-w-0 flex-1 rounded-lg bg-white px-2 py-1.5 text-base tabular-nums outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-700 dark:text-white"
                  />
                </>
              )}
            </div>
            {enCuotas && (
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                Primera cuota en {nombreMes(primeraCuota).toLowerCase()}, última en{' '}
                {nombreMes(sumarMeses(primeraCuota, cuotas - 1)).toLowerCase()}. Si tiene interés, cambia el valor por el del voucher.
              </p>
            )}
          </div>
        )}

        {/* Nota y fecha */}
        <div className="mb-3 flex gap-2">
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota (opcional)"
            maxLength={60}
            className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2.5 text-base outline-none placeholder:text-stone-400 focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => e.target.value && setFecha(e.target.value)}
            aria-label="Fecha"
            className="w-36 rounded-xl bg-white px-2 py-2.5 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
          />
        </div>

        {/* Teclado numérico */}
        <div className="mb-3 grid grid-cols-3 gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, '000', 0, 'borrar'].map((t) => (
            <button
              key={t}
              onClick={() => tecla(t)}
              aria-label={t === 'borrar' ? 'Borrar' : String(t)}
              className="rounded-xl bg-white py-3 text-2xl font-medium text-stone-800 active:scale-95 active:bg-stone-200 dark:bg-stone-900 dark:text-stone-100 dark:active:bg-stone-700"
            >
              {t === 'borrar' ? <span className="inline-grid place-items-center"><Iconos.borrar /></span> : t}
            </button>
          ))}
        </div>

        {avisoDuplicado ? (
          <div className="mb-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <p className="mb-2">Anotaste algo igual hace menos de un minuto. ¿Es un duplicado?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={alCerrar} className="rounded-lg bg-white py-2 font-medium dark:bg-stone-800">
                Sí, descartar
              </button>
              <button onClick={() => guardar(true)} className="rounded-lg bg-amber-600 py-2 font-medium text-white">
                No, guardar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => guardar()}
            className="boton-morado w-full rounded-2xl py-4 text-lg font-semibold text-white active:scale-[0.98]"
          >
            {editando ? 'Guardar cambios' : 'Guardar'}
          </button>
        )}
      </div>
    </div>
  )
}
