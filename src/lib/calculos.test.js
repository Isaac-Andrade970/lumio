import { describe, it, expect } from 'vitest'
import { resumenDelMes, gastosPorCategoria, agruparPorDia, leerLinkNuevo } from './calculos.js'
import { formatearPesos, leerMonto } from './formato.js'

const movs = [
  { id: 1, tipo: 'ingreso', monto: 900000, categoria: 'sueldo', fecha: '2026-10-01', creado: 1 },
  { id: 2, tipo: 'gasto', monto: 5990, categoria: 'comida', fecha: '2026-10-21', creado: 2 },
  { id: 3, tipo: 'gasto', monto: 830, categoria: 'transporte', fecha: '2026-10-21', creado: 3 },
  { id: 4, tipo: 'gasto', monto: 12000, categoria: 'comida', fecha: '2026-10-20', creado: 4 },
  { id: 5, tipo: 'gasto', monto: 50000, categoria: 'ocio', fecha: '2026-09-30', creado: 5 },
]

describe('resumenDelMes', () => {
  it('suma solo los movimientos del mes pedido', () => {
    expect(resumenDelMes(movs, '2026-10')).toEqual({ ingresos: 900000, gastos: 18820, saldo: 881180 })
  })
  it('devuelve ceros si no hay datos', () => {
    expect(resumenDelMes([], '2026-10')).toEqual({ ingresos: 0, gastos: 0, saldo: 0 })
  })
})

describe('gastosPorCategoria', () => {
  it('agrupa y ordena de mayor a menor', () => {
    expect(gastosPorCategoria(movs, '2026-10')).toEqual([
      { categoria: 'comida', total: 17990 },
      { categoria: 'transporte', total: 830 },
    ])
  })
})

describe('agruparPorDia', () => {
  it('agrupa por fecha, la más reciente primero', () => {
    const grupos = agruparPorDia(movs)
    expect(grupos.map((g) => g.fecha)).toEqual(['2026-10-21', '2026-10-20', '2026-10-01', '2026-09-30'])
    expect(grupos[0].totalDia).toBe(-6820)
    expect(grupos[0].movimientos[0].id).toBe(3) // el creado más tarde va primero
  })
})

describe('formato', () => {
  it('muestra pesos chilenos', () => {
    expect(formatearPesos(5990)).toBe('$5.990')
  })
  it('lee montos escritos de varias formas', () => {
    expect(leerMonto('$5.990')).toBe(5990)
    expect(leerMonto('')).toBe(0)
  })
})

describe('leerLinkNuevo', () => {
  it('lee monto y comercio del link de Atajos', () => {
    expect(leerLinkNuevo('#nuevo?monto=5.990&comercio=Starbucks')).toEqual({
      monto: 5990,
      nota: 'Starbucks',
      tipo: 'gasto',
    })
  })
  it('ignora otros links', () => {
    expect(leerLinkNuevo('#movimientos')).toBeNull()
  })
})
