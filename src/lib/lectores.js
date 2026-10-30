// Lectores de cartolas y estados de cuenta en PDF.
// pdf.js entrega cada pedazo de texto con su posición en la hoja; aquí se arman las filas y se interpretan.
// Todo es función pura (recibe líneas, devuelve datos) para poder probarlo sin un PDF real.
//
// Una línea: { pagina, y, items: [{ s: texto, x: borde izquierdo, r: borde derecho }], texto }

// ---- Utilidades ----

// "1.234" / "$1.234" / "-168.935" -> número entero de pesos
export function leerPesos(texto) {
  const limpio = String(texto).replace(/[$\s]/g, '')
  const negativo = limpio.startsWith('-')
  const n = parseInt(limpio.replace(/\D/g, ''), 10)
  if (Number.isNaN(n)) return null
  return negativo ? -n : n
}

// "22/09/2026" -> "2026-09-22" · "22/09/26" -> "2026-09-22"
export function fechaDMA(texto) {
  const m = String(texto).match(/(\d{2})\/(\d{2})\/(\d{4}|\d{2})/)
  if (!m) return null
  const anio = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${anio}-${m[2]}-${m[1]}`
}

// Agrupa los pedazos de texto en líneas (misma altura = misma línea, con una tolerancia pequeña)
export function agruparLineas(paginas, tolerancia = 2.5) {
  const lineas = []
  paginas.forEach((items, i) => {
    const ordenados = items.filter((it) => it.s.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
    let actual = null
    for (const it of ordenados) {
      if (!actual || Math.abs(actual.y - it.y) > tolerancia) {
        actual = { pagina: i + 1, y: it.y, items: [] }
        lineas.push(actual)
      }
      actual.items.push(it)
    }
  })
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x)
    l.texto = l.items.map((it) => it.s.trim()).join(' ').replace(/\s+/g, ' ')
  }
  return lineas
}

function buscar(lineas, regex) {
  for (const l of lineas) {
    const m = l.texto.match(regex)
    if (m) return m
  }
  return null
}

// Nombre del titular: la línea que sigue a un rótulo como "SR(A)(ES)"
function lineaDespues(lineas, regex) {
  const i = lineas.findIndex((l) => regex.test(l.texto))
  return i >= 0 ? (lineas[i + 1]?.texto ?? '') : ''
}

function soloDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '')
}

// Posición x de un título de columna dentro de una línea
function columna(linea, texto) {
  return linea.items.find((it) => it.s.trim().toUpperCase().startsWith(texto.toUpperCase()))?.x ?? null
}

// ---- Reconocer qué documento es ----

export function reconocer(lineas) {
  const todo = lineas.map((l) => l.texto).join('\n').toUpperCase()
  if (todo.includes('ESTADO DE CUENTA') && todo.includes('TARJETA DE CRÉDITO') && todo.includes('INFORMACIÓN GENERAL')) {
    return 'tarjeta-chile'
  }
  if (todo.includes('CUENTA CORRIENTE') && todo.includes('DETALLE DE TRANSACCION') && todo.includes('MONTO CHEQUES')) {
    return 'cartola-chile'
  }
  if (todo.includes('NUMERO DE CUENTA') && todo.includes('CARTOLA N°') && todo.includes('MOVIMIENTOS') && /\bCARGO\b/.test(todo)) {
    return 'cartola-falabella'
  }
  return null
}

// Lee cualquiera de los formatos conocidos. Lanza un error entendible si no lo reconoce.
export function leerDocumento(lineas) {
  const tipo = reconocer(lineas)
  if (tipo === 'cartola-chile') return leerCartolaChile(lineas)
  if (tipo === 'cartola-falabella') return leerCartolaFalabella(lineas)
  if (tipo === 'tarjeta-chile') return leerEstadoTarjetaChile(lineas)
  throw new Error('No reconozco este documento. Por ahora Lumio lee cartolas del Banco de Chile y Banco Falabella, y estados de cuenta de tarjeta del Banco de Chile.')
}

// Verifica una cartola sumando y restando fila por fila contra los saldos que informa el banco
function verificarCartola(filas, saldoInicial, saldoFinal) {
  let saldo = saldoInicial
  for (const f of filas) {
    saldo += (f.abono ?? 0) - (f.cargo ?? 0)
    if (f.saldo != null && f.saldo !== saldo) {
      return { ok: false, mensaje: `El saldo no cuadra el ${f.fecha.split('-').reverse().join('/')}: Lumio calcula ${saldo} y la cartola dice ${f.saldo}.` }
    }
  }
  if (saldoFinal != null && saldo !== saldoFinal) {
    return { ok: false, mensaje: `El saldo final no cuadra: Lumio calcula ${saldo} y la cartola dice ${saldoFinal}.` }
  }
  return { ok: true, mensaje: 'Los saldos cuadran con la cartola.' }
}

// ---- Banco de Chile · cartola de cuenta corriente ----
// Fechas DIA/MES sin año; cargo o abono se sabe por la columna; saldo solo al cierre de cada día.

export function leerCartolaChile(lineas) {
  const cuenta = buscar(lineas, /N° DE CUENTA\s*:\s*([X\d]+)/i)?.[1] ?? ''
  const numero = buscar(lineas, /CARTOLA N°\s*:\s*(\d+)/i)?.[1] ?? ''
  const desde = fechaDMA(buscar(lineas, /DESDE\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1])
  const hasta = fechaDMA(buscar(lineas, /HASTA\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1])
  if (!desde || !hasta) throw new Error('No encontré las fechas "Desde" y "Hasta" de la cartola.')

  const filas = []
  let saldoInicial = null
  let saldoFinal = null
  let cols = null // posiciones de las columnas de montos (se leen del título de la tabla)

  for (const l of lineas) {
    if (l.texto.includes('MONTO CHEQUES') && l.texto.includes('SALDO')) {
      cols = {
        cargo: columna(l, 'MONTO CHEQUES'),
        abono: columna(l, 'MONTO DEPOSITOS'),
        saldo: l.items.filter((it) => it.s.trim().toUpperCase() === 'SALDO').at(-1)?.x,
        sucursal: columna(l, 'SUCURSAL'),
      }
      continue
    }
    if (!cols) continue
    const primero = l.items[0]
    if (!/^\d{2}\/\d{2}$/.test(primero.s.trim())) continue

    const [dia, mes] = primero.s.trim().split('/')
    const anioHasta = Number(hasta.slice(0, 4))
    const anio = Number(mes) > Number(hasta.slice(5, 7)) ? anioHasta - 1 : anioHasta // cartola que cruza diciembre → enero
    const fecha = `${anio}-${mes}-${dia}`

    let cargo = null
    let abono = null
    let saldo = null
    const detalle = []
    for (const it of l.items.slice(1)) {
      const texto = it.s.trim()
      const esMonto = /^-?[\d.]+$/.test(texto) && it.r > cols.cargo
      if (esMonto) {
        const valor = leerPesos(texto)
        if (it.r <= cols.abono) cargo = valor
        else if (it.r <= cols.saldo) abono = valor
        else saldo = valor
      } else if (it.x < cols.sucursal - 15) {
        detalle.push(texto)
      }
    }
    const textoDetalle = detalle.join(' ')
    if (/^SALDO INICIAL/i.test(textoDetalle)) {
      saldoInicial = saldo
      continue
    }
    if (/^SALDO FINAL/i.test(textoDetalle)) {
      saldoFinal = saldo
      continue
    }
    if (cargo == null && abono == null) continue
    filas.push({ fecha, detalle: textoDetalle, cargo, abono, saldo })
  }

  if (saldoInicial == null) throw new Error('No encontré el saldo inicial de la cartola.')
  return {
    tipo: 'cartola',
    formato: 'cartola-chile',
    banco: 'Banco de Chile',
    titular: lineaDespues(lineas, /^SR\(A\)\(ES\)/i),
    cuenta,
    digitos: soloDigitos(cuenta).slice(-4),
    numero,
    desde,
    hasta,
    saldoInicial,
    saldoFinal,
    filas,
    verificacion: verificarCartola(filas, saldoInicial, saldoFinal),
  }
}

// ---- Banco Falabella · cartola de cuenta corriente ----
// Fechas completas, saldo en cada fila. Las descripciones largas vienen partidas: un pedazo sobre la fila
// y otro bajo ella, así que se juntan los textos de la columna Descripción que están cerca en altura.

export function leerCartolaFalabella(lineas) {
  const cuenta = buscar(lineas, /Numero de Cuenta\s*:\s*([\d-]+)/i)?.[1] ?? ''
  const numero = buscar(lineas, /Cartola N°\s*:\s*(\d+)/i)?.[1] ?? ''
  const rango = buscar(lineas, /desde\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*Hasta\s*:\s*(\d{2}\/\d{2}\/\d{4})/i)
  if (!rango) throw new Error('No encontré las fechas "desde" y "Hasta" de la cartola.')
  const desde = fechaDMA(rango[1])
  const hasta = fechaDMA(rango[2])

  // Saldo inicial y final del resumen: la línea de montos bajo "Saldo Inicial  Saldo Final ..."
  let saldoInicial = null
  let saldoFinal = null
  const iResumen = lineas.findIndex((l) => /Saldo Inicial/i.test(l.texto) && /Saldo Final/i.test(l.texto))
  if (iResumen >= 0) {
    const montos = lineas[iResumen + 1]?.items.map((it) => it.s.trim()).filter((s) => /^\$-?[\d.]+$/.test(s)) ?? []
    saldoInicial = montos[0] != null ? leerPesos(montos[0]) : null
    saldoFinal = montos[1] != null ? leerPesos(montos[1]) : null
  }

  const filas = []
  const sueltos = [] // pedazos de descripción en su propia línea: { pagina, y, texto }
  const colsPorPagina = {}

  for (const l of lineas) {
    if (/^Fecha\b/.test(l.texto) && /\bCargo\b/.test(l.texto) && /\bAbono\b/.test(l.texto)) {
      const doc = l.items.find((it) => /^N° Documento/i.test(it.s.trim()))
      colsPorPagina[l.pagina] = {
        descDesde: doc ? doc.r : columna(l, 'Descripción') - 50,
        cargo: columna(l, 'Cargo'),
        abono: columna(l, 'Abono'),
        saldo: columna(l, 'Saldo'),
      }
      continue
    }
    const cols = colsPorPagina[l.pagina]
    if (!cols) continue

    const primero = l.items[0].s.trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(primero)) {
      let cargo = null
      let abono = null
      let saldo = null
      const detalle = []
      for (const it of l.items.slice(1)) {
        const texto = it.s.trim()
        if (/^\$-?[\d.]+$/.test(texto)) {
          const valor = leerPesos(texto)
          if (it.r <= cols.abono) cargo = valor
          else if (it.r <= cols.saldo) abono = valor
          else saldo = valor
        } else if (it.x > cols.descDesde && it.x < cols.cargo) {
          detalle.push(texto)
        }
      }
      filas.push({ pagina: l.pagina, y: l.y, fecha: fechaDMA(primero), partes: detalle, cargo: cargo || null, abono: abono || null, saldo })
    } else if (l.items.every((it) => it.x > cols.descDesde && it.r < cols.cargo + 10)) {
      sueltos.push({ pagina: l.pagina, y: l.y, texto: l.texto })
    }
  }

  // Cada pedazo suelto va a la fila más cercana (a menos de 7 puntos de altura): arriba = antes, abajo = después
  for (const s of sueltos) {
    let mejor = null
    for (const f of filas) {
      if (f.pagina !== s.pagina) continue
      const d = Math.abs(f.y - s.y)
      if (d <= 7 && (!mejor || d < mejor.d)) mejor = { f, d }
    }
    if (!mejor) continue
    if (s.y > mejor.f.y) mejor.f.antes = [...(mejor.f.antes ?? []), s.texto]
    else mejor.f.despues = [...(mejor.f.despues ?? []), s.texto]
  }

  const limpias = filas
    .filter((f) => f.cargo || f.abono)
    .map((f) => ({
      fecha: f.fecha,
      detalle: [...(f.antes ?? []), ...f.partes, ...(f.despues ?? [])].join(' ').replace(/\s+/g, ' ').trim(),
      cargo: f.cargo,
      abono: f.abono,
      saldo: f.saldo,
    }))

  if (saldoInicial == null) throw new Error('No encontré el saldo inicial de la cartola.')
  return {
    tipo: 'cartola',
    formato: 'cartola-falabella',
    banco: 'Banco Falabella',
    titular: lineaDespues(lineas, /^SR \(A\)$/i),
    cuenta,
    digitos: soloDigitos(cuenta).slice(-4),
    numero,
    desde,
    hasta,
    saldoInicial,
    saldoFinal,
    filas: limpias,
    verificacion: verificarCartola(limpias, saldoInicial, saldoFinal),
  }
}

// ---- Banco de Chile · estado de cuenta de tarjeta de crédito ----

// Fila de operación: [lugar] dd/mm/aa código descripción $ monto $ total cuota/de $ valor
const FILA_TARJETA = /(\d{2}\/\d{2}\/\d{2})\s+(\d{12})\s+(.*?)\s*\$\s*(-?[\d.]+)\s*\$\s*(-?[\d.]+)\s+(\d{2})\/(\d{2})\s+\$\s*(-?[\d.]+)\s*$/

function limpiarDescripcionTarjeta(texto) {
  return texto
    .replace(/TASA INT\.?\s*[\d,]+\s*%?/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function leerEstadoTarjetaChile(lineas) {
  const numeroTarjeta = buscar(lineas, /N° DE TARJETA DE CRÉDITO\s+([X\d ]+)/i)?.[1]?.trim() ?? ''
  const fechaEstado = fechaDMA(buscar(lineas, /FECHA ESTADO DE CUENTA\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1])
  const periodo = buscar(lineas, /PERÍODO FACTURADO\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i)
  const pagarHasta = fechaDMA(buscar(lineas, /PAGAR HASTA\s+(\d{2}\/\d{2}\/\d{4})/i)?.[1])
  const anterior = buscar(lineas, /PERÍODO DE FACTURACIÓN ANTERIOR\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i)
  const proximo = buscar(lineas, /PRÓXIMO PERÍODO DE FACTURACIÓN\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})/i)
  if (!periodo || !pagarHasta) throw new Error('No encontré el período facturado o la fecha de pago del estado de cuenta.')

  const cupo = buscar(lineas, /^CUPO TOTAL \$\s*([\d.]+)\s*\$\s*([\d.]+)\s*\$\s*([\d.]+)/i)
  const tasa = buscar(lineas, /TASA INTERÉS VIGENTE\s+([\d,]+)/i)?.[1]
  const total = leerPesos(buscar(lineas, /A \+ B \+ C \+ D \+ E \+ F \+\s*G \)\s*\$\s*(-?[\d.]+)/i)?.[1])
  const minimo = leerPesos(buscar(lineas, /^MONTO MÍNIMO A PAGAR\s+\$\s*(-?[\d.]+)/i)?.[1] ?? '0')

  // Totales de control A..G
  const totales = {}
  const a = buscar(lineas, /MONTO FACTURADO A PAGAR \(PERÍODO ANTERIOR\)\s+A\s+\$\s*(-?[\d.]+)/i)
  if (a) totales.A = leerPesos(a[1])
  for (const l of lineas) {
    const m = l.texto.match(/^TOTAL .*?\b([B-G])\s+\$\s*(-?[\d.]+)$/)
    if (m) totales[m[1]] = leerPesos(m[2])
  }

  // Operaciones, según la sección en la que aparecen
  const pagos = []
  const compras = []
  const cuotas = []
  const cargos = []
  const nuevasEnCuotas = []
  let seccion = 'operaciones'
  for (const l of lineas) {
    const t = l.texto
    if (/^3\.\s*CARGOS, COMISIONES/i.test(t)) seccion = 'cargos'
    else if (/^4\.\s*INFORMACIÓN COMPRAS EN CUOTAS/i.test(t)) seccion = 'nuevas'
    else if (/^III\.\s*INFORMACIÓN DE PAGO/i.test(t)) seccion = 'fin'
    const m = t.match(FILA_TARJETA)
    if (!m || seccion === 'fin') continue
    const fila = {
      fecha: fechaDMA(m[1]),
      codigo: m[2],
      detalle: limpiarDescripcionTarjeta(m[3]),
      montoOperacion: leerPesos(m[4]),
      totalAPagar: leerPesos(m[5]),
      cuota: Number(m[6]),
      de: Number(m[7]),
      valorCuota: leerPesos(m[8]),
    }
    if (seccion === 'cargos') cargos.push(fila)
    else if (seccion === 'nuevas' || fila.cuota === 0) nuevasEnCuotas.push(fila)
    else if (fila.montoOperacion < 0) pagos.push({ ...fila, monto: -fila.montoOperacion })
    else if (fila.de > 1) cuotas.push(fila)
    else compras.push(fila)
  }

  // Vencimientos próximos 4 meses: "$ ACTUAL $ OCT $ NOV $ DIC $ ENE"
  let deudaCuotas = null
  const vencimientos = []
  const iVenc = lineas.findIndex((l) => /^ACTUAL\b/.test(l.texto))
  if (iVenc >= 0) {
    const montos = (lineas[iVenc + 1]?.texto.match(/\$\s*[\d.]+/g) ?? []).map(leerPesos)
    deudaCuotas = montos[0] ?? null
    const meses = lineas[iVenc].texto.split(/\s+/).slice(1, 5)
    meses.forEach((mes, i) => montos[i + 1] != null && vencimientos.push({ mes: mes.toLowerCase(), monto: montos[i + 1] }))
  }

  // Verificación: cada bloque suma su total y A+B+C+D+E+F+G = total facturado
  const suma = (lista, campo) => lista.reduce((s, f) => s + f[campo], 0)
  const problemas = []
  if (totales.B != null && suma(pagos, 'valorCuota') !== totales.B) problemas.push('pagos (B)')
  if (totales.D != null && suma(compras, 'valorCuota') !== totales.D) problemas.push('compras en una cuota (D)')
  if (totales.E != null && suma(cuotas, 'valorCuota') !== totales.E) problemas.push('cuotas (E)')
  if (totales.G != null && suma(cargos, 'valorCuota') !== totales.G) problemas.push('cargos y comisiones (G)')
  const letras = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  if (total != null && letras.every((k) => totales[k] != null) && letras.reduce((s, k) => s + totales[k], 0) !== total) {
    problemas.push('el total facturado')
  }

  return {
    tipo: 'tarjeta',
    formato: 'tarjeta-chile',
    banco: 'Banco de Chile',
    titular: buscar(lineas, /NOMBRE DEL TITULAR\s+(.+)$/i)?.[1]?.trim() ?? '',
    tarjeta: numeroTarjeta,
    digitos: soloDigitos(numeroTarjeta).slice(-4),
    fechaEstado,
    desde: fechaDMA(periodo[1]),
    hasta: fechaDMA(periodo[2]),
    pagarHasta,
    anterior: anterior ? { desde: fechaDMA(anterior[1]), hasta: fechaDMA(anterior[2]) } : null,
    proximo: proximo ? { desde: fechaDMA(proximo[1]), hasta: fechaDMA(proximo[2]) } : null,
    total,
    minimo,
    cupo: cupo ? { total: leerPesos(cupo[1]), utilizado: leerPesos(cupo[2]), disponible: leerPesos(cupo[3]) } : null,
    tasaMensual: tasa ? Number(tasa.replace(',', '.')) : null,
    pagos,
    compras,
    cuotas,
    cargos,
    nuevasEnCuotas,
    deudaCuotas,
    vencimientos,
    totales,
    verificacion:
      problemas.length === 0
        ? { ok: true, mensaje: 'Los totales cuadran con el estado de cuenta.' }
        : { ok: false, mensaje: `No cuadran: ${problemas.join(', ')}. Puede que el banco haya cambiado el formato.` },
  }
}
