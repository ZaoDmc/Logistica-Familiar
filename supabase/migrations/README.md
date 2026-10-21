# Migraciones SQL

Las migraciones se aplican en orden: `202610210001` crea inventario y RLS; `202610210002` incorpora cuentas/invitaciones; `202610210003` devuelve HTTP 409 para conflictos de edición del stock.

Aplicar mediante `npm run db:migrate`. No editar migraciones después de aplicarlas ni crear tablas manualmente sin registrar su migración. Instrucciones y pruebas en `Docs/Fase_1_SQL.md`.
