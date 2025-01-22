const Router = {
    "team (.+)": function(body, args) {
        console.log(body, args)
        return {
            "response_type": "ephemeral",
            "text": "Hello, world!"
        }
    }
}

// Routes Slack slash commands to the appropriate handler based on the command
// text pattern. Each pattern in Router is matched against the text, and if
// found, calls the corresponding handler
export default function(body) {
    for (const [pattern, handler] of Object.entries(Router)) {
        // Add ^\\s* automatically to each pattern
        const fullPattern = `^\\s*${pattern}`
        const match = body.text.match(new RegExp(fullPattern))
        if (match) {
            // match[0] is full match, match[1] onwards are capture groups
            const args = match.slice(1)
            return handler(body, ...args)
        }
    }

    return {
        "response_type": "ephemeral", 
        "text": "Command not found"
    }
}