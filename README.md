# B²GC Brokers — Entorno de pruebas funcional

Prototipo front-end de B²GC Brokers preparado para pruebas manuales con datos completamente ficticios.

## Credenciales

### Administrador
- Correo: `admin@b2gc.co`
- Contraseña: `Admin123!`

### Vendedor
- Correo: `vendedor@demo.b2gc.co`
- Contraseña: `Demo123!`

### Comprador
- Correo: `comprador@demo.b2gc.co`
- Contraseña: `Demo123!`

## Flujos disponibles

- Dashboard con KPIs y gráficas de prueba.
- Mis carteras, Oportunidades y Mercado con 5 lotes `LOTE-TEST-*`.
- Detalle de lote y simulador de oferta.
- Creación y persistencia de ofertas en `localStorage`.
- Mis ofertas segmentadas por lote, de la más alta a la más baja (el vendedor ve todo el detalle; el comprador ve a los demás postores en anónimo).
- Carteras en subasta: tiempo de cierre en vivo, estado (en vivo / próxima / cerrada) y progreso de la ventana.
- Mercado del comprador: favoritas (★) arriba, la más vendida y la que vence más rápido destacadas.
- Alerta al comprador cuando oferta por debajo de la última ofertada; el vendedor acepta o rechaza cada oferta y ve si supera su tarifa.
- Línea de proceso del comprador (fase 1 a 6) en el dashboard.
- Panel de administración con analítica de subastas, tiempos, conversión y asistente IA (reglas sobre datos demo).
- Negociaciones y adjudicaciones con escenarios demo.
- Documentos y Data Room con documentos ficticios consultables.
- Vista de documento de prueba y descarga del contenido demo.
- Carga real de archivos locales para prueba, con límite de 2 MB por archivo.
- Reemplazo y eliminación de archivos cargados.
- Reportes calculados a partir de los lotes demo.
- Centro de pruebas con validaciones automáticas y restauración del escenario.

## Documentos de prueba

El módulo incluye documentos ficticios de tipo PDF/XLSX/DOCX como registros de prueba. No son archivos reales de clientes y no contienen información personal real.

## Cómo ejecutar

1. Abre `index.html` en Chrome, Edge o Firefox.
2. Entra con una de las cuentas demo.
3. Navega por los módulos del menú lateral.
4. En **Documentos** o **Data room**, usa **Subir documento** para seleccionar un archivo local.
5. Usa **Ver** y **Descargar** para probar el flujo documental.
6. En **Pruebas**, ejecuta las pruebas automáticas y usa **Restaurar datos** para volver al escenario inicial.

Para un comportamiento de almacenamiento más consistente en todos los navegadores, también puedes servir la carpeta con un servidor estático local, por ejemplo `python -m http.server 8080`, y entrar a `http://localhost:8080`.

## Alcance técnico

Es un entorno demo local: no hay backend, base de datos, autenticación segura, pagos ni conexión con información productiva. Los archivos cargados y las ofertas se almacenan localmente en el navegador para facilitar el testeo.
