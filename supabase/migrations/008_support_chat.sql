-- ════════════════════════════════════════════════════════════════════
-- FirstGear KAM Onboarding Compass — 008 KAM support chat
--
-- One support thread per KAM, shared by the KAM, their Mentor and HR.
-- Messages can be sent during the first SUPPORT_CHAT_DAYS of onboarding
-- (default 15, HR-editable); the window is enforced by the service layer,
-- and the thread stays readable afterwards. Row Level Security limits every
-- read and write to the thread's participants. Idempotent.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.chat_threads (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null unique references public.employees(id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz
);

create table if not exists public.chat_messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references public.chat_threads(id) on delete cascade,
  employee_id  uuid not null references public.employees(id) on delete cascade,
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  sender_role  text not null check (sender_role in ('KAM','MENTOR','HR_ADMIN')),
  body         text not null check (char_length(btrim(body)) between 1 and 2000),
  context_ref  text,            -- training step (task code) the message is about, if any
  created_at   timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages(thread_id, created_at);
create index if not exists chat_messages_employee_idx on public.chat_messages(employee_id, created_at);

create table if not exists public.chat_reads (
  thread_id     uuid not null references public.chat_threads(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  last_read_at  timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- Participants: the KAM, their assigned Mentor, and HR.
create or replace function public.is_chat_participant(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_own_employee(emp) or public.is_mentor_of(emp) or public.is_hr()
$$;

alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;

drop policy if exists chat_threads_read on public.chat_threads;
create policy chat_threads_read on public.chat_threads for select to authenticated
  using (public.is_chat_participant(employee_id));

drop policy if exists chat_messages_read on public.chat_messages;
create policy chat_messages_read on public.chat_messages for select to authenticated
  using (public.is_chat_participant(employee_id));

-- A participant posts only as themselves, into their own KAM's thread, with their real role.
drop policy if exists chat_messages_send on public.chat_messages;
create policy chat_messages_send on public.chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_chat_participant(employee_id)
    and exists (select 1 from public.chat_threads t where t.id = thread_id and t.employee_id = chat_messages.employee_id)
    and sender_role = public.app_role()
  );

drop policy if exists chat_reads_own on public.chat_reads;
create policy chat_reads_own on public.chat_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No update or delete policies: once sent, a message cannot be edited or deleted by any user.

-- Live delivery to every open device.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

insert into public.app_settings (key, value, category, label, description, value_type) values
  ('SUPPORT_CHAT_DAYS', '15'::jsonb, 'notifications', 'KAM support chat window (days)',
   'Days from Day 1 during which a KAM can message their Mentor and HR in the Compass. The thread stays readable afterwards.', 'number')
on conflict (key) do nothing;
