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

  async getStatsForUser(slackId) {
    // Get the participant and their team for this challenge
    const participant = await prisma.challengeParticipant.findFirst({
      where: {
        team: {
          challengeId: this.id
        },
        person: {
          slackId
        }
      },
      include: {
        team: {
          include: {
            members: {
              include: {
                person: true,
                dailySummaries: true
              }
            }
          }
        }
      }
    })

    if (!participant) {
      return { days: [] }
    }

    // Get all teams for this challenge for leaderboard
    const allTeams = await prisma.challengeTeam.findMany({
      where: {
        challengeId: this.id
      },
      include: {
        members: {
          include: {
            person: true,
            dailySummaries: true
          }
        }
      }
    })

    const days = []
    const startDate = this.startedTime
    const endDate = this.endedTime || new Date()
    const totalDays = this.endedTime ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) : null
    
    // For each day in the challenge
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0]
      const dayNumber = Math.floor((d - startDate) / (1000 * 60 * 60 * 24)) + 1

      // Check if any summaries exist for this date
      const hasSummaries = allTeams.some(team =>
        team.members.some(member =>
          member.dailySummaries.some(s => 
            s.date.toISOString().split('T')[0] === date
          )
        )
      )

      // Skip days that haven't started yet
      if (!hasSummaries) continue

      // Calculate team stats for the day
      const teamStats = allTeams.map(team => {
        const teamTimeSeconds = team.members.reduce((total, member) => {
          const summary = member.dailySummaries.find(s => 
            s.date.toISOString().split('T')[0] === date
          )
          if (!summary) return total
          
          // Sum all category totals from the JSON
          const categories = summary.json.categories || []
          const memberTime = categories.reduce((sum, cat) => sum + (cat.total || 0), 0)
          return total + memberTime
        }, 0)

        return {
          teamId: team.id,
          teamTimeSeconds,
          participants: team.members.map(m => ({
            slackId: m.person.slackId,
            timeSeconds: m.dailySummaries.find(s => 
              s.date.toISOString().split('T')[0] === date
            )?.json.categories?.reduce((sum, cat) => sum + (cat.total || 0), 0) || 0
          }))
        }
      }).sort((a, b) => b.teamTimeSeconds - a.teamTimeSeconds)

      const myTeamStats = teamStats.find(t => t.teamId === participant.teamId)
      const myTeamPlace = teamStats.findIndex(t => t.teamId === participant.teamId) + 1
      const topTeam = teamStats[0]

      // Calculate participant statuses
      const participants = participant.team.members.map(member => {
        const summary = member.dailySummaries.find(s => 
          s.date.toISOString().split('T')[0] === date
        )
        const timeSeconds = summary?.json.categories?.reduce((sum, cat) => sum + (cat.total || 0), 0) || 0
        
        let status = '🟥' // No time logged
        if (timeSeconds > 0) status = '🟨' // Some time logged
        if (timeSeconds >= this.challengeMinimumTime) status = '✅' // Met minimum time

        return {
          slackId: member.person.slackId,
          status,
          timeSeconds
        }
      }).sort((a, b) => b.timeSeconds - a.timeSeconds)

      // Calculate overall team status
      const allMetMinimum = participants.every(p => p.timeSeconds >= this.challengeMinimumTime)
      const anyMetMinimum = participants.some(p => p.timeSeconds >= this.challengeMinimumTime)
      const anyTimeLogged = participants.some(p => p.timeSeconds > 0)
      
      let teamStatus = '🟥' // Default red if no time logged
      if (anyTimeLogged) teamStatus = '🟨' // Yellow if any time logged
      if (allMetMinimum) teamStatus = '✅' // Green if all met minimum

      days.push({
        title: totalDays ? `Day ${dayNumber}/${totalDays}` : `Day ${dayNumber}`,
        date,
        teamStatus,
        participants,
        leaderboard: {
          myTeam: {
            teamPlace: myTeamPlace,
            teamTimeSeconds: myTeamStats.teamTimeSeconds,
            totalTeams: teamStats.length
          },
          topTeam: {
            teamPlace: 1,
            teamTimeSeconds: topTeam.teamTimeSeconds,
            totalTeams: teamStats.length,
            participants: topTeam.participants.sort((a, b) => b.timeSeconds - a.timeSeconds)
          }
        }
      })
    }

    return { days: days.reverse() }
  }
}
