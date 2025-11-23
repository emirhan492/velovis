import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';

// Bu controller'daki tüm endpoint'ler Admin yetkisi gerektirecek
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('roles') // Endpoint: /api/roles
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // =================================================================
  // YARDIMCI: Sistemdeki tüm sabit (hardcoded) yetkileri listele
  // =================================================================
  @CheckPermissions(PERMISSIONS.ROLES.READ)
  @Get('permissions')
  getAllPermissions() {
    return this.rolesService.getAllPermissions();
  }

  // =================================================================
  // YENİ ROL OLUŞTURMA (Örn: "MODERATOR")
  // =================================================================
  @CheckPermissions(PERMISSIONS.ROLES.CREATE)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.rolesService.create(createRoleDto);
  }

  // =================================================================
  // TÜM ROLLERİ LİSTELE
  // =================================================================
  @CheckPermissions(PERMISSIONS.ROLES.READ)
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  // =================================================================
  // BİR ROLE YETKİ ATAMA/GÜNCELLEME
  // =================================================================
  @CheckPermissions(PERMISSIONS.ROLES.UPDATE)
  @Post(':id/permissions') // /api/roles/uuid-of-admin/permissions
  @HttpCode(HttpStatus.OK)
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignPermissionsDto: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, assignPermissionsDto);
  }

  // =================================================================
  // BİR ROLÜ SİLME
  // =================================================================
  @CheckPermissions(PERMISSIONS.ROLES.DELETE)
  @Delete(':id') // /api/roles/uuid-of-moderator
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  // =================================================================
  // YETKİ GÜNCELLEME
  // =================================================================
  
  @CheckPermissions(PERMISSIONS.ROLES.UPDATE)
  @Patch(':id/permissions')
  async updatePermissions(
    @Param('id') id: string,
    @Body() body: { permissions: string[] }, // Frontend'den gelen { permissions: [...] } verisi
  ) {
    return this.rolesService.updatePermissions(id, body.permissions);
  }
  // 👆 ------------------------------------------------- 👆
}
