import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // POST (Oluşturma)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.PRODUCTS.CREATE)
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // GET (Listeleme ve Filtreleme) - Herkese Açık
  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  // GET (Detay) - Herkese Açık
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  // PATCH (Güncelleme)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.PRODUCTS.UPDATE)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  // DELETE (Silme)
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @CheckPermissions(PERMISSIONS.PRODUCTS.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }

  // YORUMLAR

  @UseGuards(JwtAuthGuard)
  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body() body: { rating: number; content: string },
    @Req() req: any,
  ) {
    // Kullanıcı ID'sini (req.user.id) servise gönderiyoruz
    return this.productsService.addComment(req.user.id, id, body);
  }

  // YORUM SİLME (Kullanıcı kendisininkini, Admin hepsini)
  @UseGuards(JwtAuthGuard)
  @Delete('comments/:commentId')
  async deleteComment(
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return this.productsService.deleteComment(req.user, commentId);
  }

  // YORUM DÜZENLEME (Kullanıcı kendisininkini, Admin hepsini)
  @UseGuards(JwtAuthGuard)
  @Patch('comments/:commentId')
  async updateComment(
    @Param('commentId') commentId: string,
    @Body() body: { content: string; rating: number },
    @Req() req: any,
  ) {
    return this.productsService.updateComment(req.user, commentId, body);
  }
}
