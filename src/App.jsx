import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, borrarMovimiento, restaurarMovimiento, importarMovimientos } from './db.js'
import { leerArchivoWallet } from './lib/wallet.js'
import { bandeja, leerClave, guardarClave } from './lib/bandeja.js'
import { leerLinkNuevo, resumenDelMes, gastosPorCategoria } from './lib/calculos.js'
import { formatearPesos, hoyISO, mesDe, nombreMes, ocultarMontos } from './lib/formato.js'
import { categoriaAprendida } from './lib/reglas.js'
import ImportarCartola from './components/ImportarCartola.jsx'
import { datosDeEjemplo } from './lib/ejemplo.js'
import Inicio from './components/Inicio.jsx'
import Movimientos from './components/Movimientos.jsx'
import NuevoMovimiento from './components/NuevoMovimiento.jsx'
import Ahorro from './components/Ahorro.jsx'
import Analisis, { COLORES } from './components/Analisis.jsx'
import { Cabecera, Hoja, BotonCabecera, DatoCabecera, Iconos } from './components/Marco.jsx'
import Ajustes from './components/Ajustes.jsx'
import Novedades from './components/Novedades.jsx'
import { VERSION, versionVista, marcarVista } from './version.js'


export default function App() {
  const [pestana, setPestana] = useState('inicio')
  const [hojaAbierta, setHojaAbierta] = useState(false)
  const [inicial, setInicial] = useState(null)
  const [aviso, setAviso] = useState(null) // { texto, deshacer }
  const temporizador = useRef(null)
  const [claveWallet, setClaveWallet] = useState(leerClave) // '' = no conectada
  const sincronizando = useRef(false) // evita revisar la bandeja dos veces al mismo tiempo
  const [verNovedades, setVerNovedades] = useState(false)
  const [importando, setImportando] = useState(false)
  // Modo privado: oculta los montos (se recuerda en este iPhone)
  const [privado, setPrivado] = useState(() => {
    try {
      return localStorage.getItem('lumio-privado') === '1'
    } catch {
      return false
    }
  })

  function cambiarPrivado() {
    setPrivado((p) => {
      try {
        localStorage.setItem('lumio-privado', p ? '0' : '1')
      } catch {
        // sin almacenamiento: igual funciona mientras la app esté abierta
      }
      return !p
    })
  }

  // useLiveQuery: la pantalla se actualiza sola cada vez que cambia la base de datos
  const movimientos = useLiveQuery(() => db.movimientos.toArray(), [], null)

  // Novedades: se muestran una vez después de actualizar (a quien recién empieza no se le muestran)
  useEffect(() => {
    if (movimientos === null || versionVista() === VERSION) return
    if (movimientos.length > 0) setVerNovedades(true)
    else marcarVista()
  }, [movimientos])

  function cerrarNovedades() {
    marcarVista()
    setVerNovedades(false)
  }

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
      const { movimientos: leidosSinReglas } = leerArchivoWallet(texto)
      // Si ya le enseñaste a Lumio la categoría de ese comercio, llega con esa
      const reglas = await db.reglas.toArray()
      const leidos = leidosSinReglas.map((m) => ({ ...m, categoria: categoriaAprendida(m.nota, reglas) ?? m.categoria }))
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
  ocultarMontos(privado) // antes de dibujar: todas las pantallas usan formatearPesos

  const mes = mesDe(hoyISO())
  const botonAjustes = (
    <BotonCabecera etiqueta="Ajustes" onClick={() => setPestana('ajustes')}>
      <Iconos.ajustes />
    </BotonCabecera>
  )

  return (
    <div className="min-h-dvh">
      {pestana === 'inicio' && (
        <Inicio
          movimientos={movimientos}
          alVerTodo={() => setPestana('movimientos')}
          alCargarEjemplo={cargarEjemplo}
          alEditar={abrirEdicion}
          alAjustes={() => setPestana('ajustes')}
          alAnalisis={() => setPestana('analisis')}
          privado={privado}
          alPrivado={cambiarPrivado}
          alAnotarFijo={(f) => {
            setInicial({ tipo: 'gasto', monto: f.monto, nota: f.nombre, categoria: f.categoria, medioPago: f.medioPago ?? '', fijoId: f.id })
            setHojaAbierta(true)
          }}
        />
      )}

      {pestana === 'movimientos' && (
        <>
          <Cabecera
            subtitulo={nombreMes(mes)}
            titulo="Movimientos"
            accion={
              <div className="flex gap-2">
                <BotonCabecera etiqueta="Importar cartola en PDF" onClick={() => setImportando(true)}>
                  <Iconos.pdf />
                </BotonCabecera>
                {botonAjustes}
              </div>
            }
          >
            <ResumenMes movimientos={movimientos} mes={mes} />
          </Cabecera>
          <Hoja>
            <Movimientos movimientos={movimientos} alEditar={abrirEdicion} alBorrar={alBorrar} />
          </Hoja>
        </>
      )}

      {pestana === 'ahorro' && (
        <>
          <Cabecera subtitulo="Simula cuánto juntarías" titulo="Ahorro" accion={botonAjustes} />
          <Hoja>
            <Ahorro />
          </Hoja>
        </>
      )}

      {pestana === 'analisis' && (
        <>
          <Cabecera subtitulo={nombreMes(mes)} titulo="Análisis" accion={botonAjustes}>
            <GastadoDelMes movimientos={movimientos} mes={mes} />
          </Cabecera>
          <Hoja>
            <Analisis movimientos={movimientos} />
          </Hoja>
        </>
      )}

      {pestana === 'ajustes' && (
        <>
          <Cabecera
            izquierda={
              <BotonCabecera etiqueta="Volver" onClick={() => setPestana('inicio')}>
                <Iconos.volver />
              </BotonCabecera>
            }
            titulo="Ajustes"
          />
          <Hoja>
            <Ajustes
              movimientos={movimientos}
              wallet={
                bandeja && {
                  conectada: Boolean(claveWallet),
                  alConectar: conectarWallet,
                  alDesconectar: desconectarWallet,
                }
              }
              alAviso={(texto) => mostrarAviso(texto, null)}
              alVerNovedades={() => setVerNovedades(true)}
              alImportar={() => setImportando(true)}
            />
          </Hoja>
        </>
      )}

      {/* Aviso temporal con opción de deshacer */}
      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-28 z-30 mx-auto flex max-w-sm items-center justify-between rounded-2xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
        >
          <span>{aviso.texto}</span>
          {aviso.deshacer && (
            <button
              onClick={() => {
                aviso.deshacer()
                setAviso(null)
              }}
              className="font-semibold text-teal-300 dark:text-teal-700"
            >
              Deshacer
            </button>
          )}
        </div>
      )}

      {/* Barra de pestañas con el botón + al centro */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-10 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95">
        <div className="mx-auto grid max-w-md grid-cols-5 items-start pt-2.5">
          <BotonPestana activa={pestana === 'inicio'} onClick={() => setPestana('inicio')} icono={<Iconos.billetera />} texto="Billetera" />
          <BotonPestana activa={pestana === 'movimientos'} onClick={() => setPestana('movimientos')} icono={<Iconos.lista />} texto="Movimientos" />
          <div className="flex justify-center">
            <button
              onClick={abrirHoja}
              aria-label="Nuevo movimiento"
              className="boton-morado grid size-12 place-items-center rounded-2xl text-white active:scale-95"
            >
              <Iconos.mas />
            </button>
          </div>
          <BotonPestana activa={pestana === 'ahorro'} onClick={() => setPestana('ahorro')} icono={<Iconos.ahorro />} texto="Ahorro" />
          <BotonPestana activa={pestana === 'analisis'} onClick={() => setPestana('analisis')} icono={<Iconos.analisis />} texto="Análisis" />
        </div>
      </nav>

      {verNovedades && <Novedades alCerrar={cerrarNovedades} />}

      {importando && (
        <ImportarCartola movimientos={movimientos} alCerrar={() => setImportando(false)} />
      )}

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
      className={`flex flex-col items-center gap-1 text-[11px] ${
        activa ? 'font-semibold text-teal-700 dark:text-teal-300' : 'font-medium text-stone-500 dark:text-stone-400'
      }`}
    >
      {icono}
      {texto}
    </button>
  )
}

// Gastos e ingresos del mes, en el encabezado de Movimientos
function ResumenMes({ movimientos, mes }) {
  const { ingresos, gastos } = resumenDelMes(movimientos, mes)
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <DatoCabecera titulo="Gastos" valor={formatearPesos(gastos)} />
      <DatoCabecera titulo="Ingresos" valor={formatearPesos(ingresos)} />
    </div>
  )
}

// Total gastado del mes y una barra dividida por categoría, en el encabezado de Análisis
function GastadoDelMes({ movimientos, mes }) {
  const porCategoria = gastosPorCategoria(movimientos, mes)
  const total = porCategoria.reduce((suma, c) => suma + c.total, 0)
  return (
    <div>
      <p className="text-sm text-teal-300">Gastado este mes</p>
      <p className="text-[34px] leading-tight font-semibold tracking-tight tabular-nums">{formatearPesos(total)}</p>
      {total > 0 && (
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
          {porCategoria.map((c, i) => (
            <span key={c.categoria} style={{ width: `${(c.total / total) * 100}%`, background: COLORES[i % COLORES.length] }} />
          ))}
        </div>
      )}
    </div>
  )
}
