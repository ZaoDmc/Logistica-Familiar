# Logística Familiar

Base de una aplicación móvil web para compartir el inventario del hogar.

**Estado: fase 3 completada.** Cuentas, integrantes e inventario funcionan con Supabase. Ambos roles pueden crear categorías/productos y actualizar stock con historial. Incluye búsqueda, filtro por comprar y temas claro/oscuro. Los últimos cambios del hogar se consultan con **Actualizar**; la sincronización automática corresponde a fase 4.

- [Instrucciones base](Docs/Instrucciones_Base.md)
- [Plan por fases y cuentas necesarias](Docs/Plan_Implementacion.md)
- [Fase 1: aplicar SQL, probar y crear el hogar](Docs/Fase_1_SQL.md)
- [Fase 2: uso de cuentas, invitaciones y apariencia](Docs/Fase_2_Cuentas.md)
- [Fase 3: inventario, cantidades, historial y pruebas](Docs/Fase_3_Inventario.md)

## Desarrollo en Windows / PowerShell

Desde esta carpeta:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir la URL que muestra Vite (normalmente http://localhost:5173). Apache/XAMPP no es necesario. Abrir la carpeta mediante Apache no ejecuta TypeScript.

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run preview
```

Para una prueba en un celular conectado a la misma red:

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Usar la URL de red que muestre Vite para revisar el diseño. Las funciones de administración solo admiten los orígenes configurados; los enlaces localhost no sirven desde otro celular. El acceso compartido permanente y la instalación PWA sobre HTTPS se implementarán en fase 5.

## Configuración

La web ya utiliza las variables de Supabase en `.env` (también se admite `.env.local`). Usar `.env.example` como referencia en una instalación nueva. Nunca poner claves secretas o `service_role` en variables `VITE_*`: se incluyen en el código público del navegador. Los archivos administrativos privados y los comandos de configuración están documentados en la guía de fase 2.

## Estructura

- `Docs/`: requisitos, decisiones y avance.
- `src/`: acceso, administración del hogar, temas y catálogo de iconos.
- `supabase/migrations/`: migraciones SQL versionadas de inventario y cuentas.
- `supabase/functions/`: operaciones administrativas de servidor.
- `dist/`: resultado generado por el build, no versionado.

Usar el archivo `package-lock.json` para instalaciones reproducibles. El repositorio Git remoto y los servicios se configurarán en la fase de publicación.
