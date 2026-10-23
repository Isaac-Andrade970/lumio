// Importación de pagos anotados por el atajo de Wallet.
// Cada pago es una línea del archivo pagos.txt con este formato:
//   2026-10-23T13:45:10|$5.990|Starbucks|Visa
//   (fecha y hora | monto | comercio | tarjeta)

// Reglas simples para adivinar la categoría según el nombre del comercio.
// Puedes agregar las tuyas: la primera regla que coincide gana.
const REGLAS = [
  { categoria: 'transporte', palabras: ['uber', 'didi', 'cabify', 'metro', 'bip', 'copec', 'shell', 'petrobras', 'aramco'] },
  { categoria: 'supermercado', palabras: ['lider', 'líder', 'jumbo', 'unimarc', 'santa isabel', 'tottus', 'acuenta', 'mayorista'] },
  { categoria: 'comida', palabras: ['starbucks', 'mcdonald', 'burger', 'kfc', 'domino', 'pizza', 'sushi', 'juan maestro', 'dunkin', 'rappi', 'pedidosya', 'uber eats'] },
  { categoria: 'salud', palabras: ['farmacia', 'cruz verde', 'salcobrand', 'ahumada', 'dr simi', 'clinica', 'clínica'] },
  { categoria: 'ocio', palabras: ['netflix', 'spotify', 'cinemark', 'cineplanet', 'steam', 'playstation', 'disney'] },
  { categoria: 'compras', palabras: ['falabella', 'ripley', 'paris', 'h&m', 'zara', 'mercadolibre', 'aliexpress', 'amazon'] },
]

// "Uber Eats" -> 'comida' (las reglas más específicas deberían ir antes si se pisan)
export function adivinarCategoria(comercio = '') {
  const nombre = comercio.toLowerCase()
  // Revisa primero las palabras más largas para que "uber eats" gane a "uber"
  let mejor = null
  for (const regla of REGLAS) {
    for (const palabra of regla.palabras) {
      if (nombre.includes(palabra) && (!mejor || palabra.length > mejor.palabra.length)) {
        mejor = { categoria: regla.categoria, palabra }
      }
    }
  }
  return mejor?.categoria ?? 'otros-gasto'
}

// Convierte el monto que entrega Wallet en un entero de pesos.
// "$5.990" -> 5990, "CLP 5.990" -> 5990, "5990,00" -> 5990, "5,990.00" -> 5990
export function leerMontoWallet(texto = '') {
  let limpio = String(texto).replace(/[^\d.,]/g, '') // deja solo dígitos, puntos y comas
  limpio = limpio.replace(/[.,]\d{1,2}$/, '') // quita decimales del final (",00" o ".5")
  const soloDigitos = limpio.replace(/\D/g, '')
  return soloDigitos ? parseInt(soloDigitos, 10) : 0
}

// Lee el texto completo del archivo y devuelve los movimientos listos para guardar.
// { movimientos: [...], sinMonto: 2 }  (sinMonto = líneas que Wallet no trajo con monto)
export function leerArchivoWallet(texto) {
  const movimientos = []
  let sinMonto = 0

  for (const linea of texto.split(/\r?\n/)) {
    if (!linea.trim()) continue // salta líneas vacías
    const [fechaHora = '', montoTexto = '', comercio = '', tarjeta = ''] = linea.split('|').map((p) => p.trim())

    const fecha = fechaHora.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue // línea con formato raro: se ignora

    const monto = leerMontoWallet(montoTexto)
    if (monto <= 0) {
      sinMonto++
      continue
    }

    movimientos.push({
      tipo: 'gasto',
      monto,
      categoria: adivinarCategoria(comercio),
      fecha,
      nota: comercio,
      medioPago: tarjeta,
      origen: 'wallet',
      externoId: `wallet-${fechaHora}-${monto}`, // identifica la línea para no importarla dos veces
    })
  }

  return { movimientos, sinMonto }
}
