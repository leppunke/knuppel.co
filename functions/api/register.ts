interface Env {
  REGISTRATIONS: KVNamespace;
  RESEND_API_KEY?: string;
  NOTIFICATION_EMAIL?: string;
}

interface RegistrationData {
  name: string;
  email: string;
  role: "student" | "parent";
  grade?: string;
  message?: string;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str: string): string {
  return str.trim().slice(0, 500);
}

async function sendNotification(env: Env, reg: RegistrationData) {
  if (!env.RESEND_API_KEY || !env.NOTIFICATION_EMAIL) return;

  const roleLabel = reg.role === "student" ? `Student${reg.grade ? ` (${reg.grade})` : ""}` : "Parent";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Mock Trial <noreply@knuppel.co>",
      to: [env.NOTIFICATION_EMAIL],
      subject: `New Mock Trial Registration: ${reg.name}`,
      text: [
        `New registration for Urban School Mock Trial:`,
        ``,
        `Name: ${reg.name}`,
        `Email: ${reg.email}`,
        `Role: ${roleLabel}`,
        reg.message ? `Message: ${reg.message}` : null,
        ``,
        `View all registrations at: https://knuppel.co/api/registrations`,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "https://knuppel.co",
  };

  try {
    const data = (await request.json()) as Partial<RegistrationData>;

    // Validate required fields
    if (!data.name || !data.email || !data.role) {
      return new Response(
        JSON.stringify({ error: "Name, email, and role are required." }),
        { status: 400, headers }
      );
    }

    if (!validateEmail(data.email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers }
      );
    }

    if (!["student", "parent"].includes(data.role)) {
      return new Response(
        JSON.stringify({ error: "Role must be student or parent." }),
        { status: 400, headers }
      );
    }

    const registration = {
      name: sanitize(data.name),
      email: sanitize(data.email),
      role: data.role,
      grade: data.grade ? sanitize(data.grade) : null,
      message: data.message ? sanitize(data.message) : null,
      timestamp: new Date().toISOString(),
    };

    // Check for duplicate email
    const existingIndex = await env.REGISTRATIONS.get("_index", "json") as string[] | null;
    if (existingIndex) {
      for (const id of existingIndex) {
        const existing = await env.REGISTRATIONS.get(id, "json") as any;
        if (existing && existing.email.toLowerCase() === registration.email.toLowerCase()) {
          return new Response(
            JSON.stringify({ error: "This email is already registered." }),
            { status: 409, headers }
          );
        }
      }
    }

    // Store registration
    const id = `reg_${Date.now()}`;
    await env.REGISTRATIONS.put(id, JSON.stringify(registration));

    // Update index
    const index = existingIndex || [];
    index.push(id);
    await env.REGISTRATIONS.put("_index", JSON.stringify(index));

    // Send email notification (non-blocking)
    context.waitUntil(sendNotification(env, registration as RegistrationData));

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers }
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
