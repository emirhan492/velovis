import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Ürün detaylarını çekerken artık toplam stoğu değil, genel bilgileri alıyoruz.
const includeProductDetails = {
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      primaryPhotoUrl: true,
      // stockQuantity: true, // <-- ARTIK BU YOK, KALDIRDIK
    },
  },
};

@Injectable()
export class CartItemsService {
  constructor(private prisma: PrismaService) {}

  // =================================================================
  // SEPETE ÜRÜN EKLEME (veya MİKTAR GÜNCELLEME)
  // =================================================================
  async addOrUpdateItem(userId: string, createCartItemDto: CreateCartItemDto) {
    const { productId, quantity, size } = createCartItemDto;

    // 1. Önce Ürün Var mı?
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    if (!size) {
      throw new BadRequestException('Beden seçimi zorunludur.');
    }

    // 2. Seçilen Bedenin Stoğunu Kontrol Et (ProductSize Tablosundan)
    const productSize = await this.prisma.productSize.findUnique({
      where: {
        productId_size: {
          productId: productId,
          size: size,
        },
      },
    });

    if (!productSize) {
      throw new BadRequestException('Bu ürün için seçilen beden bulunamadı.');
    }

    // 3. Sepette Bu Ürün + Bu Beden Var mı?
    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId_size: {
          userId: userId,
          productId: productId,
          size: size,
        },
      },
    });

    if (existingCartItem) {
      // --- GÜNCELLEME SENARYOSU ---
      const newQuantity = existingCartItem.quantity + quantity;

      // Stok Kontrolü (Beden Stoğuna Göre)
      if (newQuantity > productSize.stock) {
        const availableToAdd = Math.max(
          0,
          productSize.stock - existingCartItem.quantity,
        );
        const message =
          availableToAdd > 0
            ? `Stok sınırı! Bu bedenden en fazla ${availableToAdd} adet daha ekleyebilirsiniz.`
            : `Stok sınırı! Bu bedenden (${size}) zaten maksimum adeti sepetinizde.`;
        throw new BadRequestException(message);
      }

      return this.prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
        include: includeProductDetails,
      });
    } else {
      // --- YENİ EKLEME SENARYOSU ---
      if (quantity > productSize.stock) {
        throw new BadRequestException(
          `Stok yetersiz. Bu bedenden (${size}) sadece ${productSize.stock} adet kaldı.`,
        );
      }

      return this.prisma.cartItem.create({
        data: {
          userId: userId,
          productId: productId,
          quantity: quantity,
          size: size,
        },
        include: includeProductDetails,
      });
    }
  }

  // =================================================================
  // SEPETİ LİSTELEME
  // =================================================================
  async findAll(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId: userId },
      include: includeProductDetails,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  // =================================================================
  // SEPETTEKİ ÜRÜN MİKTARINI GÜNCELLEME (PATCH)
  // =================================================================
  async updateQuantity(
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
    userId: string,
  ) {
    const { quantity: newQuantity } = updateCartItemDto;

    // 1. Sepet Kalemini Bul
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!cartItem) {
      throw new NotFoundException('Sepet kalemi bulunamadı.');
    }

    if (cartItem.userId !== userId) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }

    // 2. O anki Bedenin Stoğunu Kontrol Et
    // Not: cartItem.size null olabilir diye kontrol ekliyoruz ama normalde olmamalı
    if (!cartItem.size) {
      // Eski veri kalıntısı varsa diye güvenlik
      return this.prisma.cartItem.update({
        where: { id: cartItemId },
        data: { quantity: newQuantity },
        include: includeProductDetails,
      });
    }

    const productSize = await this.prisma.productSize.findUnique({
      where: {
        productId_size: {
          productId: cartItem.productId,
          size: cartItem.size,
        },
      },
    });

    // Eğer beden veritabanından silindiyse hata verelim
    if (!productSize) {
      throw new NotFoundException('Bu ürünün bedeni artık stoklarda yok.');
    }

    // 3. Stok Kontrolü
    if (newQuantity > productSize.stock) {
      throw new BadRequestException(
        `Stok yetersiz. Bu bedenden (${cartItem.size}) kalan stok: ${productSize.stock}`,
      );
    }

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: newQuantity },
      include: includeProductDetails,
    });
  }

  // =================================================================
  // SEPETTEN BİR ÜRÜNÜ SİLME
  // =================================================================
  async remove(cartItemId: string, userId: string) {
    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });
    if (!cartItem) {
      throw new NotFoundException('Sepet kalemi bulunamadı.');
    }
    if (cartItem.userId !== userId) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }
    return this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });
  }

  // =================================================================
  // TÜM SEPETİ TEMİZLEME
  // =================================================================
  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({
      where: {
        userId: userId,
      },
    });
  }
}
