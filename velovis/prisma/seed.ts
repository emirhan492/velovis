// prisma/seed.ts

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Tohumlama (seeding) işlemi başlıyor...');

  // ----------------------------------------------------------------
  // 1. TEMİZLİK
  // ----------------------------------------------------------------
  console.log('🧹 Eski veriler temizleniyor...');
  // İlişki sırasına göre silme işlemi (Hata almamak için)
  await prisma.orderItem.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.productComment.deleteMany();
  await prisma.productPhoto.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  await prisma.userRole.deleteMany();
  await prisma.rolePermission.deleteMany();

  // Kategorileri ve Rolleri/Kullanıcıları en son siliyoruz
  await prisma.category.deleteMany();
  await prisma.role.deleteMany();
  await prisma.user.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.passwordResetToken.deleteMany();

  console.log('🧹 Temizlik tamamlandı. Veritabanı tertemiz.');

  // ----------------------------------------------------------------
  // 2. YETKİ LİSTESİ (Sistemin çalışması için gerekli)
  // ----------------------------------------------------------------
  const permissionsList = [
    'users:create',
    'users:read',
    'users:update',
    'users:delete',
    'roles:create',
    'roles:read',
    'roles:update',
    'roles:delete',
    'permissions:read',
    'products:create',
    'products:read',
    'products:update',
    'products:delete',
    'categories:create',
    'categories:read',
    'categories:update',
    'categories:delete',
    'orders:read',
    'orders:update',
    'comments:create',
    'comments:read',
    'comments:update',
    'comments:delete',
    'carts:read:own',
    'carts:update:own',
    'orders:create:own',
    'orders:read:own',
    'comments:update:own',
    'comments:delete:own',
    'comments:delete:any',
    'orders:read:any',
    'orders:update:any',
    'product_photos:create',
    'product_photos:update',
    'product_photos:delete',
    'users:assign_role',
  ];

  // ----------------------------------------------------------------
  // 3. ROLLERİ OLUŞTUR
  // ----------------------------------------------------------------
  console.log('🔨 Roller oluşturuluyor...');

  // USER Rolü için kısıtlı yetkiler
  const userPermissionsList = [
    'carts:read:own',
    'carts:update:own',
    'orders:create:own',
    'orders:update:own',
    'orders:read:own',
    'comments:create',
    'comments:read',
    'comments:update:own',
    'comments:delete:own',
  ];

  const adminRole = await prisma.role.create({
    data: {
      name: 'ADMIN',
      permissions: {
        create: permissionsList.map((key) => ({ permissionKey: key })),
      },
    },
  });

  const userRole = await prisma.role.create({
    data: {
      name: 'USER',
      permissions: {
        create: userPermissionsList.map((key) => ({ permissionKey: key })),
      },
    },
  });

  // ----------------------------------------------------------------
  // 4. ADMIN HESABI OLUŞTUR
  // ----------------------------------------------------------------
  console.log('🔨 Admin hesabı oluşturuluyor...');
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('Admin123!', salt);

  const adminUser = await prisma.user.create({
    data: {
      firstName: 'Emirhan',
      lastName: 'Çelik',
      username: 'admin',
      email: 'veloviswear1@gmail.com',
      hashedPassword: hashedPassword,
      isActive: true,
      isEmailVerified: true,
      fullName: 'Admin',
    },
  });

  // Admin kullanıcısına ADMIN ve USER rollerini ata
  await prisma.userRole.create({
    data: { userId: adminUser.id, roleId: adminRole.id },
  });
  await prisma.userRole.create({
    data: { userId: adminUser.id, roleId: userRole.id },
  });

  console.log('✨ Admin hesabı oluşturuldu:');
  console.log('   Kullanıcı Adı: admin');
  console.log('   Şifre: Admin123!');

  // ----------------------------------------------------------------
  // 5. KATEGORİ (ALTYAPI İÇİN GEREKLİ)
  // ----------------------------------------------------------------
  console.log('🔨 Altyapı kategorisi oluşturuluyor...');

  await prisma.category.create({
    data: {
      name: 'Ceketler',
      slug: 'ceketler',
      order: 1,
    },
  });

  console.log(
    '✅ Kurulum tamamlandı! Artık Admin Paneli üzerinden ürün ekleyebilirsin.',
  );
}

// ----------------------------------------------------------------
// ÇALIŞTIRMA
// ----------------------------------------------------------------
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Hata oluştu:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
