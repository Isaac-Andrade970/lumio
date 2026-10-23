import { describe, it, expect } from 'vitest'
import { crearBandeja } from './bandeja.js'

// Un "fetch" falso que anota lo que se le pidió y responde lo que le digamos
function fetchFalso(respuesta, { ok = true, status = 200 } = {}) {
  const llamadas = []
  const fn = async (url, opciones) => {
    llamadas.push({ url, ...opciones, body: JSON.parse(opciones.body) })
    return { ok, status, text: async () => (typeof respuesta === 'string' ? respuesta : JSON.stringify(respuesta)) }
  }
  return { fn, llamadas }
}

describe('crearBandeja', () => {
  it('lee los pagos llamando a la función leer_pagos', async () => {
    const { fn, llamadas } = fetchFalso([{ id: 1, linea: 'x' }])
    const bandeja = crearBandeja({ url: 'https://demo.supabase.co', llave: 'sb_publishable_abc', fetchFn: fn })

    expect(await bandeja.leer('mi-clave')).toEqual([{ id: 1, linea: 'x' }])
    expect(llamadas[0].url).toBe('https://demo.supabase.co/rest/v1/rpc/leer_pagos')
    expect(llamadas[0].method).toBe('POST')
    expect(llamadas[0].headers.apikey).toBe('sb_publishable_abc')
    expect(llamadas[0].headers.Authorization).toBeUndefined()
    expect(llamadas[0].body).toEqual({ clave: 'mi-clave' })
  })

  it('con una llave antigua (eyJ...) también envía Authorization', async () => {
    const { fn, llamadas } = fetchFalso('')
    const bandeja = crearBandeja({ url: 'https://demo.supabase.co', llave: 'eyJhbGciOi', fetchFn: fn })
    await bandeja.borrar('mi-clave', [1, 2])
    expect(llamadas[0].headers.Authorization).toBe('Bearer eyJhbGciOi')
    expect(llamadas[0].body).toEqual({ clave: 'mi-clave', ids: [1, 2] })
  })

  it('avisa claramente si la clave es incorrecta', async () => {
    const { fn } = fetchFalso('{"message":"clave incorrecta"}', { ok: false, status: 400 })
    const bandeja = crearBandeja({ url: 'https://demo.supabase.co', llave: 'sb_publishable_abc', fetchFn: fn })
    await expect(bandeja.leer('otra')).rejects.toThrow('Clave incorrecta')
  })
})
