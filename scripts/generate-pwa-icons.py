"""Icono geométrico del hogar con la paleta del proyecto. Requiere Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw

destination = Path(__file__).resolve().parents[1] / "public" / "icons"
destination.mkdir(parents=True, exist_ok=True)
canvas = Image.new("RGB", (2048, 2048), "#a4472d")
draw = ImageDraw.Draw(canvas)
# Todo el símbolo queda dentro del círculo seguro del icono maskable.
draw.polygon([(520, 1000), (1024, 550), (1528, 1000), (1400, 1140), (1024, 810), (648, 1140)], fill="#fffcf7")
draw.rounded_rectangle((690, 1010, 1358, 1510), radius=64, fill="#fffcf7")
draw.rounded_rectangle((910, 1180, 1138, 1515), radius=38, fill="#a4472d")
for filename, size in [("icon-192.png", 192), ("icon-512.png", 512), ("maskable-512.png", 512), ("apple-touch-icon.png", 180)]:
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(destination / filename, optimize=True)
print("Iconos PNG generados: 192, 512, maskable 512 y Apple 180.")
