# Fase 5 — PWA y publicación HTTPS

Estado al 22 de octubre de 2026: **implementada y publicada; pendiente la validación en los celulares físicos**. Rama: `feat/pwa-publicacion`.

Aplicación: **https://logistica-familiar.vercel.app**

## Cómo usarla e instalarla

La web y Supabase funcionan sin mantener encendido el computador. Usa las mismas cuentas de la aplicación; cada integrante sigue necesitando su invitación. Tener una cuenta en GitHub, Vercel o Supabase no crea una cuenta de integrante.

1. Abre la dirección HTTPS en el celular y entra a tu hogar.
2. Android: menú del navegador → **Instalar aplicación** o **Agregar a pantalla de inicio**, según el navegador. Si el navegador ofrece la instalación a la página, aparece también **Instalar Mi hogar** dentro de la guía de instalación.
3. iPhone: abre la dirección en Safari → **Compartir** → **Añadir a pantalla de inicio**.
4. El icono aparece como **Mi hogar** y abre la aplicación en su propia ventana cuando el navegador admite el modo standalone.

La disponibilidad del aviso y el nombre del menú dependen del navegador. El navegador integrado usado para QA no ofrece instalación nativa; no se presenta esa instalación como una prueba realizada.

## Conexión, privacidad y actualizaciones

- El manifest define identidad estable, alcance raíz, modo standalone, colores e iconos PNG de 192 y 512 px. Incluye icono maskable y Apple de 180 px, generados con la paleta de la aplicación.
- El service worker se genera solo en el build de producción y se registra en un contexto seguro. No se instala durante `npm run dev`.
- La caché contiene exclusivamente JS/CSS compilados, iconos, manifest y una página pública sin conexión. Se construye una lista explícita de archivos permitidos; no se guardan index.html, navegación con parámetros ni respuestas de Supabase, Auth, SQL, funciones o escrituras.
- HTML se consulta por red con `no-store`. Si falla abrir la aplicación, aparece **Tu hogar te espera**, sin información del hogar, con un enlace para reintentar. Si la aplicación ya está abierta, se mantiene el bloqueo de edición offline de fase 4.
- La sesión de Supabase mantiene su persistencia normal en el dispositivo, como antes. Excluir Auth de la caché del trabajador no significa eliminar esa sesión al cerrar la aplicación.
- La versión de caché depende del contenido compilado, archivos públicos y trabajador. Una nueva versión espera y muestra **Hay una versión nueva**; no recarga por sí sola. Termina la edición y confirma operaciones pendientes antes de pulsar **Recargar aplicación**.
- Se comprueban actualizaciones al entrar, recuperar red, volver a la aplicación y cada minuto mientras está visible y con conexión. El trabajador instalado se revalida sin caché HTTP. Otros dispositivos deben abrir o mantener visible la aplicación con conexión para detectar la actualización.
- Activar una actualización limpia solo cachés públicas antiguas de esta aplicación. No elimina otros almacenamientos del navegador ni datos de SQL.

La PWA no implementa escritura offline ni un inventario persistente para lectura sin red. Tampoco genera un APK ni necesita una tienda.

Referencias: [manifest e iconos](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/icons), [ciclo de los service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers).

## Servicios y configuración aplicada

| Servicio | Función | Estado |
| --- | --- | --- |
| Vercel, equipo ZaoDmc team, Hobby | Web estática y HTTPS | Proyecto `logistica-familiar` publicado |
| Supabase existente | PostgreSQL, Auth, Realtime y administración | URL pública habilitada, localhost conservado |
| GitHub | Historial de código y revisión por PR | Rama de fase 5; conexión automática del proyecto a Git pendiente |

Se publicó el artefacto compilado y probado de `dist/`, sin subir fuentes privadas ni archivos `.env`. Los scripts usan la API de Vercel; no hace falta instalar su CLI. Este primer despliegue fue directo: **un commit o push a GitHub todavía no publica automáticamente la aplicación**.

En Supabase se configuraron `site_url` y la lista de redirecciones con `https://logistica-familiar.vercel.app`. La función `household-admin` permite ese origen exacto mediante `APP_ORIGINS`; los orígenes locales se conservan. El script actualiza también la configuración local privada para que un futuro `auth:deploy` no quite producción. El registro público permanece cerrado y no se configuró SMTP.

Cabeceras verificadas: HTML `no-store`, `sw.js` `no-cache`, assets con hash `immutable`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff` y `X-Frame-Options: DENY`. Los enlaces privados de invitación siguen usando el fragmento de la URL.

Vercel está preparado para builds de Git con Vite, Node **24.x**, `npm ci`, `npm run build` y salida `dist`. El entorno local utiliza Node 26; el código y las dependencias admiten Node 24. El proveedor rechazó configurar Node 26 en este proyecto, por lo que se seleccionó su versión admitida 24.x.

Solo se copiaron estas variables públicas a Vercel:

```dotenv
VITE_SUPABASE_URL=URL_HTTPS_DEL_PROYECTO
VITE_SUPABASE_PUBLISHABLE_KEY=CLAVE_PUBLICA
```

El build falla si faltan o si se intenta utilizar una clave administrativa en lugar de una clave publishable/anon.

## Credenciales y publicación posterior

Las credenciales administrativas permanecen en archivos privados ignorados por Git. El token de Vercel y el de Supabase pertenecen a proveedores distintos y no son intercambiables.

| Archivo local privado | Contenido y uso |
| --- | --- |
| `.env.vercel.local` | `VERCEL_TOKEN` creado en Vercel; `VERCEL_TEAM_ID` opcional si hay varios equipos |
| `.env.supabase.local` | Token administrativo de Supabase y `APP_ORIGINS` para su función |
| `.env.database.local`, `pass.txt` | Conexión administrativa SQL de fases anteriores |
| `.env.admin.local` | Primera cuenta administrativa de la aplicación |
| `.vercel/project.json` | Identificadores del proyecto/equipo, sin tokens |
| `.vercel/deployment.json` | Último despliegue y estado, sin tokens |

Si el token de Vercel expira, crea uno nuevo para el mismo equipo y reemplaza únicamente su valor en `.env.vercel.local`. La aplicación publicada no depende de que ese token permanezca vigente.

Para publicar una nueva versión desde este equipo:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run test:pwa
npm.cmd run web:deploy
npm.cmd run web:status
npm.cmd run test:web:remote -- https://logistica-familiar.vercel.app
```

`web:deploy` comprueba el artefacto antes de enviarlo, selecciona el equipo, conserva los identificadores locales y evita repetir un despliegue del mismo artefacto cuando lo encuentra entre los últimos veinte. Si la respuesta al crear se interrumpe, consulta primero `web:status` y los despliegues del proyecto antes de reintentar. No se presenta esta prevención como una garantía transaccional del proveedor.

Si hay varios equipos, define `VERCEL_TEAM_ID` explícitamente. En una copia nueva del repositorio, conserva o reconstruye `.vercel/project.json` apuntando al proyecto existente:

```json
{
  "projectId": "prj_4L6fc229xoTS3XoefPqPtBkGpmbO",
  "orgId": "team_0s9RRm1OB75fxp02OWqZjwp2",
  "projectName": "logistica-familiar"
}
```

Estos identificadores no autorizan acceso; el token sí. El script no adopta por nombre un proyecto ajeno sin un vínculo explícito.

Para reconstruir la configuración de la URL pública:

```powershell
npm.cmd run web:configure -- https://logistica-familiar.vercel.app
npm.cmd run web:prepare-git
```

El despliegue estático directo incluye un `vercel.json` propio con instalación y compilación desactivadas y salida en el directorio raíz del artefacto. Es necesario porque los ajustes `npm ci` / `dist` del proyecto para Git no corresponden a unos archivos ya compilados. El `vercel.json` versionado en el repositorio conserva la configuración Vite para fuentes. `web:prepare-git` permite reconstruir los ajustes del proyecto para un futuro build desde Git; no activa por sí mismo la conexión con GitHub.

Referencias: [despliegues por API](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), [variables del proyecto](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables).

## Conectar GitHub al proyecto existente

Vincular GitHub como método de inicio de sesión no importa automáticamente el repositorio. La aplicación ya está publicada en el proyecto existente; no hay que crear otro proyecto para añadir Git.

1. Integra primero los PR de fases 3, 4 y 5, en ese orden. El `main` remoto consultado al iniciar esta entrega todavía contenía fase 2; conectar y publicar ese estado reduciría las funciones disponibles respecto de la web actual.
2. En Vercel abre `logistica-familiar` → **Settings → Git** y conecta `ZaoDmc/Logistica-Familiar`. Si GitHub pide autorizar su integración, concede acceso al repositorio correspondiente desde tu cuenta.
3. Selecciona `main` como rama de producción. Mantén las dos variables públicas y el build ya preparado.
4. Comprueba el primer build de Git y su URL de producción. A partir de entonces, verifica que los pushes a la rama de producción generen despliegues correctos.

La conexión efectiva y su primer despliegue automático siguen pendientes al cerrar esta entrega. Se incluyen estos pasos sin afirmar que la vinculación de la cuenta realizada por el usuario ya conectó el repositorio al proyecto.

Referencia: [Vercel para GitHub](https://vercel.com/docs/git/vercel-for-github).

## Validaciones realizadas

- TypeScript y build de producción correctos.
- **41 comprobaciones PWA** sobre el trabajador generado: archivos reales de caché, ausencia de navegación y respuestas privadas, tratamiento de GET/POST y orígenes ajenos, fallback offline, activación explícita, limpieza de cachés, manifest e iconos con dimensiones reales.
- Búsqueda de firmas de secretos y JWT `service_role`, además de comparación con las credenciales locales disponibles, sin imprimir valores. Ninguna apareció en el artefacto. Git solo incluye `.env.example` entre los archivos de entorno.
- **40 comprobaciones HTTPS** del despliegue final: cada archivo de `dist` responde 200 y coincide por SHA-256, cabeceras de caché, URL Auth, registro público cerrado, CORS correcto del origen de producción y rechazo de uno ajeno.
- Las **21 pruebas de sincronización** y **24 del modelo de inventario** siguen pasando. No hubo cambios SQL ni se volvieron a alterar migraciones aplicadas.
- Navegador en producción con integrante sintético: login, inventario, canal en vivo, incremento de otra sesión recibido sin recarga, incremento desde la web confirmado y logout.
- Dos publicaciones HTTPS reales: ambas pestañas recibieron el aviso de la segunda versión; una cantidad escrita se conservó sin recarga automática. Después de descartar esa edición de prueba, se activó la nueva versión mediante el botón y se recargaron ambas pestañas.
- Prueba offline real aislada: tras instalar el trabajador en un preview local, se apagó su servidor. Al recargar apareció la pantalla pública sin conexión. Esto comprueba el fallo del origen; no equivale a una prueba de modo avión ni suspensión de un teléfono.
- Presentación de escritorio sin desbordamiento horizontal y sin errores de consola. La redimensión solicitada a 360 px no se aplicó efectivamente en este navegador de QA; no se cuenta como una nueva validación móvil de esta fase.
- Hogares y cuentas temporales eliminados; no se modificó el inventario real.

## Prueba familiar pendiente para cerrar la fase

En **ambos celulares**:

- [ ] Desactiva Wi-Fi y abre la URL usando datos móviles.
- [ ] Entra con cada cuenta de la aplicación; instala desde el menú descrito y abre su icono.
- [ ] Cambia una cantidad en un teléfono y verifica el cambio y el historial en el otro.
- [ ] Activa modo avión con la aplicación abierta y comprueba el bloqueo de edición. Recupera la conexión y comprueba que se actualiza.
- [ ] Cierra y abre sin red; comprueba la pantalla de conexión, sin un inventario presentado como actualizado.
- [ ] Bloquea la pantalla o cambia de aplicación, realiza un cambio desde el otro teléfono y verifica el estado al volver.
- [ ] En una publicación posterior, confirma el aviso de actualización en ambos dispositivos, guarda antes de recargar y vuelve a abrir el icono.

Hasta contar con estos resultados, se considera completada la implementación y publicación, con la validación física pendiente. La fase 6 añadirá la validación familiar de uso, copias y recuperación operativa.
