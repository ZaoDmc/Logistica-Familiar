# Fase 4 — Sincronización del hogar

Estado: implementación completada el 21 de octubre de 2026. Rama: `feat/sincronizacion-hogar`. Las pruebas físicas en celulares se realizarán con la publicación HTTPS de fase 5.

## Funcionamiento para la familia

Al entrar al hogar aparece **Sincronización en vivo activa**. Cuando alguien agrega una categoría, crea un producto o cambia una cantidad, el resto recibe los datos automáticamente. El historial abierto incorpora el movimiento con su autor. No hay que pulsar Actualizar para cada cambio; el botón permanece disponible para consultar manualmente.

Si estabas escribiendo una cantidad, una actualización remota conserva tu edición. Si cambió la versión del producto, se indica la cantidad actual y se bloquea guardar la edición antigua. Pulsa **Usar cantidad actual**, revisa y vuelve a escribir el valor deseado.

Cuando el navegador informa que no tiene red, se conservan los últimos datos cargados en memoria y se bloquea la edición. No se pueden crear operaciones nuevas offline. Una operación enviada cuya respuesta se perdió mantiene el reintento de fase 3 con el mismo UUID.

Al recuperar red, volver desde segundo plano, recuperar foco o restaurar la página, la aplicación consulta nuevamente SQL. Los avisos Realtime no se guardan para reproducirse después: esta consulta recupera los cambios que ocurrieron durante la ausencia. Cerrar y abrir la aplicación sin Internet no garantiza acceso al inventario; no hay una caché privada persistente ni PWA todavía.

## Diseño técnico y permisos

- Migración `202610210004_inventory_realtime.sql`: añade `categories`, `products` y `stock_movements` a la publicación existente `supabase_realtime`, sin modificar RLS ni privilegios. Ya está aplicada en el proyecto configurado.
- Un canal por instancia del hogar escucha INSERT en esas tablas y UPDATE en productos, filtrando `household_id`. No se suscribe a eliminaciones: el sistema no ofrece borrado de inventario.
- Realtime comprueba los permisos SELECT del usuario. El filtro reduce tráfico; RLS sigue siendo la protección real. No se publican perfiles, invitaciones ni claves administrativas.
- Los avisos invalidan la lectura: el cliente consulta SQL con su sesión en vez de adoptar cantidades calculadas a partir del aviso. Las transacciones y auditoría de fases anteriores siguen siendo la autoridad.
- Se agrupan avisos durante 100 ms. Las lecturas se serializan; si llega un aviso durante una lectura, se realiza otra al terminar, evitando perder la invalidación.
- SUBSCRIBED dispara una reconciliación, incluso si no llegaron avisos. Los errores del canal o mensajes `system` de error muestran recuperación y programan un nuevo canal a los cinco segundos.
- Mientras la aplicación está visible y con red se consulta además cada 30 segundos. Es una recuperación adicional ante eventos perdidos, no una promesa de actualización en dos segundos durante un fallo de Realtime.
- Salir de la cuenta, cambiar de hogar o desmontar elimina canal, listeners y temporizadores. Las respuestas de lecturas antiguas no actualizan la instancia desmontada; una lectura iniciada antes de perder red tampoco habilita la edición mientras continúa offline.
- El historial conserva los registros visibles mientras reconsulta. Al actualizar muestra otra vez la primera página vigente; **Cargar más** permite recorrer el historial. No cambia silenciosamente el filtro seleccionado.

El indicador distingue el canal en vivo de la recuperación de conexión. Un canal conectado no confirma por sí solo que una lectura haya funcionado: los errores de consulta mantienen el bloqueo de edición hasta recuperar datos.

Fuentes oficiales: [Postgres Changes y RLS](https://supabase.com/docs/guides/realtime/postgres-changes), [diagnóstico de suscripciones y publicación](https://supabase.com/docs/guides/troubleshooting/realtime-postgres-changes-troubleshooting), [mensajes de sistema del protocolo](https://supabase.com/docs/guides/realtime/protocol).

## Qué debes configurar

En este proyecto no hace falta crear otra cuenta ni habilitar opciones manualmente: se aplicó la migración utilizando la conexión administrativa ya preparada. La web usa la misma URL y clave publishable que en fases anteriores; el canal usa la sesión de cada integrante.

En otro proyecto Supabase:

1. Configura las variables públicas y la conexión SQL siguiendo las fases 1 y 2.
2. Ejecuta `npm.cmd run db:migrate`.
3. Comprueba las tres tablas en la publicación `supabase_realtime` y ejecuta la prueba remota. La migración omite la publicación si no existe para permitir pruebas SQL con PGlite; la prueba remota exige que las tres tablas estén realmente publicadas. En una instalación Supabase sin esa publicación hay que habilitarla y añadir las tablas antes de dar Realtime por configurado.
4. Arranca con `npm.cmd run dev` y entra con tu cuenta. En este entorno seguimos usando localhost; Vercel, HTTPS y PWA corresponden a fase 5.

## Validación y límites de lo probado

- TypeScript y build de producción correctos.
- 21 comprobaciones automatizadas de coordinación, invalidación durante lecturas, suscripciones, recuperación, eventos online/offline, retorno/foco/restauración y eliminación de listeners y temporizadores. Los eventos de red y ciclo de página se simulan mediante un entorno inyectable.
- 90 comprobaciones SQL locales/remotas, más concurrencia con hasta cinco sesiones, sin modificar los datos reales.
- 24 comprobaciones del modelo de inventario de fase 3 siguen pasando.
- 10 comprobaciones Realtime reales: publicación, cinco clientes autenticados independientes usando las dos identidades autorizadas (admin e integrante), altas, stock, historial, concurrencia, liberación, reconexión y aislamiento de una tercera identidad ajena. Son cinco sesiones; no cinco integrantes distintos.
- Tres ejecuciones completas midieron 750–808 ms, 511–826 ms y 822–1.580 ms desde iniciar la escritura hasta recibir y consultar stock e historial en las cinco sesiones. El objetivo de dos segundos se cumplió en esas muestras con conexión estable; no es un SLA. El primer intento de integración no terminó correctamente y su error inicial no identificaba la etapa; se amplió el diagnóstico y el tiempo máximo de conexión a 30 segundos. Las tres repeticiones completas pasaron; la comprobación de latencia mantiene el límite de dos segundos.
- Navegador con integrante temporal: recibió incrementos de otra sesión sin recarga; conservó una cantidad sin guardar, detectó la nueva versión y actualizó el historial abierto. Sin errores de consola; diseño de 360 px sin desbordamiento horizontal.
- Hogares, productos y cuentas de prueba eliminados; no se modificó el hogar familiar.

El navegador de QA no ofrece emulación de red. La interrupción real se probó liberando y recreando una suscripción, recuperando por SQL lo ocurrido mientras estaba desconectada. Los cortes de Wi-Fi/datos y suspensión del sistema operativo en teléfonos físicos quedan por probar en fase 5; no se presentan como pruebas ya realizadas.

```powershell
npm.cmd run test:sync
npm.cmd run test:sync:remote
npm.cmd run test:inventory
npm.cmd run test:db
npm.cmd run test:db:remote
npm.cmd run build
```

La prueba remota necesita la conexión SQL y el token administrativo privados de las fases anteriores. Crea un hogar aislado, usa cuentas sintéticas y valida su identidad antes de eliminarlas. Para revisión visual: `npm.cmd run inventory:qa`; `node scripts/inventory-sync-qa.mjs` envía un incremento desde otra sesión únicamente al producto identificado del hogar temporal. Terminar con `npm.cmd run inventory:qa -- cleanup`.

## Entrega y siguiente fase

El PR de fase 4 parte de `feat/inventario-movil` porque el PR de fase 3 continúa abierto. Integrar primero fase 3; después revisar que la base del PR de fase 4 sea `main` y que su diff incluya solo la fase 4. No se fusionan automáticamente los PR.

La fase 5 permitirá compartir una URL HTTPS e instalar la web en el celular. Allí comprobaremos con ambos teléfonos reales cambios sin recarga, modo avión, retorno de datos móviles, bloqueo de pantalla y reanudación.

## Extensión: eliminación de categorías (23 de octubre de 2026)

El canal escucha también DELETE de categorías para que quitar una vacía se refleje sin esperar al sondeo de 30 segundos. Realtime no admite filtro de hogar para DELETE: el evento se usa únicamente como aviso para volver a consultar, sin leer ni mostrar su contenido. La lectura posterior conserva el filtro del hogar y RLS. El traslado de productos también genera los eventos UPDATE ya existentes. En reconexión se recupera el estado actual.

La prueba remota se amplió a 13 comprobaciones: en cinco sesiones independientes se verifican también la eliminación vacía, el traslado sin cambiar cantidades/versiones y la conservación del historial. La ejecución de esta mejora midió 666, 567 y 490 ms para las tres muestras de cambio de stock; no constituye una garantía de latencia. Los datos y cuentas temporales se eliminaron al terminar.
