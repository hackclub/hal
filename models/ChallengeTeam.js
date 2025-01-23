import { prisma } from '../db'
import { ChallengeParticipant } from './ChallengeParticipant'

export class ChallengeTeam {
    constructor(data) {
        this.id = data.id
        this.joinCode = data.joinCode
        this.challengeId = data.challengeId
        this.createdAt = data.createdAt
        this.updatedAt = data.updatedAt
    }

    // Generate a random 4-character join code (a-z0-9)
    static generateJoinCode() {
        const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
        let code = ''
        for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code.toLowerCase()
    }

    // Create a new team with a unique join code for the challenge
    static async create(challengeId, personId) {
        // Try to create a team with a unique join code, retry if there's a conflict
        for (let attempts = 0; attempts < 10; attempts++) {
            const joinCode = this.generateJoinCode()
            try {
                // Use a transaction to create both team and participant
                const team = await prisma.$transaction(async (tx) => {
                    const newTeam = await tx.challengeTeam.create({
                        data: {
                            challengeId,
                            joinCode
                        }
                    })

                    // Create the participant record for the team creator
                    await tx.challengeParticipant.create({
                        data: {
                            teamId: newTeam.id,
                            personId
                        }
                    })

                    return newTeam
                })

                return new ChallengeTeam(team)
            } catch (error) {
                // If there's a unique constraint violation, try again
                if (error.code === 'P2002') continue
                throw error
            }
        }
        throw new Error('Could not generate a unique join code after multiple attempts')
    }

    // Find a team by ID
    static async findById(id) {
        const team = await prisma.challengeTeam.findUnique({
            where: { id }
        })
        return team ? new ChallengeTeam(team) : null
    }

    // Find a team by join code within a challenge
    static async findByJoinCode(challengeId, joinCode) {
        const team = await prisma.challengeTeam.findFirst({
            where: {
                challengeId,
                joinCode: joinCode.toLowerCase()
            }
        })
        return team ? new ChallengeTeam(team) : null
    }

    // List all teams for a challenge
    static async listByChallenge(challengeId) {
        const teams = await prisma.challengeTeam.findMany({
            where: { challengeId }
        })
        return teams.map(t => new ChallengeTeam(t))
    }

    // Get all participants in this team
    async getParticipants() {
        const participants = await prisma.challengeParticipant.findMany({
            where: { teamId: this.id },
            include: { person: true }
        })
        return participants
    }

    // Add a participant to this team
    async addParticipant(personId) {
        const participant = await prisma.challengeParticipant.create({
            data: {
                teamId: this.id,
                personId
            }
        })
        return participant
    }

    // Check if a person is in this team
    async hasPerson(personId) {
        const count = await prisma.challengeParticipant.count({
            where: {
                teamId: this.id,
                personId
            }
        })
        return count > 0
    }
} 