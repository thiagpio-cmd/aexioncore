-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "brandAccentColor" TEXT;
ALTER TABLE "Organization" ADD COLUMN "brandThemeDefault" TEXT DEFAULT 'dark';
ALTER TABLE "Organization" ADD COLUMN "brandLogoMarkUrl" TEXT;
