interface Env {
  REGISTRATIONS: KVNamespace;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str: string): string {
  return str.trim().slice(0, 500);
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://knuppel.co",
};

async function sendNotification(env: Env, name: string, email: string) {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) return;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Mock Trial <noreply@knuppel.co>",
      to: [env.NOTIFICATION_EMAIL],
      subject: `Library Access Request: ${name}`,
      text: [
        `New library access request:`,
        ``,
        `Name: ${name}`,
        `Email: ${email}`,
        ``,
        `To approve, run:`,
        `curl "https://knuppel.co/api/library-admin?secret=YOUR_SECRET&action=add&email=${encodeURIComponent(email)}"`,
      ].join("\n"),
    }),
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const data = (await request.json()) as { email?: string; name?: string };

    if (!data.name || !data.email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required." }),
        { status: 400, headers: corsHeaders }
      );
    }

    if (!validateEmail(data.email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const requestEntry = {
      name: sanitize(data.name),
      email: sanitize(data.email).toLowerCase(),
      timestamp: new Date().toISOString(),
    };

    const existing = (await env.REGISTRATIONS.get("library_access_requests", "json")) as any[] | null;
    const requests = existing || [];
    requests.push(requestEntry);
    await env.REGISTRATIONS.put("library_access_requests", JSON.stringify(requests));

    context.waitUntil(sendNotification(env, requestEntry.name, requestEntry.email));

    return new Response(
      JSON.stringify({ success: true, message: "Your request has been submitted. You'll receive access once approved." }),
      { status: 200, headers: corsHeaders }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: corsHeaders }
    );
  }
};

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "https://knuppel.co",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
};
