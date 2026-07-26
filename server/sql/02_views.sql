-- Vista di supporto per lo storico partite: una riga per (partita, giocatore) con il
-- totale punti di quel giocatore in quella partita. Usata dal modulo ORDS per costruire
-- la risposta JSON di GET /taotl/games.
--
-- Le partite inserite manualmente dall'admin (is_manual='Y', vedi
-- 05_profile_and_admin.sql) non hanno round/punteggi: "total" resta NULL e
-- "manual_won" (1/0) indica se quel giocatore è il vincitore registrato a mano.
-- Le partite normali hanno "total" valorizzato e "manual_won" sempre 0.
CREATE OR REPLACE VIEW game_standings_v AS
SELECT
  g.id            AS game_id,
  g.game_mode     AS game_mode,
  g.num_players   AS num_players,
  g.created_at    AS started_at,
  g.finished_at   AS ended_at,
  p.id            AS player_id,
  p.name          AS player_name,
  CASE WHEN g.is_manual = 'Y' THEN NULL ELSE NVL(SUM(rb.score), 0) END AS total,
  CASE WHEN g.is_manual = 'Y' AND g.winner_player_id = p.id THEN 1 ELSE 0 END AS manual_won
FROM games g
JOIN game_players gp ON gp.game_id = g.id
JOIN players p ON p.id = gp.player_id
LEFT JOIN rounds r ON r.game_id = g.id AND g.is_manual = 'N'
LEFT JOIN round_bids rb ON rb.round_id = r.id AND rb.player_id = p.id
GROUP BY g.id, g.game_mode, g.num_players, g.created_at, g.finished_at, p.id, p.name,
         g.is_manual, g.winner_player_id;
