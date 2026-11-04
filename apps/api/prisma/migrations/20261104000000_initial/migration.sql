-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('LICHESS', 'CHESS_COM');

-- CreateTable
CREATE TABLE "ChessProfile" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChessProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "pgn" TEXT NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChessProfile_platform_username_idx" ON "ChessProfile"("platform", "username");

-- CreateIndex
CREATE UNIQUE INDEX "ChessProfile_platform_externalId_key" ON "ChessProfile"("platform", "externalId");

-- CreateIndex
CREATE INDEX "Game_platform_playedAt_idx" ON "Game"("platform", "playedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Game_platform_externalId_key" ON "Game"("platform", "externalId");
