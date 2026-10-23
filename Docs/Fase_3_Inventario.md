# Fase 3 — Inventario móvil

Esta guía describe la entrega de fase 3. La sincronización manual que se menciona aquí fue ampliada en [Fase 4 — Sincronización](Fase_4_Sincronizacion.md).

Estado: completada el 21 de octubre de 2026. Rama de entrega: `feat/inventario-movil`.

## Qué puedes hacer

Al entrar al hogar, la sección **Productos** muestra el inventario. Las secciones **Movimientos** e **Integrantes** conservan el historial y la administración de cuentas en lugares separados.

Tanto admin como integrante pueden:

1. Crear categorías con nombre e icono.
2. Agregar productos a una categoría con nombre, descripción de hasta 240 caracteres, icono y cantidad inicial.
3. Buscar por nombre, descripción o categoría. La búsqueda ignora tildes y mayúsculas y permite palabras en distinto orden.
4. Filtrar una categoría o activar **Por comprar**, que muestra cantidades iguales a cero.
5. Sumar o restar una unidad con los botones de cada tarjeta.
6. Escribir una cantidad completa y pulsar **Guardar cantidad**.
7. Revisar movimientos de un producto o de todo el hogar.

## Primer uso

```powershell
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run dev
```

En el proyecto de Supabase de este chat la migración nueva ya está aplicada. Repetir el comando reconoce las migraciones existentes sin duplicarlas. La conexión y las cuentas de la fase 2 siguen vigentes.

1. Entra al hogar.
2. Si está vacío, pulsa **Crear primera categoría**.
3. Elige un nombre como «Alimentos», «Aseo» o «Mascotas» y un icono del catálogo.
4. Pulsa **Agregar producto**. Por ejemplo, «Comida del Logan Cannes», descripción «Bolsas de alimento», cantidad inicial 1.
5. Cuando consumas o compres, actualiza el número desde su tarjeta.

Los datos de demostración usados para validar la interfaz se crearon en hogares temporales. No se agregaron productos a tu hogar real.

## Cantidades e historial

Las cantidades son enteros entre 0 y 1.000.000. Representan unidades, envases o paquetes completos. No hay fracciones ni conversiones en esta fase.

- Los botones envían un delta de +1 o −1 mediante `change_stock`. No calculan un total con una copia antigua del stock.
- La casilla conserva la versión que estabas viendo cuando comenzaste a editar. Si otra sesión cambió el producto, el servidor responde un conflicto y la interfaz recupera el stock actual.
- **Usar cantidad actual** descarta la edición y adopta el valor recuperado. Después puedes escribir una nueva cantidad revisada.
- No se muestra un cambio como guardado antes de la respuesta del servidor.
- Cada cantidad confirmada, incluida la inicial cero, genera un movimiento con autor, nombre del producto, valor anterior, valor nuevo y fecha del servidor.
- El historial es de solo lectura para ambos roles. Se muestran veinte movimientos por página, con **Cargar más movimientos**.

La paginación usa fecha e ID como cursor, para no depender de posiciones que pueden desplazarse cuando aparecen nuevos registros. Las consultas de categorías y productos también recorren páginas, evitando truncar silenciosamente el inventario al límite de la API.

## Conexión y reintentos

**Actualizar** consulta el inventario vigente. La interfaz muestra la hora de la última actualización. La recepción automática de cambios de otros dispositivos se implementará en fase 4; no hay todavía una suscripción Realtime ni sondeo periódico.

Si el navegador informa que está sin conexión, se bloquean las altas y cambios de stock. Al reconectarse se consulta de nuevo la base antes de habilitar cambios. No hay una cola para crear operaciones sin conexión.

Si una operación ya enviada pierde su respuesta:

- Queda como **operación por confirmar** y bloquea nuevas escrituras de inventario en esa pestaña.
- **Reintentar operación** conserva los datos y el UUID original para altas de productos y cambios de stock. La función SQL reconoce ese UUID y no vuelve a aplicar el movimiento.
- El intento se guarda en `sessionStorage`, separado por usuario y hogar, para conservarlo si se recarga la misma pestaña. No contiene contraseñas ni tokens de sesión. Si el almacenamiento está bloqueado, se conserva en memoria mientras la pantalla permanezca abierta.
- No cerrar la pestaña mientras se confirma un cambio. Si se cierra por completo, consultar el historial y el stock antes de decidir una nueva operación; `sessionStorage` no es un registro permanente.
- Las categorías usan la restricción de nombre único del hogar. Si se pierde una respuesta y el reintento devuelve «ya existe», actualizar permite ver la categoría creada; no se genera otra con el mismo nombre.
- Los errores definitivos de permisos, validación o conflicto liberan el intento y actualizan el inventario. Si falla una lectura posterior a un guardado confirmado, se bloquean nuevas escrituras hasta recuperar una lectura actualizada.

Los reintentos automáticos del cliente PostgREST están deshabilitados. Las consultas tienen un límite de quince segundos y los reintentos de escritura son explícitos desde la interfaz.

## Ajuste de la función SQL

La migración `202610210003_stock_conflict_http.sql` conserva la operación transaccional de stock, sus permisos y el historial. Cambia la señal de versión obsoleta a SQLSTATE **PT409**, que PostgREST devuelve como **HTTP 409**.

El código anterior `40001` corresponde a un fallo de serialización de PostgreSQL y puede activar reintentos internos de PostgREST. No es adecuado para una edición humana basada en un stock antiguo. La prueba por HTTP detectó ese comportamiento y se añadió esta migración sin editar las anteriores.

Referencias oficiales: [Supabase: reintentos con SQLSTATE 40001](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b), [errores HTTP personalizados en PostgREST](https://docs.postgrest.org/en/latest/references/errors.html), [límite de tiempo por consulta](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).

## Interfaz y archivos

- `src/components/inventory/Inventory.tsx`: vistas, filtros y estado del inventario.
- `InventoryForms.tsx`: categorías, productos y selector de ocho iconos.
- `ProductCard.tsx`: cantidades, confirmación y conflicto de versión.
- `MovementHistory.tsx`: historial por hogar/producto y paginación.
- `src/hooks/useInventory.ts`: lecturas, bloqueo de escrituras y reintentos.
- `src/lib/inventory-api.ts`: consultas y operaciones a Supabase.
- `src/lib/inventory-model.ts`: tipos, búsqueda y validación de cantidades/intentos.

Se reutiliza la paleta de fase 2 y sus temas. Los botones y controles táctiles tienen al menos 44 px. Hay estados de carga, hogar/categorías vacíos, búsqueda sin resultados, error, conexión perdida y operación pendiente. Los iconos tienen etiquetas y los controles de stock identifican el producto para lectores de pantalla.

## Validación

- TypeScript y compilación de producción correctos.
- 24 comprobaciones locales de búsqueda, cantidades y validación de intentos persistidos.
- 90 comprobaciones SQL locales y remotas: inventario, cuentas, roles e historial.
- Concurrencia SQL: hasta cinco sesiones, sin pérdida de incrementos ni cantidades negativas.
- 21 comprobaciones HTTP con usuarios admin e integrante reales: altas, iconos/descripciones, permisos, reintentos, edición absoluta, conflicto HTTP 409 y paginación del historial.
- Navegador con integrante real de prueba: crear categoría/producto, elegir icono, sumar, editar cantidad, detectar un cambio de otra sesión, consultar historial, buscar por descripción y combinar filtros.
- Diseño a 360 px sin desplazamiento horizontal y sin botones visibles de menos de 44 px, con los temas claro y oscuro.
- Las pruebas físicas de pérdida de red y segundo plano se amplían en fase 4. Los celulares reales y la URL pública se validan en fase 5.
- Cuentas, productos y hogares temporales eliminados; no se modificó el inventario familiar.

```powershell
npm.cmd run test:inventory
npm.cmd run test:db
npm.cmd run test:db:remote
npm.cmd run test:inventory:remote
npm.cmd run build
```

Para una revisión visual aislada, `npm.cmd run inventory:qa` prepara hogares y cuentas sintéticas y guarda sus datos en `.inventory-qa.local`, excluido de Git. Al terminar, ejecutar `npm.cmd run inventory:qa -- cleanup`. La limpieza valida que se trate exclusivamente de los hogares y cuentas de prueba identificados.

## Pendientes de las siguientes fases

Fase 4: recibir cambios automáticamente entre dispositivos, recuperar estado al volver a la aplicación y probar cortes reales de red. Fase 5: publicación HTTPS y PWA instalable. La edición de categorías y el borrado de productos, el stock mínimo configurable y las notificaciones push continúan fuera de este alcance. Quitar categorías se añadió en la mejora del 23 de octubre de 2026, descrita abajo.

## Mejora del 23 de octubre de 2026: quitar categorías

Admin e integrantes disponen de **Quitar categoría** junto a cada nombre. La pantalla pide confirmación. Si contiene productos, exige elegir otra categoría del mismo hogar para trasladarlos sin alterar cantidades, versiones de stock ni movimientos. Si es la única categoría y tiene productos, primero hay que crear un destino. Una categoría vacía se puede quitar directamente, incluso si es la última.

La función SQL `remove_category` aplica traslado y eliminación en una transacción y comprueba el hogar autenticado. Los reintentos de la misma categoría ya retirada son seguros. Si alguien agrega un producto mientras la confirmación sigue abierta, el servidor exige un destino; no borra productos. La eliminación no ofrece deshacer: se puede volver a crear una categoría y reorganizar después, pero no se recupera el UUID anterior.

La migración `202610230001_remove_category.sql` debe aplicarse antes de publicar la interfaz: `npm.cmd run db:migrate`. Las tablas no conceden borrado directo al navegador. La operación usa el mismo bloqueo de interfaz, recuperación de errores y reintentos pendientes que el resto del inventario. Un filtro que apuntaba a una categoría retirada vuelve automáticamente a todas las categorías.

Validación adicional: 15 pruebas SQL locales y en Supabase para permisos, destinos ajenos, conservación de stock/historial, reintento y categorías vacías; 28 comprobaciones del modelo; 22 de sincronización. Se revisó la confirmación, selección de destino y cancelación como integrante temporal en claro/oscuro a 360 px, sin desbordamiento horizontal. No se usó el hogar familiar.
