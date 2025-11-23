import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Body,
  Patch,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  // 1. TÜM KULLANICILARI LİSTELE
  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // 2. TEK KULLANICI DETAYI
  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    // Eğer service'inde findOne yoksa, findAll içinden filtreleyebilir 
    // veya service'e findOne ekleyebilirsin.
    // Şimdilik findAll kullanıldığı için burası opsiyonel.
    return { message: 'Bu endpoint henüz aktif değil, listeden bakınız.' };
  }

  // =================================================================
  // KULLANICI ROL GÜNCELLEME (Frontend ile uyumlu)
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.ASSIGN_ROLE)
  @Patch(':id/roles') // Frontend api.patch('/users/:id/roles') atıyor
  async updateRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { roles: string[] }, // Frontend { roles: [...] } gönderiyor
  ) {
    // UsersService içindeki mantığı çağırıyoruz
    return this.usersService.updateRoles(id, body.roles);
  }

  // =================================================================
  // KULLANICI SİLME
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    // DİKKAT: req.user.id yerine parametreden gelen 'id'yi siliyoruz.
    return this.usersService.remove(id);
  }
}