import {
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
import type { CreateProductDto } from './dto/create-product.dto';
import type { ListProductsQueryDto } from './dto/list-products.query.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import { decimalToNumber } from './utils/inventory.utils';

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
  discountPrice: number | null;
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
      discountPrice: decimalToNumber(product.discountPrice),
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
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
              { barcode: { contains: search, mode: 'insensitive' } },
              { brand: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
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

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: {
        category: true,
        images: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.toPublicProduct(product);
  }

  async create(dto: CreateProductDto): Promise<PublicProduct> {
    try {
      const product = await this.prisma.product.create({
        data: {
          categoryId: dto.categoryId,
          title: dto.title.trim(),
          price: new Prisma.Decimal(dto.price),
          discountPrice:
            dto.discountPrice === undefined
              ? null
              : new Prisma.Decimal(dto.discountPrice),
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
          discountPrice:
            dto.discountPrice === undefined
              ? undefined
              : dto.discountPrice === null
                ? null
                : new Prisma.Decimal(dto.discountPrice),
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

  async softDelete(id: string): Promise<{ message: string }> {
    await this.ensureExists(id);
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'Producto desactivado correctamente.' };
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

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
