import { Injectable } from '@nestjs/common';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import { slugify } from './utils/inventory.utils';

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  productCount?: number;
};

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  toPublicCategory(
    category: { id: string; name: string; slug: string; createdAt: Date; updatedAt: Date },
    productCount?: number,
  ): PublicCategory {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
      ...(productCount !== undefined ? { productCount } : {}),
    };
  }

  async findMany(): Promise<PublicCategory[]> {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });

    return categories.map((category) =>
      this.toPublicCategory(category, category._count.products),
    );
  }

  async findOrCreateByName(name: string) {
    const trimmed = name.trim();
    const baseSlug = slugify(trimmed);
    const existing = await this.prisma.category.findFirst({
      where: { OR: [{ name: trimmed }, { slug: baseSlug }] },
    });
    if (existing) return existing;

    let slug = baseSlug;
    let suffix = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    try {
      return await this.prisma.category.create({
        data: { name: trimmed, slug },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        const fallback = await this.prisma.category.findFirst({
          where: { name: trimmed },
        });
        if (fallback) return fallback;
      }
      throw error;
    }
  }

  async create(dto: CreateCategoryDto): Promise<PublicCategory> {
    const name = dto.name.trim();
    const baseSlug = slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    try {
      const category = await this.prisma.category.create({
        data: { name, slug },
      });
      return this.toPublicCategory(category, 0);
    } catch (error) {
      if (this.isUniqueConstraintError(error))
        throw new ConflictException('Ya existe una categoría con ese nombre');
      throw error;
    }
  }

  isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
