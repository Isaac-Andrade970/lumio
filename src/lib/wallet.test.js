import { describe, it, expect } from 'vitest'
import { adivinarCategoria, leerMontoWallet, leerArchivoWallet } from './wallet.js'

describe('leerMontoWallet', () => {
  it('entiende los formatos que puede entregar Wallet', () => {
    expect(leerMontoWallet('$5.990')).toBe(5990)
    expect(leerMontoWallet('CLP 5.990')).toBe(5990)
    expect(leerMontoWallet('5990,00')).toBe(5990)
    expect(leerMontoWallet('5,990.00')).toBe(5990)
    expect(leerMontoWallet('$1.250.000')).toBe(1250000)
  })
  it('devuelve 0 si no hay monto', () => {
    expect(leerMontoWallet('')).toBe(0)
  })
})

describe('adivinarCategoria', () => {
  it('usa el nombre del comercio', () => {
    expect(adivinarCategoria('STARBUCKS COSTANERA')).toBe('comida')
    expect(adivinarCategoria('Lider Express')).toBe('supermercado')
    expect(adivinarCategoria('Farmacias Cruz Verde')).toBe('salud')
  })
  it('la palabra más específica gana', () => {
    expect(adivinarCategoria('Uber Eats')).toBe('comida')
    expect(adivinarCategoria('Uber Trip')).toBe('transporte')
  })
  it('si no reconoce el comercio, usa Otros', () => {
    expect(adivinarCategoria('Kiosko Don Pepe')).toBe('otros-gasto')
  })
})

describe('leerArchivoWallet', () => {
  const archivo = [
    '2026-10-23T13:45:10|$5.990|Starbucks|Visa',
    '',
    '2026-10-23T18:02:44|$24.500|Lider|Visa',
    '2026-10-23T19:10:00||Metro|Visa', // Wallet no trajo monto
    'texto cualquiera', // formato raro
  ].join('\n')

  it('convierte cada línea en un gasto', () => {
    const { movimientos, sinMonto } = leerArchivoWallet(archivo)
    expect(movimientos).toHaveLength(2)
    expect(movimientos[0]).toMatchObject({
      tipo: 'gasto',
      monto: 5990,
      categoria: 'comida',
      fecha: '2026-10-23',
      nota: 'Starbucks',
      origen: 'wallet',
    })
    expect(sinMonto).toBe(1)
  })

  it('cada línea tiene un identificador distinto y estable', () => {
    const a = leerArchivoWallet(archivo).movimientos.map((m) => m.externoId)
    const b = leerArchivoWallet(archivo).movimientos.map((m) => m.externoId)
    expect(new Set(a).size).toBe(a.length)
    expect(a).toEqual(b) // leer el mismo archivo dos veces da los mismos ids
  })
})
