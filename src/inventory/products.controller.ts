import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { memoryStorage } from 'multer';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthUser } from '../auth/strategies/jwt.strategy';
import { Role } from '../generated/prisma/client';
import {
  PHOTO_STORAGE,
  type PhotoStorage,
} from '../storage/photo-storage.interface';
import { ProductsXlsxExporter } from './export/products-xlsx.exporter';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ImportOptionsDto } from './dto/import-options.dto';
import { ListProductsQueryDto } from './dto/list-products.query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CatalogCsvImporter } from './import/catalog-csv.importer';
import { PartsXlsxImporter } from './import/parts-xlsx.importer';
import { ProductsService } from './products.service';
import { StockService } from './stock.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPERADMIN)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly stockService: StockService,
    private readonly partsXlsxImporter: PartsXlsxImporter,
    private readonly catalogCsvImporter: CatalogCsvImporter,
    private readonly productsXlsxExporter: ProductsXlsxExporter,
    @Inject(PHOTO_STORAGE) private readonly photoStorage: PhotoStorage,
  ) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.findMany(query);
  }

  @Get('export/xlsx')
  @Header(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  )
  async exportXlsx(
    @Query('categoryId') categoryId: string | undefined,
    @Res() res: Response,
  ) {
    const buffer = await this.productsXlsxExporter.export(categoryId);
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="inventario.xlsx"',
    );
    res.send(buffer);
  }

  @Get('by-barcode/:code')
  findByBarcode(@Param('code') code: string) {
    return this.productsService.findByBarcode(code);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.softDelete(id);
  }

  @Post(':id/images')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_PHOTO_BYTES },
    }),
  )
  async uploadImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('La foto es requerida');
    if (!ALLOWED_MIME.has(file.mimetype))
      throw new BadRequestException('Formato de imagen no permitido');

    const photoUrl = await this.photoStorage.upload({
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    return this.productsService.addImage(id, photoUrl);
  }

  @Delete(':id/images/:imageId')
  removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productsService.removeImage(id, imageId);
  }

  @Patch(':id/images/:imageId/primary')
  setPrimaryImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.productsService.setPrimaryImage(id, imageId);
  }

  @Post(':id/stock/adjust')
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
    @Req() req: Request & { user: AuthUser },
  ) {
    return this.stockService.adjust(
      id,
      req.user.id,
      dto.type,
      dto.quantity,
      dto.reason,
    );
  }

  @Get(':id/stock/movements')
  async listMovements(@Param('id', ParseUUIDPipe) id: string) {
    const movements = await this.stockService.listMovements(id);
    return movements.map((movement) =>
      this.productsService.toPublicMovement(movement),
    );
  }

  @Post('import/parts-xlsx')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  importPartsXlsx(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() options: ImportOptionsDto,
  ) {
    if (!file) throw new BadRequestException('El archivo XLSX es requerido');
    return this.partsXlsxImporter.import(file.buffer, options.mode ?? 'merge');
  }

  @Post('import/catalog-csv')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  importCatalogCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() options: ImportOptionsDto,
  ) {
    if (!file) throw new BadRequestException('El archivo CSV es requerido');
    return this.catalogCsvImporter.import(file.buffer, options.mode ?? 'merge');
  }
}
