import { NextRequest, NextResponse } from "next/server";
import { getTokenFromCookie, verifyToken } from "@/lib/auth";
import { getMealsByUser } from "@/lib/db";

const CSV_HEADERS = ["date", "time", "mealType", "dish", "description", "portion_g", "kcal", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g", "salt_g", "source"];

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const token = getTokenFromCookie(req.headers.get("cookie"));
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const format = (new URL(req.url).searchParams.get("format") || "csv").toLowerCase();
  const meals = await getMealsByUser(payload.userId);
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "json") {
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), count: meals.length, meals }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="fitcal-meals-${stamp}.json"`,
      },
    });
  }

  const rows = [CSV_HEADERS.join(",")];
  for (const m of meals) {
    rows.push(
      [
        m.date,
        new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        m.mealType,
        csvEscape(m.dish),
        csvEscape(m.description),
        m.portion_g,
        m.kcal,
        m.protein,
        m.carbs,
        m.fat,
        m.fiber,
        m.sugar,
        m.salt,
        m.source ?? "ai",
      ].join(",")
    );
  }
  // BOM for Excel compatibility with diacritics
  return new NextResponse("\uFEFF" + rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitcal-meals-${stamp}.csv"`,
    },
  });
}
