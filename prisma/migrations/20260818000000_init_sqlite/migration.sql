PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "lastName" TEXT NOT NULL DEFAULT '',
    "dni" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "locality" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "isWholesale" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "presentation" TEXT,
    "brand" TEXT,
    "price" DECIMAL NOT NULL,
    "wholesalePrice" DECIMAL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Remito" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" INTEGER NOT NULL,
    "clientId" TEXT,
    "createdById" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "total" DECIMAL NOT NULL,
    "notes" TEXT,
    "voidedAt" DATETIME,
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Remito_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Remito_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Remito_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemitoItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remitoId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    CONSTRAINT "RemitoItem_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemitoItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RemitoReturn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "remitoId" TEXT NOT NULL,
    "remitoItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RemitoReturn_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemitoReturn_remitoItemId_fkey" FOREIGN KEY ("remitoItemId") REFERENCES "RemitoItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RemitoReturn_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "remitoId" TEXT,
    "previousStock" INTEGER,
    "voidedAt" DATETIME,
    "voidedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_remitoId_fkey" FOREIGN KEY ("remitoId") REFERENCES "Remito" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StockMovement_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_dni_key" ON "User"("dni");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_title_idx" ON "Product"("title");
CREATE INDEX "Product_barcode_idx" ON "Product"("barcode");
CREATE INDEX "Product_sku_idx" ON "Product"("sku");
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "StockMovement_productId_idx" ON "StockMovement"("productId");
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX "StockMovement_remitoId_idx" ON "StockMovement"("remitoId");
CREATE UNIQUE INDEX "Remito_number_key" ON "Remito"("number");
CREATE INDEX "Remito_clientId_createdAt_idx" ON "Remito"("clientId", "createdAt");
CREATE INDEX "Remito_createdAt_idx" ON "Remito"("createdAt");
CREATE INDEX "RemitoItem_remitoId_idx" ON "RemitoItem"("remitoId");
CREATE INDEX "RemitoReturn_remitoId_idx" ON "RemitoReturn"("remitoId");
CREATE INDEX "RemitoReturn_remitoItemId_idx" ON "RemitoReturn"("remitoItemId");

PRAGMA foreign_keys=ON;
