import Dexie from 'dexie'

// Base de datos local en el navegador (IndexedDB), manejada con Dexie.
// Todo queda guardado en el teléfono: nada se envía a internet.
export const db = new Dexie('bolsillo')

// Versión 1 del "esquema". Solo se listan los campos por los que se busca u ordena;
// el resto (nota, medioPago, comercio...) se guarda igual sin declararlo.
// '++id' = número que se genera solo y aumenta en cada registro.
db.version(1).stores({
  movimientos: '++id, fecha, tipo, categoria, origen',
})

// Ejemplo de movimiento guardado:
// {
//   id: 1,
//   tipo: 'gasto',            // 'gasto' | 'ingreso'
//   monto: 5990,              // pesos chilenos, siempre entero
//   categoria: 'comida',
//   fecha: '2026-10-21',      // AAAA-MM-DD (así se ordena bien como texto)
//   nota: 'almuerzo',
//   origen: 'manual',         // 'manual' | 'atajo' | 'cartola' | 'ejemplo'
//   creado: 1761000000000,    // marca de tiempo para detectar duplicados
// }

export function agregarMovimiento(mov) {
  return db.movimientos.add({ ...mov, creado: Date.now() })
}

export function borrarMovimiento(id) {
  return db.movimientos.delete(id)
}

export function restaurarMovimiento(mov) {
  return db.movimientos.put(mov) // put = vuelve a guardarlo con el mismo id
}

// ¿Hay un movimiento igual (tipo, monto y categoría) creado hace menos de un minuto?
export async function esPosibleDuplicado({ tipo, monto, categoria }) {
  const haceUnMinuto = Date.now() - 60_000
  const recientes = await db.movimientos.where('origen').equals('manual').toArray()
  return recientes.some(
    (m) => m.creado > haceUnMinuto && m.tipo === tipo && m.monto === monto && m.categoria === categoria,
  )
}
