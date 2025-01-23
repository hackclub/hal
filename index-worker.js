import { Challenge } from "./models/Challenge";
import { ChallengeParticipant } from "./models/ChallengeParticipant";
import { ChallengeParticipantDailyHackatimeSummary } from "./models/ChallengeParticipantDailyHackatimeSummary";
import { Hackatime } from "./models/Hackatime";
import { sleepUntil } from "./util";

// 1. If we've polled for heartbeats, use the last time we got a Hackatime summary
// 2. If we don't have any Hackatime summaries, use the first start time of a challenge
// 3. If there are no challenges with start times, use the current time
async function calculateWhenToStartHeartbeatsPoll() {
    let lastHeartbeatsPollAt

    lastHeartbeatsPollAt = await ChallengeParticipantDailyHackatimeSummary.lastSuccessfulSummaryAt()

    if (!lastHeartbeatsPollAt) {
        lastHeartbeatsPollAt = await Challenge.firstChallengeStartAt()
    }

    if (!lastHeartbeatsPollAt) {
        lastHeartbeatsPollAt = new Date()
    }

    return lastHeartbeatsPollAt
}

const heartbeatPollInterval = 5 * 1000 // in ms
let lastHeartbeatsPollAt = await calculateWhenToStartHeartbeatsPoll()

while (true) {
    console.log(`Polling for heartbeats since ${lastHeartbeatsPollAt}`)

    const usersWithHeartbeats = await Hackatime.usersWithHeartbeatsSince(lastHeartbeatsPollAt)
    lastHeartbeatsPollAt = new Date()

    console.log(`  ${usersWithHeartbeats.length} users with new heartbeats`)

    for (const user of usersWithHeartbeats) {
        const challengesToRefresh = await ChallengeParticipant.getEligibleForHackatimeRefresh(user.userId)
        if (challengesToRefresh.length === 0) continue

        console.log(`    ${challengesToRefresh.length} challenges to refresh for ${user.userId} (${user.userEmail})`)

        challengesToRefresh.forEach(async challengeParticipant => {
            await challengeParticipant.refreshDailyHackatimeSummaries(user.earliestHeartbeatUtc, user.latestHeartbeatUtc)
        })
    }

    await sleepUntil(new Date(lastHeartbeatsPollAt.getTime() + heartbeatPollInterval))
}