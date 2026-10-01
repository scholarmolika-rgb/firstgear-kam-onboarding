-- ════════════════════════════════════════════════════════════════════
-- FirstGear KAM Onboarding Compass — 004 row level security
--
-- Model:
--   KAM            → own records only; may tick own KAM-owned tasks, edit own
--                    account brief/stakeholders, schedule own sessions, log own
--                    support events. Cannot write scores, gates, audit or approvals.
--   MENTOR         → assigned KAMs; may record mentor reviews/feedback and tick
--                    mentor-owned tasks.
--   REPORTING_BOSS → assigned KAMs; may record manager decisions.
--   HR_ADMIN       → programme configuration and cohort data.
--   service_role   → used only on the server for system-computed state
--                    (scores, gate results, snapshots, audit). Bypasses RLS.
-- ════════════════════════════════════════════════════════════════════

-- ── Helper functions (security definer so policies don't recurse) ──
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_hr() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_role() = 'HR_ADMIN', false)
$$;

create or replace function public.is_own_employee(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees e where e.id = emp and e.profile_id = auth.uid())
$$;

create or replace function public.is_mentor_of(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees e where e.id = emp and e.mentor_id = auth.uid())
$$;

create or replace function public.is_boss_of(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.employees e where e.id = emp and e.reporting_boss_id = auth.uid())
$$;

create or replace function public.can_access_employee(emp uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_hr() or public.is_own_employee(emp) or public.is_mentor_of(emp) or public.is_boss_of(emp)
$$;

create or replace function public.instance_employee(inst uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select employee_id from public.onboarding_instances where id = inst
$$;

-- ── Enable RLS everywhere ──────────────────────────────────────────
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── Reference & configuration (read: everyone signed in; write: HR) ─
create policy roles_read on public.roles for select to authenticated using (true);

create policy settings_read on public.app_settings for select to authenticated using (true);
create policy settings_write on public.app_settings for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy templates_read on public.onboarding_templates for select to authenticated using (true);
create policy templates_write on public.onboarding_templates for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy days_read on public.onboarding_days for select to authenticated using (true);
create policy days_write on public.onboarding_days for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy gatedefs_read on public.gate_definitions for select to authenticated using (true);
create policy gatedefs_write on public.gate_definitions for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy tasks_read on public.tasks for select to authenticated
  using (template_id is not null or public.can_access_employee(public.instance_employee(instance_id)));
create policy tasks_write on public.tasks for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy taskdeps_read on public.task_dependencies for select to authenticated using (true);
create policy taskdeps_write on public.task_dependencies for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy assessments_read on public.assessments for select to authenticated using (true);
create policy assessments_write on public.assessments for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- Questions hold correct answers: HR only. KAMs receive stripped questions from the server.
create policy questions_hr on public.assessment_questions for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- Scenario rubrics: staff only. KAMs receive situation/prompt from the server.
create policy scenarios_staff_read on public.scenario_templates for select to authenticated
  using (public.app_role() in ('HR_ADMIN','MENTOR','REPORTING_BOSS'));
create policy scenarios_write on public.scenario_templates for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- ── Identity ───────────────────────────────────────────────────────
-- Internal directory: signed-in users can see names/roles (needed to show mentor, boss).
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_hr_write on public.profiles for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy employees_read on public.employees for select to authenticated using (public.can_access_employee(id));
create policy employees_hr_write on public.employees for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- ── Lifecycle (system-computed writes via service role) ────────────
create policy instances_read on public.onboarding_instances for select to authenticated using (public.can_access_employee(employee_id));
create policy instances_hr_write on public.onboarding_instances for all to authenticated using (public.is_hr()) with check (public.is_hr());

create policy completions_read on public.task_completions for select to authenticated using (public.can_access_employee(employee_id));
-- Tick/untick: the KAM for KAM-owned manual tasks; the assigned mentor/boss for tasks they own; HR anything.
create policy completions_update on public.task_completions for update to authenticated
  using (
    public.is_hr()
    or exists (
      select 1 from public.tasks t
      where t.id = task_id and t.action_ref is null and (
        (t.owner_role = 'KAM' and public.is_own_employee(employee_id))
        or (t.owner_role = 'MENTOR' and public.is_mentor_of(employee_id))
        or (t.owner_role = 'REPORTING_BOSS' and public.is_boss_of(employee_id))
      )
    )
  )
  with check (public.can_access_employee(employee_id) and (completed_by is null or completed_by = auth.uid()));

-- A KAM can only *submit* tasks that need approval; approval is a reviewer's action.
create or replace function public.guard_task_completion() returns trigger
language plpgsql security definer set search_path = public as $$
declare needs_approval boolean;
begin
  if auth.uid() is null then return new; end if;  -- service role / system
  select requires_approval into needs_approval from public.tasks where id = new.task_id;
  if needs_approval and public.is_own_employee(new.employee_id) and not public.is_hr()
     and new.status = 'COMPLETED' and old.status is distinct from 'COMPLETED' then
    raise exception 'This task requires reviewer approval; submit it for review instead';
  end if;
  return new;
end $$;
create trigger task_completions_guard before update on public.task_completions
  for each row execute function public.guard_task_completion();

-- ── Sessions ───────────────────────────────────────────────────────
create policy sessions_read on public.sessions for select to authenticated using (public.can_access_employee(employee_id));
create policy sessions_write on public.sessions for insert to authenticated
  with check (public.can_access_employee(employee_id) and created_by = auth.uid());
create policy sessions_update on public.sessions for update to authenticated
  using (public.can_access_employee(employee_id)) with check (public.can_access_employee(employee_id));

create policy attendance_read on public.session_attendance for select to authenticated using (public.can_access_employee(employee_id));
create policy attendance_write on public.session_attendance for all to authenticated
  using (public.can_access_employee(employee_id)) with check (public.can_access_employee(employee_id));

-- ── Knowledge: approved + current only (HR sees drafts/history) ────
create policy kdocs_read on public.knowledge_documents for select to authenticated
  using ((approved and is_current) or public.is_hr());
create policy kdocs_write on public.knowledge_documents for all to authenticated using (public.is_hr()) with check (public.is_hr());
create policy kchunks_read on public.knowledge_chunks for select to authenticated
  using ((approved and is_current) or public.is_hr());
create policy kchunks_write on public.knowledge_chunks for all to authenticated using (public.is_hr()) with check (public.is_hr());

-- ── Scores & evidence: read-only to users; written by the scoring engine ─
create policy attempts_read on public.assessment_attempts for select to authenticated using (public.can_access_employee(employee_id));
create policy answers_read on public.assessment_answers for select to authenticated using (public.can_access_employee(employee_id));
create policy pillars_read on public.pillar_scores for select to authenticated using (public.can_access_employee(employee_id));
create policy scen_attempts_read on public.scenario_attempts for select to authenticated using (public.can_access_employee(employee_id));
create policy gates_read on public.gate_results for select to authenticated using (public.can_access_employee(employee_id));
create policy snapshots_read on public.progress_snapshots for select to authenticated using (public.can_access_employee(employee_id));

-- ── Human input ────────────────────────────────────────────────────
create policy feedback_read on public.feedback for select to authenticated
  using (public.can_access_employee(employee_id) and (visible_to_kam or not public.is_own_employee(employee_id)));
create policy feedback_write on public.feedback for insert to authenticated
  with check (author_id = auth.uid() and (public.is_hr() or public.is_mentor_of(employee_id) or public.is_boss_of(employee_id)));

create policy mreviews_read on public.mentor_reviews for select to authenticated using (public.can_access_employee(employee_id));
create policy mreviews_write on public.mentor_reviews for insert to authenticated
  with check (mentor_id = auth.uid() and (public.is_mentor_of(employee_id) or public.is_hr()));

create policy boss_reviews_read on public.manager_reviews for select to authenticated using (public.can_access_employee(employee_id));
create policy boss_reviews_write on public.manager_reviews for insert to authenticated
  with check (manager_id = auth.uid() and (
    public.is_boss_of(employee_id) or (public.is_hr() and review_type in ('HR_PANEL_INPUT','DEVELOPMENT_ACTION'))
  ));

-- ── Customer 360 ───────────────────────────────────────────────────
create policy briefs_read on public.account_briefs for select to authenticated using (public.can_access_employee(employee_id));
create policy briefs_write on public.account_briefs for insert to authenticated
  with check (public.is_own_employee(employee_id) or public.is_hr());
create policy briefs_update on public.account_briefs for update to authenticated
  using (public.can_access_employee(employee_id)) with check (public.can_access_employee(employee_id));

-- A KAM can never approve their own brief.
create or replace function public.guard_account_brief() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;  -- service role / system
  if public.is_own_employee(new.employee_id) and not public.is_hr() then
    if new.approved is distinct from old.approved
       or (new.status in ('APPROVED','CHANGES_REQUESTED') and new.status is distinct from old.status)
       or new.reviewed_by is distinct from old.reviewed_by then
      raise exception 'A KAM cannot review or approve their own account brief';
    end if;
    -- editing an approved brief sends it back for review
    if old.approved and (new.strategic_context is distinct from old.strategic_context
        or new.pricing_history is distinct from old.pricing_history
        or new.open_commitments is distinct from old.open_commitments) then
      new.approved := false;
      new.status := 'DRAFT';
      new.version := old.version + 1;
    end if;
  end if;
  return new;
end $$;
create trigger account_briefs_guard before update on public.account_briefs
  for each row execute function public.guard_account_brief();

create policy stakeholders_read on public.stakeholder_maps for select to authenticated using (public.can_access_employee(employee_id));
create policy stakeholders_write on public.stakeholder_maps for all to authenticated
  using (public.can_access_employee(employee_id)) with check (public.can_access_employee(employee_id));

-- ── Dependency signal ──────────────────────────────────────────────
create policy support_read on public.support_events for select to authenticated using (public.can_access_employee(employee_id));
create policy support_write on public.support_events for insert to authenticated
  with check (recorded_by = auth.uid() and public.can_access_employee(employee_id));

-- ── Notifications ──────────────────────────────────────────────────
create policy notifications_read on public.notifications for select to authenticated using (recipient_id = auth.uid());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ── Conversations (private to the user; HR may audit) ──────────────
create policy convo_read on public.conversation_sessions for select to authenticated using (user_id = auth.uid() or public.is_hr());
create policy convo_write on public.conversation_sessions for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_employee(employee_id));
create policy messages_read on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversation_sessions s where s.id = session_id and (s.user_id = auth.uid() or public.is_hr())));

-- ── Audit: readable by those who can see the employee; append-only ─
create policy audit_read on public.audit_logs for select to authenticated
  using (public.is_hr() or (employee_id is not null and public.can_access_employee(employee_id)));

create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end $$;
create trigger audit_logs_no_update before update or delete on public.audit_logs
  for each row execute function public.audit_logs_immutable();

-- ── Realtime: push progress changes to every open device ───────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.task_completions, public.gate_results, public.notifications;
  end if;
end $$;
