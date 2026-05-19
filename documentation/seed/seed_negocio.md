# Módulo de Inicialización (Seed) — Guía para el Negocio

## ¿Qué es el módulo seed?

El módulo seed es el proceso de arranque del sistema. Cada vez que la plataforma Waiona inicia, este módulo verifica que existan los datos mínimos necesarios para operar: los tipos de cuenta disponibles y el usuario administrador principal.

No es una función que use ningún empleado directamente — trabaja en segundo plano, de forma automática, cada vez que el sistema se enciende.

---

## ¿Cómo funciona?

Cuando la plataforma arranca, este módulo realiza dos verificaciones en orden:

```
1. ¿Existen los tipos de cuenta en el sistema?
   → Si no existen, los crea (Super Administrador, Administrador, Cliente)
   → Si ya existen, no hace nada
   ↓
2. ¿Existe el usuario Super Administrador?
   → Si no existe, lo crea con las credenciales configuradas
   → Si ya existe, no hace nada
```

Este proceso es completamente seguro de repetir: no importa cuántas veces se reinicie la plataforma, nunca duplicará datos.

---

## ¿Para qué sirve este módulo?

Garantiza que el sistema siempre esté listo para operar desde el primer momento. Sin este módulo, la plataforma arrancaría sin ningún tipo de cuenta definido y sin nadie que pueda administrarla.

Es especialmente crítico en dos situaciones:

- **Primer encendido**: cuando la plataforma se despliega por primera vez, este módulo crea todo lo necesario para que el Super Administrador pueda ingresar y comenzar a configurar el negocio.
- **Reinicio del servidor**: si el servidor se apaga y vuelve a encender, este módulo verifica que todo sigue en orden — y si algo faltara (por ejemplo, por un reset de base de datos en desarrollo), lo recrea automáticamente.

---

## ¿Qué crea este módulo?

### Tipos de cuenta

Crea tres tipos de cuenta que definen qué puede hacer cada usuario en la plataforma:

| Tipo de cuenta | ¿Quién lo tiene? | ¿Qué puede hacer? |
|---|---|---|
| Super Administrador | El dueño o responsable técnico del sistema | Acceso total a todas las funciones |
| Administrador | El personal de gestión del negocio | Gestiona productos, precios, pedidos y stock |
| Cliente | Cualquier persona que se registre | Puede ver productos, hacer pedidos y pagar |

### Usuario Super Administrador

Crea el primer usuario con acceso total al sistema. Sus credenciales (email y contraseña) se configuran antes de encender la plataforma por primera vez y no se pueden cambiar desde aquí — solo desde la gestión de usuarios una vez que el sistema está operativo.

---

## Reglas importantes

- **El proceso es automático** — no requiere ninguna acción manual cada vez que el sistema arranca.
- **No duplica datos** — si los tipos de cuenta o el Super Administrador ya existen, el módulo los detecta y no hace nada.
- **El Super Administrador queda habilitado para ingresar desde el primer momento** — su cuenta se activa automáticamente al crearla, a diferencia de los clientes que necesitan confirmar su email.
- **Las credenciales del Super Administrador se configuran antes del lanzamiento** — son parte de la configuración del servidor, no de la plataforma misma.
- **La contraseña se guarda de forma segura** — nunca se almacena en texto legible, siempre cifrada.

---

## Ejemplos del día a día

**Primer lanzamiento de la plataforma:**
> El equipo técnico despliega Waiona por primera vez. Al encender el servidor, el sistema crea automáticamente los tres tipos de cuenta y el usuario Super Administrador. El responsable del negocio puede ingresar con sus credenciales configuradas y comenzar a cargar productos.

**El servidor se reinicia tras una actualización:**
> El equipo técnico actualiza la plataforma y reinicia el servidor. Al volver a encender, el módulo verifica que los tipos de cuenta y el Super Administrador ya existen — y no hace nada. Todo sigue funcionando normalmente.

**Reset de la base de datos en un entorno de pruebas:**
> El equipo de desarrollo borra la base de datos para empezar desde cero. Al levantar la aplicación, el módulo recrea automáticamente los tipos de cuenta y el Super Administrador, dejando el entorno listo para trabajar sin pasos manuales adicionales.

---

## ¿Cómo se conecta con el resto del sistema?

Este módulo es la base sobre la que opera toda la plataforma:

- Los **tipos de cuenta** que crea son usados por el módulo de autenticación para saber qué nivel de acceso tiene cada usuario que inicia sesión.
- El **Super Administrador** que crea es el primer usuario que puede ingresar al panel de gestión y configurar el resto del sistema: agregar administradores, cargar productos, definir precios y más.
- Sin este módulo funcionando correctamente, nadie podría ingresar al sistema ni gestionar el negocio.
