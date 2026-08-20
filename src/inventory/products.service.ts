import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Product,
  ProductImage,
  ProductStatus,
  StockMovement,
  User,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BulkUpdatePriceDto } from './dto/bulk-update-price.dto';
import type { BulkUpdateProductsDto } from './dto/bulk-update-products.dto';
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products.query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { decimalToNumber, scalePrice } from './utils/inventory.utils';
import {
  PRODUCT_GAPS,
  gapWhere,
  type ProductGapsCounts,
} from './utils/product-gaps';

export type PublicProductImage = {
  id: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
};

export type PublicStockMovement = {
  id: string;
  type: StockMovement['type'];
  quantity: number;
  reason: string | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    lastName: string;
    email: string;
  };
};

export type PublicProduct = {
  id: string;
  categoryId: string;
  categoryName: string;
  sku: string | null;
  barcode: string | null;
  title: string;
  description: string | null;
  presentation: string | null;
  brand: string | null;
  price: number;
  wholesalePrice: number | null;
  stock: number;
  minStock: number;
  status: ProductStatus;
  isActive: boolean;
  images: PublicProductImage[];
  createdAt: Date;
  updatedAt: Date;
};

export type PaginatedProducts = {
  items: PublicProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type ProductWithRelations = Product & {
  category: { name: string };
  images: ProductImage[];
};

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  toPublicProduct(product: ProductWithRelations): PublicProduct {
    return {
      id: product.id,
      categoryId: product.categoryId,
      categoryName: product.category.name,
      sku: product.sku,
      barcode: product.barcode,
      title: product.title,
      description: product.description,
      presentation: product.presentation,
      brand: product.brand,
      price: decimalToNumber(product.price) ?? 0,
      wholesalePrice: decimalToNumber(product.wholesalePrice),
      stock: product.stock,
      minStock: product.minStock,
      status: product.status,
      isActive: product.isActive,
      images: product.images
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((image) => ({
          id: image.id,
          url: image.url,
          sortOrder: image.sortOrder,
          isPrimary: image.isPrimary,
        })),
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  toPublicMovement(
    movement: StockMovement & {
      createdBy: Pick<User, 'id' | 'name' | 'lastName' | 'email'>;
    },
  ): PublicStockMovement {
    return {
      id: movement.id,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      createdAt: movement.createdAt,
      createdBy: movement.createdBy,
    };
  }

  async findMany(query: ListProductsQueryDto): Promise<PaginatedProducts> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {}),
      AND: [
        ...(query.gap ? [gapWhere(query.gap)] : []),
        ...(search
          ? [
              {
                OR: [
                  { title: { contains: search } },
                  { sku: { contains: search } },
                  { barcode: { contains: search } },
                  { brand: { contains: search } },
                ],
              },
            ]
          : []),
      ],
    };

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
        },
        orderBy: { title: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      items: products.map((product) => this.toPublicProduct(product)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findGaps(): Promise<ProductGapsCounts> {
    const base = { isActive: true } as const;
    const counts = await Promise.all(
      PRODUCT_GAPS.map((gap) =>
        this.prisma.product.count({
          where: { ...base, ...gapWhere(gap) },
        }),
      ),
    );

    return Object.fromEntries(
      PRODUCT_GAPS.map((gap, index) => [gap, counts[index] ?? 0]),
    ) as ProductGapsCounts;
  }

  async findById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.toPublicProduct(product);
  }

  async findByBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) throw new NotFoundException('Producto no encontrado');

    const include = {
      category: true,
      images: { orderBy: { sortOrder: 'asc' as const } },
    };

    const byBarcode = await this.prisma.product.findUnique({
      where: { barcode: trimmed },
      include,
    });
    if (byBarcode) return this.toPublicProduct(byBarcode);

    const bySku = await this.prisma.product.findUnique({
      where: { sku: trimmed },
      include,
    });
    if (!bySku) throw new NotFoundException('Producto no encontrado');
    return this.toPublicProduct(bySku);
  }

  async create(dto: CreateProductDto): Promise<PublicProduct> {
    try {
      const product = await this.prisma.product.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          price: new Prisma.Decimal(dto.price),
          wholesalePrice:
            dto.wholesalePrice === undefined
              ? null
              : new Prisma.Decimal(dto.wholesalePrice),
          description: dto.description?.trim() || null,
          presentation: dto.presentation?.trim() || null,
          brand: dto.brand?.trim() || null,
          sku: dto.sku?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          stock: dto.stock ?? 0,
          minStock: dto.minStock ?? 0,
          status: dto.status ?? ProductStatus.AVAILABLE,
        },
        include: {
          category: true,
          images: true,
        },
      });
      return this.toPublicProduct(product);
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('SKU o código de barras ya en uso');
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<PublicProduct> {
    await this.ensureExists(id);

    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          title: dto.title?.trim(),
          price:
            dto.price === undefined ? undefined : new Prisma.Decimal(dto.price),
          wholesalePrice:
            dto.wholesalePrice === undefined
              ? undefined
              : dto.wholesalePrice === null
                ? null
                : new Prisma.Decimal(dto.wholesalePrice),
          description: dto.description,
          presentation: dto.presentation,
          brand: dto.brand,
          sku: dto.sku,
          barcode: dto.barcode,
          stock: dto.stock,
          minStock: dto.minStock,
          status: dto.status,
          isActive: dto.isActive,
        },
        include: {
          category: true,
          images: { orderBy: { sortOrder: 'asc' } },
        },
      });
      return this.toPublicProduct(product);
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('SKU o código de barras ya en uso');
      throw error;
    }
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.ensureExists(id);
    await this.prisma.product.delete({ where: { id } });
    return { message: 'Producto eliminado correctamente.' };
  }

  async bulkUpdate(
    dto: BulkUpdateProductsDto,
  ): Promise<{ updated: number }> {
    if (!dto.categoryId)
      throw new BadRequestException('Indicá una categoría');

    const ids = await this.ensureAllExist(dto.ids);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const result = await this.prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { categoryId: dto.categoryId },
    });

    return { updated: result.count };
  }

  async bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    const uniqueIds = await this.ensureAllExist(ids);
    const result = await this.prisma.product.deleteMany({
      where: { id: { in: uniqueIds } },
    });
    return { deleted: result.count };
  }

  async deleteAll(): Promise<{ deleted: number }> {
    const result = await this.prisma.product.deleteMany();
    return { deleted: result.count };
  }

  async bulkUpdatePrice(
    dto: BulkUpdatePriceDto,
  ): Promise<{ updated: number }> {
    const ids = await this.ensureAllExist(dto.ids);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
    });

    await this.prisma.$transaction(
      products.map((product) => {
        const price = scalePrice(
          decimalToNumber(product.price) ?? 0,
          dto.percent,
          dto.direction,
        );
        const wholesale =
          dto.applyToWholesale && product.wholesalePrice != null
            ? scalePrice(
                decimalToNumber(product.wholesalePrice) ?? 0,
                dto.percent,
                dto.direction,
              )
            : undefined;

        return this.prisma.product.update({
          where: { id: product.id },
          data: {
            price: new Prisma.Decimal(price.toFixed(2)),
            ...(wholesale !== undefined
              ? { wholesalePrice: new Prisma.Decimal(wholesale.toFixed(2)) }
              : {}),
          },
        });
      }),
    );

    return { updated: products.length };
  }

  async addImage(productId: string, url: string): Promise<PublicProduct> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { images: true },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const isPrimary = product.images.length === 0;
    const sortOrder = product.images.length;

    await this.prisma.productImage.create({
      data: { productId, url, sortOrder, isPrimary },
    });

    return this.findById(productId);
  }

  async removeImage(productId: string, imageId: string): Promise<PublicProduct> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    await this.prisma.productImage.delete({ where: { id: imageId } });

    if (image.isPrimary) {
      const next = await this.prisma.productImage.findFirst({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
      });
      if (next)
        await this.prisma.productImage.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
    }

    return this.findById(productId);
  }

  async setPrimaryImage(
    productId: string,
    imageId: string,
  ): Promise<PublicProduct> {
    const image = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!image) throw new NotFoundException('Imagen no encontrada');

    await this.prisma.$transaction([
      this.prisma.productImage.updateMany({
        where: { productId },
        data: { isPrimary: false },
      }),
      this.prisma.productImage.update({
        where: { id: imageId },
        data: { isPrimary: true },
      }),
    ]);

    return this.findById(productId);
  }

  private async ensureExists(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  private uniqueIds(ids: string[]): string[] {
    return [...new Set(ids)];
  }

  private async ensureAllExist(ids: string[]): Promise<string[]> {
    const uniqueIds = this.uniqueIds(ids);
    const found = await this.prisma.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (found.length !== uniqueIds.length)
      throw new NotFoundException('Producto no encontrado');
    return uniqueIds;
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
