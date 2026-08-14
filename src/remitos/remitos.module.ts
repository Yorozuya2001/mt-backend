import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { RemitosController } from './remitos.controller';
import { RemitosService } from './remitos.service';

@Module({
  imports: [InventoryModule],
  controllers: [RemitosController],
  providers: [RemitosService],
  exports: [RemitosService],
})
export class RemitosModule {}
