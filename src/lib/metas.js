// Metas de ahorro: { id, nombre, objetivo, mesLimite: 'AAAA-MM', aportes: [{ monto, fecha }], creado }
import { hoyISO, mesDe } from './formato.js'

// Meses que quedan para juntar la plata, contando el mes actual y el mes límite (oct → mar = 6)
export function mesesHasta(mesLimite, hoy = hoyISO()) {
  const [aH, mH] = mesLimite.split('-').map(Number)
  const [aD, mD] = mesDe(hoy).split('-').map(Number)
  return Math.max(0, aH * 12 + mH - (aD * 12 + mD) + 1)
}

// Todo lo que muestra la tarjeta de una meta
export function progresoMeta(meta, hoy = hoyISO()) {
  const ahorrado = (meta.aportes ?? []).reduce((s, a) => s + a.monto, 0)
  const falta = Math.max(meta.objetivo - ahorrado, 0)
  const meses = mesesHasta(meta.mesLimite, hoy)
  const porMes = falta === 0 ? 0 : meses > 0 ? Math.ceil(falta / meses) : falta // si se pasó la fecha, falta todo "ya"
  return {
    ahorrado,
    falta,
    porcentaje: meta.objetivo > 0 ? Math.min(100, Math.round((ahorrado / meta.objetivo) * 100)) : 0,
    meses,
    porMes,
    cumplida: falta === 0,
    vencida: falta > 0 && meses === 0,
  }
}
