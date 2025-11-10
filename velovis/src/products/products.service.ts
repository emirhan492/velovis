import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { Prisma } from '@prisma/client';

enum SortDirection {
  asc = 'asc',
  desc = 'desc',
}

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  private async validateCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException('Belirtilen kategori bulunamadı.');
    }
  }

  async create(createProductDto: CreateProductDto) {
    await this.validateCategory(createProductDto.categoryId);

    try {
      return await this.prisma.product.create({
        data: createProductDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu slug zaten kullanılıyor.');
      }
      throw error;
    }
  }

  // =================================================================
  // ÜRÜNLERİ LİSTELEME (FIND ALL) - GÜNCELLENDİ
  // =================================================================
  async findAll(query: QueryProductDto) {
    const { category_id, min_price, max_price, min_rating, sort } = query;

    const where: Prisma.ProductWhereInput = {};

    if (category_id) {
      where.categoryId = category_id;
    }

    // --- HATA ÇÖZÜMÜ BURADA ---
    // 'where.price' objesini SADECE ihtiyaç varsa oluştur ve 'spread' KULLANMA
    if (min_price !== undefined || max_price !== undefined) {
      where.price = {}; // Boş bir obje olarak başlat
      if (min_price !== undefined) {
        where.price.gte = min_price; // 'gte' (büyük veya eşit)
      }
      if (max_price !== undefined) {
        where.price.lte = max_price; // 'lte' (küçük veya eşit)
      }
    }
    // --- ÇÖZÜM BİTTİ ---

    if (min_rating !== undefined) {
      where.averageRating = { gte: min_rating };
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};

    if (sort) {
      const [field, direction] = sort.split(':');

      if (field === 'price') {
        orderBy.price = direction as SortDirection;
      } else if (field === 'rating') {
        orderBy.averageRating = direction as SortDirection;
      } else if (field === 'createdAt') {
        orderBy.createdAt = direction as SortDirection;
      }
    } else {
      orderBy.createdAt = 'desc';
    }

    return this.prisma.product.findMany({
      where: where,
      orderBy: orderBy,
      include: {
        category: true,
      },
    });
  }

  // =================================================================
  // TEK ÜRÜN GETİRME (FIND ONE)
  // =================================================================
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }
    return product;
  }

  // =================================================================
  // ÜRÜN GÜNCELLEME (UPDATE)
  // =================================================================
  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    if (updateProductDto.categoryId) {
      await this.validateCategory(updateProductDto.categoryId);
    }

    try {
      return await this.prisma.product.update({
        where: { id },
        data: updateProductDto,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Bu slug zaten kullanılıyor.');
      }
      throw error;
    }
  }

  // =================================================================
  // ÜRÜN SİLME (DELETE)
  // =================================================================
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
