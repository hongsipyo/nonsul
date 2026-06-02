import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_PROJECTS = [
  {
    name: "nonsul",
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  },
  {
    name: "dajeong",
    url: process.env.DAJEONG_SUPABASE_URL!,
    anonKey: process.env.DAJEONG_SUPABASE_ANON_KEY!,
  },
];

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled(
    SUPABASE_PROJECTS.map(async (project) => {
      const supabase = createClient(project.url, project.anonKey);
      const { error } = await supabase.from("_keep_alive_ping").select("*").limit(1);
      // Table doesn't need to exist — the request itself generates activity
      return { name: project.name, success: true, error: error?.message };
    })
  );

  return NextResponse.json({
    pingedAt: new Date().toISOString(),
    results: results.map((r) => (r.status === "fulfilled" ? r.value : { error: r.reason })),
  });
}
