interface Env {
  REGISTRATIONS: KVNamespace;
  ADMIN_SECRET: string;
}

const jsonHeaders = { "Content-Type": "application/json" };

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: jsonHeaders,
  });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: jsonHeaders,
  });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return unauthorized();
  }

  const action = url.searchParams.get("action");

  if (action === "list") {
    const allowlist = (await env.REGISTRATIONS.get("library_allowlist", "json")) as string[] | null;
    return json({ allowlist: allowlist || [] });
  }

  if (action === "add") {
    const email = url.searchParams.get("email")?.toLowerCase().trim();
    if (!email) return badRequest("email param required");

    const allowlist = (await env.REGISTRATIONS.get("library_allowlist", "json")) as string[] | null;
    const list = allowlist || [];
    if (!list.includes(email)) {
      list.push(email);
      await env.REGISTRATIONS.put("library_allowlist", JSON.stringify(list));
    }
    return json({ success: true, allowlist: list });
  }

  if (action === "remove") {
    const email = url.searchParams.get("email")?.toLowerCase().trim();
    if (!email) return badRequest("email param required");

    const allowlist = (await env.REGISTRATIONS.get("library_allowlist", "json")) as string[] | null;
    const list = (allowlist || []).filter((e) => e !== email);
    await env.REGISTRATIONS.put("library_allowlist", JSON.stringify(list));
    return json({ success: true, allowlist: list });
  }

  if (action === "requests") {
    const requests = (await env.REGISTRATIONS.get("library_access_requests", "json")) ?? [];
    return json({ requests });
  }

  if (action === "resources") {
    const resources = (await env.REGISTRATIONS.get("library_resources", "json")) ?? [];
    return json({ resources });
  }

  return badRequest("Unknown action. Use: list, add, remove, requests, resources, or set-resources (POST).");
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return unauthorized();
  }

  const action = url.searchParams.get("action");

  if (action === "set-resources") {
    const body = await request.json();
    await env.REGISTRATIONS.put("library_resources", JSON.stringify(body));
    return json({ success: true, resources: body });
  }

  return badRequest("Unknown POST action. Use: set-resources.");
};
