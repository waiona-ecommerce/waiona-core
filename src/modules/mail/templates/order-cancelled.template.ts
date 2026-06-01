import { EMAIL_THEME } from '../../../common/theme/email-theme';

export function orderCancelledTemplate(name: string, orderId: number): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Pedido cancelado</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_THEME.colors.light};font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:12px;overflow:hidden;">

          <!-- HEADER -->
          <tr>
            <td style="background:${EMAIL_THEME.colors.primary};padding:30px;text-align:center;">
              <img src="${EMAIL_THEME.logo}" width="120"
                style="display:block;margin:auto;" alt="Waiona" />
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 20px;color:${EMAIL_THEME.colors.primary};">
                Tu pedido fue cancelado
              </h2>

              <p style="color:${EMAIL_THEME.colors.text};line-height:1.6;margin:0 0 8px;">
                Hola <strong>${name}</strong>,
              </p>
              <p style="color:${EMAIL_THEME.colors.text};line-height:1.6;margin:0 0 24px;">
                Tu pedido <strong>#${orderId}</strong> fue cancelado. Si tenés alguna duda
                o creés que esto es un error, contactate con nuestro equipo de soporte.
              </p>

              <p style="font-size:12px;color:#666;margin:0;">
                Si el pago fue procesado, el reembolso se realizará en los próximos días hábiles.
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
