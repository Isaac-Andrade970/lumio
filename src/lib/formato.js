// Formateadores que vienen incluidos en el navegador (Intl): no hay que instalar nada.

const pesos = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

// 5990 -> "$5.990"
export function formatearPesos(monto) {
  return pesos.format(monto)
}

// "5.990" o "$5990" -> 5990 (solo deja los dígitos)
export function leerMonto(texto) {
  const soloDigitos = String(texto ?? '').replace(/\D/g, '')
  return soloDigitos ? parseInt(soloDigitos, 10) : 0
}

// Fecha de hoy en formato AAAA-MM-DD según la hora local (no UTC)
export function hoyISO(fecha = new Date()) {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

// "2026-10" a partir de "2026-10-21"
export function mesDe(fechaISO) {
  return fechaISO.slice(0, 7)
}

// Convierte "AAAA-MM-DD" en Date al mediodía local (evita saltos por zona horaria)
function aFecha(fechaISO) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  return new Date(a, m - 1, d, 12)
}

const formatoDia = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
const formatoMes = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' })

// Solo la primera letra en mayúscula: "octubre de 2026" -> "Octubre de 2026"
function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

// "Hoy", "Ayer" o "Lunes, 19 de octubre"
export function nombreDia(fechaISO, hoy = hoyISO()) {
  if (fechaISO === hoy) return 'Hoy'
  const ayer = aFecha(hoy)
  ayer.setDate(ayer.getDate() - 1)
  if (fechaISO === hoyISO(ayer)) return 'Ayer'
  return capitalizar(formatoDia.format(aFecha(fechaISO)))
}

// Suma (o resta) meses: sumarMeses('2026-01', -1) -> '2025-12'
export function sumarMeses(mesISO, cantidad) {
  const [a, m] = mesISO.split('-').map(Number)
  const fecha = new Date(a, m - 1 + cantidad, 1)
  return hoyISO(fecha).slice(0, 7)
}

const formatoMesCorto = new Intl.DateTimeFormat('es-CL', { month: 'short' })

// "oct" (para los ejes de los gráficos)
export function nombreMesCorto(mesISO) {
  return formatoMesCorto.format(aFecha(`${mesISO}-01`)).replace('.', '')
}

// "Octubre de 2026"
export function nombreMes(mesISO) {
  return capitalizar(formatoMes.format(aFecha(`${mesISO}-01`)))
}
