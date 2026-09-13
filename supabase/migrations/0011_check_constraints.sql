-- Phase 10: check constraints for known status enums, confidence, and counters.
-- Category is intentionally unconstrained: legacy values are mapped at read time.

alter table public.gmail_connections
  drop constraint if exists gmail_connections_status_check;
alter table public.gmail_connections
  add constraint gmail_connections_status_check
  check (status in ('CONNECTED', 'REAUTH_REQUIRED', 'DISCONNECTED', 'ERROR'));

alter table public.action_items
  drop constraint if exists action_items_status_check;
alter table public.action_items
  add constraint action_items_status_check
  check (status in ('OPEN', 'WAITING', 'COMPLETED', 'SNOOZED'));

alter table public.scan_runs
  drop constraint if exists scan_runs_status_check;
alter table public.scan_runs
  add constraint scan_runs_status_check
  check (status in ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED'));

alter table public.scan_runs
  drop constraint if exists scan_runs_trigger_type_check;
alter table public.scan_runs
  add constraint scan_runs_trigger_type_check
  check (trigger_type in ('INITIAL', 'MANUAL', 'RECOVERY', 'SCHEDULED'));

alter table public.scan_runs
  drop constraint if exists scan_runs_counters_nonnegative;
alter table public.scan_runs
  add constraint scan_runs_counters_nonnegative
  check (
    messages_discovered >= 0
    and messages_processed >= 0
    and threads_analyzed >= 0
    and important_count >= 0
    and action_count >= 0
    and reply_count >= 0
    and waiting_count >= 0
    and informational_count >= 0
    and ignored_count >= 0
    and threads_discovered >= 0
    and threads_checked >= 0
  );

alter table public.scan_jobs
  drop constraint if exists scan_jobs_status_check;
alter table public.scan_jobs
  add constraint scan_jobs_status_check
  check (status in ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED'));

alter table public.email_threads
  drop constraint if exists email_threads_status_check;
alter table public.email_threads
  add constraint email_threads_status_check
  check (
    status is null
    or status in ('action_required', 'waiting', 'informational', 'resolved', 'ignore')
  );

alter table public.email_threads
  drop constraint if exists email_threads_importance_check;
alter table public.email_threads
  add constraint email_threads_importance_check
  check (importance is null or importance in ('high', 'medium', 'low'));

alter table public.email_threads
  drop constraint if exists email_threads_urgency_check;
alter table public.email_threads
  add constraint email_threads_urgency_check
  check (urgency is null or urgency in ('urgent', 'soon', 'normal', 'none'));

alter table public.email_threads
  drop constraint if exists email_threads_action_type_check;
alter table public.email_threads
  add constraint email_threads_action_type_check
  check (
    action_type is null
    or action_type in (
      'reply',
      'review',
      'approve',
      'schedule',
      'submit',
      'pay',
      'sign',
      'download',
      'follow_up',
      'other',
      'none'
    )
  );

alter table public.email_threads
  drop constraint if exists email_threads_confidence_check;
alter table public.email_threads
  add constraint email_threads_confidence_check
  check (confidence is null or (confidence >= 0 and confidence <= 1));
