// Convierte un documento leído (cartola o estado de cuenta) en una lista de propuestas para revisar antes de guardar.
// Nada se guarda aquí: la pantalla muestra las propuestas y db.js aplica las que elijas.
import { adivinarCategoria } from './wallet.js'
import { categoriaAprendida } from './reglas.js'
import { mismaTarjeta, periodosCredito } from './credito.js'
import { sumarMeses } from './formato.js'

// ---- Utilidades ----

function normalizar(texto = '') {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function diasEntre(a, b) {
  const t = (f) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))
  return Math.abs(t(a) - t(b)) / 86_400_000
}

function mediodia(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return new Date(a, m - 1, d, 12).getTime()
}

// "PAYU *UBER TRIP SANTIAGO" -> "Uber Trip Santiago" · "40517-SBX LYON SANTIAGO CHL" -> "Sbx Lyon Santiago"
export function nombreBonito(detalle = '') {
  const limpio = detalle
    .replace(/^\d+[-\s]+/, '')
    .replace(/^(MERCADOPAGO|MERPAGO|PAYU|PEDIDOSYA|SUMUP|TUU)\s*\*\s*/i, '')
    .replace(/\s+(CHL|CL|PCL|USA|US)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  return limpio.toLowerCase().replace(/(^|\s)(\S)/g, (_, espacio, letra) => espacio + letra.toUpperCase())
}

// "Banco de Chile" -> "chile" · "Banco Falabella" -> "falabella" (para buscarlo en el nombre de tus cuentas)
function palabraDelBanco(banco) {
  return normalizar(banco).replace(/^banco (de )?/, '')
}

// ¿Este nombre del banco eres tú? Debe aparecer tu primer nombre y al menos un apellido.
// Así "JUAN PEREZ" sí eres tú, pero un familiar con tu mismo apellido no.
export function esTitular(nombre, titular) {
  const palabrasTitular = normalizar(titular).split(' ').filter((p) => p.length >= 3)
  if (palabrasTitular.length < 2) return false
  const palabras = new Set(normalizar(nombre).split(' '))
  const [primerNombre, ...resto] = palabrasTitular
  return palabras.has(primerNombre) && resto.some((p) => palabras.has(p))
}

// ¿Los últimos dígitos configurados calzan con el número del documento? (acepta con o sin dígito verificador)
export function calzanDigitos(digitos, numeroDocumento) {
  const d = String(digitos ?? '').replace(/\D/g, '')
  const doc = String(numeroDocumento ?? '').replace(/\D/g, '')
  if (d.length < 3 || !doc) return false
  return doc.endsWith(d) || doc.slice(0, -1).endsWith(d)
}

// Cuenta o tarjeta de Lumio a la que corresponde el documento (o null para preguntar)
export function adivinarDestino(doc, { cuentas = [], creditos = [] }) {
  const lista = doc.tipo === 'tarjeta' ? creditos : cuentas
  const numero = doc.tipo === 'tarjeta' ? doc.tarjeta : doc.cuenta
  const porDigitos = lista.find((c) => calzanDigitos(c.digitos, numero))
  if (porDigitos) return porDigitos.nombre
  const palabraBanco = palabraDelBanco(doc.banco)
  const porNombre = lista.filter((c) => normalizar(c.nombre).includes(palabraBanco))
  if (porNombre.length === 1) return porNombre[0].nombre
  if (doc.tipo === 'tarjeta' && lista.length === 1) return lista[0].nombre
  return null
}

// Busca un gasto que ya tienes (por ejemplo, llegado por Wallet): mismo monto, fecha a ±3 días, misma tarjeta o de Wallet
function buscarGastoParecido(movimientos, usados, { monto, fecha, medioPago }) {
  return movimientos.find(
    (m) =>
      !usados.has(m.id) &&
      m.tipo === 'gasto' &&
      m.monto === monto &&
      diasEntre(m.fecha, fecha) <= 3 &&
      (mismaTarjeta(m.medioPago, medioPago) || m.origen === 'wallet' || !m.medioPago),
  )
}

function fechaCorta(fechaISO) {
  return fechaISO.split('-').reverse().slice(0, 2).join('/')
}

// ---- Preparar ----

// contexto: { cuentas, creditos, cuotas, movimientos, reglas, titular, destino }
export function prepararImportacion(doc, contexto) {
  return doc.tipo === 'tarjeta' ? prepararTarjeta(doc, contexto) : prepararCartola(doc, contexto)
}

function categoriaPara(texto, reglas, tipo) {
  return categoriaAprendida(texto, reglas, tipo) ?? (tipo === 'gasto' ? adivinarCategoria(texto) : 'otros-ingreso')
}

function prepararCartola(doc, { cuentas = [], creditos = [], movimientos = [], reglas = [], titular = '', destino }) {
  const cuenta = destino
  const propuestas = []
  const yaImportados = new Set(movimientos.map((m) => m.externoId).filter(Boolean))
  const usados = new Set() // movimientos existentes ya emparejados (no se usan dos veces)
  const vistos = {} // para numerar filas idénticas del mismo documento
  const credito = creditos.length === 1 ? creditos[0] : creditos.find((c) => normalizar(c.nombre).includes(palabraDelBanco(doc.banco)))

  for (const fila of doc.filas) {
    const monto = fila.cargo ?? fila.abono
    const sentido = fila.cargo ? 'cargo' : 'abono'
    const base = `${fila.fecha}-${monto}-${sentido}`
    vistos[base] = (vistos[base] ?? 0) + 1
    const externoId = `cartola-${doc.formato}-${doc.digitos}-${base}-${vistos[base]}`
    const detalle = fila.detalle
    const p = { id: externoId, fecha: fila.fecha, monto, signo: sentido === 'cargo' ? '−' : '+', detalleBanco: detalle }

    if (yaImportados.has(externoId)) {
      propuestas.push({ ...p, tipo: 'movimiento', estado: 'existente', motivo: 'Ya importado antes', titulo: nombreBonito(detalle), incluir: false })
      continue
    }

    // 1) Pago de tarjeta de crédito: no es un gasto (las compras ya se contaron con la tarjeta)
    if (sentido === 'cargo' && /PAGO\s+(TC|TARJETA)/i.test(detalle)) {
      if (credito) {
        const existente = (credito.pagos ?? []).find((pg) => pg.monto === monto && diasEntre(pg.fecha ?? isoDe(pg.momento), fila.fecha) <= 5)
        const periodo = periodosCredito(fila.fecha, credito.diaCierre, credito.periodos).anterior.hasta
        propuestas.push({
          ...p,
          tipo: 'pago',
          titulo: `Pago de ${credito.nombre}`,
          signo: '',
          estado: existente ? (existente.cuenta ? 'existente' : 'completar') : 'nuevo',
          motivo: existente ? (existente.cuenta ? 'Ya registrado' : 'Ya está en el estado de cuenta: se le agrega desde qué cuenta salió') : 'Pago de tu tarjeta (no cuenta como gasto)',
          incluir: !existente || !existente.cuenta,
          datos: { tarjeta: credito.nombre, existente, pago: { periodo, monto, cuenta, fecha: fila.fecha, momento: mediodia(fila.fecha), externoId } },
        })
      } else {
        propuestas.push({
          ...p,
          tipo: 'movimiento',
          titulo: 'Pago de tarjeta de crédito',
          signo: '',
          estado: 'nuevo',
          motivo: 'Configura tu tarjeta en Análisis para llevar sus pagos',
          incluir: true,
          datos: { tipo: 'transferencia', monto, fecha: fila.fecha, categoria: 'transferencia', medioPago: cuenta, destino: 'Tarjeta de crédito', nota: 'Pago tarjeta de crédito', origen: 'cartola', externoId },
        })
      }
      continue
    }

    // 2) Transferencias: de/para ti (entre tus cuentas) o de/para otra persona
    const entrante = detalle.match(/^(?:TRASPASO DE|TRANSF\.?\s*DE|TRANSFERENCIA DE)\s*:?\s*(.+)$/i)
    const saliente = detalle.match(/^(?:TRASPASO A|TRANSF\.?\s*PARA|TRANSF\.?\s*A|TRANSFERENCIA A)\s*:?\s*(.+)$/i)
    const persona = (entrante ?? saliente)?.[1]?.trim()

    if (persona && esTitular(persona, titular)) {
      // Entre tus cuentas: si la otra cartola ya la trajo, se completa en vez de duplicarla
      const existente = movimientos.find(
        (m) =>
          !usados.has(m.id) &&
          m.tipo === 'transferencia' &&
          m.monto === monto &&
          diasEntre(m.fecha, fila.fecha) <= 1 &&
          (entrante
            ? !mismaTarjeta(m.medioPago, cuenta) && (!m.destino || mismaTarjeta(m.destino, cuenta))
            : !mismaTarjeta(m.destino, cuenta) && (!m.medioPago || mismaTarjeta(m.medioPago, cuenta))),
      )
      if (existente) {
        usados.add(existente.id)
        const completo = entrante ? mismaTarjeta(existente.destino, cuenta) : mismaTarjeta(existente.medioPago, cuenta)
        propuestas.push({
          ...p,
          tipo: 'actualizarMovimiento',
          titulo: 'Transferencia entre tus cuentas',
          signo: '',
          estado: completo ? 'existente' : 'completar',
          motivo: completo ? 'Ya la tienes' : 'Ya está desde tu otra cuenta: se completa',
          incluir: !completo,
          datos: { id: existente.id, cambios: entrante ? { destino: cuenta } : { medioPago: cuenta } },
        })
      } else {
        propuestas.push({
          ...p,
          tipo: 'movimiento',
          titulo: 'Transferencia entre tus cuentas',
          signo: '',
          estado: 'nuevo',
          motivo: entrante ? 'Desde otra cuenta tuya' : 'Hacia otra cuenta tuya',
          incluir: true,
          datos: {
            tipo: 'transferencia', monto, fecha: fila.fecha, categoria: 'transferencia',
            medioPago: entrante ? '' : cuenta, destino: entrante ? cuenta : '',
            nota: '', origen: 'cartola', externoId,
          },
        })
      }
      continue
    }

    // 3) Gasto o ingreso normal (incluye transferencias de o para otras personas)
    const tipo = sentido === 'cargo' ? 'gasto' : 'ingreso'
    const nota = persona ? `${entrante ? 'Transferencia de' : 'Transferencia a'} ${nombreBonito(persona)}` : nombreBonito(detalle)
    const categoria = categoriaPara(persona ? nota : detalle, reglas, tipo)
    const mov = { tipo, monto, fecha: fila.fecha, categoria, nota, medioPago: cuenta, destino: '', cuotas: 1, valorCuota: 0, origen: 'cartola', externoId }

    const parecido = tipo === 'gasto' && !persona ? buscarGastoParecido(movimientos, usados, mov) : null
    if (parecido) {
      usados.add(parecido.id)
      propuestas.push({
        ...p, tipo: 'movimiento', titulo: nota, estado: 'existente', incluir: false, datos: mov,
        motivo: `Ya lo tienes${parecido.origen === 'wallet' ? ' (llegó por Wallet' : ' ('}${parecido.nota ? ` como "${parecido.nota}"` : ''} el ${fechaCorta(parecido.fecha)})`,
      })
    } else {
      propuestas.push({ ...p, tipo: 'movimiento', titulo: nota, estado: 'nuevo', incluir: true, motivo: '', datos: mov })
    }
  }

  // Ajuste de saldo: solo si esta cartola es más nueva que el saldo que tienes anotado
  const cuentaConf = cuentas.find((c) => mismaTarjeta(c.nombre, cuenta))
  const ajusteSaldo =
    cuentaConf && doc.saldoFinal != null && (!cuentaConf.fechaSaldo || doc.hasta >= cuentaConf.fechaSaldo)
      ? { cuenta: cuentaConf.nombre, saldo: doc.saldoFinal, fecha: doc.hasta }
      : null

  return {
    doc,
    destino: cuenta,
    propuestas,
    ajusteSaldo,
    digitos: cuentaConf && !cuentaConf.digitos ? { cuenta: cuentaConf.nombre, digitos: doc.digitos } : null,
  }
}

function isoDe(momento) {
  const f = new Date(momento ?? 0)
  return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`
}

function prepararTarjeta(doc, { creditos = [], cuotas = [], movimientos = [], reglas = [], destino }) {
  const tarjeta = destino
  const config = creditos.find((c) => mismaTarjeta(c.nombre, tarjeta)) ?? { nombre: tarjeta, diaCierre: 20, diaPago: 5, tasaMensual: 0, comision: 0 }
  const esUltimo = !(config.estados ?? []).some((e) => e.hasta > doc.hasta)
  const yaImportados = new Set(movimientos.map((m) => m.externoId).filter(Boolean))
  const usados = new Set()
  const propuestas = []
  const mesPago = doc.pagarHasta.slice(0, 7)

  // Compras (en una cuota y compras nuevas en cuotas)
  const comprasTodas = [
    ...doc.compras.map((f) => ({ ...f, enCuotas: false })),
    ...doc.nuevasEnCuotas.map((f) => ({ ...f, enCuotas: true })),
  ]
  for (const f of comprasTodas) {
    const externoId = `estado-${doc.digitos}-${f.codigo}-${f.fecha}`
    const monto = f.enCuotas ? f.montoOperacion : f.valorCuota
    const nota = nombreBonito(f.detalle)
    // Compra nueva en cuotas ("00/12"): la primera cuota se cobra en el próximo estado de cuenta
    const primeraCuota = f.enCuotas ? sumarMeses(mesPago, f.cuota === 0 ? 1 : 1 - f.cuota) : undefined
    const mov = {
      tipo: 'gasto', monto, fecha: f.fecha, categoria: categoriaPara(f.detalle, reglas, 'gasto'), nota,
      medioPago: tarjeta, destino: '', cuotas: f.enCuotas ? f.de : 1, valorCuota: f.enCuotas ? f.valorCuota : 0,
      origen: 'cartola', externoId,
      ...(f.enCuotas ? { primeraCuota } : {}),
    }
    const p = { id: externoId, fecha: f.fecha, monto, signo: '−', titulo: nota, detalleBanco: f.detalle, tipo: 'movimiento', datos: mov }
    if (yaImportados.has(externoId)) {
      propuestas.push({ ...p, estado: 'existente', motivo: 'Ya importado antes', incluir: false })
      continue
    }
    const parecido = buscarGastoParecido(movimientos, usados, mov)
    if (parecido && f.enCuotas && (parecido.primeraCuota !== primeraCuota || parecido.valorCuota !== f.valorCuota || parecido.cuotas !== f.de)) {
      // Ya la anotaste: se corrigen las cuotas con lo que dice el banco
      usados.add(parecido.id)
      propuestas.push({
        ...p, tipo: 'actualizarMovimiento', estado: 'completar', incluir: true,
        motivo: `Ya la tienes${parecido.nota ? ` como "${parecido.nota}"` : ''}: se ajustan sus cuotas (${f.de} de ${f.valorCuota})`,
        datos: { id: parecido.id, cambios: { cuotas: f.de, valorCuota: f.valorCuota, primeraCuota } },
      })
    } else if (parecido) {
      usados.add(parecido.id)
      propuestas.push({ ...p, estado: 'existente', incluir: false, motivo: `Ya lo tienes${parecido.nota ? ` como "${parecido.nota}"` : ''} (${fechaCorta(parecido.fecha)})` })
    } else {
      propuestas.push({ ...p, estado: 'nuevo', incluir: true, motivo: f.enCuotas ? `Compra nueva en ${f.de} cuotas de ${f.valorCuota}` : '' })
    }
  }

  // Cuotas en curso: solo el estado de cuenta más reciente define cuáles siguen vigentes
  const deCompras = movimientos.filter((m) => m.tipo === 'gasto' && (m.cuotas ?? 1) > 1 && mismaTarjeta(m.medioPago, tarjeta))
  for (const f of doc.cuotas) {
    const desde = sumarMeses(mesPago, -(f.cuota - 1))
    const hasta = sumarMeses(mesPago, f.de - f.cuota)
    const externoId = `cuota-${doc.digitos}-${f.codigo}`
    const p = {
      id: externoId, fecha: f.fecha, monto: f.valorCuota, signo: '', tipo: 'cuota',
      titulo: `${nombreBonito(f.detalle)} · cuota ${f.cuota} de ${f.de}`, detalleBanco: f.detalle,
    }
    if (!esUltimo) {
      propuestas.push({ ...p, estado: 'omitido', incluir: false, motivo: 'Estado de cuenta antiguo: las cuotas vigentes las define el más reciente' })
      continue
    }
    const guardada = cuotas.find((c) => c.externoId === externoId) ?? cuotas.find((c) => mismaTarjeta(c.tarjeta, tarjeta) && Math.abs(c.monto - f.valorCuota) <= 2)
    const deCompra = deCompras.find((m) => Math.abs((m.valorCuota || Math.round(m.monto / m.cuotas)) - f.valorCuota) <= 2)
    if (guardada) {
      const cambia = guardada.desde !== desde || guardada.hasta !== hasta
      propuestas.push({
        ...p, estado: cambia ? 'completar' : 'existente', incluir: cambia,
        motivo: cambia ? `Ya la tienes: se corrigen sus meses (hasta ${hasta})` : 'Ya la tienes',
        datos: { id: guardada.id, cambios: { desde, hasta } },
      })
    } else if (deCompra) {
      propuestas.push({ ...p, estado: 'existente', incluir: false, motivo: 'Viene de una compra en cuotas que ya anotaste' })
    } else {
      propuestas.push({
        ...p, estado: 'nuevo', incluir: true, motivo: `Quedan ${f.de - f.cuota} después de esta`,
        datos: { tarjeta, descripcion: nombreBonito(f.detalle), monto: f.valorCuota, desde, hasta, origen: 'estado', externoId },
      })
    }
  }

  // Cargos del banco (la comisión mensual va a la configuración para estimar los próximos meses)
  let comision = null
  for (const f of doc.cargos) {
    if (/COMISION ADMINISTRACION/i.test(f.detalle)) {
      comision = f.valorCuota
      continue
    }
    const externoId = `estado-${doc.digitos}-${f.codigo}-${f.fecha}`
    const nota = nombreBonito(f.detalle.replace(/\s+TASA\s+[\d,]+\s*%/i, ''))
    const mov = { tipo: 'gasto', monto: f.valorCuota, fecha: f.fecha, categoria: 'banco', nota, medioPago: tarjeta, destino: '', cuotas: 1, valorCuota: 0, origen: 'cartola', externoId }
    const ya = yaImportados.has(externoId)
    propuestas.push({
      id: externoId, fecha: f.fecha, monto: f.valorCuota, signo: '−', titulo: nota, detalleBanco: f.detalle, tipo: 'movimiento', datos: mov,
      estado: ya ? 'existente' : 'nuevo', incluir: !ya, motivo: ya ? 'Ya importado antes' : 'Cargo del banco',
    })
  }

  // Pagos que hiciste a la tarjeta (pagan el estado de cuenta anterior)
  for (const f of doc.pagos) {
    const existente = (config.pagos ?? []).find((pg) => pg.monto === f.monto && diasEntre(pg.fecha ?? isoDe(pg.momento), f.fecha) <= 5)
    propuestas.push({
      id: `pago-${doc.digitos}-${f.fecha}-${f.monto}`, fecha: f.fecha, monto: f.monto, signo: '', tipo: 'pago',
      titulo: 'Pago a la tarjeta', detalleBanco: f.detalle,
      estado: existente ? 'existente' : 'nuevo', incluir: !existente, motivo: existente ? 'Ya registrado' : 'No cuenta como gasto',
      datos: { tarjeta, pago: { periodo: doc.anterior?.hasta ?? doc.desde, monto: f.monto, cuenta: null, fecha: f.fecha, momento: mediodia(f.fecha) } },
    })
  }

  // Configuración que se actualiza con el estado de cuenta
  const periodosNuevos = [
    doc.anterior,
    { desde: doc.desde, hasta: doc.hasta, pagarHasta: doc.pagarHasta },
    doc.proximo,
  ].filter(Boolean)
  const periodos = [...(config.periodos ?? [])]
  for (const p of periodosNuevos) {
    const i = periodos.findIndex((x) => x.desde === p.desde && x.hasta === p.hasta)
    if (i >= 0) periodos[i] = { ...periodos[i], ...p }
    else periodos.push(p)
  }
  periodos.sort((a, b) => a.desde.localeCompare(b.desde))
  const estado = {
    desde: doc.desde, hasta: doc.hasta, pagarHasta: doc.pagarHasta, fechaEstado: doc.fechaEstado,
    total: doc.total, minimo: doc.minimo, cupo: doc.cupo, deudaCuotas: doc.deudaCuotas, vencimientos: doc.vencimientos,
  }
  const estados = [...(config.estados ?? []).filter((e) => e.hasta !== doc.hasta), estado].sort((a, b) => a.hasta.localeCompare(b.hasta))
  const cambiosConfig = { periodos, estados }
  if (!config.digitos) cambiosConfig.digitos = doc.digitos
  if (esUltimo) {
    cambiosConfig.diaCierre = Number(doc.hasta.slice(8, 10))
    cambiosConfig.diaPago = Number(doc.pagarHasta.slice(8, 10))
    if (doc.tasaMensual) cambiosConfig.tasaMensual = doc.tasaMensual
    if (comision != null) cambiosConfig.comision = comision
  }

  return { doc, destino: tarjeta, propuestas, esUltimo, cambiosConfig, configBase: config }
}

// Resumen para mostrar arriba de la vista previa
export function contarPropuestas(propuestas) {
  return {
    nuevos: propuestas.filter((p) => p.estado === 'nuevo').length,
    existentes: propuestas.filter((p) => p.estado === 'existente').length,
    completar: propuestas.filter((p) => p.estado === 'completar').length,
    omitidos: propuestas.filter((p) => p.estado === 'omitido').length,
    elegidos: propuestas.filter((p) => p.incluir).length,
  }
}
