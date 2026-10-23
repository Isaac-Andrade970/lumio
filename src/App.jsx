import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, borrarMovimiento, restaurarMovimiento, importarMovimientos } from './db.js'
import { leerArchivoWallet } from './lib/wallet.js'
import { bandeja, leerClave, guardarClave } from './lib/bandeja.js'
import { leerLinkNuevo } from './lib/calculos.js'
import { datosDeEjemplo } from './lib/ejemplo.js'
import Inicio from './components/Inicio.jsx'
import Movimientos from './components/Movimientos.jsx'
import NuevoMovimiento from './components/NuevoMovimiento.jsx'
import Ahorro from './components/Ahorro.jsx'
import Analisis from './components/Analisis.jsx'

// Título que se muestra arriba según la pestaña activa
const TITULOS = { inicio: 'Lumio', movimientos: 'Movimientos', ahorro: 'Ahorro', analisis: 'Análisis' }

export default function App() {
  const [pestana, setPestana] = useState('inicio')
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [inicial, setInicial] = useState(null)
  const [aviso, setAviso] = useState(null) // { texto, deshacer }
  const temporizador = useRef(null)
  const [claveWallet, setClaveWallet] = useState(leerClave) // '' = no conectada
  const sincronizando = useRef(false) // evita revisar la bandeja dos veces al mismo tiempo

  // useLiveQuery: la pantalla se actualiza sola cada vez que cambia la base de datos
  const movimientos = useLiveQuery(() => db.movimientos.toArray(), [], null)

  // Si la app se abre con un link "#nuevo?monto=...", abre la hoja pre-rellenada
  useEffect(() => {
    function revisarLink() {
      const datos = leerLinkNuevo(window.location.hash)
      if (!datos) return
      setInicial({ ...datos, origen: 'atajo' })
      setHojaAbierta(true)
      history.replaceState(null, '', window.location.pathname) // limpia el link
    }
    revisarLink()
    window.addEventListener('hashchange', revisarLink)
    return () => window.removeEventListener('hashchange', revisarLink)
  }, [])

  function mostrarAviso(texto, deshacer) {
    clearTimeout(temporizador.current)
    setAviso({ texto, deshacer })
    temporizador.current = setTimeout(() => setAviso(null), 4000)
  }

  function abrirHoja() {
    setInicial(null)
    setHojaAbierta(true)
  }

  function abrirEdicion(mov) {
  setInicial(mov) // la hoja se abre con los datos de este movimiento
  setHojaAbierta(true)
  }

// "anterior" solo viene cuando se editó: sirve para deshacer el cambio
  function alGuardar(mov, anterior) {
  setHojaAbierta(false)
  if (anterior) {
    mostrarAviso('Cambios guardados', () => restaurarMovimiento(anterior))
  } else {
    mostrarAviso('Guardado', () => borrarMovimiento(mov.id))
  }
  }

  async function alBorrar(mov) {
    await borrarMovimiento(mov.id)
    mostrarAviso('Movimiento borrado', () => restaurarMovimiento(mov))
  }

    // Trae los pagos de la bandeja de Supabase, los guarda en el teléfono y recién ahí los borra de la nube
  async function sincronizarWallet(clave = claveWallet) {
    if (!bandeja || !clave || sincronizando.current) return
    sincronizando.current = true
    try {
      const filas = await bandeja.leer(clave)
      if (filas.length === 0) return

      const texto = filas.map((f) => f.linea).join('\n')
      const { movimientos: leidos } = leerArchivoWallet(texto)
      const idsNuevos = await importarMovimientos(leidos) // 1) guardar en el teléfono
      await bandeja.borrar(clave, filas.map((f) => f.id)) // 2) solo después, borrar de la nube

      if (idsNuevos.length > 0) {
        const texto = idsNuevos.length === 1 ? '1 pago de Wallet agregado' : `${idsNuevos.length} pagos de Wallet agregados`
        mostrarAviso(texto, () => db.movimientos.bulkDelete(idsNuevos))
      }
    } catch (error) {
      // Sin internet u otro problema: no pasa nada, se reintenta la próxima vez que abras la app
      console.warn('No se pudo revisar la bandeja de Wallet:', error.message)
    } finally {
      sincronizando.current = false
    }
  }

  // Revisa la bandeja al abrir la app y cada vez que vuelves a ella desde otra app
  useEffect(() => {
    sincronizarWallet()
    function alVolver() {
      if (document.visibilityState === 'visible') sincronizarWallet()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [claveWallet]) // eslint-disable-line react-hooks/exhaustive-deps

  // Prueba la clave contra Supabase; si funciona, la guarda en el teléfono
  async function conectarWallet(clave) {
    await bandeja.leer(clave) // si la clave es incorrecta, esto lanza un error y no se guarda
    guardarClave(clave)
    setClaveWallet(clave) // al cambiar, el useEffect de arriba sincroniza solo
  }

  function desconectarWallet() {
    guardarClave('')
    setClaveWallet('')
  }

  async function cargarEjemplo() {
    await db.movimientos.bulkAdd(datosDeEjemplo())
  }

  if (movimientos === null) return null // cargando (toma milisegundos)

  return (
    <div className="mx-auto min-h-dvh max-w-md">
        <header className="safe-top px-4 pb-3">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900 dark:text-stone-50">
          {TITULOS[pestana]}
        </h1>
        </header>

        <main className="px-4 pb-32">
          {pestana === 'inicio' && (
            <Inicio
              movimientos={movimientos}
              alVerTodo={() => setPestana('movimientos')}
              alCargarEjemplo={cargarEjemplo}
              alEditar={abrirEdicion}
            />
          )}
          {pestana === 'movimientos' && (
            <Movimientos
            movimientos={movimientos}
            alEditar={abrirEdicion}
            alBorrar={alBorrar}
            wallet={
              bandeja && {
                conectada: Boolean(claveWallet),
                alConectar: conectarWallet,
                alDesconectar: desconectarWallet,
              }
            }
            />
          )}
          {pestana === 'ahorro' && <Ahorro />}
          {pestana === 'analisis' && <Analisis movimientos={movimientos} />}
        </main>

      {/* Aviso temporal con opción de deshacer */}
      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-10 mx-auto flex max-w-sm items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          <span>{aviso.texto}</span>
          <button
            onClick={() => {
              aviso.deshacer()
              setAviso(null)
            }}
            className="font-semibold text-teal-300 dark:text-teal-700"
          >
            Deshacer
          </button>
        </div>
      )}

      {/* Barra de pestañas con el botón + al centro */}
        <nav className="safe-bottom fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90">
          <div className="mx-auto grid max-w-md grid-cols-5 items-center pt-2">
            <BotonPestana activa={pestana === 'inicio'} onClick={() => setPestana('inicio')} icono="🏠" texto="Inicio" />
            <BotonPestana
              activa={pestana === 'movimientos'}
              onClick={() => setPestana('movimientos')}
              icono="📋"
              texto="Movimientos"
            />
            <div className="flex justify-center">
              <button
                onClick={abrirHoja}
                aria-label="Nuevo movimiento"
                className="-mt-6 grid size-16 place-items-center rounded-full bg-teal-700 text-4xl leading-none text-white shadow-lg shadow-teal-900/30 active:scale-95"
              >
                +
              </button>
            </div>
            <BotonPestana activa={pestana === 'ahorro'} onClick={() => setPestana('ahorro')} icono="🐷" texto="Ahorro" />
            <div aria-hidden="true" /> {<BotonPestana activa={pestana === 'analisis'} onClick={() => setPestana('analisis')} icono="📊" texto="Análisis" />}
          </div>
        </nav>

      {hojaAbierta && (
        <NuevoMovimiento
          inicial={inicial}
          movimientos={movimientos}
          alCerrar={() => setHojaAbierta(false)}
          alGuardar={alGuardar}
        />
      )}
    </div>
  )
}

function BotonPestana({ activa, onClick, icono, texto }) {
  return (
    <button
      onClick={onClick}
      aria-current={activa ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 text-xs font-medium ${
        activa ? 'text-teal-700 dark:text-teal-300' : 'text-stone-400'
      }`}
    >
      <span className={`text-xl ${activa ? '' : 'grayscale'}`} aria-hidden="true">{icono}</span>
      {texto}
    </button>
  )
}
