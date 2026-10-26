import { describe, it, expect } from 'vitest'
import { periodosCredito, fechaDePago, gastadoConTarjeta, interesEstimado, resumenCredito, cuotasRestantes, cuotasVigentes } from './credito.js'

describe('periodosCredito', () => {
  it('después del cierre, el período actual termina el próximo mes', () => {
    expect(periodosCredito('2026-10-26', 20)).toEqual({
      actual: { desde: '2026-10-21', hasta: '2026-11-20' },
      anterior: { desde: '2026-09-21', hasta: '2026-10-20' },
    })
  })

  it('el mismo día del cierre todavía cuenta en el período que cierra hoy', () => {
    expect(periodosCredito('2026-10-20', 20)).toEqual({
      actual: { desde: '2026-09-21', hasta: '2026-10-20' },
      anterior: { desde: '2026-08-21', hasta: '2026-09-20' },
    })
  })

  it('cruza el cambio de año', () => {
    expect(periodosCredito('2027-01-05', 25)).toEqual({
      actual: { desde: '2026-12-26', hasta: '2027-01-25' },
      anterior: { desde: '2026-11-26', hasta: '2026-12-25' },
    })
  })

  it('cierre día 31 en meses cortos usa el último día del mes', () => {
    expect(periodosCredito('2027-02-10', 31).actual).toEqual({ desde: '2027-02-01', hasta: '2027-02-28' })
  })
})

describe('fechaDePago', () => {
  it('si el día de pago es menor que el de cierre, es el mes siguiente', () => {
    expect(fechaDePago('2026-10-20', 5)).toBe('2026-11-05')
  })
  it('si es mayor, es el mismo mes del cierre', () => {
    expect(fechaDePago('2026-10-10', 25)).toBe('2026-10-25')
  })
})

const movs = [
  { tipo: 'gasto', monto: 20000, fecha: '2026-09-25', medioPago: 'Crédito Banco C' },
  { tipo: 'gasto', monto: 15000, fecha: '2026-10-20', medioPago: 'Crédito Banco C' },
  { tipo: 'gasto', monto: 8000, fecha: '2026-10-22', medioPago: 'Crédito Banco C' },
  { tipo: 'gasto', monto: 99999, fecha: '2026-10-01', medioPago: 'Débito Banco A' }, // otra tarjeta
  { tipo: 'gasto', monto: 5000, fecha: '2026-09-20', medioPago: 'Crédito Banco C' }, // período anterior al anterior
]

describe('gastadoConTarjeta', () => {
  it('suma solo esa tarjeta y solo entre las fechas, incluidas', () => {
    expect(gastadoConTarjeta(movs, 'Crédito Banco C', { desde: '2026-09-21', hasta: '2026-10-20' })).toBe(35000)
  })
})

describe('interesEstimado', () => {
  it('aplica la tasa mensual a lo que queda pendiente', () => {
    expect(interesEstimado(100000, 3.2)).toBe(3200)
  })
  it('sin saldo pendiente o sin tasa, no hay interés', () => {
    expect(interesEstimado(0, 3.2)).toBe(0)
    expect(interesEstimado(100000, 0)).toBe(0)
  })
})

describe('resumenCredito', () => {
  const config = { nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5, tasaMensual: 3, comision: 2990 }

  it('calcula lo que hay que pagar, la fecha y lo usado en el período actual', () => {
    expect(resumenCredito(movs, config, '2026-10-26')).toMatchObject({
      compras: 35000,
      comision: 2990,
      aPagar: 37990,
      fechaPago: '2026-11-05',
      pagado: false,
      usadoActual: 8000,
    })
  })

  it('reconoce cuando ese estado de cuenta ya se marcó como pagado', () => {
    const r = resumenCredito(movs, { ...config, pagadoHasta: '2026-10-20' }, '2026-10-26')
    expect(r.pagado).toBe(true)
  })
})

// Las cuotas reales del ejemplo
const cuotas = [
  { id: 1, tarjeta: 'Crédito Banco C', descripcion: 'Ticketmaster', monto: 35583, hasta: '2027-04' },
  { id: 2, tarjeta: 'Crédito Banco C', descripcion: 'Ticketmaster', monto: 23596, hasta: '2027-04' },
  { id: 3, tarjeta: 'Crédito Banco C', descripcion: 'MyShop', monto: 72824, hasta: '2026-12' },
  { id: 4, tarjeta: 'Crédito Banco C', descripcion: 'Perfume', monto: 69154, hasta: '2027-09' },
  { id: 5, tarjeta: 'Otra tarjeta', descripcion: 'No cuenta', monto: 1, hasta: '2030-01' },
]

describe('cuotasRestantes', () => {
  it('cuenta los meses incluidos los dos extremos', () => {
    expect(cuotasRestantes('2027-04', '2026-11')).toBe(6)
    expect(cuotasRestantes('2026-12', '2026-11')).toBe(2)
    expect(cuotasRestantes('2026-11', '2026-11')).toBe(1)
  })
  it('si ya terminó, quedan 0', () => {
    expect(cuotasRestantes('2026-10', '2026-11')).toBe(0)
  })
})

describe('cuotasVigentes', () => {
  it('filtra por tarjeta y por mes de pago', () => {
    expect(cuotasVigentes(cuotas, 'Crédito Banco C', '2026-11')).toHaveLength(4)
    expect(cuotasVigentes(cuotas, 'Crédito Banco C', '2027-01').map((c) => c.descripcion)).toEqual([
      'Ticketmaster',
      'Ticketmaster',
      'Perfume',
    ])
  })
})

describe('resumenCredito con cuotas', () => {
  const config = { nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5, tasaMensual: 3, comision: 2990 }

  it('suma las cuotas vigentes al estado de cuenta', () => {
    const r = resumenCredito(movs, config, '2026-10-26', cuotas)
    expect(r.cuotas).toBe(201157) // 35.583 + 23.596 + 72.824 + 69.154
    expect(r.aPagar).toBe(35000 + 201157 + 2990)
  })

  it('estima el próximo estado de cuenta con lo usado más las cuotas que siguen', () => {
    const r = resumenCredito(movs, config, '2026-10-26', cuotas)
    expect(r.proximaFechaPago).toBe('2026-12-05')
    expect(r.proximoEstimado).toBe(8000 + 201157 + 2990) // en diciembre todavía se paga MyShop
  })

  it('calcula todo lo que falta pagar en cuotas', () => {
    const r = resumenCredito(movs, config, '2026-10-26', cuotas)
    // desde nov-2026: Ticketmaster 6 + Ticketmaster 6 + MyShop 2 + Perfume 11 cuotas
    expect(r.deudaCuotas).toBe(35583 * 6 + 23596 * 6 + 72824 * 2 + 69154 * 11)
  })

  it('si ya pagaste el estado de cuenta, la deuda se cuenta desde el próximo mes', () => {
    const r = resumenCredito(movs, { ...config, pagadoHasta: '2026-10-20' }, '2026-10-26', cuotas)
    expect(r.deudaCuotas).toBe(35583 * 5 + 23596 * 5 + 72824 * 1 + 69154 * 10)
  })
})
