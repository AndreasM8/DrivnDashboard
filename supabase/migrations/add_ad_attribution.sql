-- Add ad_id to leads for automatic attribution
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ad_id UUID REFERENCES ads(id) ON DELETE SET NULL;

-- Trigger: when a lead is inserted, auto-assign the currently active ad for that user
CREATE OR REPLACE FUNCTION assign_lead_to_active_ad()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.ad_id
  FROM ads
  WHERE user_id = NEW.user_id
    AND started_at <= CURRENT_DATE
    AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER leads_assign_ad
  BEFORE INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION assign_lead_to_active_ad();
