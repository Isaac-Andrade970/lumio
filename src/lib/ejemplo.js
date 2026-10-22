import { hoyISO } from './formato.js'

// Genera movimientos inventados del mes actual y el anterior,
// para que quien pruebe la app desde GitHub vea todo funcionando.
export function datosDeEjemplo(hoy = new Date()) {
  const dia = (desplazamiento) => {
    const d = new Date(hoy)
    d.setDate(d.getDate() - desplazamiento)
    return hoyISO(d)
  }
  const base = [
    [0, 'gasto', 5990, 'comida', 'Almuerzo'],
    [0, 'gasto', 830, 'transporte', 'Metro'],
    [1, 'gasto', 24500, 'supermercado', 'Compra semanal'],
    [1, 'gasto', 830, 'transporte', 'Metro'],
    [2, 'gasto', 8990, 'ocio', 'Cine'],
    [3, 'gasto', 32000, 'cuentas', 'Luz'],
    [4, 'gasto', 4500, 'comida', 'Café y sándwich'],
    [5, 'ingreso', 120000, 'freelance', 'Página web'],
    [6, 'gasto', 15990, 'salud', 'Farmacia'],
    [8, 'gasto', 350000, 'arriendo', 'Arriendo'],
    [9, 'ingreso', 950000, 'sueldo', 'Sueldo'],
    [12, 'gasto', 19990, 'compras', 'Zapatillas'],
    [15, 'gasto', 12000, 'educacion', 'Curso online'],
    [20, 'gasto', 6500, 'comida', 'Sushi'],
    [35, 'gasto', 28000, 'supermercado', 'Compra mensual'],
    [38, 'ingreso', 950000, 'sueldo', 'Sueldo'],
  ]
  return base.map(([d, tipo, monto, categoria, nota], i) => ({
    tipo,
    monto,
    categoria,
    nota,
    fecha: dia(d),
    origen: 'ejemplo',
    creado: Date.now() - d * 86_400_000 - i,
  }))
}
