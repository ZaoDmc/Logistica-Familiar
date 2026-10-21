# Logística Familiar — instrucciones base

Fecha: 21 de octubre de 2026. Estado: definición inicial del proyecto.

## Objetivo solicitado

Crear una aplicación que el solicitante y su mamá puedan utilizar principalmente desde el celular para coordinar los artículos de la casa. Debe permitir consultar desde un supermercado qué hace falta y actualizar las cantidades disponibles en el hogar.

Ejemplos de artículos: alimentos, útiles de aseo, comida del perro y papel higiénico. Los productos pueden llevar nombres específicos como «Comida del Logan Cannes» y «Crema de leche Soprole».

## Requisitos del usuario

1. El espacio compartido se denomina **hogar**.
2. Organizar los productos por categorías.
3. Mostrar una casilla numérica de stock con botones para sumar y restar con un toque.
4. Permitir descripciones breves e iconos seleccionables desde un catálogo predeterminado.
5. Tanto integrantes como admin pueden agregar categorías y productos y actualizar stock.
6. Registrar cada actualización de stock en una base de datos SQL.
7. Informar continuamente los cambios a todos los integrantes para mantener los datos compartidos actualizados.
8. Identificar cuentas individuales con roles **integrante** y **admin**. El solicitante será admin y podrá añadir integrantes. No se necesitan otros privilegios de administración de inventario.
9. Dimensionar el sistema para hasta cinco personas en simultáneo. Esto es un objetivo de capacidad, no un requisito de expulsar sesiones ni limitar a cinco las cuentas registradas.
10. Preferir alojamiento gratuito; aceptar propuestas de proveedores.
11. Si no resulta viable el alojamiento gratuito, considerar el computador del solicitante como servidor, disponible mientras esté encendido y el servicio se ejecute manualmente.
12. Puede ser una APK o una web accesible desde el celular.

## Entregables de esta primera etapa

- Guardar estas instrucciones en `Docs/Instrucciones_Base.md`.
- Preparar el entorno y la estructura inicial del proyecto.
- Crear un plan por fases que permita comprender y seguir el avance.
- Explicar el funcionamiento propuesto, alojamiento y requisitos o cuentas que debe preparar el usuario.
- No implementar todavía el sistema completo ni dar por contratado o publicado ningún servicio.

## Decisiones propuestas para desarrollar después

Estas decisiones concretan el diseño y pueden revisarse; no son requisitos adicionales expresados por el usuario.

- Comenzar como web responsive y convertirla en PWA instalable. Posponer APK.
- Usar React, TypeScript y Vite, con Supabase (PostgreSQL, Auth y Realtime) y Vercel para la web.
- Comenzar con un hogar y modelar pertenencia explícita a ese hogar.
- Usar cantidades enteras no negativas: unidades, envases o paquetes. Fracciones y conversiones quedan fuera del MVP.
- Considerar faltante un producto con stock cero. Proponer stock mínimo configurable y filtro «Por comprar» como mejora opcional.
- Usar correo y contraseña; acceso por alta autorizada del admin, sin registro público.
- Mostrar cambios en vivo mientras la aplicación esté abierta. Al volver del segundo plano o reconectarse, consultar nuevamente la base. Notificaciones push con la aplicación cerrada se evaluarán aparte.
- Sin conexión, impedir cambios y avisar que el stock no está actualizado. No implementar una cola offline en el MVP.
- Auditar actor, producto, cantidad anterior, cantidad nueva, diferencia y fecha del servidor; preservar el historial.
- Usar español, botones grandes y etiquetas accesibles para facilitar el uso desde el celular.

## Criterio global de aceptación

Dos integrantes autenticados ven el mismo hogar. Al agregar un producto o cambiar su cantidad desde un celular, el otro recibe el cambio sin recargar manualmente. Cada cambio confirmado tiene un registro de historial; las operaciones simultáneas no pierden incrementos. Un integrante no puede añadir usuarios ni acceder a hogares ajenos. Las pruebas de cierre incluirán cinco sesiones simultáneas.

El detalle de las fases y sus criterios está en [Plan de implementación](Plan_Implementacion.md).
