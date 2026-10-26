import { useState } from 'react'
import { formatearPesos, hoyISO, mesDe, nombreMes } from '../lib/formato.js'
import FilaMovimiento from './FilaMovimiento.jsx'
import { Cabecera, Hoja, BotonCabecera, Iconos } from './Marco.jsx'
import { useTarjetas, PilaTarjetas, datosDeTarjeta } from './Billetera.jsx'
import { leerUltimoRespaldo, diasDesdeRespaldo } from '../lib/respaldo.js'

// Pantalla de inicio: tus tarjetas apiladas como en Wallet y el detalle de la que elijas
export default function Inicio({ movimientos, alVerTodo, alCargarEjemplo, alEditar, alAjustes, alAnalisis }) {
  const [elegida, setElegida] = useState(null)
  const tarjetas = useTarjetas(movimientos)

  // Recordatorio: si tienes datos y pasaron más de 7 días (o nunca) desde el último respaldo
  const dias = diasDesdeRespaldo(leerUltimoRespaldo())
  const recordarRespaldo = movimientos.length >= 5 && (dias === null || dias > 7)

  if (tarjetas === null) return null // cargando

  const mes = mesDe(hoyISO())
  const lista = tarjetas.lista
  const actual = lista.find((t) => t.clave === elegida) ?? lista[0]
  const detalle = actual ? datosDeTarjeta(actual, movimientos, mes) : null
  const ultimosGenerales = [...movimientos]
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0))
    .slice(0, 5)

  return (
    <>
      <Cabecera
        izquierda={
          <>
            <img src="./icon-192.png" alt="Lumio" width="42" height="42" className="shrink-0 rounded-xl shadow-md shadow-black/30" />
            <div>
              <p className="text-sm text-teal-300">Disponible</p>
              <p className={`text-[30px] leading-tight font-semibold tracking-tight tabular-nums ${tarjetas.disponible < 0 ? 'text-amber-300' : ''}`}>
                {formatearPesos(tarjetas.disponible)}
              </p>
            </div>
          </>
        }
        accion={<BotonCabecera etiqueta="Ajustes" onClick={alAjustes}><Iconos.ajustes /></BotonCabecera>}
      >
        {lista.length > 0 ? (
          <PilaTarjetas tarjetas={lista} elegida={actual.clave} alElegir={setElegida} />
        ) : (
          <div className="rounded-[22px] border border-dashed border-white/30 p-5">
            <p className="text-sm text-teal-100">Agrega tus cuentas y tarjetas para verlas aquí como en Wallet.</p>
            <button onClick={alAjustes} className="mt-3 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-900">
              Configurar mis cuentas
            </button>
          </div>
        )}
      </Cabecera>

      <Hoja>
        <div className="space-y-3">
          {recordarRespaldo && (
            <button
              onClick={alAjustes}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
            >
              <span>{dias === null ? 'Aún no respaldas tus datos.' : `Tu último respaldo fue hace ${dias} días.`}</span>
              <span className="shrink-0 font-semibold">Respaldar</span>
            </button>
          )}

          {detalle && (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                {detalle.datos.map((d) => (
                  <div key={d.titulo} className="rounded-2xl bg-white px-3.5 py-3 dark:bg-stone-900">
                    <p className="text-xs text-stone-500 dark:text-stone-400">{d.titulo}</p>
                    <p className={`mt-0.5 text-[17px] font-semibold tabular-nums ${d.destacado ? 'text-fuchsia-700 dark:text-fuchsia-300' : 'text-stone-900 dark:text-stone-100'}`}>
                      {d.valor}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tarjeta de crédito: cuotas que siguen corriendo */}
              {detalle.cuotas?.length > 0 && (
                <section className="rounded-[18px] bg-white px-4 pt-3 pb-1 dark:bg-stone-900">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Cuotas que siguen</h2>
                    <button onClick={alAnalisis} className="text-sm font-medium text-teal-700 dark:text-teal-300">
                      Estado de cuenta
                    </button>
                  </div>
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {detalle.cuotas.slice(0, 5).map((c) => (
                      <li key={c.id} className="flex items-center gap-3 py-2.5">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-teal-100 text-sm font-bold text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                          {c.descripcion.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">{c.descripcion}</p>
                          <p className="text-xs text-stone-500 dark:text-stone-400">
                            {c.quedan === 1 ? 'Queda 1 cuota' : `Quedan ${c.quedan} cuotas`}
                          </p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100">{formatearPesos(c.monto)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-[18px] bg-white px-4 pt-3 pb-1 dark:bg-stone-900">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Últimos con {actual.nombre}</h2>
                  <button onClick={alVerTodo} className="shrink-0 text-sm font-medium text-teal-700 dark:text-teal-300">
                    Ver todo
                  </button>
                </div>
                {detalle.ultimos.length > 0 ? (
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {detalle.ultimos.map((m) => (
                      <FilaMovimiento key={m.id} mov={m} alEditar={alEditar} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-4 text-sm text-stone-500 dark:text-stone-400">Aún no hay movimientos con esta tarjeta.</p>
                )}
              </section>
            </>
          )}

          {movimientos.length === 0 && (
            <div className="py-6 text-center">
              <h2 className="mb-1 text-lg font-semibold text-stone-900 dark:text-stone-100">Aún no hay movimientos</h2>
              <p className="mb-5 text-stone-500 dark:text-stone-400">Toca el botón + para anotar tu primer gasto.</p>
              <button onClick={alCargarEjemplo} className="text-sm font-medium text-teal-700 underline dark:text-teal-300">
                O carga datos de ejemplo para probar
              </button>
            </div>
          )}

          {/* Sin cuentas configuradas: los últimos movimientos en general */}
          {!detalle && ultimosGenerales.length > 0 && (
            <section className="rounded-[18px] bg-white px-4 pt-3 pb-1 dark:bg-stone-900">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100">Últimos movimientos · {nombreMes(mes).split(' ')[0]}</h2>
                <button onClick={alVerTodo} className="text-sm font-medium text-teal-700 dark:text-teal-300">Ver todo</button>
              </div>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {ultimosGenerales.map((m) => (
                  <FilaMovimiento key={m.id} mov={m} alEditar={alEditar} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </Hoja>
    </>
  )
}
