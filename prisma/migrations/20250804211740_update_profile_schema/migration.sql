/*
  Warnings:

  - Made the column `contactNumber` on table `Profile` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Profile" ALTER COLUMN "contactNumber" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "EmployerRequest" ADD CONSTRAINT "EmployerRequest_requestedCandidateId_fkey" FOREIGN KEY ("requestedCandidateId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
