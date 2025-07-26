/*
  Warnings:

  - You are about to drop the column `age` on the `Profile` table. All the data in the column will be lost.
  - You are about to drop the column `bio` on the `Profile` table. All the data in the column will be lost.
  - Added the required column `firstName` to the `Profile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastName` to the `Profile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Profile" DROP COLUMN "age",
DROP COLUMN "bio",
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "idNumber" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "references" TEXT;

-- Update existing records with default values
UPDATE "Profile" SET "firstName" = 'User', "lastName" = 'Default' WHERE "firstName" IS NULL OR "lastName" IS NULL;

-- Make required columns NOT NULL
ALTER TABLE "Profile" ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;
