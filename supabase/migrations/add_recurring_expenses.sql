-- Recurring expense templates (not tied to a month; always counted in current month totals)
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category           TEXT        NOT NULL CHECK (category IN ('team','software','ads','withdrawal','other','salary','subscriptions','investments')),
  label              TEXT        NOT NULL,
  amount             NUMERIC     NOT NULL,
  currency           TEXT        NOT NULL DEFAULT 'NOK',
  team_role          TEXT        CHECK (team_role IN ('setter','closer','editor','growth_partner')),
  payment_structure  TEXT        CHECK (payment_structure IN ('monthly','retainer','both')),
  active             BOOLEAN     NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own recurring expenses"
  ON recurring_expenses FOR ALL
  USING (auth.uid() = user_id);
