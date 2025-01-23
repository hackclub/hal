import { prisma } from '../db'

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
        return code.toUpperCase()
    }

    // Create a new team with a unique join code for the challenge
    static async create(challengeId, personId, timezone) {
        // Check if person is already in a team for this challenge
        const existingParticipation = await prisma.challengeParticipant.findFirst({
            where: {
                personId,
                team: {
                    challengeId
                }
            },
            include: {
                team: true
            }
        })

        if (existingParticipation) {
            throw new Error(`You're already in a team for this challenge (Team Code: ${existingParticipation.team.joinCode})`)
        }

        // Generate a unique join code
        let joinCode
        let existingTeam
        do {
            joinCode = this.generateJoinCode()
            existingTeam = await prisma.challengeTeam.findFirst({
                where: {
                    challengeId,
                    joinCode
                }
            })
        } while (existingTeam)

        // Create the team and add the creator as first participant
        const team = await prisma.$transaction(async (tx) => {
            const team = await tx.challengeTeam.create({
                data: {
                    challengeId,
                    joinCode
                }
            })

            await tx.challengeParticipant.create({
                data: {
                    teamId: team.id,
                    personId,
                    timezone
                }
            })

            return team
        })

        return new ChallengeTeam(team)
    }

    // Find a team by ID
    static async findById(id) {
        const team = await prisma.challengeTeam.findUnique({
            where: { id }
        })
        return team ? new ChallengeTeam(team) : null
    }

    // Find a team by join code within a challenge
    static async findByCode(challengeId, joinCode) {
        return await prisma.challengeTeam.findFirst({
            where: {
                challengeId,
                joinCode: joinCode.toUpperCase()
            }
        })
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