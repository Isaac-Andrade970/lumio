# Bolsillo 👛

App personal de finanzas para iPhone, hecha como **PWA** (web app instalable). Registra gastos e ingresos, los agrupa por categoría y (próximamente) proyecta cuánto puedes ahorrar.

**Privacidad primero:** todos los datos se guardan solo en tu teléfono (IndexedDB). No hay servidor, cuentas ni sincronización. Funciona sin internet.

## Funcionalidades

- ✅ Registro rápido de gastos e ingresos con teclado numérico propio
- ✅ Categorías ordenadas según cuánto las usas
- ✅ Resumen del mes: saldo, ingresos, gastos y top 3 categorías
- ✅ Lista de movimientos por día, con búsqueda y filtros
- ✅ Deshacer al guardar o borrar
- ✅ Aviso de posible duplicado
- ✅ Link para automatizar con Atajos de iOS: `#nuevo?monto=5990&comercio=Starbucks`
- ✅ Datos de ejemplo para probar la app
- 🔜 Gráficos y análisis mensual
- 🔜 Simulador de ahorro y metas
- 🔜 Importar cartola del banco, respaldo y Face ID

## Tecnologías

React · Vite · Tailwind CSS · Dexie.js (IndexedDB) · vite-plugin-pwa · Vitest

## Cómo correrlo en Windows

### 1. Instala lo necesario (una sola vez)

- **Node.js** (versión LTS): https://nodejs.org
- **Git**: https://git-scm.com/download/win
- **VS Code**: https://code.visualstudio.com

### 2. Abre la carpeta del proyecto

Descomprime el zip, abre la carpeta `bolsillo` en VS Code y abre la terminal (menú *Terminal → New Terminal*).

### 3. Instala las dependencias y arranca

```bash
npm install
npm run dev
```

Verás algo como:

```
➜  Local:   http://localhost:5173/
➜  Network: http://192.168.1.15:5173/
```

Abre la dirección **Local** en el navegador del PC para verla.

### 4. Pruébala en tu iPhone (misma red WiFi)

Abre en Safari del iPhone la dirección **Network** (la que empieza con `192.168...`).
Si no carga, Windows probablemente está bloqueando la conexión: acepta el aviso del Firewall o permite Node.js en *Firewall de Windows → Permitir una aplicación*.

> En modo desarrollo funciona todo excepto la instalación como app y el modo sin conexión, que necesitan HTTPS. Para eso está el paso 5.

### 5. Publícala gratis e instálala en el iPhone

1. Crea un repositorio en GitHub y sube el proyecto:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/bolsillo.git
   git push -u origin main
   ```
2. Entra a https://vercel.com con tu cuenta de GitHub → *Add New Project* → elige `bolsillo` → *Deploy*. Vercel detecta Vite solo.
3. Abre el link que te da Vercel en **Safari** del iPhone → botón **Compartir** → **Agregar a inicio**.

Cada vez que hagas `git push`, Vercel publica la nueva versión y la app se actualiza sola.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo (se recarga al guardar) |
| `npm test` | Corre las pruebas de los cálculos |
| `npm run build` | Genera la versión final en `dist/` |
| `npm run preview` | Sirve la versión final localmente |

## Estructura

```
src/
├── App.jsx                  # Pantalla principal, pestañas y botón +
├── db.js                    # Base de datos local (Dexie)
├── components/
│   ├── Inicio.jsx           # Resumen del mes
│   ├── Movimientos.jsx      # Lista agrupada por día
│   ├── NuevoMovimiento.jsx  # Hoja para anotar un gasto/ingreso
│   └── FilaMovimiento.jsx   # Una fila de la lista
└── lib/                     # Lógica sin pantallas (reutilizable)
    ├── calculos.js          # Totales, agrupaciones, link de Atajos
    ├── calculos.test.js     # Pruebas
    ├── categorias.js
    ├── formato.js           # Pesos chilenos y fechas
    └── ejemplo.js           # Datos de ejemplo
```
