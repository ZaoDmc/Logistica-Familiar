# Alta controlada de familias independientes

Procedimiento operativo añadido el 25 de octubre de 2026. No cambia la interfaz ni habilita el registro público. Cada hogar tiene su propio admin, integrantes, categorías, productos e historial.

## Datos necesarios

Pedir consentimiento para participar, nombre del hogar, nombre visible del administrador y correo. No pedir una contraseña. Guardar en `.env.household.local` (excluido de Git), sin sustituir `.env.admin.local` de la familia original:

```dotenv
HOUSEHOLD_NAME=Nombre de la familia
HOUSEHOLD_ADMIN_NAME=Nombre visible
HOUSEHOLD_ADMIN_EMAIL=admin@example.com
```

Se requieren las conexiones administrativas privadas ya configuradas para SQL y Supabase. Este comando es para quien opera el servicio; nunca se ejecuta desde el navegador ni se entrega a los administradores familiares.

## Preparar el acceso

Desde la raíz del proyecto:

```powershell
node scripts/onboard-household.mjs
node scripts/onboard-household.mjs --apply
```

El primer comando solo revisa. El segundo crea la cuenta si no existe y usa `private.bootstrap_household` para crear un hogar independiente y asignar el rol admin. La cuenta nueva recibe una contraseña aleatoria solo en memoria, que no se muestra ni se guarda; la destinataria debe elegir la suya con el enlace privado. No se envían correos.

Si el correo ya pertenece a otro hogar, tiene un rol diferente o el nombre del hogar está ocupado por otra alta, el comando se detiene para revisión. Si ya existe exactamente el hogar esperado con ese admin, lo reutiliza sin duplicarlo. Repetir `--apply` genera otro enlace: no hacerlo innecesariamente después de compartir el anterior. No modifica la contraseña de una cuenta existente.

Antes de generar el enlace verifica con RLS y la identidad del nuevo admin que solo puede consultar su hogar y que su rol es admin. La cuenta Auth puede quedar creada sin hogar si SQL falla; no se borra automáticamente porque se podría perder información. Corregir la causa y repetir la preparación.

## Entrega privada

El resultado se guarda fuera de Git:

- `.household-access.local`: recibo con identificadores, fecha, vigencia y enlace.
- `.household-message.local`: mensaje listo para copiar y compartir personalmente con el administrador indicado.

El enlace permite acceso a esa cuenta: tratarlo como una contraseña temporal. No pegarlo en documentación pública, commits, capturas, PR ni grupos familiares. No abrirlo para probarlo: es personal y de un solo uso. El comando usa `generateLink`, que genera el enlace sin enviar un mensaje al destinatario.

La vigencia se consulta desde Auth; en la preparación inicial fue de **3600 segundos (1 hora)**. Si vence, generar uno nuevo para el mismo hogar. Los archivos de resultado se sustituyen en la siguiente preparación: entregar o guardar privadamente lo necesario antes de preparar otra familia.

La pantalla puede decir **Recupera tu acceso**: en este caso sirve para elegir la primera contraseña. La persona abre el enlace en su propio celular, guarda una contraseña de al menos 10 caracteres y luego usa la URL pública con su correo. No compartir una sesión del operador ni usar cuentas de Vercel/Supabase de la destinataria.

Después puede invitar a sus familiares desde **Integrantes**. No crear esas invitaciones desde el hogar original del operador.

## Verificación operativa

La primera alta real completó la creación, comprobó una única pertenencia con rol admin y aisló el hogar bajo RLS. No se consumió el enlace ni se inició sesión como la destinataria; la elección de contraseña y la primera entrada debe completarlas ella misma. Los datos personales y el recibo permanecen en archivos locales ignorados y en la base de datos, sin incluirse aquí.

No es necesario desplegar la web: el flujo existente de contraseña ya acepta estos enlaces. La segunda familia debe prepararse solo cuando haya aceptado participar y estén disponibles sus datos.
