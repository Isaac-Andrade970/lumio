// Versión de la app. Cuando publiques una nueva:
//   1) cambia VERSION (y "version" en package.json con: npm version 0.5.0 --no-git-tag-version)
//   2) agrega sus novedades al principio de NOVEDADES
//   3) anótalas también en CHANGELOG.md
export const VERSION = '0.6.0'

export const NOVEDADES = [
  {
    version: '0.6.0',
    fecha: '2026-10-29',
    titulo: 'Cartolas, agenda y metas',
    cambios: [
      'Importa la cartola o el estado de cuenta en PDF (Banco de Chile y Banco Falabella), aunque tenga contraseña. Lumio revisa que los saldos cuadren y no duplica lo que llegó por Wallet.',
      'Próximos pagos en tu billetera: gastos fijos, pago de la tarjeta y cuotas que terminan. Anota tus gastos fijos en Ajustes.',
      'Metas de ahorro en Ahorro: cuánto llevas y cuánto apartar al mes.',
      'Lumio aprende tus categorías: si cambias la de un comercio, la próxima compra ahí llega con esa.',
      'Modo privado: toca el ojo (o tu saldo) para ocultar los montos.',
      'Desliza un movimiento a la izquierda para borrarlo.',
      'La tarjeta de crédito usa las fechas exactas y el saldo a favor de tu estado de cuenta.',
    ],
  },
  {
    version: '0.5.0',
    fecha: '2026-10-26',
    titulo: 'Nuevo diseño',
    cambios: [
      'Diseño nuevo en morado, más sobrio, con logo propio y nuevo ícono de la app.',
      'Inicio es ahora tu billetera: tus cuentas y tarjetas apiladas como en Wallet. Toca una para ver su detalle.',
      'Cada tarjeta muestra lo gastado y recibido del mes; la de crédito, sus cuotas que siguen.',
      'Los movimientos muestran el comercio o la nota como nombre principal.',
    ],
  },
  {
    version: '0.4.0',
    fecha: '2026-10-26',
    titulo: 'Respaldo y transferencias',
    cambios: [
      'Respaldo de todos tus datos en un archivo, con contraseña opcional. Restáuralo en cualquier iPhone.',
      'Recordatorio si pasan más de 7 días sin respaldar.',
      'Transferencias entre tus cuentas (por ejemplo, retiro en cajero: débito → Efectivo). No cuentan como gasto.',
      'Nueva pantalla de Ajustes (⚙️ arriba a la derecha) con cuentas, Wallet, respaldo y versión.',
    ],
  },
  {
    version: '0.3.0',
    fecha: '2026-10-26',
    titulo: 'Cuentas y tarjeta de crédito',
    cambios: [
      'Saldo real de cada cuenta en Inicio.',
      'Tarjeta de crédito: estado de cuenta, cuotas comprometidas, compras en cuotas y pagos parciales con interés estimado.',
      'Gastos separados por tarjeta.',
    ],
  },
  {
    version: '0.2.0',
    fecha: '2026-10-23',
    titulo: 'Pagos de Wallet automáticos',
    cambios: ['Los pagos con Apple Pay llegan solos a Lumio gracias a un atajo y una bandeja en Supabase.'],
  },
  {
    version: '0.1.0',
    fecha: '2026-10-22',
    titulo: 'Primera versión',
    cambios: ['Registro de gastos e ingresos, lista por día, simulador de ahorro y análisis con gráficos.'],
  },
]

// Recordar qué versión de novedades ya viste (solo en este teléfono)
const VISTA = 'lumio-novedades-vistas'

export function versionVista() {
  try {
    return localStorage.getItem(VISTA)
  } catch {
    return VERSION // sin almacenamiento: no molestar con la hoja
  }
}

export function marcarVista() {
  try {
    localStorage.setItem(VISTA, VERSION)
  } catch {
    // nada
  }
}
