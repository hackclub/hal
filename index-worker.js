// helper function to get active challenges and challenges that have ended in
// the past 7 days for a given person
//
// should return:
// [
//   {
//     challenge: Challenge,
//     challengeParticipant: ChallengeParticipant
//   }
// ]
//
// challengesToRefreshForSlackId(slackId)



// Every 30 seconds, poll for users with new heartbeats
// For each person, get challengesToRefreshForSlackId
// For each challenge, make a request to /compat/wakatime/v1/users/{user}/summaries (timezone can be passed in as part of date)
//   - The appropriate filters can be passed in as part of the request (ex. Godot for editor)
// Create a new ChallengeParticipantDailySummary and save it

import { ChallengeParticipant } from "./models/ChallengeParticipant";
import { Hackatime } from "./models/Hackatime";
import { sleepUntil } from "./util";

// 30 seconds
const heartbeatPollInterval = 5 * 1000
// 5 minutes ago
let lastHeartbeatsPollAt = new Date(Date.now() - 15 * 60 * 1000)

while (true) {
    const usersWithHeartbeats = await Hackatime.usersWithHeartbeatsSince(lastHeartbeatsPollAt)
    lastHeartbeatsPollAt = new Date()

    for (const user of usersWithHeartbeats) {
        const challengesToRefresh = await ChallengeParticipant.getEligibleForHackatimeRefresh(user.userId)

        challengesToRefresh.forEach(async challengeParticipant => {
            console.log(challengeParticipant)

            await challengeParticipant.refreshDailyHackatimeSummaries(user.earliestHeartbeatUtc, user.latestHeartbeatUtc)
        })
    }

    await sleepUntil(new Date(lastHeartbeatsPollAt.getTime() + heartbeatPollInterval))
}