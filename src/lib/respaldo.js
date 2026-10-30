// Respaldo y restauración: todos tus datos en un archivo .json, opcionalmente cifrado con contraseña.
// El cifrado usa Web Crypto (viene en el navegador): PBKDF2 para convertir la contraseña en llave + AES-GCM.

export const FORMATO_RESPALDO = 1 // súbelo si algún día cambia la estructura del archivo
export const TABLAS = ['movimientos', 'cuentas', 'creditos', 'cuotas', 'reglas', 'fijos', 'metas', 'preferencias']

// ---- Armar y revisar ----

export function armarRespaldo(datos, version, ahora = new Date()) {
  return { app: 'lumio', formato: FORMATO_RESPALDO, version, creado: ahora.toISOString(), datos }
}

export function nombreArchivo(fecha) {
  return `lumio-respaldo-${fecha}.json`
}

// Lee el texto de un archivo. Devuelve el objeto (cifrado o no) o lanza un error entendible.
export function leerArchivoRespaldo(texto) {
  let objeto
  try {
    objeto = JSON.parse(texto)
  } catch {
    throw new Error('Este archivo no es un respaldo de Lumio')
  }
  if (objeto?.app !== 'lumio') throw new Error('Este archivo no es un respaldo de Lumio')
  if (objeto.formato > FORMATO_RESPALDO) throw new Error('Este respaldo es de una versión más nueva de Lumio. Actualiza la app.')
  return objeto
}

// Revisa que un respaldo (ya descifrado) tenga lo necesario antes de reemplazar tus datos
export function validarRespaldo(respaldo) {
  const datos = respaldo?.datos
  if (!datos || typeof datos !== 'object') throw new Error('El respaldo está incompleto')
  for (const tabla of TABLAS) {
    if (datos[tabla] !== undefined && !Array.isArray(datos[tabla])) throw new Error('El respaldo está dañado')
  }
  const malos = (datos.movimientos ?? []).filter(
    (m) => typeof m.monto !== 'number' || typeof m.fecha !== 'string' || !['gasto', 'ingreso', 'transferencia'].includes(m.tipo),
  )
  if (malos.length > 0) throw new Error('El respaldo tiene movimientos dañados')
  return respaldo
}

// Resumen para mostrar antes de restaurar
export function resumirRespaldo(respaldo) {
  const d = respaldo.datos
  return {
    creado: respaldo.creado,
    version: respaldo.version,
    movimientos: d.movimientos?.length ?? 0,
    cuentas: d.cuentas?.length ?? 0,
    creditos: d.creditos?.length ?? 0,
    cuotas: d.cuotas?.length ?? 0,
    fijos: d.fijos?.length ?? 0,
    metas: d.metas?.length ?? 0,
  }
}

// ---- Cifrado con contraseña ----

const ITERACIONES = 250_000 // más iteraciones = más difícil adivinar la contraseña a la fuerza

function aBase64(bytes) {
  let texto = ''
  for (const b of new Uint8Array(bytes)) texto += String.fromCharCode(b)
  return btoa(texto)
}

function deBase64(texto) {
  return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0))
}

async function derivarLlave(contrasena, sal) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(contrasena), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: ITERACIONES, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function cifrarRespaldo(respaldo, contrasena) {
  const sal = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const llave = await derivarLlave(contrasena, sal)
  const contenido = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, llave, new TextEncoder().encode(JSON.stringify(respaldo)))
  // Lo que no es secreto queda a la vista (para reconocer el archivo); los datos van cifrados
  return {
    app: 'lumio',
    formato: FORMATO_RESPALDO,
    version: respaldo.version,
    creado: respaldo.creado,
    cifrado: true,
    sal: aBase64(sal),
    iv: aBase64(iv),
    contenido: aBase64(contenido),
  }
}

export async function descifrarRespaldo(archivo, contrasena) {
  try {
    const llave = await derivarLlave(contrasena, deBase64(archivo.sal))
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(archivo.iv) }, llave, deBase64(archivo.contenido))
    return JSON.parse(new TextDecoder().decode(plano))
  } catch {
    throw new Error('Contraseña incorrecta')
  }
}

// ---- Recordatorio: fecha del último respaldo (solo en este teléfono) ----

const ULTIMO = 'lumio-ultimo-respaldo'

export function leerUltimoRespaldo() {
  try {
    return Number(localStorage.getItem(ULTIMO)) || null
  } catch {
    return null
  }
}

export function anotarRespaldo(momento = Date.now()) {
  try {
    localStorage.setItem(ULTIMO, String(momento))
  } catch {
    // sin almacenamiento: solo no habrá recordatorio
  }
}

// Días desde el último respaldo (null = nunca)
export function diasDesdeRespaldo(ultimo, ahora = Date.now()) {
  if (!ultimo) return null
  return Math.floor((ahora - ultimo) / 86_400_000)
}
