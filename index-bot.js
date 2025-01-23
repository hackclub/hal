import { App } from "@slack/bolt"
import { Challenge } from "./models/Challenge"
import { Person } from "./models/Person"
import { ChallengeTeam } from "./models/ChallengeTeam"
import { ChallengeParticipant } from "./models/ChallengeParticipant"
import { prisma } from "./db"
import { flavortext } from "./util"

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
})

const getHomeView = async (challenges = [], userId, userHandle) => {
    // Get the user's Person record
    const person = await Person.findOrCreateFromSlack(userId, userHandle)
    if (!person) return null

    // Get all teams the person is in
    const participations = await ChallengeParticipant.listByPerson(person.id)
    const teamsByChallenge = {}
    for (const participation of participations) {
        teamsByChallenge[participation.team.challengeId] = participation.team
    }

    // Process all challenges in parallel
    const challengeBlocks = await Promise.all(challenges.map(async challenge => {
        const userTeam = teamsByChallenge[challenge.id]

        // Get team statistics
        const teams = await prisma.challengeTeam.findMany({
            where: { challengeId: challenge.id },
            include: {
                _count: {
                    select: { members: true }
                }
            }
        })

        const teamsWithMinMembers = teams.filter(t => t._count.members >= challenge.challengeMinimumTeamSize)
        const teamsUnderMin = teams.filter(t => t._count.members < challenge.challengeMinimumTeamSize)
        const totalPeopleInCompleteTeams = teamsWithMinMembers.reduce((sum, team) => sum + team._count.members, 0)

        let teamStats
        if (challenge.challengeMinimumTeamSize > 0) {
            const completeTeamText = `${teamsWithMinMembers.length} ${teamsWithMinMembers.length === 1 ? 'team' : 'teams'} registered (${totalPeopleInCompleteTeams} ${totalPeopleInCompleteTeams === 1 ? 'person' : 'people'})`
            teamStats = teamsUnderMin.length > 0 ? 
                `\n${completeTeamText}, ${teamsUnderMin.length} ${teamsUnderMin.length === 1 ? 'team' : 'teams'} still recruiting` :
                `\n${completeTeamText}`
        } else {
            const totalTeams = teams.length
            const totalPeople = teams.reduce((sum, team) => sum + team._count.members, 0)
            teamStats = `\n${totalTeams} ${totalTeams === 1 ? 'team' : 'teams'} total (${totalPeople} ${totalPeople === 1 ? 'person' : 'people'})`
        }

        const blocks = [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${challenge.name}*\n${challenge.state() === 'started' ? '🟢 In Progress' : '🟡 Open for Signups'}\nType: ${challenge.challengeType}\nMinimum Time: ${challenge.challengeMinimumTime} minutes/day${teamStats}`
                }
            }
        ]

        if (userTeam) {
            // User is in a team for this challenge
            const participants = await userTeam.getParticipants()
            const teammates = participants
                .filter(p => p.person.id !== person.id)
                .map(p => `<@${p.person.slackId}>`)
                .join(", ")

            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Your Team*\nTeam Code: \`${userTeam.joinCode}\`${teammates ? `\nTeammates: ${teammates}` : '\nNo teammates yet'}`
                }
            })

            // Add challenge progress if challenge has started
            if (challenge.state() === 'started') {
                const stats = await challenge.getStatsForUser(person.slackId)
                
                // Add daily progress blocks
                for (const day of stats.days) {
                    const participantStats = day.participants.map(p => {
                        const minutes = Math.round(p.timeSeconds / 60)
                        return `<@${p.slackId}>: ${p.status} ${minutes}m`
                    }).join('\n')

                    const teamPlace = day.leaderboard.myTeam.teamPlace
                    const totalTeams = day.leaderboard.myTeam.totalTeams
                    const teamMinutes = Math.round(day.leaderboard.myTeam.teamTimeSeconds / 60)

                    blocks.push(
                        {
                            type: "section",
                            text: {
                                type: "mrkdwn",
                                text: `*${day.title} - ${day.date}*\nTeam Status: ${day.teamStatus}\nTeam Place: ${teamPlace}/${totalTeams} (${teamMinutes}m)\n\n${participantStats}`
                            }
                        },
                        {
                            type: "divider"
                        }
                    )
                }
            }
            
            // Only show team management buttons if challenge hasn't started
            if (challenge.state() !== 'started') {
                blocks.push({
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Switch Teams",
                                emoji: true
                            },
                            action_id: `join_team:${challenge.id}`
                        },
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Leave Team",
                                emoji: true
                            },
                            style: "danger",
                            action_id: `leave_team:${challenge.id}`,
                            confirm: {
                                title: {
                                    type: "plain_text",
                                    text: "Leave Team"
                                },
                                text: {
                                    type: "plain_text",
                                    text: "Are you sure you want to leave this team? If you're the last member, the team will be deleted."
                                },
                                confirm: {
                                    type: "plain_text",
                                    text: "Yes, Leave Team"
                                },
                                deny: {
                                    type: "plain_text",
                                    text: "Cancel"
                                },
                                style: "danger"
                            }
                        }
                    ]
                })
            }
        } else {
            // User is not in a team
            // Only show team creation/joining buttons if challenge hasn't started
            if (challenge.state() !== 'started') {
                blocks.push({
                    type: "actions",
                    elements: [
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Create Team",
                                emoji: true
                            },
                            action_id: `create_team:${challenge.id}`,
                            style: "primary"
                        },
                        {
                            type: "button",
                            text: {
                                type: "plain_text",
                                text: "Join Team With Code",
                                emoji: true
                            },
                            action_id: `join_team:${challenge.id}`
                        }
                    ]
                })
            }
        }

        blocks.push({
            type: "divider"
        })

        return blocks
    }))

    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: `${flavortext()} 👾`,
            emoji: true
        },
        blocks: [
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "Active Challenges",
                    emoji: true
                }
            },
            ...(challenges.length > 0 ? challengeBlocks.flat() : [{
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "_No active challenges at the moment_"
                }
            }]),
            {
                type: "divider"
            },
            {
                type: "header",
                text: {
                    type: "plain_text",
                    text: "Welcome to HAL",
                    emoji: true
                }
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "CHALLENGE BOT!"
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*🎯 Challenges*\nCreate and manage challenges\n_Admin only_"
                },
                accessory: {
                    type: "button",
                    text: {
                        type: "plain_text",
                        text: "Create Challenge",
                        emoji: true
                    },
                    action_id: "open_create_challenge"
                }
            }
        ]
    }
}

app.command("/hal", async ({ command, ack, client }) => {
    await ack()
    const challenges = await Challenge.listActive()
    const view = await getHomeView(challenges, command.user_id, command.user_name)
    if (!view) {
        await client.chat.postEphemeral({
            channel: command.channel_id,
            user: command.user_id,
            text: "An unexpected error occurred. Please contact an administrator."
        })
        return
    }
    await client.views.open({
        trigger_id: command.trigger_id,
        view
    })
})

// Handle the Create Challenge button click
app.action("open_create_challenge", async ({ ack, body, client }) => {
    await ack()
    
    const person = await Person.findOrCreateFromSlack(body.user.id, body.user.name)
    if (!person?.admin) {
        await client.views.update({
            view_id: body.view.id,
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Access Denied ⛔",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "*Sorry, you don't have permission to create challenges.*\nOnly administrators can create new challenges."
                        }
                    },
                    {
                        type: "divider"
                    },
                    {
                        type: "actions",
                        elements: [
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    text: "Back to Home",
                                    emoji: true
                                },
                                action_id: "return_to_home",
                                style: "primary"
                            }
                        ]
                    }
                ]
            }
        })
        return
    }

    await client.views.update({
        view_id: body.view.id,
        view: {
            type: "modal",
            callback_id: "create_challenge_modal",
            title: {
                type: "plain_text",
                text: "Create a New Challenge",
                emoji: true
            },
            submit: {
                type: "plain_text",
                text: "Create Challenge", 
                emoji: true
            },
            blocks: [
                {
                    type: "input",
                    block_id: "challenge_name",
                    element: {
                        type: "plain_text_input",
                        action_id: "name_input",
                        placeholder: {
                            type: "plain_text",
                            text: "Enter a unique challenge name"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Challenge Name"
                    }
                },
                {
                    type: "input",
                    block_id: "challenge_duration",
                    element: {
                        type: "number_input",
                        action_id: "duration_input",
                        is_decimal_allowed: false,
                        min_value: "1",
                        placeholder: {
                            type: "plain_text",
                            text: "Enter number of days"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Challenge Duration (Days)"
                    }
                },
                {
                    type: "input",
                    block_id: "challenge_type",
                    element: {
                        type: "static_select",
                        action_id: "type_input",
                        options: [
                            {
                                text: {
                                    type: "plain_text",
                                    text: "Daily"
                                },
                                value: "DAILY"
                            },
                            {
                                text: {
                                    type: "plain_text", 
                                    text: "Cumulative"
                                },
                                value: "CUMULATIVE"
                            }
                        ]
                    },
                    label: {
                        type: "plain_text",
                        text: "Challenge Type"
                    }
                },
                {
                    type: "input",
                    block_id: "minimum_time",
                    element: {
                        type: "number_input",
                        action_id: "min_time_input",
                        is_decimal_allowed: false,
                        min_value: "1",
                        placeholder: {
                            type: "plain_text",
                            text: "Minutes per day"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Minimum Coding Time (Minutes/Day)"
                    }
                },
                {
                    type: "input",
                    block_id: "editor_constraint",
                    optional: true,
                    element: {
                        type: "plain_text_input",
                        action_id: "editor_input",
                        placeholder: {
                            type: "plain_text",
                            text: "Enter editor regex (e.g. Godot)"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Editor Constraint (Optional)"
                    }
                },
                {
                    type: "input", 
                    block_id: "language_constraint",
                    optional: true,
                    element: {
                        type: "plain_text_input",
                        action_id: "language_input",
                        placeholder: {
                            type: "plain_text",
                            text: "Enter language regex (e.g. Rust)"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Language Constraint (Optional)"
                    }
                },
                {
                    type: "input",
                    block_id: "minimum_team_size",
                    element: {
                        type: "number_input",
                        action_id: "team_size_input",
                        is_decimal_allowed: false,
                        min_value: "0",
                        initial_value: "0",
                        placeholder: {
                            type: "plain_text",
                            text: "Enter minimum team size"
                        }
                    },
                    label: {
                        type: "plain_text",
                        text: "Minimum Team Size"
                    }
                }
            ]
        }
    })
})

app.view("create_challenge_modal", async ({ ack, body, view, client }) => {
    // Double-check admin status on submission too
    const person = await Person.findOrCreateFromSlack(body.user.id, body.user.name)
    if (!person?.admin) {
        await ack({
            response_action: "update",
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Access Denied ⛔",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "*Sorry, you don't have permission to create challenges.*\nOnly administrators can create new challenges."
                        }
                    },
                    {
                        type: "divider"
                    },
                    {
                        type: "actions",
                        elements: [
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    text: "Back to Home",
                                    emoji: true
                                },
                                action_id: "return_to_home",
                                style: "primary"
                            }
                        ]
                    }
                ]
            }
        })
        return
    }

    const values = view.state.values
    const name = values.challenge_name.name_input.value
    const duration = parseInt(values.challenge_duration.duration_input.value)
    const challengeType = values.challenge_type.type_input.selected_option.value
    const minimumTime = parseInt(values.minimum_time.min_time_input.value)
    const editorConstraint = values.editor_constraint.editor_input?.value || null
    const languageConstraint = values.language_constraint.language_input?.value || null
    const minimumTeamSize = parseInt(values.minimum_team_size.team_size_input.value)

    try {
        const challenge = await Challenge.create({
            name,
            challengeType,
            challengeMinimumTime: minimumTime,
            challengeEditorConstraint: editorConstraint,
            challengeLanguageConstraint: languageConstraint,
            challengeMinimumTeamSize: minimumTeamSize
        })

        // Show success modal and return to home
        await ack({
            response_action: "update",
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Success! 🎉"
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Challenge "${challenge.name}" has been created!*\n\n• Type: ${challengeType}\n• Duration: ${duration} days\n• Minimum Time: ${minimumTime} minutes/day`
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "The challenge is ready for signups. You can start it later using the start command."
                        }
                    },
                    {
                        type: "divider"
                    },
                    {
                        type: "actions",
                        elements: [
                            {
                                type: "button",
                                text: {
                                    type: "plain_text",
                                    text: "Back to Home",
                                    emoji: true
                                },
                                action_id: "return_to_home",
                                style: "primary"
                            }
                        ]
                    }
                ]
            }
        })
    } catch (error) {
        // Show error modal
        await ack({
            response_action: "push",
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Error ❌"
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Failed to create challenge*\n\nError: ${error.message}`
                        }
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Close"
                }
            }
        })
    }
})

// Handle return to home button
app.action("return_to_home", async ({ ack, body, client }) => {
    await ack()
    const challenges = await Challenge.listActive()
    const view = await getHomeView(challenges, body.user.id, body.user.name)
    if (!view) {
        await client.views.update({
            view_id: body.view.id,
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Error ❌",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "Error: Could not find your user record. Please contact an administrator."
                        }
                    }
                ]
            }
        })
        return
    }
    await client.views.update({
        view_id: body.view.id,
        view
    })
})

// Handle Create Team button
app.action(/create_team:.+/, async ({ ack, body, client }) => {
    await ack()
    const challengeId = parseInt(body.actions[0].action_id.split(':')[1])
    
    try {
        const challenge = await Challenge.findById(challengeId)
        if (!challenge) {
            throw new Error("Challenge not found")
        }

        if (challenge.state() === 'started') {
            throw new Error("Cannot create teams after the challenge has started")
        }

        const person = await Person.findOrCreateFromSlack(body.user.id, body.user.name)
        if (!person) {
            throw new Error("An unexpected error occurred")
        }

        // Get user's timezone from Slack
        const userInfo = await client.users.info({
            user: body.user.id
        })

        if (!userInfo.ok) {
            throw new Error("Could not fetch your timezone information")
        }

        const team = await ChallengeTeam.create(challengeId, person.id, userInfo.user.tz)
        
        await client.views.update({
            view_id: body.view.id,
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Team Created! 🎉",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Your team for "${challenge.name}" has been created!*`
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Share this code with others to let them join your team:\n\n*\`${team.joinCode}\`*`
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Important:* Your challenge activity will be tracked in your current timezone (${userInfo.user.tz_label}). All stats and deadlines for this challenge will be based on this timezone.`
                        }
                    },
                    {
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: "The code is case-insensitive"
                            }
                        ]
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Done",
                    emoji: true
                }
            }
        })
    } catch (error) {
        await client.views.update({
            view_id: body.view.id,
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Error ❌",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Failed to create team: ${error.message}`
                        }
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Close",
                    emoji: true
                }
            }
        })
    }
})

// Handle Join Team button
app.action(/join_team:.+/, async ({ ack, body, client }) => {
    await ack()
    const challengeId = parseInt(body.actions[0].action_id.split(':')[1])
    
    try {
        const challenge = await Challenge.findById(challengeId)
        if (!challenge) {
            throw new Error("Challenge not found")
        }

        if (challenge.state() === 'started') {
            throw new Error("Cannot join teams after the challenge has started")
        }

        // Create person record if it doesn't exist
        await Person.findOrCreateFromSlack(body.user.id, body.user.name)
        
        await client.views.push({
            trigger_id: body.trigger_id,
            view: {
                type: "modal",
                callback_id: "join_team_modal",
                private_metadata: String(challengeId),
                title: {
                    type: "plain_text",
                    text: "Join a Team",
                    emoji: true
                },
                submit: {
                    type: "plain_text",
                    text: "Join Team",
                    emoji: true
                },
                blocks: [
                    {
                        type: "input",
                        block_id: "team_code",
                        element: {
                            type: "plain_text_input",
                            action_id: "code_input",
                            placeholder: {
                                type: "plain_text",
                                text: "Enter the team code"
                            }
                        },
                        label: {
                            type: "plain_text",
                            text: "Team Code"
                        }
                    }
                ]
            }
        })
    } catch (error) {
        await ack({
            response_action: "errors",
            errors: {
                team_code: error.message
            }
        })
    }
})

// Handle Join Team modal submission
app.view("join_team_modal", async ({ ack, body, view, client }) => {
    const challengeId = parseInt(view.private_metadata)
    const teamCode = view.state.values.team_code.code_input.value.toUpperCase()
    
    try {
        const person = await Person.findOrCreateFromSlack(body.user.id, body.user.name)
        if (!person) {
            throw new Error("Could not find or create your user record")
        }

        const challenge = await Challenge.findById(challengeId)
        if (!challenge) {
            throw new Error("Challenge not found")
        }

        const newTeam = await ChallengeTeam.findByCode(challengeId, teamCode)
        if (!newTeam) {
            throw new Error("Team not found. Please check the code and try again")
        }

        // Start a transaction for team switching
        const userInfo = await client.users.info({
            user: body.user.id
        })

        if (!userInfo.ok) {
            throw new Error("Could not fetch your timezone information")
        }

        const timezone = userInfo.user.tz

        await prisma.$transaction(async (tx) => {
            // Find current participation if any
            const currentParticipation = await tx.challengeParticipant.findFirst({
                where: {
                    personId: person.id,
                    team: {
                        challengeId
                    }
                },
                include: {
                    team: true
                }
            })

            // If already in this team, no need to switch
            if (currentParticipation?.team.joinCode === teamCode) {
                throw new Error("You're already in this team!")
            }

            // If in another team, delete current participation
            if (currentParticipation) {
                // Delete the participation
                await tx.challengeParticipant.delete({
                    where: {
                        id: currentParticipation.id
                    }
                })

                // Check if old team is now empty
                const remainingParticipants = await tx.challengeParticipant.count({
                    where: {
                        teamId: currentParticipation.team.id
                    }
                })

                // If team is empty, delete it
                if (remainingParticipants === 0) {
                    await tx.challengeTeam.delete({
                        where: {
                            id: currentParticipation.team.id
                        }
                    })
                }
            }

            // Create new participation with timezone
            await tx.challengeParticipant.create({
                data: {
                    teamId: newTeam.id,
                    personId: person.id,
                    timezone
                }
            })
        })

        // Show success view
        const participants = await prisma.challengeParticipant.findMany({
            where: {
                teamId: newTeam.id
            },
            include: {
                person: true
            }
        })

        const teammates = participants
            .filter(p => p.person.id !== person.id)
            .map(p => `<@${p.person.slackId}>`)
            .join(", ")

        await ack({
            response_action: "update",
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Success! 🎉",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `You've successfully joined the team!`
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: teammates ? `*Your Teammates:*\n${teammates}` : "*No other teammates yet*"
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Team Code:* \`${newTeam.joinCode}\``
                        }
                    },
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `*Important:* Your challenge activity will be tracked in your current timezone (${userInfo.user.tz_label}). All stats and deadlines for this challenge will be based on this timezone.`
                        }
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Done",
                    emoji: true
                }
            }
        })
    } catch (error) {
        await ack({
            response_action: "errors",
            errors: {
                team_code: error.message
            }
        })
    }
})

// Handle Leave Team button
app.action(/leave_team:.+/, async ({ ack, body, client }) => {
    await ack()
    const challengeId = parseInt(body.actions[0].action_id.split(':')[1])
    
    try {
        const challenge = await Challenge.findById(challengeId)
        if (!challenge) {
            throw new Error("Challenge not found")
        }

        if (challenge.state() === 'started') {
            throw new Error("Cannot leave teams after the challenge has started")
        }

        const person = await Person.findOrCreateFromSlack(body.user.id, body.user.username)
        if (!person) {
            throw new Error("Could not find your user record")
        }

        // Start a transaction for leaving team
        await prisma.$transaction(async (tx) => {
            // Find current participation
            const currentParticipation = await tx.challengeParticipant.findFirst({
                where: {
                    personId: person.id,
                    team: {
                        challengeId
                    }
                },
                include: {
                    team: true
                }
            })

           if (!currentParticipation) {
                throw new Error("You're not in a team for this challenge")
            }

            // Delete the participation
            await tx.challengeParticipant.delete({
                where: {
                    id: currentParticipation.id
                }
            })

            // Check if team is now empty
            const remainingParticipants = await tx.challengeParticipant.count({
                where: {
                    teamId: currentParticipation.team.id
                }
            })

            // If team is empty, delete it
            if (remainingParticipants === 0) {
                await tx.challengeTeam.delete({
                    where: {
                        id: currentParticipation.team.id
                    }
                })
            }
        })

        // Return to home view with success message
        const challenges = await Challenge.listActive()
        const view = await getHomeView(challenges, body.user.id, body.user.username)
        if (!view) {
            throw new Error("Could not load home view")
        }

        // Add success message at the top
        view.blocks.unshift(
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "✅ You've successfully left the team!"
                }
            },
            {
                type: "divider"
            }
        )

        await client.views.update({
            view_id: body.view.id,
            hash: body.view.hash,  // Add hash to prevent race conditions
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Success! 🎉",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: "✅ You've successfully left the team!"
                        }
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Done",
                    emoji: true
                }
            }
        })
    } catch (error) {
        await client.views.update({
            view_id: body.view.id,
            hash: body.view.hash,  // Add hash to prevent race conditions
            view: {
                type: "modal",
                title: {
                    type: "plain_text",
                    text: "Error ❌",
                    emoji: true
                },
                blocks: [
                    {
                        type: "section",
                        text: {
                            type: "mrkdwn",
                            text: `Failed to leave team: ${error.message}`
                        }
                    }
                ],
                close: {
                    type: "plain_text",
                    text: "Close",
                    emoji: true
                }
            }
        })
    }
})

await app.start()
app.logger.info(`⚡️ Bolt app is running!`)