# Inventario Dollar

Sistema web interno para controlar equipos y materiales de la bodega que atiende
a las tiendas Dollar.

La aplicación está publicada en
[inventario-dollar.fybertechdisney.workers.dev](https://inventario-dollar.fybertechdisney.workers.dev)
y el código fuente se mantiene en
[GersonPc/inventario-dollar](https://github.com/GersonPc/inventario-dollar).

## Funciones disponibles

- Registro individual de equipos mediante No. de Serie.
- Compatibilidad con lectores USB de códigos de barras que envían `Enter`.
- Lectura de códigos mediante la cámara trasera de un teléfono.
- Captura continua: al guardar un equipo nuevo, el formulario permanece abierto
  y conserva los datos para recibir el siguiente escaneo.
- Registro de materiales por cantidad, con código automático cuando no se
  proporciona uno.
- Modelo, tipo, fecha de ingreso, condición, entrega, tienda, MAC Address, IP,
  contraseña cifrada y notas.
- Importación de archivos CSV separados por coma o punto y coma.
- Vista previa y resumen antes de confirmar una importación.
- Actualización de registros existentes por No. de Serie o código de material.
- Exportación a CSV UTF-8 de los registros que muestran los filtros actuales.
- Reporte imprimible de los registros filtrados, listo para guardar como PDF.
- Catálogo de dispositivos agrupado por tipo y modelo, con existencias,
  información técnica editable e imagen propia.
- Catálogo de tiendas con relación automática de equipos por código de sala;
  las referencias sin una coincidencia única se conservan para revisión manual.
- Historial de movimientos para auditoría.
- Consulta pública y modificaciones protegidas por una clave de edición compartida.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Manual de usuario](docs/MANUAL_USUARIO.md) | Inicio de sesión, registro, lector, materiales, entregas y corrección de series. |
| [Formato e importación CSV](docs/FORMATO_CSV.md) | Encabezados aceptados, reglas, valores predeterminados y solución de problemas. |
| [Guía técnica](docs/GUIA_TECNICA.md) | Arquitectura, esquema D1, API, configuración, pruebas, respaldo y despliegue. |

## Tecnología

- React 19 y TypeScript.
- ZXing Browser para leer códigos desde la cámara sin enviar la imagen al servidor.
- Vinext y Vite para compilar la aplicación.
- Cloudflare Workers para ejecutar la aplicación.
- Cloudflare D1 como base de datos SQLite administrada.
- Cloudflare R2 para almacenar las imágenes subidas de los modelos.
- Drizzle ORM y Drizzle Kit para el esquema y las migraciones.
- Permisos temporales firmados con HMAC para proteger todas las escrituras.
- AES-GCM para cifrar las contraseñas almacenadas de los equipos.

## Inicio rápido para desarrollo

Requisitos:

- Node.js `>=22.13.0`.
- npm.
- Una sesión de Wrangler cuando se necesite consultar o publicar en Cloudflare.

Instala las dependencias y ejecuta la aplicación:

```bash
npm install
npm run dev
```

La consulta no requiere inicio de sesión. Para probar modificaciones en local,
configura `INVENTORY_WRITE_PASSWORD` en `.dev.vars`; la clave debe tener al
menos 12 caracteres.

Antes de integrar cambios:

```bash
npm run lint
npm test
```

## Comandos principales

| Comando | Uso |
| --- | --- |
| `npm run dev` | Inicia el servidor de desarrollo. |
| `npm run build` | Genera la compilación para Cloudflare Workers. |
| `npm test` | Compila y ejecuta las pruebas automatizadas. |
| `npm run lint` | Revisa TypeScript, React y accesibilidad. |
| `npm run db:generate` | Genera una migración después de cambiar `db/schema.ts`. |
| `npm run db:migrate:cloudflare` | Aplica migraciones pendientes a D1 remoto. |
| `npm run cf:typegen` | Actualiza los tipos de bindings de Cloudflare. |
| `npm run deploy:cloudflare` | Compila y publica el Worker y sus recursos estáticos. |

## Seguridad

- No guardar contraseñas, tokens, PIN temporales, respaldos ni archivos de
  variables locales en Git.
- Configurar `INVENTORY_ENCRYPTION_KEY` como secreto de Cloudflare. Si se pierde
  o cambia, las contraseñas cifradas existentes no podrán recuperarse.
- Configurar `INVENTORY_WRITE_PASSWORD` como secreto de Cloudflare y no como una
  variable visible ni un valor dentro del repositorio.
- Crear un respaldo de D1 antes de importaciones grandes o migraciones.
- Cualquier persona con la URL puede consultar y exportar el inventario. Crear,
  editar, importar o eliminar exige un permiso temporal emitido después de
  validar la clave compartida.

## Estado de acceso

No se utilizan cuentas, correos ni Cloudflare Access. La página es pública para
consulta. Al guardar el primer cambio se solicita la clave compartida y se
emite un permiso firmado válido por 30 minutos; el navegador lo mantiene solo
en memoria, así que también se pierde al recargar la página. La API verifica el
permiso en cada escritura y las contraseñas de los equipos siguen excluidas de
la exportación.

## Colaboración en GitHub

1. Actualiza la rama base antes de iniciar una tarea.
2. Crea una rama corta, por ejemplo `feature/catalogo-tiendas`.
3. Realiza cambios pequeños y ejecuta `npm run lint` y `npm test`.
4. Crea commits descriptivos.
5. Sube la rama y abre un pull request para revisión.

No se deben subir archivos de inventario reales ni respaldos de producción al
repositorio.
