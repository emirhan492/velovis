import {
  ConflictException,
  Injectable,
  ForbiddenException,
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
  // YENİ ÜRÜN EKLEME (GÜNCELLENDİ)
  // =================================================================
  async create(createProductDto: CreateProductDto) {
    // DTO'dan sizes ve fotoları ayırıyoruz
    const { otherPhotos, sizes, ...productData } = createProductDto;

    await this.validateCategory(createProductDto.categoryId);

    try {
      const product = await this.prisma.product.create({
        data: {
          ...productData,
          // YENİ KISIM: Bedenleri burada oluşturuyoruz
          sizes: {
            create: sizes.map((s) => ({
              size: s.size,
              stock: s.stock,
            })),
          },
        },
      });

      // Diğer fotoğrafları ekleme
      if (otherPhotos && otherPhotos.length > 0) {
        const photoData = otherPhotos.map((url, index) => ({
          productId: product.id,
          url: url.replace(/\\/g, '/'),
          isPrimary: false,
          order: index + 2,
          size: 0,
        }));

        await this.prisma.productPhoto.createMany({
          data: photoData,
        });
      }

      // Ana fotoğrafı ekleme
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
  // FIND ALL (LİSTELEME) (GÜNCELLENDİ)
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
        // Listeleme sayfasında bedenleri de görmek isteyebilirsin (Stok var mı yok mu diye)
        sizes: {
          orderBy: { size: 'asc' }, // S, M, L sırasına göre gelmeyebilir ama alfabetik gelir
        },
      },
    });
  }

  // =================================================================
  // FIND ONE (DETAY) (GÜNCELLENDİ)
  // =================================================================
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        sizes: {
          orderBy: { id: 'asc' }, // Eklenme sırasına göre getir
        },
        photos: {
          orderBy: {
            order: 'asc',
          },
        },
        comments: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
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
  // GÜNCELLEME (GÜNCELLENDİ)
  // =================================================================
  async update(id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(id);

    // Update DTO'sunda "sizes" alanı opsiyonel olarak gelebilir.
    // TypeScript uyarısı almamak için any kullanıyoruz veya DTO'yu tam tanımlamak lazım.
    // Burada mantık şudur: sizes dizisi geldiyse, eski stokları silip yenilerini yazarız.
    const { otherPhotos, sizes, ...productData } = updateProductDto as any;

    if (updateProductDto.categoryId) {
      await this.validateCategory(updateProductDto.categoryId);
    }

    try {
      // 1. Önce Ürün Bilgilerini Güncelle
      const product = await this.prisma.product.update({
        where: { id },
        data: productData,
      });

      // 2. Eğer Beden Güncellemesi Geldiyse
      if (sizes) {
        // Eski bedenleri sil
        await this.prisma.productSize.deleteMany({
          where: { productId: id },
        });

        // Yeni bedenleri ekle
        await this.prisma.productSize.createMany({
          data: sizes.map((s) => ({
            productId: id,
            size: s.size,
            stock: s.stock,
          })),
        });
      }

      // 3. Fotoğraf Güncellemesi
      if (otherPhotos) {
        await this.prisma.productPhoto.deleteMany({
          where: {
            productId: id,
            isPrimary: false,
          },
        });

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

      return this.findOne(id); // Güncel halini döndür
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
  // SİLME
  // =================================================================
  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.product.delete({
      where: { id },
    });
  }

  // ... (Yorum fonksiyonları aynen kalabilir)
  async addComment(
    userId: string,
    productId: string,
    data: { rating: number; content: string },
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    return await this.prisma.productComment.create({
      data: {
        content: data.content,
        rating: data.rating,
        productId: productId,
        userId: userId,
      },
    });
  }

  async deleteComment(user: any, commentId: string) {
    const comment = await this.prisma.productComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) throw new NotFoundException('Yorum bulunamadı.');

    const isAdmin = user.roles && user.roles.includes('ADMIN');
    const isOwner = comment.userId === user.id;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Bu işlemi yapmaya yetkiniz yok.');
    }

    return this.prisma.productComment.delete({
      where: { id: commentId },
    });
  }

  async updateComment(
    user: any,
    commentId: string,
    data: { content: string; rating: number },
  ) {
    const comment = await this.prisma.productComment.findUnique({
      where: { id: commentId },
    });

    if (!comment) throw new NotFoundException('Yorum bulunamadı.');

    const isAdmin = user.roles && user.roles.includes('ADMIN');
    const isOwner = comment.userId === user.id;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException('Bu işlemi yapmaya yetkiniz yok.');
    }

    const isEditedByAdmin = isAdmin && !isOwner;

    return this.prisma.productComment.update({
      where: { id: commentId },
      data: {
        content: data.content,
        rating: data.rating,
        editedByAdmin: isEditedByAdmin,
      },
    });
  }
}
