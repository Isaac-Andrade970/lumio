// Categorías iniciales. Más adelante (fase 5) se podrán editar desde Ajustes.
export const CATEGORIAS = {
  gasto: [
    { id: 'comida', nombre: 'Comida', emoji: '🍔' },
    { id: 'supermercado', nombre: 'Súper', emoji: '🛒' },
    { id: 'transporte', nombre: 'Transporte', emoji: '🚌' },
    { id: 'cuentas', nombre: 'Cuentas', emoji: '💡' },
    { id: 'arriendo', nombre: 'Arriendo', emoji: '🏠' },
    { id: 'ocio', nombre: 'Ocio', emoji: '🎮' },
    { id: 'salud', nombre: 'Salud', emoji: '💊' },
    { id: 'compras', nombre: 'Compras', emoji: '🛍️' },
    { id: 'educacion', nombre: 'Educación', emoji: '📚' },
    { id: 'banco', nombre: 'Banco', emoji: '🏦' },
    { id: 'otros-gasto', nombre: 'Otros', emoji: '📦' },
  ],
  ingreso: [
    { id: 'sueldo', nombre: 'Sueldo', emoji: '💼' },
    { id: 'freelance', nombre: 'Freelance', emoji: '💻' },
    { id: 'regalo', nombre: 'Regalo', emoji: '🎁' },
    { id: 'otros-ingreso', nombre: 'Otros', emoji: '💰' },
  ],
}

// Las transferencias entre tus cuentas tienen su propia "categoría" fija
export const CATEGORIA_TRANSFERENCIA = { id: 'transferencia', nombre: 'Transferencia', emoji: '⇄' }

const TODAS = [...CATEGORIAS.gasto, ...CATEGORIAS.ingreso, CATEGORIA_TRANSFERENCIA]

export function buscarCategoria(id) {
  return TODAS.find((c) => c.id === id) ?? { id, nombre: id, emoji: '❔' }
}

// Categoría por defecto si el usuario no elige ninguna
export function categoriaOtros(tipo) {
  return tipo === 'gasto' ? 'otros-gasto' : 'otros-ingreso'
}
