import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Post, // Eklendi
  Body, // Eklendi
  HttpCode, // Eklendi
  HttpStatus, // Eklendi
  Delete,
  Req,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from 'src/authorization/guards/permissions.guard';
import { CheckPermissions } from 'src/authorization/decorators/check-permissions.decorator';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { RolesService } from 'src/roles/roles.service'; // Eklendi: RolesService'e ihtiyacımız var
import { AssignRolesDto } from 'src/roles/dto/assign-roles.dto'; // Eklendi: DTO'ya ihtiyacımız var

interface RequestWithUser extends Request {
  user: {
    id: string; // JwtStrategy'miz 'sub' değil 'id' yolluyordu (en son)
    permissions: Set<string>;
  };
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService, // 1. RolesService'i enjekte et
  ) {}

  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @CheckPermissions(PERMISSIONS.USERS.READ)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // =================================================================
  // YENİ: KULLANICIYA ROL ATAMA/GÜNCELLEME
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.ASSIGN_ROLE)
  @Post(':id/roles') // /api/users/uuid-of-user/roles
  @HttpCode(HttpStatus.OK)
  assignRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRolesDto: AssignRolesDto,
  ) {
    // 2. RolesService'teki fonksiyonu burada kullan
    return this.rolesService.assignRolesToUser(id, assignRolesDto);
  }

  // =================================================================
  // YENİ: KULLANICI SİLME ENDPOINT'İ
  // =================================================================
  @CheckPermissions(PERMISSIONS.USERS.DELETE)
  @Delete(':id') // /api/users/uuid-of-user-to-delete
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithUser, // 3. req'i al (kendini silmesin diye)
  ) {
    const currentUserId = req.user.id;
    return this.usersService.remove(currentUserId);
  }
}
