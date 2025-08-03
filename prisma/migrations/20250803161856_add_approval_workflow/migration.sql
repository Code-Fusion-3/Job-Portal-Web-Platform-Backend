-- AlterTable
ALTER TABLE "EmployerRequest" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "requestedCandidateId" INTEGER;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "monthlyRate" TEXT;
