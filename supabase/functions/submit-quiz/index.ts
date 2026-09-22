import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://sajidaturseb.github.io",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
]);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://sajidaturseb.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-teacher-pin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function respond(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), "Content-Type": "application/json; charset=utf-8" },
  });
}

function text(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function integer(value: unknown, min: number, max: number) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < min || number > max) throw new Error("invalid_number");
  return number;
}

function normalizeAttempt(raw: Record<string, unknown>) {
  const studentName = text(raw.studentName, 80);
  const studentGroup = text(raw.group, 60);
  const lessonTitle = text(raw.lessonTitle, 160);
  const attemptId = text(raw.attemptId, 80);
  const lessonId = integer(raw.lessonId, 1, 50);
  const score = integer(raw.score, 0, 100);
  const total = integer(raw.total, 1, 100);
  const durationSeconds = integer(raw.durationSeconds, 1, 86400);

  if (!studentName || !studentGroup || !lessonTitle || !attemptId || score > total) {
    throw new Error("invalid_attempt");
  }

  const rawAnswers = Array.isArray(raw.answers) ? raw.answers.slice(0, 100) : [];
  const answers = rawAnswers.map((item) => {
    const answer = item as Record<string, unknown>;
    return {
      number: integer(answer.number, 1, 100),
      selected: text(answer.selected, 4),
      correct: text(answer.correct, 4),
      isCorrect: Boolean(answer.isCorrect),
    };
  });

  return {
    student_name: studentName,
    student_group: studentGroup,
    lesson_id: lessonId,
    lesson_title: lessonTitle,
    score,
    total,
    percent: Math.round((score / total) * 100),
    duration_seconds: durationSeconds,
    attempt_id: attemptId,
    answers,
  };
}

async function listResults(request: Request) {
  const teacherPin = Deno.env.get("TEACHER_PIN") ?? "";
  const suppliedPin = request.headers.get("x-teacher-pin") ?? "";
  if (!teacherPin || suppliedPin !== teacherPin) {
    return respond(request, { ok: false, error: "invalid_pin" }, 401);
  }

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("submitted_at,student_name,student_group,lesson_id,lesson_title,score,total,percent,duration_seconds,attempt_id,answers")
    .order("submitted_at", { ascending: false })
    .limit(5000);

  if (error) {
    console.error(error);
    return respond(request, { ok: false, error: "database_error" }, 500);
  }
  return respond(request, { ok: true, results: data });
}

async function submitResult(request: Request, raw: Record<string, unknown>) {
  let record;
  try {
    record = normalizeAttempt(raw);
  } catch {
    return respond(request, { ok: false, error: "invalid_request" }, 400);
  }

  const { error } = await supabase.from("quiz_attempts").upsert(record, {
    onConflict: "attempt_id",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error(error);
    return respond(request, { ok: false, error: "database_error" }, 500);
  }
  return respond(request, { ok: true }, 201);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }
  if (request.method !== "POST") {
    return respond(request, { ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return respond(request, { ok: false, error: "invalid_json" }, 400);
  }

  if (body.action === "list") return await listResults(request);
  return await submitResult(request, body);
});
