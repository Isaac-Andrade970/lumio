import { describe, it, expect } from 'vitest'
import { agruparLineas, leerDocumento, reconocer, leerPesos, fechaDMA } from './lectores.js'

// Documentos inventados que imitan cómo pdf.js entrega el texto de cada banco (posiciones x, y).
// Ningún dato real: nombres, números de cuenta y montos son de ejemplo.
const t = (s, x, y, ancho = s.length * 4.6) => ({ s, x, y, r: x + ancho })
const n = (s, derecha, y) => ({ s, x: derecha - s.length * 4.6, y, r: derecha }) // montos alineados a la derecha

function cartolaChile() {
  return [
    [
      t('Estado de Cuenta', 494, 756),
      t('CUENTA CORRIENTE', 472, 733),
      t('SR(A)(ES)', 26, 702),
      t('Juan Perez Soto', 26, 692),
      t('N° DE CUENTA', 309, 624), t(': XXXXXXXX4321', 374, 624),
      t('CARTOLA N°', 309, 610), t(': 3', 374, 610),
      t('DESDE', 309, 595), t(': 30/11/2026', 374, 595), t('HASTA', 454, 595), t(': 05/01/2027', 513, 595),
      t('FECHA', 23, 581), t('DETALLE DE TRANSACCION', 80, 581), t('SUCURSAL', 237, 581), t('N° DOCTO', 298, 581),
      t('MONTO CHEQUES', 344, 581), t('MONTO DEPOSITOS', 419, 581), t('SALDO', 534, 581),
      t('30/11', 28, 556), t('SALDO INICIAL', 60, 556), n('10.000', 580, 556),
      t('02/12', 28, 547), t('TRASPASO DE:ANA ROJAS LEIVA', 60, 547), t('INTERNET', 227, 547), n('50.000', 492, 547), n('60.000', 580, 547),
      t('05/12', 28, 538), t('CARGO POR PAGO TC', 60, 538), t('INTERNET', 227, 538), n('40.000', 411, 538),
      t('05/12', 28, 528), t('TRASPASO DE:JUAN PEREZ SOTO', 60, 528), t('INTERNET', 227, 528), n('5.000', 492, 528), n('25.000', 580, 528),
      t('03/01', 28, 519), t('COMPRA SUPERMERCADO', 60, 519), t('INTERNET', 227, 519), n('5.000', 411, 519), n('20.000', 580, 519),
      t('05/01', 28, 491), t('SALDO FINAL', 60, 491), n('20.000', 580, 491),
    ],
  ]
}

function cartolaFalabella() {
  return [
    [
      t('SR (A)', 297, 694),
      t('JUAN PEREZ SOTO', 298, 684),
      t('Numero de Cuenta', 297, 664), t(': 01-111-222333-4', 405, 664),
      t('Cartola N°', 297, 645), t(': 9', 405, 645),
      t('Fecha', 297, 636), t('desde', 321, 636), t(': 01/09/2026', 405, 636), t('Hasta : 30/09/2026', 449, 636),
      t('Saldo Inicial', 69, 536), t('Saldo Final', 217, 536),
      t('$1.000', 81, 522), t('$3.000', 231, 522),
      t('MOVIMIENTOS', 26, 425),
      t('Fecha', 36, 412), t('Oficina', 96, 412), t('N° Documento', 156, 412, 59), t('Descripción', 268, 412), t('Cargo', 388, 412), t('Abono', 462, 412), t('Saldo', 539, 412),
      // Descripción partida en dos líneas: un pedazo arriba y otro abajo de la fila
      t('TRANSF. DE ANA MARIA', 224, 401),
      t('02/09/2026', 31, 397), t('SUCURSAL VIRTUA', 73, 397), t('0', 213, 397, 4), n('$0', 434, 397), n('$5.000', 509, 397), n('$6.000', 585, 397),
      t('ROJAS', 223, 393),
      t('03/09/2026', 31, 382), t('SUCURSAL VIRTUA', 73, 382), t('0', 213, 382, 4), t('CAFE INVENTADO SANTIAGO CHL', 224, 382), n('$3.000', 434, 382), n('$0', 510, 382), n('$3.000', 585, 382),
      t('Consideramos aprobado este estado de cuenta', 26, 300),
    ],
  ]
}

function estadoTarjeta() {
  const linea = (y, ...textos) => textos.map(([s, x]) => t(s, x, y))
  return [
    [
      ...linea(727, ['ESTADO DE CUENTA NACIONAL DE TARJETA DE CRÉDITO', 232]),
      ...linea(715, ['NOMBRE DEL TITULAR', 48], ['JUAN PEREZ SOTO', 176]),
      ...linea(706, ['N° DE TARJETA DE CRÉDITO', 48], ['XXXX XXX1 2222 9999', 176]),
      ...linea(698, ['FECHA ESTADO DE CUENTA', 48], ['22/09/2026', 176]),
      ...linea(586, ['I.', 53], ['INFORMACIÓN GENERAL', 67]),
      ...linea(550, ['CUPO TOTAL', 50], ['$', 209], ['500.000 $', 260], ['200.000 $', 354], ['300.000', 445]),
      ...linea(508, ['TASA INTERÉS VIGENTE', 50], ['3,10', 268], ['%', 283]),
      ...linea(476, ['PERÍODO FACTURADO', 418], ['22/08/2026', 515], ['22/09/2026', 557]),
      ...linea(465, ['PAGAR HASTA', 418], ['06/10/2026', 536]),
      ...linea(418, ['PERÍODO DE FACTURACIÓN ANTERIOR', 50], ['24/07/2026', 292], ['21/08/2026', 360]),
      ...linea(396, ['MONTO FACTURADO A PAGAR (PERÍODO ANTERIOR)', 50], ['A', 257], ['$', 277], ['100.000', 312]),
      ...linea(296, ['07/09/26', 105], ['070900000000 MONTO CANCELADO', 143], ['$', 379], ['-100.000 $', 408], ['-100.000', 470], ['01/01', 508], ['$', 535], ['-100.000', 564]),
      ...linea(274, ['TOTAL PAGOS A LA CUENTA', 279], ['B', 523], ['$', 535], ['-100.000', 564]),
      ...linea(251, ['TOTAL PAT A LA CUENTA', 285], ['C', 523], ['$', 535], ['0', 588]),
      ...linea(239, ['SANTIAGO', 45], ['23/08/26', 105], ['240810000001 PAYU', 143], ['*UBER TRIP', 220], ['SANTIAGO', 274], ['$', 379], ['3.000 $', 414], ['3.000', 477], ['01/01', 508], ['$', 535], ['3.000', 570]),
      ...linea(228, ['SANTIAGO', 45], ['24/08/26', 105], ['240810000002 TIENDA INVENTADA', 143], ['$', 379], ['7.000 $', 414], ['7.000', 477], ['01/01', 508], ['$', 535], ['7.000', 570]),
      ...linea(220, ['TOTAL TRANSACCIONES EN UNA CUOTA', 257], ['D', 523], ['$', 535], ['10.000', 566]),
      ...linea(211, ['SANTIAGO', 45], ['07/04/26', 105], ['220900000003 CONCIERTO', 143], ['TASA INT. 3,40%', 274], ['$', 379], ['120.000 $', 410], ['144.000', 473], ['05/12', 508], ['$', 535], ['12.000', 570]),
      ...linea(200, ['TOTAL TRANSACCIONES EN CUOTAS', 263], ['E', 523], ['$', 535], ['12.000', 566]),
      ...linea(190, ['TOTAL PRODUCTOS O SERVICIOS VOLUNTARIAMENTE CONTRATADOS', 204], ['F', 524], ['$', 535], ['0', 588]),
      ...linea(180, ['3.CARGOS, COMISIONES, IMPUESTOS Y ABONOS', 232]),
      ...linea(170, ['22/09/26', 105], ['220900000000 COMISION ADMINISTRACION MENSUAL', 143], ['$', 379], ['3.000 $', 418], ['3.000', 481], ['01/01', 508], ['$', 535], ['3.000', 574]),
      ...linea(160, ['TOTAL CARGOS, COMISIONES, IMPUESTOS Y ABONOS', 233], ['G', 523], ['$', 535], ['3.000', 570]),
      ...linea(150, ['4.INFORMACIÓN COMPRAS EN CUOTAS EN PERÍODO', 225], ['$', 535], ['0', 588]),
      ...linea(140, ['LAS CONDES', 45], ['09/09/26', 105], ['090900000004 NOTEBOOK TASA INT', 143], ['3,45%', 349], ['$', 379], ['600.000 $', 410], ['720.000', 473], ['00/12', 508], ['$', 535], ['60.000', 570]),
    ],
    [
      ...linea(726, ['III.', 49], ['INFORMACIÓN DE PAGO', 70]),
      ...linea(705, ['MONTO TOTAL FACTURADO A PAGAR (', 48], ['A + B + C + D + E + F +G )', 188], ['$', 271], ['25.000', 323]),
      ...linea(695, ['MONTO MÍNIMO A PAGAR', 48], ['$', 271], ['5.000', 347]),
      ...linea(624, ['ACTUAL', 59], ['OCTUBRE', 118], ['NOVIEMBRE', 177], ['DICIEMBRE', 241], ['ENERO', 310]),
      ...linea(613, ['$', 51], ['900.000', 67], ['$', 114], ['72.000', 134], ['$', 176], ['72.000', 196], ['$', 239], ['72.000', 259], ['$', 301], ['72.000', 321]),
      ...linea(579, ['PRÓXIMO PERÍODO DE FACTURACIÓN', 45], ['23/09/2026', 243], ['22/10/2026', 305]),
    ],
  ]
}

describe('utilidades', () => {
  it('lee montos y fechas como los escribe el banco', () => {
    expect(leerPesos('$1.234')).toBe(1234)
    expect(leerPesos('-168.935')).toBe(-168935)
    expect(fechaDMA('22/09/2026')).toBe('2026-09-22')
    expect(fechaDMA('22/09/26')).toBe('2026-09-22')
  })

  it('reconoce cada documento y rechaza los desconocidos', () => {
    expect(reconocer(agruparLineas(cartolaChile()))).toBe('cartola-chile')
    expect(reconocer(agruparLineas(cartolaFalabella()))).toBe('cartola-falabella')
    expect(reconocer(agruparLineas(estadoTarjeta()))).toBe('tarjeta-chile')
    expect(() => leerDocumento(agruparLineas([[t('Boleta de luz', 10, 10)]]))).toThrow('No reconozco este documento')
  })
})

describe('cartola Banco de Chile', () => {
  const doc = leerDocumento(agruparLineas(cartolaChile()))

  it('lee encabezado, titular y saldos', () => {
    expect(doc).toMatchObject({ banco: 'Banco de Chile', titular: 'Juan Perez Soto', digitos: '4321', numero: '3', saldoInicial: 10000, saldoFinal: 20000 })
  })

  it('separa cargos y abonos por columna y pone el año aunque cruce de diciembre a enero', () => {
    expect(doc.filas).toEqual([
      { fecha: '2026-12-02', detalle: 'TRASPASO DE:ANA ROJAS LEIVA', cargo: null, abono: 50000, saldo: 60000 },
      { fecha: '2026-12-05', detalle: 'CARGO POR PAGO TC', cargo: 40000, abono: null, saldo: null },
      { fecha: '2026-12-05', detalle: 'TRASPASO DE:JUAN PEREZ SOTO', cargo: null, abono: 5000, saldo: 25000 },
      { fecha: '2027-01-03', detalle: 'COMPRA SUPERMERCADO', cargo: 5000, abono: null, saldo: 20000 },
    ])
  })

  it('verifica con los saldos de la cartola', () => {
    expect(doc.verificacion.ok).toBe(true)
    const mala = cartolaChile()
    mala[0].find((i) => i.s === '50.000').s = '51.000' // un monto mal leído
    expect(leerDocumento(agruparLineas(mala)).verificacion.ok).toBe(false)
  })
})

describe('cartola Banco Falabella', () => {
  const doc = leerDocumento(agruparLineas(cartolaFalabella()))

  it('junta las descripciones partidas en dos líneas', () => {
    expect(doc.filas[0]).toEqual({ fecha: '2026-09-02', detalle: 'TRANSF. DE ANA MARIA ROJAS', cargo: null, abono: 5000, saldo: 6000 })
    expect(doc.filas[1]).toMatchObject({ detalle: 'CAFE INVENTADO SANTIAGO CHL', cargo: 3000, abono: null })
  })

  it('lee saldos del resumen y verifica fila por fila', () => {
    expect(doc).toMatchObject({ banco: 'Banco Falabella', titular: 'JUAN PEREZ SOTO', saldoInicial: 1000, saldoFinal: 3000, desde: '2026-09-01', hasta: '2026-09-30' })
    expect(doc.verificacion.ok).toBe(true)
  })
})

describe('estado de cuenta de tarjeta Banco de Chile', () => {
  const doc = leerDocumento(agruparLineas(estadoTarjeta()))

  it('lee período, pago, cupo, tasa y saldo', () => {
    expect(doc).toMatchObject({
      digitos: '9999',
      desde: '2026-08-22',
      hasta: '2026-09-22',
      pagarHasta: '2026-10-06',
      anterior: { desde: '2026-07-24', hasta: '2026-08-21' },
      proximo: { desde: '2026-09-23', hasta: '2026-10-22' },
      total: 25000,
      minimo: 5000,
      cupo: { total: 500000, utilizado: 200000, disponible: 300000 },
      tasaMensual: 3.1,
      deudaCuotas: 900000,
    })
    expect(doc.vencimientos[0]).toEqual({ mes: 'octubre', monto: 72000 })
  })

  it('separa pagos, compras, cuotas, cargos y compras nuevas en cuotas', () => {
    expect(doc.pagos.map((p) => p.monto)).toEqual([100000])
    expect(doc.compras.map((c) => [c.detalle, c.valorCuota])).toEqual([
      ['PAYU *UBER TRIP SANTIAGO', 3000],
      ['TIENDA INVENTADA', 7000],
    ])
    expect(doc.cuotas[0]).toMatchObject({ detalle: 'CONCIERTO', cuota: 5, de: 12, valorCuota: 12000 })
    expect(doc.cargos[0]).toMatchObject({ detalle: 'COMISION ADMINISTRACION MENSUAL', valorCuota: 3000 })
    expect(doc.nuevasEnCuotas[0]).toMatchObject({ detalle: 'NOTEBOOK', cuota: 0, de: 12, valorCuota: 60000, montoOperacion: 600000 })
  })

  it('verifica que A+B+C+D+E+F+G dé el total facturado', () => {
    expect(doc.verificacion.ok).toBe(true)
  })
})
