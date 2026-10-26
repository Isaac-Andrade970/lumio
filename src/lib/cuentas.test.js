import { describe, it, expect } from 'vitest'
import { saldoDeCuenta, resumenCuentas } from './cuentas.js'

// Anotaste el saldo el 26 de octubre a las "1000"
const cuentaA = { nombre: 'Débito Banco A', saldoInicial: 400000, fechaSaldo: '2026-10-26', momentoSaldo: 1000 }
const cuentaB = { nombre: 'Débito Banco B', saldoInicial: 85000, fechaSaldo: '2026-10-26', momentoSaldo: 1000 }

const movs = [
  { tipo: 'gasto', monto: 12000, fecha: '2026-10-24', medioPago: 'Débito Banco A', creado: 1 }, // antes: ya incluido
  { tipo: 'gasto', monto: 3000, fecha: '2026-10-26', medioPago: 'Débito Banco A', creado: 500 }, // mismo día, antes de anotar
  { tipo: 'gasto', monto: 5990, fecha: '2026-10-26', medioPago: 'débito banco a', creado: 2000 }, // mismo día, después
  { tipo: 'gasto', monto: 830, fecha: '2026-10-27', medioPago: 'Débito Banco B', creado: 3000 },
  { tipo: 'ingreso', monto: 950000, fecha: '2026-10-30', medioPago: 'Débito Banco A', creado: 4000 },
  { tipo: 'gasto', monto: 9990, fecha: '2026-10-27', medioPago: 'Crédito Banco C', creado: 5000 }, // crédito: no toca débitos
]

describe('saldoDeCuenta', () => {
  it('parte del saldo anotado y suma/resta solo lo posterior', () => {
    expect(saldoDeCuenta(cuentaA, movs)).toBe(400000 - 5990 + 950000)
    expect(saldoDeCuenta(cuentaB, movs)).toBe(85000 - 830)
  })

  it('descuenta los pagos de tarjeta de crédito hechos desde esa cuenta', () => {
    const creditos = [{ nombre: 'Crédito Banco C', pagos: [{ monto: 278137, cuenta: 'Débito Banco A', momento: 6000 }] }]
    expect(saldoDeCuenta(cuentaA, movs, creditos)).toBe(400000 - 5990 + 950000 - 278137)
    expect(saldoDeCuenta(cuentaB, movs, creditos)).toBe(85000 - 830)
  })

  it('un pago de tarjeta anterior a anotar el saldo ya estaba incluido', () => {
    const creditos = [{ nombre: 'Crédito Banco C', pagos: [{ monto: 50000, cuenta: 'Débito Banco A', momento: 10 }] }]
    expect(saldoDeCuenta(cuentaA, movs, creditos)).toBe(400000 - 5990 + 950000)
  })
})

describe('resumenCuentas', () => {
  it('suma el disponible de los débitos y muestra la crédito aparte', () => {
    const creditos = [{ nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5, comision: 0 }]
    const r = resumenCuentas([cuentaA, cuentaB], movs, creditos, [], '2026-10-28')
    expect(r.disponible).toBe(400000 - 5990 + 950000 + 85000 - 830)
    // nada en el período cerrado -> muestra el próximo estado estimado (lo usado desde el 21 de octubre)
    expect(r.deudas).toEqual([{ nombre: 'Crédito Banco C', monto: 9990, fecha: '2026-12-05', estimado: true }])
  })
})
