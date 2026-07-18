# Jest desde Primeros Principios — Waiona Core

Guía exhaustiva de cada pieza de los tests unitarios del proyecto, con ejemplos tomados directamente del código real.

---

## Índice

1. [¿Qué son los tests unitarios y por qué?](#1-qué-son-los-tests-unitarios-y-por-qué)
2. [Estructura base: describe / it / expect](#2-estructura-base-describe--it--expect)
3. [El Testing Module de NestJS](#3-el-testing-module-de-nestjs)
4. [provide / useFactory / useValue / useClass](#4-provide--usefactory--usevalue--useclass)
5. [getRepositoryToken y getQueueToken y getDataSourceToken](#5-getrepositorytoken-getqueuetoken-y-getdatasourcetoken)
6. [jest.fn() — la función mock](#6-jestfn--la-función-mock)
7. [Mock factories: por qué son funciones que devuelven objetos](#7-mock-factories-por-qué-son-funciones-que-devuelven-objetos)
8. [Factory functions para datos de prueba](#8-factory-functions-para-datos-de-prueba)
9. [Configurar retornos: mockReturnValue, mockResolvedValue, mockRejectedValue](#9-configurar-retornos-mockreturnvalue-mockresolvedvalue-mockrejectedvalue)
10. [Respuestas secuenciales: mockResolvedValueOnce](#10-respuestas-secuenciales-mockresolvedvalueonce)
11. [mockImplementation y mockImplementationOnce](#11-mockimplementation-y-mockimplementationonce)
12. [mockReturnThis — para method chaining](#12-mockreturnthis--para-method-chaining)
13. [beforeEach y afterEach — ciclo de vida](#13-beforeeach-y-aftereach--ciclo-de-vida)
14. [jest.clearAllMocks, mockReset y mockRestore](#14-jestclearallmocks-mockreset-y-mockrestore)
15. [Matchers de expect](#15-matchers-de-expect)
16. [expect.objectContaining y expect.any](#16-expectobjectcontaining-y-expectany)
17. [Testear excepciones y errores](#17-testear-excepciones-y-errores)
18. [resolves y rejects — Promise matchers](#18-resolves-y-rejects--promise-matchers)
19. [jest.mock — mockear módulos completos](#19-jestmock--mockear-módulos-completos)
20. [jest.requireActual — mock parcial de módulo](#20-jestrequireactual--mock-parcial-de-módulo)
21. [Castear mocks: as jest.Mock](#21-castear-mocks-as-jestmock)
22. [mock.calls — inspeccionar argumentos crudos](#22-mockcalls--inspeccionar-argumentos-crudos)
23. [El patrón mockDataSource.transaction](#23-el-patrón-mockdatasourcetransaction)
24. [overrideGuard — saltear guards en controller specs](#24-overrideguard--saltear-guards-en-controller-specs)
25. [jest.Mocked<T> — tipado de mocks](#25-jestmockedt--tipado-de-mocks)
26. [as unknown as T — casting TypeScript para mocks parciales](#26-as-unknown-as-t--casting-typescript-para-mocks-parciales)
27. [Hooks anidados: beforeEach/afterEach dentro de describe](#27-hooks-anidados-beforeeachaftereach-dentro-de-describe)
28. [Helper functions de setup locales (setupTx, makeJob)](#28-helper-functions-de-setup-locales-setuptx-makejob)
29. [mockImplementation con ConfigService](#29-mockimplementation-con-configservice)
30. [describe con valor dinámico (enum como nombre)](#30-describe-con-valor-dinámico-enum-como-nombre)
31. [Diferencias entre service spec y controller spec](#31-diferencias-entre-service-spec-y-controller-spec)
32. [El patrón Arrange / Act / Assert (AAA)](#32-el-patrón-arrange--act--assert-aaa)
33. [Cómo leer un test complejo de punta a punta](#33-cómo-leer-un-test-complejo-de-punta-a-punta)

---

## 1. ¿Qué son los tests unitarios y por qué?

Un test unitario verifica **una unidad de lógica en aislamiento**: un service, un controller, una función. El objetivo es testear **el comportamiento de tu propio código** cuando las dependencias externas (base de datos, APIs, otros services) se comportan de maneras determinadas.

El contrato de cada test es exactamente: *"dado que el repo devuelve X, mi service debe hacer Y"*.

**Por qué no testear contra la DB real:**
- Los tests serían lentos (100ms vs 1ms por test)
- No podés controlar el estado exacto de la DB en cada caso
- Un fallo de red o de la DB rompería tests que no tienen nada que ver con eso
- Los tests serían no deterministas — el mismo test puede pasar o fallar según el estado de la DB

**La diferencia entre unit test, integration test y e2e:**
- **Unit test** (lo que hacemos acá): una sola clase, todas las dependencias mockeadas
- **Integration test**: varias clases reales juntas, la DB puede ser real
- **E2E test**: servidor completo levantado, request HTTP real de punta a punta

---

## 2. Estructura base: describe / it / expect

```ts
describe('OrdersService', () => {      // bloque contenedor — nombre del grupo
  describe('create', () => {           // subgrupo — nombre del método
    it('should create an order', () => {   // un test individual
      // arrange → act → assert
      expect(result.id).toBe(1);
    });
  });
});
```

### `describe(nombre, fn)`

Agrupa tests relacionados bajo un nombre. Se anidan para organizar jerárquicamente:

```
describe('OrdersService')
  describe('create')
    it('should create an order with product')
    it('should throw NotFoundException if user not found')
  describe('findAll')
    it('should return all orders')
```

La salida del runner muestra este árbol: `OrdersService › create › should throw NotFoundException if user not found`. El nombre del describe se convierte en el contexto de cada falla.

El string dentro de `describe` puede ser **cualquier cosa** — incluyendo el valor de un enum (ver sección 30).

### `it(nombre, fn)` / `test(nombre, fn)`

Define un test individual. `it` y `test` son exactamente lo mismo — `it` se usa para que el nombre del test lea como una oración en inglés: *"it should create an order"*. Acá en el proyecto se usa `it` en todos lados.

La función `fn` puede ser síncrona o `async`. Jest detecta automáticamente si es una Promise y espera a que resuelva.

### `expect(valor).matcher()`

Es la aserción. Si el matcher falla, el test falla. Se pueden poner múltiples `expect` en un solo test — si alguno falla, el test para ahí.

---

## 3. El Testing Module de NestJS

NestJS tiene su propio sistema de inyección de dependencias (DI). Para testear una clase en aislamiento, necesitás crear un módulo mínimo que solo contenga esa clase y sus dependencias mockeadas.

```ts
// src/modules/orders/services/orders.service.spec.ts:174
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      OrdersService,                                              // la clase REAL
      { provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo },
      { provide: StockItemsService,               useFactory: mockStockService },
      { provide: DataSource,                      useValue: mockDataSource },
    ],
  }).compile();

  service  = module.get<OrdersService>(OrdersService);
  orderRepo = module.get(getRepositoryToken(OrderEntity));
});
```

**Paso a paso:**

1. `Test.createTestingModule({ providers: [...] })` — crea un módulo NestJS mínimo. Solo contiene lo que le decís explícitamente — no hay auto-discovery de clases ni carga de módulos reales.

2. El array `providers` registra qué está disponible en el DI:
   - La clase real (`OrdersService`) — esta es la que vas a testear
   - Las dependencias falsas — cada una registrada bajo el token que el service real espera recibir

3. `.compile()` — NestJS resuelve el grafo de dependencias: ve que `OrdersService` necesita un `Repository<OrderEntity>`, busca el provider con ese token, lo inyecta. Devuelve una Promise porque el proceso puede ser async.

4. `module.get<T>(Token)` — obtiene la instancia del contenedor. El tipo genérico `<T>` es solo para TypeScript; el argumento real es el token (una clase o string).

**Por qué se reasignan a variables fuera del `beforeEach`:**

```ts
let service: OrdersService;
let orderRepo: any;

beforeEach(async () => {
  // ...compile...
  service   = module.get<OrdersService>(OrdersService);
  orderRepo = module.get(getRepositoryToken(OrderEntity));
});

it('test 1', () => {
  orderRepo.findOne.mockResolvedValue(entity);  // accede a la var
  service.create(dto);
});
```

Las variables `service` y `orderRepo` son reasignadas en cada `beforeEach`, entonces cada `it` tiene instancias frescas. Si estuvieran declaradas dentro del `beforeEach`, no serían accesibles desde los `it`.

---

## 4. provide / useFactory / useValue / useClass

Son las tres formas de registrar dependencias en el contenedor de DI de NestJS:

### `useFactory`

```ts
{ provide: StockItemsService, useFactory: mockStockService }
```

NestJS llama a `mockStockService()` para obtener el valor. **Se llama en cada `beforeEach`**, produciendo un objeto nuevo con `jest.fn()` frescos. Es la opción por defecto para mocks de services y repos.

```ts
const mockStockService = () => ({
  reserveStock:      jest.fn(),   // ← nueva instancia de jest.fn() cada vez
  dispatchStock:     jest.fn(),
  releaseReservation: jest.fn(),
});
```

### `useValue`

```ts
{ provide: DataSource, useValue: mockDataSource }
```

NestJS usa el objeto directamente, **sin llamar ninguna función**. El mismo objeto es inyectado en todos los tests. Se usa cuando:
- Necesitás acceder al objeto desde afuera del módulo para configurarlo (ej: `mockDataSource.transaction`)
- O cuando el objeto tiene estado que controlás manualmente

El riesgo: si un test modifica el objeto, el siguiente test hereda esa modificación. Por eso cuando se usa `useValue`, hay que resetear manualmente en `afterEach`.

### `useClass`

```ts
{ provide: AuthGuard, useClass: MockAuthGuard }
```

NestJS instancia la clase alternativa. Menos usado en tests unitarios — más común en tests de integración.

---

## 5. getRepositoryToken, getQueueToken y getDataSourceToken

Estas tres funciones son los **tokens de DI** para dependencias de librerías de NestJS.

### `getRepositoryToken(Entity)`

```ts
import { getRepositoryToken } from '@nestjs/typeorm';

{ provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo }
```

Cuando en el service hacés:
```ts
@InjectRepository(OrderEntity)
private orderRepo: Repository<OrderEntity>
```

NestJS registra internamente este repo con un token derivado de la entidad. `getRepositoryToken(OrderEntity)` te da ese mismo token para que podás registrar un mock que ocupe su lugar.

Sin esto, NestJS no encontraría el provider y tiraría error al compilar el module.

### `getQueueToken(nombre)`

```ts
import { getQueueToken } from '@nestjs/bull';
// src/modules/mail/services/mail.service.spec.ts:27
{ provide: getQueueToken(MAIL_QUEUE), useValue: mockQueue }
```

Mismo principio pero para colas BullMQ. Cuando el `MailService` inyecta la cola con `@InjectQueue(MAIL_QUEUE)`, busca el provider con ese token.

### `getDataSourceToken()`

```ts
import { getDataSourceToken } from '@nestjs/typeorm';
// src/modules/payments/services/payments.service.spec.ts:96
{ provide: getDataSourceToken(), useValue: mockDataSource }
```

Alternativa a usar `DataSource` directamente como token. Ambas formas funcionan:
```ts
{ provide: DataSource,          useValue: mockDataSource }  // forma directa
{ provide: getDataSourceToken(), useValue: mockDataSource }  // forma NestJS
```

`getDataSourceToken()` es más correcta en proyectos con múltiples DataSources porque podés pasarle un nombre.

---

## 6. jest.fn() — la función mock

`jest.fn()` crea una función que por defecto no hace nada (devuelve `undefined`), pero **registra todo**: cuántas veces fue llamada, con qué argumentos, qué devolvió en cada llamada.

```ts
const fn = jest.fn();

fn('hola', 42);
fn('chau');

// Inspección:
fn.mock.calls          // [['hola', 42], ['chau']]
fn.mock.calls[0]       // ['hola', 42]
fn.mock.calls[0][0]    // 'hola'
fn.mock.calls[0][1]    // 42
fn.mock.results[0]     // { type: 'return', value: undefined }
fn.mock.instances      // [undefined, undefined] (solo importa en constructores)
```

Cuando hacés `expect(fn).toHaveBeenCalledWith('hola', 42)`, Jest consulta `fn.mock.calls` internamente.

La propiedad `.mock` existe solo en funciones creadas con `jest.fn()`. Si tratás de hacer `expect(unaFuncionNormal).toHaveBeenCalled()`, Jest tira error porque no puede trackear llamadas de funciones normales.

---

## 7. Mock factories: por qué son funciones que devuelven objetos

```ts
// src/modules/orders/services/orders.service.spec.ts:28
const mockOrderRepo = () => ({
  find:         jest.fn(),
  findOne:      jest.fn(),
  findAndCount: jest.fn(),
  create:       jest.fn(),
  save:         jest.fn(),
});
```

**¿Por qué `() => ({...})` y no directamente `{...}`?**

Con `useFactory: mockOrderRepo`, NestJS llama a la función en **cada `beforeEach`**. Eso significa que cada test recibe un objeto nuevo con `jest.fn()` nuevos que no tienen historial de llamadas previas.

Comparación:

```ts
// ✅ CON factory — objeto nuevo en cada test
const mockOrderRepo = () => ({ findOne: jest.fn() });
{ provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo }

// ❌ SIN factory — mismo objeto, acumulación de historial entre tests
const mockOrderRepoObj = { findOne: jest.fn() };
{ provide: getRepositoryToken(OrderEntity), useValue: mockOrderRepoObj }
// → si el test 1 llama findOne, el test 2 ve esa llamada en el historial
//   aunque llames jest.clearAllMocks() el historial puede persistir de formas inesperadas
```

---

## 8. Factory functions para datos de prueba

```ts
// src/modules/orders/services/orders.service.spec.ts:80
const mockUser = (overrides: any = {}) => ({
  id: 1,
  email: 'juan@test.com',
  isDeleted: false,
  ...overrides,
});
```

Patrón clave del proyecto: funciones que devuelven objetos con **valores por defecto razonables** y aceptan `overrides` para personalizar exactamente lo que cada test necesita.

```ts
// Caso base — usuario normal
userRepo.findOne.mockResolvedValue(mockUser());

// Testear un usuario inactivo — solo cambio lo relevante
usersService.findByEmail.mockResolvedValue(mockUser({ isActive: false }));

// Testear orden en otro estado — el resto de campos sigue igual
mockEntityManager.findOne.mockResolvedValue(
  mockOrder({ status: OrderStatus.CANCELLED })
);
```

**Ventajas:**
- Evita repetir todos los campos en cada test
- El test comunica exactamente qué tiene de especial ese caso: `mockUser({ isActive: false })` ya explica el escenario
- Si la entidad cambia, solo actualizás la factory

**La variante con `as unknown as EntityType`:**

```ts
// src/modules/auth/services/auth.service.spec.ts:92
const mockUser = (overrides = {}): UserEntity =>
  ({
    id: 1,
    email: 'juan@test.com',
    password: 'hashed_pw',
    isActive: true,
    profile: { name: 'Juan', lastName: 'Pérez' },
    role: { type: RoleType.CLIENT },
    ...overrides,
  }) as unknown as UserEntity;
```

El doble cast `as unknown as UserEntity` es para satisfacer TypeScript: el objeto literal no implementa todos los métodos y propiedades de `UserEntity`, pero en el test no los necesitamos. El cast primero a `unknown` "rompe" el sistema de tipos y luego a `UserEntity` lo reconstruye. Ver sección 26 para más detalle.

---

## 9. Configurar retornos: mockReturnValue, mockResolvedValue, mockRejectedValue

### mockReturnValue — síncrono

```ts
repo.create.mockReturnValue(entity);
mockQB.where.mockReturnValue(mockQB);  // síncrono, no async
```

Úsalo cuando la función real devuelve directamente un valor (no una Promise). `repo.create()` de TypeORM es síncrono — solo construye el objeto en memoria, no va a la DB.

### mockResolvedValue — async exitoso

```ts
repo.findOne.mockResolvedValue(entity);
// equivale a: repo.findOne.mockReturnValue(Promise.resolve(entity))
```

La gran mayoría de métodos de repositorios TypeORM son async. Usá esto siempre para métodos de repos como `find`, `findOne`, `save`, `update`, `softDelete`.

### mockRejectedValue — async que falla

```ts
// src/modules/auth/services/auth.service.spec.ts:503
usersService.updatePassword.mockRejectedValue(new Error('DB error'));
// equivale a: mockReturnValue(Promise.reject(new Error('DB error')))
```

Simula que la operación falló. Útil para testear manejo de errores.

**Regla práctica rápida:**

| El método real... | Usar |
|---|---|
| Devuelve un valor directo | `mockReturnValue` |
| Es `async` / devuelve Promise | `mockResolvedValue` |
| Puede fallar | `mockRejectedValue` |
| Devuelve `this` (chaining) | `mockReturnThis` |

---

## 10. Respuestas secuenciales: mockResolvedValueOnce

```ts
// src/modules/orders/services/orders.service.spec.ts:334
mockEntityManager.findOne
  .mockResolvedValueOnce({ id: 1, code: 'DESC10', ... })   // 1ra llamada
  .mockResolvedValueOnce({ id: 1 });                        // 2da llamada
```

`mockResolvedValueOnce` aplica **solo para la próxima invocación** del mock. Después de usarse, la siguiente llamada usa el siguiente `Once` en la cadena, o cae al `mockResolvedValue` permanente si lo hay.

**Cuándo es imprescindible:**

Dentro de una transacción, el mismo `manager.findOne` se puede llamar varias veces para entidades distintas:

```
1ra llamada: findOne(CouponEntity, ...)    → devuelve el cupón
2da llamada: findOne(CouponUsageEntity, .) → devuelve null (sin uso previo)
```

Si usás `mockResolvedValue` sin `Once`, ambas llamadas devuelven lo mismo — no podés distinguirlas.

**Podés mezclar `Once` con el valor permanente:**

```ts
repo.findOne
  .mockResolvedValueOnce(entityA)   // primera llamada → entityA
  .mockResolvedValueOnce(entityB)   // segunda llamada → entityB
  // tercera llamada en adelante → devuelve undefined (no hay more)
  // o si también tenés mockResolvedValue(defaultValue), usa ese
```

**Para `find` con múltiples llamadas:**

```ts
// src/modules/orders/services/orders.service.spec.ts:595
mockEntityManager.find
  .mockResolvedValueOnce([stockForProduct10])   // stock de producto 10
  .mockResolvedValueOnce([stockForProduct11])   // stock de producto 11
  .mockResolvedValueOnce([{ couponId: 3, comboId: 1 }]);  // target del cupón
```

El orden importa: el primero `Once` corresponde a la primera llamada real en el código.

---

## 11. mockImplementation y mockImplementationOnce

`mockImplementation` es la versión más poderosa: en lugar de retornar un valor fijo, le pasás una función que se ejecuta cada vez que se llama el mock.

### Caso básico — función que recibe argumentos

```ts
// src/modules/seed/services/seed.service.spec.ts:88
roleRepo.create.mockImplementation((data: any) => data);
// → cuando se llame roleRepo.create({ type: 'admin' }), devuelve { type: 'admin' }
```

Esto simula el comportamiento real de `repo.create()` de TypeORM: toma un objeto plain y lo devuelve "como entidad" (sin ir a la DB). Si usaras `mockReturnValue({ type: 'admin' })`, siempre devuelve lo mismo sin importar qué le pasés — no es lo que querés cuando el test verifica que el objeto creado tiene los datos del DTO.

### Caso avanzado — constructor de clase mockeada

```ts
// src/modules/mail/processors/mail.processor.spec.ts:32
(Resend as jest.Mock).mockImplementation(() => ({
  emails: { send: mockSend },
}));
```

`Resend` fue mockeado con `jest.mock('resend')`, entonces su constructor es un `jest.Mock`. Con `mockImplementation`, cuando el código haga `new Resend(apiKey)`, en lugar de crear una instancia real de Resend, recibe el objeto `{ emails: { send: mockSend } }`.

### Caso avanzado — clase con estado interno

```ts
// src/modules/payments/services/payments.service.spec.ts:241
(MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
  get: jest.fn().mockResolvedValue({
    order_status: 'paid',
    external_reference: '1',
  }),
}));
```

`mockImplementationOnce` aplica solo para la próxima vez que se llame el constructor. Es el mismo patrón que `mockResolvedValueOnce` pero para implementaciones completas. Acá el código hace `new MerchantOrder(client)` y en lugar de un objeto real de MP, recibe un objeto con un método `get` que devuelve un response fijo.

### ConfigService con mockImplementation

```ts
// src/modules/seed/services/seed.service.spec.ts:52
{
  provide: ConfigService,
  useValue: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'SUPERADMIN_EMAIL') return 'super@test.com';
      if (key === 'SUPERADMIN_PASSWORD') return 'secret';
      return null;
    }),
  },
},
```

El `ConfigService.get(key)` devuelve distintos valores según la key. Con `mockReturnValue` solo podés retornar lo mismo para todas las keys. Con `mockImplementation` recibís el argumento y podés hacer lógica condicional — simulando exactamente cómo funciona la config real.

---

## 12. mockReturnThis — para method chaining

```ts
// src/modules/users/services/users.service.spec.ts:16
const mockQB = {
  addSelect:        jest.fn().mockReturnThis(),
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where:            jest.fn().mockReturnThis(),
  andWhere:         jest.fn().mockReturnThis(),
  skip:             jest.fn().mockReturnThis(),
  take:             jest.fn().mockReturnThis(),
  getOne:           jest.fn(),       // ← este sí devuelve algo real
  getManyAndCount:  jest.fn(),
};
```

El QueryBuilder de TypeORM usa method chaining:

```ts
// Código real en el service
repo.createQueryBuilder('user')
  .addSelect('user.password')
  .leftJoinAndSelect('user.profile', 'profile')
  .where('user.id = :id', { id })
  .getOne();
```

Cada método devuelve el mismo QueryBuilder para poder encadenar. `mockReturnThis()` hace exactamente eso: cuando llaman a `addSelect(...)`, devuelve el mismo objeto mock (`this`), entonces el encadenamiento no explota.

El método terminal — `getOne()`, `getManyAndCount()`, `getRawMany()` — no usa `mockReturnThis` porque es ahí donde el QBuilder realmente va a la DB y devuelve los datos. Ese sí lo configurás con `mockResolvedValue`.

**En analytics, el QB tiene más métodos y se construye dinámicamente:**

```ts
// src/modules/analytics/analytics.service.spec.ts:16
const buildMockQB = () => {
  const qb: any = {
    select:      jest.fn().mockReturnThis(),
    addSelect:   jest.fn().mockReturnThis(),
    where:       jest.fn().mockReturnThis(),
    andWhere:    jest.fn().mockReturnThis(),
    groupBy:     jest.fn().mockReturnThis(),
    addGroupBy:  jest.fn().mockReturnThis(),
    orderBy:     jest.fn().mockReturnThis(),
    limit:       jest.fn().mockReturnThis(),
    innerJoin:   jest.fn().mockReturnThis(),
    getRawMany:  jest.fn().mockResolvedValue([]),
    getRawOne:   jest.fn().mockResolvedValue({ v: '0' }),
  };
  qb.clone = jest.fn().mockReturnValue(qb);
  return qb;
};
```

`qb.clone = jest.fn().mockReturnValue(qb)` — `clone()` es un método especial del QBuilder que crea una copia. En el mock, en lugar de hacer una copia, devuelve el mismo objeto. Esto funciona porque en los tests no importa si es una copia real o el mismo objeto — solo importa el resultado final de `getRawMany` / `getRawOne`.

---

## 13. beforeEach y afterEach — ciclo de vida

Son **hooks** que se ejecutan automáticamente antes/después de cada test.

```
Para cada `it`:
  1. beforeEach (del describe padre más externo)
  2. beforeEach (del describe más cercano)
  3. → ejecuta el it
  4. afterEach (del describe más cercano)
  5. afterEach (del describe padre más externo)
```

### beforeEach — recrear el módulo

```ts
beforeEach(async () => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      OrdersService,
      { provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo },
    ],
  }).compile();

  service   = module.get<OrdersService>(OrdersService);
  orderRepo = module.get(getRepositoryToken(OrderEntity));
});
```

Cada test arranca con un `OrdersService` nuevo y repos completamente frescos. Esto garantiza **aislamiento total** entre tests.

### afterEach — limpieza

```ts
afterEach(() => {
  jest.clearAllMocks();
});
```

Limpia el historial de llamadas de todos los mocks. Ver sección 14 para más detalle de las diferencias.

---

## 14. jest.clearAllMocks, mockReset y mockRestore

Tres niveles de limpieza, de menos a más agresivo:

### jest.clearAllMocks()

```ts
afterEach(() => jest.clearAllMocks());
```

**Borra:** el historial de llamadas (`.mock.calls`, `.mock.results`, `.mock.instances`) de todos los `jest.fn()` del proceso.

**NO borra:** la implementación configurada con `mockReturnValue`, `mockResolvedValue`, etc.

Es el que se usa en casi todos los `afterEach` del proyecto porque los providers con `useFactory` ya se recrean en el próximo `beforeEach`, así que no importa si la implementación persiste.

### mockReset()

```ts
// src/modules/orders/services/orders.service.spec.ts:218
afterEach(() => {
  jest.clearAllMocks();
  Object.values(mockManagerRepo).forEach((fn) => fn.mockReset?.());
});
```

**Borra:** historial de llamadas + implementación configurada. Deja la función como si acabara de ser creada con `jest.fn()`.

**Cuándo usarlo:** cuando un mock usa `useValue` (singleton compartido entre tests) y querés garantizar que el próximo test no hereda ninguna configuración del anterior. `mockManagerRepo` existe fuera del `beforeEach` como un singleton, por eso necesita `mockReset`.

El `?.` es optional chaining — `fn.mockReset?.()` — porque si `fn` no es un jest.fn(), simplemente no llama nada en lugar de explotar.

### mockRestore()

Restaura la implementación **original** de la función — solo funciona en mocks creados con `jest.spyOn()`. No se usa directamente en este proyecto pero es bueno saber que existe.

---

## 15. Matchers de expect

Los matchers son funciones que comparan el valor de `expect(valor)` contra algo esperado.

### Igualdad

```ts
// Identidad estricta — usa ===
expect(result.id).toBe(1);
expect(typeof result.refresh_token).toBe('string');

// Igualdad profunda — deep equal (como JSON.stringify)
expect(result).toEqual({ id: 1, status: 'PENDING' });
expect(result.data).toEqual([]);

// Nulidad
expect(rt.revokedAt).not.toBeNull();
expect(result).toBeNull();
expect(result).toBeUndefined();

// Verdad
expect(result).toBeTruthy();   // cualquier valor truthy
expect(result).toBeFalsy();    // null, undefined, 0, '', false
```

`toBe` usa `===` — falla con objetos porque `{a:1} !== {a:1}`. Para objetos, usá `toEqual` que compara estructura y valores recursivamente.

### Colecciones

```ts
expect(result.data).toHaveLength(1);      // .length === 1
expect(result).toHaveLength(0);           // string o array vacío

// El array contiene exactamente estos elementos
expect(result).toEqual(['a', 'b']);

// El array contiene estos elementos (puede haber más, en cualquier orden)
expect(result).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ productId: 10 }),
    expect.objectContaining({ productId: 11 }),
  ])
);
```

### Calls de mocks

```ts
// Fue llamado al menos una vez
expect(stockService.reserveStock).toHaveBeenCalled();

// Fue llamado exactamente N veces
expect(stockService.dispatchStock).toHaveBeenCalledTimes(2);

// Fue llamado con estos argumentos (al menos una de las llamadas)
expect(service.create).toHaveBeenCalledWith(1, dto);

// NO fue llamado
expect(stockService.releaseReservation).not.toHaveBeenCalled();
```

### Tipos e instancias

```ts
expect(result).toBeInstanceOf(Date);     // instanceof
expect(typeof token).toBe('string');     // typeof
```

---

## 16. expect.objectContaining y expect.any

Permiten hacer aserciones **parciales** cuando no te importan todos los campos.

### expect.objectContaining

```ts
// src/modules/auth/services/auth.service.spec.ts:453
expect(tokenRepo.update).toHaveBeenCalledWith(
  { userId: 1, type: TokenType.PASSWORD_RESET },
  expect.objectContaining({ usedAt: expect.any(Date) }),
);
```

Verifica que el segundo argumento sea un objeto que **contenga** la propiedad `usedAt` con cualquier valor de tipo `Date`, sin importar qué otras propiedades tenga el objeto.

Sin `objectContaining`, tendrías que conocer el valor exacto de `usedAt` (que es `new Date()` en el momento de ejecución — imposible de predecir en el test).

```ts
// Otro ejemplo del proyecto:
expect(mockEntityManager.save).toHaveBeenCalledWith(
  CouponEntity,
  expect.objectContaining({ usageCount: 6 }),
);
// → verifica que el segundo arg sea un objeto con usageCount: 6
//   sin importar las otras 10 propiedades del cupón
```

### expect.any(Constructor)

```ts
expect.any(Date)       // cualquier instancia de Date
expect.any(Number)     // cualquier número
expect.any(String)     // cualquier string
expect.any(Object)     // cualquier objeto
expect.any(Function)   // cualquier función
```

```ts
// src/modules/mail/services/mail.service.spec.ts:49
expect(mockQueue.add).toHaveBeenCalledWith(
  MailJobType.SEND_ACTIVATION,
  expect.objectContaining({ to: 'user@test.com' }),
  expect.any(Object),  // el tercer arg (opciones de Bull) — no me importa el valor exacto
);
```

---

## 17. Testear excepciones y errores

### Excepciones en funciones async

```ts
// La forma correcta para funciones async
await expect(service.create(99, dto)).rejects.toThrow(NotFoundException);

// También podés verificar el mensaje
await expect(service.create(99, dto)).rejects.toThrow('User not found');

// O la instancia exacta
await expect(service.create(99, dto)).rejects.toThrow(
  new NotFoundException('User with id 99 not found')
);
```

### Excepciones en funciones síncronas

```ts
// src/modules/orders/controllers/orders.controller.spec.ts:128
expect(() =>
  controller.findByUser(2, mockJwt(1, RoleType.CLIENT)),
).toThrow(ForbiddenException);
```

Para funciones síncronas, envolvés la llamada en una arrow function. Jest la ejecuta y captura el error.

**¿Por qué envolver en `() =>`?**

Si escribís `expect(controller.findByUser(2, mockJwt(1))).toThrow(...)`, la función se ejecuta antes de que `expect` pueda capturar el error — el test explota sin control. Con `() => controller.findByUser(...)`, Jest recibe la función sin ejecutarla, la ejecuta él mismo dentro de un try/catch, y puede verificar la excepción.

### Error sin tipo específico

```ts
await expect(service.refresh('raw_token')).rejects.toThrow('DB error');
// verifica que el mensaje de error contenga 'DB error'
```

---

## 18. resolves y rejects — Promise matchers

Son los complementos de `.toThrow()` para Promises.

### resolves — verificar que la Promise resuelve

```ts
// src/modules/auth/services/auth.service.spec.ts:426
await expect(service.forgotPassword('x@x.com')).resolves.toBeUndefined();
```

Verifica que la Promise se resuelve **sin error** Y que el valor resuelto es `undefined`. Es importante el `await` — sin él, el test termina antes de que la Promise resuelva.

```ts
// También podés encadenar cualquier matcher:
await expect(service.login(user)).resolves.toEqual(
  expect.objectContaining({ access_token: expect.any(String) })
);
```

### rejects — verificar que la Promise rechaza

```ts
await expect(service.create(99, dto)).rejects.toThrow(NotFoundException);
```

### resolves.not.toThrow — verificar que no lanza

```ts
// src/modules/payments/services/payments.service.spec.ts:214
await expect(
  service.handleMercadoPagoWebhook({}, { id: '1', topic: 'merchant_order' })
).resolves.not.toThrow();
```

Verifica que la función termina sin lanzar error — aunque internamente haya capturado errores. Útil para testear el comportamiento "swallow errors" del webhook de MercadoPago: el webhook siempre debe responder 200, nunca explotar.

---

## 19. jest.mock — mockear módulos completos

Algunas dependencias no se inyectan vía DI de NestJS — son imports directos en el código (`bcrypt`, `crypto`, `resend`, `mercadopago`). Para mockearlas se usa `jest.mock`.

```ts
// src/modules/auth/services/auth.service.spec.ts:7
jest.mock('bcrypt', () => ({ compare: jest.fn() }));
import * as bcrypt from 'bcrypt';

// src/modules/mail/processors/mail.processor.spec.ts:14
jest.mock('resend');
import { Resend } from 'resend';

// src/modules/payments/services/payments.service.spec.ts:20
jest.mock('mercadopago', () => ({
  MerchantOrder:    jest.fn(),
  Payment:          jest.fn(),
  MercadoPagoConfig: jest.fn(),
  Preference:       jest.fn(),
}));
```

**Comportamiento clave: hoisting**

Jest mueve los `jest.mock(...)` al principio del archivo automáticamente, **antes que todos los `import`**. Por eso podés escribir `jest.mock` después de los imports en el código fuente y aun así funciona — en runtime, el mock ya está registrado cuando el módulo se importa.

**Dos variantes:**

1. `jest.mock('módulo')` — sin factory: reemplaza todas las exportaciones con `jest.fn()` automáticamente. Úsalo cuando querés mockear todo.

2. `jest.mock('módulo', () => ({ ... }))` — con factory: vos definís exactamente qué exporta el módulo mockeado. Úsalo cuando necesitás control preciso o la forma del mock importa.

---

## 20. jest.requireActual — mock parcial de módulo

```ts
// src/modules/auth/services/auth.service.spec.ts:10
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return {
    ...actual,           // ← mantiene todas las funciones reales
    randomBytes: jest.fn(() => Buffer.from('deadbeef'.repeat(8), 'hex')),
    createHash: jest.fn(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn(() => 'hashed_token'),
    })),
  };
});
```

`jest.requireActual('crypto')` obtiene el módulo **sin mockear** — el real. Dentro de un `jest.mock`, `require` normal daría el módulo mockeado (infinito recursivo). `requireActual` bypasea el sistema de mocks para darte el original.

**Cuándo usarlo:** cuando querés reemplazar solo 2 funciones de un módulo de 20, dejando las otras 18 funcionando normalmente. Acá se reemplaza `randomBytes` y `createHash` para que los tokens generados sean predecibles (`'hashed_token'`), pero el resto de `crypto` funciona normalmente.

El `<typeof import('crypto')>` es TypeScript — le dice a TS que el resultado de `requireActual` tiene el tipo del módulo `crypto`, para tener autocompletado.

---

## 21. Castear mocks: as jest.Mock

Cuando `jest.mock('módulo')` reemplaza una clase, el constructor se convierte en un `jest.Mock`. Pero TypeScript no lo sabe — sigue pensando que es la clase original.

```ts
// src/modules/mail/processors/mail.processor.spec.ts:32
(Resend as jest.Mock).mockImplementation(() => ({
  emails: { send: mockSend },
}));

// src/modules/payments/services/payments.service.spec.ts:241
(MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
  get: jest.fn().mockResolvedValue({ order_status: 'paid', ... }),
}));
```

El cast `as jest.Mock` le dice a TypeScript: "tratá esta clase como un jest.Mock, que tiene `.mockImplementation()`". Sin el cast, TypeScript tiraría error: `Property 'mockImplementation' does not exist on type 'typeof Resend'`.

**En el afterEach de payments:**

```ts
afterEach(() => {
  (MerchantOrder as jest.Mock).mockReset();
  (Payment as jest.Mock).mockReset();
});
```

Resetea los constructores mockeados entre tests. Si no lo hacés, el `mockImplementationOnce` del test anterior podría interferir.

---

## 22. mock.calls — inspeccionar argumentos crudos

```ts
// src/modules/mail/processors/mail.processor.spec.ts:82
await processor.sendActivation(job);

const html: string = mockSend.mock.calls[0][0].html;
expect(html).not.toContain('<script>');
expect(html).toContain('&lt;script&gt;');
```

`mockSend.mock.calls` es un array de arrays: `[[args de llamada 1], [args de llamada 2], ...]`. `mock.calls[0][0]` es el primer argumento de la primera llamada.

**Cuándo es necesario acceder a `.mock.calls` directamente:**

Cuando querés inspeccionar una parte del argumento que `toHaveBeenCalledWith` no te permite verificar fácilmente — en este caso, el contenido HTML generado dinámicamente. Verificás que el HTML renderizado **escapó** caracteres peligrosos, lo que es una prueba de seguridad XSS.

Usando `toHaveBeenCalledWith` aquí sería difícil porque el HTML completo es una string enorme. Acceder a `.mock.calls[0][0].html` y hacer aserciones sobre substrings es mucho más legible.

---

## 23. El patrón mockDataSource.transaction

Este es el patrón más complejo del proyecto — para testear lógica que ocurre dentro de una transacción de base de datos.

```ts
// src/modules/orders/services/orders.service.spec.ts:62
const mockManagerRepo = {
  findOne: jest.fn(),
  find:    jest.fn(),
  save:    jest.fn(),
  create:  jest.fn(),
};

const mockEntityManager = {
  findOne:      jest.fn(),
  find:         jest.fn(),
  create:       jest.fn(),
  save:         jest.fn(),
  softDelete:   jest.fn(),
  getRepository: jest.fn(() => mockManagerRepo),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockEntityManager)),
};
```

**Cómo funciona en producción:**

```ts
// Código real en el service
await this.dataSource.transaction(async (manager) => {
  const order = await manager.findOne(OrderEntity, { where: { id } });
  const coupon = await manager.findOne(CouponEntity, { where: { id: couponId } });
  await manager.save(OrderEntity, order);
  await manager.save(CouponEntity, coupon);
});
// Si cualquier cosa falla, PostgreSQL hace rollback de todo
```

**Cómo funciona con el mock:**

```ts
const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockEntityManager)),
};
```

Cuando el service llama `this.dataSource.transaction(async (manager) => {...})`, el mock simplemente ejecuta el callback `cb` pasándole `mockEntityManager` como argumento. No hay transacción real, no hay rollback real — pero el código del service no lo sabe, sigue usando `manager.findOne`, `manager.save`, etc.

**Por qué `mockManagerRepo` es separado:**

```ts
mockEntityManager.getRepository = jest.fn(() => mockManagerRepo)
```

Algunos métodos en el service usan `manager.getRepository(Entity).findOne(...)` en lugar de `manager.findOne(Entity, ...)`. Ambas formas existen en TypeORM y acceden a la DB de la misma manera. `mockManagerRepo` es el objeto que representa al repo dentro de la transacción.

**El reset manual en afterEach:**

```ts
afterEach(() => {
  jest.clearAllMocks();
  Object.values(mockManagerRepo).forEach((fn) => fn.mockReset?.());
});
```

`mockManagerRepo` y `mockEntityManager` usan `useValue` (singleton), así que `clearAllMocks()` limpia el historial pero no borra las implementaciones `Once`. El `mockReset` explícito garantiza estado completamente limpio.

---

## 24. overrideGuard — saltear guards en controller specs

Los guards de NestJS (`AuthGuard('jwt')`, `RolesGuard`) bloquearían el acceso en tests porque no hay JWT real. Se reemplazan con guards que siempre aprueban:

```ts
// src/modules/orders/controllers/orders.controller.spec.ts:56
const module: TestingModule = await Test.createTestingModule({
  controllers: [OrdersController],
  providers: [...],
})
  .overrideGuard(AuthGuard('jwt'))
  .useValue({ canActivate: jest.fn(() => true) })
  .overrideGuard(RolesGuard)
  .useValue({ canActivate: jest.fn(() => true) })
  .compile();
```

**¿Por qué no simplemente no incluirlos?**

Los guards están registrados en los decoradores del controller (`@UseGuards(AuthGuard('jwt'), RolesGuard)`), no en el módulo. NestJS los aplica automáticamente cuando encuentra esos decoradores. `overrideGuard` intercepta esa resolución y sustituye el guard real por el falso.

**¿Por qué `canActivate: jest.fn(() => true)`?**

La interfaz de un guard requiere el método `canActivate`. Devolver `true` significa "sí, autorizado, dejá pasar". Usando `jest.fn()` en lugar de `() => true` directamente, podés verificar que el guard fue invocado si lo necesitás.

**La separación de responsabilidades:**

El test del controller **no testea la lógica de autorización** — eso es trabajo del guard. El test del controller testea que, una vez autorizado, el controller delega correctamente al service. Testear la autorización en un unit test del controller sería duplicar lógica y acoplar los tests al funcionamiento interno del guard.

---

## 25. jest.Mocked<T> — tipado de mocks

```ts
// src/modules/orders/controllers/orders.controller.spec.ts:17
let service: jest.Mocked<OrdersService>;

service = module.get(OrdersService);
// Después:
service.create.mockResolvedValue(mockOrder());
//      ↑ TypeScript sabe que .create existe y tiene .mockResolvedValue()
```

`jest.Mocked<T>` es un tipo utilitario de TypeScript que toma una clase y transforma **todos sus métodos** en `jest.MockedFunction<...>`. Esto habilita autocompletado al configurar retornos.

Sin `jest.Mocked<T>`:
```ts
let service: OrdersService;
service.create.mockResolvedValue(...);  // ❌ Error: 'mockResolvedValue' does not exist
```

Con `jest.Mocked<OrdersService>`:
```ts
let service: jest.Mocked<OrdersService>;
service.create.mockResolvedValue(...);  // ✅ TypeScript lo acepta
```

El objeto en runtime sigue siendo el mismo mock — el tipo es solo para TypeScript en tiempo de compilación.

---

## 26. as unknown as T — casting TypeScript para mocks parciales

```ts
// src/modules/auth/services/auth.service.spec.ts:92
const mockUser = (overrides = {}): UserEntity =>
  ({
    id: 1,
    email: 'juan@test.com',
    password: 'hashed_pw',
    isActive: true,
    ...overrides,
  }) as unknown as UserEntity;
```

**¿Por qué el doble cast?**

`UserEntity` es una clase con decoradores TypeORM, métodos heredados, y propiedades requeridas. Un objeto literal `{ id: 1, email: '...' }` no satisface ese tipo — TypeScript sabe que le faltan propiedades.

- `as UserEntity` — fallaría: TypeScript dice "ese objeto no es compatible con UserEntity"
- `as unknown` — convierte a `unknown`, que es compatible con cualquier cosa
- `as unknown as UserEntity` — el doble cast primero "borra" el tipo, luego "impone" el nuevo

Es una forma de decirle a TypeScript: *"yo sé lo que estoy haciendo, tratá este objeto como si fuera UserEntity aunque no lo sea completamente"*.

En runtime no hay ningún chequeo — el objeto es lo que es. El cast es 100% TypeScript, solo afecta el compilador.

---

## 27. Hooks anidados: beforeEach/afterEach dentro de describe

Los hooks dentro de un `describe` solo aplican a los `it` de ese `describe`:

```ts
// src/modules/payments/services/payments.service.spec.ts:191
describe('handleMercadoPagoWebhook', () => {
  beforeEach(() => {
    // ← SOLO se ejecuta antes de los `it` dentro de handleMercadoPagoWebhook
    mpProvider.getClient.mockReturnValue({});
  });

  afterEach(() => {
    // ← SOLO se ejecuta después de los `it` de este describe
    (MerchantOrder as jest.Mock).mockReset();
    (Payment as jest.Mock).mockReset();
  });

  it('should return early if no id', async () => { ... });
  it('should swallow errors silently', async () => { ... });
});
```

**El orden de ejecución para un `it` dentro de ese describe:**

```
1. beforeEach externo (el del describe('PaymentsService'))
2. beforeEach interno (el del describe('handleMercadoPagoWebhook'))
3. → ejecuta el it
4. afterEach interno
5. afterEach externo
```

**Cuándo es útil:**

Cuando todos los tests de un describe comparten un setup específico que no aplica al resto. En este caso, todos los tests del webhook necesitan que `mpProvider.getClient` esté configurado, y necesitan resetear los constructores de MP después. Los tests de `create` o `findByOrder` no necesitan eso.

---

## 28. Helper functions de setup locales (setupTx, makeJob)

### setupTx — reducir repetición en tests relacionados

```ts
// src/modules/payments/services/payments.service.spec.ts:178
describe('handleMercadoPagoWebhook', () => {
  const setupTx = (paymentOverrides: any = {}, orderOverrides: any = {}) => {
    mockTxManager.findOne
      .mockResolvedValueOnce(mockPayment(paymentOverrides))
      .mockResolvedValueOnce(
        mockOrder({ userId: 1, status: OrderStatus.PENDING, ...orderOverrides })
      );
    mockTxManager.save.mockResolvedValue(undefined);
  };

  it('paid → APPROVED payment, CONFIRMED order', async () => {
    (MerchantOrder as jest.Mock).mockImplementationOnce(() => ({
      get: jest.fn().mockResolvedValue({ order_status: 'paid', external_reference: '1' }),
    }));
    setupTx();  // ← una sola línea en lugar de 5
    await service.handleMercadoPagoWebhook({}, { id: '1', topic: 'merchant_order' });
    // asserts...
  });
```

`setupTx` encapsula la configuración del `mockTxManager` que todos los tests del webhook necesitan. En lugar de repetir las 5 líneas de `mockResolvedValueOnce` en cada test, se llama `setupTx()`.

Acepta overrides por si algún test necesita un payment o una order en estado diferente al default.

**Por qué es una función dentro del describe y no fuera:**

Está definida como `const setupTx = ...` dentro del `describe`, lo que la hace local a ese scope. Otros describes no la ven ni pueden llamarla accidentalmente.

### makeJob — crear objetos Job de Bull sin las 20 propiedades

```ts
// src/modules/mail/processors/mail.processor.spec.ts:17
const makeJob = <T>(data: T) => ({ data }) as Job<T>;
```

El tipo `Job<T>` de Bull tiene muchas propiedades (id, timestamp, attemptsMade, opts, etc.). Para los tests del `MailProcessor`, solo importa `job.data` — que es el payload del job.

`makeJob<ActivationJobData>({ to: '...', name: '...', activationUrl: '...' })` crea un objeto que parece un `Job<ActivationJobData>` con solo la propiedad `data`. El cast `as Job<T>` le dice a TypeScript que lo trate como tal.

Es la misma idea que el doble cast de la sección 26 pero en versión más liviana.

---

## 29. mockImplementation con ConfigService

El `ConfigService` de NestJS tiene un método `get(key)` que devuelve distintos valores según la key. Hay dos formas de mockearlo en el proyecto:

### Forma 1 — objeto inline con mockImplementation (en el provider)

```ts
// src/modules/seed/services/seed.service.spec.ts:52
{
  provide: ConfigService,
  useValue: {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'SUPERADMIN_EMAIL') return 'super@test.com';
      if (key === 'SUPERADMIN_PASSWORD') return 'secret';
      return null;
    }),
  },
},
```

Simple y directo. La implementación está fija para todos los tests del describe.

### Forma 2 — variable de referencia para cambiar entre tests

```ts
// src/modules/payments/controllers/payments.controller.spec.ts:15
let configGetMock: jest.Mock;

beforeEach(async () => {
  configGetMock = jest.fn().mockReturnValue('');  // sin secret por defecto

  const module = await Test.createTestingModule({
    controllers: [PaymentsController],
    providers: [
      { provide: ConfigService, useValue: { get: configGetMock } },
    ],
  }).compile();
});

it('should skip signature check if MP_WEBHOOK_SECRET is empty', async () => {
  configGetMock.mockReturnValue('');  // sin secret
  await expect(...).resolves.not.toThrow();
});

it('should validate correct MP signature', async () => {
  const secret = 'my_secret';
  configGetMock.mockReturnValue(secret);  // ← cambia el comportamiento
  // ...
});
```

Guardar la referencia en `configGetMock` permite reconfigurarlo dentro de cada test. Así podés testear el comportamiento del controller con y sin webhook secret sin necesidad de recrear el módulo.

---

## 30. describe con valor dinámico (enum como nombre)

```ts
// src/modules/mail/processors/mail.processor.spec.ts:54
describe(MailJobType.SEND_ACTIVATION, () => {
  it('should call Resend with correct subject and recipient', async () => { ... });
  it('should escape HTML in name', async () => { ... });
});

describe(MailJobType.SEND_PASSWORD_RESET, () => {
  it('should call Resend with correct subject', async () => { ... });
});
```

`describe` acepta cualquier string — y un enum en TypeScript es simplemente un string (o número) en runtime. Usar el valor del enum como nombre del describe tiene dos ventajas:

1. **La salida del test muestra el nombre real del job type**: `SEND_ACTIVATION › should escape HTML in name` — más legible que un string duplicado.

2. **Si el valor del enum cambia, el nombre del test cambia automáticamente** — no hay strings duplicados que mantener.

---

## 31. Diferencias entre service spec y controller spec

Son fundamentalmente distintos en qué verifican y cómo se configuran.

### Service spec — testea lógica de negocio

```ts
// ¿Qué mockea? Repositorios, DataSource, otros services
providers: [
  OrdersService,                           // ← lo que se testea
  { provide: getRepositoryToken(OrderEntity), useFactory: mockOrderRepo },
  { provide: DataSource, useValue: mockDataSource },
  { provide: StockItemsService, useFactory: mockStockService },
]

// ¿Qué verifica?
it('should throw BadRequestException if coupon is expired', async () => {
  // configura repos con datos específicos
  mockEntityManager.find.mockResolvedValue([mockStock()]);
  mockEntityManager.findOne.mockResolvedValueOnce({
    id: 1, endsAt: new Date(Date.now() - 60_000),  // expirado
  });
  // verifica que lanza la excepción correcta
  await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
});
```

### Controller spec — testea routing y delegación

```ts
// ¿Qué mockea? El service completo, guards
providers: [
  { provide: OrdersService, useFactory: mockService },  // ← service mockeado
  { provide: Reflector, useValue: { get: jest.fn() } },
]
// + overrideGuard para saltear auth

// ¿Qué verifica?
it('should create an order for the authenticated user', async () => {
  service.create.mockResolvedValue(mockOrder());

  const result = await controller.create(mockJwt(1), dto);
  //                                     ↑ lo que inyecta @CurrentUser()

  expect(service.create).toHaveBeenCalledWith(1, dto);  // delegó bien
  expect(result.status).toBe(OrderStatus.PENDING);       // devolvió el resultado
});
```

**Por qué `@CurrentUser()` no se ejecuta en unit tests:**

El decorator `@CurrentUser()` extrae el usuario del JWT del request. Pero en un unit test no hay request — se llama al método del controller directamente. El decorator no se ejecuta.

Por eso se pasa `mockJwt(1)` directamente como argumento donde normalmente va `@CurrentUser() user: JwtPayload`:

```ts
// En el controller real:
async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateOrderDto) {
  return this.ordersService.create(user.sub, dto);
}

// En el test, se llama directamente sin decorator:
await controller.create({ sub: 1, role: RoleType.CLIENT }, dto);
```

**Qué verifica cada tipo de test:**

| Lo que verificás | Dónde |
|---|---|
| Validaciones de negocio, flujos complejos, errores específicos | Service spec |
| Que el controller extrae params correctamente | Controller spec |
| Autorización: cliente solo ve sus cosas | Controller spec |
| Que delega al service con los argumentos correctos | Controller spec |
| Efectos secundarios: stock reservado, email enviado | Service spec |

---

## 32. El patrón Arrange / Act / Assert (AAA)

Todos los tests del proyecto siguen este patrón de tres fases:

```ts
it('should create an order with a global coupon', async () => {

  // ─── ARRANGE: preparar el estado del mundo ───────────────────────────
  const coupon = { id: 5, code: 'GLOBAL10', value: 10, usageCount: 5, ... };
  const order  = mockOrder({ total: 588.06 });

  userRepo.findOne.mockResolvedValue(mockUser());
  productRepo.findOne.mockResolvedValue(mockProduct());
  calcService.calculateProduct.mockResolvedValue(mockBreakdown());
  mockEntityManager.findOne
    .mockResolvedValueOnce(coupon)
    .mockResolvedValueOnce(null);     // sin uso previo
  mockEntityManager.save
    .mockResolvedValueOnce(order)
    .mockResolvedValueOnce({ ...coupon, usageCount: 6 })
    .mockResolvedValueOnce(undefined);

  // ─── ACT: ejecutar el código bajo prueba ──────────────────────────────
  const result = await service.create(1, { ...dto, couponCode: 'GLOBAL10' });

  // ─── ASSERT: verificar resultado y efectos secundarios ────────────────
  expect(mockEntityManager.save).toHaveBeenCalledWith(
    CouponEntity,
    expect.objectContaining({ usageCount: 6 }),
  );
  expect(result.id).toBe(1);
});
```

**Por qué separar las fases:**

- Hace el test legible: sabés exactamente qué input da qué output
- Facilita el debugging: si falla, buscás en qué fase está el problema
- Fuerza a pensar en el test como un contrato: dado X → cuando Y → entonces Z

---

## 33. Cómo leer un test complejo de punta a punta

Tomamos el test más complejo del proyecto: cupón no-global que aplica a un combo específico.

```ts
// src/modules/orders/services/orders.service.spec.ts:550
it('should apply a non-global coupon targeting a specific combo', async () => {

  // === ARRANGE ===

  // Definimos los datos que los mocks van a devolver
  const coupon = {
    id: 3, code: 'COMBO10', value: 10,
    isGlobal: false,       // ← no global: necesita target específico
    usageLimit: null, usageCount: 0, startsAt: null, endsAt: null,
  };
  const combo = mockCombo();                                     // combo con 2 productos
  const order = mockComboOrder({ couponDiscount: 65.34 });       // orden esperada
  const mockUsage = { couponId: 3, userId: 1, orderId: 1 };

  // Stocks para cada producto del combo
  const stockForProduct10 = mockStock({ productId: 10, locationId: 3, quantityCurrent: 10, quantityReserved: 0 });
  const stockForProduct11 = mockStock({ productId: 11, locationId: 3, quantityCurrent: 10, quantityReserved: 0 });

  // Repos FUERA de la transacción
  userRepo.findOne.mockResolvedValue(mockUser());
  comboRepo.findOne.mockResolvedValue(combo);
  calcService.calculateCombo.mockResolvedValue(mockBreakdown());
  orderItemRepo.create.mockReturnValue({ combo, quantity: 1, comboReservations: [] });

  // manager.find — llamadas en orden dentro de la transacción:
  //   1ra: stock de producto 10
  //   2da: stock de producto 11
  //   3ra: CouponComboTargetEntity → hay un target para este combo
  mockEntityManager.find
    .mockResolvedValueOnce([stockForProduct10])
    .mockResolvedValueOnce([stockForProduct11])
    .mockResolvedValueOnce([{ couponId: 3, comboId: 1 }]);

  // manager.findOne — llamadas en orden:
  //   1ra: el cupón (con PESSIMISTIC_WRITE lock para evitar race conditions)
  //   2da: uso previo del cupón por este usuario → null (no lo usó antes)
  mockEntityManager.findOne
    .mockResolvedValueOnce(coupon)
    .mockResolvedValueOnce(null);

  // manager.create y save para persistir la orden, el cupón actualizado y el uso
  mockEntityManager.create
    .mockReturnValueOnce(order)
    .mockReturnValueOnce(mockUsage);
  mockEntityManager.save
    .mockResolvedValueOnce(order)
    .mockResolvedValueOnce({ ...coupon, usageCount: 1 })
    .mockResolvedValueOnce(undefined);

  stockService.reserveStock.mockResolvedValue(undefined);

  // === ACT ===
  const result = await service.create(1, {
    items: [{ comboId: 1, quantity: 1 }],
    deliveryType: DeliveryType.PICKUP,
    couponCode: 'COMBO10',
  });

  // === ASSERT ===
  // Verificar que el usageCount del cupón se incrementó
  expect(mockEntityManager.save).toHaveBeenCalledWith(
    CouponEntity,
    expect.objectContaining({ usageCount: 1 }),
  );
  // Verificar que se registró el uso
  expect(mockEntityManager.save).toHaveBeenCalledWith(
    CouponUsageEntity,
    expect.objectContaining({ couponId: 3 }),
  );
  expect(result.id).toBe(1);
});
```

**Cómo decodificar el orden de las llamadas `Once`:**

El truco es conocer el flujo del código real. En `service.create`:
1. Buscar usuario (fuera de transacción)
2. Para cada item, buscar combo/producto (fuera de transacción)
3. Calcular precio (fuera de transacción)
4. Abrir transacción:
   - Para cada item del combo, buscar stock → `manager.find` × 2
   - Si hay cupón: buscar cupón con lock → `manager.findOne` × 1
   - Si hay cupón: verificar uso previo → `manager.findOne` × 1
   - Si cupón no-global: buscar targets → `manager.find` × 1
   - Crear y guardar orden → `manager.create` + `manager.save`
   - Actualizar cupón → `manager.save`
   - Crear y guardar uso → `manager.create` + `manager.save`
   - Reservar stock → `stockService.reserveStock`

Cada `mockResolvedValueOnce` corresponde a una llamada en ese orden.

---

## Resumen de referencia rápida

| Pieza | Para qué sirve |
|---|---|
| `describe(nombre, fn)` | Agrupa tests bajo un nombre (clase, método, escenario) |
| `it(nombre, fn)` | Un test individual |
| `Test.createTestingModule` | Crea módulo NestJS mínimo para tests |
| `.compile()` | Resuelve el DI y construye las instancias |
| `module.get(Token)` | Obtiene una instancia del contenedor |
| `useFactory: fn` | Provider que se recrea en cada `beforeEach` |
| `useValue: obj` | Provider singleton compartido entre todos los tests |
| `getRepositoryToken(Entity)` | Token de DI para repos TypeORM |
| `getQueueToken(nombre)` | Token de DI para colas Bull |
| `getDataSourceToken()` | Token de DI para DataSource (alternativa a la clase) |
| `jest.fn()` | Función mock que registra llamadas |
| `mockReturnValue(v)` | Retorno síncrono fijo |
| `mockResolvedValue(v)` | Retorno async (Promise resuelta) fijo |
| `mockRejectedValue(e)` | Error async fijo |
| `mockReturnValueOnce` / `mockResolvedValueOnce` | Retorno para una sola llamada |
| `mockImplementation(fn)` | Implementación personalizada con lógica |
| `mockImplementationOnce(fn)` | Implementación para una sola llamada |
| `mockReturnThis()` | Para method chaining (QueryBuilder) |
| `beforeEach(fn)` | Ejecutar antes de cada test |
| `afterEach(fn)` | Ejecutar después de cada test |
| `jest.clearAllMocks()` | Limpia historial de llamadas de todos los mocks |
| `fn.mockReset()` | Limpia historial + implementación de un mock específico |
| `jest.mock('módulo', factory)` | Reemplaza un módulo completo antes de importarlo |
| `jest.requireActual('módulo')` | Obtiene el módulo real dentro de `jest.mock` |
| `as jest.Mock` | Cast TS para usar métodos de mock en clases mockeadas |
| `fn.mock.calls[i][j]` | Accede al j-ésimo argumento de la i-ésima llamada |
| `overrideGuard(G).useValue(v)` | Reemplaza un guard NestJS en tests de controller |
| `jest.Mocked<T>` | Tipo TS que expone métodos de mock con autocompletado |
| `as unknown as T` | Double cast para satisfacer TS con objetos parciales |
| Hooks anidados | beforeEach/afterEach dentro de describe solo afecta a ese describe |
| Helper local (setupTx) | Función privada dentro de describe para reducir repetición |
| `describe(Enum.VALUE)` | Usar valor de enum como nombre del grupo |
| AAA pattern | Arrange / Act / Assert — estructura de todo test |
