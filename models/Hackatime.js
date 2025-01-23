import { hackatime } from '../db'

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
}