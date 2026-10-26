import { describe, it, expect } from 'vitest'
import { periodosCredito, fechaDePago, gastadoConTarjeta, interesEstimado, resumenCredito, cuotasRestantes, cuotasVigentes, mismaTarjeta, primerMesDePago, cuotasDeCompras } from './credito.js'

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

describe('mismaTarjeta', () => {
  it('ignora mayúsculas y espacios de más', () => {
    expect(mismaTarjeta('Crédito Banco C', '  crédito   banco c ')).toBe(true)
    expect(mismaTarjeta('Crédito Banco C', 'Débito Banco A')).toBe(false)
  })
  it('un nombre vacío nunca coincide', () => {
    expect(mismaTarjeta('', '')).toBe(false)
    expect(mismaTarjeta(undefined, 'Crédito Banco C')).toBe(false)
  })
  it('la tarjeta configurada a mano reconoce los pagos de Wallet aunque cambien mayúsculas', () => {
    const pagos = [{ tipo: 'gasto', monto: 9990, fecha: '2026-10-25', medioPago: 'CRÉDITO BANCO C' }]
    expect(gastadoConTarjeta(pagos, 'Crédito Banco C', { desde: '2026-10-21', hasta: '2026-11-20' })).toBe(9990)
  })
})

describe('compras en cuotas', () => {
  const config = { nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5, comision: 0 }
  const compras = [
    // 6 cuotas comprada el 22 de octubre: cae en el período que cierra el 20 de noviembre -> 1ª cuota en diciembre
    { id: 7, tipo: 'gasto', monto: 120000, fecha: '2026-10-22', nota: 'Audífonos', medioPago: 'Crédito Banco C', cuotas: 6 },
    // 3 cuotas con interés: el valor de la cuota viene del voucher
    { id: 8, tipo: 'gasto', monto: 60000, fecha: '2026-10-10', nota: 'Zapatos', medioPago: 'Crédito Banco C', cuotas: 3, valorCuota: 21500 },
    // en 1 cuota: se cobra completo
    { id: 9, tipo: 'gasto', monto: 9990, fecha: '2026-10-23', nota: 'Sushi', medioPago: 'Crédito Banco C', cuotas: 1 },
  ]

  it('la primera cuota se paga en el estado de cuenta donde cae la compra', () => {
    expect(primerMesDePago('2026-10-22', config)).toBe('2026-12')
    expect(primerMesDePago('2026-10-10', config)).toBe('2026-11')
  })

  it('convierte las compras en cuotas comprometidas', () => {
    expect(cuotasDeCompras(compras, config)).toEqual([
      { id: 'compra-7', deCompra: true, tarjeta: 'Crédito Banco C', descripcion: 'Audífonos', monto: 20000, desde: '2026-12', hasta: '2027-05' },
      { id: 'compra-8', deCompra: true, tarjeta: 'Crédito Banco C', descripcion: 'Zapatos', monto: 21500, desde: '2026-11', hasta: '2027-01' },
    ])
  })

  it('las compras en cuotas no se suman enteras al estado de cuenta, solo su cuota', () => {
    const r = resumenCredito(compras, config, '2026-10-26')
    expect(r.compras).toBe(0) // Zapatos (10 oct) va en cuotas
    expect(r.cuotas).toBe(21500) // 1ª cuota de Zapatos en noviembre
    expect(r.usadoActual).toBe(9990) // solo el Sushi en 1 cuota
    expect(r.proximoEstimado).toBe(9990 + 21500 + 20000) // diciembre: Sushi + Zapatos + 1ª de Audífonos
    expect(r.deudaCuotas).toBe(21500 * 3 + 20000 * 6)
  })
})

describe('pagos parciales', () => {
  // Estado de cuenta que cerró el 20 de octubre: 35.000 de compras + 201.157 de cuotas + 2.990 de comisión = 239.147
  const base = { nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5, tasaMensual: 3, comision: 2990 }
  const total = 35000 + 201157 + 2990

  it('sin pagos, todo está pendiente y no se arrastra nada al próximo', () => {
    const r = resumenCredito(movs, base, '2026-10-26', cuotas)
    expect(r.pendiente).toBe(total)
    expect(r.pagado).toBe(false)
    expect(r.proximoArrastre).toBe(0)
  })

  it('un pago menor deja un pendiente que pasa al próximo estado con interés', () => {
    const config = { ...base, pagos: [{ periodo: '2026-10-20', monto: 100000, cuenta: 'Débito Banco A', momento: 1 }] }
    const r = resumenCredito(movs, config, '2026-10-26', cuotas)
    const falta = total - 100000
    expect(r.pagadoMonto).toBe(100000)
    expect(r.pendiente).toBe(falta)
    expect(r.pagado).toBe(false)
    expect(r.proximoArrastre).toBe(falta + Math.round(falta * 0.03))
    expect(r.proximoEstimado).toBe(8000 + 201157 + 2990 + falta + Math.round(falta * 0.03))
  })

  it('dos pagos que suman el total lo dejan pagado', () => {
    const config = {
      ...base,
      pagos: [
        { periodo: '2026-10-20', monto: 100000, cuenta: null, momento: 1 },
        { periodo: '2026-10-20', monto: total - 100000, cuenta: null, momento: 2 },
      ],
    }
    const r = resumenCredito(movs, config, '2026-10-26', cuotas)
    expect(r.pendiente).toBe(0)
    expect(r.pagado).toBe(true)
    expect(r.proximoArrastre).toBe(0)
  })

  it('al mes siguiente, el estado de cuenta incluye lo que quedó pendiente', () => {
    const config = { ...base, pagos: [{ periodo: '2026-10-20', monto: 100000, cuenta: null, momento: 1 }] }
    const r = resumenCredito(movs, config, '2026-11-26', cuotas) // ahora el cerrado es el del 20 de noviembre
    const falta = total - 100000
    expect(r.arrastre).toBe(falta)
    expect(r.interesArrastre).toBe(Math.round(falta * 0.03))
    expect(r.aPagar).toBe(8000 + 201157 + 2990 + falta + Math.round(falta * 0.03))
  })
})
