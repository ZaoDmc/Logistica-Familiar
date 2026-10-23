# Personalizar la bienvenida con Logan y temas manuales

La bienvenida tenía un tono formal, un icono de casa y un selector con modo automático. Ahora muestra «Para que llevemos un orden / mamita querida <3» con un corazón, la foto original de Logan en la cabecera y dos botones de sol/luna para elegir Claro u Oscuro.

La elección se guarda entre visitas y se comparte entre pestañas. El tema inicial y los antiguos valores automáticos pasan a Claro, también antes de cargar React y en la pantalla sin conexión. La foto se incluye en la caché pública y se valida su recuperación sin red, respetando los espacios y mayúsculas de su nombre. Los iconos de instalación conservan su diseño anterior.

La guía visual documenta las dimensiones de Logan, el tono familiar y las reglas del nuevo selector.

Validación: build y TypeScript correctos; 44 comprobaciones PWA correctas. Revisión visual en Claro y Oscuro a 360 y 655 px, persistencia del modo oscuro tras recargar, foto original cargada, controles móviles de tema de 44 × 44 px y ausencia de desbordamiento horizontal a 360 px. Logan también se utiliza como favicon.
