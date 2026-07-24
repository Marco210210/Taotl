-- Pacchetto PL/SQL con la logica applicativa richiamata dai handler ORDS.
-- La logica di business resta nel database, come da guida originale
-- (Sviluppo_App_Expo_Oracle.md): ORDS espone solo l'endpoint REST, qui dentro
-- avviene tutta la validazione/inserimento.

CREATE OR REPLACE PACKAGE taotl_api AS

  -- Verifica la chiave applicativa condivisa (header X-App-Key). Solleva un errore
  -- applicativo (=> HTTP 500 con messaggio) se manca o non corrisponde.
  -- NB: protezione leggera pensata per un'app fra amici, non per dati sensibili.
  PROCEDURE check_app_key(p_key IN VARCHAR2);

  -- Operazioni sulla rubrica. Le scritture passano dal package invece che da
  -- AutoREST, così la chiave condivisa viene verificata e gli aggiornamenti
  -- parziali non azzerano le altre colonne.
  PROCEDURE create_player(
    p_key  IN VARCHAR2,
    p_body IN BLOB
  );

  PROCEDURE update_player(
    p_key  IN VARCHAR2,
    p_id   IN VARCHAR2,
    p_body IN BLOB
  );

  PROCEDURE update_player_photo(
    p_key        IN VARCHAR2,
    p_id         IN VARCHAR2,
    p_body       IN BLOB,
    p_media_type IN VARCHAR2
  );

  -- Riceve il JSON di una partita conclusa (vedi src/api/types.ts -> GameSyncPayload
  -- nell'app) e la registra in un'unica transazione: partita, giocatori al tavolo,
  -- turni e chiamate. Idempotente: se la stessa partita (stesso id) viene rimandata,
  -- turni e chiamate vengono sostituiti.
  PROCEDURE sync_game(p_body IN BLOB);

END taotl_api;
/

CREATE OR REPLACE PACKAGE BODY taotl_api AS

  c_expected_app_key CONSTANT VARCHAR2(200) := 'CAMBIA_QUESTA_CHIAVE';

  PROCEDURE check_app_key(p_key IN VARCHAR2) IS
  BEGIN
    IF p_key IS NULL OR p_key != c_expected_app_key THEN
      RAISE_APPLICATION_ERROR(-20401, 'Chiave applicativa mancante o non valida.');
    END IF;
  END check_app_key;

  PROCEDURE create_player(
    p_key  IN VARCHAR2,
    p_body IN BLOB
  ) IS
    v_id   players.id%TYPE;
    v_name players.name%TYPE;
  BEGIN
    check_app_key(p_key);

    SELECT JSON_VALUE(p_body, '$.id' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(120))
      INTO v_id, v_name
      FROM dual;

    IF v_id IS NULL OR TRIM(v_name) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Id e nome del giocatore sono obbligatori.');
    END IF;

    INSERT INTO players (id, name)
    VALUES (v_id, TRIM(v_name));
    COMMIT;
  END create_player;

  PROCEDURE update_player(
    p_key  IN VARCHAR2,
    p_id   IN VARCHAR2,
    p_body IN BLOB
  ) IS
    v_name players.name%TYPE;
  BEGIN
    check_app_key(p_key);

    SELECT JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(120))
      INTO v_name
      FROM dual;

    IF TRIM(v_name) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il nome del giocatore è obbligatorio.');
    END IF;

    UPDATE players
       SET name = TRIM(v_name)
     WHERE id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    COMMIT;
  END update_player;

  PROCEDURE update_player_photo(
    p_key        IN VARCHAR2,
    p_id         IN VARCHAR2,
    p_body       IN BLOB,
    p_media_type IN VARCHAR2
  ) IS
  BEGIN
    check_app_key(p_key);

    UPDATE players
       SET photo = p_body,
           photo_media_type = NVL(p_media_type, 'application/octet-stream')
     WHERE id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    COMMIT;
  END update_player_photo;

  PROCEDURE upsert_player(p_id IN VARCHAR2, p_name IN VARCHAR2) IS
  BEGIN
    MERGE INTO players p
    USING (SELECT p_id AS id, p_name AS name FROM dual) src
    ON (p.id = src.id)
    WHEN NOT MATCHED THEN
      INSERT (id, name) VALUES (src.id, src.name);
  END upsert_player;

  PROCEDURE sync_game(p_body IN BLOB) IS
    v_game_id     games.id%TYPE;
    v_mode        games.game_mode%TYPE;
    v_num_players games.num_players%TYPE;
    v_dealer_id   games.start_dealer_id%TYPE;
    v_created_at  games.created_at%TYPE;
    v_finished_at games.finished_at%TYPE;
    v_round_id    rounds.id%TYPE;
  BEGIN
    SELECT id, game_mode, num_players, start_dealer_id, created_at, finished_at
      INTO v_game_id, v_mode, v_num_players, v_dealer_id, v_created_at, v_finished_at
      FROM JSON_TABLE(p_body, '$'
             COLUMNS (
               id             VARCHAR2(60)  PATH '$.id',
               game_mode      VARCHAR2(20)  PATH '$.mode',
               num_players    NUMBER        PATH '$.numPlayers',
               start_dealer_id VARCHAR2(60) PATH '$.startDealerId',
               created_at     TIMESTAMP WITH TIME ZONE PATH '$.createdAt',
               finished_at    TIMESTAMP WITH TIME ZONE PATH '$.finishedAt'
             ));

    -- Assicura che ogni giocatore della partita esista in rubrica (id + nome minimi).
    FOR pl IN (
      SELECT id, name
        FROM JSON_TABLE(p_body, '$.players[*]'
               COLUMNS (
                 id   VARCHAR2(60)  PATH '$.id',
                 name VARCHAR2(120) PATH '$.name'
               ))
    ) LOOP
      upsert_player(pl.id, pl.name);
    END LOOP;

    MERGE INTO games g
    USING (SELECT v_game_id AS id FROM dual) src
    ON (g.id = src.id)
    WHEN NOT MATCHED THEN
      INSERT (id, game_mode, num_players, start_dealer_id, created_at, finished_at)
      VALUES (v_game_id, v_mode, v_num_players, v_dealer_id, v_created_at, v_finished_at)
    WHEN MATCHED THEN
      UPDATE SET finished_at = v_finished_at;

    -- Idempotenza: se questa partita era già stata inviata, sostituisce completamente
    -- giocatori al tavolo, turni e chiamate con la versione ricevuta ora.
    DELETE FROM round_bids WHERE round_id IN (SELECT id FROM rounds WHERE game_id = v_game_id);
    DELETE FROM rounds WHERE game_id = v_game_id;
    DELETE FROM game_players WHERE game_id = v_game_id;

    INSERT INTO game_players (game_id, player_id, seat_order)
    SELECT v_game_id, id, seat_order
      FROM JSON_TABLE(p_body, '$.players[*]'
             COLUMNS (
               id         VARCHAR2(60) PATH '$.id',
               seat_order NUMBER       PATH '$.seatOrder'
             ));

    FOR r IN (
      SELECT idx, cards_dealt, presa_value, rispetto_value, dealer_id, results
        FROM JSON_TABLE(p_body, '$.rounds[*]'
               COLUMNS (
                 idx            NUMBER       PATH '$.index',
                 cards_dealt    NUMBER       PATH '$.cardsDealt',
                 presa_value    NUMBER       PATH '$.presaValue',
                 rispetto_value NUMBER       PATH '$.rispettoValue',
                 dealer_id      VARCHAR2(60) PATH '$.dealerId',
                 results        CLOB FORMAT JSON PATH '$.results'
               ))
    ) LOOP
      INSERT INTO rounds (game_id, round_index, cards_dealt, presa_value, rispetto_value, dealer_player_id)
      VALUES (v_game_id, r.idx, r.cards_dealt, r.presa_value, r.rispetto_value, r.dealer_id)
      RETURNING id INTO v_round_id;

      INSERT INTO round_bids (round_id, player_id, bid, respected, scarto, score)
      SELECT v_round_id, player_id, bid, CASE WHEN respected = 'true' THEN 'Y' ELSE 'N' END, scarto, score
        FROM JSON_TABLE(r.results, '$[*]'
               COLUMNS (
                 player_id VARCHAR2(60)  PATH '$.playerId',
                 bid       NUMBER        PATH '$.bid',
                 respected VARCHAR2(10)  PATH '$.respected',
                 scarto    NUMBER        PATH '$.scarto',
                 score     NUMBER        PATH '$.score'
               ));
    END LOOP;

    COMMIT;
  END sync_game;

END taotl_api;
/
