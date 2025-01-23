import { PrismaClient } from '@prisma/client'
import { SQL } from "bun"

import { config } from "dotenv"
config()

export const prisma = new PrismaClient() 

console.log(process.env.HACKATIME_DATABASE_URL)
export const hackatime = new SQL({
    url: process.env.HACKATIME_DATABASE_URL,
    password: process.env.HACKATIME_DATABASE_PASSWORD
})