/**
 * DataSource para migraciones TypeORM.
 *
 * USO:
 *   npx typeorm migration:generate src/database/migrations/NombreMigracion -d src/database/ormconfig.ts
 *   npx typeorm migration:run -d src/database/ormconfig.ts
 *   npx typeorm migration:revert -d src/database/ormconfig.ts
 *
 * ⚠️ Solo para migraciones en producción.
 * En desarrollo usar synchronize: true (automático al reiniciar).
 */

import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // carga el .env

const compiled = __filename.endsWith('.js');

export default new DataSource({
  type: 'postgres',
  host: process.env.POSTGRES_HOST,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  username: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  entities: [compiled ? 'dist/**/*.entity.js' : 'src/**/*.entity.ts'],
  migrations: [
    compiled ? 'dist/database/migrations/*.js' : 'src/database/migrations/*.ts',
  ],
  synchronize: false,
});
