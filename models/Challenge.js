import { prisma } from '../db'

export class Challenge {
  constructor(data) {
    this.id = data.id
    this.name = data.name
    this.startedTime = data.startedTime
    this.endedTime = data.endedTime
    this.challengeType = data.challengeType
    this.challengeMinimumTime = data.challengeMinimumTime
    this.challengeEditorConstraint = data.challengeEditorConstraint
    this.challengeLanguageConstraint = data.challengeLanguageConstraint
    this.challengeMinimumTeamSize = data.challengeMinimumTeamSize
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
  }

  // Calculate the current state of the challenge
  state() {
    const now = new Date()
    
    if (!this.startedTime) {
      return 'openForSignUps'
    }
    
    if (this.endedTime && now >= this.endedTime) {
      return 'ended'
    }
    
    if (now >= this.startedTime) {
      return 'started'
    }
    
    return 'openForSignUps'
  }

  // Create a new challenge
  static async create(data) {
    const challenge = await prisma.challenge.create({
      data: {
        name: data.name,
        startedTime: data.startedTime,
        endedTime: data.endedTime,
        challengeType: data.challengeType,
        challengeMinimumTime: data.challengeMinimumTime,
        challengeEditorConstraint: data.challengeEditorConstraint,
        challengeLanguageConstraint: data.challengeLanguageConstraint,
        challengeMinimumTeamSize: data.challengeMinimumTeamSize
      }
    })
    return new Challenge(challenge)
  }

  // Find a challenge by ID
  static async findById(id) {
    const challenge = await prisma.challenge.findUnique({
      where: { id }
    })
    return challenge ? new Challenge(challenge) : null
  }

  // Find a challenge by name
  static async findByName(name) {
    const challenge = await prisma.challenge.findUnique({
      where: { name }
    })
    return challenge ? new Challenge(challenge) : null
  }

  // Update challenge details
  async update(data) {
    const updated = await prisma.challenge.update({
      where: { id: this.id },
      data: {
        name: data.name ?? this.name,
        startedTime: data.startedTime ?? this.startedTime,
        endedTime: data.endedTime ?? this.endedTime,
        challengeType: data.challengeType ?? this.challengeType,
        challengeMinimumTime: data.challengeMinimumTime ?? this.challengeMinimumTime,
        challengeEditorConstraint: data.challengeEditorConstraint ?? this.challengeEditorConstraint,
        challengeLanguageConstraint: data.challengeLanguageConstraint ?? this.challengeLanguageConstraint,
        challengeMinimumTeamSize: data.challengeMinimumTeamSize ?? this.challengeMinimumTeamSize
      }
    })
    Object.assign(this, updated)
    return this
  }

  // List all active challenges (not ended)
  static async listActive() {
    const challenges = await prisma.challenge.findMany({
      where: {
        OR: [
          { endedTime: null },
          { endedTime: { gt: new Date() } }
        ]
      }
    })
    return challenges.map(c => new Challenge(c))
  }

  static async firstChallengeStartAt() {
    const challenge = await prisma.challenge.findFirst({
      orderBy: { startedTime: 'asc' }
    })
    return challenge ? challenge.startedTime : null
  }
} 
