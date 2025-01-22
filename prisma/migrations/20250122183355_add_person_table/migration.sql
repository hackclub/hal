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

-- CreateIndex
CREATE UNIQUE INDEX "Person_slackId_key" ON "Person"("slackId");
