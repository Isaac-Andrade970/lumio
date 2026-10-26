import { describe, it, expect } from 'vitest'
import { resumenDelMes, gastosPorCategoria, agruparPorDia, leerLinkNuevo, proyectarAhorro, resumenUltimosMeses, variacionPorcentual, gastosHastaElDia, tarjetaDe, tarjetasUsadas, gastosPorTarjeta, unirTarjetas } from './calculos.js'
import { formatearPesos, leerMonto, sumarMeses } from './formato.js'

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

describe('proyectarAhorro', () => {
  it('sin interés es simplemente mensual × meses', () => {
    expect(proyectarAhorro({ mensual: 50000, meses: 12 })).toEqual({
      total: 600000,
      aportado: 600000,
      intereses: 0,
    })
  })
  it('con interés compuesto gana más de lo aportado', () => {
    // 12% anual = 1% al mes. Valor conocido: 100.000 × ((1,01^12 − 1) / 0,01) ≈ 1.268.250
    const r = proyectarAhorro({ mensual: 100000, meses: 12, tasaAnual: 12 })
    expect(r.total).toBe(1268250)
    expect(r.intereses).toBe(68250)
  })
})

describe('resumenUltimosMeses', () => {
  it('entrega los meses en orden, incluidos los que no tienen movimientos', () => {
    const r = resumenUltimosMeses(movs, '2026-10', 3)
    expect(r.map((m) => m.mes)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(r[0].gastos).toBe(0)
    expect(r[1].gastos).toBe(50000)
    expect(r[2].ingresos).toBe(900000)
  })
  it('cruza el cambio de año', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
  })
})

describe('variacionPorcentual', () => {
  it('calcula cuánto subió o bajó', () => {
    expect(variacionPorcentual(120, 100)).toBe(20)
    expect(variacionPorcentual(50, 100)).toBe(-50)
  })
  it('devuelve null si antes no había nada', () => {
    expect(variacionPorcentual(100, 0)).toBeNull()
  })
})

describe('gastosHastaElDia', () => {
  it('cuenta solo los gastos hasta ese día del mes', () => {
    expect(gastosHastaElDia(movs, '2026-10', 20)).toBe(12000)
    expect(gastosHastaElDia(movs, '2026-10', 31)).toBe(18820)
  })
})

describe('tarjetas', () => {
  const conTarjetas = [
    { tipo: 'gasto', monto: 5990, categoria: 'comida', fecha: '2026-10-21', medioPago: 'Visa Débito' },
    { tipo: 'gasto', monto: 12000, categoria: 'ocio', fecha: '2026-10-22', medioPago: 'Mastercard' },
    { tipo: 'gasto', monto: 3000, categoria: 'comida', fecha: '2026-10-23', medioPago: 'Visa Débito' },
    { tipo: 'gasto', monto: 1000, categoria: 'otros-gasto', fecha: '2026-10-23' }, // sin tarjeta
    { tipo: 'ingreso', monto: 900000, categoria: 'sueldo', fecha: '2026-10-01', medioPago: 'Visa Débito' },
    { tipo: 'gasto', monto: 50000, categoria: 'ocio', fecha: '2026-09-30', medioPago: 'Mastercard' }, // otro mes
  ]

  it('tarjetaDe usa "Sin indicar" si no hay medio de pago', () => {
    expect(tarjetaDe(conTarjetas[0])).toBe('Visa Débito')
    expect(tarjetaDe(conTarjetas[3])).toBe('Sin indicar')
  })

  it('tarjetasUsadas lista cada tarjeta una vez, la más usada primero', () => {
    expect(tarjetasUsadas(conTarjetas)).toEqual(['Visa Débito', 'Mastercard'])
  })

  it('gastosPorTarjeta suma solo gastos del mes, por tarjeta', () => {
    expect(gastosPorTarjeta(conTarjetas, '2026-10')).toEqual([
      { tarjeta: 'Mastercard', total: 12000 },
      { tarjeta: 'Visa Débito', total: 8990 },
      { tarjeta: 'Sin indicar', total: 1000 },
    ])
  })
})

describe('tarjetas con nombres escritos distinto', () => {
  const movs2 = [
    { tipo: 'gasto', monto: 1000, fecha: '2026-10-21', medioPago: 'Crédito Banco C' },
    { tipo: 'gasto', monto: 2000, fecha: '2026-10-22', medioPago: 'CRÉDITO BANCO C' },
    { tipo: 'gasto', monto: 3000, fecha: '2026-10-22', medioPago: 'Débito Banco A' },
  ]
  it('tarjetasUsadas no repite la misma tarjeta', () => {
    expect(tarjetasUsadas(movs2)).toHaveLength(2)
  })
  it('gastosPorTarjeta suma juntas las variantes del mismo nombre', () => {
    expect(gastosPorTarjeta(movs2, '2026-10')).toEqual([
      { tarjeta: 'Crédito Banco C', total: 3000 },
      { tarjeta: 'Débito Banco A', total: 3000 },
    ])
  })
  it('unirTarjetas junta listas sin repetir', () => {
    expect(unirTarjetas(['Débito Banco A'], ['crédito banco c', 'DÉBITO BANCO A'], ['Efectivo'])).toEqual([
      'Débito Banco A',
      'crédito banco c',
      'Efectivo',
    ])
  })
})

describe('transferencias', () => {
  const conTransferencia = [
    { tipo: 'gasto', monto: 5000, fecha: '2026-10-21', medioPago: 'Débito Banco A' },
    { tipo: 'ingreso', monto: 900000, fecha: '2026-10-01', medioPago: 'Débito Banco A' },
    { tipo: 'transferencia', monto: 50000, fecha: '2026-10-21', medioPago: 'Débito Banco A', destino: 'Ahorro', categoria: 'transferencia' },
  ]
  it('no cuentan como gasto ni ingreso del mes', () => {
    expect(resumenDelMes(conTransferencia, '2026-10')).toEqual({ ingresos: 900000, gastos: 5000, saldo: 895000 })
  })
  it('no cambian el total del día', () => {
    expect(agruparPorDia(conTransferencia).find((g) => g.fecha === '2026-10-21').totalDia).toBe(-5000)
  })
})
