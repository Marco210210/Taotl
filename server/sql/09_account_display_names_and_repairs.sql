-- Taotl — nome account come identità pubblica e ripristino mirato di due nomi.
--
-- Migrazione non distruttiva:
-- - non cambia ID, partite, punteggi, vittorie o collegamenti;
-- - per un giocatore collegato mostra ovunque il display_name del Taotl ID;
-- - ripristina soltanto i due record identificati con certezza, e soltanto se
--   contengono ancora il valore errato "fcxbna".

UPDATE players
   SET name = 'Marco'
 WHERE id = 'player_ms0r0vx9_uab4ivb864c9'
   AND name = 'fcxbna';

UPDATE players
   SET name = 'Nello'
 WHERE id = 'player_ms0yij3c_vp0ivrc0qg4a'
   AND name = 'fcxbna';

COMMIT;

CREATE OR REPLACE VIEW player_display_names_v AS
SELECT
  p.id,
  COALESCE(a.display_name, p.name) AS player_name,
  p.photo,
  p.photo_media_type,
  p.is_active,
  p.created_at
FROM players p
LEFT JOIN taotl_account_players ap ON ap.player_id = p.id
LEFT JOIN taotl_accounts a
  ON a.id = ap.account_id
 AND a.is_active = 'Y';

CREATE OR REPLACE VIEW game_standings_v AS
SELECT
  g.id            AS game_id,
  g.game_mode     AS game_mode,
  g.num_players   AS num_players,
  g.created_at    AS started_at,
  g.finished_at   AS ended_at,
  p.id            AS player_id,
  p.player_name   AS player_name,
  CASE WHEN g.is_manual = 'Y' THEN NULL ELSE NVL(SUM(rb.score), 0) END AS total,
  CASE WHEN g.is_manual = 'Y' AND g.winner_player_id = p.id THEN 1 ELSE 0 END AS manual_won
FROM games g
JOIN game_players gp ON gp.game_id = g.id
JOIN player_display_names_v p ON p.id = gp.player_id
LEFT JOIN rounds r ON r.game_id = g.id AND g.is_manual = 'N'
LEFT JOIN round_bids rb ON rb.round_id = r.id AND rb.player_id = p.id
GROUP BY g.id, g.game_mode, g.num_players, g.created_at, g.finished_at, p.id, p.player_name,
         g.is_manual, g.winner_player_id;

CREATE OR REPLACE VIEW player_overall_stats_v AS
SELECT
  p.id          AS player_id,
  p.player_name AS player_name,
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
FROM player_display_names_v p
JOIN (
  SELECT
    gs.*,
    g.counts_for_win_rate,
    MAX(gs.total) OVER (PARTITION BY gs.game_id) AS max_total
    FROM game_standings_v gs
    JOIN games g ON g.id = gs.game_id
) v ON v.player_id = p.id
WHERE p.is_active = 'Y'
GROUP BY p.id, p.player_name;
