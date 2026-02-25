interface Env {
  STUDIO_PASSWORD_HASH: string; // format: base64(salt):base64(hash)
  AUTH_SECRET: string;
}

async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(":");
  if (!saltB64 || !hashB64) return false;

  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256
  );

  const derivedHash = new Uint8Array(derivedBits);

  if (derivedHash.length !== expectedHash.length) return false;
  let match = 0;
  for (let i = 0; i < derivedHash.length; i++) {
    match |= derivedHash[i] ^ expectedHash[i];
  }
  return match === 0;
}

async function createSessionToken(secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`studio:${timestamp}`)
  );
  const sigB64 = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  );
  return `${timestamp}.${sigB64}`;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const headers = { "Content-Type": "application/json" };

  if (!env.STUDIO_PASSWORD_HASH || !env.AUTH_SECRET) {
    return new Response(
      JSON.stringify({ error: "Auth not configured." }),
      { status: 500, headers }
    );
  }

  try {
    const { password } = (await request.json()) as { password?: string };

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required." }),
        { status: 400, headers }
      );
    }

    const valid = await verifyPassword(password, env.STUDIO_PASSWORD_HASH);

    if (!valid) {
      return new Response(
        JSON.stringify({ error: "Invalid password." }),
        { status: 401, headers }
      );
    }

    const token = await createSessionToken(env.AUTH_SECRET);
    const maxAge = 30 * 24 * 60 * 60; // 30 days

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `studio_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`,
      },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Something went wrong." }),
      { status: 500, headers }
    );
  }
};
