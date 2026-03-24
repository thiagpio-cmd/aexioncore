-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "contacts_ownerId_idx" ON "contacts"("ownerId");
