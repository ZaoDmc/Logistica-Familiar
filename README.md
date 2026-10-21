# Logística Familiar

Base de una aplicación móvil web para compartir el inventario del hogar.

**Estado: fase 0.** Arranque local y documentación preparados. Aún no hay login, base de datos conectada, edición de inventario ni sincronización. No se ha publicado ni creado infraestructura externa.

- [Instrucciones base](Docs/Instrucciones_Base.md)
- [Plan por fases y cuentas necesarias](Docs/Plan_Implementacion.md)

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

Usar la URL de red que muestre Vite y, si Windows lo solicita, permitir el acceso solamente en la red privada. Esto sirve para desarrollo y no publica la app en Internet. La instalación PWA sobre HTTPS se implementará después.

## Configuración futura

Copiar `.env.example` a `.env.local` y completar los valores al implementar Supabase. La pantalla inicial funciona sin ellos y todavía no los consume. Nunca poner claves secretas o `service_role` en variables `VITE_*`: se incluyen en el código público del navegador.

## Estructura

- `Docs/`: requisitos, decisiones y avance.
- `src/`: pantalla inicial, estilos y catálogo de iconos.
- `supabase/migrations/`: futuras migraciones SQL versionadas.
- `supabase/functions/`: futuras operaciones administrativas de servidor.
- `dist/`: resultado generado por el build, no versionado.

Usar el archivo `package-lock.json` para instalaciones reproducibles. El repositorio Git remoto y los servicios se configurarán en la fase de publicación.
