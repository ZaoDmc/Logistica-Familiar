# Guía de diseño visual — Logística Familiar

Actualizada el 22 de octubre de 2026. Paleta elegida: **terracota y crema**, con variantes clara y oscura.

Esta guía es la referencia para pedir e implementar cambios de apariencia. Describe los valores actuales del proyecto; si se modifica una regla visual, actualizar también este documento. La implementación principal está en `src/styles.css`.

## Objetivo de visualización

Facilitar que una persona pueda revisar rápidamente qué falta en casa mientras está en el supermercado. La interfaz debe ser legible, tranquila y cálida, con controles fáciles de tocar y cantidades visibles.

- Prioridad en el inventario: nombre del producto, cantidad, botones +/− y estado por comprar.
- Categorías e iconos ayudan a encontrar artículos; las descripciones complementan el nombre.
- Textos y etiquetas deben explicar los estados. El color por sí solo no debe indicar disponibilidad, error o selección.
- Diseño adaptable al ancho disponible. Altura de tarjetas automática para admitir nombres largos, errores y confirmaciones.
- Ofrecer solo Claro y Oscuro mediante botones de sol y luna. La elección persiste en el dispositivo y se sincroniza entre pestañas. El valor inicial es Claro; un antiguo valor Automático también pasa a Claro. No seguir cambios del tema del sistema.
- No añadir fuentes remotas ni imágenes decorativas que dificulten consultar el stock.

## Colores principales y uso

Los componentes deben usar variables semánticas CSS, por ejemplo `var(--brand)`, sin incorporar un hexadecimal distinto por botón o tarjeta.

| Variable | Tema claro | Tema oscuro | Aplicación |
| --- | --- | --- | --- |
| `--bg` | `#FAF5EE` | `#221B18` | Fondo general crema / marrón profundo |
| `--surface` | `#FFFCF7` | `#302520` | Tarjetas, campos y superficies principales |
| `--surface-soft` | `#F2E3D5` | `#403028` | Etiquetas, filtros y fondos secundarios |
| `--brand` | `#A4472D` | `#F1B294` | Terracota principal, botones, enlaces y cantidades destacadas |
| `--on-brand` | `#FFFFFF` | `#3C2117` | Texto e iconos sobre el color principal |
| `--text` | `#3E2D27` | `#F7EBDD` | Títulos y texto principal |
| `--muted` | `#746057` | `#D2BBA9` | Descripciones, ayudas, fechas y texto secundario |
| `--accent` | `#8D4B30` | `#F2C4A6` | Detalles de énfasis y frase introductoria |
| `--border` | `#D9C4B3` | `#72574A` | Bordes decorativos de tarjetas y separadores |
| `--control-border` | `#A47D67` | `#A6836E` | Contornos de campos, selectores y botones secundarios |
| `--focus` | `#9A432D` | `#FFD0AD` | Indicador visible del foco de teclado |
| `--error` | `#A12D37` | `#FFB4B7` | Mensajes de error |
| `--error-bg` | `#FFF0F0` | `#47272B` | Fondo de mensajes de error |

Sombras: `0 18px 50px #4B2B1B0D` en claro y `0 18px 50px #00000026` en oscuro. Usarlas con moderación; no agregar sombras diferentes a cada tarjeta.

El rojo se reserva para errores. El terracota identifica acciones y énfasis de la aplicación; **Por comprar** mantiene una etiqueta escrita. Los bordes decorativos pueden ser suaves; los campos usan el borde de control más visible.

Para cambiar la identidad principal de nuevo, revisar conjuntamente:

1. Variables de los dos temas en `src/styles.css`.
2. `theme-color` en `index.html`.
3. Colores del manifest en `public/manifest.webmanifest`.
4. Tema claro/oscuro de `public/offline.html`, que funciona sin cargar React.
5. Colores del generador `scripts/generate-pwa-icons.py` y sus PNG en `public/icons/`.

El manifest y los iconos usan el terracota principal claro como identidad estable. Los iconos de instalación conservan la casa terracota. La cabecera y la pantalla sin conexión usan la foto original de Logan (`public/icons/Logitan Bello.png`), sin modificarla. En cabecera mide 44 × 44 px, con radio circular y `object-fit: contain`; no estirar ni recortar su cara. Respetar las mayúsculas y codificar el espacio como `%20` en las URL. La foto está incluida en la caché pública de la PWA. Los navegadores y el sistema operativo pueden demorar en renovar un icono ya instalado.

## Tipografías principales y secundarias

| Uso | Variable / familia | Regla |
| --- | --- | --- |
| Principal | `--font-main`: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Todo el contenido, formularios, navegación, cantidades y botones |
| Secundaria | `--font-accent`: `Georgia, 'Times New Roman', serif` | Énfasis editorial del título de bienvenida, actualmente «un orden» en cursiva |

Las fuentes son locales al dispositivo. Por eso la apariencia exacta de la principal puede variar entre Android, iPhone y Windows. No se descargan fuentes externas. Mantener la secundaria limitada al énfasis; las cantidades y controles usan la principal.

Escala actual, con referencia de `1rem = 16px` cuando el usuario no cambió el tamaño base:

| Elemento | Tamaño | Detalle |
| --- | --- | --- |
| Texto normal | 1rem, aproximadamente 16 px | Interlineado general 1,6 |
| Título de bienvenida en escritorio | `clamp(2.35rem, 5.3vw, 3.8rem)` | Interlineado 1,12; tamaño adaptable |
| Bienvenida hasta 740 px | 2,8rem | Hasta 430 px, el título introductorio usa 2,35rem |
| Título del hogar | 2,5rem | Hasta 600 px: 2rem |
| Título de acceso | 1,65rem | «Entra a tu hogar» |
| Títulos de secciones | 1,25rem | Interlineado 1,4 |
| Nombre de producto | 1rem | Interlineado 1,5; admite varias líneas |
| Cantidad editable | 1,25rem | Peso 650, centrada |
| Ayudas y descripciones | 0,8rem | Evitar reducirlas más en cambios futuros |
| Etiquetas de campos | 0,87rem | Peso 650 |

Pesos de referencia: 400 para lectura y énfasis serif, 650 para acciones/cantidades, 750 para marca y énfasis fuerte. El navegador ajusta el peso a las variantes disponibles de su fuente local. Algunas etiquetas compactas del inventario usan tamaños menores; un ajuste de legibilidad debe revisarlas en el teléfono, sin achicar los controles para compensar.

## Tarjetas, anchos y espacios

Todos los tamaños son CSS y usan `box-sizing: border-box`. Las tarjetas tienen **ancho fluido y altura automática**; no se fija una altura común que pueda recortar contenido.

| Elemento | Escritorio | Celular / ancho reducido |
| --- | --- | --- |
| Contenedor general `main` | Máximo 1080 px; padding 28 px vertical / 26 px horizontal | Hasta 740 px: padding 20 px vertical / 18 px horizontal |
| Panel del hogar `.dashboard` | Máximo 760 px, centrado | Ocupa el ancho disponible |
| Tarjeta general `.card` | Padding 28 px; radio 22 px; borde 1 px | Hasta 740 px: padding 24 px vertical / 20 px horizontal |
| Separación de tarjetas generales | Margen vertical 24 px | Se conserva; tarjeta de acceso tiene margen 0 dentro de su grilla |
| Tarjeta de producto `.product-card` | Padding 20 px; radio 18 px; borde 1 px | Hasta 600 px: padding 18 px |
| Grilla de productos | Dos columnas iguales; separación 14 px | Hasta 600 px: una columna |
| Bienvenida y tarjeta de acceso | Columnas `1fr 0.87fr`; separación 66 px | Hasta 740 px: una columna, separación 24 px; hasta 430 px: 18 px |
| Resumen de inventario | Tres columnas; radio 18 px | Conserva las tres cifras; permite ajustar tipografía, sin ocultar cantidades |
| Icono de producto | 44 × 44 px; radio 12 px | Se conserva |

Ejemplo: si el documento dispone de 360 px de ancho útil, los 18 px de margen a cada lado dejan aproximadamente **324 px** para una tarjeta de una columna. El ancho real depende del espacio del navegador y de sus barras de desplazamiento; no fijar la tarjeta en 324 px.

Puntos de cambio existentes: **740 px** para bienvenida/cabecera/tarjetas generales, **600 px** para productos/filtros y **430 px** para simplificar la bienvenida en teléfonos pequeños. El cuerpo admite un mínimo de 320 px; verificar especialmente 360 y 390 px y el ancho de 764 px del comentario visual del usuario.

Espaciado habitual: 4–8 px en agrupaciones compactas, 12–14 px entre controles o tarjetas relacionadas, 18–24 px entre bloques, 28–32 px para separar secciones. Consultar el selector concreto antes de cambiar una medida global.

## Botones, campos y accesibilidad

- Botones generales: altura mínima 44 px, radio 12 px, padding 10 × 16 px.
- Botones +/−: **48 × 48 px**; mantenerlos visibles y separados del campo de cantidad.
- Campos y selectores: mínimo 48 px de alto; botones de tema de al menos 44 × 44 px; textarea tiene altura adaptable.
- Cantidad: ancho 108 px con límite de 45% del control; no forzar una anchura que desborde junto a los botones.
- Foco de teclado: contorno de 3 px, separado 3 px. No quitarlo para mejorar una captura.
- Selección y errores deben conservar texto/indicadores además del color. Mantener los nombres accesibles de sumar/restar por producto.
- Objetivo de contraste: al menos **4,5:1** para texto normal y **3:1** para los indicadores y límites necesarios para reconocer controles. Medir la combinación concreta, no solo el color principal.
- Respetar ampliación de texto y reducción de movimiento. No ocultar el contenido esencial para hacer una tarjeta más pequeña.

Mediciones de referencia realizadas sobre los colores definidos, sin certificar toda la aplicación:

| Combinación | Claro | Oscuro |
| --- | --- | --- |
| Texto principal / fondo | 12,03:1 | 14,44:1 |
| Texto secundario / tarjeta | 5,77:1 | 8,09:1 |
| Texto secundario / superficie suave | 4,71:1 | 6,83:1 |
| Texto del botón / principal | 5,97:1 | 8,11:1 |
| Borde de control / tarjeta | 3,59:1 | 4,32:1 |

Fuentes: [W3C, contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [W3C, contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

## Cómo pedir un cambio visual

Indicar la pantalla, elemento, cambio, alcance y las reglas que deben mantenerse. Ejemplos:

> Siguiendo `Docs/Guia_Diseno_Visual.md`, reduce el padding de las tarjetas de producto en celular de 18 a 14 px. Mantén los controles de 48 px, la altura automática y el tamaño de la cantidad.

> Cambia el terracota principal del modo claro. Ajusta también el modo oscuro, la pantalla sin conexión, el manifest y los iconos, y revisa los contrastes antes de publicar.

> Aumenta la descripción de producto a 0,9rem sin modificar el título, la grilla ni la fuente secundaria. Revisa que los nombres largos no desborden a 360 px.

Si se solicita «tarjetas más pequeñas», aclarar qué se busca reducir: padding, separación, ancho, tamaño de texto o cantidad de información. Conservar el tamaño táctil de botones y cantidades como regla general.

## Verificación y publicación

1. Revisar Claro y Oscuro, incluida la persistencia al recargar; comprobar contraste de las combinaciones cambiadas.
2. Revisar acceso, inventario, formulario y mensajes con nombres largos; comprobar desbordamiento horizontal en celular y escritorio.
3. Si cambia la identidad, regenerar los PNG con `scripts/generate-pwa-icons.py` usando Python y Pillow; los archivos generados quedan versionados.
4. Ejecutar `npm.cmd run build` y `npm.cmd run test:pwa`. Publicar y verificar el artefacto siguiendo la guía de fase 5.
5. La PWA puede mostrar **Hay una versión nueva**. Guardar la edición y confirmar operaciones antes de recargar.
6. Actualizar esta guía y la descripción del PR con los valores que realmente quedaron implementados.

Validación de esta entrega: build/TypeScript y 41 comprobaciones PWA correctos; 16 combinaciones de contraste revisadas numéricamente en los dos temas. Navegador a 764 px y 360 px: bienvenida e inventario revisados en claro/oscuro, tema automático comprobado en la entrega original (retirado en la actualización de Logan), sin desplazamiento horizontal. Con 345 px útiles de documento se observaron tarjetas de 309 px, padding de 18 px y botones +/− de 48 × 48 px. Se usó un hogar temporal para revisar las tarjetas, sin modificar el inventario real. Esto no sustituye una auditoría completa de accesibilidad ni las pruebas en teléfonos físicos.

## Bienvenida familiar y controles de tema

La aplicación se usa principalmente entre mamá e hijo. Mantener un tono cercano y cariñoso, sin convertir los textos de bienvenida en publicidad. La frase se presenta como «Para que llevemos un orden» en el título y «mamita querida <3» con un corazón terracota debajo. La etiqueta superior dice «ENTRE MAMÁ Y YO». Logan también aparece como favicon de la pestaña.

El selector de tema es una cápsula con dos botones: sol / Claro y luna / Oscuro. La selección se indica con fondo terracota y `aria-pressed`; ambos controles conservan un nombre accesible. Hasta 430 px se ocultan solo las etiquetas visuales para dejar más espacio a la marca; permanecen los iconos y los nombres accesibles. No hay opción Automático. La pantalla sin conexión también respeta la elección guardada.
