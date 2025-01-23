-- DropForeignKey
ALTER TABLE "ChallengeTeam" DROP CONSTRAINT "ChallengeTeam_challengeId_fkey";

-- AddForeignKey
ALTER TABLE "ChallengeTeam" ADD CONSTRAINT "ChallengeTeam_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
