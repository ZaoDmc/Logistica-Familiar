# Eliminar productos y mostrar la compra mínima en Reposición

Las categorías solo permitían agregar productos. Ahora admin e integrantes tienen **Eliminar producto**, con confirmación y foco inicial en Cancelar. La baja retira el artículo de las listas y contadores, conserva el stock final y todos sus movimientos y permite quitar después su categoría si quedó vacía.

Cada tarjeta de Reposición muestra **Hay que comprar: N**, calculado como `max(0, riesgo + 1 - stock)`. Con 4 huevos y límite 12, indica 9, porque se necesita llegar a 13 para quedar Disponible. El subtítulo se actualiza al confirmar cantidades o límites. Si el riesgo está en el máximo admitido, se pide reducirlo para poder registrar un stock superior.

## Implementación y despliegue

Aplicar primero `202610260001_remove_product.sql` con `npm.cmd run db:migrate`. La baja lógica registra autor/fecha, preserva movimientos y desvincula la categoría. El servidor verifica pertenencia y bloquea escrituras posteriores mediante trigger; reintentos de la misma baja no repiten cambios. No hay DELETE directo ni eliminación física de movimientos.

La consulta activa filtra productos retirados y mantiene el aislamiento por hogar. Realtime utiliza el UPDATE existente para retirar la tarjeta en los demás dispositivos. Los clientes anteriores deben recargar la PWA. El historial de Todo el hogar conserva los artículos retirados, y una selección histórica abierta admite el producto eliminado.

## Validación

- Build y TypeScript correctos; 44 comprobaciones PWA.
- 147 pruebas SQL locales y remotas, incluidas 19 nuevas; concurrencia de baja y actualización de stock correcta.
- Modelo: 50 comprobaciones; sincronización: 22; Realtime real: 17 con cinco sesiones.
- Navegador como integrante temporal: confirmación/cancelación de eliminación, cálculo 4/12 → 9, 5/12 → 8 y salida de Reposición al llegar a 13. Claro y oscuro a 360 px, sin desbordamiento horizontal.
- Migración aplicada sin eliminar datos de las familias reales. Pruebas con hogares sintéticos y limpieza al finalizar. Las pruebas físicas en teléfonos familiares siguen pendientes.

Guías de fases 3/4, diseño visual, plan y README actualizados.
