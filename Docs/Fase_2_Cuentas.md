# Fase 2 — Cuentas, integrantes y apariencia

Estado: completada el 21 de octubre de 2026. No se ha publicado la web en Internet; el backend de cuentas sí está desplegado en Supabase.

## Cómo usarla

1. Ejecutar `npm.cmd run dev` y abrir la dirección que muestra Vite. La configuración actual usa el puerto 5173.
2. Entrar con el correo y la contraseña que guardaste para tu cuenta de aplicación en `.env.admin.local`. La cuenta admin y el primer hogar ya se crearon.
3. En **Invita a alguien al hogar**, escribir nombre y correo del integrante.
4. Pulsar **Crear enlace de invitación** y **Copiar enlace**.
5. Compartirlo personalmente con su destinatario. No se envía ningún correo automáticamente.
6. La persona abre el enlace, elige su contraseña y entra como integrante. Si ya tiene una cuenta, elige **Ya tengo una cuenta**, inicia sesión con el correo invitado y acepta.

Mientras la web sea local, los enlaces `localhost` funcionan únicamente en ese computador. Para compartir enlaces utilizables desde otros celulares necesitamos una URL accesible para ellos y habilitar ese origen. La publicación HTTPS de fase 5 proporcionará la URL permanente. La prueba a 360 px comprueba el diseño adaptable, no equivale a publicación ni a una prueba en dispositivos físicos.

La sesión se conserva al recargar. **Salir** cierra la sesión en este navegador. Cada integrante utiliza su propio correo y contraseña.

## Invitaciones

- Validez: siete días.
- **Renovar enlace** genera un reemplazo y deja de aceptar el anterior; también sirve para una invitación vencida.
- **Revocar** invalida una invitación pendiente. Una invitación aceptada no se revoca; retirar integrantes sería una función posterior.
- Si se pierde la respuesta al crear, reintentar sin cambiar los campos conserva la misma invitación y rota su enlace. Si se sale del formulario, se puede renovar desde la lista.
- El enlace solo se muestra al prepararlo o renovarlo. La base guarda su hash SHA-256, no el enlace original.
- El token es de 256 bits y viaja en el fragmento de la URL, que se retira de la barra al abrir la aplicación. La persona debe conservar el enlace original hasta completar el alta.
- Los enlaces son privados: quien posea uno puede utilizarlo para crear la cuenta invitada. El admin verifica a quién se lo comparte; no se está verificando el correo mediante SMTP.
- El servidor toma el correo de la invitación y fija el rol `integrante`; el navegador no puede elegir un rol.
- Una cuenta existente tiene que acreditar su sesión y un correo coincidente; el enlace no permite sustituir su contraseña.
- Si Auth crea la cuenta y después ocurre un error SQL o de conexión, puede quedar una cuenta sin hogar. Esa cuenta no puede leer inventario. Iniciar sesión con la contraseña elegida y volver a abrir una invitación vigente permite reintentar. No se borra una cuenta a ciegas después de un error de red.

## Recuperación y cambio de contraseña

Con sesión iniciada, **Cambiar contraseña** permite elegir una nueva (10 a 128 caracteres).

Si un integrante olvidó su contraseña:

1. El admin pulsa **Recuperar acceso** junto a esa persona.
2. Comparte personalmente el enlace privado generado.
3. El integrante lo abre y guarda una contraseña nueva.

El enlace de recuperación es de un solo uso y vence según la configuración de Supabase Auth, fijada en una hora. No requiere enviar correo. Solo el admin puede generarlo para integrantes de su propio hogar; no puede utilizar este panel para recuperar cuentas admin o ajenas.

Si el admin pierde el acceso, desde el computador de administración:

```powershell
npm.cmd run auth:recover-admin
```

Usa el correo de `.env.admin.local`, comprueba su rol y guarda el enlace en `.admin-recovery.local`. Abre ese enlace tú mismo. El archivo es privado y está excluido de Git. Se necesita el token de administración de Supabase y la conexión SQL local para este procedimiento.

SMTP y recuperación por correo quedan pospuestos explícitamente. El botón de ayuda de login explica la recuperación manual; no muestra una confirmación de correo enviado.

## Colores y modo oscuro

El selector **Tema** ofrece **Claro**, **Oscuro** y **Automático**. La elección se guarda en `localStorage` con la clave `lf.theme`. Automático sigue el sistema y reacciona si cambia su preferencia. El tema también se sincroniza entre pestañas y se aplica antes del primer render para evitar un destello de otro color.

La paleta se concentra en `src/styles.css`:

| Uso | Variable | Claro | Oscuro |
| --- | --- | --- | --- |
| Fondo | `--bg` | `#f5f4ed` | `#121c18` |
| Tarjetas | `--surface` | `#fffef9` | `#1b2922` |
| Fondos secundarios | `--surface-soft` | `#e9ede3` | `#26382d` |
| Texto | `--text` | `#203d34` | `#e7eee5` |
| Texto secundario | `--muted` | `#53655d` | `#afbeb1` |
| Acción principal | `--brand` | `#225c49` | `#a4d4ad` |
| Texto sobre acción | `--on-brand` | `#ffffff` | `#12291b` |
| Bordes | `--border` | `#d5dfd4` | `#3c5143` |

Las siguientes pantallas deben usar estas variables. Los errores y el foco del teclado tienen variables propias; no depender solamente del color para comunicar estados. Los controles tienen al menos 44 px de alto.

## Componentes técnicos

- Migración `202610210002_household_accounts.sql`: invitaciones, expiración, aceptación, renovación y permisos.
- Función Edge `household-admin`: operaciones de cuenta y enlaces privados.
- Acciones públicas: inspeccionar o aceptar un token de invitación válido.
- Acciones de admin: verifican el JWT con `auth.getUser`, y las operaciones SQL vuelven a comprobar rol y hogar.
- Las RPC privilegiadas solo conceden ejecución a `service_role`; no a usuarios autenticados ni anónimos.
- La función tiene `verify_jwt=false` para permitir aceptar invitaciones antes de tener cuenta y admitir los JWT actuales. Esto no autoriza las acciones admin: esas verifican el usuario dentro del handler.
- Se deshabilitó el registro público de Supabase Auth. Correo/contraseña están habilitados.
- Los orígenes y redirecciones actuales son `http://localhost:5173` y `http://127.0.0.1:5173`. No se permite cualquier origen desde el navegador.
- Los enlaces de recuperación se generan con la API admin `generateLink`, que no envía correo.
- Al cerrar la fase 2, las operaciones de inventario estaban pendientes de la fase 3. Ya se incorporaron; ver [guía de inventario](Fase_3_Inventario.md).

Referencias oficiales: [contraseñas](https://supabase.com/docs/guides/auth/passwords), [creación administrativa de usuarios](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [generar enlaces](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [configuración de funciones](https://supabase.com/docs/guides/functions/function-configuration).

## Configuración y comandos

Los archivos `.env`, `.env.database.local`, `.env.supabase.local`, `.env.admin.local`, `pass.txt` y `.admin-recovery.local` están excluidos de Git. Ninguna clave administrativa debe usar el prefijo `VITE_`.

`.env.supabase.local` contiene el token personal de Supabase y, opcionalmente, los orígenes de la aplicación:

```dotenv
SUPABASE_ACCESS_TOKEN=tu_token_privado
APP_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Al publicar, agregar la URL HTTPS definitiva y volver a ejecutar el despliegue. El script actual admite orígenes HTTPS o localhost HTTP; no publicar el servidor Vite como servicio de producción.

```powershell
npm.cmd run db:migrate
npm.cmd run auth:deploy
npm.cmd run auth:bootstrap
```

Bootstrap es una herramienta de primer alta, no un mecanismo de reinicio de contraseñas. Si el usuario ya tiene un hogar como admin, no crea otro ni cambia su contraseña. No volver a utilizarla con datos de otra persona para intentar asignarle el rol admin.

## Validación realizada

- Build y TypeScript: correctos.
- SQL local y remoto: 63 pruebas de inventario + 27 de cuentas, todas correctas.
- Concurrencia SQL: hasta cinco sesiones, sin pérdidas, duplicados o stock negativo.
- Auth y función Edge reales: 37 comprobaciones correctas. Incluyen login de usuarios distintos, permisos, llamadas directas a RPC, alta, aceptación con cuenta existente, renovación, revocación, recuperación real de contraseña y logout.
- Datos de prueba: revertidos o eliminados. Se conservan únicamente tu cuenta y hogar reales.
- Navegador: login real de admin, rol y panel correctos, sesión tras recarga, cierre de sesión, ambos temas y diseño a 360 px sin desbordamiento horizontal. Sin errores de consola observados.

Para repetir:

```powershell
npm.cmd run test:db
npm.cmd run test:db:remote
npm.cmd run test:accounts:remote
npm.cmd run build
```

Las pruebas remotas de cuentas crean usuarios sintéticos temporales sin enviar correos, y los retiran al terminar. Necesitan token de Supabase y conexión SQL. No usar fixtures reales ni modificar sus correos a direcciones de familiares.
