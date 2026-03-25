-- AlterTable: replace "name" with "firstName" and "lastName" on User
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;

-- Migrate existing data: put the old "name" value into "firstName"
UPDATE "User" SET "firstName" = "name" WHERE "name" IS NOT NULL;

-- Drop old column
ALTER TABLE "User" DROP COLUMN "name";
