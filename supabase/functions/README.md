# Funciones de servidor

`household-admin` está desplegada en Supabase. Gestiona invitaciones privadas, aceptación y recuperación manual de acceso. Las acciones admin validan el JWT y la pertenencia al hogar antes de usar privilegios de servidor.

El handler compartido está en `_shared/household-handler.mjs`; el punto de entrada Deno está en `household-admin/index.ts`. Desplegar con `npm run auth:deploy`; guía completa en `Docs/Fase_2_Cuentas.md`.
