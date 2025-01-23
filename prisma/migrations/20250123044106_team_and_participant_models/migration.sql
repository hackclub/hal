-- CreateTable
CREATE TABLE "ChallengeTeam" (
    "id" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeParticipant" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "personId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeTeam_challengeId_joinCode_key" ON "ChallengeTeam"("challengeId", "joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipant_teamId_personId_key" ON "ChallengeParticipant"("teamId", "personId");

-- AddForeignKey
ALTER TABLE "ChallengeTeam" ADD CONSTRAINT "ChallengeTeam_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ChallengeTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
