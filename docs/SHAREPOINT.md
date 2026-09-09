# Inventario de SharePoint: lectura e importación

El Excel original se usa exclusivamente como fuente de lectura. No se agregan
columnas, no se cambia la tabla dinámica y no se envían entregas ni cambios al
libro. Los datos modificados en la aplicación permanecen en D1.

## Uso disponible sin acceso administrativo de Microsoft 365

1. Descargar el archivo actualizado desde SharePoint con la cuenta habitual.
2. En **Importar CSV → Excel de SharePoint**, elegir **Elegir Excel descargado**.
3. Pulsar **Revisar archivo** e ingresar la clave de edición de la aplicación.
4. Revisar los totales de Inventario frente al RESUMEN guardado en el archivo.
5. Vincular las filas ambiguas a sus equipos existentes. Las series N/P,
   numéricas o científicas nunca se usan para vincular automáticamente.
6. Revisar nuevamente los vínculos y aplicar los cambios a la aplicación.

Elegir **Crear equipo nuevo** solamente si el artículo no está ya registrado.
La primera vinculación conserva los valores actuales de la aplicación. Las
siguientes importaciones comparan Excel anterior, Excel nuevo y valores locales.
Los conflictos se omiten y se muestran para revisión; no hay eliminación por
ausencia de una fila ni recreación de equipos eliminados localmente.

El botón de importación confirma una copia puntual, no una conexión automática.
La vista previa vence en diez minutos. Si alguien edita la aplicación entre la
revisión y la confirmación, una transacción cancela toda esa importación.

## Identificación sin modificar el Excel

El vínculo se guarda en D1 usando el Item ya existente en el archivo. En esta
copia hay 207 Items únicos. No se debe asumir que el número de fila es un ID.
Si se cambia serie, tipo o modelo de un Item vinculado se requiere revisión.
Si se renumeran artículos indistinguibles (por ejemplo, dos discos con N/P y
el mismo modelo), el archivo no contiene información suficiente para detectar
el intercambio. En ese caso se debe detener la importación y revisar los vínculos.
Los conflictos de identidad y los vínculos a equipos eliminados se resuelven
mediante una revisión administrativa de D1; la interfaz no los reasigna sola.

Un equipo creado desde esta fuente recibe un código interno SP-7E7310D7-ITEM.
Su serie original se conserva en notas. El código interno nunca se escribe al Excel.

## Activación opcional de lectura directa con Microsoft Graph

La sesión del navegador no es una credencial del servidor. No copiar cookies,
tokens de Excel, contraseñas personales ni direcciones temporales de descarga.

Una persona autorizada de Microsoft 365 debe:

1. Registrar una aplicación confidencial en el tenant de Tecnasa
   `5025b09d-84b2-4789-a402-eeb445671790`.
2. Conceder el permiso de aplicación seleccionado para archivos
   `Files.SelectedOperations.Selected` y asignar exclusivamente el rol `read`
   al archivo autorizado. La concesión requiere consentimiento y asignación
   explícitos; no basta con registrar la aplicación. Evaluar los efectos sobre
   la herencia de permisos antes de conceder acceso a nivel de archivo.
3. Resolver el `driveId` y `itemId` de Graph del documento. El `sourcedoc` del
   enlace es el GUID de SharePoint, no debe usarse como `itemId` de Graph.
4. Configurar en el servidor `SHAREPOINT_CLIENT_ID`, `SHAREPOINT_CLIENT_SECRET`,
   `SHAREPOINT_DRIVE_ID` y `SHAREPOINT_ITEM_ID`. El secreto se configura fuera
   del repositorio y del navegador.

Origen fijo: `tecnasaes.sharepoint.com`, documento
`7e7310d7-05dd-4864-83ad-64d43587d358`, sitio
`/sites/Dpto.IngenieraGuatemala/Ger_Ing_TEG`.

El servidor comprueba el hostname y `sharepointIds.listItemUniqueId` antes de
descargar. Todas las operaciones de archivos son GET. El único POST a Microsoft
intercambia las credenciales de la aplicación por un token. No se pide
`Files.ReadWrite.All`, no se reemplaza el archivo y no se usa la API de edición
de libros de Excel.

La descarga utiliza `/drives/{driveId}/items/{itemId}/content`; el token de Graph
no se envía a la URL de descarga. El límite de esta integración es 5 MB comprimidos,
5,000 filas por lectura y 250 cambios por confirmación. No se recortan filas.
Se valida la versión antes y después de descargar, y antes de aplicar una vista
previa obtenida por Graph. Inicialmente la lectura se solicita con **Consultar
cambios**: todavía no existe una tarea programada en producción.

## Resumen y cambios locales

La aplicación calcula su resumen desde D1. El panel de importación compara el
detalle del Excel con su RESUMEN, que podría estar desactualizado. No fuerza los
totales de D1 a coincidir cuando hay equipos locales adicionales, vínculos sin
resolver, registros eliminados del Excel o conflictos pendientes. Muestra la
diferencia en lugar de borrar o duplicar equipos para cuadrar las cantidades.

## Despliegue y verificación

Aplicar la migración nueva `0004_motionless_wendell_rand.sql` junto con el código.
No aplicar cambios a la base de producción para probar. La migración crea
`sharepoint_links` y `sharepoint_previews`; no altera los artículos existentes.

Ejecutar `node --experimental-strip-types --test tests/sharepoint.test.mjs`,
`npm run lint` y `npm test`. Las pruebas usan SQLite en memoria y Microsoft
simulado para verificar conflictos, rollback, repetición de solicitudes,
lectura restringida y conservación de cambios locales.

Se comprobó en la cuenta del usuario que Power Automate está disponible con
licencias Free y for Office 365, y que los conectores prémium y personalizados
están deshabilitados. No se creó ningún flujo ni se activó una prueba de pago.

Fuentes técnicas:

- [Descargar archivos con Microsoft Graph](https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0)
- [Permisos seleccionados para SharePoint y OneDrive](https://learn.microsoft.com/en-us/graph/permissions-selected-overview)
- [Licencias de Power Automate](https://learn.microsoft.com/en-us/power-platform/admin/power-automate-licensing/faqs)
