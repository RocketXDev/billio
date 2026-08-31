-- Supports combined sibling invoicing: when a coach sends one message covering
-- multiple students who share a parent phone, every invoice in that send
-- gets stamped with the same invoice_group_id so paid-status (and the
-- payment-reminder/SMS "PAID" flows) can cascade across the whole group.
alter table invoices add column if not exists invoice_group_id uuid null;
create index if not exists idx_invoices_invoice_group_id on invoices (invoice_group_id) where invoice_group_id is not null;
