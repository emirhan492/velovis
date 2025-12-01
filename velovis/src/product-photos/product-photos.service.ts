import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateProductPhotoDto } from './dto/create-product-photo.dto';
import { UpdateProductPhotoDto } from './dto/update-product-photo.dto';

@Injectable()
export class ProductPhotosService {
  constructor(private prisma: PrismaService) {}

  // =================================================================
  // FOTOĞRAF EKLEME (CREATE)
  // =================================================================
  async create(createProductPhotoDto: CreateProductPhotoDto) {
    const { productId, url, size, isPrimary } = createProductPhotoDto;

    // Ürün var mı?
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('İlgili ürün bulunamadı.');
    }

    // Mevcut fotoğrafların sayısını bul
    const currentPhotoCount = await this.prisma.productPhoto.count({
      where: { productId },
    });

    // Yeni fotoğrafın sırası
    const newOrder = currentPhotoCount + 1;

    // Bu fotoğraf birincil mi olacak?
    const shouldBePrimary = currentPhotoCount === 0 || isPrimary === true;

    // Prisma $transaction: Birden fazla işlemi atomik olarak yap
    return this.prisma.$transaction(async (tx) => {
      // Eğer bu fotoğraf birincil olacaksa, diğer tüm fotoğrafları "birincil değil" yap
      if (shouldBePrimary) {
        await tx.productPhoto.updateMany({
          where: { productId: productId },
          data: { isPrimary: false },
        });
      }

      // Yeni fotoğrafı oluştur
      const newPhoto = await tx.productPhoto.create({
        data: {
          productId: productId,
          url: url,
          size: size,
          isPrimary: shouldBePrimary,
          order: newOrder,
        },
      });

      // Ana Product tablosundaki 'primary_photo_url' alanını güncelle
      if (shouldBePrimary) {
        await tx.product.update({
          where: { id: productId },
          data: { primaryPhotoUrl: newPhoto.url },
        });
      }

      return newPhoto;
    });
  }

  // =================================================================
  // FOTOĞRAF GÜNCELLEME (UPDATE)
  // =================================================================
  async update(id: string, updateProductPhotoDto: UpdateProductPhotoDto) {
    const { isPrimary, order: newOrder } = updateProductPhotoDto;

    // Fotoğraf var mı?
    const photoToUpdate = await this.prisma.productPhoto.findUnique({
      where: { id },
    });

    if (!photoToUpdate) {
      throw new NotFoundException('Güncellenecek fotoğraf bulunamadı.');
    }

    const { productId, order: currentOrder } = photoToUpdate;

    // Prisma Transaction başlat
    return this.prisma.$transaction(async (tx) => {
      if (isPrimary === true) {

        // Bu ürüne ait diğer tüm fotoğrafları "birincil değil" yap
        await tx.productPhoto.updateMany({
          where: {
            productId: productId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });

        // Ana Product tablosunu yeni URL ile güncelle
        await tx.product.update({
          where: { id: productId },
          data: { primaryPhotoUrl: photoToUpdate.url },
        });
      }
      if (newOrder && newOrder !== currentOrder) {

        const photoCount = await tx.productPhoto.count({
          where: { productId },
        });

        // Yeni sıra, toplam fotoğraf sayısından büyük olamaz
        if (newOrder > photoCount) {
            throw new NotFoundException('Belirtilen sıra numarası, toplam fotoğraf sayısından büyük olamaz.');
        }

        if (newOrder > currentOrder) {
          await tx.productPhoto.updateMany({
            where: {
              productId: productId,
              order: {
                gt: currentOrder,
                lte: newOrder,
              },
            },
            data: {
              order: {
                decrement: 1,
              },
            },
          });
        } else if (newOrder < currentOrder) {
          await tx.productPhoto.updateMany({
            where: {
              productId: productId,
              order: {
                gte: newOrder,
                lt: currentOrder,
              },
            },
            data: {
              order: {
                increment: 1,
              },
            },
          });
        }
      }

      // === Fotoğrafı Güncelle ===
      return tx.productPhoto.update({
        where: { id },
        data: updateProductPhotoDto,
      });
    });
  }

  // =================================================================
  // FOTOĞRAF SİLME (DELETE)
  // =================================================================
  async remove(id: string) {
    // Fotoğrafı bul
    const photo = await this.prisma.productPhoto.findUnique({
      where: { id },
    });
    if (!photo) {
      throw new NotFoundException('Fotoğraf bulunamadı.');
    }

    const { productId, order, isPrimary } = photo;

    return this.prisma.$transaction(async (tx) => {
      // Fotoğrafı sil
      await tx.productPhoto.delete({ where: { id } });

      // Silinen fotoğraftan sonraki tüm fotoğrafların sırasını 1 azalt (boşluk olmasın)
      await tx.productPhoto.updateMany({
        where: {
          productId: productId,
          order: { gt: order },
        },
        data: {
          order: {
            decrement: 1,
          },
        },
      });

      if (isPrimary) {
        const nextPrimaryPhoto = await tx.productPhoto.findFirst({
          where: { productId: productId },
          orderBy: { order: 'asc' },
        });

        if (nextPrimaryPhoto) {
          await tx.productPhoto.update({
            where: { id: nextPrimaryPhoto.id },
            data: { isPrimary: true },
          });
          // Product tablosunu güncelle
          await tx.product.update({
            where: { id: productId },
            data: { primaryPhotoUrl: nextPrimaryPhoto.url },
          });
        } else {
          // Başka fotoğraf kalmadı, Product tablosunu null yap
          await tx.product.update({
            where: { id: productId },
            data: { primaryPhotoUrl: null },
          });
        }
      }

      return photo; // Silinen fotoğrafı döndür
    });
  }
}
