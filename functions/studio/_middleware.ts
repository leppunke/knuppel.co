interface Env {
  AUTH_SECRET: string;
}

function parseCookie(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

async function verifySession(
  token: string,
  secret: string
): Promise<boolean> {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return false;

  const timestamp = token.slice(0, dotIndex);
  const sigB64 = token.slice(dotIndex + 1);

  // Check token age (30 days max)
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > 30 * 24 * 60 * 60 * 1000) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));

  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    new TextEncoder().encode(`studio:${timestamp}`)
  );
}

export const onRequest: PagesFunction<Env> = async ({ request, env, next }) => {
  if (!env.AUTH_SECRET) {
    return new Response("Auth not configured", { status: 500 });
  }

  const cookieHeader = request.headers.get("Cookie") || "";
  const token = parseCookie(cookieHeader, "studio_session");

  if (!token) {
    const url = new URL(request.url);
    return Response.redirect(
      `${url.origin}/login?redirect=${encodeURIComponent(url.pathname)}`,
      302
    );
  }

  const valid = await verifySession(token, env.AUTH_SECRET);

  if (!valid) {
    const url = new URL(request.url);
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/login?redirect=${encodeURIComponent(url.pathname)}`,
        "Set-Cookie":
          "studio_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      },
    });
  }

  return next();
};
