import 'dotenv/config'

import { hackatime } from '../db'

const HACKATIME_ADMIN_API_TOKEN = process.env.HACKATIME_ADMIN_API_TOKEN

export class Hackatime {
    static async usersWithHeartbeatsSince(date) {
        const results = await hackatime`
            SELECT
                u.id AS "userId",
                u.email AS "userEmail", 
                COUNT(h.id) AS "newHeartbeatCount",
                MIN(h.time) AS "earliestHeartbeatUtc",
                MAX(h.time) AS "latestHeartbeatUtc"
            FROM
                heartbeats h
                JOIN users u ON u.id = h.user_id
            WHERE
                h.time >= ${date}
            GROUP BY
                u.id,
                u.email
        `

        return results
    }

    static async apiKeyForUser(slackId) {
        const results = await hackatime`
            SELECT
                api_key
            FROM
                users
            WHERE
                id = ${slackId}
        `

        if (results.length === 0) {
            return null
        }

        return results[0].api_key
    }

    static async getHackatimeSummary(slackId, startDate, endDate) {
        const apiKey = await this.apiKeyForUser(slackId)
        if (!apiKey) {
            throw new Error("No API key found for user")
        }

        const url = `https://waka.hackclub.com/api/summary?user=${slackId}&from=${startDate}&to=${endDate}&recompute=true`

        const response = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${apiKey}`
                }
            }
        )

        if (!response.ok) {
            throw new Error(`Failed to fetch Hackatime data: ${response.statusText}`)
        }

        return response.json()
    }
}