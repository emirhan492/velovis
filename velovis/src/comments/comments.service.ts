import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

// req.user objesinin tipini tanımla
type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  private async updateProductStats(
    productId: string,
    tx: PrismaTransactionClient,
  ) {

  }

  async create(createCommentDto: CreateCommentDto, userId: string) {

  }

  async findAll(productId?: string, rating?: number) {

  }

  async findOne(id: string) {

  }

  // =================================================================
  // YORUM GÜNCELLEME (UPDATE)
  // =================================================================
  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    user: AuthenticatedUser,
  ) {
    // Yorumu bul
    const comment = await this.prisma.productComment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException('Güncellenecek yorum bulunamadı.');
    }

    // YETKİLENDİRME: Bu yorumu yapan kişi, giriş yapan kişi mi?
    if (comment.userId !== user.id) {
      throw new ForbiddenException(
        'Bu yorumu güncelleme yetkiniz bulunmamaktadır (Sadece sahibi güncelleyebilir).',
      );
    }

    // Transaction başlat
    return this.prisma.$transaction(async (tx) => {
      const updatedComment = await tx.productComment.update({
        where: { id },
        data: updateCommentDto,
      });
      await this.updateProductStats(comment.productId, tx);
      return updatedComment;
    });
  }

  // =================================================================
  // YORUM SİLME (DELETE)
  // =================================================================
  async remove(id: string, user: AuthenticatedUser) {
    // Yorumu bul
    const comment = await this.prisma.productComment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException('Silinecek yorum bulunamadı.');
    }

    // YETKİLENDİRME: Servis Katmanı Kontrolü
    const canDeleteAny = user.permissions.has(PERMISSIONS.COMMENTS.DELETE_ANY);
    const canDeleteOwn = user.permissions.has(PERMISSIONS.COMMENTS.DELETE_OWN);

    if (canDeleteAny) {
      // Admin/Moderator. Sahiplik kontrolü yapma, devam et.
    } else if (canDeleteOwn) {
      // Normal Kullanıcı. Sahiplik kontrolü yap.
      if (comment.userId !== user.id) {
        throw new ForbiddenException(
          'Bu yorumu silme yetkiniz bulunmamaktadır (Sadece sahibi silebilir).',
        );
      }
    } else {
      throw new ForbiddenException('Yorum silme yetkiniz yok.');
    }

    // 3. Transaction başlat
    return this.prisma.$transaction(async (tx) => {
      await tx.productComment.delete({
        where: { id },
      });
      await this.updateProductStats(comment.productId, tx);
      return { message: 'Yorum başarıyla silindi.', deletedComment: comment };
    });
  }
}
