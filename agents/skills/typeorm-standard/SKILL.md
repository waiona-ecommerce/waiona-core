---
name: typeorm-standard
description: >
  TypeORM conventions for entities, DTOs, repositories, relations, soft delete, and transactions in this repo.
  Load when creating entities, DTOs, writing queries, or implementing transactions.
metadata:
  author: @rodrigozucchini
  version: "1.0"
---

# TypeORM Standard Skill

---

## When to Use

Load when the user:
- Creates or modifies a TypeORM entity
- Writes repository queries (`find`, `findOne`, `save`, `create`)
- Implements transactions across multiple tables
- Creates response DTOs from entities
- Works with relations (ManyToOne, OneToMany)

Do NOT load when:
- Only configuring the DataSource connection (use `nestjs-docker-postgres`)
- Writing migrations (use `postgres-standard`)

---

## Core Rules

1. **All entities extend `BaseEntity`**: Gets `id`, `createdAt`, `updatedAt`, `deletedAt` for free.
2. **No manual filter needed**: TypeORM auto-adds `WHERE deletedAt IS NULL` on all queries when `@DeleteDateColumn` is present.
3. **Soft delete only**: `repo.softDelete(id)` — never `.delete()`, `.remove()`, or `entity.isDeleted = true`.
4. **Always return DTOs**: Services return `ResponseDto`, never raw entities.
5. **Transactions for multi-table writes**: Use `dataSource.transaction()` when touching 2+ tables.

---

## BaseEntity

```typescript
// src/common/entities/base.entity.ts
export abstract class BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ nullable: true })
  deletedAt: Date | null;
}
```

---

## Entity Pattern

```typescript
@Entity('nombre_tabla_plural')
@Index(['field'])
export class NombreEntity extends BaseEntity {

  // ==========================
  // Datos básicos
  // ==========================

  @Column({ type: 'varchar', length: 150, nullable: false })
  name: string;

  @Column({ type: 'boolean', default: true, nullable: false })
  isActive: boolean;

  // ==========================
  // FK explícita + relación
  // ==========================

  @Column({ name: 'category_id', type: 'int', nullable: false })
  categoryId: number;

  @ManyToOne(() => CategoryEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  // ==========================
  // Relaciones inversas
  // ==========================

  @OneToMany(() => ItemEntity, (item) => item.nombre)
  items: ItemEntity[];
}
```

**Rules:**
- Table name: snake_case plural
- FK column: `name: 'relation_id'` in snake_case
- `onDelete: 'RESTRICT'` — soft delete protects integrity
- Section comments: `// ==========================`

---

## DTO Patterns

### CreateDto

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CreateNombreDto {
  @ApiProperty({ example: 'Ejemplo', minLength: 3, maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  name: string;
}
```

### UpdateDto — usar `PartialType` de `@nestjs/swagger`, no de `@nestjs/mapped-types`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateNombreDto } from './create-nombre.dto';

export class UpdateNombreDto extends PartialType(CreateNombreDto) {}
```

### ResponseDto

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class NombreResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Ejemplo' })
  name: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(entity: NombreEntity) {
    this.id        = entity.id;
    this.name      = entity.name;
    this.createdAt = entity.createdAt;
    this.updatedAt = entity.updatedAt;
  }
}
```

---

## Query Patterns

```typescript
// findAll — TypeORM auto-filters deletedAt IS NULL
async findAll(): Promise<NombreResponseDto[]> {
  const items = await this.repo.find({
    relations: ['category'],
    order: { name: 'ASC' },
  });
  return items.map(i => new NombreResponseDto(i));
}

// findOne — with NotFoundException
private async findEntity(id: number): Promise<NombreEntity> {
  const entity = await this.repo.findOne({
    where: { id },
    relations: ['category'],
  });
  if (!entity) throw new NotFoundException(`Nombre with id ${id} not found`);
  return entity;
}

// create
async create(dto: CreateNombreDto): Promise<NombreResponseDto> {
  const entity = this.repo.create({ ...dto });
  const saved  = await this.repo.save(entity);
  return new NombreResponseDto(saved);
}

// update — preserve existing values
async update(id: number, dto: UpdateNombreDto): Promise<NombreResponseDto> {
  const entity = await this.findEntity(id);
  const merged = this.repo.merge(entity, dto);
  await this.repo.save(merged);
  return new NombreResponseDto(merged);
}

// soft delete
async delete(id: number): Promise<void> {
  await this.findEntity(id);
  await this.repo.softDelete(id);
}
```

---

## Transactions

Use when writing to 2+ tables:

```typescript
constructor(private readonly dataSource: DataSource) {}

async create(dto: CreateDto): Promise<ResponseDto> {
  return this.dataSource.transaction(async manager => {

    // crear entidad principal
    const entity = manager.create(EntityA, { ...dto });
    const saved  = await manager.save(EntityA, entity);

    // crear entidad relacionada
    const related = manager.create(EntityB, {
      entityAId: saved.id,
      ...dto.related,
    });
    await manager.save(EntityB, related);

    return new ResponseDto(saved);
  });
}
```

**When to use transactions:**
- `create` que guarda múltiples entidades (usuario + perfil)
- `create` que reserva/modifica stock Y guarda la orden
- `create` que registra un uso Y incrementa un contador
- Webhook que actualiza 2 tablas (payment + order)

---

## Relation Loading

```typescript
// Cargar en la query — para datos que siempre se necesitan
findOne({ where: { id, isDeleted: false }, relations: ['category', 'items'] })

// No cargar — para datos opcionales o pesados
// Usar un endpoint separado GET /entity/:id/items
```

---

## Common Mistakes

- **Using `findOneBy`**: Always use `findOne({ where: { id } })`.
- **Hard delete**: Never call `.delete()` or `.remove()` — use `softDelete(id)`.
- **Manual `isDeleted = true`**: Don't set flags manually — `softDelete()` handles it via `@DeleteDateColumn`.
- **Returning entities from services**: Always return DTOs.
- **Missing FK column**: Always declare `@Column({ name: 'x_id' })` alongside `@ManyToOne`.
- **Multi-table writes without transaction**: Use `dataSource.transaction()`.

---

## Edge Cases

| Situation | How to handle it |
|-----------|-----------------|
| Nullable relation in update | Check `dto.field !== undefined` before reassigning — `null` is valid to clear a relation |
| Array relation partially not found | Count resolved vs requested IDs, throw `NotFoundException` if mismatch |
| Cascade save (user + profile) | Use `cascade: true` on the owning side OR explicit `manager.save()` in transaction |
| `quantityAvailable` computed | Use `get` accessor on entity — not a DB column |