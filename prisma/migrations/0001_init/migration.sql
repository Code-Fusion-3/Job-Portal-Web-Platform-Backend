-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Profile` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `skills` VARCHAR(191) NULL,
    `photo` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `experience` VARCHAR(191) NULL,
    `jobCategoryId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `dateOfBirth` DATETIME(3) NULL,
    `description` VARCHAR(191) NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `idNumber` VARCHAR(191) NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `references` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `contactNumber` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NULL,
    `location` VARCHAR(191) NULL,
    `maritalStatus` VARCHAR(191) NULL,
    `monthlyRate` VARCHAR(191) NULL,
    `availability` VARCHAR(191) NULL,
    `certifications` VARCHAR(191) NULL,
    `educationLevel` VARCHAR(191) NULL,
    `languages` VARCHAR(191) NULL,
    `experienceLevel` VARCHAR(191) NULL,
    `approvalStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `approvedAt` DATETIME(3) NULL,
    `approvedBy` INTEGER NULL,
    `rejectionReason` VARCHAR(191) NULL,

    UNIQUE INDEX `Profile_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployerRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NULL,
    `selectedUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `updatedAt` DATETIME(3) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `requestedCandidateId` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `employerRequestId` INTEGER NOT NULL,
    `fromAdmin` BOOLEAN NOT NULL,
    `employerEmail` VARCHAR(191) NOT NULL,
    `content` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `attachmentName` VARCHAR(191) NULL,
    `attachmentUrl` VARCHAR(191) NULL,
    `isRead` BOOLEAN NOT NULL DEFAULT false,
    `messageType` VARCHAR(191) NOT NULL DEFAULT 'text',
    `readAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'unread',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'normal',
    `category` VARCHAR(191) NOT NULL DEFAULT 'general',
    `adminResponse` VARCHAR(191) NULL,
    `adminResponseSubject` VARCHAR(191) NULL,
    `respondedBy` INTEGER NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobCategory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name_en` VARCHAR(191) NOT NULL,
    `name_rw` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_jobCategoryId_fkey` FOREIGN KEY (`jobCategoryId`) REFERENCES `JobCategory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Profile` ADD CONSTRAINT `Profile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployerRequest` ADD CONSTRAINT `EmployerRequest_requestedCandidateId_fkey` FOREIGN KEY (`requestedCandidateId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmployerRequest` ADD CONSTRAINT `EmployerRequest_selectedUserId_fkey` FOREIGN KEY (`selectedUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_employerRequestId_fkey` FOREIGN KEY (`employerRequestId`) REFERENCES `EmployerRequest`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_respondedBy_fkey` FOREIGN KEY (`respondedBy`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

