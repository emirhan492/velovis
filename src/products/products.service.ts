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

  // =================================================================
  // CREATE (YENİ ÜRÜN EKLEME) - GÜNCELLENDİ
  // =================================================================
  async create(createProductDto: CreateProductDto) {
    // 1. DTO'dan 'otherPhotos'u ayıklıyoruz.
    // 'productData', Prisma'nın Product tablosuna kaydedeceği saf veridir.
    const { otherPhotos, ...productData } = createProductDto;

    await this.validateCategory(createProductDto.categoryId);

    try {
      // 2. Ürünü oluşturuyoruz (otherPhotos olmadan)
      const product = await this.prisma.product.create({
        data: productData,
      });

      // 3. Yan Fotoğrafları Ekliyoruz (ProductPhoto tablosuna)
      if (otherPhotos && otherPhotos.length > 0) {
        const photoData = otherPhotos.map((url, index) => ({
          productId: product.id,
          url: url.replace(/\\/g, '/'), // Windows ters slash düzeltmesi
          isPrimary: false,
          order: index + 2, // 1. sıra ana fotoda olduğu için 2'den başlatıyoruz
          size: 0,
        }));

        await this.prisma.productPhoto.createMany({
          data: photoData,
        });
      }

      // 4. Ana Fotoğrafı da ProductPhoto tablosuna ekleyelim (Tutarlılık için)
      if (productData.primaryPhotoUrl) {
        await this.prisma.productPhoto.create({
          data: {
            productId: product.id,
            url: productData.primaryPhotoUrl.replace(/\\/g, '/'),
            isPrimary: true,
            order: 1,
            size: 0,
          },
        });
      }

      return product;
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
  // FIND ALL (LİSTELEME)
  // =================================================================
  async findAll(query: QueryProductDto) {
    const { category_id, min_price, max_price, min_rating, sort } = query;

    const where: Prisma.ProductWhereInput = {};

    if (category_id) {
      where.categoryId = category_id;
    }

    if (min_price !== undefined || max_price !== undefined) {
      where.price = {};
      if (min_price !== undefined) {
        where.price.gte = min_price;
      }
      if (max_price !== undefined) {
        where.price.lte = max_price;
      }
    }

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
  // FIND ONE (DETAY)
  // =================================================================
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        photos: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }
    return product;
  }

  // =================================================================
  // UPDATE (GÜNCELLEME) - GÜNCELLENDİ
  // =================================================================
  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id); // Ürün var mı kontrolü

    // 1. 'otherPhotos'u ayıkla
    const { otherPhotos, ...productData } = updateProductDto;

    if (updateProductDto.categoryId) {
      await this.validateCategory(updateProductDto.categoryId);
    }

    try {
      // 2. Ürün bilgilerini güncelle
      const product = await this.prisma.product.update({
        where: { id },
        data: productData,
      });

      // 3. Fotoğrafları Güncelle (Eğer yeni liste geldiyse)
      if (otherPhotos) {
        // A. Eski yan fotoğrafları sil (Ana fotoğrafı koru)
        await this.prisma.productPhoto.deleteMany({
          where: {
            productId: id,
            isPrimary: false,
          },
        });

        // B. Yenileri ekle
        if (otherPhotos.length > 0) {
          const photoData = otherPhotos.map((url, index) => ({
            productId: id,
            url: url.replace(/\\/g, '/'),
            isPrimary: false,
            order: index + 2,
            size: 0,
          }));

          await this.prisma.productPhoto.createMany({
            data: photoData,
          });
        }
      }

      // (Opsiyonel) Ana fotoğraf değiştiyse ProductPhoto'daki ilgili kaydı da güncellemek gerekebilir
      // Ancak şimdilik 'primaryPhotoUrl' alanı Product tablosunda güncellendiği için ana resim doğru görünür.

      return product;
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
  // DELETE (SİLME)
  // =================================================================
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }
}
