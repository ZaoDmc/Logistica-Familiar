# Exporta la foto original a los tamaños de instalación; no modifica el archivo fuente.
# Ejecutar en Windows: powershell -File scripts/generate-pwa-icons.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$iconDirectory = Join-Path $PSScriptRoot '../public/icons'
$photo = [System.Drawing.Image]::FromFile((Join-Path $iconDirectory 'Logitan Bello.png'))
try {
    foreach ($spec in @(
        @{ Name = 'logan-192.png'; Size = 192; Scale = 0.94 },
        @{ Name = 'logan-512.png'; Size = 512; Scale = 0.94 },
        @{ Name = 'logan-maskable-512.png'; Size = 512; Scale = 0.76 },
        @{ Name = 'logan-apple-touch.png'; Size = 180; Scale = 0.94 }
    )) {
        $bitmap = [System.Drawing.Bitmap]::new($spec.Size, $spec.Size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#faf5ee'))
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $ratio = $spec.Size * $spec.Scale / [Math]::Max($photo.Width, $photo.Height)
            $width = [single]($photo.Width * $ratio)
            $height = [single]($photo.Height * $ratio)
            $rectangle = [System.Drawing.RectangleF]::new(($spec.Size - $width) / 2, ($spec.Size - $height) / 2, $width, $height)
            $graphics.DrawImage($photo, $rectangle)
            $bitmap.Save((Join-Path $iconDirectory $spec.Name), [System.Drawing.Imaging.ImageFormat]::Png)
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
    }
} finally { $photo.Dispose() }
Write-Output 'Iconos de Logan exportados: 192, 512, maskable 512 y Apple 180.'
