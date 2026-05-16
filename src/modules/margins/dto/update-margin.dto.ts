import { PartialType } from '@nestjs/swagger';
import { CreateMarginDto } from './create-margin.dto';

export class UpdateMarginDto extends PartialType(CreateMarginDto) {}
