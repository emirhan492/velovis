import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ForbiddenException, // Eksikse eklendi
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { PERMISSIONS } from 'src/authorization/constants/permissions.constants';
import { Prisma } from '@prisma/client';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  // =================================================================
  // YARDIMCI FONKSİYON: Tüm Sabit Yetkileri Listele
  // =================================================================
  getAllPermissions() {
    const permissions: string[] = [];
    Object.values(PERMISSIONS).forEach((resource) => {
      Object.values(resource).forEach((permissionKey) => {
        permissions.push(permissionKey);
      });
    });
    return permissions.sort();
  }

  // =================================================================
  // YENİ ROL OLUŞTURMA
  // =================================================================
  async create(createRoleDto: CreateRoleDto) {
    try {
      return await this.prisma.role.create({
        data: {
          name: createRoleDto.name.toUpperCase(),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Bu rol adı zaten mevcut.');
      }
      throw error;
    }
  }

  // =================================================================
  // TÜM ROLLERİ LİSTELEME
  // =================================================================
  async findAll() {
    return this.prisma.role.findMany({
      include: {
        permissions: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  // =================================================================
  // BİR ROLE YETKİ ATAMA
  // =================================================================
  async assignPermissions(roleId: string, assignPermissionsDto: AssignPermissionsDto) {
    const { permissionKeys } = assignPermissionsDto;

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Rol bulunamadı.');
    }

    const allValidPermissions = new Set(this.getAllPermissions());
    const invalidKeys = permissionKeys.filter(
      (key) => !allValidPermissions.has(key),
    );

    if (invalidKeys.length > 0) {
      throw new BadRequestException(
        `Geçersiz yetki anahtarları: ${invalidKeys.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({
        where: { roleId: roleId },
      });

      if (permissionKeys.length > 0) {
        const dataToInsert = permissionKeys.map((key) => ({
          roleId: roleId,
          permissionKey: key,
        }));

        await tx.rolePermission.createMany({
          data: dataToInsert,
        });
      }

      return tx.role.findUnique({
        where: { id: roleId },
        include: { permissions: true },
      });
    });
  } // <-- EKSİK OLAN PARANTEZ BÜYÜK İHTİMALLE BUYDU

  // =================================================================
  // ROL SİLME (YENİ EKLENEN FONKSİYON)
  // =================================================================
  async remove(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('Rol bulunamadı.');
    }
    if (role.name === 'ADMIN' || role.name === 'USER') {
      throw new ForbiddenException(
        'ADMIN ve USER rolleri sistem için gereklidir ve silinemez.',
      );
    }
    try {
      return await this.prisma.role.delete({
        where: { id },
      });
    } catch (error) {
      throw new InternalServerErrorException('Rol silinirken bir hata oluştu.');
    }
  } // <-- YENİ FONKSİYONUN KAPANIŞ PARANTEZİ

  // =================================================================
  // BİR KULLANICIYA ROL ATAMA (HATA ALDIĞIN YER)
  // =================================================================
  async assignRolesToUser(userId: string, assignRolesDto: AssignRolesDto) {
    const { roleIds } = assignRolesDto;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('Bir veya daha fazla rol IDsi geçersiz.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: userId },
      });

      if (roleIds.length > 0) {
        const dataToInsert = roleIds.map((roleId) => ({
          userId: userId,
          roleId: roleId,
        }));

        await tx.userRole.createMany({
          data: dataToInsert,
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
        },
      });
    });
  } // <-- assignRolesToUser FONKSİYONUNUN KAPANIŞ PARANTEZİ
}
