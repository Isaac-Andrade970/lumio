// Versión de la app. Cuando publiques una nueva:
//   1) cambia VERSION (y "version" en package.json con: npm version 0.5.0 --no-git-tag-version)
//   2) agrega sus novedades al principio de NOVEDADES
//   3) anótalas también en CHANGELOG.md
export const VERSION = '0.4.0'

export const NOVEDADES = [
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
