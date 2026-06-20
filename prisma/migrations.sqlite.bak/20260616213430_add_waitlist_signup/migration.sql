-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'launch',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSignup_email_key" ON "WaitlistSignup"("email");
