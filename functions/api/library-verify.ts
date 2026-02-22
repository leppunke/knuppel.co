interface Env {
  REGISTRATIONS: KVNamespace;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "https://knuppel.co",
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  try {
    const data = (await request.json()) as { email?: string };

    if (!data.email || !validateEmail(data.email)) {
      return new Response(
        JSON.stringify({ error: "Please enter a valid email address." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const email = data.email.toLowerCase().trim();

    const allowlist = (await env.REGISTRATIONS.get("library_allowlist", "json")) as string[] | null;

    if (!allowlist || !allowlist.includes(email)) {
      return new Response(
        JSON.stringify({ error: "This email is not on the access list." }),
        { status: 403, headers: corsHeaders }
      );
    }

    const resources = (await env.REGISTRATIONS.get("library_resources", "json")) ?? [];

    return new Response(
      JSON.stringify({ success: true, resources }),
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
