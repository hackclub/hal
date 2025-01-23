/*
  Warnings:

  - The primary key for the `ChallengeParticipantDailyHackatimeSummary` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ChallengeParticipantDailyHackatimeSummary` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ChallengeParticipantDailyHackatimeSummary_date_challengePar_key";

-- AlterTable
ALTER TABLE "ChallengeParticipantDailyHackatimeSummary" DROP CONSTRAINT "ChallengeParticipantDailyHackatimeSummary_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "ChallengeParticipantDailyHackatimeSummary_pkey" PRIMARY KEY ("date", "challengeParticipantId");
