El inventario compartido ahora recibe automáticamente categorías, productos, cantidades e historial mediante Supabase Realtime. Al reconectar o volver a la aplicación consulta SQL para recuperar eventos perdidos. Una cantidad en edición se conserva y detecta cambios remotos de versión.

La migración `202610210004` publica las tres tablas necesarias manteniendo RLS por hogar. El cliente agrupa avisos, serializa consultas, muestra el estado de sincronización, vuelve a suscribirse ante errores y consulta cada 30 segundos mientras está visible. Desmontar elimina canales, listeners y temporizadores; sin conexión se bloquean nuevas escrituras. El historial conserva los datos visibles durante la consulta y vuelve a la primera página vigente al actualizar.

Validación:

- TypeScript y compilación de producción correctos.
- 21 comprobaciones de coordinación, suscripciones y ciclo de conexión simulado; 24 del modelo de inventario.
- 90 comprobaciones SQL locales/remotas y concurrencia de hasta cinco sesiones.
- 10 comprobaciones Realtime reales con cinco clientes independientes de admin/integrante y una identidad ajena aislada. Altas, historial, concurrencia y recuperación de cambios perdidos verificados.
- Muestras completas de escritura, aviso y reconsulta: 511–1.580 ms en tres ejecuciones correctas, dentro del objetivo de dos segundos con red estable.
- Navegador móvil de 360 px: actualización sin recargar, edición preservada con aviso de conflicto e historial actualizado; sin errores de consola ni desbordamiento horizontal.
- Datos temporales eliminados. Migración aplicada en Supabase; documentación de uso y limitaciones en la guía de fase 4.

La base de este PR es la rama de fase 3, cuyo PR todavía está abierto. Integrar primero fase 3 y comprobar después que la base sea main. La prueba de cortes físicos de red y suspensión en celulares reales queda para la publicación HTTPS de fase 5. No se ha publicado la web ni implementado edición offline.
