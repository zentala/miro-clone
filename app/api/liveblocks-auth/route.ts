// Hosted collaboration is retired in the single-user application.
export async function POST() {
    return new Response("Hosted collaboration is not available", { status: 410 });
}
