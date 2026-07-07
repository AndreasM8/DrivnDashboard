-- Add followed_at to leads so old leads can be backdated for correct ad attribution
ALTER TABLE leads ADD COLUMN IF NOT EXISTS followed_at DATE;

-- Update attribution trigger to use followed_at when set, fall back to current date
CREATE OR REPLACE FUNCTION assign_lead_to_active_ad()
RETURNS TRIGGER AS $$
DECLARE
  v_date DATE;
BEGIN
  v_date := COALESCE(NEW.followed_at, CURRENT_DATE);
  SELECT id INTO NEW.ad_id
  FROM ads
  WHERE user_id = NEW.user_id
    AND started_at <= v_date
    AND (ended_at IS NULL OR ended_at >= v_date)
  ORDER BY started_at DESC
  LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
