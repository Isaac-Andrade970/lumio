import { describe, it, expect } from 'vitest'
import { prepararImportacion, adivinarDestino, esTitular, calzanDigitos, nombreBonito, contarPropuestas } from './importar.js'

// Documentos ya leídos (como los entrega lectores.js), con datos inventados
const cartolaA = {
  tipo: 'cartola', formato: 'cartola-chile', banco: 'Banco de Chile', cuenta: 'XXXXXXXX4321', digitos: '4321',
  desde: '2026-09-01', hasta: '2026-09-30', saldoInicial: 0, saldoFinal: 7000,
  filas: [
    { fecha: '2026-09-02', detalle: 'TRASPASO DE:ANA ROJAS LEIVA', cargo: null, abono: 50000 },
    { fecha: '2026-09-05', detalle: 'CARGO POR PAGO TC', cargo: 40000, abono: null },
    { fecha: '2026-09-07', detalle: 'TRASPASO DE:JUAN PEREZ SOTO', cargo: null, abono: 20000 },
    { fecha: '2026-09-08', detalle: '40517-SBX LYON SANTIAGO CHL', cargo: 5900, abono: null },
    { fecha: '2026-09-09', detalle: 'TRANSF. PARA LUCHO', cargo: 17100, abono: null },
  ],
}
const cartolaB = {
  tipo: 'cartola', formato: 'cartola-falabella', banco: 'Banco Falabella', cuenta: '01-111-222333-4', digitos: '3334',
  desde: '2026-09-01', hasta: '2026-09-30', saldoInicial: 30000, saldoFinal: 10000,
  filas: [{ fecha: '2026-09-07', detalle: 'TRANSF. PARA JUAN PEREZ', cargo: 20000, abono: null }],
}

const base = () => ({
  cuentas: [
    { nombre: 'Débito Chile', saldoInicial: 0, fechaSaldo: '2026-09-01', momentoSaldo: 1 },
    { nombre: 'Débito Falabella', saldoInicial: 0, fechaSaldo: '2026-10-15', momentoSaldo: 1 },
  ],
  creditos: [{ nombre: 'Crédito Chile', diaCierre: 22, diaPago: 6, pagos: [] }],
  cuotas: [],
  movimientos: [{ id: 1, tipo: 'gasto', monto: 5900, fecha: '2026-09-07', nota: 'Starbucks', medioPago: 'Débito Chile', origen: 'wallet' }],
  reglas: [{ clave: 'lucho', categoria: 'comida', tipo: 'gasto' }],
  titular: 'Juan Pérez Soto',
})

describe('ayudas', () => {
  it('reconoce al titular con su primer nombre y un apellido, pero no a un familiar', () => {
    expect(esTitular('JUAN PEREZ', 'Juan Pérez Soto')).toBe(true)
    expect(esTitular('JUAN PEREZ SOTO', 'Juan Pérez Soto')).toBe(true)
    expect(esTitular('PEREZ SOTO MARIA', 'Juan Pérez Soto')).toBe(false)
  })

  it('calza los últimos dígitos con o sin dígito verificador', () => {
    expect(calzanDigitos('4321', 'XXXXXXXX4321')).toBe(true)
    expect(calzanDigitos('2333', '01-111-222333-4')).toBe(true)
    expect(calzanDigitos('9999', 'XXXXXXXX4321')).toBe(false)
  })

  it('deja los nombres de comercio legibles', () => {
    expect(nombreBonito('PAYU *UBER TRIP SANTIAGO')).toBe('Uber Trip Santiago')
    expect(nombreBonito('40517-SBX LYON SANTIAGO CHL')).toBe('Sbx Lyon Santiago')
  })

  it('adivina la cuenta por dígitos o por el nombre del banco', () => {
    const ctx = base()
    expect(adivinarDestino(cartolaA, ctx)).toBe('Débito Chile')
    ctx.cuentas[1].digitos = '3334'
    expect(adivinarDestino(cartolaB, ctx)).toBe('Débito Falabella')
  })
})

describe('cartola', () => {
  const plan = prepararImportacion(cartolaA, { ...base(), destino: 'Débito Chile' })
  const [ingreso, pago, propia, starbucks, lucho] = plan.propuestas

  it('clasifica cada fila', () => {
    expect(ingreso).toMatchObject({ estado: 'nuevo', tipo: 'movimiento', datos: { tipo: 'ingreso', nota: 'Transferencia de Ana Rojas Leiva', medioPago: 'Débito Chile' } })
    expect(pago).toMatchObject({ tipo: 'pago', estado: 'nuevo', datos: { tarjeta: 'Crédito Chile', pago: { monto: 40000, cuenta: 'Débito Chile' } } })
    expect(propia).toMatchObject({ estado: 'nuevo', datos: { tipo: 'transferencia', destino: 'Débito Chile', medioPago: '' } })
  })

  it('no duplica lo que llegó por Wallet y usa las categorías aprendidas', () => {
    expect(starbucks).toMatchObject({ estado: 'existente', incluir: false })
    expect(starbucks.motivo).toContain('Wallet')
    expect(lucho.datos.categoria).toBe('comida')
  })

  it('propone ajustar el saldo solo si la cartola es más nueva que el saldo anotado', () => {
    expect(plan.ajusteSaldo).toEqual({ cuenta: 'Débito Chile', saldo: 7000, fecha: '2026-09-30' })
    const otro = prepararImportacion(cartolaB, { ...base(), destino: 'Débito Falabella' })
    expect(otro.ajusteSaldo).toBeNull()
  })

  it('reconoce lo ya importado', () => {
    const ctx = base()
    ctx.movimientos.push({ id: 9, ...ingreso.datos })
    const otra = prepararImportacion(cartolaA, { ...ctx, destino: 'Débito Chile' })
    expect(otra.propuestas[0]).toMatchObject({ estado: 'existente', motivo: 'Ya importado antes' })
  })

  it('une la misma transferencia vista en las dos cartolas', () => {
    const ctx = base()
    ctx.movimientos.push({ id: 7, ...propia.datos }) // ya importada desde la cartola A
    const otro = prepararImportacion(cartolaB, { ...ctx, destino: 'Débito Falabella' })
    expect(otro.propuestas[0]).toMatchObject({ tipo: 'actualizarMovimiento', estado: 'completar', datos: { id: 7, cambios: { medioPago: 'Débito Falabella' } } })
    expect(contarPropuestas(otro.propuestas)).toMatchObject({ nuevos: 0, completar: 1 })
  })
})

describe('estado de cuenta de tarjeta', () => {
  const doc = {
    tipo: 'tarjeta', formato: 'tarjeta-chile', banco: 'Banco de Chile', tarjeta: 'XXXX XXX1 2222 9999', digitos: '9999',
    desde: '2026-08-22', hasta: '2026-09-22', pagarHasta: '2026-10-06',
    anterior: { desde: '2026-07-24', hasta: '2026-08-21' }, proximo: { desde: '2026-09-23', hasta: '2026-10-22' },
    total: -50000, minimo: 0, tasaMensual: 3.42,
    pagos: [{ fecha: '2026-09-06', monto: 40000, detalle: 'MONTO CANCELADO' }],
    compras: [{ fecha: '2026-08-24', codigo: '1', detalle: 'PAYU *UBER TRIP SANTIAGO', valorCuota: 3000, cuota: 1, de: 1 }],
    cuotas: [
      { fecha: '2026-04-07', codigo: '2', detalle: 'CONCIERTO', valorCuota: 12000, cuota: 5, de: 12 },
      { fecha: '2026-06-01', codigo: '3', detalle: 'TIENDA', valorCuota: 8000, cuota: 3, de: 6 },
    ],
    cargos: [
      { fecha: '2026-09-22', codigo: '4', detalle: 'COMISION ADMINISTRACION MENSUAL', valorCuota: 4919 },
      { fecha: '2026-09-09', codigo: '5', detalle: 'IMPUESTO DECRETO LEY 3475 TASA 0,800 %', valorCuota: 5200 },
    ],
    nuevasEnCuotas: [{ fecha: '2026-09-09', codigo: '6', detalle: 'MERCADOPAGO*PERFUMERIA', montoOperacion: 600000, valorCuota: 60000, cuota: 0, de: 12 }],
  }
  const ctx = () => ({ ...base(), cuotas: [{ id: 3, tarjeta: 'Crédito Chile', descripcion: 'Tienda', monto: 8000, hasta: '2026-12' }] })
  const plan = prepararImportacion(doc, { ...ctx(), destino: 'Crédito Chile' })
  const buscar = (texto) => plan.propuestas.find((p) => p.titulo.includes(texto))

  it('calcula los meses de cada cuota desde el N° de cuota (meses de pago)', () => {
    expect(buscar('Concierto')).toMatchObject({ tipo: 'cuota', estado: 'nuevo', datos: { desde: '2026-06', hasta: '2027-05', monto: 12000 } })
    // La que anotaste a mano se corrige con lo que dice el banco
    expect(buscar('Tienda')).toMatchObject({ tipo: 'cuota', estado: 'completar', datos: { id: 3, cambios: { desde: '2026-08', hasta: '2027-01' } } })
  })

  it('una compra nueva en cuotas parte cobrándose el mes siguiente', () => {
    expect(buscar('Perfumeria')).toMatchObject({ estado: 'nuevo', datos: { monto: 600000, cuotas: 12, valorCuota: 60000, primeraCuota: '2026-11' } })
  })

  it('la comisión va a la configuración y el impuesto queda como gasto del banco', () => {
    expect(plan.cambiosConfig).toMatchObject({ comision: 4919, diaCierre: 22, diaPago: 6, tasaMensual: 3.42, digitos: '9999' })
    expect(buscar('Impuesto')).toMatchObject({ datos: { categoria: 'banco', monto: 5200 } })
    expect(plan.propuestas.some((p) => p.titulo.includes('Comision'))).toBe(false)
  })

  it('guarda los períodos exactos y el estado oficial (saldo a favor)', () => {
    expect(plan.cambiosConfig.periodos.map((p) => `${p.desde}/${p.hasta}`)).toEqual(['2026-07-24/2026-08-21', '2026-08-22/2026-09-22', '2026-09-23/2026-10-22'])
    expect(plan.cambiosConfig.estados[0]).toMatchObject({ hasta: '2026-09-22', total: -50000 })
  })

  it('registra los pagos al estado anterior', () => {
    expect(buscar('Pago')).toMatchObject({ tipo: 'pago', estado: 'nuevo', datos: { pago: { periodo: '2026-08-21', monto: 40000 } } })
  })

  it('un estado de cuenta antiguo no cambia las cuotas vigentes', () => {
    const conMasNuevo = ctx()
    conMasNuevo.creditos[0].estados = [{ hasta: '2026-10-22', total: 0 }]
    const viejo = prepararImportacion(doc, { ...conMasNuevo, destino: 'Crédito Chile' })
    expect(viejo.propuestas.filter((p) => p.tipo === 'cuota').every((p) => p.estado === 'omitido')).toBe(true)
    expect(viejo.cambiosConfig.diaCierre).toBeUndefined()
  })
})
