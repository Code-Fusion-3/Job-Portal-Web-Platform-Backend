# Database Schema Changes for New Payment Workflow

## 1. Update EmployerRequest Model

```prisma
model EmployerRequest {
  id                   Int               @id @default(autoincrement())
  employerAccountId    Int?
  message              String?           @db.Text
  selectedUserId       Int?
  createdAt            DateTime          @default(now())
  priority             String            @default("normal") @db.VarChar(20)
  status               String            @default("pending") @db.VarChar(20)
  // Updated statuses: pending | first_payment_required | first_payment_confirmed | second_payment_required | second_payment_confirmed | completed | cancelled
  updatedAt            DateTime          @updatedAt
  requestedCandidateId Int?
  requestedCandidate   User?             @relation("RequestedCandidate", fields: [requestedCandidateId], references: [id])
  selectedUser         User?             @relation("SelectedUser", fields: [selectedUserId], references: [id])
  employerAccount      EmployerAccount?  @relation(fields: [employerAccountId], references: [id])
  messages             Message[]
  payments             Payment[]
  requestProgress      RequestProgress[]

  // Payment workflow fields
  firstPaymentRequired      Boolean           @default(true)
  firstPaymentAmount        Decimal?          @default(5000.00) @db.Decimal(10, 2)
  firstPaymentConfirmed     Boolean           @default(false)
  firstPaymentConfirmedAt   DateTime?

  secondPaymentRequired     Boolean           @default(false)
  secondPaymentAmount       Decimal?          @db.Decimal(10, 2)
  secondPaymentConfirmed    Boolean           @default(false)
  secondPaymentConfirmedAt  DateTime?

  // Access control
  partialAccessGranted      Boolean           @default(false)
  fullAccessGranted         Boolean           @default(false)
  accessGrantedAt           DateTime?
  accessGrantedBy           Int?

  // Completion tracking
  isCompleted               Boolean           @default(false)
  completedAt               DateTime?
  completedBy               Int?

  // Deactivation
  isActive                  Boolean           @default(true)
  deactivatedAt             DateTime?
  deactivatedBy             Int?
}
```

## 2. Update Payment Model

```prisma
model Payment {
  id                Int               @id @default(autoincrement())
  employerRequestId Int
  amount            Decimal           @db.Decimal(10, 2)
  currency          String            @default("RWF") @db.VarChar(10)
  paymentMethodId   Int
  paymentType       String            @db.VarChar(50) // first_installment | second_installment
  paymentReference  String            @db.VarChar(255)
  status            String            @default("pending") @db.VarChar(20) // pending | confirmed | approved | rejected
  description       String?           @db.Text

  // Payment confirmation details
  confirmationName  String?           @db.VarChar(255)
  confirmationPhone String?           @db.VarChar(20)
  confirmationDate  DateTime?
  adminNotes        String?           @db.Text

  // Installment tracking
  installmentNumber Int               @default(1) // 1 for first, 2 for second
  isNonRefundable   Boolean           @default(false) // First installment is non-refundable

  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  employerRequest   EmployerRequest   @relation(fields: [employerRequestId], references: [id])
  paymentMethod     PaymentMethod     @relation(fields: [paymentMethodId], references: [id])
  user              User?             @relation(fields: [userId], references: [id])
  userId            Int?
  approvals         PaymentApproval[]
}
```

## 3. Update RequestProgress Model

```prisma
model RequestProgress {
  id                Int             @id @default(autoincrement())
  employerRequestId Int
  stage             String          @db.VarChar(50)
  // Updated stages: request_received | first_payment_required | first_payment_confirmed | partial_access_granted | second_payment_required | second_payment_confirmed | full_access_granted | completed
  status            String          @db.VarChar(20) // pending | in_progress | completed | failed
  description       String          @db.Text
  adminNotes        String?         @db.Text
  completedAt       DateTime?
  completedBy       Int?
  createdAt         DateTime        @default(now())
  employerRequest   EmployerRequest @relation(fields: [employerRequestId], references: [id])
}
```

## 4. Add Job Seeker Availability Tracking

```prisma
model User {
  // ... existing fields ...

  // Availability tracking
  isAvailableForMatching Boolean @default(true)
  matchedAt              DateTime?
  matchedWithEmployerId  Int?
  matchedEmployerRequest EmployerRequest? @relation("MatchedEmployerRequest", fields: [matchedWithEmployerId], references: [id])

  // ... rest of existing fields ...
}
```

## 5. Add Notification System

```prisma
model Notification {
  id                Int             @id @default(autoincrement())
  userId            Int
  employerRequestId Int?
  type              String          @db.VarChar(50) // payment_request | payment_confirmed | access_granted | completion
  title             String          @db.VarChar(255)
  message           String          @db.Text
  isRead            Boolean         @default(false)
  readAt            DateTime?
  createdAt         DateTime        @default(now())

  user              User            @relation(fields: [userId], references: [id])
  employerRequest   EmployerRequest? @relation(fields: [employerRequestId], references: [id])
}
```
