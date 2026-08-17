-- Punteggi finali opzionali sulle partite inserite manualmente dall'admin.
-- Finora add_manual_game salvava solo il vincitore; questa colonna permette
-- di registrare anche il punteggio finale di ciascun partecipante, se lo si
-- conosce (rimane NULL altrimenti — nessun cambiamento per chi non la usa).
--
-- Non cambia come viene calcolato il vincitore delle partite manuali: quello
-- resta sempre games.winner_player_id, deciso esplicitamente da chi inserisce
-- la partita. final_score è solo informativo/di visualizzazione.
--
-- Eseguire come utente TAOTL_APP, dopo 09_account_display_names_and_repairs.sql.

ALTER TABLE game_players ADD final_score NUMBER(6);

CREATE OR REPLACE VIEW game_standings_v AS
SELECT
  g.id            AS game_id,
  g.game_mode     AS game_mode,
  g.num_players   AS num_players,
  g.created_at    AS started_at,
  g.finished_at   AS ended_at,
  p.id            AS player_id,
  p.player_name   AS player_name,
  CASE WHEN g.is_manual = 'Y' THEN gp.final_score ELSE NVL(SUM(rb.score), 0) END AS total,
  CASE WHEN g.is_manual = 'Y' AND g.winner_player_id = p.id THEN 1 ELSE 0 END AS manual_won
FROM games g
JOIN game_players gp ON gp.game_id = g.id
JOIN player_display_names_v p ON p.id = gp.player_id
LEFT JOIN rounds r ON r.game_id = g.id AND g.is_manual = 'N'
LEFT JOIN round_bids rb ON rb.round_id = r.id AND rb.player_id = p.id
GROUP BY g.id, g.game_mode, g.num_players, g.created_at, g.finished_at, p.id, p.player_name,
         g.is_manual, g.winner_player_id, gp.final_score;
