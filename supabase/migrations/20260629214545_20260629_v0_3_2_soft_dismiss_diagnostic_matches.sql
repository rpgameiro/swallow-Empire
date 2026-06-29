-- v0.3.2: Soft-dismiss noisy matches that were unintentionally persisted when
-- RLS was unblocked in v0.3.1. These tiers (incomplete_data, budget_mismatch,
-- low) are diagnostics and do not represent real commercial opportunities.
-- Not deleting — preserving rows for audit trail during stabilization.

UPDATE lead_matches
SET is_dismissed = true
WHERE match_tier IN ('incomplete_data', 'budget_mismatch', 'low')
  AND is_dismissed = false
  AND is_actioned = false;
