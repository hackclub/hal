import { App } from "@slack/bolt"
import { Challenge } from "./models/Challenge"
import { Person } from "./models/Person"
import { ChallengeTeam } from "./models/ChallengeTeam"
import { ChallengeParticipant } from "./models/ChallengeParticipant"

const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
})

const getHomeView = async (challenges = [], userId) => {
    // Get the user's Person record
    const person = await Person.findOrCreateFromSlack(userId, userId)
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
        const blocks = [
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*${challenge.name}*\n${challenge.state() === 'started' ? '🟢 In Progress' : '🟡 Open for Signups'}\nType: ${challenge.challengeType}\nMinimum Time: ${challenge.challengeMinimumTime} minutes/day`
                }
            }
        ]

        if (userTeam) {
            // User is in a team for this challenge
            const participants = await userTeam.getParticipants()
            const teammates = participants
                .filter(p => p.person.id !== person.id)
                .map(p => p.person.slackHandle)
                .join(", ")

            blocks.push({
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: `*Your Team*\nTeam Code: \`${userTeam.joinCode}\`${teammates ? `\nTeammates: ${teammates}` : '\nNo teammates yet'}`
                }
            })
        } else {
            // User is not in a team
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

        blocks.push({
            type: "divider"
        })

        return blocks
    }))

    return {
        type: "modal",
        title: {
            type: "plain_text",
            text: "HAL 👾",
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
                    text: "HAL helps you create and manage coding challenges in your Hack Club community."
                }
            },
            {
                type: "divider"
            },
            {
                type: "section",
                text: {
                    type: "mrkdwn",
                    text: "*🎯 Challenges*\nCreate and manage coding challenges\n_Admin only: Create new challenges_"
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
    const view = await getHomeView(challenges, command.user_id)
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
    
    const person = await Person.findOrCreateFromSlack(body.user.id, body.user.username)
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
    const person = await Person.findOrCreateFromSlack(body.user.id, body.user.username)
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
    const view = await getHomeView(challenges, body.user.id)
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

        const person = await Person.findOrCreateFromSlack(body.user.id, body.user.username)
        if (!person) {
            throw new Error("An unexpected error occurred")
        }

        const team = await ChallengeTeam.create(challengeId, person.id)
        
        await client.views.push({
            trigger_id: body.trigger_id,
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
                        type: "context",
                        elements: [
                            {
                                type: "mrkdwn",
                                text: "The code is case-insensitive"
                            }
                        ]
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
        await client.views.push({
            trigger_id: body.trigger_id,
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
    }
})

// Handle Join Team button
app.action(/join_team:.+/, async ({ ack, body, client }) => {
    await ack()
    const challengeId = parseInt(body.actions[0].action_id.split(':')[1])
    
    // Create person record if it doesn't exist
    await Person.findOrCreateFromSlack(body.user.id, body.user.username)
    
    await client.views.push({
        trigger_id: body.trigger_id,
        view: {
            type: "modal",
            callback_id: "join_team_modal",
            private_metadata: challengeId,
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
})

await app.start()
app.logger.info(`⚡️ Bolt app is running!`)