import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
// 'permissions.constants.ts' dosyasının doğru yolunu belirtmemiz gerek
// 'prisma/seed.ts' dosyasındayız, yani '../src/'
import { PERMISSIONS } from '../src/authorization/constants/permissions.constants';

const prisma = new PrismaClient();

/**
 * Sistemdeki tüm sabit (hardcoded) yetki anahtarlarını
 * ['products:create', 'users:read', ...] formatında düz bir diziye çevirir.
 */
function getAllPermissions(): string[] {
  const permissions: string[] = [];
  Object.values(PERMISSIONS).forEach((resource) => {
    Object.values(resource).forEach((permissionKey) => {
      permissions.push(permissionKey);
    });
  });
  return permissions;
}

/**
 * Ana Tohumlama Fonksiyonu
 */
async function main() {
  console.log('Tohumlama (seeding) basliyor...');

  const allPermissions = getAllPermissions();
  console.log(`Toplam ${allPermissions.length} adet yetki bulundu.`);

  // 1. "SÜPER ADMIN" ROLÜNÜ OLUŞTUR
  // ve bu role sistemdeki TÜM yetkileri ata

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      permissions: {
        createMany: {
          data: allPermissions.map((key) => ({ permissionKey: key })),
        },
      },
    },
    include: {
      permissions: true,
    },
  });
  console.log(
    `'ADMIN' rolu olusturuldu ve ${adminRole.permissions.length} yetki atandi.`,
  );

  // 2. "USER" ROLÜNÜ OLUŞTUR
  // ve bu role sadece 'kendi' (own) yetkilerini ata
  await prisma.role.create({
    data: {
      name: 'USER',
      permissions: {
        createMany: {
          data: [
            { permissionKey: PERMISSIONS.COMMENTS.CREATE },
            { permissionKey: PERMISSIONS.COMMENTS.UPDATE_OWN },
            { permissionKey: PERMISSIONS.COMMENTS.DELETE_OWN },
            { permissionKey: PERMISSIONS.CARTS.READ_OWN },
            { permissionKey: PERMISSIONS.CARTS.UPDATE_OWN },
            { permissionKey: PERMISSIONS.ORDERS.CREATE_OWN },
            { permissionKey: PERMISSIONS.ORDERS.READ_OWN },
          ],
        },
      },
    },
  });
  console.log(`'USER' rolu olusturuldu ve temel yetkiler atandi.`);

  // 3. "SÜPER ADMIN" TEST KULLANICISINI OLUŞTUR
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      firstName: 'Emirhan',
      lastName: 'Çelik',
      fullName: 'Emirhan Çelik',
      username: 'admin',
      email: 'admin@velovis.com',
      password: hashedPassword,
      // Bu kullanıcıyı 'ADMIN' rolüne bağla
      roles: {
        create: [
          {
            roleId: adminRole.id,
          },
        ],
      },
    },
  });
  console.log(
    `'${adminUser.username}' (Sifre: Password123) super admin kullanicisi olusturuldu.`,
  );

  // 4. (İsteğe bağlı) TEST ÜRÜNLERİ OLUŞTUR
  const testCategory = await prisma.category.create({
    data: {
      name: 'Test Kategorisi',
      slug: 'test-kategorisi',
      order: 1,
    },
  });

  await prisma.product.create({
    data: {
      name: 'Ornek Laptop',
      slug: 'ornek-laptop',
      shortDescription: 'Tohumlamadan gelen test urunu.',
      longDescription:
        'Tohumlama (seeding) islemi tarafindan otomatik olarak olusturulmustur.',
      price: 15000,
      stockQuantity: 50, // Stok ekledik
      categoryId: testCategory.id,
    },
  });
  console.log('Test kategorisi ve test urunu olusturuldu.');

  console.log('Tohumlama (seeding) basariyla tamamlandi.');
}

// =================================================================
// ÇALIŞTIRMA
// =================================================================
main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // Prisma Client bağlantısını düzgünce kapat
    await prisma.$disconnect();
  });
