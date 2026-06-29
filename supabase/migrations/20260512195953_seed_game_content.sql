/*
  # Seed Quests and Achievements

  1. Quests
    - Daily quests (easy, refreshing)
    - Weekly quests (medium, high rewards)
    - Main quests (narrative progression)
    - Legendary quests (ultra-rare, max rewards)

  2. Achievements
    - Various milestone achievements based on player actions
*/

INSERT INTO quests (title, description, quest_type, category, xp_reward, difficulty, requirements) VALUES
-- Daily Quests
('Morning Market Analysis', 'Review market conditions in any district', 'daily', 'analysis', 100, 1, '{"type":"district_review"}'::jsonb),
('Property Inspection', 'Inspect 2 hotel properties', 'daily', 'acquisition', 150, 1, '{"properties":2}'::jsonb),
('Network Call', 'Build relationships by completing a networking task', 'daily', 'networking', 120, 1, '{"type":"network"}'::jsonb),
('Risk Assessment', 'Complete a financial risk analysis', 'daily', 'finance', 100, 1, '{"type":"analysis"}'::jsonb),

-- Weekly Quests
('District Expansion', 'Gain control in a new district', 'weekly', 'territory', 500, 2, '{"districts":1}'::jsonb),
('Major Deal Closure', 'Close a significant hotel investment deal', 'weekly', 'deals', 750, 3, '{"deals":1}'::jsonb),
('Market Dominance', 'Achieve 25% market share in any district', 'weekly', 'territory', 600, 2, '{"market_share":0.25}'::jsonb),
('Portfolio Diversification', 'Invest in 3 different regions', 'weekly', 'portfolio', 700, 2, '{"regions":3}'::jsonb),

-- Main Quests
('Establish Your Advisory', 'Set up your first hotel investment advisory office', 'main', 'story', 1000, 1, '{"type":"foundation"}'::jsonb),
('Portugal''s Premier Markets', 'Establish presence in 5 key districts', 'main', 'story', 2000, 3, '{"districts":5}'::jsonb),
('The Northern Alliance', 'Build partnerships in Porto, Braga, and Coimbra', 'main', 'story', 1500, 2, '{"districts":["Porto","Braga","Coimbra"]}'::jsonb),
('Alentejo Command', 'Dominate Alentejo region with presence in Évora, Beja', 'main', 'story', 1200, 2, '{"districts":["Évora","Beja"]}'::jsonb),
('Island Authority', 'Secure premium positions in both Madeira and Açores', 'main', 'story', 2500, 4, '{"districts":["Madeira","Açores"]}'::jsonb),
('The Algarve Gateway', 'Establish luxury hotel advisory network in Faro', 'main', 'story', 1800, 3, '{"districts":["Faro"]}'::jsonb),

-- Legendary Quests
('Empire Builder', 'Control 10+ districts with 50%+ market share each', 'legendary', 'ultimate', 5000, 5, '{"districts":10,"market_share":0.5}'::jsonb),
('Reputation Forged', 'Reach 1000+ reputation points through advisory success', 'legendary', 'ultimate', 4000, 4, '{"reputation":1000}'::jsonb),
('No Compromise', 'Maintain 365-day no-trading streak without penalties', 'legendary', 'ultimate', 3000, 3, '{"no_trading_streak":365}'::jsonb),
('Boutique Excellence', 'Complete all main quests and achieve Level 50', 'legendary', 'ultimate', 6000, 5, '{"level":50,"main_quests":"all"}'::jsonb);

INSERT INTO achievements (name, description, icon, xp_reward, requirement_type, requirement_value) VALUES
('First Deal', 'Close your first hotel investment deal', 'Handshake', 250, 'deals_closed', 1),
('Deal Maker', 'Close 5 successful deals', 'TrendingUp', 500, 'deals_closed', 5),
('Property Magnate', 'Acquire 10 premium properties', 'Building', 750, 'properties_acquired', 10),
('Regional Authority', 'Control 3 districts simultaneously', 'MapPin', 800, 'districts_controlled', 3),
('Discipline Master', 'Maintain 100 Discipline for 30 consecutive days', 'Zap', 600, 'discipline_streak', 30),
('Focus Guardian', 'Keep Focus above 90 for entire week without penalties', 'Eye', 400, 'focus_maintained', 1),
('Clean Slate', 'Reach 100-day no-trading streak', 'Award', 900, 'no_trading_streak', 100),
('Island Master', 'Control both island districts', 'Anchor', 1000, 'islands_controlled', 2),
('Reputation Pioneer', 'Reach 500 reputation points', 'Star', 1200, 'reputation', 500),
('Level 10 Veteran', 'Reach Level 10', 'Trophy', 300, 'level', 10);
