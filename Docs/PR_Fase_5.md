La aplicación del hogar ahora está publicada en **https://logistica-familiar.vercel.app** y preparada como PWA: manifest, iconos de instalación y guía para Android/iPhone. La dirección pública está habilitada en Auth y en la función administrativa de Supabase, conservando desarrollo local y registro público cerrado.

El trabajador guarda únicamente archivos públicos compilados. Navegación, Auth, SQL y operaciones privadas usan la red; al fallar abrir la aplicación se muestra una página pública de conexión. Una nueva versión espera a que la persona termine su edición y pulse Recargar aplicación. Se comprueban actualizaciones al entrar, volver, reconectar y cada minuto visible.

La publicación inicial usa la API de Vercel para subir solo `dist`, verificándolo antes del envío. Incluye scripts para despliegue, estado, configuración de Supabase, preparación de builds desde Git y comprobación del sitio publicado. Los dos valores públicos de Supabase ya están configurados en Vercel; los secretos administrativos permanecen locales o en Supabase.

Validación:

- TypeScript y build correctos; 41 comprobaciones PWA, 40 HTTPS y las 21 de sincronización y 24 del modelo de inventario.
- Archivos publicados idénticos por SHA-256 al artefacto probado; HTML no-store, trabajador no-cache y assets immutable.
- Login, cambios de stock y Realtime en la URL pública con cuentas sintéticas.
- Dos versiones publicadas, aviso en dos pestañas y edición preservada; activación manual de la actualización comprobada.
- Fallback sin conexión verificado apagando el servidor de preview aislado.
- Sin secretos administrativos detectados en el bundle y sin datos reales modificados; fixtures eliminados.

La rama parte de fase 4 porque los PR anteriores siguen abiertos: integrar fases 3, 4 y 5 en orden. Conectar posteriormente el repositorio al proyecto existente en Vercel Settings → Git; iniciar sesión con GitHub no activa esa conexión. El build para Git está preparado con Node 24, Vite, npm ci y dist, pero no se presenta el despliegue automático como habilitado.

Las pruebas de instalación, datos móviles, modo avión y suspensión en los dos celulares físicos están pendientes y tienen una lista de verificación en `Docs/Fase_5_PWA_Publicacion.md`. La fase queda implementada y publicada con esa validación pendiente.
