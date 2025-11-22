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

    // 1. Ürün var mı?
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('İlgili ürün bulunamadı.');
    }

    // 2. Mevcut fotoğrafların sayısını bul (yeni sırayı belirlemek için)
    const currentPhotoCount = await this.prisma.productPhoto.count({
      where: { productId },
    });

    // 3. Yeni fotoğrafın sırası
    const newOrder = currentPhotoCount + 1;

    // 4. Bu fotoğraf birincil mi olacak?
    // Eğer bu ilk fotoğraftsa (count=0) VEYA DTO'da isPrimary=true geldiyse,
    // bu fotoğraf birincil olmalı.
    const shouldBePrimary = currentPhotoCount === 0 || isPrimary === true;

    // Prisma $transaction: Birden fazla işlemi atomik olarak yap
    // Ya hepsi başarılı olur, ya da hiçbiri olmaz.
    return this.prisma.$transaction(async (tx) => {
      // 5. Eğer bu fotoğraf birincil olacaksa, diğer tüm fotoğrafları "birincil değil" yap
      if (shouldBePrimary) {
        await tx.productPhoto.updateMany({
          where: { productId: productId },
          data: { isPrimary: false },
        });
      }

      // 6. Yeni fotoğrafı oluştur
      const newPhoto = await tx.productPhoto.create({
        data: {
          productId: productId,
          url: url,
          size: size,
          isPrimary: shouldBePrimary,
          order: newOrder,
        },
      });

      // 7. Ana Product tablosundaki 'primary_photo_url' alanını güncelle
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

    // 1. Fotoğraf var mı?
    const photoToUpdate = await this.prisma.productPhoto.findUnique({
      where: { id },
    });

    if (!photoToUpdate) {
      throw new NotFoundException('Güncellenecek fotoğraf bulunamadı.');
    }

    const { productId, order: currentOrder } = photoToUpdate;

    // Prisma Transaction başlat
    return this.prisma.$transaction(async (tx) => {
      // === GÖREV 1: isPrimary GÜNCELLENİYOR MU? ===
      if (isPrimary === true) {
        // Evet, bu fotoğraf birincil yapılıyor.

        // 1. Bu ürüne ait diğer tüm fotoğrafları "birincil değil" yap
        await tx.productPhoto.updateMany({
          where: {
            productId: productId,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });

        // 2. Ana Product tablosunu yeni URL ile güncelle
        await tx.product.update({
          where: { id: productId },
          data: { primaryPhotoUrl: photoToUpdate.url },
        });
      }
      // === GÖREV 2: order (Sıra) GÜNCELLENİYOR MU? ===
      if (newOrder && newOrder !== currentOrder) {
        // Evet, sıra değişiyor.
        // Üründeki toplam fotoğraf sayısını al (sınır kontrolü için)
        const photoCount = await tx.productPhoto.count({
          where: { productId },
        });

        // Yeni sıra, toplam fotoğraf sayısından büyük olamaz
        if (newOrder > photoCount) {
            throw new NotFoundException('Belirtilen sıra numarası, toplam fotoğraf sayısından büyük olamaz.');
        }

        if (newOrder > currentOrder) {
          // Fotoğraf listede AŞAĞI kaydırılıyor (örn: 2 -> 5)
          // Aradaki fotoğrafların (3, 4, 5) sırası 1 azaltılmalı (-> 2, 3, 4)
          await tx.productPhoto.updateMany({
            where: {
              productId: productId,
              order: {
                gt: currentOrder, // Eskisinden büyük
                lte: newOrder, // Yenisine eşit veya küçük
              },
            },
            data: {
              order: {
                decrement: 1,
              },
            },
          });
        } else if (newOrder < currentOrder) {
          // Fotoğraf listede YUKARI kaydırılıyor (örn: 5 -> 2)
          // Aradaki fotoğrafların (2, 3, 4) sırası 1 artırılmalı (-> 3, 4, 5)
          await tx.productPhoto.updateMany({
            where: {
              productId: productId,
              order: {
                gte: newOrder,   // Yenisine eşit veya büyük
                lt: currentOrder, // Eskisinden küçük
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

      // === FİNAL: Fotoğrafı Güncelle ===
      // Hem isPrimary hem de order (veya sadece biri) güncellenmiş DTO ile
      // ana fotoğrafımızı güncelliyoruz.
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
    // 1. Fotoğrafı bul
    const photo = await this.prisma.productPhoto.findUnique({
      where: { id },
    });
    if (!photo) {
      throw new NotFoundException('Fotoğraf bulunamadı.');
    }

    const { productId, order, isPrimary } = photo;

    return this.prisma.$transaction(async (tx) => {
      // 2. Fotoğrafı sil
      await tx.productPhoto.delete({ where: { id } });

      // 3. Silinen fotoğraftan sonraki tüm fotoğrafların sırasını 1 azalt (boşluk olmasın)
      await tx.productPhoto.updateMany({
        where: {
          productId: productId,
          order: { gt: order }, // sırası, silineninkinden büyük olanlar
        },
        data: {
          order: {
            decrement: 1, // sırayı 1 azalt
          },
        },
      });

      // 4. Silinen fotoğraf BİRİNCİL fotoğraf mıydı?
      if (isPrimary) {
        // Evet, öyleyse yeni bir birincil fotoğraf seçmemiz gerek
        const nextPrimaryPhoto = await tx.productPhoto.findFirst({
          where: { productId: productId },
          orderBy: { order: 'asc' }, // Sıradaki ilk fotoğraf (örn: order=1)
        });

        if (nextPrimaryPhoto) {
          // 4a. Yeni birincil fotoğraf bulundu, onu işaretle
          await tx.productPhoto.update({
            where: { id: nextPrimaryPhoto.id },
            data: { isPrimary: true },
          });
          // ve Product tablosunu güncelle
          await tx.product.update({
            where: { id: productId },
            data: { primaryPhotoUrl: nextPrimaryPhoto.url },
          });
        } else {
          // 4b. Başka fotoğraf kalmadı, Product tablosunu null yap
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
