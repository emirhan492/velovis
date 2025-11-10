import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCartItemDto } from './dto/create-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

// Hangi alanları döndüreceğimizi tek bir yerde tanımlayalım
const includeProductDetails = {
  product: {
    select: {
      id: true,
      name: true,
      price: true,
      primaryPhotoUrl: true,
      stockQuantity: true,
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
    const { productId, quantity } = createCartItemDto;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Ürün bulunamadı.');
    }

    const existingCartItem = await this.prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId: userId,
          productId: productId,
        },
      },
    });

    if (existingCartItem) {
      // 3. ÜRÜN ZATEN SEPETTE VARSA -> MİKTARI GÜNCELLE
      const newQuantity = existingCartItem.quantity + quantity;

      if (newQuantity > product.stockQuantity) {
        // (Akıllı hata mesajları...)
        const availableToAdd = product.stockQuantity - existingCartItem.quantity;
        const message =
          availableToAdd > 0
            ? `Stokta yeterli ürün yok. Sepetinize en fazla ${availableToAdd} adet daha ekleyebilirsiniz.`
            : `Stokta yeterli ürün yok. Bu ürünün tamamı (${product.stockQuantity} adet) zaten sepetinizde.`;
        throw new BadRequestException(message);
      }

      return this.prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: newQuantity },
        include: includeProductDetails, // <-- ÇÖZÜM 1: Buraya ekle
      });
    } else {
      // 4. ÜRÜN SEPETTE YOKSA -> YENİ KAYIT OLUŞTUR
      if (quantity > product.stockQuantity) {
        throw new BadRequestException(
          `Stokta yeterli ürün yok. Bu üründen en fazla ${product.stockQuantity} adet ekleyebilirsiniz.`,
        );
      }

      return this.prisma.cartItem.create({
        data: {
          userId: userId,
          productId: productId,
          quantity: quantity,
        },
        include: includeProductDetails, // <-- ÇÖZÜM 2: Buraya da ekle
      });
    }
  }

  // =================================================================
  // SEPETİ LİSTELEME
  // =================================================================
  async findAll(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId: userId },
      include: includeProductDetails, // (Burada zaten vardı)
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

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!cartItem) {
      throw new NotFoundException('Sepet kalemi bulunamadı.');
    }

    if (cartItem.userId !== userId) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok.');
    }

    const product = await this.prisma.product.findUnique({
      where: { id: cartItem.productId },
    });

    if (!product) {
      throw new NotFoundException('Sepetinizdeki bu ürün artık mevcut değil.');
    }
    if (newQuantity > product.stockQuantity) {
      throw new BadRequestException(
        `Stokta yeterli ürün yok. Kalan stok: ${product.stockQuantity}`,
      );
    }

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity: newQuantity },
      include: includeProductDetails, // <-- ÇÖZUM 3: VE ASIL HATA BURADAYDI
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
