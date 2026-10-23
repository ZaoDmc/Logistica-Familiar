# Usar a Logan como icono de instalación

Al instalar la PWA todavía aparecía una casa. El manifiesto de Android y el enlace apple-touch-icon de iPhone ahora apuntan a exportaciones PNG de la foto original de Logan, con fondo crema opaco y nombres nuevos para diferenciar los archivos antiguos.

Tamaños: 192 × 192, 512 × 512, adaptable 512 × 512 y Apple 180 × 180. La variante adaptable deja toda la foto dentro de la zona segura circular para admitir recortes del sistema. El original se conserva sin cambios; sus 112 × 112 px limitan el detalle disponible.

Regeneración en Windows desde la raíz del proyecto: `powershell -File scripts/generate-pwa-icons.ps1`. Requiere System.Drawing incluido en Windows; no descarga dependencias. Si la política local impide ejecutar scripts, habilitar únicamente este script según la política del equipo.

La caché pública incluye los nuevos iconos. La actualización de un icono ya instalado depende del navegador y del sistema; si sigue apareciendo la casa, quitar el acceso instalado, abrir la web actualizada en Chrome (Android) o Safari (iPhone) y volver a instalar/agregar a inicio. Se conserva la cuenta y el inventario remoto, aunque puede ser necesario iniciar sesión de nuevo.
