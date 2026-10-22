# Plan de implementación

Fecha de consulta de proveedores: 21 de octubre de 2026.

## Recomendación y funcionamiento

Una **web instalable (PWA)** permite usar el mismo sistema desde Android, iPhone o computador mediante una dirección HTTPS. Se agregará a la pantalla de inicio cuando implementemos la fase PWA. No exige publicar en una tienda ni distribuir APK para cada actualización.

La web se alojará en Vercel y hablará con Supabase mediante una sesión autenticada. Supabase proporciona PostgreSQL (SQL), autenticación y eventos Realtime. El navegador nunca se conectará directamente al puerto de PostgreSQL. Las reglas de acceso se aplicarán en la base, no solamente ocultando botones.

Flujo previsto:

1. El admin añade un integrante mediante una operación de servidor que verifica su rol.
2. Cada persona entra con su propia cuenta y ve los productos del hogar agrupados por categoría.
3. Un toque en + o − envía una operación al servidor. Una transacción actualiza el stock y escribe el historial.
4. Los demás clientes reciben el evento autorizado y consultan el estado actualizado. Al reconectarse recuperan los cambios perdidos.
5. La vista «Por comprar» muestra inicialmente productos con stock cero. Un umbral mínimo será una mejora opcional.

## Alojamiento

| Alternativa | Componentes | Ventajas | Condiciones |
| --- | --- | --- | --- |
| Recomendada | Vercel Hobby + Supabase Free | Web HTTPS, SQL administrado, autenticación y sincronización; no depende del PC | Vercel Hobby es para uso personal no comercial. Supabase puede pausar proyectos de baja actividad durante 7 días; no garantiza disponibilidad continua gratuita |
| Alternativa local | Web y API en el PC + PostgreSQL local | Control del servidor y datos | Hay que instalar/configurar servidor, autenticación y sincronización; depende del PC, electricidad y conexión |

Supabase Free anuncia 500 MB de base de datos y 200 conexiones Realtime máximas simultáneas. Por capacidad, parece suficiente para cinco personas con inventario textual e iconos predefinidos; no equivale a una garantía de disponibilidad ni elimina otros límites de uso. Revisar cuotas al desplegar y medir el crecimiento del historial. No se contratará un plan de pago automáticamente.

Fuentes oficiales: [planes Supabase](https://supabase.com/docs/guides/platform/billing-on-supabase), [pausas por inactividad](https://supabase.com/docs/guides/platform/free-project-pausing), [Vercel Hobby](https://vercel.com/docs/plans/hobby).

### Si se usa el computador como servidor

En casa se accede por la red local. Desde el supermercado será necesario un acceso remoto HTTPS (túnel autenticado o VPN) que se seleccionará y verificará en esa fase. No basta con encender Apache o abrir localhost. No exponer el puerto de la base de datos a Internet. Será necesario arrancar los servicios, evitar suspensión del PC y mantener copias de seguridad.

La ubicación actual dentro de XAMPP no obliga a usar PHP ni MariaDB. Esta base usa Node para desarrollo. Cambiar a PHP/MariaDB sería una decisión de arquitectura y requeriría adaptar API, autenticación, SQL y sincronización. Autoalojar todo Supabase también exige infraestructura adicional; no es una conmutación automática de esta base.

## Qué debes preparar

**Para trabajar localmente ahora:** Node y npm. Ya se detectaron Node 26.8.1 y npm 11.19.0. No necesitas cuentas externas para abrir la base inicial.

**Antes de la fase 1:**

1. Crear una cuenta personal en [Supabase](https://supabase.com/) y un proyecto Free; elegir una región cercana disponible. Guardar la contraseña de PostgreSQL en un gestor de contraseñas.
2. Obtener la URL del proyecto y la clave **publishable** para la web. Copiarlas a `.env.local` según `.env.example` cuando se implemente la conexión.
3. Mantener claves secretas y `service_role` únicamente en el servidor/secretos de funciones. Nunca ponerlas en variables `VITE_*`, Git ni el chat.
4. Para aplicar SQL, preparar la conexión administrativa según [guía de fase 1](Fase_1_SQL.md). Las migraciones y su validación RLS son entregables de la fase 1, no requisitos que debas implementar previamente.

**Antes de la fase 2:**

1. Habilitar correo/contraseña en Auth y deshabilitar registro público.
2. Configurar Site URL y URLs de redirección exactas para desarrollo y producción.
3. Crear la primera cuenta admin por un procedimiento controlado. El rol se guarda en la pertenencia al hogar; no se acepta un rol elegido por el navegador. Completado en fase 2.
4. Para invitaciones y recuperación por correo reales, configurar SMTP externo. El envío predeterminado de Supabase tiene restricciones y no debe asumirse listo para enviar a familiares. En fase 2 se implementaron enlaces privados compartidos manualmente para alta y recuperación; SMTP queda pospuesto y no se simula ningún correo enviado.

**Antes de las fases 4 y 5:**

1. Habilitar en la publicación de Realtime las tablas necesarias, manteniendo políticas de lectura por hogar.
2. Crear cuentas personales en [GitHub](https://github.com/) y [Vercel](https://vercel.com/) para el flujo propuesto de despliegue.
3. Crear un repositorio privado y conectar Vercel; usar build `npm run build` y salida `dist`.
4. Configurar las variables públicas del cliente en Vercel y secretos de funciones exclusivamente en Supabase. Actualizar las URLs de Auth con la URL HTTPS final.

No se necesita Firebase para esta propuesta. Cada integrante necesita una cuenta en la aplicación; no una cuenta administrativa en los proveedores.

Referencias: [Auth y configuración](https://supabase.com/docs/guides/auth/general-configuration), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [usuarios e invitaciones desde servidor](https://supabase.com/docs/guides/auth/users), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Modelo de datos previsto

| Tabla | Contenido principal |
| --- | --- |
| `auth.users` | Identidad administrada por Supabase; no crear una tabla de contraseñas propia |
| `profiles` | ID de usuario y nombre visible |
| `households` | ID y nombre del hogar |
| `household_members` | Hogar, usuario y rol `admin`/`integrante`; combinación única |
| `categories` | Hogar, nombre, identificador de icono y autor |
| `products` | Hogar, categoría, nombre, descripción, icono, stock, versión y fechas |
| `stock_movements` | Hogar, producto, actor, stock anterior/nuevo, diferencia, fecha y clave de operación |
| `household_invitations` | Alta pendiente, hogar, correo, autor, expiración y estado; acceso restringido |

Cada entidad compartida tendrá `household_id`. Una categoría debe pertenecer al mismo hogar que su producto. El catálogo de iconos será una lista de identificadores permitidos, sin subir archivos. El historial será de solo lectura para clientes. Si posteriormente se permite eliminar productos, se archivarán para conservar el historial.

### Consistencia del stock

- La operación de ajuste recibe un delta (+1/−1), no un total calculado sobre una copia antigua del navegador.
- Una función SQL transaccional bloquea la fila, comprueba pertenencia y stock no negativo, actualiza y registra el movimiento. El actor se obtiene de la sesión y la hora del servidor.
- Cada operación usa un identificador único, para que un reintento no duplique el cambio.
- Para escribir una cantidad absoluta en la casilla se comprueba la versión leída; si cambió, se pide refrescar/confirmar el nuevo estado.
- No permitir escrituras directas de stock que eviten el historial. El stock inicial distinto de cero también genera un movimiento.
- Si falla la transacción no cambia ni el stock ni el historial. La interfaz no muestra un cambio como confirmado antes de que el servidor lo acepte.

## Fases y seguimiento

Los criterios deben verificarse antes de marcar una fase terminada. El porcentaje se calculará por fases cerradas, sin presentar una maqueta como una función operativa.

### Fase 0 — Documentación y entorno (preparada)

- [x] Instrucciones base y decisiones propuestas.
- [x] Arquitectura, alojamiento y requisitos de cuentas documentados.
- [x] Base local React + TypeScript + Vite y catálogo inicial de iconos.
- [x] Ejemplo de variables y estructura para futuras migraciones.
- [x] Supabase seleccionado y proyecto accesible con URL y clave publishable; Vercel se configurará al publicar.

Cierre técnico verificado el 21 de octubre de 2026: dependencias instaladas, `npm run build` ejecutado con comprobación TypeScript y generación de `dist` correctas. La pantalla inicial informa que las funciones del hogar todavía no están implementadas. No se ha realizado validación visual en navegador ni pruebas en celulares; se realizarán con las funciones correspondientes.

### Fase 1 — SQL y permisos (completada)

Entregables: migraciones, restricciones, RLS, funciones de stock e historial, datos de ejemplo de desarrollo y procedimiento de creación del hogar.

Verificado el 21 de octubre de 2026: migración `202610210001` aplicada en Supabase con TLS verificado; reejecución sin cambios; 63 comprobaciones SQL correctas tanto locales como remotas. Pruebas con hasta cinco sesiones verifican incrementos simultáneos, reintentos, conflictos de versión y límites no negativos. Datos temporales eliminados. La compilación web y TypeScript también pasan. Pasos, comandos y contrato en [Fase 1 — SQL](Fase_1_SQL.md).

Criterio: usuario ajeno y usuario anónimo no acceden al hogar; no es posible alterar roles ni historial desde el cliente. Dos ajustes simultáneos conservan ambos cambios; reintentos no duplican operaciones; no hay stock negativo.

### Fase 2 — Cuentas e integrantes (completada)

Entregables: login, logout, sesión, recuperación y panel del admin para añadir integrantes; alta autorizada mediante función de servidor. La función comprueba identidad y rol antes de usar privilegios de Auth. Definir expiración, reintentos y revocación de invitaciones.

Verificado el 21 de octubre de 2026: migración `202610210002` aplicada y función Edge `household-admin` activa. Primera cuenta admin y hogar creados. Registro público cerrado; alta y recuperación por enlaces compartidos manualmente, sin SMTP. Pruebas SQL locales/remotas: 90 correctas; Auth/HTTP reales: 37 correctas, además de las pruebas de concurrencia. Acceso admin y sesión verificados en navegador. Detalles en [Fase 2 — Cuentas](Fase_2_Cuentas.md).

Mejora de apariencia solicitada: paleta semántica centralizada y tema claro, oscuro o automático con preferencia persistente. Comprobado a 360 px y escritorio; las pruebas en celulares físicos y publicación siguen en fase 5.

Criterio: admin e integrante entran con cuentas distintas. Solo admin puede añadir integrantes, incluso intentando invocar directamente la API. El alta queda asociada al hogar correcto.

### Fase 3 — Inventario móvil (completada)

Entregables: categorías, creación de productos, selector de iconos, descripción breve, búsqueda/filtro, casilla numérica, +/− e historial visible. Pantallas para vacío, carga y errores.

Verificado el 21 de octubre de 2026: inventario para ambos roles, reintentos con UUID conservado, historial paginado y conflicto de cantidades mediante HTTP 409. Migración `202610210003` aplicada. Pasaron 24 pruebas de modelo, 90 comprobaciones SQL locales/remotas y 21 pruebas HTTP de inventario, además de concurrencia con cinco sesiones. Interfaz verificada a 360 px, con los temas existentes. Uso y límites en [Fase 3 — Inventario](Fase_3_Inventario.md). La sincronización automática se mantiene para fase 4.

Criterio: ambos roles agregan productos y categorías y cambian cantidades. Se usa cómodamente a 360 px de ancho, sin desplazamiento horizontal, con controles táctiles de al menos 44 px y etiquetas accesibles.

### Fase 4 — Sincronización (implementada; validación física pendiente en fase 5)

Entregables: suscripciones autorizadas, indicador de conexión, recuperación al volver a la aplicación y actualización del historial. Desactivar edición sin conexión. Liberar suscripciones al salir.

Implementado el 21 de octubre de 2026: migración `202610210004` aplicada, canales por hogar con RLS, reconciliación al conectar/volver, recuperación ante errores y consulta adicional cada 30 segundos visibles. Pasan 21 pruebas de sincronización/ciclo simulado, 10 comprobaciones Realtime con cinco sesiones, 90 SQL locales/remotas y 24 de inventario. Muestras de escritura, aviso y lectura de 511–1.580 ms. Navegador a 360 px verifica actualización automática, edición preservada e historial. Cortes físicos de red y suspensión en ambos celulares se validarán con HTTPS en fase 5. Detalles en [Fase 4 — Sincronización](Fase_4_Sincronizacion.md).

Criterio: cambio visible en otro celular sin recarga (objetivo de prueba: hasta 2 segundos con conexión estable, no SLA). Probar cinco sesiones, cambios simultáneos, pérdida de conexión y retorno desde segundo plano; reconciliar con la base al reconectar.

### Fase 5 — PWA y publicación (implementada y publicada; validación física pendiente)

Entregables: manifest, iconos instalables, estrategia de actualización/caché y despliegue HTTPS. Evitar almacenar respuestas privadas de Auth/API en caché compartida. La PWA será instalable; eso no significa que pueda escribir stock offline.

Publicado el 22 de octubre de 2026 en **https://logistica-familiar.vercel.app**, Vercel Hobby. Supabase permite ese origen para Auth y administración. Pasan build/TypeScript, 41 comprobaciones PWA y 40 HTTPS; dos publicaciones verifican el aviso de actualización en dos pestañas y la conservación de una edición. Un preview apagado verifica el fallback offline real. La instalación, datos móviles, cortes y suspensión en los dos celulares siguen pendientes; el checklist está en [Fase 5 — PWA y publicación](Fase_5_PWA_Publicacion.md). El despliegue actual es directo desde el artefacto probado. La configuración de build y variables públicas está preparada para GitHub; la conexión efectiva del repositorio y la prueba de publicación automática quedan pendientes, después de integrar los PR de fases 3, 4 y 5.

Criterio: abrir URL desde datos móviles fuera de casa; probar añadir a pantalla de inicio en los celulares reales y volver a iniciar sesión. No hay claves privilegiadas en el bundle. Una actualización publicada llega a ambos dispositivos.

### Fase 6 — Validación familiar y operación (pendiente; depende de 5)

Entregables: pruebas con productos reales, guía para integrantes/admin, exportación y restauración probada de PostgreSQL, procedimiento ante pausa del proveedor y control de cuotas.

Criterio: ambos usuarios completan compra/consumo y revisan historial. Recuperar una copia en un entorno separado. Documentar custodia de copias y recuperación de acceso; la exportación SQL no sustituye por sí sola un plan de recuperación de Auth.

## Fuera del MVP

APK nativa, publicación en tiendas, códigos de barras, precios, múltiples hogares en la interfaz, fracciones, fotos, pedidos automáticos, notificaciones push y edición offline. Se evaluarán después del uso familiar inicial.
