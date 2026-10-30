import { describe, it, expect } from 'vitest'
import {
  armarRespaldo,
  leerArchivoRespaldo,
  validarRespaldo,
  resumirRespaldo,
  cifrarRespaldo,
  descifrarRespaldo,
  diasDesdeRespaldo,
} from './respaldo.js'

const datos = {
  movimientos: [
    { id: 1, tipo: 'gasto', monto: 5990, fecha: '2026-10-26', categoria: 'comida', medioPago: 'Débito Banco A' },
    { id: 2, tipo: 'transferencia', monto: 20000, fecha: '2026-10-26', medioPago: 'Débito Banco A', destino: 'Efectivo' },
  ],
  cuentas: [{ nombre: 'Débito Banco A', saldoInicial: 400000, fechaSaldo: '2026-10-26', momentoSaldo: 1 }],
  creditos: [{ nombre: 'Crédito Banco C', diaCierre: 20, diaPago: 5 }],
  cuotas: [{ id: 1, tarjeta: 'Crédito Banco C', descripcion: 'Perfume', monto: 69154, hasta: '2027-09' }],
}
const respaldo = armarRespaldo(datos, '0.4.0', new Date('2026-10-26T15:00:00Z'))

describe('respaldo sin contraseña', () => {
  it('se puede leer, validar y resumir', () => {
    const leido = leerArchivoRespaldo(JSON.stringify(respaldo))
    expect(validarRespaldo(leido).datos).toEqual(datos)
    expect(resumirRespaldo(leido)).toEqual({
      creado: '2026-10-26T15:00:00.000Z',
      version: '0.4.0',
      movimientos: 2,
      cuentas: 1,
      creditos: 1,
      cuotas: 1,
      fijos: 0, // respaldos de antes de la v0.6 no traen estas tablas
      metas: 0,
    })
  })

  it('rechaza archivos que no son de Lumio', () => {
    expect(() => leerArchivoRespaldo('hola')).toThrow('no es un respaldo de Lumio')
    expect(() => leerArchivoRespaldo('{"app":"otra"}')).toThrow('no es un respaldo de Lumio')
  })

  it('rechaza respaldos de una versión más nueva', () => {
    expect(() => leerArchivoRespaldo('{"app":"lumio","formato":99}')).toThrow('versión más nueva')
  })

  it('rechaza movimientos dañados', () => {
    const malo = armarRespaldo({ movimientos: [{ tipo: 'gasto', monto: '5990', fecha: '2026-10-26' }] }, '0.4.0')
    expect(() => validarRespaldo(malo)).toThrow('dañados')
  })
})

describe('respaldo con contraseña', () => {
  it('cifra y descifra con la contraseña correcta', async () => {
    const cifrado = await cifrarRespaldo(respaldo, 'mi-clave-segura')
    expect(cifrado.cifrado).toBe(true)
    expect(JSON.stringify(cifrado)).not.toContain('Débito Banco A') // tus datos no se ven a simple vista
    expect(await descifrarRespaldo(cifrado, 'mi-clave-segura')).toEqual(respaldo)
  })

  it('con otra contraseña no se puede abrir', async () => {
    const cifrado = await cifrarRespaldo(respaldo, 'mi-clave-segura')
    await expect(descifrarRespaldo(cifrado, 'otra')).rejects.toThrow('Contraseña incorrecta')
  })
})

describe('diasDesdeRespaldo', () => {
  it('cuenta días completos y devuelve null si nunca respaldaste', () => {
    const ahora = Date.parse('2026-10-26T12:00:00Z')
    expect(diasDesdeRespaldo(ahora - 8 * 86_400_000, ahora)).toBe(8)
    expect(diasDesdeRespaldo(null, ahora)).toBeNull()
  })
})
