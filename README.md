# B²GC Brokers — Entorno de pruebas funcional

Prototipo front-end de B²GC Brokers preparado para pruebas manuales con datos completamente ficticios.

## Credenciales

### Originador
- Correo: `originador@demo.b2gc.co`
- Contraseña: `Demo123!`

### Comprador
- Correo: `comprador@demo.b2gc.co`
- Contraseña: `Demo123!`

## Flujos disponibles

- Dashboard con KPIs y gráficas de prueba.
- Mis carteras, Oportunidades y Mercado con 5 lotes `LOTE-TEST-*`.
- Detalle de lote y simulador de oferta.
- Creación y persistencia de ofertas en `localStorage`.
- Mis ofertas.
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
