# Módulo de Correos (Mail) — Guía para el Negocio

## ¿Qué es el módulo mail?

El módulo mail es el sistema de comunicación automática de Waiona. Se encarga de enviar correos electrónicos a los usuarios en momentos clave: cuando se registran por primera vez o cuando necesitan recuperar su contraseña.

No es algo que el equipo use directamente — trabaja en segundo plano, disparado automáticamente por otras partes del sistema.

---

## ¿Cómo funciona?

Cuando ocurre un evento que requiere notificar al usuario, el sistema genera un código de seguridad único y envía un email personalizado:

```
El usuario realiza una acción (registrarse, pedir recuperar contraseña)
  ↓
El sistema genera un código de seguridad de un solo uso
  ↓
Se envía un email con un botón y un link que contiene ese código
  ↓
El usuario hace clic → el sistema valida el código → acción completada
```

El envío se realiza a través de **Resend**, un servicio especializado en emails transaccionales que garantiza la entrega.

---

## ¿Para qué sirve este módulo?

Permite que el sistema se comunique con los usuarios de forma segura y automática. Sin este módulo:

- Los usuarios no podrían activar sus cuentas nuevas
- No habría forma de recuperar una contraseña olvidada

Es la base de la confianza entre la plataforma y sus usuarios.

---

## Emails que envía el sistema

| Email | ¿Cuándo se envía? | ¿Cuánto tiempo es válido el link? |
|---|---|---|
| Activación de cuenta | Inmediatamente después del registro | 24 horas |
| Recuperación de contraseña | Al solicitar el reset de contraseña | 1 hora |

---

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Un cliente nuevo se registra | Recibe un email con un botón para activar su cuenta |
| Un cliente olvidó su contraseña | Recibe un email con un botón para elegir una nueva contraseña |

---

## Reglas importantes

- **Los links tienen vencimiento** — el de activación dura 24 horas y el de recuperación de contraseña solo 1 hora. Si el usuario no los usa a tiempo, debe solicitar uno nuevo.
- **Cada link solo puede usarse una vez** — una vez que el usuario hace clic y completa la acción, el link queda inutilizable.
- **Solo puede haber un link de recuperación activo a la vez** — si el usuario pide uno nuevo, el anterior se cancela automáticamente.
- **El remitente del email está configurado por el equipo técnico** — puede cambiar según el dominio del negocio (ej: `noreply@waiona.com`).
- **En entornos de prueba, los emails solo llegan al correo verificado** — esto es una limitación del servicio de envío durante el desarrollo.

---

## Ejemplos del día a día

**Un cliente nuevo recibe el email de activación:**
> Sofía se registra en Waiona con su email y contraseña. En segundos recibe un correo con el asunto "Activá tu cuenta en Waiona". Hace clic en el botón verde, su cuenta se activa y puede empezar a comprar.

**Un cliente recupera su contraseña:**
> Roberto olvidó su contraseña. Hace clic en "Olvidé mi contraseña", ingresa su email y en minutos recibe un correo con el asunto "Recuperá tu contraseña en Waiona". Tiene 1 hora para hacer clic en el link y elegir una nueva contraseña.

**Un cliente no usó el link a tiempo:**
> Ana recibió el email de activación pero no lo usó en 24 horas. El link ya no funciona. Debe volver a registrarse o contactar al soporte para que el equipo técnico reenvíe el email.

---

## ¿Cómo se conecta con el resto del sistema?

El módulo de correos es un servicio de soporte que no opera de forma independiente:

- El módulo de **autenticación** es quien decide cuándo enviar cada email — mail solo se encarga del envío.
- Los **usuarios** son los destinatarios — cada email va dirigido a la persona que realizó la acción.
- Sin este módulo, el proceso de registro y recuperación de contraseña quedaría incompleto, ya que el sistema no podría comunicarse con los usuarios.
