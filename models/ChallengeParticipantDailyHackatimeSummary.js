import { prisma } from '../db'
import { ChallengeParticipant } from './ChallengeParticipant'
import { Hackatime } from './Hackatime'

export class ChallengeParticipantDailyHackatimeSummary {
    constructor(data) {
        Object.assign(this, data)
    }

    static async createOrUpdate(date, challengeParticipantId, timezone) {
        let json = await this.getHackatimeSummaryData(challengeParticipantId, date, timezone)

        const data = await prisma.challengeParticipantDailyHackatimeSummary.upsert({
            where: {
                date_challengeParticipantId: {
                    date: new Date(date),
                    challengeParticipantId
                }
            },
            create: {
                date: new Date(date),
                challengeParticipantId,
                timezone,
                jsonLastUpdated: new Date(),
                json
            },
            update: {
                timezone,
                jsonLastUpdated: new Date(),
                json
            }
        })

        return new ChallengeParticipantDailyHackatimeSummary(data)
    }

    static async getHackatimeSummaryData(challengeParticipantId, date, timezone) {
        let participant = await ChallengeParticipant.findById(challengeParticipantId)
        let slackId = participant.person.slackId

        // Convert date string to start/end of day in the given timezone, then convert to UTC
        let localStart = new Date(`${date}T00:00:00`)
        let localEnd = new Date(`${date}T23:59:59`)

        // Create Date objects that are timezone-aware
        //
        // Example:
        // 2025-01-23, America/New_York -> 2025-01-23T05:00:00.000Z, 2025-01-24T04:59:59.000Z
        let startDate = new Date(localStart.toLocaleString('en-US', { timeZone: timezone })).toISOString()
        let endDate = new Date(localEnd.toLocaleString('en-US', { timeZone: timezone })).toISOString()

        return Hackatime.getHackatimeSummary(slackId, startDate, endDate)
    }

    static async lastSuccessfulSummaryAt() {
        const data = await prisma.challengeParticipantDailyHackatimeSummary.findFirst({
            orderBy: {
                jsonLastUpdated: 'desc'
            }
        })

        return data ? data.jsonLastUpdated : null
    }
} 