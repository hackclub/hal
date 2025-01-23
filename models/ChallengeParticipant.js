import { prisma } from '../db'
import { ChallengeTeam } from './ChallengeTeam'

export class ChallengeParticipant {
    constructor(data) {
        this.id = data.id
        this.teamId = data.teamId
        this.personId = data.personId
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

    // Remove a participant from a team
    async remove() {
        await prisma.challengeParticipant.delete({
            where: { id: this.id }
        })
    }
} 