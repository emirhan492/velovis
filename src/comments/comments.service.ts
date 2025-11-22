// src/comments/comments.service.ts

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Prisma, PrismaClient } from '@prisma/client';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants'; // Yetki listesini import et

// req.user objesinin tipini tanımla
type AuthenticatedUser = {
  id: string;
  permissions: Set<string>;
};

// ... (PrismaTransactionClient tipi) ...
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // ... (updateProductStats, create, findAll, findOne fonksiyonları aynı) ...
  private async updateProductStats(
    productId: string,
    tx: PrismaTransactionClient,
  ) {
    // ... (içerik aynı)
  }

  async create(createCommentDto: CreateCommentDto, userId: string) {
    // ... (içerik aynı)
  }

  async findAll(productId?: string, rating?: number) {
    // ... (içerik aynı)
  }

  async findOne(id: string) {
    // ... (içerik aynı)
  }

  // =================================================================
  // YORUM GÜNCELLEME (UPDATE) - GÜNCELLENDİ
  // =================================================================
  async update(
    id: string,
    updateCommentDto: UpdateCommentDto,
    user: AuthenticatedUser, // Sadece 'userId' değil, tüm 'user' objesi
  ) {
    // 1. Yorumu bul
    const comment = await this.prisma.productComment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException('Güncellenecek yorum bulunamadı.');
    }

    // 2. YETKİLENDİRME: Bu yorumu yapan kişi, giriş yapan kişi mi?
    // Not: Bu endpoint'e sadece 'UPDATE_OWN' yetkisi olanlar gelebiliyor
    // (Controller'da öyle tanımladık). Bu yüzden ekstra bir yetki kontrolüne
    // gerek yok, SADECE SAHİPLİK kontrolü yapacağız.
    if (comment.userId !== user.id) {
      throw new ForbiddenException(
        'Bu yorumu güncelleme yetkiniz bulunmamaktadır (Sadece sahibi güncelleyebilir).',
      );
    }

    // 3. Transaction başlat
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
  // YORUM SİLME (DELETE) - GÜNCELLENDİ
  // =================================================================
  async remove(id: string, user: AuthenticatedUser) {
    // 1. Yorumu bul
    const comment = await this.prisma.productComment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException('Silinecek yorum bulunamadı.');
    }

    // 2. YETKİLENDİRME: Servis Katmanı Kontrolü
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
      // Bu imkansız olmalı (Guard engeller), ama ekstra güvenlik.
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
