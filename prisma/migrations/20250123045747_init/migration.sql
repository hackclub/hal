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

-- CreateTable
CREATE TABLE "Person" (
    "id" SERIAL NOT NULL,
    "slackId" TEXT NOT NULL,
    "slackHandle" TEXT NOT NULL,
    "admin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeTeam" (
    "id" SERIAL NOT NULL,
    "joinCode" TEXT NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_name_key" ON "Challenge"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Person_slackId_key" ON "Person"("slackId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeTeam_challengeId_joinCode_key" ON "ChallengeTeam"("challengeId", "joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_teamId_personId_key" ON "ChallengeParticipant"("teamId", "personId");

-- AddForeignKey
ALTER TABLE "ChallengeTeam" ADD CONSTRAINT "ChallengeTeam_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ChallengeTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
