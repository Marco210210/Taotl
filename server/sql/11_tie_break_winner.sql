-- Spareggio risolto a mano su una partita vera (non manuale). Finora, a parità
-- di punteggio massimo, vincevano entrambi i giocatori pari-merito (vedi
-- commento originale in 06_leaderboard_view.sql). Questa colonna permette di
-- registrare che lo spareggio è stato risolto dai giocatori stessi (es. carta
-- alta) e chi è il vincitore vero: in quel caso conta solo lui/lei, non più
-- entrambi. Se resta NULL (nessuno ha risolto lo spareggio), il comportamento
-- di prima non cambia.
--
-- Eseguire come utente TAOTL_APP, dopo 10_manual_game_scores.sql.

ALTER TABLE games ADD tie_break_winner_id VARCHAR2(60) REFERENCES players(id);

CREATE OR REPLACE VIEW player_overall_stats_v AS
SELECT
  p.id          AS player_id,
  p.player_name AS player_name,
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
    g.counts_for_win_rate,
    g.tie_break_winner_id,
    MAX(gs.total) OVER (PARTITION BY gs.game_id) AS max_total
    FROM game_standings_v gs
    JOIN games g ON g.id = gs.game_id
) v ON v.player_id = p.id
WHERE p.is_active = 'Y'
GROUP BY p.id, p.player_name;
