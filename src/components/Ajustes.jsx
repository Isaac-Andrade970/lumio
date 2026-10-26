import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, exportarDatos, reemplazarDatos, guardarCopiaPrevia, leerCopiaPrevia } from '../db.js'
import { tarjetasUsadas, unirTarjetas } from '../lib/calculos.js'
import { mismaTarjeta } from '../lib/credito.js'
import { hoyISO } from '../lib/formato.js'
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
export default function Ajustes({ movimientos, wallet, alAviso, alVerNovedades }) {
  return (
    <div className="space-y-6">
      <Grupo titulo="Mis cuentas">
        <SeccionCuentas movimientos={movimientos} />
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
          <img src="./icon-192.png" alt="" width="52" height="52" className="shrink-0 rounded-[14px]" />
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
          <li key={c.nombre} className="py-2 text-stone-900 dark:text-stone-100">
            {c.nombre}
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
