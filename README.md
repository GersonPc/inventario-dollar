# Inventario Dollar

Sistema web de inventario para uso interno y colaboración mediante GitHub.

## Estado del proyecto

El proyecto se encuentra en su etapa inicial. La estructura técnica está lista
para definir los módulos, los datos del inventario y los permisos de usuario.

## Principios de diseño

- El inventario se modifica mediante movimientos: entradas, salidas y ajustes.
- Cada cambio debe conservar usuario, fecha y motivo para auditoría.
- Los permisos se definirán por rol y se aplicarán en el servidor.
- Los secretos y credenciales se guardarán fuera de Git.

## Base técnica

- React y TypeScript para la interfaz.
- Vinext para ejecutar la aplicación web.
- Drizzle ORM para el acceso tipado a datos.
- Cloudflare D1 como almacenamiento persistente cuando definamos el modelo.

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

## Flujo de colaboración

1. Actualiza `main` antes de iniciar una tarea.
2. Crea una rama corta, por ejemplo `feature/productos`.
3. Haz commits pequeños y descriptivos.
4. Abre un pull request y solicita revisión antes de unirlo a `main`.

No guardes contraseñas, tokens ni archivos `.env` en el repositorio. Cuando
sean necesarios, documenta únicamente sus nombres en `.env.example`.
