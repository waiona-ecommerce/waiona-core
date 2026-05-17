# Módulo de Categorías — Guía para el Negocio

## ¿Qué es una categoría?

Una categoría es una forma de agrupar los productos y combos del catálogo. Por ejemplo, "Bebidas", "Snacks" o "Lácteos". Las categorías permiten que los clientes naveguen el shop de forma ordenada y encuentren rápido lo que buscan.

Las categorías también pueden tener subcategorías. Por ejemplo, "Bebidas" puede contener "Gaseosas", "Aguas" y "Jugos". Esto forma un árbol de dos niveles que organiza el catálogo de forma jerárquica.

## ¿Cómo funciona?

```
Admin crea la categoría raíz (ej: "Bebidas")
        ↓
Admin crea subcategorías dentro de ella (ej: "Gaseosas", "Aguas")
        ↓
Admin asigna cada producto o combo a la categoría correspondiente
        ↓
El shop muestra el árbol de categorías para que el cliente navegue
```

## ¿Para qué sirve este módulo?

Permite organizar el catálogo en secciones. Sin categorías no se pueden cargar productos ni combos: todo artículo del sistema debe pertenecer a una categoría. Las categorías también permiten al shop mostrar un menú de navegación estructurado.

## Cuándo se usa en el negocio

| Situación | Ejemplo de uso |
|---|---|
| Se suma una nueva sección al catálogo | El admin crea "Congelados" como categoría raíz |
| Se quiere subdividir una sección | El admin crea "Helados" y "Precocidos" dentro de "Congelados" |
| Se cambia el nombre de una sección | El admin actualiza "Fiambres" a "Fiambres y Embutidos" |
| Se mueve una subcategoría a otra sección | El admin reasigna "Aguas" de "Bebidas" a "Hidratación" |
| Una sección deja de usarse temporalmente | El admin desactiva la categoría sin borrarla |
| Se elimina una sección vacía | El admin elimina una categoría que ya no tiene productos ni combos |

## ¿Qué puede hacer un administrador?

| Acción | Descripción |
|---|---|
| Crear una categoría | Define nombre, descripción opcional y si tiene padre |
| Ver todas las categorías | Lista paginada con id, nombre, descripción y estado |
| Ver el árbol de categorías | Vista jerárquica: raíces con sus subcategorías anidadas |
| Ver el detalle de una categoría | Información completa de una categoría específica |
| Editar una categoría | Modifica nombre, descripción, estado o categoría padre |
| Desactivar una categoría | Deja de aparecer como opción activa pero no se borra |
| Eliminar una categoría | Se retira del catálogo de forma definitiva (solo si está vacía) |

Solo los administradores y superadministradores pueden gestionar categorías.

## Reglas importantes

- **El nombre es único** — no pueden existir dos categorías con el mismo nombre. Si se intenta, el sistema lo rechaza.
- **La categoría padre debe existir** — al crear una subcategoría, la categoría padre tiene que estar cargada en el sistema.
- **No se pueden crear categorías circulares** — el sistema detecta si el cambio de padre generaría un ciclo (por ejemplo, poner "Bebidas" como hijo de "Gaseosas" cuando "Gaseosas" ya es hija de "Bebidas"). Si detecta el ciclo, rechaza la operación.
- **No se puede eliminar una categoría que tiene productos o combos** — primero hay que reasignar o eliminar todos los productos y combos de esa categoría.
- **Si se elimina una categoría padre, los hijos no se borran** — las subcategorías quedan como categorías raíz (sin padre). No se borran en cascada.
- **Desactivar no es eliminar** — una categoría desactivada no se borra, solo deja de estar disponible como opción activa.
- **Las categorías eliminadas no desaparecen de la base de datos** — quedan guardadas internamente para trazabilidad.

## Ejemplos del día a día

> **Crear una categoría raíz:**
> El admin entra al panel, escribe "Bebidas" y confirma. La categoría queda disponible para asignarle productos y combos.

> **Crear una subcategoría:**
> El admin crea "Gaseosas" y selecciona "Bebidas" como categoría padre. "Gaseosas" queda anidada dentro de "Bebidas" en el árbol del shop.

> **Mover una subcategoría:**
> El admin decide que "Aguas" pasa de pertenecer a "Bebidas" a pertenecer a "Hidratación". Edita "Aguas" y cambia el padre. El cambio se refleja de inmediato en el árbol del shop.

> **Eliminar una categoría vacía:**
> El admin comprueba que "Categoría Test" no tiene productos ni combos asignados y la elimina. Si tuviera productos, el sistema rechazaría la operación con un error.

> **Intentar crear una jerarquía circular:**
> El admin intenta poner "Bebidas" como subcategoría de "Gaseosas", que ya es hija de "Bebidas". El sistema detecta el ciclo y rechaza el cambio para evitar inconsistencias.

## ¿Cómo se conecta con el resto del sistema?

Las categorías son el esqueleto del catálogo. Cada **producto** y cada **combo** pertenece a una categoría. El **shop** usa el árbol de categorías para construir el menú de navegación que ven los clientes. Sin categorías no se pueden cargar artículos, por lo que son lo primero que hay que configurar al arrancar el sistema.
