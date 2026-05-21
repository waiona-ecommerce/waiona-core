import { EMAIL_THEME } from 'src/common/theme/email-theme';

export function activationTemplate(name: string, url: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Activá tu cuenta en Waiona</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.colors.light};font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:${EMAIL_THEME.colors.primary};padding:30px;text-align:center;">
              <img src="${EMAIL_THEME.logo}" width="120" style="display:block;margin:auto;" alt="Waiona" />
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;color:${EMAIL_THEME.colors.primary};">
                Hola ${name}
              </h2>

              <p style="color:${EMAIL_THEME.colors.text};line-height:1.6;margin:0 0 24px;">
                Gracias por registrarte en Waiona. Activá tu cuenta haciendo clic en el botón de abajo.
              </p>

              <!-- BUTTON -->
              <div style="text-align:center;margin:30px 0;">
                <a href="${url}"
                  style="
                    background:${EMAIL_THEME.colors.secondary};
                    padding:14px 28px;
                    text-decoration:none;
                    border-radius:6px;
                    color:#000;
                    font-weight:bold;
                    display:inline-block;
                    letter-spacing:1px;
                  ">
                  Activar cuenta
                </a>
              </div>

              <p style="font-size:12px;color:#666;margin:0 0 8px;">
                O copiá este link en tu navegador:
              </p>
              <p style="font-size:11px;color:${EMAIL_THEME.colors.primary};word-break:break-all;margin:0 0 24px;">
                ${url}
              </p>

              <p style="font-size:12px;color:#666;margin:0;">
                Este link expira en <strong>24 horas</strong>. Si no creaste una cuenta en Waiona, ignorá este email.
              </p>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="padding:20px;text-align:center;background:${EMAIL_THEME.colors.light};font-size:12px;">
              <p style="margin:0;color:${EMAIL_THEME.colors.text};">
                © ${new Date().getFullYear()} Waiona · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
