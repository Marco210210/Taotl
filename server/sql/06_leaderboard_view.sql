-- Classifica generale (vittorie complessive, per la schermata "Classifica generale").
-- Richiede 05_profile_and_admin.sql (games.is_manual/winner_player_id) e la
-- game_standings_v aggiornata in 02_views.sql e la colonna
-- games.counts_for_win_rate aggiunta da 08_verified_stats_and_legacy_wins.sql.
--
-- Una vittoria vale sia per le partite normali (punteggio più alto nella partita,
-- a parità di punteggio vincono entrambi, stessa regola già usata in app/profile)
-- sia per le partite inserite manualmente dall'admin (vince chi è stato indicato
-- come winner_player_id). Le righe "solo vittoria storica" aumentano WINS ma,
-- non avendo partecipanti noti, non aumentano GAMES_PLAYED né RATE_WINS.
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
