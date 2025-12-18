/*
  Warnings:

  - A unique constraint covering the columns `[userId,productId,size]` on the table `cart_items` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "cart_items_userId_productId_key";

-- AlterTable
ALTER TABLE "cart_items" ADD COLUMN     "size" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "address" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "product_comments" ADD COLUMN     "editedByAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_userId_productId_size_key" ON "cart_items"("userId", "productId", "size");
