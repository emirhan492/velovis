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
  constructor(private readonly usersService: UsersService) {}

  // TÜM KULLANICILARI LİSTELE
  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  // TEK KULLANICI DETAYI
  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return { message: 'Bu endpoint henüz aktif değil, listeden bakınız.' };
  }

  // =================================================================
  // KULLANICI ROL GÜNCELLEME
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.ASSIGN_ROLE)
  @Patch(':id/roles')
  async updateRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { roles: string[] },
  ) {
    return this.usersService.updateRoles(id, body.roles);
  }

  // =================================================================
  // KULLANICI SİLME
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.DELETE)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
