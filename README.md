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
- Catálogo de tiendas y referencias de sala pendientes de relacionar.
- Historial de movimientos para auditoría.
- Acceso público temporal para las pruebas previas a la integración con Entra ID.

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
- Drizzle ORM y Drizzle Kit para el esquema y las migraciones.
- Cloudflare Access preparado para reactivarse cuando se conecte Entra ID.
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

Con `INVENTORY_PUBLIC_ACCESS=true`, el servidor local y el Worker permiten usar
el inventario sin iniciar sesión. Esta opción es exclusivamente temporal: antes
de operar con datos sensibles debe desactivarse y configurarse Entra ID.

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
- Crear un respaldo de D1 antes de importaciones grandes o migraciones.
- Mientras `INVENTORY_PUBLIC_ACCESS=true`, cualquier persona con la URL puede
  consultar, registrar, editar, importar y exportar inventario. Las contraseñas
  permanecen cifradas y se excluyen del CSV mientras no exista autenticación.

## Estado de autenticación

La producción está en modo público temporal mediante
`INVENTORY_PUBLIC_ACCESS=true` mientras se prepara la integración con Entra ID.
La pantalla de administración de usuarios continúa retirada. El modo público
opera como `operator`: permite el trabajo de bodega, pero no revela contraseñas
guardadas ni las incluye en la exportación. La API interna de administración de
usuarios sigue deshabilitada.

Para cerrar de nuevo el acceso, cambia la variable a `false` y protege el
Worker con una aplicación de Cloudflare Access conectada a Entra ID.

## Colaboración en GitHub

1. Actualiza la rama base antes de iniciar una tarea.
2. Crea una rama corta, por ejemplo `feature/catalogo-tiendas`.
3. Realiza cambios pequeños y ejecuta `npm run lint` y `npm test`.
4. Crea commits descriptivos.
5. Sube la rama y abre un pull request para revisión.

No se deben subir archivos de inventario reales ni respaldos de producción al
repositorio.
