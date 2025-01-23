-- CreateTable
CREATE TABLE "ChallengeParticipantDailyHackatimeSummary" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "challengeParticipantId" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "jsonLastUpdated" TIMESTAMP(3) NOT NULL,
    "json" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChallengeParticipantDailyHackatimeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeParticipantDailyHackatimeSummary_date_challengePar_key" ON "ChallengeParticipantDailyHackatimeSummary"("date", "challengeParticipantId");

-- AddForeignKey
ALTER TABLE "ChallengeParticipantDailyHackatimeSummary" ADD CONSTRAINT "ChallengeParticipantDailyHackatimeSummary_challengePartici_fkey" FOREIGN KEY ("challengeParticipantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
