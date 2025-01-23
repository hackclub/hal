import { prisma } from '../db'

export class Person {
  constructor(data) {
    this.id = data.id
    this.slackId = data.slackId
    this.slackHandle = data.slackHandle
    this.admin = data.admin
    this.createdAt = data.createdAt
    this.updatedAt = data.updatedAt
  }

  // Find or create a person from their Slack ID and handle
  static async findOrCreateFromSlack(slackId, slackHandle) {
    try {
      const person = await prisma.person.upsert({
        where: { slackId },
        update: { slackHandle },
        create: {
          slackId,
          slackHandle,
          admin: false
        }
      })
      return new Person(person)
    } catch (error) {
      console.error('Error in findOrCreateFromSlack:', error)
      throw error
    }
  }

  // Find a person by their Slack ID
  static async findBySlackId(slackId) {
    const person = await prisma.person.findUnique({
      where: { slackId }
    })
    return person ? new Person(person) : null
  }

  // Create a new person
  static async create(data) {
    const person = await prisma.person.create({
      data: {
        slackId: data.slackId,
        slackHandle: data.slackHandle,
        admin: data.admin || false
      }
    })
    return new Person(person)
  }

  // Update person's details
  async update(data) {
    const updated = await prisma.person.update({
      where: { id: this.id },
      data: {
        slackHandle: data.slackHandle ?? this.slackHandle,
        admin: data.admin ?? this.admin
      }
    })
    Object.assign(this, updated)
    return this
  }
} 