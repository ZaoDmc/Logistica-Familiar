# Quitar categorías conservando los productos

Antes solo se podían agregar categorías. Ahora admin e integrantes pueden elegir **Quitar categoría** junto al nombre y confirmar. Si hay productos, deben seleccionar otra categoría del mismo hogar; los artículos, cantidades e historial se conservan. Una categoría vacía se puede quitar sin destino. Si la única categoría contiene productos, se pide crear otra primero.

La migración `202610230001_remove_category.sql` agrega una función con comprobación de pertenencia al hogar, bloqueo ordenado de categorías y traslado/eliminación atómicos. Bloquea destinos ajenos y evita borrar productos aunque se agreguen mientras está abierta la confirmación. Reintentar una categoría ya retirada no repite cambios. El cliente no recibe permisos de DELETE directo.

La interfaz conserva el tratamiento de operaciones pendientes y errores, limpia filtros que apuntaban a categorías retiradas y actualiza a los demás integrantes mediante Realtime y la recuperación periódica existente. DELETE se escucha sin filtro solo como invalidación; las consultas mantienen hogar y RLS.

## Validación

- Build y TypeScript correctos.
- SQL local y remoto: 63 pruebas de inventario, 27 de cuentas y 15 nuevas de categorías; pruebas remotas de concurrencia existentes correctas.
- Modelo: 28 comprobaciones; sincronización: 22; PWA: 44.
- Realtime real: 13 comprobaciones con cinco sesiones, incluyendo eliminación vacía y traslado sin pérdida de stock/historial.
- Vista móvil de 360 px: confirmar, seleccionar destino y cancelar como integrante temporal; claro y oscuro, sin desbordamiento horizontal.
- Migración aplicada en Supabase. Pruebas con datos sintéticos, sin modificar el hogar familiar.

Aplicar la migración antes de publicar la interfaz. La actualización llega por el aviso de nueva versión de la PWA; guardar operaciones pendientes antes de recargar. Las pruebas físicas en los teléfonos familiares siguen pendientes.
