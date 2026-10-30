import { describe, it, expect, afterEach } from 'vitest'
import { claveComercio, categoriaAprendida, reglaDesde } from './reglas.js'
import { proximoDeFijo, proximosPagos, comprometidoDelMes, fechaDelMes } from './agenda.js'
import { progresoMeta, mesesHasta } from './metas.js'
import { formatearPesos, ocultarMontos } from './formato.js'
import { periodosCredito, fechaDePago, resumenCredito } from './credito.js'

describe('Lumio aprende tus categorías', () => {
  it('reconoce el mismo comercio escrito distinto en Wallet y en la cartola', () => {
    expect(claveComercio('PAYU *UBER TRIP SANTIAGO')).toBe('uber trip')
    expect(claveComercio('40517-SBX LYON SANTIAGO CHL')).toBe('sbx lyon')
    expect(claveComercio('Transferencia a Lucho')).toBe('lucho')
    const reglas = [{ clave: 'uber', categoria: 'transporte', tipo: 'gasto' }]
    expect(categoriaAprendida('PAYU *UBER TRIP SANTIAGO', reglas)).toBe('transporte')
    expect(categoriaAprendida('Uber', reglas)).toBe('transporte')
    expect(categoriaAprendida('Uberrimo Bar', reglas)).toBe(null) // palabra completa, no un pedazo
  })

  it('gana la regla más específica', () => {
    const reglas = [
      { clave: 'uber', categoria: 'transporte', tipo: 'gasto' },
      { clave: 'uber eats', categoria: 'comida', tipo: 'gasto' },
    ]
    expect(categoriaAprendida('Uber Eats', reglas)).toBe('comida')
  })

  it('aprende de un movimiento con nota y categoría, pero no de "Otros"', () => {
    expect(reglaDesde({ tipo: 'gasto', nota: 'Lider Express', categoria: 'supermercado' })).toEqual({ clave: 'lider express', categoria: 'supermercado', tipo: 'gasto' })
    expect(reglaDesde({ tipo: 'gasto', nota: 'Lider', categoria: 'otros-gasto' })).toBe(null)
    expect(reglaDesde({ tipo: 'gasto', nota: '', categoria: 'comida' })).toBe(null)
  })
})

describe('gastos fijos y agenda', () => {
  const arriendo = { id: 1, nombre: 'Arriendo', monto: 300000, dia: 5 }
  const spotify = { id: 2, nombre: 'Spotify', monto: 2700, dia: 16 }

  it('ajusta el día a meses cortos', () => {
    expect(fechaDelMes('2026-11', 31)).toBe('2026-11-30')
    expect(fechaDelMes('2027-02', 30)).toBe('2027-02-28')
  })

  it('si no lo pagaste queda atrasado; si lo pagaste pasa al mes siguiente', () => {
    expect(proximoDeFijo(arriendo, [], '2026-10-29')).toEqual({ fecha: '2026-10-05', atrasado: true })
    const pagado = [{ tipo: 'gasto', monto: 300000, fecha: '2026-10-04', fijoId: 1 }]
    expect(proximoDeFijo(arriendo, pagado, '2026-10-29')).toEqual({ fecha: '2026-11-05', atrasado: false })
    // También cuenta si llegó por Wallet con el mismo nombre y un monto parecido
    const porWallet = [{ tipo: 'gasto', monto: 2790, fecha: '2026-10-16', nota: 'SPOTIFY' }]
    expect(proximoDeFijo(spotify, porWallet, '2026-10-29').fecha).toBe('2026-11-16')
  })

  it('arma la agenda con fijos y tarjeta, y suma lo comprometido del mes', () => {
    const resumen = { pendiente: 120000, fechaPago: '2026-11-06', proximoEstimado: 0, proximaFechaPago: '2026-12-06', listaCuotas: [{ descripcion: 'Tienda', monto: 8000, hasta: '2026-11' }] }
    const agenda = proximosPagos({ fijos: [arriendo, spotify], tarjetas: [{ nombre: 'Crédito', resumen }], hoy: '2026-10-29' })
    expect(agenda.map((p) => [p.tipo, p.fecha])).toEqual([
      ['fijo', '2026-10-05'],
      ['fijo', '2026-10-16'],
      ['tarjeta', '2026-11-06'],
      ['finCuotas', '2026-11-06'],
    ])
    expect(agenda[3].liberado).toBe(8000)
    expect(comprometidoDelMes(agenda, '2026-10-29')).toBe(302700)
  })
})

describe('metas de ahorro', () => {
  it('calcula avance y cuánto apartar al mes', () => {
    expect(mesesHasta('2027-03', '2026-10-29')).toBe(6)
    const meta = { nombre: 'Viaje', objetivo: 600000, mesLimite: '2027-03', aportes: [{ monto: 100000, fecha: '2026-10-01' }] }
    expect(progresoMeta(meta, '2026-10-29')).toMatchObject({ ahorrado: 100000, falta: 500000, porcentaje: 17, meses: 6, porMes: 83334, cumplida: false })
  })

  it('una meta vencida pide todo lo que falta', () => {
    const meta = { objetivo: 100000, mesLimite: '2026-09', aportes: [] }
    expect(progresoMeta(meta, '2026-10-29')).toMatchObject({ vencida: true, porMes: 100000 })
  })
})

describe('modo privado', () => {
  afterEach(() => ocultarMontos(false))

  it('oculta los montos salvo donde se piden explícitamente', () => {
    ocultarMontos(true)
    expect(formatearPesos(5990)).toBe('$•••••')
    expect(formatearPesos(5990, { mostrar: true })).toBe('$5.990')
    ocultarMontos(false)
    expect(formatearPesos(5990)).toBe('$5.990')
  })
})

describe('tarjeta con estados de cuenta importados', () => {
  const periodos = [
    { desde: '2026-07-24', hasta: '2026-08-21' },
    { desde: '2026-08-22', hasta: '2026-09-22', pagarHasta: '2026-10-06' },
    { desde: '2026-09-23', hasta: '2026-10-22' },
  ]

  it('usa las fechas exactas del banco y calcula las que faltan sin montarse', () => {
    expect(periodosCredito('2026-09-10', 20, periodos)).toEqual({
      actual: { desde: '2026-08-22', hasta: '2026-09-22' },
      anterior: { desde: '2026-07-24', hasta: '2026-08-21' },
    })
    expect(periodosCredito('2026-10-29', 22, periodos).actual).toEqual({ desde: '2026-10-23', hasta: '2026-11-22' })
    expect(fechaDePago('2026-09-22', 5, periodos)).toBe('2026-10-06')
  })

  it('un estado oficial con saldo a favor no pide pagar y el resto se descuenta del siguiente', () => {
    const config = {
      nombre: 'Crédito', diaCierre: 22, diaPago: 6, tasaMensual: 3.42, comision: 0, pagos: [], periodos,
      estados: [{ desde: '2026-08-22', hasta: '2026-09-22', pagarHasta: '2026-10-06', total: -100000 }],
    }
    const cuotas = [{ tarjeta: 'Crédito', descripcion: 'Concierto', monto: 60000, desde: '2026-06', hasta: '2027-05' }]
    // Octubre: el estado oficial dice saldo a favor
    const oct = resumenCredito([], config, '2026-10-01', cuotas)
    expect(oct).toMatchObject({ oficial: true, aPagar: 0, saldoFavor: 100000, pagado: true })
    // Noviembre: la cuota de 60.000 la cubre el saldo a favor y sobran 40.000 para diciembre
    const nov = resumenCredito([], config, '2026-10-29', cuotas)
    expect(nov).toMatchObject({ aPagar: 0, favorAplicado: 60000, saldoFavor: 40000, proximoEstimado: 20000 })
  })
})
