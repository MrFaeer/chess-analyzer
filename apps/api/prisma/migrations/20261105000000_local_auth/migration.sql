CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "loginNormalized" TEXT NOT NULL,
    "email" TEXT,
    "emailNormalized" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "User_login_canonical" CHECK (
        "login" ~ '^[A-Za-z0-9_]{3,32}$' AND "loginNormalized" = lower("login")
    ),
    CONSTRAINT "User_email_canonical" CHECK (
        ("email" IS NULL AND "emailNormalized" IS NULL) OR
        ("email" IS NOT NULL AND "emailNormalized" IS NOT NULL AND
         "emailNormalized" = lower(btrim("email")))
    ),
    CONSTRAINT "User_language_valid" CHECK ("language" IN ('en', 'ru', 'lv'))
);
CREATE UNIQUE INDEX "User_loginNormalized_key" ON "User"("loginNormalized");
CREATE UNIQUE INDEX "User_emailNormalized_key" ON "User"("emailNormalized");

CREATE TABLE "Session" (
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash"),
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
