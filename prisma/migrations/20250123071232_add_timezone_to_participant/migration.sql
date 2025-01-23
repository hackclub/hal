/*
  Warnings:

  - Added the required column `timezone` to the `ChallengeParticipant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ChallengeParticipant" ADD COLUMN     "timezone" TEXT NOT NULL;
