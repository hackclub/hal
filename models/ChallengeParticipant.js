import { prisma } from '../db'
import { daysBetweenYyymmdd, yyyymmddLocalTimezone } from '../util'
import { Challenge } from './Challenge'
import { ChallengeParticipantDailyHackatimeSummary } from './ChallengeParticipantDailyHackatimeSummary'
import { ChallengeTeam } from './ChallengeTeam'

export class ChallengeParticipant {
    constructor(data) {
        this.id = data.id
        this.teamId = data.teamId
        this.personId = data.personId
        this.timezone = data.timezone
        this.createdAt = data.createdAt
        this.updatedAt = data.updatedAt
        // Include related data if it was included in the query
        this.team = data.team ? new ChallengeTeam(data.team) : undefined
        this.person = data.person
    }

    // Create a new participant
    static async create({ teamId, personId }) {
        const participant = await prisma.challengeParticipant.create({
            data: {
                team: { connect: { id: teamId } },
                person: { connect: { id: personId } }
            },
            include: {
                team: true,
                person: true
            }
        })
        return new ChallengeParticipant(participant)
    }

    // Find a participant by ID
    static async findById(id) {
        const participant = await prisma.challengeParticipant.findUnique({
            where: { id },
            include: {
                team: true,
                person: true
            }
        })
        return participant ? new ChallengeParticipant(participant) : null
    }

    // Find a participant by person and team
    static async findByPersonAndTeam(personId, teamId) {
        const participant = await prisma.challengeParticipant.findFirst({
            where: {
                personId,
                teamId
            },
            include: {
                team: true,
                person: true
            }
        })
        return participant ? new ChallengeParticipant(participant) : null
    }

    // List all participants for a team
    static async listByTeam(teamId) {
        const participants = await prisma.challengeParticipant.findMany({
            where: { teamId },
            include: {
                person: true
            }
        })
        return participants.map(p => new ChallengeParticipant(p))
    }

    // List all teams a person is participating in
    static async listByPerson(personId) {
        const participants = await prisma.challengeParticipant.findMany({
            where: { personId },
            include: {
                team: true
            }
        })
        return participants.map(p => new ChallengeParticipant(p))
    }

    // Get all participants eligible for hackatime refresh by slack ID
    static async getEligibleForHackatimeRefresh(slackId) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const participants = await prisma.challengeParticipant.findMany({
            where: {
                person: {
                    slackId
                },
                team: {
                    challenge: {
                        OR: [
                            // Challenge has started but not ended
                            {
                                startedTime: { not: null },
                                endedTime: null
                            },
                            // Challenge ended within the past 7 days
                            {
                                endedTime: {
                                    gte: sevenDaysAgo
                                }
                            }
                        ]
                    }
                }
            },
            include: {
                team: {
                    include: {
                        challenge: true
                    }
                },
                person: true
            }
        })
        return participants.map(p => new ChallengeParticipant(p))
    }

    async refreshDailyHackatimeSummaries(heartbeatsStartDateUtc, heartbeatsEndDateUtc) {
        let challenge = await Challenge.findById(this.team.challengeId)

        let tz = this.timezone
        
        let heartbeatsStartDate = yyyymmddLocalTimezone(heartbeatsStartDateUtc, tz)
        let heartbeatsEndDate = yyyymmddLocalTimezone(heartbeatsEndDateUtc, tz)

        // these are the days we've received new heartbeats for
        // note: this could include past days, for example if the user was on an
        // airplane and a bunch of heartbeats were sent after they landed
        let heartbeatDays = daysBetweenYyymmdd(heartbeatsStartDate, heartbeatsEndDate)

        let challengeStartDate = yyyymmddLocalTimezone(challenge.startedTime, tz)
        let challengeEndDate = challenge.endedTime ?
            yyyymmddLocalTimezone(challenge.endedTime, tz) : heartbeatsEndDate

        // these are the days the challenge is active
        let challengeDays = daysBetweenYyymmdd(challengeStartDate, challengeEndDate)

        // days during the challenge that we've received new heartbeats for
        let daysToRefresh = heartbeatDays.filter(day => challengeDays.includes(day))

        let summaries = []

        for (let day of daysToRefresh) {
            summaries.push(await ChallengeParticipantDailyHackatimeSummary.createOrUpdate(day, this.id, tz))
        }

        return summaries
    }

    // Remove a participant from a team
    async remove() {
        await prisma.challengeParticipant.delete({
            where: { id: this.id }
        })
    }
} 