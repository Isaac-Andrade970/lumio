// Piezas comunes del diseño v0.5: encabezado morado, hoja clara que sube encima e íconos de línea

// Encabezado morado. "accion" va arriba a la derecha (por ejemplo, el botón de Ajustes)
export function Cabecera({ titulo, subtitulo, izquierda, accion, children }) {
  return (
    <header className="cabecera safe-top px-5 pb-10 text-white">
      <div className="mx-auto max-w-md">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {izquierda}
            {titulo && (
              <div className="min-w-0">
                {subtitulo && <p className="text-sm text-teal-300">{subtitulo}</p>}
                <h1 className="truncate text-[26px] font-semibold tracking-tight">{titulo}</h1>
              </div>
            )}
          </div>
          {accion}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </header>
  )
}

// La hoja clara donde va el contenido; se monta un poco sobre el encabezado
export function Hoja({ children }) {
  return (
    <main className="relative -mt-6 min-h-[50dvh] rounded-t-3xl bg-stone-100 px-4 pt-5 pb-32 dark:bg-stone-950">
      <div className="mx-auto max-w-md">{children}</div>
    </main>
  )
}

// Botón redondo translúcido para el encabezado
export function BotonCabecera({ etiqueta, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={etiqueta}
      className="grid size-11 shrink-0 place-items-center rounded-full border border-white/20 bg-white/10 text-teal-100 active:bg-white/20"
    >
      {children}
    </button>
  )
}

// Recuadro translúcido para datos dentro del encabezado
export function DatoCabecera({ titulo, valor }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 px-3.5 py-3">
      <p className="text-xs text-teal-300">{titulo}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  )
}

// Íconos de línea (en vez de emojis): se pintan con el color del texto
function Icono({ children, tamano = 22, grosor = 1.75 }) {
  return (
    <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const Iconos = {
  billetera: () => <Icono><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /></Icono>,
  lista: () => <Icono><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></Icono>,
  ahorro: () => <Icono><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Icono>,
  analisis: () => <Icono><path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16v-3" /></Icono>,
  ajustes: () => <Icono tamano={20}><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></Icono>,
  mas: () => <Icono grosor={2}><path d="M12 5v14M5 12h14" /></Icono>,
  volver: () => <Icono tamano={18} grosor={2}><path d="m15 6-6 6 6 6" /></Icono>,
  cerrar: () => <Icono tamano={16} grosor={2}><path d="M6 6l12 12M18 6 6 18" /></Icono>,
  borrar: () => <Icono tamano={22}><path d="M21 5H9l-6 7 6 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" /><path d="m17 9-6 6M11 9l6 6" /></Icono>,
}
