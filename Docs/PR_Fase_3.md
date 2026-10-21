El hogar ahora permite administrar el inventario desde el celular: categorías, productos con iconos y descripción, búsqueda, filtro por comprar, botones de stock y edición de cantidades. Admin e integrante usan las mismas operaciones auditadas y pueden revisar el historial de todo el hogar o de un producto.

La casilla conserva la versión leída para detectar cambios de otra sesión. Las operaciones con respuesta incierta conservan su identificador para reintentar sin duplicar movimientos. Se agrega la migración `202610210003`, que devuelve HTTP 409 para estos conflictos y evita usar `40001`, reservado a fallos de serialización y reintentos internos de PostgREST.

Validación:

- TypeScript y build de producción correctos.
- 24 comprobaciones de búsqueda, cantidades e intentos persistidos.
- 90 comprobaciones SQL locales/remotas y concurrencia con hasta cinco sesiones.
- 21 comprobaciones HTTP contra Supabase, con cuentas admin e integrante temporales.
- Formularios, iconos, stock, conflicto entre sesiones, historial y filtros comprobados en navegador; diseño a 360 px sin desbordamiento horizontal y controles de al menos 44 px.
- Datos temporales eliminados; credenciales excluidas de Git y del bundle.

La migración ya está aplicada en el proyecto de Supabase del entorno. La documentación de fase 3, el plan y el README describen el uso y los límites. La actualización entre dispositivos sigue siendo manual mediante **Actualizar**; Realtime corresponde a fase 4 y la publicación/PWA a fase 5.
