import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportarDatos, reemplazarDatos, guardarCopiaPrevia, leerCopiaPrevia, guardarFijo, borrarFijo, guardarPreferencia } from '../db.js'
import { CATEGORIAS } from '../lib/categorias.js'
import { Iconos } from './Marco.jsx'
import { tarjetasUsadas, unirTarjetas } from '../lib/calculos.js'
import { mismaTarjeta } from '../lib/credito.js'
import { formatearPesos, hoyISO, leerMonto } from '../lib/formato.js'
import {
  armarRespaldo,
  nombreArchivo,
  leerArchivoRespaldo,
  validarRespaldo,
  resumirRespaldo,
  cifrarRespaldo,
  descifrarRespaldo,
  leerUltimoRespaldo,
  anotarRespaldo,
  diasDesdeRespaldo,
} from '../lib/respaldo.js'
import { VERSION } from '../version.js'
import FormularioCuentas from './FormularioCuentas.jsx'
import ConexionWallet from './ConexionWallet.jsx'

// Pantalla de Ajustes: cuentas, Wallet, respaldo y versión
export default function Ajustes({ movimientos, wallet, alAviso, alVerNovedades, alImportar }) {
  return (
    <div className="space-y-6">
      <Grupo titulo="Mis cuentas">
        <SeccionCuentas movimientos={movimientos} />
      </Grupo>

      <Grupo titulo="Cartolas y estados de cuenta">
        <SeccionImportar alImportar={alImportar} />
      </Grupo>

      <Grupo titulo="Gastos fijos">
        <SeccionFijos movimientos={movimientos} />
      </Grupo>

      {wallet && (
        <Grupo titulo="Pagos de Wallet">
          <ConexionWallet conectada={wallet.conectada} alConectar={wallet.alConectar} alDesconectar={wallet.alDesconectar} />
        </Grupo>
      )}

      <Grupo titulo="Respaldo">
        <SeccionRespaldo alAviso={alAviso} />
      </Grupo>

      <Grupo titulo="Acerca de">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 dark:bg-stone-900">
          <img src="./icon-192-v5.png" alt="" width="52" height="52" className="shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-stone-900 dark:text-stone-100">Lumio</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">Tus gastos, en un solo lugar</p>
            <p className="text-xs text-stone-400">Versión {VERSION} · beta</p>
          </div>
          <button onClick={alVerNovedades} className="text-sm font-medium text-teal-700 dark:text-teal-300">
            Novedades
          </button>
        </div>
      </Grupo>
    </div>
  )
}

function Grupo({ titulo, children }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold tracking-wide text-stone-500 uppercase dark:text-stone-400">{titulo}</h2>
      {children}
    </section>
  )
}

// ---- Cuentas ----

function SeccionCuentas({ movimientos }) {
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], null)
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const [editando, setEditando] = useState(false)

  if (cuentas === null) return null

  if (editando || cuentas.length === 0) {
    // Sugerencias: tarjetas ya usadas que NO son de crédito, más Efectivo y Ahorro
    const sugeridas = unirTarjetas(tarjetasUsadas(movimientos), ['Efectivo', 'Ahorro']).filter(
      (t) => !creditos.some((c) => mismaTarjeta(c.nombre, t)),
    )
    return <FormularioCuentas cuentas={cuentas} sugeridas={sugeridas} alTerminar={() => setEditando(false)} />
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-2 dark:bg-stone-900">
      <ul className="divide-y divide-stone-100 dark:divide-stone-800">
        {cuentas.map((c) => (
          <li key={c.nombre} className="flex justify-between gap-3 py-2 text-stone-900 dark:text-stone-100">
            <span className="truncate">{c.nombre}</span>
            {c.digitos && <span className="shrink-0 text-sm text-stone-400 tabular-nums">····{c.digitos}</span>}
          </li>
        ))}
      </ul>
      <button onClick={() => setEditando(true)} className="mb-1 text-sm font-medium text-teal-700 dark:text-teal-300">
        Editar cuentas y saldos
      </button>
    </div>
  )
}

// ---- Respaldo ----

// Comparte el archivo (en iPhone abre el menú para guardarlo en Archivos/iCloud) o lo descarga
async function entregarArchivo(texto, nombre) {
  const archivo = new File([texto], nombre, { type: 'application/json' })
  if (navigator.canShare?.({ files: [archivo] })) {
    await navigator.share({ files: [archivo], title: 'Respaldo de Lumio' })
    return
  }
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre
  enlace.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const fechaHora = new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' })

function SeccionRespaldo({ alAviso }) {
  const [ultimo, setUltimo] = useState(leerUltimoRespaldo)
  const [conContrasena, setConContrasena] = useState(false)
  const [contrasena, setContrasena] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  // Restaurar: archivo leído -> (contraseña si está cifrado) -> resumen -> confirmar
  const [archivoLeido, setArchivoLeido] = useState(null)
  const [contrasenaArchivo, setContrasenaArchivo] = useState('')
  const [porRestaurar, setPorRestaurar] = useState(null)
  const [errorRestaurar, setErrorRestaurar] = useState('')
  const copiaPrevia = useLiveQuery(() => leerCopiaPrevia(), [], null)

  const dias = diasDesdeRespaldo(ultimo)

  async function crearRespaldo() {
    setError('')
    if (conContrasena) {
      if (contrasena.length < 6) return setError('Usa una contraseña de al menos 6 caracteres')
      if (contrasena !== repetir) return setError('Las contraseñas no coinciden')
    }
    setTrabajando(true)
    try {
      let respaldo = armarRespaldo(await exportarDatos(), VERSION)
      if (conContrasena) respaldo = await cifrarRespaldo(respaldo, contrasena)
      await entregarArchivo(JSON.stringify(respaldo), nombreArchivo(hoyISO()))
      anotarRespaldo()
      setUltimo(Date.now())
      setContrasena('')
      setRepetir('')
      alAviso('Respaldo creado')
    } catch (e) {
      if (e.name !== 'AbortError') setError('No se pudo crear el respaldo') // AbortError = cerraste el menú de compartir
    } finally {
      setTrabajando(false)
    }
  }

  async function elegirArchivo(e) {
    const archivo = e.target.files[0]
    e.target.value = ''
    if (!archivo) return
    setErrorRestaurar('')
    setPorRestaurar(null)
    try {
      const objeto = leerArchivoRespaldo(await archivo.text())
      if (objeto.cifrado) setArchivoLeido(objeto)
      else setPorRestaurar(validarRespaldo(objeto))
    } catch (err) {
      setErrorRestaurar(err.message)
    }
  }

  async function abrirCifrado(e) {
    e.preventDefault()
    try {
      setPorRestaurar(validarRespaldo(await descifrarRespaldo(archivoLeido, contrasenaArchivo)))
      setArchivoLeido(null)
      setContrasenaArchivo('')
      setErrorRestaurar('')
    } catch (err) {
      setErrorRestaurar(err.message)
    }
  }

  async function confirmarRestaurar() {
    setTrabajando(true)
    try {
      await guardarCopiaPrevia() // por si elegiste el archivo equivocado
      await reemplazarDatos(porRestaurar.datos)
      setPorRestaurar(null)
      alAviso('Datos restaurados')
    } catch {
      setErrorRestaurar('No se pudo restaurar. Tus datos no cambiaron.')
    } finally {
      setTrabajando(false)
    }
  }

  async function volverACopia() {
    await reemplazarDatos(copiaPrevia.datos)
    await db.copias.delete('antes-de-restaurar')
    alAviso('Volviste a como estaban tus datos')
  }

  const campo =
    'w-full rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'
  const resumen = porRestaurar && resumirRespaldo(porRestaurar)

  return (
    <div className="space-y-3">
      {/* Crear */}
      <div className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Tus datos viven solo en este iPhone. Guarda un respaldo en iCloud Drive para no perderlos si borras la app o cambias de teléfono.
        </p>
        <p className={`text-sm ${dias === null || dias > 7 ? 'text-amber-700 dark:text-amber-400' : 'text-stone-500 dark:text-stone-400'}`}>
          {dias === null ? 'Aún no has hecho ningún respaldo.' : dias === 0 ? 'Último respaldo: hoy.' : `Último respaldo: hace ${dias} ${dias === 1 ? 'día' : 'días'}.`}
        </p>

        <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
          <input type="checkbox" checked={conContrasena} onChange={(e) => setConContrasena(e.target.checked)} className="size-4 accent-teal-700" />
          Proteger con contraseña
        </label>
        {conContrasena && (
          <div className="space-y-2">
            <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} placeholder="Contraseña" autoComplete="new-password" aria-label="Contraseña del respaldo" className={campo} />
            <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} placeholder="Repite la contraseña" autoComplete="new-password" aria-label="Repite la contraseña" className={campo} />
            <p className="text-xs text-amber-700 dark:text-amber-400">Si olvidas la contraseña, este respaldo no se podrá abrir.</p>
          </div>
        )}
        <p className="h-4 text-xs text-red-600 dark:text-red-400" role="alert">{error}</p>
        <button onClick={crearRespaldo} disabled={trabajando} className="w-full rounded-xl bg-teal-700 py-2.5 font-semibold text-white disabled:opacity-50">
          {trabajando ? 'Preparando…' : 'Crear respaldo'}
        </button>
      </div>

      {/* Restaurar */}
      <div className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900">
        <p className="text-sm text-stone-600 dark:text-stone-300">
          Restaurar <span className="font-medium">reemplaza todos tus datos actuales</span> por los del respaldo. Antes se guarda una copia por si te equivocas.
        </p>

        {!porRestaurar && !archivoLeido && (
          <label className="flex cursor-pointer items-center justify-center rounded-xl border border-stone-300 py-2.5 text-sm font-medium text-stone-700 dark:border-stone-600 dark:text-stone-200">
            Elegir archivo de respaldo
            <input type="file" accept=".json,application/json" onChange={elegirArchivo} className="hidden" />
          </label>
        )}

        {archivoLeido && (
          <form onSubmit={abrirCifrado} className="space-y-2">
            <p className="text-sm text-stone-700 dark:text-stone-300">Este respaldo tiene contraseña.</p>
            <input type="password" value={contrasenaArchivo} onChange={(e) => setContrasenaArchivo(e.target.value)} placeholder="Contraseña" aria-label="Contraseña del archivo" className={campo} />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2 text-sm font-semibold text-white">Abrir</button>
              <button type="button" onClick={() => setArchivoLeido(null)} className="rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">Cancelar</button>
            </div>
          </form>
        )}

        {resumen && (
          <div className="space-y-3">
            <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-300">
              <p className="font-medium text-stone-900 dark:text-stone-100">Respaldo del {fechaHora.format(new Date(resumen.creado))}</p>
              <p>
                {resumen.movimientos} movimientos · {resumen.cuentas} cuentas · {resumen.creditos} tarjetas de crédito · {resumen.cuotas} cuotas
              </p>
              <p className="text-xs text-stone-500">Creado con Lumio {resumen.version}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={confirmarRestaurar} disabled={trabajando} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                Reemplazar mis datos
              </button>
              <button onClick={() => setPorRestaurar(null)} className="rounded-xl bg-stone-100 px-4 py-2.5 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {errorRestaurar && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{errorRestaurar}</p>}

        {copiaPrevia && !porRestaurar && (
          <div className="rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800">
            <p className="text-stone-600 dark:text-stone-300">
              Tienes una copia de cómo estaban tus datos antes de restaurar ({fechaHora.format(new Date(copiaPrevia.creado))},{' '}
              {copiaPrevia.datos.movimientos.length} movimientos).
            </p>
            <button onClick={volverACopia} className="mt-1 font-medium text-teal-700 dark:text-teal-300">
              Volver a como estaban
            </button>
          </div>
        )}
      </div>
      <p className="px-1 text-xs text-stone-400">
        La clave de Wallet no se incluye en el respaldo: si restauras en otro iPhone, vuelve a conectarla.
      </p>
    </div>
  )
}

// ---- Cartolas y estados de cuenta ----

function SeccionImportar({ alImportar }) {
  const titular = useLiveQuery(async () => (await db.preferencias.get('titular'))?.valor ?? '', [], '')
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState('')

  async function guardar(e) {
    e.preventDefault()
    await guardarPreferencia('titular', nombre.trim())
    setEditando(false)
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        Importa el PDF que te manda el banco: Lumio agrega lo que falta sin duplicar lo que llegó por Wallet. El PDF se lee en tu iPhone y no se guarda.
      </p>
      <button onClick={alImportar} className="boton-morado flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-white">
        <Iconos.pdf /> Importar PDF
      </button>
      {editando ? (
        <form onSubmit={guardar} className="space-y-2">
          <label className="block text-sm text-stone-600 dark:text-stone-300">
            Tu nombre como sale en el banco
            <input
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre y apellidos"
              className="mt-1 w-full rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2 text-sm font-semibold text-white">Guardar</button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-xl bg-stone-100 px-4 py-2 text-sm text-stone-700 dark:bg-stone-800 dark:text-stone-200">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          {titular ? (
            <>Las transferencias a o desde <span className="font-medium text-stone-700 dark:text-stone-300">{titular}</span> se toman como movimientos entre tus cuentas. </>
          ) : (
            'Tu nombre se toma de la primera cartola que importes, para reconocer las transferencias entre tus cuentas. '
          )}
          <button
            onClick={() => {
              setNombre(titular)
              setEditando(true)
            }}
            className="font-medium text-teal-700 underline dark:text-teal-300"
          >
            Cambiar
          </button>
        </p>
      )}
    </div>
  )
}

// ---- Gastos fijos ----

function SeccionFijos({ movimientos }) {
  const fijos = useLiveQuery(() => db.fijos.toArray(), [], [])
  const [editando, setEditando] = useState(null) // null · 'nuevo' · el gasto fijo que se edita

  if (editando) {
    return <FormularioFijo inicial={editando === 'nuevo' ? null : editando} movimientos={movimientos} alTerminar={() => setEditando(null)} />
  }

  return (
    <div className="rounded-2xl bg-white px-4 py-2 dark:bg-stone-900">
      {fijos.length === 0 ? (
        <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
          Arriendo, suscripciones, plan del celular… Anótalos una vez y aparecen en "Próximos pagos" de tu billetera.
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {[...fijos].sort((a, b) => a.dia - b.dia).map((f) => (
            <li key={f.id}>
              <button onClick={() => setEditando(f)} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                <span className="min-w-0">
                  <span className="block truncate text-stone-900 dark:text-stone-100">{f.nombre}</span>
                  <span className="block text-xs text-stone-500 dark:text-stone-400">Día {f.dia}{f.medioPago ? ` · ${f.medioPago}` : ''}</span>
                </span>
                <span className="shrink-0 font-medium text-stone-900 tabular-nums dark:text-stone-100">{formatearPesos(f.monto)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button onClick={() => setEditando('nuevo')} className="mb-1 py-1 text-sm font-medium text-teal-700 dark:text-teal-300">
        + Agregar gasto fijo
      </button>
    </div>
  )
}

function FormularioFijo({ inicial, movimientos, alTerminar }) {
  const cuentas = useLiveQuery(() => db.cuentas.toArray(), [], [])
  const creditos = useLiveQuery(() => db.creditos.toArray(), [], [])
  const [nombre, setNombre] = useState(inicial?.nombre ?? '')
  const [monto, setMonto] = useState(inicial?.monto ?? 0)
  const [dia, setDia] = useState(inicial?.dia ?? 5)
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'cuentas')
  const [medioPago, setMedioPago] = useState(inicial?.medioPago ?? '')
  const [error, setError] = useState('')
  const medios = unirTarjetas(cuentas.map((c) => c.nombre), creditos.map((c) => c.nombre), tarjetasUsadas(movimientos))

  async function guardar(e) {
    e.preventDefault()
    if (!nombre.trim()) return setError('Ponle un nombre')
    if (monto <= 0) return setError('Escribe el monto')
    await guardarFijo({ ...(inicial ?? {}), nombre: nombre.trim(), monto, dia, categoria, medioPago })
    alTerminar()
  }

  const campo = 'w-full rounded-lg bg-stone-100 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-teal-600 dark:bg-stone-800 dark:text-white'
  return (
    <form onSubmit={guardar} className="space-y-3 rounded-2xl bg-white p-4 dark:bg-stone-900">
      <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Spotify)" aria-label="Nombre del gasto fijo" maxLength={40} className={campo} />
      <div className="flex gap-2">
        <input
          inputMode="numeric"
          value={monto ? formatearPesos(monto, { mostrar: true }) : ''}
          onChange={(e) => setMonto(leerMonto(e.target.value))}
          placeholder="Monto"
          aria-label="Monto del gasto fijo"
          className={`${campo} tabular-nums`}
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
          Día
          <select value={dia} onChange={(e) => setDia(Number(e.target.value))} aria-label="Día del mes" className="rounded-lg bg-stone-100 px-2 py-2 text-base dark:bg-stone-800 dark:text-white">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría" className={campo}>
          {CATEGORIAS.gasto.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} aria-label="Se paga con" className={campo}>
          <option value="">Se paga con…</option>
          {medios.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>
      <p className="h-4 text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-teal-700 py-2.5 font-semibold text-white">Guardar</button>
        {inicial && (
          <button
            type="button"
            onClick={async () => {
              await borrarFijo(inicial.id)
              alTerminar()
            }}
            className="rounded-xl bg-red-50 px-4 py-2.5 text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            Borrar
          </button>
        )}
        <button type="button" onClick={alTerminar} className="rounded-xl bg-stone-100 px-4 py-2.5 text-stone-700 dark:bg-stone-800 dark:text-stone-200">
          Cancelar
        </button>
      </div>
    </form>
  )
}
