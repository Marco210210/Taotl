-- Vista di supporto per lo storico partite: una riga per (partita, giocatore) con il
-- totale punti di quel giocatore in quella partita. Usata dal modulo ORDS per costruire
-- la risposta JSON di GET /taotl/games.
CREATE OR REPLACE VIEW game_standings_v AS
SELECT
  g.id            AS game_id,
  g.game_mode     AS game_mode,
  g.num_players   AS num_players,
  g.created_at    AS started_at,
  g.finished_at   AS ended_at,
  p.id            AS player_id,
  p.name          AS player_name,
  NVL(SUM(rb.score), 0) AS total
FROM games g
JOIN game_players gp ON gp.game_id = g.id
JOIN players p ON p.id = gp.player_id
LEFT JOIN rounds r ON r.game_id = g.id
LEFT JOIN round_bids rb ON rb.round_id = r.id AND rb.player_id = p.id
GROUP BY g.id, g.game_mode, g.num_players, g.created_at, g.finished_at, p.id, p.name;
