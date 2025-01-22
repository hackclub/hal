import { Person } from "../models/Person"

const Router = {
    middleware: [],
    use(fn) {
        this.middleware.push(fn)
    },
    "challenge create": function(body, args) {
        return {
            "response_type": "ephemeral", 
            "text": "Creating a challenge!"
        }
    },
    "team (.+)": function(body, args) {
        console.log(body, args)
        return {
            "response_type": "ephemeral", 
            "text": "Hello, world!"
        }
    }
}

// Load the Person model, creating a record for them if they don't exist, so we
// can do things like check if they're an admin.
Router.use(async (body) => {
    let person = await Person.findBySlackId(body.user_id)
    if (!person) {
        person = await Person.create({
            slackId: body.user_id,
            slackHandle: body.user_name
        })
    }
    body.person = person
})

// Routes Slack slash commands to the appropriate handler based on the command
// text pattern. Each pattern in Router is matched against the text, and if
// found, calls the corresponding handler
export default async function(body) {
    for (const [pattern, handler] of Object.entries(Router)) {
        // Skip middleware property/method
        if (pattern === 'middleware' || pattern === 'use') continue

        // Add ^\\s* automatically to each pattern
        const fullPattern = `^\\s*${pattern}`
        const match = body.text.match(new RegExp(fullPattern))
        if (match) {
            // match[0] is full match, match[1] onwards are capture groups
            const args = match.slice(1)
            
            // Run all middleware functions in order
            for (const fn of Router.middleware) {
                await fn(body)
            }

            return handler(body, ...args)
        }
    }

    return {
        "response_type": "ephemeral",
        "text": "Command not found"
    }
}