import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsXlsxExporter } from './export/products-xlsx.exporter';
import { CatalogCsvImporter } from './import/catalog-csv.importer';
import { PartsXlsxImporter } from './import/parts-xlsx.importer';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

@Module({
  imports: [StorageModule],
  controllers: [CategoriesController, ProductsController],
  providers: [
    CategoriesService,
    ProductsService,
    StockService,
    PartsXlsxImporter,
    CatalogCsvImporter,
    ProductsXlsxExporter,
  ],
  exports: [CategoriesService, ProductsService, PartsXlsxImporter, CatalogCsvImporter],
})
export class InventoryModule {}
