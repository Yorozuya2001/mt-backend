-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('REGULAR', 'FRECUENTE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "buyerType" "BuyerType" NOT NULL DEFAULT 'REGULAR';
