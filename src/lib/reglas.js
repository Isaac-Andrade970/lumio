// Lumio aprende tus categorías: si a "Lider" le pones Súper, la próxima compra en Lider llega como Súper.
// Una regla es { clave: 'lider', categoria: 'supermercado', tipo: 'gasto' }.
// La clave sale del nombre del comercio "limpio", para que "PAYU *UBER TRIP SANTIAGO" (cartola) y "Uber" (Wallet)
// se reconozcan como el mismo comercio.

// Prefijos de intermediarios de pago que no son el comercio real
const PREFIJOS = ['mercadopago', 'merpago', 'payu', 'pedidosya', 'sumup', 'tuu', 'getnet', 'transbank', 'webpay', 'paypal', 'dlocal']

// Palabras que no ayudan a reconocer el comercio (países, ciudades frecuentes en cartolas)
const RUIDO = new Set(['chl', 'cl', 'usa', 'us', 'santiago', 'scl', 'spa', 'ltda', 'sa', 'cia', 'de', 'la', 'el', 'los', 'las'])

// "PAYU *UBER TRIP SANTIAGO" -> "uber trip" · "40517-SBX LYON SANTIAGO CHL" -> "sbx lyon" · "Lider" -> "lider"
export function claveComercio(texto = '') {
  let limpio = texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita tildes
    .replace(/^\d+[-\s]*/, '') // códigos al inicio ("40517-")
    .replace(/^(transferencia|transf|traspaso)\.?\s+(a|de|para)\s*:?\s*/, '') // "Transferencia a Lucho" -> "lucho"
  for (const prefijo of PREFIJOS) {
    limpio = limpio.replace(new RegExp(`^${prefijo}\\s*\\*\\s*`), '')
  }
  const palabras = limpio
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .split(/\s+/)
    .filter((p) => p.length >= 2 && !RUIDO.has(p) && !/^\d+$/.test(p))
  return palabras.slice(0, 2).join(' ')
}

// ¿La regla corresponde a este comercio? "uber" sirve para "uber trip" y al revés (por palabras completas)
function coincide(claveTexto, claveRegla) {
  if (!claveTexto || !claveRegla || claveRegla.length < 3) return false
  const empieza = (a, b) => a === b || a.startsWith(`${b} `)
  return empieza(claveTexto, claveRegla) || empieza(claveRegla, claveTexto)
}

// Categoría que aprendiste para este comercio (o null). Si varias sirven, gana la más específica (la clave más larga).
export function categoriaAprendida(texto, reglas, tipo = 'gasto') {
  const clave = claveComercio(texto)
  let mejor = null
  for (const regla of reglas) {
    if ((regla.tipo ?? 'gasto') !== tipo || !coincide(clave, regla.clave)) continue
    if (!mejor || regla.clave.length > mejor.clave.length) mejor = regla
  }
  return mejor?.categoria ?? null
}

// Regla nueva a partir de un movimiento que categorizaste a mano (o null si no hay de dónde aprender)
export function reglaDesde(mov) {
  if (!mov.nota || mov.tipo === 'transferencia' || !mov.categoria) return null
  if (mov.categoria === 'otros-gasto' || mov.categoria === 'otros-ingreso') return null // "Otros" no enseña nada
  const clave = claveComercio(mov.nota)
  if (clave.length < 3) return null
  return { clave, categoria: mov.categoria, tipo: mov.tipo }
}
