import { PartialType, PickType } from '@nestjs/swagger';
import { CreateStockWriteOffDto } from './create-stock-writeoff.dto';

export class UpdateStockWriteOffDto extends PartialType(
  PickType(CreateStockWriteOffDto, [
    'reason',
    'description',
    'attachments',
  ] as const),
) {}
