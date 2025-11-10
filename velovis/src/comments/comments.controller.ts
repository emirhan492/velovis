// src/comments/comments.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

// req.user tipini tanımlıyoruz
interface RequestWithUser extends Request {
  user: {
    id: string;
    permissions: Set<string>;
    // ... (JwtStrategy'den gelen diğer alanlar)
  };
}

@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.COMMENTS.CREATE)
  @Post()
  create(
    @Body() createCommentDto: CreateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.commentsService.create(createCommentDto, userId);
  }

  // Yorumları okumak public
  @Get()
  findAll(
    @Query('product_id') productId?: string,
    @Query('puan', new ParseIntPipe({ optional: true })) rating?: number,
  ) {
    return this.commentsService.findAll(productId, rating);
  }

  // Yorum detayı public
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentsService.findOne(id);
  }

  // Sadece 'update:own' (kendi) yetkisi olan
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.COMMENTS.UPDATE_OWN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateCommentDto: UpdateCommentDto,
    @Req() req: RequestWithUser,
  ) {
    const user = req.user;
    // Servis katmanı, bu 'user'ın ID'sini yorumun 'userId'si ile karşılaştıracak
    return this.commentsService.update(id, updateCommentDto, user);
  }

  // 'delete:own' (kendi) VEYA 'delete:any' (herhangi) yetkisi olan
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(
    PERMISSIONS.COMMENTS.DELETE_OWN,
    PERMISSIONS.COMMENTS.DELETE_ANY,
  )
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    const user = req.user;
    // Servis katmanı, 'delete:any' yetkisi varsa sahiplik kontrolü yapmayacak
    return this.commentsService.remove(id, user);
  }
}
