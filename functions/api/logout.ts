export const onRequestGet: PagesFunction = async () => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/",
      "Set-Cookie":
        "studio_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    },
  });
};
