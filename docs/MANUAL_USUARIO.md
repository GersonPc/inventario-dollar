# Manual de usuario

## 1. Acceso al sistema

Abre
[Inventario Dollar](https://inventario-dollar.fybertechdisney.workers.dev).

Cloudflare Access solicitará el correo autorizado. Según la configuración
actual, enviará un PIN temporal al correo; los usuarios no necesitan administrar
una cuenta dentro de Cloudflare.

1. Escribe el correo autorizado.
2. Solicita el código.
3. Copia el PIN recibido por correo.
4. Al terminar, la aplicación mostrará el nombre del usuario y su rol en la
   barra lateral.

No compartas el PIN. Es temporal y sirve únicamente para iniciar esa sesión.

## 2. Roles

| Rol | Consultar | Registrar y editar | Importar CSV | Ver contraseñas |
| --- | --- | --- | --- | --- |
| Administrador | Sí | Sí | Sí | Sí |
| Operador | Sí | Sí | Sí | No |
| Consulta | Sí | No | No | No |

La administración visual de usuarios no está disponible durante la migración a
Microsoft. Si un correo nuevo no puede entrar, debe revisarse tanto la política
de Cloudflare Access como su autorización interna.

## 3. Pantalla Inventario

La pantalla principal muestra:

- unidades registradas;
- unidades en bodega;
- unidades entregadas;
- registros que no funcionan;
- buscador por serie, código, modelo, MAC, IP o tienda;
- filtros por clase, tipo, ubicación y condición.

La cantidad de un equipo siempre es `1`. Los materiales pueden representar
varias unidades dentro de un solo registro.

## 4. Usar un lector de código de barras

Los lectores USB habituales funcionan como un teclado.

1. Coloca el cursor en **Lector de código de barras**.
2. Escanea la etiqueta.
3. El lector escribe la serie y envía `Enter`.
4. Si la serie existe, se abre su ficha.
5. Si no existe y el usuario puede escribir, se abre un nuevo registro con la
   serie capturada.

El lector no necesita un controlador especial siempre que pueda escribir texto
y enviar `Enter`.

## 5. Registrar varios equipos del mismo modelo

1. Selecciona **Registrar artículo**.
2. Elige **Equipo con No. de Serie**.
3. Completa No. de Serie, modelo, tipo, fecha, condición y datos opcionales.
4. Selecciona **Guardar y continuar**.

Después de guardar:

- el cuadro permanece abierto;
- se conservan modelo, tipo y los demás valores;
- el campo No. de Serie queda seleccionado;
- el siguiente escaneo reemplaza la serie anterior.

Antes de guardar de nuevo, confirma que la nueva serie aparece en el campo.

## 6. Registrar materiales por cantidad

1. Selecciona **Registrar artículo**.
2. En **Clase de artículo**, elige **Material por cantidad**.
3. Escribe el modelo o descripción del material.
4. Escribe el tipo de material.
5. Indica la cantidad total.
6. El código de material es opcional. Si queda vacío, el sistema genera uno.
7. Guarda el registro.

Ejemplo: un paquete de 82 cables puede guardarse como un registro con cantidad
`82`, en lugar de crear 82 filas individuales.

## 7. Condición y fecha de ingreso

La condición puede ser:

- **Funciona**;
- **No funciona**;
- **Sin revisar**.

La fecha de ingreso es opcional. Cuando no se conoce, queda vacía y se muestra
como un guion o como fecha desconocida en las vistas correspondientes.

## 8. Tiendas y entregas

### Crear una tienda

1. Abre **Tiendas**.
2. Escribe el número oficial.
3. Escribe el nombre oficial.
4. Selecciona **Guardar tienda**.

El número de tienda debe ser único.

### Entregar un artículo

1. Abre la ficha del equipo o material.
2. Activa **Ya fue entregado**.
3. Selecciona la tienda.
4. Confirma o cambia la fecha de entrega.
5. Guarda los cambios.

Al desmarcar la entrega, el artículo vuelve a figurar en bodega y se registra un
movimiento de retorno.

### Referencias de sala importadas

El CSV inicial puede contener solamente el código o solamente el nombre de una
sala. Mientras no exista el catálogo completo, el sistema conserva ese valor
como **Referencia de sala importada**.

Cuando se agregue la tienda oficial, abre la ficha, selecciónala en **Tienda
asignada** y guarda. La referencia temporal se reemplazará por la relación con la
tienda.

## 9. Datos de red y contraseñas

Los equipos pueden almacenar:

- MAC Address;
- dirección IP;
- contraseña;
- notas.

La contraseña se cifra antes de guardarse. Solamente un administrador puede
solicitar que se muestre. Si se edita un equipo y el campo de nueva contraseña
queda vacío, se conserva la contraseña existente.

## 10. Importar un CSV

1. Abre **Importar CSV**.
2. Arrastra el archivo o selecciona **Elegir archivo**.
3. Revisa el nombre del archivo y el número de filas detectadas.
4. Revisa el resumen de series pendientes, materiales, fechas y tiendas.
5. Revisa las primeras cinco filas.
6. Selecciona **Importar registros**.
7. Espera el mensaje con los registros nuevos, actualizados y omitidos.

No cierres la pestaña mientras el botón muestre **Importando…**.

Consulta todas las reglas en [Formato e importación CSV](FORMATO_CSV.md).

## 11. Corregir series en notación científica

Excel puede convertir una serie larga a un valor como `2,23357E+23`. Esos
valores se importan con una marca temporal para no perder ni sobrescribir filas.

1. En el buscador escribe `PENDIENTE`.
2. Abre uno de los resultados.
3. Consulta la etiqueta física del dispositivo.
4. Reemplaza todo el valor temporal por el No. de Serie correcto.
5. Guarda los cambios.

La nota del registro conserva el valor científico original como referencia.

## 12. Problemas frecuentes

### No recibo el PIN

- Confirma que el correo esté escrito correctamente.
- Revisa spam y correo no deseado.
- Busca mensajes de `noreply@notify.cloudflare.com`.
- Solicita al administrador que compruebe la política de Cloudflare Access.

### El sistema indica que el correo no está autorizado

El correo pudo superar Cloudflare Access pero no estar habilitado en la tabla
interna de usuarios. Durante la migración a Microsoft, esta autorización debe
resolverse por administración técnica.

### El lector no abre un registro

- Comprueba que el campo del lector tenga el cursor.
- Verifica que el lector envíe `Enter` al terminar.
- Prueba escribir la serie manualmente y presionar `Enter`.

### El CSV no muestra filas

- Guarda el archivo como CSV UTF-8.
- Mantén una fila reconocible de encabezados.
- No elimines las columnas Modelo y Tipo de equipo/dispositivo.

### Una fila fue omitida

El mensaje final muestra las primeras causas. Corrige la fila y vuelve a
importar; los registros con el mismo código se actualizan en lugar de duplicarse.
