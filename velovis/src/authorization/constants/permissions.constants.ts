// Bu obje, bizim "Yetki Sözlüğümüz" olacak.
// DB'ye 'products:create' string'ini kaydedeceğiz.
// Kodda ise PERMISSIONS.PRODUCTS.CREATE kullanarak 'type-safe' kalacağız.

export const PERMISSIONS = {
  // Kullanıcı ve Rol Yönetimi (Sadece ADMIN)
  USERS: {
    READ: 'users:read',
    ASSIGN_ROLE: 'users:assign_role',
    DELETE: 'users:delete',
  },
  ROLES: {
    CREATE: 'roles:create',
    READ: 'roles:read',
    UPDATE: 'roles:update', // (Yetki atama/çıkarma)
    DELETE: 'roles:delete',
  },

  // Kategoriler (ADMIN / MODERATOR)
  CATEGORIES: {
    CREATE: 'categories:create',
    UPDATE: 'categories:update',
    DELETE: 'categories:delete',
  },

  // Ürünler (ADMIN / MODERATOR)
  PRODUCTS: {
    CREATE: 'products:create',
    UPDATE: 'products:update',
    DELETE: 'products:delete',
  },

  // Ürün Fotoğrafları (ADMIN / MODERATOR)
  PRODUCT_PHOTOS: {
    CREATE: 'product_photos:create',
    UPDATE: 'product_photos:update',
    DELETE: 'product_photos:delete',
  },

  // Yorumlar (Kullanıcı vs Moderatör)
  COMMENTS: {
    CREATE: 'comments:create',
    UPDATE_OWN: 'comments:update:own',
    DELETE_OWN: 'comments:delete:own',
    DELETE_ANY: 'comments:delete:any', // Moderatör/Admin yetkisi
  },

  // Sepet (Sadece Kullanıcı)
  CARTS: {
    READ_OWN: 'carts:read:own',
    UPDATE_OWN: 'carts:update:own',
  },

  // Siparişler (Kullanıcı vs Admin)
  ORDERS: {
    CREATE_OWN: 'orders:create:own',
    READ_OWN: 'orders:read:own',
    READ_ANY: 'orders:read:any', // Admin yetkisi
    UPDATE_ANY: 'orders:update:any', // Admin (sipariş durumunu güncelleme)
  },
} as const; // 'as const' ile bu objenin "read-only" olmasını sağlıyoruz.

// Tüm permission string'lerini tek bir array'e dönüştüren yardımcı tip (ileride lazım olabilir)
type PermissionsTuple = typeof PERMISSIONS;
type AllPermissions = PermissionsTuple[keyof PermissionsTuple][keyof PermissionsTuple[keyof PermissionsTuple]];
