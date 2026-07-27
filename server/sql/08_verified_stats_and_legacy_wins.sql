-- Taotl — percentuale vittorie affidabile e vittorie storiche senza partecipanti.
--
-- Migrazione additiva e idempotente:
-- - non elimina né riscrive partite esistenti;
-- - tutte le partite già presenti continuano a contare nella percentuale;
-- - soltanto le nuove righe "solo vittoria storica" useranno il valore N.

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_exists
    FROM user_tab_columns
   WHERE table_name = 'GAMES'
     AND column_name = 'COUNTS_FOR_WIN_RATE';

  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE games ADD counts_for_win_rate CHAR(1) DEFAULT ''Y'' NOT NULL';
    EXECUTE IMMEDIATE
      'ALTER TABLE games ADD CONSTRAINT chk_games_win_rate CHECK (counts_for_win_rate IN (''Y'', ''N''))';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_exists
    FROM user_constraints
   WHERE table_name = 'TAOTL_GAME_ROOMS'
     AND constraint_name = 'UQ_TAOTL_ROOMS_GAME';

  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_game_rooms ADD CONSTRAINT uq_taotl_rooms_game UNIQUE (game_id)';
  END IF;
END;
/

CREATE OR REPLACE VIEW player_overall_stats_v AS
SELECT
  p.id   AS player_id,
  p.name AS player_name,
  SUM(CASE WHEN v.counts_for_win_rate = 'Y' THEN 1 ELSE 0 END) AS games_played,
  SUM(CASE
        WHEN v.manual_won = 1 THEN 1
        WHEN v.total IS NOT NULL AND v.total = v.max_total THEN 1
        ELSE 0
      END) AS wins,
  SUM(CASE
        WHEN v.counts_for_win_rate = 'Y'
         AND (
           v.manual_won = 1
           OR (v.total IS NOT NULL AND v.total = v.max_total)
         )
        THEN 1
        ELSE 0
      END) AS rate_wins
FROM players p
JOIN (
  SELECT
    gs.*,
    g.counts_for_win_rate,
    MAX(gs.total) OVER (PARTITION BY gs.game_id) AS max_total
    FROM game_standings_v gs
    JOIN games g ON g.id = gs.game_id
) v ON v.player_id = p.id
WHERE p.is_active = 'Y'
GROUP BY p.id, p.name;
