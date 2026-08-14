-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN "remitoId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_remitoId_idx" ON "StockMovement"("remitoId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill existing sale movements linked to remitos by number in reason
UPDATE "StockMovement" sm
SET "remitoId" = r.id
FROM "Remito" r
WHERE sm.type = 'SALE'
  AND sm.reason ~ '^Remito X #[0-9]+$'
  AND r.number = CAST(regexp_replace(sm.reason, '^Remito X #', '') AS INTEGER);
