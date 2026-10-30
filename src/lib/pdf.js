// Abre un PDF dentro del teléfono con pdf.js y devuelve sus líneas de texto con posiciones.
// pdf.js se carga recién cuando importas un PDF, para que la app siga abriendo rápido.
import { agruparLineas } from './lectores.js'

let pdfjs = null

async function cargarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const { default: worker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = worker
  }
  return pdfjs
}

// Error con un código para que la pantalla sepa qué mostrar
export class ErrorPdf extends Error {
  constructor(codigo, mensaje) {
    super(mensaje)
    this.codigo = codigo
  }
}

// datos: ArrayBuffer del archivo · contrasena: opcional
export async function lineasDePdf(datos, contrasena) {
  const lib = await cargarPdfjs()
  let documento
  try {
    documento = await lib.getDocument({ data: new Uint8Array(datos), password: contrasena || undefined, isEvalSupported: false }).promise
  } catch (error) {
    if (error?.name === 'PasswordException') {
      // code 1 = necesita contraseña · code 2 = contraseña incorrecta
      throw error.code === 2
        ? new ErrorPdf('contrasena-incorrecta', 'Contraseña incorrecta')
        : new ErrorPdf('contrasena', 'Este PDF tiene contraseña')
    }
    throw new ErrorPdf('ilegible', 'No se pudo abrir este archivo como PDF')
  }

  const paginas = []
  for (let n = 1; n <= documento.numPages; n++) {
    const pagina = await documento.getPage(n)
    const contenido = await pagina.getTextContent()
    paginas.push(
      contenido.items
        .filter((it) => it.str?.trim())
        .map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], r: it.transform[4] + it.width })),
    )
  }
  await documento.destroy()

  if (paginas.every((p) => p.length === 0)) {
    throw new ErrorPdf('sin-texto', 'Este PDF no tiene texto (parece una imagen escaneada)')
  }
  return agruparLineas(paginas)
}
