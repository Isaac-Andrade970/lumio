import Dexie from 'dexie'

// Base de datos local en el navegador (IndexedDB), manejada con Dexie.
// Todo queda guardado en el teléfono: nada se envía a internet.
export const db = new Dexie('lumio')

// Versión 1 del "esquema". Solo se listan los campos por los que se busca u ordena;
// el resto (nota, medioPago, comercio...) se guarda igual sin declararlo.
// '++id' = número que se genera solo y aumenta en cada registro.
db.version(1).stores({
  movimientos: '++id, fecha, tipo, categoria, origen',
})

// Versión 2: se agrega el índice "externoId" para no importar dos veces el mismo pago de Wallet.
// Las versiones nunca se borran: Dexie actualiza solo la base de quien venga de la versión 1.
db.version(2).stores({
  movimientos: '++id, fecha, tipo, categoria, origen, externoId',
})

// Versión 3: tabla nueva para la configuración de tus tarjetas de crédito.
// 'nombre' es la clave: el mismo nombre de tarjeta que trae Wallet (por ejemplo "Crédito Banco C").
db.version(3).stores({
  movimientos: '++id, fecha, tipo, categoria, origen, externoId',
  creditos: 'nombre',
})

// Versión 4: tabla para las cuotas que ya tienes comprometidas en tus tarjetas de crédito.
db.version(4).stores({
  movimientos: '++id, fecha, tipo, categoria, origen, externoId',
  creditos: 'nombre',
  cuotas: '++id, tarjeta',
})

// Versión 5: tus cuentas (débito, efectivo...) con el saldo que tenían cuando lo anotaste.
db.version(5).stores({
  movimientos: '++id, fecha, tipo, categoria, origen, externoId',
  creditos: 'nombre',
  cuotas: '++id, tarjeta',
  cuentas: 'nombre',
})

// { nombre, saldoInicial, fechaSaldo, momentoSaldo }
export function guardarCuenta(cuenta) {
  return db.cuentas.put(cuenta)
}

export function borrarCuenta(nombre) {
  return db.cuentas.delete(nombre)
}

// { tarjeta, descripcion, monto, hasta: 'AAAA-MM' }
export function guardarCuota(cuota) {
  return db.cuotas.put(cuota)
}

export function borrarCuota(id) {
  return db.cuotas.delete(id)
}

// { nombre, diaCierre, diaPago, tasaMensual, comision, pagadoHasta }
export function guardarCredito(config) {
  return db.creditos.put(config) // put = crea o reemplaza
}

export function borrarCredito(nombre) {
  return db.creditos.delete(nombre)
}

// Ejemplo de movimiento guardado:
// {
//   id: 1,
//   tipo: 'gasto',            // 'gasto' | 'ingreso'
//   monto: 5990,              // pesos chilenos, siempre entero
//   categoria: 'comida',
//   fecha: '2026-10-21',      // AAAA-MM-DD (así se ordena bien como texto)
//   nota: 'almuerzo',
//   origen: 'manual',         // 'manual' | 'wallet' | 'cartola' | 'ejemplo'
//   externoId: 'wallet-...',  // solo en importados: evita duplicados
//   creado: 1761000000000,    // marca de tiempo para detectar duplicados
// }

export function agregarMovimiento(mov) {
  return db.movimientos.add({ ...mov, creado: Date.now() })
}

export function actualizarMovimiento(id, cambios) {
  return db.movimientos.update(id, cambios) // cambia solo los campos indicados
}

export function borrarMovimiento(id) {
  return db.movimientos.delete(id)
}

export function restaurarMovimiento(mov) {
  return db.movimientos.put(mov) // put = vuelve a guardarlo con el mismo id
}

// Guarda los pagos importados que todavía no existen. Devuelve los ids nuevos.
export async function importarMovimientos(lista) {
  const ids = lista.map((m) => m.externoId)
  const existentes = await db.movimientos.where('externoId').anyOf(ids).toArray()
  const yaImportados = new Set(existentes.map((m) => m.externoId))
  const nuevos = lista.filter((m) => !yaImportados.has(m.externoId))
  const ahora = Date.now()
  return db.movimientos.bulkAdd(
    nuevos.map((m, i) => ({ ...m, creado: ahora + i })),
    { allKeys: true }, // para que devuelva los ids creados (sirve para deshacer)
  )
}

// ¿Hay un movimiento igual (tipo, monto y categoría) creado hace menos de un minuto?
export async function esPosibleDuplicado({ tipo, monto, categoria }) {
  const haceUnMinuto = Date.now() - 60_000
  const recientes = await db.movimientos.where('origen').equals('manual').toArray()
  return recientes.some(
    (m) => m.creado > haceUnMinuto && m.tipo === tipo && m.monto === monto && m.categoria === categoria,
  )
}
