-- AlterTable: rename discount column to wholesale price
ALTER TABLE "Product" RENAME COLUMN "discountPrice" TO "wholesalePrice";

-- AlterTable: wholesale flag for clients
ALTER TABLE "User" ADD COLUMN "isWholesale" BOOLEAN NOT NULL DEFAULT false;
