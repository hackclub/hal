-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('DAILY', 'CUMULATIVE');

-- CreateTable
CREATE TABLE "Challenge" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "startedTime" TIMESTAMP(3),
    "endedTime" TIMESTAMP(3),
    "challengeType" "ChallengeType" NOT NULL,
    "challengeMinimumTime" INTEGER NOT NULL,
    "challengeEditorConstraint" TEXT,
    "challengeLanguageConstraint" TEXT,
    "challengeMinimumTeamSize" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);
