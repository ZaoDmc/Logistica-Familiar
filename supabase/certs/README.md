# Certificado público de Supabase

`prod-ca-2021.crt` es el certificado raíz público de Supabase, no una clave privada.

Fuente HTTPS: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

La URL se obtuvo de la configuración oficial del panel:
https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json

SHA-256 del certificado DER: `807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa`.

Vigencia hasta 26 de abril de 2031. Si Supabase rota la autoridad, verificar y actualizar desde la fuente oficial. Los scripts mantienen la validación de cadena y nombre del servidor.
