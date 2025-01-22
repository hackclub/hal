import router from "./slack/router";

const server = Bun.serve({
    port: process.env.PORT || 3000,
    async fetch(req) {
        const url = new URL(req.url);

        // Handle slash command endpoint
        if (url.pathname === '/slack/slash-command' && req.method === 'POST') {
            const formData = await req.formData();
            const body = Object.fromEntries(formData.entries());

            const resp = router(body)

            return Response.json(resp)
        }

        // Handle 404 for other routes
        return new Response('Not Found', { status: 404 });
    },
});

export function createServer() {
    return server;
}

// Log server start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    console.log(`Listening on http://localhost:${server.port}`);
} 