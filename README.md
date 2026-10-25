# Logística Familiar

Base de una aplicación móvil web para compartir el inventario del hogar.

**Estado: fase 5 implementada y publicada; pruebas físicas en celulares pendientes.** Abre **https://logistica-familiar.vercel.app**. La web usa Supabase para cuentas, inventario, historial y sincronización; permite instalación desde el navegador y conserva los temas claro/oscuro. Funciona sin mantener encendido el PC. El despliegue actual es directo; la publicación automática desde GitHub sigue pendiente de conectar el repositorio al proyecto existente.

- [Instrucciones base](Docs/Instrucciones_Base.md)
- [Plan por fases y cuentas necesarias](Docs/Plan_Implementacion.md)
- [Guía visual: colores, tipografías, tarjetas y cómo pedir cambios](Docs/Guia_Diseno_Visual.md)
- [Fase 1: aplicar SQL, probar y crear el hogar](Docs/Fase_1_SQL.md)
- [Fase 2: uso de cuentas, invitaciones y apariencia](Docs/Fase_2_Cuentas.md)
- [Alta controlada de otras familias y entrega privada de acceso](Docs/Alta_Familias.md)
- [Fase 3: inventario, cantidades, historial y pruebas](Docs/Fase_3_Inventario.md)
- [Módulo Reposición y cantidad en riesgo](Docs/PR_Stock_En_Riesgo.md)
- [Mejora: quitar categorías sin perder productos](Docs/PR_Quitar_Categorias.md)
- [Fase 4: sincronización, recuperación y pruebas](Docs/Fase_4_Sincronizacion.md)
- [Fase 5: instalar, publicar, actualizar y probar en celulares](Docs/Fase_5_PWA_Publicacion.md)

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

Usar el archivo `package-lock.json` para instalaciones reproducibles. Vercel publica la web y Supabase administra los datos. El procedimiento de despliegue y la futura conexión automática con GitHub están en la guía de fase 5.
