# Cantidad en riesgo y módulo Reposición

Antes solo se distinguía entre stock disponible y cero. Ahora cada producto admite una **cantidad en riesgo** al crearlo y editarla después desde su tarjeta. Con riesgo 2, stock 2 o 1 muestra **Por agotarse** en amarillo; stock 0 siempre muestra **Por comprar** en rojo.

El nuevo apartado **Reposición** reúne ambos estados, con contadores, búsqueda, filtros y productos en cero primero. Permite contar y ajustar stock con +/− o una cantidad exacta, editar el umbral y consultar movimientos. Al superar el límite el producto sale de las alertas automáticamente. Ambos roles tienen acceso.

La migración `202610250001_stock_risk.sql` debe aplicarse antes del despliegue. Los productos existentes mantienen stock e historial y reciben límite 0. El alta nueva es atómica e incluye el límite en el payload de reintento. Se conserva el RPC anterior para clientes/operaciones pendientes. Editar el límite usa versión independiente, autorización por hogar y reintento seguro; no modifica stock ni genera movimientos ficticios. No hay UPDATE directo desde el navegador.

## Validación

- Build/TypeScript y 44 comprobaciones PWA.
- 128 comprobaciones SQL locales/remotas, incluidas 23 nuevas de riesgo; concurrencia de stock existente y de límites con versión compartida.
- 40 comprobaciones del modelo y 22 de sincronización.
- Realtime: 15 comprobaciones con cinco sesiones, umbral inclusivo, cero prioritario y reposición/reconexión.
- Navegador como integrante temporal: alta del ejemplo 10/2, edición de stock y umbral desde Reposición, filtros y salida de alertas al reponer. Colores revisados en claro/oscuro.
- Se usaron hogares sintéticos; no se cambió el stock del hogar familiar. La migración solo incorpora los nuevos campos con límite inicial 0.

Guías de fases 3/4, plan, README y guía visual actualizados. Las pruebas en los teléfonos familiares siguen pendientes.

Publicación verificada el 25 de octubre de 2026 en https://logistica-familiar.vercel.app/, estado READY. Pasaron las 55 comprobaciones remotas de integridad, cabeceras, Auth y CORS. Los hogares y cuentas temporales se eliminaron. Rama: codex/stock-en-riesgo. Commit de implementación: fe59634.
