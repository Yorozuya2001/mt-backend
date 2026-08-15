-- AlterTable
ALTER TABLE "User" ADD COLUMN "dni" VARCHAR(20),
ADD COLUMN "phone" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
