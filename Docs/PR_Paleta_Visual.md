La interfaz cambia su identidad verde por la paleta **terracota y crema** elegida por el usuario. Los temas claro, oscuro y automático comparten colores semánticos, fuentes identificadas mediante variables y contornos más visibles para campos y botones secundarios. Los placeholders usan el contraste del texto secundario sin reducir su opacidad.

El cambio incluye el manifest, el color del navegador, los iconos instalables y la pantalla sin conexión. Se conserva la distribución y las dimensiones de las tarjetas y controles. La nueva `Docs/Guia_Diseno_Visual.md`, enlazada desde el README, documenta objetivo de lectura, paletas, tipografías, tamaños, espaciado, reglas adaptables y ejemplos concretos para solicitar cambios futuros.

Se corrige además el publicador directo: el artefacto ahora contiene un `vercel.json` que omite instalación y compilación y sirve el directorio raíz. La primera publicación de esta entrega falló porque el proyecto heredó `npm ci` de su configuración para Git y el artefacto ya compilado no contiene un lockfile. Los valores `null` del request no reemplazaban esos ajustes en un proyecto existente. La configuración explícita del artefacto solucionó el fallo y el despliegue corregido alcanzó READY. El `vercel.json` del repositorio sigue preparado para compilar las fuentes desde Git.

Validación:

- TypeScript y build correctos; 41 comprobaciones PWA.
- 16 combinaciones de contraste revisadas numéricamente en claro y oscuro.
- Bienvenida e inventario revisados a 764 y 360 px; Claro, Oscuro y Automático comprobados sin desbordamiento horizontal. Botones de cantidad de 48 × 48 px.
- Publicación en https://logistica-familiar.vercel.app y 40 comprobaciones HTTPS de integridad, cabeceras, Auth y CORS.
- Cuentas y hogar temporales eliminados; inventario familiar sin modificaciones.

La rama parte de `feat/pwa-publicacion`; integrar primero el PR de fase 5 si sigue abierto y comprobar después la base de este PR. Los iconos ya instalados pueden tardar en reflejar el cambio según el navegador y el sistema operativo.
