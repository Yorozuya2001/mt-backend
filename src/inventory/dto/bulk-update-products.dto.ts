import { IsUUID } from 'class-validator';
import { BulkProductIdsDto } from './bulk-product-ids.dto';

export class BulkUpdateProductsDto extends BulkProductIdsDto {
  @IsUUID()
  categoryId: string;
}
