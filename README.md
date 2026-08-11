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
- Captura continua: al guardar un equipo nuevo, el formulario permanece abierto
  y conserva los datos para recibir el siguiente escaneo.
- Registro de materiales por cantidad, con código automático cuando no se
  proporciona uno.
- Modelo, tipo, fecha de ingreso, condición, entrega, tienda, MAC Address, IP,
  contraseña cifrada y notas.
- Importación de archivos CSV separados por coma o punto y coma.
- Vista previa y resumen antes de confirmar una importación.
- Actualización de registros existentes por No. de Serie o código de material.
- Catálogo de tiendas y referencias de sala pendientes de relacionar.
- Historial de movimientos para auditoría.
- Roles internos de administrador, operador y consulta.
- Protección de acceso mediante Cloudflare Access.

## Documentación

| Documento | Contenido |
| --- | --- |
| [Manual de usuario](docs/MANUAL_USUARIO.md) | Inicio de sesión, registro, lector, materiales, entregas y corrección de series. |
| [Formato e importación CSV](docs/FORMATO_CSV.md) | Encabezados aceptados, reglas, valores predeterminados y solución de problemas. |
| [Guía técnica](docs/GUIA_TECNICA.md) | Arquitectura, esquema D1, API, configuración, pruebas, respaldo y despliegue. |

## Tecnología

- React 19 y TypeScript.
- Vinext y Vite para compilar la aplicación.
- Cloudflare Workers para ejecutar la aplicación.
- Cloudflare D1 como base de datos SQLite administrada.
- Drizzle ORM y Drizzle Kit para el esquema y las migraciones.
- Cloudflare Access para validar la identidad del usuario.
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

La autenticación completa depende de los encabezados emitidos por Cloudflare
Access. El servidor local permite desarrollar y compilar la interfaz, pero el
flujo autenticado debe probarse detrás de Access o con encabezados de identidad
de un entorno controlado.

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
- Mantener los permisos de escritura en el servidor; ocultar botones en la
  interfaz no sustituye la validación del rol.

## Estado de autenticación

La producción utiliza Cloudflare Access. El administrador inicial se define con
`INVENTORY_ADMIN_EMAIL`. La pantalla de administración de usuarios fue retirada
mientras se prepara la migración a la plataforma de identidad de Microsoft.

Durante esta transición, un correo nuevo debe estar permitido por Cloudflare
Access y también existir en la tabla interna `users`; el administrador inicial
es la excepción que puede crearse automáticamente.

## Colaboración en GitHub

1. Actualiza la rama base antes de iniciar una tarea.
2. Crea una rama corta, por ejemplo `feature/catalogo-tiendas`.
3. Realiza cambios pequeños y ejecuta `npm run lint` y `npm test`.
4. Crea commits descriptivos.
5. Sube la rama y abre un pull request para revisión.

No se deben subir archivos de inventario reales ni respaldos de producción al
repositorio.
