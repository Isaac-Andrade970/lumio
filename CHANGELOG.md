# Historial de versiones

Todos los cambios importantes de Lumio. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y [versionado semántico](https://semver.org/lang/es/).

## [0.6.0] - 2026-10-29 · Cartolas, agenda y metas

### Agregado
- Importar cartolas y estados de cuenta en PDF (con o sin contraseña) con pdf.js, leídos en el teléfono:
  - Cartola de cuenta corriente Banco de Chile y Banco Falabella; estado de cuenta de tarjeta de crédito Banco de Chile.
  - Verificación con saldos diarios, saldo final y totales de control (A+B+C+D+E+F+G) antes de importar.
  - Vista previa con estados *Nuevo / Ya lo tienes / Se completa / Se omite*, cuenta de destino y categorías editables.
  - Sin duplicados: huella por fila, gastos que ya llegaron por Wallet (mismo monto y cuenta, ±3 días), la misma transferencia vista en dos cartolas y pagos de tarjeta ya registrados.
  - Clasificación: pago de tarjeta (no es gasto), transferencias entre cuentas propias (por el nombre del titular), transferencias de o para otras personas.
  - Estado de cuenta: cuotas con sus meses reales desde el N° de cuota, compras nuevas en cuotas con primera cuota el mes siguiente, comisión a la configuración, períodos exactos, tasa y saldo a favor.
  - Ajuste opcional del saldo de la cuenta con el saldo final de la cartola más reciente.
- Próximos pagos en Inicio: gastos fijos, estado de cuenta de cada tarjeta y cuotas que terminan, con lo comprometido del mes. Los gastos fijos se anotan con un toque.
- Gastos fijos en Ajustes.
- Metas de ahorro en Ahorro: avance, cuánto falta y cuánto apartar al mes.
- Categorías aprendidas: al elegir una categoría para un comercio, los próximos pagos de Wallet, cartolas y anotaciones de ese comercio llegan con esa categoría.
- Modo privado (ojo o tocar el saldo) que oculta los montos y se recuerda en el teléfono.
- Deslizar un movimiento a la izquierda para borrarlo (hasta el fondo lo borra de una vez).
- README con capturas, GIF y arquitectura; GitHub Actions corre las pruebas y el build en cada push.

### Cambiado
- La tarjeta de crédito usa las fechas exactas de cierre y pago de los estados de cuenta importados y el saldo a favor oficial, que se descuenta de los meses siguientes.
- Base de datos versión 7 (tablas `reglas`, `fijos`, `metas`, `preferencias`); el respaldo las incluye.
- pdf.js queda guardado para funcionar sin internet.

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
