Hal is a Hack Club Slack bot to create and participate in Hackatime challenges.

Example: Work on your Godot game for at least 15 minutes per day for 1 week to earn a limited edition sticker.

## Data Model

Sailor’s Challenge

Challenge types:

- Daily - Code a minimum of X minutes / hours per day in a given language or editor by the end
- Cumulative - Code a total of X minutes / hours by the end

Challenges
- createdAt
- name
- States: openForSignUps, started, ended
- startedTime
- endedTime
- challengeType: daily or cumulative
- challengeMinimumTime: 15
- challengeEditorContraint: Godot
- challengeLanguageConstraint: Rust
- challengeMinimumTeamSize:

ChallengeTeam
- Challenge
- ChallengeParticipant

ChallengeParticipant
- Team
- Person

ParticipantDailyHackatimeSummary
- ParticipatingMember
- fromDate
- toDate
- json

Person
- slackId
- slackHandle
- slackJson
