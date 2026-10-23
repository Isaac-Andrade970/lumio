// Conexión con la "bandeja de entrada" de pagos en Supabase.
// El atajo del iPhone deja ahí cada pago de Apple Pay; Lumio los recoge al abrirse y los borra de la nube.

// La dirección y la llave pública vienen de variables de entorno (archivo .env.local y Vercel).
// No son secretas: la protección real es la CLAVE, que solo guardas en tu teléfono y en tu atajo.
const URL_SUPABASE = import.meta.env.VITE_SUPABASE_URL
const LLAVE_PUBLICA = import.meta.env.VITE_SUPABASE_KEY

// Crea un objeto con las 2 operaciones que usa Lumio.
// fetchFn se puede reemplazar en las pruebas por una versión falsa.
export function crearBandeja({ url, llave, fetchFn = (...args) => fetch(...args) }) {
  // Llama a una función de Supabase (RPC = "remote procedure call") y devuelve su respuesta
  async function llamar(funcion, datos) {
    const encabezados = { 'Content-Type': 'application/json', apikey: llave }
    // Las llaves antiguas ("anon", empiezan con eyJ) además necesitan ir como Authorization
    if (llave.startsWith('eyJ')) encabezados.Authorization = `Bearer ${llave}`

    const respuesta = await fetchFn(`${url}/rest/v1/rpc/${funcion}`, {
      method: 'POST',
      headers: encabezados,
      body: JSON.stringify(datos),
    })
    if (!respuesta.ok) {
      const detalle = await respuesta.text()
      throw new Error(detalle.includes('clave incorrecta') ? 'Clave incorrecta' : `Error ${respuesta.status}`)
    }
    const texto = await respuesta.text()
    return texto ? JSON.parse(texto) : null
  }

  return {
    // [{ id: 1, linea: '2026-10-23T13:45:10|$5.990|Starbucks|Visa' }, ...]
    leer: (clave) => llamar('leer_pagos', { clave }),
    borrar: (clave, ids) => llamar('borrar_pagos', { clave, ids }),
  }
}

// La bandeja real, o null si este sitio no tiene Supabase configurado (por ejemplo, alguien que copió el repositorio)
export const bandeja = URL_SUPABASE && LLAVE_PUBLICA ? crearBandeja({ url: URL_SUPABASE, llave: LLAVE_PUBLICA }) : null

// La clave se guarda solo en este teléfono (localStorage de la app instalada).
// try/catch: en algunos modos privados el navegador no deja guardar nada.
const NOMBRE = 'lumio-clave-wallet'

export function leerClave() {
  try {
    return localStorage.getItem(NOMBRE) ?? ''
  } catch {
    return ''
  }
}

export function guardarClave(clave) {
  try {
    if (clave) localStorage.setItem(NOMBRE, clave)
    else localStorage.removeItem(NOMBRE)
  } catch {
    // si no se puede guardar, la app sigue funcionando sin la conexión
  }
}
