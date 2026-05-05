---
name: email-templates
description: >
  Email template conventions for this repo using Resend SDK and EMAIL_THEME.
  Load when creating new email templates, modifying existing ones, or adding new email flows to MailService.
metadata:
  author: @rodrigozucchini
  version: "1.0"
---

# Email Templates Skill

---

## When to Use

Load when the user:
- Creates a new email template
- Modifies `activation.template.ts` or `reset-password.template.ts`
- Adds a new method to `MailService`
- Works with `EMAIL_THEME` colors or logo

---

## Core Rules

1. **Always use `EMAIL_THEME`**: Never hardcode colors or logo URL.
2. **Templates as exported functions**: Each template is a `.ts` file exporting a single function.
3. **Table-based HTML layout**: Email clients don't support flexbox/grid — use `<table>`.
4. **Inline styles only**: No `<style>` blocks — Gmail strips them.
5. **Logo via `EMAIL_THEME.logo`**: Points to `API_URL/email/logo.png` — use a CDN URL in dev (Cloudinary etc.).
6. **One template per email type**: Each file exports one function, one template.

---

## EMAIL_THEME

```typescript
// src/common/theme/email-theme.ts
export const EMAIL_THEME = {
  colors: {
    primary:   '#1C8968',  // verde — header background
    secondary: '#F9C82F',  // amarillo — botones CTA
    accent:    '#F08A27',  // naranja — acentos
    light:     '#F5F5F5',  // gris claro — body background
    text:      '#1F2937',  // gris oscuro — texto principal
  },
  logo: `${process.env.API_URL}/email/logo.png`,
  // ⚠️ En desarrollo: API_URL=localhost:3000 no es accesible por Resend
  // Usar URL pública (Cloudinary) hasta tener dominio en producción
};
```

---

## Template File Pattern

```typescript
// src/modules/mail/templates/nombre-evento.template.ts
import { EMAIL_THEME } from 'src/common/theme/email-theme';

export function nombreEventoTemplate(name: string, url: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Asunto del email</title>
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
                Hola ${name}
              </h2>

              <p style="color:${EMAIL_THEME.colors.text};line-height:1.6;margin:0 0 24px;">
                Mensaje principal del email.
              </p>

              <!-- CTA BUTTON -->
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
                  Texto del botón
                </a>
              </div>

              <!-- URL copiable -->
              <p style="font-size:12px;color:#666;margin:0 0 8px;">
                O copiá este link en tu navegador:
              </p>
              <p style="font-size:11px;color:${EMAIL_THEME.colors.primary};word-break:break-all;margin:0 0 24px;">
                ${url}
              </p>

              <p style="font-size:12px;color:#666;margin:0;">
                Este link expira en <strong>X horas/días</strong>.
                Mensaje de seguridad adicional.
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
```

---

## MailService Pattern

Cada nuevo flujo de email necesita:
1. Un archivo de template en `src/modules/mail/templates/`
2. Un método en `MailService`

```typescript
// src/modules/mail/services/mail.service.ts
import { nombreEventoTemplate } from '../templates/nombre-evento.template';

@Injectable()
export class MailService {

  private resend: Resend;
  private from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get('RESEND_API_KEY'));
    this.from   = this.configService.get('MAIL_FROM') ?? 'Waiona <onboarding@resend.dev>';
  }

  async sendNombreEventoEmail(to: string, name: string, extraParam: string): Promise<void> {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const url         = `${frontendUrl}/ruta-del-frontend?param=${extraParam}`;

    await this.resend.emails.send({
      from:    this.from,
      to,
      subject: 'Asunto del email en Waiona',
      html:    nombreEventoTemplate(name, url),
    });
  }
}
```

---

## Existing Templates

| Template | Archivo | Método en MailService | Expira |
|---|---|---|---|
| Activación de cuenta | `activation.template.ts` | `sendActivationEmail()` | 24hs |
| Reset de password | `reset-password.template.ts` | `sendPasswordResetEmail()` | 1h |

---

## Resend Sandbox Limitation

En desarrollo con `onboarding@resend.dev` como dominio:
- Solo podés enviar al email verificado en tu cuenta de Resend
- Para enviar a cualquier email → verificar un dominio propio en resend.com/domains
- Cambiar `MAIL_FROM` a `noreply@tudominio.com` una vez verificado

---

## Common Mistakes

- **Hardcoding colors**: Siempre usar `EMAIL_THEME.colors.X` — permite cambiar el tema desde un solo archivo.
- **Usar `<style>` blocks**: Gmail los elimina — todos los estilos deben ser inline.
- **`localhost` en el logo**: Resend no puede acceder a localhost — usar CDN o URL pública en dev.
- **Template directamente en el service**: El service debe ser solo lógica de envío — el HTML va en el archivo de template.
- **Sin `word-break:break-all` en la URL copiable**: URLs largas rompen el layout en mobile.
- **Footer sin año dinámico**: Usar `${new Date().getFullYear()}` para que no quede desactualizado.