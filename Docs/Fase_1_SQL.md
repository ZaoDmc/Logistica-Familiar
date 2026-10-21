# Fase 1 — Base SQL, permisos y stock

## Entregables

- Migración `supabase/migrations/202610210001_household_inventory.sql`.
- Ocho tablas con RLS: catálogo de iconos, perfiles, hogares, integrantes, categorías, productos, movimientos e invitaciones.
- Funciones `create_product` y `change_stock` para operaciones auditadas.
- Alta inicial de hogar mediante una función privada, disponible únicamente para administración SQL.
- Pruebas locales de SQL y permisos; pruebas remotas con hasta cinco conexiones simultáneas.
- Carga opcional de tres productos de ejemplo, sin datos reales ni cuentas nuevas.

## Conexión administrativa para aplicar la migración

La URL y la clave publishable de `.env` sirven para el cliente web. Para crear tablas necesitamos una conexión PostgreSQL administrativa. No se necesita poner una clave secreta en la web.

1. En el proyecto de Supabase, abrir **Connect**.
2. Mostrar la sección de cadena de conexión, normalmente **Connection string / Direct**.
3. En el selector **Method**, cambiar **Direct connection** por **Session pooler**. Preferimos este método porque es compatible con IPv4. No elegir Transaction pooler para estos scripts.
4. Copiar la cadena PostgreSQL, similar a `postgresql://postgres.REFERENCIA:[YOUR-PASSWORD]@HOST.pooler.supabase.com:5432/postgres`.
5. Pegarla en `.env.database.local`:

```dotenv
DATABASE_URL=postgresql://postgres.REFERENCIA:[YOUR-PASSWORD]@HOST.pooler.supabase.com:5432/postgres
```

El script sustituye `[YOUR-PASSWORD]` en memoria con el contenido de `pass.txt`, si existe. Ese archivo debe contener solamente la contraseña de PostgreSQL. También puedes completar la cadena tú mismo, codificando los caracteres especiales de la contraseña como parte de una URL. No pegar contraseñas en el chat ni en el código.

`.env.database.local`, `.env` y `pass.txt` están excluidos de Git. Los scripts no imprimen sus valores. La conexión remota usa TLS con verificación del certificado. El archivo `.env.database.local` no es un archivo de configuración que Vite cargue en los modos de desarrollo/producción.

Para hosts Supabase se usa el certificado raíz público de `supabase/certs/`, obtenido de la misma fuente oficial que usa el panel. Esto permite verificar la identidad del servidor sin desactivar TLS ni su validación.

Fuentes oficiales: [conectar a PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres), [funciones y permisos](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Aplicación y validación

Desde la carpeta del proyecto:

```powershell
npm.cmd run test:db
npm.cmd run db:migrate
npm.cmd run test:db:remote
```

`test:db` usa PostgreSQL embebido (PGlite) y un sustituto mínimo de Supabase Auth, sin red ni credenciales. Verifica SQL real y RLS, pero no sustituye la prueba contra Supabase Auth/PostgreSQL reales.

`db:migrate` aplica el esquema en una transacción y registra versión y huella en `private.app_migrations`. Repetirlo con el mismo SQL no vuelve a crear tablas. Una migración aplicada no se edita: las futuras modificaciones se harán mediante nuevas migraciones. La migración SQL también puede ejecutarse desde SQL Editor, pero hay que elegir un único mecanismo de aplicación; el registro propio del script no es el registro de Supabase CLI.

`test:db:remote` ejecuta las pruebas de permisos en una transacción con `ROLLBACK`. Después crea un hogar y un usuario sintéticos temporales para probar concurrencia real entre conexiones y los elimina al terminar. No envía correos ni cambia productos reales. Si se interrumpe forzosamente el proceso durante la prueba concurrente, puede quedar el hogar «Prueba temporal de concurrencia»; revisar y retirar exclusivamente esos datos de prueba.

Errores de conexión habituales:

- `ENOTFOUND` / `ENETUNREACH`: revisar el host y preferir Session pooler si no hay conectividad IPv6.
- `SELF_SIGNED_CERT_IN_CHAIN`: revisar el certificado público configurado; no desactivar su validación.
- `28P01`: la contraseña PostgreSQL fue rechazada. Corregir `pass.txt`; no usar la contraseña de acceso al portal ni la clave publishable.

Verifica: cinco incrementos sin pérdidas, cinco reintentos de una operación con un solo movimiento, conflicto entre dos escrituras absolutas y dos decrementos desde stock uno. El historial debe coincidir con el stock final y cada versión debe tener un movimiento.

## Crear el primer hogar

No se crean cuentas reales automáticamente en la migración ni en las pruebas. Puedes dejar este paso para la fase 2.

1. Crear tu usuario desde **Authentication → Users** en Supabase (alta administrativa). Usar un correo al que tengas acceso y una contraseña propia de la aplicación.
2. Copiar su UUID.
3. En SQL Editor, ejecutar como `postgres`, sustituyendo el UUID:

```sql
select private.bootstrap_household(
  'UUID_DE_TU_USUARIO'::uuid,
  'Hogar',
  'Tu nombre'
);
```

La función crea perfil, hogar y pertenencia admin. Devuelve el UUID del hogar. Si el usuario ya pertenece a un hogar, se detiene para evitar un alta duplicada. No debe concederse ejecución de esta función a los roles de la aplicación. La incorporación de otros integrantes, con verificación del admin, se implementa en fase 2.

## Datos opcionales de demostración

Preferir un hogar de desarrollo. Con un hogar y usuario existentes, ejecutar:

```powershell
npm.cmd run db:seed -- UUID_DEL_HOGAR UUID_DEL_USUARIO
```

Agrega categorías y estos productos: Crema de leche Soprole (2), Comida del Logan Cannes (1) y Papel higiénico (0). Utiliza las mismas operaciones autorizadas que usará la aplicación. Repetir con el mismo usuario no duplica productos ni reinicia cantidades. No cambiar el usuario al repetir esta carga.

## Contrato para las siguientes fases

- Categorías: `insert` de `household_id`, `name` e `icon_id`; el autor se obtiene de la sesión. Ambos roles pueden agregarlas. No se permiten nombres repetidos en un hogar, ignorando mayúsculas y espacios extremos.
- Productos: `create_product(p_household_id, p_category_id, p_name, p_description, p_icon_id, p_initial_stock, p_operation_id)` devuelve un movimiento que incluye el UUID del producto. Generar y conservar el UUID de operación antes de enviar. La descripción admite hasta 240 caracteres y el nombre hasta 100.
- Botones: `change_stock(p_product_id, p_operation_id, 'delta', 1)` o `-1`.
- Casilla: `change_stock(p_product_id, p_operation_id, 'set', cantidad, version_leida)`.
- Un reintento conserva el mismo identificador y parámetros. Cada nueva intención usa otro UUID. No generar un identificador nuevo automáticamente tras un error de red: consultar/reintentar el anterior.
- La función devuelve el movimiento confirmado, que puede ser anterior al estado actual del producto si se trata de un reintento. Consultar después el producto para mostrar su stock vigente.
- Cantidades enteras entre 0 y 1.000.000; cada cambio confirmado incrementa la versión. El valor inicial, incluso cero, genera historial.
- `42501`: sin acceso; `22023`: parámetros u operación reutilizada incorrectamente; `23514`: cantidad/restricción inválida; `40001`: versión obsoleta, refrescar y pedir nueva confirmación.
- El historial incluye actor, nombre del actor y del producto al momento de la operación, cantidades y hora del servidor. Los clientes, incluido admin, solo pueden leerlo.
- Los perfiles y sus referencias usan borrado restringido para preservar autoría. La baja de un integrante se hará retirando pertenencia en una futura operación administrativa; borrar definitivamente cuentas requiere un procedimiento de conservación de auditoría.
- La tabla de invitaciones es una reserva del esquema: el flujo de envío, aceptación y revocación no está implementado. Solo admin puede leer invitaciones de su hogar; ningún cliente puede escribirlas directamente.
- No hay edición ni borrado de categorías/productos en esta fase. Si se incorpora, tendrá operaciones y controles propios.
- Realtime se habilitará en fase 4; no se agrega todavía ninguna tabla a su publicación.

## Estado de comprobación

- Validación local: 63 comprobaciones SQL correctas, incluyendo reversión de stock y de alta si falla el historial.
- Aplicación en Supabase: migración `202610210001` aplicada el 21 de octubre de 2026 mediante Session pooler con TLS verificado.
- Reejecución: la migración se reconoce como aplicada y no modifica el esquema.
- Pruebas remotas: las mismas 63 comprobaciones correctas usando los roles SQL y `auth.uid()` reales de Supabase. Las identidades de prueba se simulan desde la conexión administrativa; el login y la validación de sesiones de la interfaz se implementan y prueban en fase 2.
- Concurrencia: hasta cinco sesiones; incrementos sin pérdidas, reintentos sin duplicados, detección de versión obsoleta y decrementos sin negativos. Historial y versiones consistentes.
- Limpieza: transacción de permisos revertida y datos de concurrencia eliminados.
- Primer hogar real: creado posteriormente durante la fase 2 junto con la primera cuenta admin.

**Fase 1 completada.** Las cuentas reales, el primer hogar familiar y la interfaz de acceso se incorporaron en fase 2. Ver [guía de cuentas](Fase_2_Cuentas.md).
