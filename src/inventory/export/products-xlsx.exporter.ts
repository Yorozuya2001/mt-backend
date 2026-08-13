import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { decimalToNumber } from '../utils/inventory.utils';

@Injectable()
export class ProductsXlsxExporter {
  constructor(private readonly prisma: PrismaService) {}

  async export(categoryId?: string): Promise<Buffer> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: [{ category: { name: 'asc' } }, { title: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Inventario');
    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Barcode', key: 'barcode', width: 18 },
      { header: 'Titulo', key: 'title', width: 35 },
      { header: 'Categoria', key: 'category', width: 22 },
      { header: 'Marca', key: 'brand', width: 18 },
      { header: 'Presentacion', key: 'presentation', width: 20 },
      { header: 'Precio', key: 'price', width: 12 },
      { header: 'PrecioMayorista', key: 'wholesalePrice', width: 14 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Estado', key: 'status', width: 16 },
      { header: 'Descripcion', key: 'description', width: 50 },
    ];

    for (const product of products) {
      sheet.addRow({
        sku: product.sku ?? '',
        barcode: product.barcode ?? '',
        title: product.title,
        category: product.category.name,
        brand: product.brand ?? '',
        presentation: product.presentation ?? '',
        price: decimalToNumber(product.price) ?? 0,
        wholesalePrice: decimalToNumber(product.wholesalePrice) ?? '',
        stock: product.stock,
        status: product.status,
        description: product.description ?? '',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
