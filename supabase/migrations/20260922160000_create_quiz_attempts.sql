create extension if not exists pgcrypto with schema extensions;

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  submitted_at timestamptz not null default now(),
  student_name text not null check (char_length(student_name) between 1 and 80),
  student_group text not null check (char_length(student_group) between 1 and 60),
  lesson_id smallint not null check (lesson_id between 1 and 50),
  lesson_title text not null check (char_length(lesson_title) between 1 and 160),
  score smallint not null check (score >= 0),
  total smallint not null check (total between 1 and 100 and score <= total),
  percent smallint not null check (percent between 0 and 100),
  duration_seconds integer not null check (duration_seconds between 1 and 86400),
  attempt_id text not null unique check (char_length(attempt_id) between 1 and 80),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  source text not null default 'github-pages'
);

create index quiz_attempts_submitted_at_idx
  on public.quiz_attempts (submitted_at desc);

create index quiz_attempts_group_lesson_idx
  on public.quiz_attempts (student_group, lesson_id);

alter table public.quiz_attempts enable row level security;

revoke all on table public.quiz_attempts from anon, authenticated;
grant all on table public.quiz_attempts to service_role;

comment on table public.quiz_attempts is
  'Private quiz results. Browser clients can only access this table through the submit-quiz Edge Function.';
