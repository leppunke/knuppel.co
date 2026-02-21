interface Env {
  REGISTRATIONS: KVNamespace;
  ADMIN_SECRET: string;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");

  if (!env.ADMIN_SECRET || secret !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const index = (await env.REGISTRATIONS.get("_index", "json")) as
    | string[]
    | null;

  if (!index || index.length === 0) {
    return new Response(
      JSON.stringify({ count: 0, registrations: [] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  const registrations = await Promise.all(
    index.map((id) => env.REGISTRATIONS.get(id, "json"))
  );

  const format = url.searchParams.get("format");

  if (format === "csv") {
    const csv = [
      "Name,Email,Role,Grade,Message,Timestamp",
      ...registrations
        .filter(Boolean)
        .map((r: any) =>
          [r.name, r.email, r.role, r.grade || "", r.message || "", r.timestamp]
            .map((f) => `"${String(f).replace(/"/g, '""')}"`)
            .join(",")
        ),
    ].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=registrations.csv",
      },
    });
  }

  return new Response(
    JSON.stringify({
      count: registrations.filter(Boolean).length,
      registrations: registrations.filter(Boolean),
    }),
    { headers: { "Content-Type": "application/json" } }
  );
};
