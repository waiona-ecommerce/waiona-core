# Módulo de Usuarios — Guía para el Negocio

## ¿Qué es un usuario?

Un usuario es cualquier persona registrada en la plataforma Waiona. Cada usuario tiene su nombre, email, contraseña y, opcionalmente, una foto de perfil. Según el acceso que tenga, puede ser un **cliente** (que hace pedidos y ve el catálogo) o un **administrador** (que gestiona productos, precios y operaciones del negocio).

---

## ¿Cómo funciona el registro y acceso?

El recorrido de un usuario nuevo es siempre el mismo:

```
1. La persona completa el formulario de registro (nombre, email, contraseña)
   ↓
2. El sistema crea la cuenta y envía un email de activación
   ↓
3. La persona hace clic en el link del email
   ↓
4. La cuenta queda activa y puede iniciar sesión
   ↓
5. Una vez dentro, puede ver su perfil, editarlo o eliminar su cuenta
```

---

## ¿Para qué sirve este módulo?

Este módulo permite que los administradores **vean y busquen** a las personas registradas en la plataforma, y que cada usuario gestione su propia información personal.

No se puede crear un usuario directamente desde el panel — el registro siempre pasa por el proceso de activación por email, lo que garantiza que cada cuenta tenga una dirección de correo válida.

---

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Un cliente nuevo quiere comprar | Se registra con email y contraseña, activa su cuenta y empieza a pedir |
| El admin quiere ver quién está registrado | Busca en la lista de usuarios por nombre o email |
| Un cliente quiere actualizar sus datos | Cambia su nombre o foto de perfil desde su cuenta |
| Un cliente quiere irse | Solicita eliminar su cuenta — queda desactivada, no borrada |
| El admin quiere encontrar a un usuario específico | Filtra por parte del nombre o del email |

---

## ¿Qué puede hacer cada uno?

### El cliente (usuario registrado)

| Acción | Descripción |
|---|---|
| **Ver** su propio perfil | Nombre, apellido, email, foto y estado de la cuenta |
| **Editar** su perfil | Cambiar nombre, apellido o foto |
| **Eliminar** su cuenta | La cuenta queda desactivada (no se pierde el historial) |

> Un cliente **nunca puede** ver ni modificar el perfil de otro usuario.

### El administrador

| Acción | Descripción |
|---|---|
| **Listar** todos los usuarios | Ver la lista completa con paginación |
| **Buscar** usuarios | Filtrar por email o por nombre/apellido |

---

## Reglas importantes

- **El email es único** — no pueden existir dos cuentas con el mismo email.
- **La contraseña tiene requisitos mínimos** — debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número.
- **Cada usuario solo gestiona su propia cuenta** — no puede ver ni modificar la información de otros.
- **El email y la contraseña no se cambian desde el perfil** — el email es permanente y la contraseña solo se puede cambiar mediante el proceso de recuperación.
- **Las cuentas eliminadas no se borran definitivamente** — quedan marcadas como inactivas y se preserva el historial de pedidos asociado.
- **Los clientes nuevos se asignan automáticamente al rol "cliente"** — no hace falta hacer nada manual.

---

## Ejemplos del día a día

**Un cliente actualiza su nombre:**
> María entra a su perfil y cambia "Maria" por "María Eugenia". El sistema guarda el cambio y lo refleja de inmediato.

**Un cliente quita su foto de perfil:**
> Juan decide sacar su foto de perfil. Edita su perfil y deja el campo de avatar vacío. El sistema lo registra como sin foto.

**Un admin busca a un cliente por apellido:**
> El administrador ingresa "González" en el buscador de usuarios. El sistema devuelve todos los usuarios cuyo nombre o apellido contiene esa palabra.

**Un cliente intenta ver el perfil de otro:**
> El sistema detecta que el token de sesión no corresponde al usuario solicitado y bloquea el acceso con un mensaje de "Acceso denegado".

**Un cliente elimina su cuenta:**
> Pedro solicita eliminar su cuenta. El sistema la desactiva inmediatamente — Pedro no puede volver a ingresar, pero sus pedidos anteriores siguen visibles para el equipo de operaciones.

---

## ¿Cómo se conecta con el resto del sistema?

El módulo de usuarios es la **base de toda la plataforma**:

- El módulo de **autenticación** lo usa para registrar nuevas cuentas, verificar contraseñas al iniciar sesión, activar cuentas y procesar recuperaciones de contraseña.
- El módulo de **pedidos** lo referencia para saber qué cliente realizó cada compra.
- El módulo de **roles** define qué tipo de acceso tiene cada usuario: cliente, administrador o super administrador.

Sin usuarios no hay sesiones, sin sesiones no hay pedidos — es el punto de partida de todo el flujo del negocio.
