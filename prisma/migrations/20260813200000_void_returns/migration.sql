-- AlterTable
ALTER TABLE "Remito" ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT,
ADD COLUMN "voidReason" VARCHAR(255);

-- AlterTable
ALTER TABLE "RemitoItem" ADD COLUMN "returnedQuantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "previousStock" INTEGER,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT;

-- CreateTable
CREATE TABLE "RemitoReturn" (
    "id" TEXT NOT NULL,
    "remitoId" TEXT NOT NULL,
    "remitoItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "reason" VARCHAR(255),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemitoReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemitoReturn_remitoId_idx" ON "RemitoReturn"("remitoId");

-- CreateIndex
CREATE INDEX "RemitoReturn_remitoItemId_idx" ON "RemitoReturn"("remitoItemId");

-- AddForeignKey
ALTER TABLE "Remito" ADD CONSTRAINT "Remito_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoReturn" ADD CONSTRAINT "RemitoReturn_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoReturn" ADD CONSTRAINT "RemitoReturn_remitoItemId_fkey" FOREIGN KEY ("remitoItemId") REFERENCES "RemitoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemitoReturn" ADD CONSTRAINT "RemitoReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
