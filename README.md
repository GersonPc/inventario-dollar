# Inventario Dollar

Sistema web de inventario para uso interno y colaboración mediante GitHub.

## Estado del proyecto

La primera versión funcional incluye:

- inventario individual por código de barras;
- compatibilidad con lectores USB que escriben el código y envían Enter;
- tiendas, entregas, fecha de ingreso y condición del equipo;
- modelo, tipo, MAC Address, IP, contraseña cifrada y notas;
- importación CSV con vista previa y actualización por código de barras;
- roles de administrador, operador y consulta;
- lista cerrada de correos autorizados con opción de suspender y reactivar acceso;
- historial de movimientos para auditoría.

## Principios de diseño

- El inventario se modifica mediante movimientos: entradas, salidas y ajustes.
- Cada cambio debe conservar usuario, fecha y motivo para auditoría.
- Los permisos se definirán por rol y se aplicarán en el servidor.
- Los secretos y credenciales se guardarán fuera de Git.

## Base técnica

- React y TypeScript para la interfaz.
- Vinext para ejecutar la aplicación web.
- Drizzle ORM para el acceso tipado a datos.
- Cloudflare D1 como almacenamiento persistente.
- Cloudflare Workers para la aplicación y Cloudflare Access para el ingreso por correo.

## Requisitos

- Node.js `>=22.13.0`

## Desarrollo local

```bash
npm install
npm run dev
```

Antes de integrar cambios, verifica la aplicación con:

```bash
npm run build
npm test
```

## Comandos

- `npm run dev`: start local development
- `npm run build`: verifica la compilación para producción
- `npm test`: ejecuta la compilación y las pruebas
- `npm run lint`: revisa la calidad del código
- `npm run db:generate`: genera migraciones después de modificar el esquema
- `npm run cf:typegen`: actualiza los tipos de los bindings de Cloudflare
- `npm run db:migrate:cloudflare`: aplica las migraciones pendientes en D1
- `npm run deploy:cloudflare`: compila y publica el Worker

## Producción en Cloudflare

La aplicación está publicada en
<https://inventario-dollar.fybertechdisney.workers.dev> y protegida por
Cloudflare Access. El usuario escribe su correo y recibe un PIN temporal; no
necesita una cuenta de Cloudflare.

Access comprueba la identidad y la aplicación mantiene una segunda lista
cerrada de correos autorizados. El administrador inicial es
`gerpxd@gmail.com`; desde el apartado **Usuarios** puede autorizar otros
correos y asignarles los roles administrador, operador o consulta.

## Flujo de colaboración

1. Actualiza `main` antes de iniciar una tarea.
2. Crea una rama corta, por ejemplo `feature/productos`.
3. Haz commits pequeños y descriptivos.
4. Abre un pull request y solicita revisión antes de unirlo a `main`.

No guardes contraseñas, tokens ni archivos `.env` en el repositorio. Cuando
sean necesarios, documenta únicamente sus nombres en `.env.example`.

## Importación CSV

La plantilla está disponible en `public/plantilla-inventario.csv`. Los campos
obligatorios son código de barras, modelo, tipo de dispositivo y fecha de
ingreso. Las tiendas incluidas en el archivo se crean o actualizan por su
número, y los equipos existentes se actualizan por su código de barras.
