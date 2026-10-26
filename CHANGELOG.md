# Historial de versiones

Todos los cambios importantes de Lumio. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [versionado semántico](https://semver.org/lang/es/).

## [0.5.0] - 2026-10-26 · Nuevo diseño

### Agregado
- Logo e íconos nuevos (pantalla de inicio del iPhone, favicon y versión adaptable para Android).
- Inicio con tarjetas apiladas estilo Wallet: cuentas, efectivo y tarjetas de crédito. Al tocar una se ve su detalle (gastado y recibido del mes, cuotas vigentes y últimos movimientos).
- Encabezados con resumen: gastos e ingresos del mes en Movimientos y total gastado por categoría en Análisis.

### Cambiado
- Paleta morada (violeta + gris lavanda) definida en `@theme` de Tailwind, íconos de línea en vez de emojis y barra inferior rediseñada.
- Hoja de nuevo movimiento con encabezado morado y categorías como chips de texto.
- Filas de movimientos: el comercio o la nota es el título y la categoría pasa al detalle.

### Quitado
- Recuadro "Donde más gastas" de Inicio (ya está en Análisis).

## [0.4.0] - 2026-10-26 · Respaldo y transferencias

### Agregado
- Respaldo de todos los datos en un archivo `.json`, con contraseña opcional (cifrado AES-GCM con llave derivada por PBKDF2).
- Restauración con resumen previo, validación del archivo y copia automática de los datos anteriores para poder deshacer.
- Recordatorio en Inicio si pasan más de 7 días sin respaldar.
- Transferencias entre cuentas propias (ej. retiro en cajero: débito → Efectivo). No cuentan como gasto ni ingreso.
- Pantalla de Ajustes con cuentas, conexión de Wallet, respaldo y versión.
- Hoja de novedades que aparece una vez después de cada actualización.

### Cambiado
- La conexión de Wallet y la edición de cuentas se movieron a Ajustes.
- Base de datos versión 6 (se actualiza sola, sin perder datos).

## [0.3.0] - 2026-10-26 · Cuentas y tarjeta de crédito

### Agregado
- Saldo real por cuenta en Inicio, con ingresos asignados a una cuenta.
- Tarjeta de crédito: estado de cuenta, fecha de pago, cuotas comprometidas, compras en cuotas y pagos parciales con interés estimado.
- Gastos separados por tarjeta (filtro y sección en Análisis).

## [0.2.0] - 2026-10-23 · Pagos de Wallet automáticos

### Agregado
- Atajo de iOS que envía cada pago de Apple Pay a una bandeja en Supabase (protegida con RLS y clave), y Lumio los importa al abrirse.

## [0.1.0] - 2026-10-22 · Primera versión

### Agregado
- PWA instalable y local-first (IndexedDB con Dexie).
- Registro de gastos e ingresos, lista por día, simulador de ahorro con interés compuesto y análisis con gráficos.
