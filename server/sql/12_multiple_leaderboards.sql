-- Taotl — classifiche separate e preferenze degli account.
-- Migrazione additiva/idempotente: lo storico esistente viene assegnato alla
-- classifica di compatibilità "Generale" e non viene eliminato o ricalcolato.

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_LEADERBOARDS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_leaderboards (
        id               VARCHAR2(60) NOT NULL PRIMARY KEY,
        name             VARCHAR2(80) NOT NULL,
        owner_account_id VARCHAR2(60) REFERENCES taotl_accounts(id) ON DELETE SET NULL,
        is_active        CHAR(1) DEFAULT 'Y' NOT NULL,
        created_at       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT chk_taotl_leaderboards_active CHECK (is_active IN ('Y', 'N'))
      )~';
  END IF;
END;
/

MERGE INTO taotl_leaderboards target
USING (SELECT 'lb_general' id, 'Generale' name FROM dual) source
ON (target.id = source.id)
WHEN NOT MATCHED THEN
  INSERT (id, name, is_active) VALUES (source.id, source.name, 'Y');

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'UQ_TAOTL_LEADERBOARDS_NAME';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE UNIQUE INDEX uq_taotl_leaderboards_name ON taotl_leaderboards (LOWER(TRIM(name)))';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_ACCOUNT_LEADERBOARDS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_account_leaderboards (
        account_id    VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id) ON DELETE CASCADE,
        leaderboard_id VARCHAR2(60) NOT NULL REFERENCES taotl_leaderboards(id) ON DELETE CASCADE,
        is_default    CHAR(1) DEFAULT 'N' NOT NULL,
        joined_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT pk_taotl_account_leaderboards PRIMARY KEY (account_id, leaderboard_id),
        CONSTRAINT chk_taotl_account_lb_default CHECK (is_default IN ('Y', 'N'))
      )~';
  END IF;
END;
/

MERGE INTO taotl_account_leaderboards target
USING (SELECT id account_id FROM taotl_accounts WHERE is_active = 'Y') source
ON (target.account_id = source.account_id AND target.leaderboard_id = 'lb_general')
WHEN NOT MATCHED THEN
  INSERT (account_id, leaderboard_id, is_default)
  VALUES (source.account_id, 'lb_general', 'Y');

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists
    FROM user_tab_columns
   WHERE table_name = 'GAMES' AND column_name = 'LEADERBOARD_ID';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE games ADD leaderboard_id VARCHAR2(60)';
  END IF;
END;
/

UPDATE games SET leaderboard_id = 'lb_general' WHERE leaderboard_id IS NULL;

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists
    FROM user_constraints
   WHERE table_name = 'GAMES' AND constraint_name = 'FK_GAMES_LEADERBOARD';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE games ADD CONSTRAINT fk_games_leaderboard FOREIGN KEY (leaderboard_id) REFERENCES taotl_leaderboards(id)';
  END IF;
END;
/

DECLARE
  v_nullable user_tab_columns.nullable%TYPE;
BEGIN
  SELECT nullable INTO v_nullable
    FROM user_tab_columns
   WHERE table_name = 'GAMES' AND column_name = 'LEADERBOARD_ID';
  IF v_nullable = 'Y' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE games MODIFY leaderboard_id NOT NULL';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'IX_GAMES_LEADERBOARD';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_games_leaderboard ON games(leaderboard_id, finished_at)';
  END IF;
END;
/

CREATE OR REPLACE VIEW player_overall_stats_v AS
SELECT
  v.leaderboard_id AS leaderboard_id,
  p.id             AS player_id,
  p.player_name    AS player_name,
  SUM(CASE WHEN v.counts_for_win_rate = 'Y' THEN 1 ELSE 0 END) AS games_played,
  SUM(CASE
        WHEN v.manual_won = 1 THEN 1
        WHEN v.tie_break_winner_id IS NOT NULL AND v.total IS NOT NULL AND v.total = v.max_total THEN
          CASE WHEN v.player_id = v.tie_break_winner_id THEN 1 ELSE 0 END
        WHEN v.total IS NOT NULL AND v.total = v.max_total THEN 1
        ELSE 0
      END) AS wins,
  SUM(CASE
        WHEN v.counts_for_win_rate = 'Y'
         AND (
           v.manual_won = 1
           OR (
             v.tie_break_winner_id IS NOT NULL AND v.total IS NOT NULL AND v.total = v.max_total
             AND v.player_id = v.tie_break_winner_id
           )
           OR (
             v.tie_break_winner_id IS NULL
             AND v.total IS NOT NULL AND v.total = v.max_total
           )
         )
        THEN 1
        ELSE 0
      END) AS rate_wins
FROM player_display_names_v p
JOIN (
  SELECT
    gs.*,
    g.leaderboard_id,
    g.counts_for_win_rate,
    g.tie_break_winner_id,
    MAX(gs.total) OVER (PARTITION BY gs.game_id) AS max_total
    FROM game_standings_v gs
    JOIN games g ON g.id = gs.game_id
) v ON v.player_id = p.id
WHERE p.is_active = 'Y'
GROUP BY v.leaderboard_id, p.id, p.player_name;

COMMIT;
