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
// If challengesToRefreshForSlackId returns a challenge, create a
// PersonHackatimeRefreshJob if one doesn't already exist

// Every 10 seconds, poll for PersonHackatimeRefreshJobs that are ready to be run
// For each person, get challengesToRefreshForSlackId
// For each challenge, make a request to /compat/wakatime/v1/users/{user}/summaries (timezone can be passed in as part of date)
//   - The appropriate filters can be passed in as part of the request (ex. Godot for editor)
// Create a new ChallengeParticipantDailySummary and save it