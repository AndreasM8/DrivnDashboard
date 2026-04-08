-- Extend tasks.type check constraint to include generated task types
alter table tasks drop constraint if exists tasks_type_check;
alter table tasks add constraint tasks_type_check check (
  type in (
    'follow_up', 'payment', 'invoice', 'upsell', 'nurture',
    'call_outcome', 'ad_spend', 'manual',
    'noshow_followup', 'contract_end'
  )
);
