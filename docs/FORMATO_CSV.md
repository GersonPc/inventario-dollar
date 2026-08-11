# Formato e importación CSV

## Resumen

El importador acepta archivos `.csv` separados por coma o punto y coma. También
acepta:

- un título antes de los encabezados;
- encabezados con saltos de línea;
- fechas escritas como `dd/mm/aaaa`, `aaaa-mm-dd` o número serial de Excel;
- equipos sin fecha conocida;
- materiales por cantidad;
- referencias de tienda todavía no relacionadas con el catálogo oficial.

El límite por importación es de 5,000 registros.

## Plantilla recomendada

La plantilla descargable se encuentra en
[`public/plantilla-inventario.csv`](../public/plantilla-inventario.csv).

Encabezados recomendados:

```csv
No. de Serie,Modelo,Tipo de dispositivo,Clase de articulo,Cantidad,Fecha de ingreso,Entregado,Funciona,No. Tienda,Nombre de tienda,Fecha de entrega,MAC Address,IP,Password,Notas
```

## Columnas

| Columna | Equipo | Material | Descripción |
| --- | --- | --- | --- |
| No. de Serie | Obligatoria | Opcional | Identificador único. En materiales funciona como código interno. |
| Modelo | Obligatoria | Obligatoria | Modelo o descripción principal. |
| Tipo de dispositivo | Obligatoria | Obligatoria | Categoría del equipo o material. |
| Clase de artículo | Opcional | Recomendable | `Equipo` o `Material`. |
| Cantidad | `1` | Obligatoria si es mayor que `1` | Entero positivo. |
| Fecha de ingreso | Opcional | Opcional | Fecha conocida del ingreso o inventario. |
| Entregado | Opcional | Opcional | `SI` marca entrega; vacío se interpreta como `NO`. |
| Funciona | Opcional | Opcional | Estado funcional. |
| No. Tienda | Opcional | Opcional | Código oficial de tienda. |
| Nombre de tienda | Opcional | Opcional | Nombre oficial de tienda. |
| Fecha de entrega | Opcional | Opcional | Solo se utiliza cuando está entregado. |
| MAC Address | Opcional | No aplica | Dirección física de red. |
| IP | Opcional | No aplica | Dirección IP. |
| Password | Opcional | No aplica | Se cifra antes de almacenarse. |
| Notas | Opcional | Opcional | Observaciones libres. |

## Encabezados alternativos reconocidos

El importador normaliza mayúsculas, acentos, espacios y signos. Entre los
encabezados aceptados están:

| Campo interno | Ejemplos reconocidos |
| --- | --- |
| No. de Serie | `Serie`, `Serial`, `Código de barras`, `Barcode`, `Código` |
| Modelo | `Modelo`, `Model` |
| Tipo | `Tipo de equipo`, `Tipo de dispositivo`, `Tipo` |
| Fecha de ingreso | `Fecha de inventario`, `Cuando ingreso`, `Ingreso` |
| Entrega | `Entregado`, `Ya fue entregado`, `Entregado al cliente (SI O NO)` |
| Condición | `Estatus`, `Funciona`, `Condición`, `Estado funcional` |
| Tienda combinada | `Código y nombre de sala`, `Sala` |
| Número de tienda | `No. Tienda`, `Número de tienda` |
| Nombre de tienda | `Nombre de tienda`, `Tienda` |
| Cantidad | `Cantidad`, `Unidades`, `Quantity` |

## Valores de condición

Se interpretan como **Funciona**:

- `SI`;
- `Funciona`;
- `Funcional`;
- `Bueno`;
- `OK`;
- `1`.

Se interpretan como **No funciona**:

- `NO`;
- `No funciona`;
- `No funcional`;
- `Dañado`;
- `Defectuoso`;
- `0`.

Cualquier otro valor o una celda vacía se guarda como **Sin revisar**.

## Reglas para tiendas

- Una sala vacía o el texto `No tiene` significa **Sin tienda asignada**.
- Si el CSV contiene número y nombre oficiales, el importador puede crear o
  actualizar la tienda por su número.
- Si solamente existe una columna combinada, el sistema intenta relacionarla
  con una tienda existente por número o por nombre.
- Si no encuentra coincidencia, conserva el dato en `store_reference` para
  relacionarlo después sin perder la información original.

## Fechas vacías y entrega

- Una fecha vacía se conserva como desconocida.
- `Entregado` vacío se interpreta como `NO`.
- Un artículo entregado debe tener una tienda, una referencia de sala o un
  número de tienda.
- Si no está entregado, la fecha de entrega se descarta.

## Series en notación científica

Una serie como `2,23357E+23` ya no contiene todos los dígitos originales. El
sistema no intenta adivinarlos.

Para preservar cada fila:

1. conserva el valor científico;
2. agrega `-PENDIENTE-` y el número de Item o fila;
3. crea una nota indicando que requiere corrección manual.

Ejemplo:

```text
2,23357E+23-PENDIENTE-198
```

Así, dos filas con el mismo valor científico no se sobrescriben. Después de la
importación, busca `PENDIENTE` y corrige cada serie desde la ficha del equipo.

## Detección de materiales

Una fila se interpreta como material cuando ocurre alguna de estas condiciones:

- la clase contiene `Material`;
- la cantidad es mayor que `1`;
- no existe serie y el tipo contiene palabras como `material`, `cable`,
  `cantidad` o `unidades`.

El importador reconoce descripciones como:

```text
CABLE DE RED CANTIDAD 82 UNIDADES
```

En ese caso guarda:

- tipo: `CABLE DE RED`;
- cantidad: `82`;
- código: `MAT-<Item>` si la serie está vacía.

## Creación y actualización

- El No. de Serie o código de material es único.
- Si el código no existe, se crea un registro.
- Si ya existe, se actualiza con los valores del CSV.
- Cada fila importada genera un movimiento de auditoría `imported`.
- Las contraseñas nuevas se cifran; una importación sin contraseña conserva la
  contraseña cifrada existente.

## Preparar archivos desde Excel

Para evitar que Excel dañe series largas:

1. configura la columna de series como **Texto** antes de pegar los datos;
2. no uses formato numérico ni científico;
3. conserva ceros iniciales;
4. exporta como **CSV UTF-8**;
5. abre el CSV con un editor de texto y comprueba algunas series largas antes de
   importarlo.

La vista previa siempre debe revisarse antes de confirmar.
