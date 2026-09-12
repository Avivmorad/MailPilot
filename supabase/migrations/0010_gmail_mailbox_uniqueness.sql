-- One active Gmail mailbox per MailPilot user (not merely unique per user_id).
-- If CREATE INDEX fails, two CONNECTED rows already share an address: disconnect
-- Gmail on one MailPilot account in the app, then re-run this file.

create unique index if not exists gmail_connections_one_active_mailbox_email
  on public.gmail_connections (lower(gmail_email))
  where status is distinct from 'DISCONNECTED';

create unique index if not exists gmail_connections_one_active_google_account
  on public.gmail_connections (google_account_id)
  where google_account_id is not null
    and status is distinct from 'DISCONNECTED';
