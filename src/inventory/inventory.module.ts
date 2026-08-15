import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsXlsxExporter } from './export/products-xlsx.exporter';
import { CatalogCsvImporter } from './import/catalog-csv.importer';
import { ImportBatchProcessor } from './import/import-batch.processor';
import { PartsXlsxImporter } from './import/parts-xlsx.importer';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

@Module({
  imports: [StorageModule],
  controllers: [CategoriesController, ProductsController, MovementsController],
  providers: [
    CategoriesService,
    ProductsService,
    StockService,
    MovementsService,
    ImportBatchProcessor,
    PartsXlsxImporter,
    CatalogCsvImporter,
    ProductsXlsxExporter,
  ],
  exports: [
    CategoriesService,
    ProductsService,
    StockService,
    MovementsService,
    PartsXlsxImporter,
    CatalogCsvImporter,
  ],
})
export class InventoryModule {}
