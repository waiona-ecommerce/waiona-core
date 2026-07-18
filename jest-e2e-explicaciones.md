# Tests E2E desde Primeros Principios — Waiona Core

Guía exhaustiva de cada pieza de los tests end-to-end del proyecto, con ejemplos tomados directamente del código real.

---

## Índice

1. [¿Qué es un test E2E y en qué se diferencia de un unit test?](#1-qué-es-un-test-e2e-y-en-qué-se-diferencia-de-un-unit-test)
2. [La configuración separada: jest-e2e.json](#2-la-configuración-separada-jest-e2ejson)
3. [beforeAll vs beforeEach — el ciclo de vida en e2e](#3-beforeall-vs-beforeeach--el-ciclo-de-vida-en-e2e)
4. [INestApplication — la app real](#4-inestapplication--la-app-real)
5. [createNestApplication, init y close](#5-createnestapplication-init-y-close)
6. [useGlobalPipes — el ValidationPipe](#6-useglobalpipes--el-validationpipe)
7. [enableVersioning — prefijo /v1 en rutas](#7-enableversioning--prefijo-v1-en-rutas)
8. [useGlobalInterceptors — ClassSerializerInterceptor](#8-useglobalinterceptors--classserializerinterceptor)
9. [Supertest — hacer requests HTTP reales](#9-supertest--hacer-requests-http-reales)
10. [request().metodo().send().set().query().expect()](#10-requestmetodosendsetqueryexpect)
11. [res.body — inspeccionar la respuesta](#11-resbody--inspeccionar-la-respuesta)
12. [TypeOrmModule.forRootAsync — conexión real a la DB de test](#12-typeormmoduleforrootasync--conexión-real-a-la-db-de-test)
13. [TypeOrmModule.forFeature — registrar entidades por módulo](#13-typeormmoduleforfeature--registrar-entidades-por-módulo)
14. [dropSchema y synchronize — DB limpia en cada suite](#14-dropschema-y-synchronize--db-limpia-en-cada-suite)
15. [runMigrations — correr migraciones en vez de synchronize](#15-runmigrations--correr-migraciones-en-vez-de-synchronize)
16. [dataSource — acceder la DB directamente](#16-datasource--acceder-la-db-directamente)
17. [Seed data — crear el estado inicial de la DB](#17-seed-data--crear-el-estado-inicial-de-la-db)
18. [Variables compartidas entre tests](#18-variables-compartidas-entre-tests)
19. [Estado acumulativo — tests que dependen de tests anteriores](#19-estado-acumulativo--tests-que-dependen-de-tests-anteriores)
20. [Capturar datos del flujo: mock.calls en e2e](#20-capturar-datos-del-flujo-mockcalls-en-e2e)
21. [overrideGuard con ExecutionContext — inyectar usuario en el request](#21-overrideguard-con-executioncontext--inyectar-usuario-en-el-request)
22. [mockUser mutable — simular distintos roles entre tests](#22-mockuser-mutable--simular-distintos-roles-entre-tests)
23. [ConfigModule.forRoot — leer variables de entorno](#23-configmoduleforroot--leer-variables-de-entorno)
24. [Módulos reales vs mocks en e2e](#24-módulos-reales-vs-mocks-en-e2e)
25. [Mock parcial de servicio externo](#25-mock-parcial-de-servicio-externo)
26. [mockRepo sin jest.fn() — plain objects como repos](#26-mockrepo-sin-jestfn--plain-objects-como-repos)
27. [Seed via HTTP vs Seed via repo directo](#27-seed-via-http-vs-seed-via-repo-directo)
28. [beforeAll anidado dentro de describe](#28-beforeall-anidado-dentro-de-describe)
29. [Función helper externa para seed complejo](#29-función-helper-externa-para-seed-complejo)
30. [ALL_ENTITIES — constante para la lista de entidades](#30-all_entities--constante-para-la-lista-de-entidades)
31. [validProduct con Date.now() — factory con unicidad](#31-validproduct-con-datenow--factory-con-unicidad)
32. [Helper de firma HMAC para webhook](#32-helper-de-firma-hmac-para-webhook)
33. [toMatchObject — matcher parcial de objeto](#33-tomatchobject--matcher-parcial-de-objeto)
34. [Matchers numéricos: toBeGreaterThan, toBeLessThan, etc.](#34-matchers-numéricos-tobegreaterthan-tobelessthan-etc)
35. [Timeout extendido en beforeAll](#35-timeout-extendido-en-beforeall)
36. [maxWorkers: 1 — los e2e corren en serie](#36-maxworkers-1--los-e2e-corren-en-serie)
37. [E2E de auth — el flujo más completo](#37-e2e-de-auth--el-flujo-más-completo)
38. [E2E con guards reales vs sin guards](#38-e2e-con-guards-reales-vs-sin-guards)
39. [Diferencias clave: unit test vs e2e](#39-diferencias-clave-unit-test-vs-e2e)

---

## 1. ¿Qué es un test E2E y en qué se diferencia de un unit test?

Un test **end-to-end (de punta a punta)** levanta la aplicación **completa** (o una versión muy cercana a completa) y hace requests HTTP reales, igual que lo haría un cliente real. La base de datos existe. El ValidationPipe existe. Los interceptores existen. Todo el pipeline de NestJS se ejecuta.

El contrato es: *"cuando hago POST /v1/margins con este body, la DB tiene que tener este dato y la respuesta debe ser 201 con esta forma"*.

**Comparación:**

| | Unit Test | E2E Test |
|---|---|---|
| ¿Qué se testea? | Una clase en aislamiento | El stack completo |
| ¿Hay DB real? | No — repos mockeados | Sí — PostgreSQL de test |
| ¿Hay HTTP? | No — se llama el método directamente | Sí — request HTTP real |
| ¿Qué tan rápido? | ~1ms por test | ~50-500ms por test |
| ¿Qué detecta? | Bugs en lógica de negocio | Bugs en integración, validación, serialización |
| ¿Cuándo falla? | Si la lógica interna es incorrecta | Si la app entera no funciona como se espera |

**¿Por qué necesitamos ambos?**

Los unit tests verifican que `OrdersService.create()` lanza `BadRequestException` cuando hay stock insuficiente. El e2e verifica que `POST /v1/orders` devuelve HTTP 400 cuando hay stock insuficiente — que el controller captura esa excepción y la convierte en 400, que el ValidationPipe valida el body antes de que llegue al service, que la respuesta tiene el formato JSON esperado.

Pueden fallar de forma independiente: el unit test puede pasar (el service está bien) y el e2e fallar (el controller no tiene el guard correcto, o el ValidationPipe no está configurado globalmente).

---

## 2. La configuración separada: jest-e2e.json

```json
// test/jest-e2e.json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  },
  "moduleNameMapper": {
    "^src/(.*)$": "<rootDir>/../src/$1"
  },
  "maxWorkers": 1,
  "transformIgnorePatterns": ["/node_modules/(?!uuid/)"]
}
```

Los e2e tienen su **propio archivo de configuración** separado del de unit tests. Las diferencias clave:

- **`testRegex: ".e2e-spec.ts$"`** — solo busca archivos `.e2e-spec.ts`. Los unit tests usan `.spec.ts`.
- **`rootDir: "."`** — la raíz es la carpeta `test/`, no `src/`.
- **`moduleNameMapper`** — permite usar `import ... from 'src/...'` en los e2e, resolviendo a `../src/...` relativo a la carpeta `test/`.
- **`maxWorkers: 1`** — un solo worker, los tests corren en serie (ver sección 36).
- **`transformIgnorePatterns`** — excepción para el paquete `uuid` que usa ES modules y necesita ser transformado por ts-jest.

Para correr solo los e2e:
```bash
npx jest --config test/jest-e2e.json
npx jest --config test/jest-e2e.json --testPathPattern="auth"
```

---

## 3. beforeAll vs beforeEach — el ciclo de vida en e2e

Esta es la diferencia más importante entre unit tests y e2e tests.

### En unit tests: `beforeEach`

```ts
// Unit test — recrea todo en cada it
beforeEach(async () => {
  const module = await Test.createTestingModule({ ... }).compile();
  service = module.get(OrdersService);
});
```

Se recrea el módulo completo antes de **cada test**. Como no hay DB real ni servidor HTTP, esto tarda ~1ms y no es problema.

### En e2e: `beforeAll`

```ts
// E2E — levanta el servidor UNA VEZ para toda la suite
beforeAll(async () => {
  const moduleFixture = await Test.createTestingModule({ ... }).compile();
  app = moduleFixture.createNestApplication();
  await app.init();          // ← levanta el servidor HTTP
  dataSource = moduleFixture.get(DataSource);
  // seed data...
}, 30000);                    // ← timeout de 30 segundos
```

Se levanta el servidor **una sola vez** para todos los tests del `describe`. Levantar la app NestJS con conexión a PostgreSQL real puede tardar 2-5 segundos — hacerlo en cada `it` haría los tests inutilizablemente lentos.

**El trade-off:** los tests de una misma suite comparten estado de DB. Si el test 1 crea un margen, el test 2 lo puede ver. Los tests deben ser escritos considerando este estado acumulativo (ver sección 19).

### afterAll — teardown

```ts
afterAll(async () => {
  await dataSource.destroy();  // cerrar la conexión a PostgreSQL
  await app.close();           // cerrar el servidor HTTP
});
```

Sin este cleanup, la DB mantiene conexiones abiertas y Jest no puede terminar limpiamente — el proceso cuelga o Jest muestra warnings de "open handles".

---

## 4. INestApplication — la app real

```ts
let app: INestApplication;
```

`INestApplication` es la interfaz de TypeScript para la aplicación NestJS instanciada. Expone métodos como `useGlobalPipes`, `enableVersioning`, `getHttpServer`, `init`, `close`.

**`app.getHttpServer()`** — devuelve el servidor HTTP subyacente (un servidor de Node.js). Se pasa a Supertest para hacer requests:

```ts
request(app.getHttpServer()).get('/v1/margins').expect(200)
```

Supertest necesita el servidor HTTP, no la app de NestJS directamente. `getHttpServer()` es el puente entre NestJS y Supertest.

---

## 5. createNestApplication, init y close

```ts
// 1. Crear el módulo (como en unit tests)
const moduleFixture: TestingModule = await Test.createTestingModule({
  imports: [...],
  controllers: [...],
  providers: [...],
}).compile();

// 2. Crear la aplicación a partir del módulo
app = moduleFixture.createNestApplication();

// 3. Configurar middlewares y pipes globales
app.useGlobalPipes(new ValidationPipe({ ... }));
app.enableVersioning({ type: VersioningType.URI });

// 4. Inicializar — levanta el servidor HTTP, carga lifecycle hooks
await app.init();

// Al final:
await app.close();  // shutdown graceful
```

**¿Por qué el orden importa?**

`useGlobalPipes` y `enableVersioning` deben llamarse **antes** de `app.init()`. Una vez inicializada, la configuración global está fijada. Si llamás `useGlobalPipes` después de `init`, el pipe no se aplica.

**¿Qué hace `app.init()`?**

- Levanta el adaptador HTTP (Express por default)
- Aplica los middlewares globales
- Llama a los lifecycle hooks (`onModuleInit`, `onApplicationBootstrap`)
- Establece la conexión a la DB (TypeORM se conecta acá)
- Resuelve las rutas del router

---

## 6. useGlobalPipes — el ValidationPipe

```ts
// test/auth/auth.e2e-spec.ts:89
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
);
```

Esta es una de las piezas más importantes de los e2e. En los unit tests, el ValidationPipe **no existe** — se llaman los métodos del controller/service directamente. En los e2e, el ValidationPipe se ejecuta **antes** de que llegue el request al controller.

**¿Qué hace cada opción?**

- **`whitelist: true`** — elimina automáticamente las propiedades del body que no están en el DTO. Si el DTO no tiene `isPercentage`, se elimina del body antes de llegar al controller.
- **`forbidNonWhitelisted: true`** — en vez de eliminar silenciosamente, lanza 400 si el body tiene propiedades no declaradas en el DTO.
- **`transform: true`** — convierte los valores del body al tipo TypeScript correspondiente. Si el DTO dice `value: number` y llega `"20"` (string), lo convierte a `20`.

**Esto explica por qué hay tests de validación solo en e2e:**

```ts
// test/margins/margins.e2e-spec.ts:109
it('POST /margins -> 400 si se envía campo desconocido isPercentage', async () => {
  await request(app.getHttpServer())
    .post('/v1/margins')
    .send({ name: 'Con isPercentage', value: 20, isPercentage: true })
    .expect(400);
});
```

Este test solo tiene sentido en e2e porque es el ValidationPipe el que rechaza `isPercentage` — no el service. Un unit test del service no tiene pipeline HTTP y no vería este caso.

---

## 7. enableVersioning — prefijo /v1 en rutas

```ts
app.enableVersioning({ type: VersioningType.URI });
```

Las rutas en el proyecto son `/v1/margins`, `/v1/orders`, etc. El prefijo `v1` es agregado por el mecanismo de versionado de NestJS, no está hardcodeado en los decoradores `@Controller`.

Sin esta línea, el e2e fallaría con 404 en todas las rutas porque `/v1/margins` no existe — solo existe `/margins`.

**¿Por qué se llama `VersioningType.URI`?**

Hay otras estrategias de versionado (header, media type, custom), pero URI es la más común: agrega el número de versión como segmento de la URL.

---

## 8. useGlobalInterceptors — ClassSerializerInterceptor

```ts
// test/auth/auth.e2e-spec.ts:96
app.useGlobalInterceptors(
  new ClassSerializerInterceptor(app.get(Reflector)),
);
```

Solo aparece en el e2e de auth porque es el único que testea que la **password no aparece en la respuesta**.

`ClassSerializerInterceptor` aplica los decoradores `@Exclude()` y `@Expose()` de `class-transformer` a las respuestas. Si la entidad `UserEntity` tiene `@Exclude()` en el campo `password`, el interceptor lo elimina de la respuesta antes de serializar a JSON.

```ts
// Lo que testea:
it('should login and return user without password', async () => {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/login')
    .send({ email: testUser.email, password: testUser.password })
    .expect(200);

  expect(res.body.user.password).toBeUndefined();  // ← el interceptor lo excluye
});
```

Sin `useGlobalInterceptors`, `password` aparecería en la respuesta aunque la entidad tenga `@Exclude()` — el decorador solo funciona cuando el interceptor está activo.

---

## 9. Supertest — hacer requests HTTP reales

```ts
import request from 'supertest';
```

**Supertest** es la librería que hace requests HTTP al servidor NestJS levantado en memoria. No necesita que el servidor esté escuchando en un puerto real — funciona a nivel de socket, igual que un cliente HTTP pero sin ir por la red.

El flujo completo de un request e2e es:

```
test → supertest → socket → Express → NestJS router → Guards → Pipes → Controller → Service → DB → respuesta
```

Todo ese pipeline se ejecuta realmente. Nada está mockeado (salvo lo que explícitamente se mockea, como el MailService).

---

## 10. request().metodo().send().set().query().expect()

La API de Supertest es fluent (encadenada). Cada método devuelve el mismo objeto para poder continuar encadenando.

### Métodos HTTP

```ts
request(app.getHttpServer()).get('/v1/margins')
request(app.getHttpServer()).post('/v1/margins')
request(app.getHttpServer()).patch('/v1/margins/1')
request(app.getHttpServer()).delete('/v1/margins/1')
```

### `.send(body)` — body del request

```ts
.send({ name: 'General 20%', value: 20 })
// Supertest serializa automáticamente a JSON y pone Content-Type: application/json
```

### `.set(header, valor)` — agregar headers

```ts
// test/auth/auth.e2e-spec.ts:359
.set('Authorization', `Bearer ${accessToken}`)

// Múltiples headers a la vez pasando un objeto:
.set({ 'x-signature': 'ts=123,v1=abc', 'x-request-id': 'req-xyz' })
```

También se puede pasar un objeto al `.set()` directamente para múltiples headers, como hacen los tests del webhook.

### `.query(params)` — query string

```ts
// test/payments/payments.e2e-spec.ts:322
.query({ id: '1', topic: 'merchant_order' })
// Produce: POST /v1/payments/webhook/mercadopago?id=1&topic=merchant_order
```

### `.expect(statusCode)` — verificar status HTTP

```ts
.expect(200)   // OK
.expect(201)   // Created
.expect(204)   // No Content (no body)
.expect(400)   // Bad Request
.expect(401)   // Unauthorized
.expect(403)   // Forbidden
.expect(404)   // Not Found
.expect(409)   // Conflict
```

Esta es la aserción más básica de un e2e — verificar que el servidor devuelve el código HTTP correcto. Si el status no coincide, el test falla con un mensaje claro.

### `.expect(callback)` — verificar el body

```ts
// test/app.e2e-spec.ts:26
.expect((res) => {
  expect(res.body.status).toBe('ok');
  expect(res.body.timestamp).toBeDefined();
})
```

`.expect` acepta un callback que recibe la respuesta completa. Se puede combinar con los matchers de Jest.

### Encadenamiento y `await`

```ts
// Forma 1: await del resultado (lo más común)
const res = await request(app.getHttpServer())
  .get('/v1/margins')
  .expect(200);
// res.body tiene la respuesta

// Forma 2: return (en tests sin async)
it('should return 409', () =>
  request(app.getHttpServer())
    .post('/v1/margins')
    .send({ name: 'Dupe', value: 10 })
    .expect(409));
```

La forma sin `await` (con `return`) también funciona porque Supertest devuelve una Promise. Jest espera la Promise antes de pasar al siguiente test.

---

## 11. res.body — inspeccionar la respuesta

```ts
const res = await request(app.getHttpServer())
  .post('/v1/margins')
  .send({ name: 'General 20%', value: 20 })
  .expect(201);

expect(res.body.id).toBeDefined();
expect(res.body.name).toBe('GENERAL 20%');    // ← el DTO normaliza a uppercase
expect(res.body.value).toBe(20);
```

`res.body` es el body JSON parseado automáticamente. Supertest detecta el `Content-Type: application/json` de la respuesta y hace el parse por vos.

**Lo que podés inspeccionar en `res`:**

- `res.body` — el body parseado
- `res.status` — el status code (también verificado con `.expect(201)`)
- `res.headers` — los headers de la respuesta
- `res.text` — el body como string crudo (para respuestas no-JSON)

---

## 12. TypeOrmModule.forRootAsync — conexión real a la DB de test

```ts
// test/auth/auth.e2e-spec.ts:42
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    type: 'postgres',
    host:     config.get('POSTGRES_HOST') ?? 'localhost',
    port:     parseInt(config.get('POSTGRES_TEST_PORT') ?? '5433'),
    username: config.get('POSTGRES_USER'),
    password: config.get('POSTGRES_PASSWORD'),
    database: config.get('POSTGRES_TEST_DB') ?? 'waiona_test',
    entities: [ UserEntity, ProfileEntity, ... ],
    synchronize: true,
    dropSchema: true,
  }),
}),
```

A diferencia del unit test donde el repo es un objeto falso, acá se configura TypeORM para conectarse a **PostgreSQL real** — pero a la base de datos de test (`waiona_test`), no a la de desarrollo.

**Puntos clave:**

- **`POSTGRES_TEST_PORT: 5433`** (no 5432) — puerto diferente para que corran dos instancias de PostgreSQL en paralelo si se necesita (dev y test).
- **`POSTGRES_TEST_DB: waiona_test`** — base de datos separada para no contaminar los datos de desarrollo.
- **`inject: [ConfigService]` / `useFactory`** — el módulo es async porque necesita leer las variables de entorno primero.
- **`entities: [UserEntity, ProfileEntity, ...]`** — solo las entidades que este e2e necesita, no todas. TypeORM solo crea las tablas de las entidades declaradas.

---

## 13. TypeOrmModule.forFeature — registrar entidades por módulo

```ts
// test/auth/auth.e2e-spec.ts:62
TypeOrmModule.forFeature([
  UserEntity,
  ProfileEntity,
  RoleEntity,
  TokenEntity,
  RefreshTokenEntity,
]),
```

`forRootAsync` configura la conexión global a la DB. `forFeature` registra los repositorios de las entidades específicas que los services de este e2e van a usar.

**¿Por qué ambos?**

- `forRootAsync` → "conectate a PostgreSQL con estas credenciales"
- `forFeature` → "creá y registrá los repositorios de estas entidades en el DI"

Sin `forFeature`, el `AuthService` no podría recibir los repositorios inyectados porque no estarían registrados en el contenedor.

---

## 14. dropSchema y synchronize — DB limpia en cada suite

```ts
synchronize: true,
dropSchema: true,
```

Esta combinación es fundamental para que los e2e sean deterministas:

**`dropSchema: true`** — cuando TypeORM inicializa la conexión, **elimina todas las tablas** de la DB y las recrea desde cero. Cada vez que se levanta el `beforeAll`, la DB empieza completamente vacía.

**`synchronize: true`** — TypeORM genera automáticamente el schema (tablas, columnas, índices) a partir de las entidades decoradas con `@Entity()`, `@Column()`, etc., sin necesidad de migraciones.

**¿Por qué `dropSchema` es necesario?**

Sin él, los datos del run anterior persistirían en la DB de test. Si el test 1 creó un usuario con email `test@waiona.com`, y el próximo run intenta crearlo de nuevo, fallaría por constraint unique. Con `dropSchema`, siempre empezás de cero.

**Consecuencia importante:** cada suite de e2e (`auth.e2e-spec.ts`, `margins.e2e-spec.ts`) **destruye y recrea la DB completa** al inicializarse. Por eso `maxWorkers: 1` — si dos suites corrieran en paralelo, se pisarían la DB entre sí.

---

## 15. runMigrations — correr migraciones en vez de synchronize

```ts
// test/margins/margins.e2e-spec.ts:38
TypeOrmModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    // ...
    entities: [MarginEntity],
    synchronize: false,       // ← NO sincronizar
    dropSchema: true,
    migrations: [
      InitialSchema1780281702444,
      MarginsPartialUniqueIndex1781700000000,
    ],
  }),
}),
// ...
await dataSource.runMigrations();  // ← correr las migraciones manualmente
```

En la mayoría de los e2e se usa `synchronize: true` por simplicidad. Pero el e2e de margins usa **migraciones reales** porque testea un comportamiento específico del schema: el **partial unique index** en el nombre del margen (que permite recrear un margen con el mismo nombre si fue soft-deleted).

`synchronize: true` no puede representar índices parciales — TypeORM los crea con un índice normal. Por eso:

1. `synchronize: false` — TypeORM no genera el schema automáticamente
2. Se importan las clases de migración reales (`InitialSchema...`, `MarginsPartialUniqueIndex...`)
3. `await dataSource.runMigrations()` — se corren explícitamente después de `app.init()`

Esto es un e2e de la migración misma: verifica que el partial index funciona correctamente.

```ts
// test/margins/margins.e2e-spec.ts:145
it('POST /margins -> 201 permite recrear un margen con el mismo nombre si fue eliminado', async () => {
  const createRes = await request(app.getHttpServer())
    .post('/v1/margins')
    .send({ name: 'Reutilizable', value: 10 });

  await request(app.getHttpServer())
    .delete(`/v1/margins/${createRes.body.id}`)
    .expect(204);

  // Sin el partial unique index, esto fallaría con 409
  const recreateRes = await request(app.getHttpServer())
    .post('/v1/margins')
    .send({ name: 'Reutilizable', value: 25 })
    .expect(201);

  expect(recreateRes.body.id).not.toBe(createRes.body.id);
});
```

Este test es imposible de hacer en un unit test — el comportamiento viene de la DB.

---

## 16. dataSource — acceder la DB directamente

```ts
dataSource = moduleFixture.get(DataSource);
```

`DataSource` es la conexión TypeORM a la DB. Se obtiene del módulo compilado con `moduleFixture.get(DataSource)`. Tenés acceso directo a la DB para:

**Obtener repositorios para seed:**

```ts
const userRepo = dataSource.getRepository(UserEntity);
const user = await userRepo.save(userRepo.create({ email: '...' }));
```

**Correr migraciones:**

```ts
await dataSource.runMigrations();
```

**Cerrar la conexión al terminar:**

```ts
await dataSource.destroy();
```

**¿Por qué `dataSource.destroy()` antes de `app.close()`?**

TypeORM mantiene un pool de conexiones abiertas. Si no se destruyen explícitamente, Jest detecta los "open handles" y muestra warnings, o en algunos casos el proceso nunca termina. `destroy()` cierra todas las conexiones activas del pool.

---

## 17. Seed data — crear el estado inicial de la DB

Los e2e necesitan datos en la DB antes de los tests. El seed se hace en el `beforeAll`, después de que la app está inicializada.

### Seed via repositorio directo (más común)

```ts
// test/orders/orders.e2e-spec.ts:183
const profileRepo = dataSource.getRepository(ProfileEntity);
const userRepo    = dataSource.getRepository(UserEntity);

const profile = await profileRepo.save(
  profileRepo.create({ name: 'Test', lastName: 'User' })
);
const user = await userRepo.save(
  userRepo.create({
    email: 'test@e2e.com',
    password: 'password',
    isActive: true,
    profileId: profile.id,
  })
);
userId = user.id;      // guardamos el id para usarlo en los tests
mockUser.sub = userId; // actualizamos el mock del JWT con el userId real
```

Se crean las entidades directamente en la DB sin pasar por el pipeline HTTP. Es más rápido y directo.

**El orden importa:** hay relaciones de FK. Hay que crear primero las entidades padre:
1. `ProfileEntity` → sin dependencias
2. `UserEntity` → necesita `profileId`
3. `CategoryEntity` → sin dependencias
4. `ProductEntity` → necesita `categoryId`
5. `StockLocationEntity` → sin dependencias
6. `StockItemEntity` → necesita `productId` y `locationId`

### Seed via HTTP (cuando se quiere testear el propio endpoint de creación)

```ts
// test/coupons/coupons.e2e-spec.ts:107
const fixedRes = await request(app.getHttpServer())
  .post('/v1/coupons')
  .send({ code: 'FIXED100', value: 20, isGlobal: false })
  .expect(201);
fixedCouponId = fixedRes.body.id;
```

Se crea el cupón usando el endpoint real. El seed también ejercita el endpoint POST, lo que es una forma de verificar implícitamente que la creación funciona.

---

## 18. Variables compartidas entre tests

```ts
// test/orders/orders.e2e-spec.ts:55
describe('Orders (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let userId: number;        // ← se asigna en beforeAll
  let productId: number;     // ← se asigna en beforeAll
  let couponCode: string;    // ← se asigna en beforeAll
```

Las variables declaradas en el scope del `describe` son accesibles por todos los `it` y `beforeAll`/`afterAll` dentro. Se asignan en el `beforeAll` durante el seed y se usan en los tests para construir requests con IDs reales de la DB.

```ts
it('201 — crea orden con pickup', async () => {
  const res = await request(app.getHttpServer())
    .post('/v1/orders')
    .send({
      items: [{ productId, quantity: 1 }],  // ← usa productId del seed
      deliveryType: DeliveryType.PICKUP,
    })
    .expect(201);

  expect(res.body.userId).toBe(userId);  // ← verifica que es el usuario del seed
});
```

Esto es diferente a los unit tests donde todo viene de `mockUser()` y `mockProduct()` — acá los IDs son los reales de la DB de test.

---

## 19. Estado acumulativo — tests que dependen de tests anteriores

En los e2e de esta misma suite, los `it` se ejecutan **en el orden en que están escritos** y el estado de la DB persiste entre ellos. Este es el patrón más importante y diferente respecto a los unit tests.

### Ejemplo de flujo acumulativo — auth:

```ts
describe('Auth (e2e)', () => {
  let activationToken: string;   // se llena en el test de register
  let refreshToken: string;      // se llena en el test de login
  let accessToken: string;       // se llena en el test de login

  describe('POST /auth/register', () => {
    it('should register and return 201', async () => {
      await request(...).post('/v1/auth/register').send(testUser).expect(201);
      // capturamos el token del mock del mail service
      activationToken = mockMailService.sendActivationEmail.mock.calls[0][2];
    });
  });

  describe('GET /auth/activate', () => {
    it('should activate account', () =>
      // usa activationToken del test anterior ↑
      request(...).get(`/v1/auth/activate?token=${activationToken}`).expect(200)
    );
  });

  describe('POST /auth/login', () => {
    it('should login and return tokens', async () => {
      const res = await request(...).post('/v1/auth/login').send(...).expect(200);
      accessToken = res.body.access_token;   // ← se usan en tests posteriores
      refreshToken = res.body.refresh_token;
    });
  });
```

Cada bloque `describe` de auth depende de que el anterior haya funcionado. El usuario registrado en el primer describe es el mismo que se activa, loguea y cuyo token se revoca al final.

**¿Es esto un problema?**

Depende del punto de vista. La recomendación general de testing es que cada test sea independiente. Pero en e2e de flujos de auth, tiene sentido porque:
1. El flujo real es secuencial: primero registrarse, luego activar, luego loguearse
2. Recrear ese estado desde cero en cada test sería repetitivo
3. Si un test intermedio falla, los siguientes también fallarán — eso es información útil

---

## 20. Capturar datos del flujo: mock.calls en e2e

Este es el patrón más sofisticado del e2e de auth:

```ts
// test/auth/auth.e2e-spec.ts:132
it('should register and return 201', async () => {
  await request(app.getHttpServer())
    .post('/v1/auth/register')
    .send(testUser)
    .expect(201);

  // El token de activación fue enviado al MailService mock
  // Lo capturamos para usarlo en el siguiente test
  activationToken = mockMailService.sendActivationEmail.mock.calls[0][2];
});

// Más tarde...
it('should activate account', () =>
  request(...).get(`/v1/auth/activate?token=${activationToken}`).expect(200)
);
```

**¿Por qué este patrón?**

El token de activación es generado aleatoriamente dentro del `AuthService` con `crypto.randomBytes`. No podés predecirlo. En producción, el usuario lo recibe por email. En el test, el `MailService` está mockeado — `sendActivationEmail` no manda email real, pero **sí fue llamado con el token**. Ese token queda registrado en `mockMailService.sendActivationEmail.mock.calls`.

```
mock.calls[0]     → primera llamada a sendActivationEmail
mock.calls[0][0]  → primer argumento (email: 'test@waiona.com')
mock.calls[0][1]  → segundo argumento (name: 'Test')
mock.calls[0][2]  → tercer argumento (token: 'abc123...')
```

El mismo patrón para el reset de password:

```ts
// test/auth/auth.e2e-spec.ts:325
it('should reset password and allow login with new password', async () => {
  const resetToken = mockMailService.sendPasswordResetEmail.mock.calls[0][2];
  await request(...).post('/v1/auth/reset-password')
    .send({ token: resetToken, password: 'NewPass1234!' })
    .expect(200);
});
```

---

## 21. overrideGuard con ExecutionContext — inyectar usuario en el request

En los unit tests el `overrideGuard` devuelve simplemente `true`:
```ts
.overrideGuard(AuthGuard('jwt')).useValue({ canActivate: jest.fn(() => true) })
```

Pero en los e2e de orders y payments, el controller necesita el usuario en `req.user` (porque usa `@CurrentUser()` que lee `req.user`). Se usa una versión más completa:

```ts
// test/orders/orders.e2e-spec.ts:157
.overrideGuard(AuthGuard('jwt'))
.useValue({
  canActivate: (context: ExecutionContext) => {
    const req = context.switchToHttp().getRequest();
    req.user = { ...mockUser };   // ← inyecta el usuario en el request
    return true;
  },
})
```

**Paso a paso:**

1. `context: ExecutionContext` — el contexto de ejecución de NestJS, que envuelve el request HTTP
2. `context.switchToHttp()` — extrae el contexto HTTP del contexto general
3. `.getRequest()` — obtiene el objeto request de Express
4. `req.user = { ...mockUser }` — inyecta el objeto usuario donde el `JwtStrategy` normalmente lo pondría
5. `return true` — el guard aprueba el request

**¿Por qué `{ ...mockUser }` en lugar de `mockUser`?**

Para copiar el objeto en ese momento. Si usara `mockUser` directamente (por referencia), y `mockUser` fuera mutado en un test (ver sección 22), el objeto ya inyectado en requests anteriores no cambiaría, pero el próximo request usaría el `mockUser` mutado. El spread `{...}` crea una copia en cada llamada al guard.

---

## 22. mockUser mutable — simular distintos roles entre tests

```ts
// test/orders/orders.e2e-spec.ts:60
const mockUser: { sub: number; role: string } = {
  sub: 0,
  role: RoleType.ADMIN,
};
```

El mock del guard lee `mockUser` en el momento en que llega cada request. Si mutamos `mockUser.role` antes de un request, ese request llega como ese rol:

```ts
// test/orders/orders.e2e-spec.ts:461
it('403 — cliente accede a órdenes de otro usuario', async () => {
  mockUser.role = RoleType.CLIENT;      // ← cambio de rol
  await request(app.getHttpServer())
    .get('/v1/orders/user/999999')
    .expect(403);
  mockUser.role = RoleType.ADMIN;       // ← restaurar para que los tests siguientes sean ADMIN
});
```

Y también el `sub` (userId) puede cambiar:

```ts
// test/orders/orders.e2e-spec.ts:501
it('403 — cliente accede a orden de otro usuario', async () => {
  mockUser.sub  = 999999;              // ← simular otro usuario
  mockUser.role = RoleType.CLIENT;
  await request(app.getHttpServer())
    .get(`/v1/orders/${orderId}`)
    .expect(403);
  mockUser.sub  = userId;              // ← restaurar
  mockUser.role = RoleType.ADMIN;
});
```

**Patrón crítico: siempre restaurar al final**

Si olvidás restaurar `mockUser.role = RoleType.ADMIN` después del test de 403, todos los tests siguientes correrán como `CLIENT` y fallarán con 403 o con lógica incorrecta.

---

## 23. ConfigModule.forRoot — leer variables de entorno

```ts
ConfigModule.forRoot({ isGlobal: true }),
```

Esta línea hace que `ConfigService` esté disponible en toda la aplicación y lea el archivo `.env` de la raíz del proyecto.

**`isGlobal: true`** — registra el módulo como global. Sin esto, habría que importar `ConfigModule` en cada módulo que quiera usar `ConfigService`. Con `isGlobal: true`, está disponible en todos lados.

En los e2e, el `TypeOrmModule.forRootAsync` usa `ConfigService` para leer `POSTGRES_HOST`, `POSTGRES_TEST_PORT`, etc. Sin `ConfigModule.forRoot`, el `ConfigService.get()` devolvería `undefined` para todas las keys.

---

## 24. Módulos reales vs mocks en e2e

En un e2e, el objetivo es usar **código real**, pero con algunas dependencias reemplazadas por mocks cuando:

1. El servicio real haría algo destructivo o irreversible (enviar emails reales, cobrar pagos reales)
2. El servicio real tiene demasiadas dependencias que agregan complejidad innecesaria al test

**Lo que está REAL en cada e2e:**

| E2E | Real | Mockeado |
|---|---|---|
| auth | AuthService, UsersService, JwtModule, PassportModule, DB | MailService |
| margins | MarginsService, DB | ProductPricingRepo, ComboPricingRepo, guards |
| orders | OrdersService, StockItemsService, DB | CalculationService, MailService, guards |
| payments | PaymentsService, DB | MercadoPagoProvider, OrdersService, guards |
| analytics | AnalyticsService, DB | guards |

**¿Por qué el auth e2e usa módulos reales de Passport y JWT?**

Porque el e2e de auth testea el flujo de autenticación completo — el `LocalStrategy` que verifica credenciales y el `JwtStrategy` que parsea el token JWT. Sin esos módulos reales, no estarías testeando auth de verdad.

```ts
// test/auth/auth.e2e-spec.ts:69
PassportModule,
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get('JWT_SECRET') ?? 'test_secret',
    signOptions: { expiresIn: '15m' },
  }),
}),
```

Y los providers reales:
```ts
providers: [
  AuthService,
  UsersService,
  LocalStrategy,    // ← real
  JwtStrategy,      // ← real
  { provide: MailService, useValue: mockMailService },  // ← mock
],
```

---

## 25. Mock parcial de servicio externo

```ts
// test/payments/payments.e2e-spec.ts:77
const mockMpProvider = {
  createPreference: jest.fn().mockResolvedValue({
    id: 'pref_test_123',
    checkoutUrl: 'https://mp.com/checkout/test',
  }),
  getClient: jest.fn().mockReturnValue({}),
};
```

`MercadoPagoProvider` llama a la API real de MercadoPago. En tests, eso es inaceptable: no se puede depender de conectividad externa, y no se quieren cobros reales.

Se reemplaza con un objeto que tiene los mismos métodos pero devuelve datos fijos. El `PaymentsService` no sabe la diferencia — llama `this.mpProvider.createPreference(dto)` y recibe `{ id: 'pref_test_123', ... }`.

**¿Por qué `jest.fn()` y no una función plain como en coupons?**

Porque acá se quiere poder verificar que el provider fue llamado, o cambiar el retorno en algún test:

```ts
it('201 — crea pago con MercadoPago para orden pendiente', async () => {
  // ...
  expect(res.body.checkoutUrl).toBe('https://mp.com/checkout/test');
  // implícitamente verifica que createPreference fue llamado y devolvió esa URL
});
```

---

## 26. mockRepo sin jest.fn() — plain objects como repos

```ts
// test/coupons/coupons.e2e-spec.ts:37
const mockProductRepo = {
  findOne: () => Promise.resolve({ id: 1, name: 'Mock Product' }),
};
const mockComboRepo = {
  findOne: () => Promise.resolve({ id: 1, name: 'Mock Combo' }),
};
```

En algunos e2e, se mockean repos con **funciones plain**, no con `jest.fn()`. Diferencia:

- `jest.fn().mockResolvedValue(...)` — trackeable, podés verificar si fue llamado
- `() => Promise.resolve(...)` — no trackeable, más liviano, suficiente cuando solo necesitás que exista

Acá se usan funciones plain porque `CouponProductTargetService` y `CouponComboTargetService` verifican que el producto/combo exista antes de crear el target. Si el repo devuelve `null`, el service lanzaría `NotFoundException`. Con este mock que siempre devuelve un objeto, las validaciones de existencia siempre pasan sin necesidad de que existan productos/combos reales en la DB.

---

## 27. Seed via HTTP vs Seed via repo directo

Hay dos estrategias para crear datos en el `beforeAll`:

### Seed via repo (más común — más rápido y directo)

```ts
// test/orders/orders.e2e-spec.ts:190
const product = await productRepo.save(
  productRepo.create({
    sku: 'P001',
    name: 'Test Product',
    ...
  })
);
productId = product.id;
```

Se bypasea el pipeline HTTP. No pasa por ValidationPipe, guards, ni interceptores. Es más rápido y apropiado para datos de soporte (el producto no es lo que se testea, es el contexto para testear orders).

### Seed via HTTP (cuando la creación misma es parte del flujo)

```ts
// test/coupons/coupons.e2e-spec.ts:108
const fixedRes = await request(app.getHttpServer())
  .post('/v1/coupons')
  .send({ code: 'FIXED100', value: 20, isGlobal: false })
  .expect(201);
fixedCouponId = fixedRes.body.id;
```

El seed en sí es un e2e implícito: si el endpoint POST /coupons no funcionara, el seed fallaría y todos los tests fallarían. También garantiza que el ID del cupón es el que la API devuelve, no un ID generado directamente.

---

## 28. beforeAll anidado dentro de describe

```ts
// test/orders/orders.e2e-spec.ts:475
describe('GET /orders/:id', () => {
  let orderId: number;   // ← scope local a este describe

  beforeAll(async () => {
    // Crear una orden específica para estos tests
    const res = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        items: [{ productId, quantity: 1 }],
        deliveryType: DeliveryType.PICKUP,
      });
    orderId = res.body.id;
  });

  it('200 — retorna orden por id', async () => {
    const res = await request(app.getHttpServer())
      .get(`/v1/orders/${orderId}`)
      .expect(200);
    expect(res.body.id).toBe(orderId);
  });

  it('404 — orden inexistente', async () => {
    await request(app.getHttpServer()).get('/v1/orders/999999').expect(404);
  });
});
```

**¿Cuándo usar `beforeAll` anidado en lugar del externo?**

El `beforeAll` externo crea el estado compartido para toda la suite (usuario, producto, stock). El `beforeAll` anidado crea estado específico para un subset de tests — en este caso, una orden cuyo `id` será el objetivo de los GETs.

Si pusierais la creación de la orden en el `beforeAll` externo, `orderId` estaría disponible en toda la suite pero el nombre de la variable no daría contexto de para qué es. Anidándolo, queda claro que esa orden existe específicamente para los tests de `GET /orders/:id`.

---

## 29. Función helper externa para seed complejo

```ts
// test/analytics/analytics.e2e-spec.ts:221 — FUERA del describe
async function seedTestData(ds: DataSource): Promise<void> {
  const categoryRepo  = ds.getRepository(CategoryEntity);
  const productRepo   = ds.getRepository(ProductEntity);
  // ... más repos

  const productA = await productRepo.save( productRepo.create({ ... }) );
  const productB = await productRepo.save( productRepo.create({ ... }) );
  // ... más entidades

  await orderRepo.save(makeOrder(OrderStatus.DELIVERED, 1500));
  await orderRepo.save(makeOrder(OrderStatus.PENDING,   800));
  await orderRepo.save(makeOrder(OrderStatus.CANCELLED, 500));
}

// Dentro del beforeAll:
beforeAll(async () => {
  // ... setup de la app ...
  await seedTestData(dataSource);  // ← llamar la función
}, 30000);
```

Cuando el seed es complejo (muchas entidades interrelacionadas), moverlo a una función externa mantiene el `beforeAll` legible. La función recibe el `DataSource` como argumento y crea todo lo necesario.

**Sub-helper dentro de seedTestData:**

```ts
const makeOrder = (status: OrderStatus, total: number) =>
  orderRepo.create({
    userId: user.id,
    status,
    deliveryType: DeliveryType.PICKUP,
    subtotal: total,
    total,
  });

const deliveredOrder = await orderRepo.save(makeOrder(OrderStatus.DELIVERED, 1500));
await orderRepo.save(makeOrder(OrderStatus.PENDING, 800));
await orderRepo.save(makeOrder(OrderStatus.CANCELLED, 500));
```

`makeOrder` es una factory local dentro de `seedTestData` para no repetir todos los campos de la orden. El patrón es el mismo que las factory functions de los unit tests, adaptado al contexto de seed.

---

## 30. ALL_ENTITIES — constante para la lista de entidades

```ts
// test/analytics/analytics.e2e-spec.ts:40
const ALL_ENTITIES = [
  OrderEntity,
  OrderItemEntity,
  ProductEntity,
  ProductImageEntity,
  CategoryEntity,
  ComboEntity,
  ComboItemEntity,
  ComboImageEntity,
  StockItemEntity,
  StockLocationEntity,
  StockMovementEntity,
  StockWriteOffEntity,
  UserEntity,
  ProfileEntity,
  RoleEntity,
  CouponEntity,
];

// En el TypeOrmModule:
TypeOrmModule.forRootAsync({
  useFactory: () => ({
    // ...
    entities: ALL_ENTITIES,
    // ...
  }),
}),
```

Cuando un e2e necesita muchas entidades (analytics tiene relaciones a órdenes, productos, stock, usuarios), extraer la lista a una constante evita repetirla entre `forRootAsync` (donde van todas las entidades para que TypeORM cree las tablas) y `forFeature` (donde van las que los services necesitan inyectadas como repos).

---

## 31. validProduct con Date.now() — factory con unicidad

```ts
// test/products/product.e2e-spec.ts:29
const validProduct = () => ({
  sku: `SKU-${Date.now()}`,     // ← SKU único en cada llamada
  name: 'Coca Cola 500ml',
  description: 'Gaseosa negra 500ml',
  measurementUnit: 'unit',
  categoryId,
});
```

`Date.now()` devuelve el timestamp en milisegundos — garantiza que cada llamada a `validProduct()` genera un SKU diferente. Esto es necesario porque:

1. El SKU tiene constraint `UNIQUE` en la DB
2. Varios tests crean productos con `validProduct()`
3. Si todos usaran el mismo SKU, el segundo test fallaría con 409

**¿Por qué una función `() => ({...})` en lugar de un objeto?**

Porque `Date.now()` debe evaluarse en el momento de la llamada, no cuando se define. Si fuera `const validProduct = { sku: \`SKU-${Date.now()}\` }`, todos los tests usarían el mismo timestamp.

---

## 32. Helper de firma HMAC para webhook

```ts
// test/payments/payments.e2e-spec.ts:11
function mpSignatureHeaders(queryParams: Record<string, string> = {}) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return {};   // ← sin secret, no hay firma (tests pasan igual)
  const ts = '1234567890';
  const xRequestId = 'test-request-id';
  const dataId = queryParams['data.id'] ?? queryParams['id'] ?? '';
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex');
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': xRequestId };
}

// Uso:
await request(app.getHttpServer())
  .post('/v1/payments/webhook/mercadopago')
  .set(mpSignatureHeaders())   // ← los headers de firma van acá
  .send({})
  .expect(200);
```

El webhook de MercadoPago valida la firma HMAC de cada request. Sin la firma correcta, el controller rechaza el webhook (aunque siempre devuelve 200 hacia MP para que no reintente).

La función helper genera los headers de firma igual que lo haría MercadoPago, usando el mismo `MP_WEBHOOK_SECRET` del `.env`. Si la variable no está seteada, devuelve `{}` — los tests siguen pasando porque el controller skipea la validación cuando no hay secret configurado.

---

## 33. toMatchObject — matcher parcial de objeto

```ts
// test/analytics/analytics.e2e-spec.ts:122
expect(res.body).toMatchObject({
  total: expect.any(Number),
  byStatus: expect.objectContaining({
    pending:   expect.any(Number),
    confirmed: expect.any(Number),
    // ...
  }),
  totalRevenue:     expect.any(Number),
  revenueToday:     expect.any(Number),
  revenueThisMonth: expect.any(Number),
});
```

`toMatchObject` verifica que el objeto recibido **contiene** todas las propiedades del expected — el objeto puede tener más propiedades. Similar a `expect.objectContaining` pero usado directamente en `expect(valor).toMatchObject(...)`.

**Diferencia con `toEqual`:**

```ts
// toEqual — el objeto debe ser EXACTAMENTE igual (nada más, nada menos)
expect(res.body).toEqual({ total: 3, byStatus: { ... } });

// toMatchObject — el objeto debe CONTENER estas propiedades (puede tener más)
expect(res.body).toMatchObject({ total: expect.any(Number) });
```

En e2e de analytics, `toMatchObject` es perfecto para verificar la **forma** de la respuesta sin importar los valores exactos (que dependen del seed).

---

## 34. Matchers numéricos: toBeGreaterThan, toBeLessThan, etc.

```ts
// test/orders/orders.e2e-spec.ts:434
expect(res.body.total).toBeLessThan(res.body.subtotal);      // el cupón bajó el total
expect(res.body.couponDiscount).toBeGreaterThan(0);           // hubo descuento

// test/analytics/analytics.e2e-spec.ts:148
expect(res.body.total).toBe(3);                               // exacto
expect(res.body.totalRevenue).toBeGreaterThan(0);             // mayor que cero

// test/margins/margins.e2e-spec.ts:185
expect(res.body.data.length).toBeLessThanOrEqual(2);          // paginación: máximo 2

// test/analytics/analytics.e2e-spec.ts:214
expect(item.quantityCurrent).toBeLessThanOrEqual(item.stockCritical);
```

| Matcher | Verifica |
|---|---|
| `toBeGreaterThan(n)` | `valor > n` |
| `toBeGreaterThanOrEqual(n)` | `valor >= n` |
| `toBeLessThan(n)` | `valor < n` |
| `toBeLessThanOrEqual(n)` | `valor <= n` |

Estos matchers son especialmente útiles en e2e donde los valores exactos dependen del seed o del momento de ejecución (timestamps, IDs autogenerados, etc.).

---

## 35. Timeout extendido en beforeAll

```ts
// test/auth/auth.e2e-spec.ts:105
}, 30000);
//  ↑ segundo argumento de beforeAll — timeout en ms

// Lo mismo en orders y payments:
}, 30000);
```

El segundo argumento de `beforeAll` es el timeout en milisegundos. Por defecto Jest tiene un timeout de 5000ms (5 segundos). El `beforeAll` de los e2e puede tardar más porque:

1. TypeORM se conecta a PostgreSQL (puede tardar 1-2 segundos)
2. `dropSchema: true` + `synchronize: true` elimina y recrea todas las tablas
3. El seed inserta múltiples entidades con queries a la DB
4. NestJS inicializa todos los módulos

30 segundos (30000ms) da margen amplio para que todo esto suceda incluso en ambientes lentos (CI, contenedores).

---

## 36. maxWorkers: 1 — los e2e corren en serie

```json
// test/jest-e2e.json
"maxWorkers": 1
```

Por defecto, Jest corre múltiples archivos de test en paralelo. Para los unit tests eso es perfecto — no comparten estado. Para los e2e, es un problema grave:

Si `auth.e2e-spec.ts` y `margins.e2e-spec.ts` corrieran al mismo tiempo, ambos conectarían a la misma `waiona_test` DB, y ambos harían `dropSchema: true` al inicializar. El `dropSchema` de uno eliminaría las tablas que el otro está usando activamente.

Con `maxWorkers: 1`, solo un archivo de test corre a la vez. Los archivos e2e se ejecutan **en secuencia**, cada uno con su propio ciclo de `dropSchema → seed → tests → destroy`.

---

## 37. E2E de auth — el flujo más completo

El e2e de auth (`test/auth/auth.e2e-spec.ts`) es el más completo del proyecto porque testea un flujo donde el estado evoluciona a través de múltiples requests. Es el mejor ejemplo de por qué los e2e existen:

```
register     → usuario inactivo creado en DB, email de activación "enviado" al mock
activate     → usuario activo, token marcado como usado en DB
login-previo → 401 porque cuenta no estaba activa
login        → access_token y refresh_token generados y guardados en DB
refresh      → refresh_token rotado: el viejo revocado, uno nuevo generado
logout       → refresh_token revocado en DB
forgot-pwd   → token de reset "enviado" al mock, guardado en DB
reset-pwd    → password cambiado en DB, token marcado como usado
change-pwd   → con JWT válido, verifica password actual antes de cambiar
logout-all   → todos los refresh tokens del usuario revocados en DB
```

**Lo que este flujo testea que un unit test no puede:**

- Que `bcrypt.compare` funciona con la password real guardada en la DB
- Que el token JWT generado en login es válido para autenticar en change-password
- Que la rotación de refresh tokens realmente funciona: el viejo revocado es rechazado, el nuevo es aceptado
- Que `dropSchema: true` en el siguiente run empieza sin el usuario previo

---

## 38. E2E con guards reales vs sin guards

En los e2e de auth, los guards JWT **son reales** porque el punto de testear auth es verificar que el JWT funciona:

```ts
// test/auth/auth.e2e-spec.ts — SIN overrideGuard
it('401 — sin access token', () =>
  request(app.getHttpServer())
    .patch('/v1/auth/change-password')
    .send({ ... })
    .expect(401));  // ← el JWT guard real rechaza

it('200 — cambia la contraseña correctamente', async () => {
  await request(app.getHttpServer())
    .patch('/v1/auth/change-password')
    .set('Authorization', `Bearer ${accessToken}`)  // ← JWT real
    .send({ ... })
    .expect(200);
});
```

En los e2e de todos los otros módulos, los guards están **desactivados** con `overrideGuard` porque esos tests no se ocupan de autenticación — se ocupan de la lógica del módulo:

```ts
// test/margins/margins.e2e-spec.ts:68
.overrideGuard(AuthGuard('jwt')).useValue({ canActivate: () => true })
.overrideGuard(RolesGuard).useValue({ canActivate: () => true })
```

En orders y payments, los guards están desactivados pero con la variante que inyecta el usuario porque `@CurrentUser()` lo necesita (ver sección 21).

---

## 39. Diferencias clave: unit test vs e2e

Tabla completa de todas las diferencias:

| Aspecto | Unit Test | E2E |
|---|---|---|
| Ubicación | `src/**/*.spec.ts` | `test/**/*.e2e-spec.ts` |
| Config Jest | `jest.json` (default) | `test/jest-e2e.json` |
| Ciclo de vida | `beforeEach` — recrea por test | `beforeAll` — levanta una vez por suite |
| Base de datos | No existe — repos mockeados | PostgreSQL real (`waiona_test`) |
| Requests HTTP | No existen — se llama el método directamente | Supertest hace requests HTTP reales |
| Validación (pipes) | No existe | ValidationPipe real aplicado |
| Serialización | No existe | ClassSerializerInterceptor real |
| Versionado /v1 | No existe | `enableVersioning` real |
| Guards | `overrideGuard` → siempre pasan | Auth real (en auth.e2e) o override (en el resto) |
| Velocidad | ~1ms por test | ~50-500ms por test |
| Paralelismo | Múltiples workers | `maxWorkers: 1` — serie |
| Timeout | 5 segundos (default) | 30 segundos para `beforeAll` |
| Estado entre tests | Aislado — mocks frescos | Acumulativo — la DB persiste entre `it` |
| Qué detecta | Bugs en lógica de negocio | Bugs en integración, pipeline HTTP, schema DB |

---

## Resumen de referencia rápida

| Pieza | Para qué sirve |
|---|---|
| `jest-e2e.json` | Config separada para e2e: testRegex, maxWorkers, moduleNameMapper |
| `beforeAll(fn, 30000)` | Levanta app y DB una sola vez, con timeout extendido |
| `afterAll(fn)` | Cierra DB y app al terminar la suite |
| `INestApplication` | La instancia de la app NestJS en los tests |
| `createNestApplication()` | Convierte el TestingModule en una app HTTP |
| `app.useGlobalPipes(...)` | Registra el ValidationPipe (antes de `init`) |
| `app.enableVersioning(...)` | Activa el prefijo `/v1` en rutas (antes de `init`) |
| `app.useGlobalInterceptors(...)` | Activa ClassSerializer para `@Exclude()` |
| `app.init()` | Levanta el servidor HTTP y establece conexión a DB |
| `app.close()` | Shutdown graceful del servidor |
| `app.getHttpServer()` | Devuelve el servidor HTTP para pasárselo a Supertest |
| `request(server).get(url)` | Request GET con Supertest |
| `.send(body)` | Body JSON del request |
| `.set('Authorization', 'Bearer token')` | Header de autorización |
| `.set(objetoHeaders)` | Múltiples headers de una vez |
| `.query(params)` | Query string del request |
| `.expect(statusCode)` | Verificar el status HTTP de la respuesta |
| `.expect(callback)` | Verificar el body con una función |
| `res.body` | El body JSON parseado de la respuesta |
| `TypeOrmModule.forRootAsync(...)` | Configurar conexión real a PostgreSQL |
| `TypeOrmModule.forFeature([...])` | Registrar repos de entidades en el DI |
| `synchronize: true` | Crear/actualizar tablas desde entidades automáticamente |
| `dropSchema: true` | Eliminar todas las tablas al inicializar (DB limpia) |
| `dataSource.runMigrations()` | Correr migraciones en vez de synchronize |
| `dataSource.getRepository(Entity)` | Acceder repos directamente para seed |
| `dataSource.destroy()` | Cerrar conexiones a la DB |
| `moduleFixture.get(DataSource)` | Obtener el DataSource del módulo compilado |
| Seed via repo | Crear datos de contexto directamente en la DB |
| Seed via HTTP | Crear datos usando el propio endpoint (seed = e2e implícito) |
| `overrideGuard` con `canActivate` que inyecta `req.user` | Simular usuario autenticado en e2e |
| `mockUser` mutable | Simular cambios de rol/userId entre tests |
| `mock.calls[0][2]` | Capturar tokens generados internamente del mock del mail |
| `ALL_ENTITIES` | Constante para la lista de entidades cuando son muchas |
| `validProduct()` con `Date.now()` | Factory con SKU único por timestamp |
| `mpSignatureHeaders()` | Helper para firmar headers del webhook de MP |
| `toMatchObject(shape)` | Verificar que el objeto tiene la forma esperada (parcial) |
| `toBeGreaterThan(n)` | Verificar que un número es mayor que n |
| `toBeLessThan(n)` | Verificar que un número es menor que n |
| `toBeLessThanOrEqual(n)` | Verificar que un número es menor o igual que n |
| `maxWorkers: 1` | E2E corren en serie para no pisarse la DB |
| `beforeAll` anidado | Setup específico para un subset de tests |
| Función helper externa de seed | Extraer seed complejo del beforeAll para legibilidad |
