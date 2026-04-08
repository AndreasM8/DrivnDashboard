-- Add 'second_call' and 'not_interested' to the leads.stage CHECK constraint.
-- Drop the old constraint (name may vary — check in Supabase Table Editor → leads → Constraints if this errors)
alter table leads drop constraint if exists leads_stage_check;

-- Re-add with all current valid stages
alter table leads
  add constraint leads_stage_check
  check (stage in ('follower','replied','freebie_sent','call_booked','second_call','closed','nurture','bad_fit','not_interested'));
