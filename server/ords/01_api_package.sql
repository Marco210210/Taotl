-- Pacchetto PL/SQL con la logica applicativa richiamata dai handler ORDS.
-- La logica di business resta nel database, come da guida originale
-- (Sviluppo_App_Expo_Oracle.md): ORDS espone solo l'endpoint REST, qui dentro
-- avviene tutta la validazione/inserimento.

CREATE OR REPLACE PACKAGE taotl_api AS

  -- Verifica la chiave applicativa condivisa (header X-App-Key). Solleva un errore
  -- applicativo (=> HTTP 500 con messaggio) se manca o non corrisponde.
  -- NB: protezione leggera pensata per un'app fra amici, non per dati sensibili.
  PROCEDURE check_app_key(p_key IN VARCHAR2);

  -- Scrive una risposta JSON CLOB a blocchi, evitando la conversione implicita
  -- a VARCHAR2 (e quindi ORA-06502 quando lo storico supera 32 KB).
  PROCEDURE print_clob(p_value IN CLOB);

  -- Operazioni sulla rubrica. Le scritture passano dal package invece che da
  -- AutoREST, così la chiave condivisa viene verificata e gli aggiornamenti
  -- parziali non azzerano le altre colonne.
  PROCEDURE create_player(
    p_authorization IN VARCHAR2,
    p_body IN BLOB
  );

  PROCEDURE update_player(
    p_authorization IN VARCHAR2,
    p_id   IN VARCHAR2,
    p_body IN BLOB
  );

  PROCEDURE update_player_photo(
    p_authorization IN VARCHAR2,
    p_id         IN VARCHAR2,
    p_body       IN BLOB,
    p_media_type IN VARCHAR2
  );

  FUNCTION list_players(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION get_player(p_authorization IN VARCHAR2, p_id IN VARCHAR2) RETURN CLOB;
  FUNCTION can_read_player(p_account_id IN VARCHAR2, p_id IN VARCHAR2) RETURN NUMBER;
  PROCEDURE serve_player_photo(p_authorization IN VARCHAR2, p_id IN VARCHAR2);

  -- Cancellazioni riservate all'admin (vedi taotl_identity_api.require_admin):
  -- non usano più la chiave app condivisa ma il token di sessione di chi chiama,
  -- così solo l'account admin può eliminare giocatori o partite.
  PROCEDURE delete_player(
    p_authorization IN VARCHAR2,
    p_id            IN VARCHAR2
  );

  PROCEDURE delete_game(
    p_authorization IN VARCHAR2,
    p_id            IN VARCHAR2
  );

  -- Riceve il JSON di una partita conclusa (vedi src/api/types.ts -> GameSyncPayload
  -- nell'app) e la registra in un'unica transazione: partita, giocatori al tavolo,
  -- turni e chiamate. Idempotente: se la stessa partita (stesso id) viene rimandata,
  -- turni e chiamate vengono sostituiti.
  PROCEDURE sync_game(p_authorization IN VARCHAR2, p_body IN BLOB);
  FUNCTION can_read_game(p_account_id IN VARCHAR2, p_game_id IN VARCHAR2) RETURN NUMBER;
  FUNCTION list_games(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION get_game(p_authorization IN VARCHAR2, p_id IN VARCHAR2) RETURN CLOB;
  FUNCTION list_manual_games(p_authorization IN VARCHAR2, p_player_id IN VARCHAR2) RETURN CLOB;

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

  PROCEDURE print_clob(p_value IN CLOB) IS
    v_offset PLS_INTEGER := 1;
    v_length PLS_INTEGER;
  BEGIN
    IF p_value IS NULL THEN
      RETURN;
    END IF;
    v_length := DBMS_LOB.getlength(p_value);
    WHILE v_offset <= v_length LOOP
      HTP.prn(DBMS_LOB.substr(p_value, 8000, v_offset));
      v_offset := v_offset + 8000;
    END LOOP;
  END print_clob;

  PROCEDURE create_player(
    p_authorization IN VARCHAR2,
    p_body IN BLOB
  ) IS
    v_id   players.id%TYPE;
    v_name players.name%TYPE;
    v_exists NUMBER;
    v_account_id VARCHAR2(60);
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);

    SELECT JSON_VALUE(p_body, '$.id' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(120))
      INTO v_id, v_name
      FROM dual;

    IF v_id IS NULL OR TRIM(v_name) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Id e nome del giocatore sono obbligatori.');
    END IF;

    SELECT COUNT(*)
      INTO v_exists
      FROM players
     WHERE is_active = 'Y'
       AND LOWER(TRIM(name)) = LOWER(TRIM(v_name));
    IF v_exists > 0 THEN
      RAISE_APPLICATION_ERROR(-20409, 'Esiste già un giocatore con questo nome.');
    END IF;

    INSERT INTO players (id, name, owner_account_id)
    VALUES (v_id, TRIM(v_name), v_account_id);
    COMMIT;
  END create_player;

  PROCEDURE update_player(
    p_authorization IN VARCHAR2,
    p_id   IN VARCHAR2,
    p_body IN BLOB
  ) IS
    v_name players.name%TYPE;
    v_exists NUMBER;
    v_linked NUMBER;
    v_account_id VARCHAR2(60);
    v_allowed NUMBER;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COUNT(*) INTO v_allowed FROM players p JOIN taotl_accounts a ON a.id = v_account_id
     WHERE p.id = p_id AND (p.owner_account_id = v_account_id OR a.is_admin = 'Y');
    IF v_allowed = 0 THEN RAISE_APPLICATION_ERROR(-20403, 'Non puoi modificare questo profilo.'); END IF;

    SELECT JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(120))
      INTO v_name
      FROM dual;

    IF TRIM(v_name) IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il nome del giocatore è obbligatorio.');
    END IF;

    SELECT COUNT(*)
      INTO v_linked
      FROM taotl_account_players
     WHERE player_id = p_id;
    IF v_linked > 0 THEN
      RAISE_APPLICATION_ERROR(-20409,
        'Il nome è gestito dal Taotl ID collegato e non può essere modificato dalla rubrica.');
    END IF;

    SELECT COUNT(*)
      INTO v_exists
      FROM players
     WHERE is_active = 'Y'
       AND id != p_id
       AND LOWER(TRIM(name)) = LOWER(TRIM(v_name));
    IF v_exists > 0 THEN
      RAISE_APPLICATION_ERROR(-20409, 'Esiste già un giocatore con questo nome.');
    END IF;

    UPDATE players
       SET name = TRIM(v_name)
     WHERE id = p_id
       AND is_active = 'Y';

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    COMMIT;
  END update_player;

  PROCEDURE update_player_photo(
    p_authorization IN VARCHAR2,
    p_id         IN VARCHAR2,
    p_body       IN BLOB,
    p_media_type IN VARCHAR2
  ) IS
    v_account_id VARCHAR2(60);
    v_allowed NUMBER;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COUNT(*) INTO v_allowed FROM players p JOIN taotl_accounts a ON a.id = v_account_id
     WHERE p.id = p_id AND (p.owner_account_id = v_account_id OR a.is_admin = 'Y');
    IF v_allowed = 0 THEN RAISE_APPLICATION_ERROR(-20403, 'Non puoi modificare questo profilo.'); END IF;

    UPDATE players
       SET photo = p_body,
           photo_media_type = NVL(p_media_type, 'application/octet-stream')
     WHERE id = p_id
       AND is_active = 'Y';

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    COMMIT;
  END update_player_photo;

  FUNCTION list_players(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
      'id' VALUE d.id, 'name' VALUE d.player_name,
      'hasPhoto' VALUE CASE WHEN d.photo IS NULL THEN 'false' ELSE 'true' END FORMAT JSON
      RETURNING CLOB) ORDER BY d.created_at, d.player_name RETURNING CLOB), TO_CLOB('[]'))
      INTO v_json
      FROM player_display_names_v d
      JOIN players base_player ON base_player.id = d.id
      JOIN taotl_accounts a ON a.id = v_account_id
     WHERE d.is_active = 'Y'
       AND (a.is_admin = 'Y' OR base_player.owner_account_id = v_account_id OR EXISTS (
         SELECT 1 FROM taotl_leaderboard_players lp
         JOIN taotl_account_leaderboards al ON al.leaderboard_id = lp.leaderboard_id
          WHERE lp.player_id = d.id AND al.account_id = v_account_id
       ));
    COMMIT;
    RETURN v_json;
  END list_players;

  FUNCTION can_read_player(p_account_id IN VARCHAR2, p_id IN VARCHAR2) RETURN NUMBER IS
    v_allowed NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_allowed
      FROM players base_player JOIN taotl_accounts a ON a.id = p_account_id
     WHERE base_player.id = p_id AND base_player.is_active = 'Y'
       AND (a.is_admin = 'Y' OR base_player.owner_account_id = p_account_id OR EXISTS (
         SELECT 1 FROM taotl_leaderboard_players lp
         JOIN taotl_account_leaderboards al ON al.leaderboard_id = lp.leaderboard_id
          WHERE lp.player_id = base_player.id AND al.account_id = p_account_id
       ));
    RETURN v_allowed;
  END can_read_player;

  PROCEDURE serve_player_photo(p_authorization IN VARCHAR2, p_id IN VARCHAR2) IS
    v_account_id VARCHAR2(60);
    v_photo BLOB;
    v_media_type VARCHAR2(120);
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    IF can_read_player(v_account_id, p_id) = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Foto non trovata.'); END IF;
    SELECT photo, NVL(photo_media_type, 'application/octet-stream') INTO v_photo, v_media_type
      FROM players WHERE id = p_id AND photo IS NOT NULL;
    OWA_UTIL.mime_header(v_media_type, FALSE);
    HTP.p('Cache-Control: private, max-age=3600');
    HTP.p('Content-Length: ' || DBMS_LOB.getlength(v_photo));
    OWA_UTIL.http_header_close;
    WPG_DOCLOAD.download_file(v_photo);
  EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20404, 'Foto non trovata.');
  END serve_player_photo;

  FUNCTION get_player(p_authorization IN VARCHAR2, p_id IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT JSON_OBJECT(
      'id' VALUE d.id, 'name' VALUE d.player_name,
      'hasPhoto' VALUE CASE WHEN d.photo IS NULL THEN 'false' ELSE 'true' END FORMAT JSON
      RETURNING CLOB) INTO v_json
      FROM player_display_names_v d
      JOIN players base_player ON base_player.id = d.id
      JOIN taotl_accounts a ON a.id = v_account_id
     WHERE d.id = p_id AND d.is_active = 'Y'
       AND (a.is_admin = 'Y' OR base_player.owner_account_id = v_account_id OR EXISTS (
         SELECT 1 FROM taotl_leaderboard_players lp
         JOIN taotl_account_leaderboards al ON al.leaderboard_id = lp.leaderboard_id
          WHERE lp.player_id = d.id AND al.account_id = v_account_id
       ));
    COMMIT;
    RETURN v_json;
  EXCEPTION WHEN NO_DATA_FOUND THEN RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
  END get_player;

  PROCEDURE delete_player(
    p_authorization IN VARCHAR2,
    p_id            IN VARCHAR2
  ) IS
    v_admin_id VARCHAR2(60);
  BEGIN
    v_admin_id := taotl_identity_api.require_admin(p_authorization);

    UPDATE players
       SET is_active = 'N',
           photo = NULL,
           photo_media_type = NULL
     WHERE id = p_id
       AND is_active = 'Y';

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    COMMIT;
  END delete_player;

  PROCEDURE delete_game(
    p_authorization IN VARCHAR2,
    p_id            IN VARCHAR2
  ) IS
    v_account_id VARCHAR2(60);
    v_allowed NUMBER;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);

    SELECT COUNT(*) INTO v_allowed
      FROM games g
      JOIN taotl_accounts a ON a.id = v_account_id
     WHERE g.id = p_id
       AND (
         a.is_admin = 'Y'
         OR g.owner_account_id = v_account_id
         OR EXISTS (
           SELECT 1 FROM taotl_account_leaderboards al
            WHERE al.account_id = v_account_id
              AND al.leaderboard_id = g.leaderboard_id
              AND al.role IN ('owner', 'manager')
         )
       );
    IF v_allowed = 0 THEN
      RAISE_APPLICATION_ERROR(-20403, 'Non hai i permessi per eliminare questa partita.');
    END IF;

    DELETE FROM games
     WHERE id = p_id;

    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Partita non trovata.');
    END IF;

    COMMIT;
  END delete_game;

  PROCEDURE upsert_player(p_id IN VARCHAR2, p_name IN VARCHAR2, p_owner_account_id IN VARCHAR2) IS
  BEGIN
    MERGE INTO players p
    USING (SELECT p_id AS id, p_name AS name FROM dual) src
    ON (p.id = src.id)
    WHEN NOT MATCHED THEN
      INSERT (id, name, owner_account_id) VALUES (src.id, src.name, p_owner_account_id);
  END upsert_player;

  PROCEDURE sync_game(p_authorization IN VARCHAR2, p_body IN BLOB) IS
    v_account_id  taotl_accounts.id%TYPE;
    v_is_admin    taotl_accounts.is_admin%TYPE;
    v_game_id     games.id%TYPE;
    v_mode        games.game_mode%TYPE;
    v_num_players games.num_players%TYPE;
    v_dealer_id   games.start_dealer_id%TYPE;
    v_created_at  games.created_at%TYPE;
    v_finished_at games.finished_at%TYPE;
    v_tie_winner  games.tie_break_winner_id%TYPE;
    v_leaderboard_id games.leaderboard_id%TYPE;
    v_leaderboard_valid NUMBER;
    v_existing_owner games.owner_account_id%TYPE;
    v_round_id    rounds.id%TYPE;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT is_admin INTO v_is_admin FROM taotl_accounts WHERE id = v_account_id;
    SELECT id, game_mode, num_players, start_dealer_id, created_at, finished_at,
           JSON_VALUE(p_body, '$.tieBreakWinnerId' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.leaderboardId' RETURNING VARCHAR2(60))
      INTO v_game_id, v_mode, v_num_players, v_dealer_id, v_created_at, v_finished_at,
           v_tie_winner, v_leaderboard_id
      FROM JSON_TABLE(p_body, '$'
             COLUMNS (
               id             VARCHAR2(60)  PATH '$.id',
               game_mode      VARCHAR2(20)  PATH '$.mode',
               num_players    NUMBER        PATH '$.numPlayers',
               start_dealer_id VARCHAR2(60) PATH '$.startDealerId',
               created_at     TIMESTAMP WITH TIME ZONE PATH '$.createdAt',
               finished_at    TIMESTAMP WITH TIME ZONE PATH '$.finishedAt'
             ));

    IF v_leaderboard_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_leaderboard_valid
        FROM taotl_leaderboards l
       WHERE l.id = v_leaderboard_id
         AND l.is_active = 'Y'
         AND (
           v_is_admin = 'Y'
           OR EXISTS (
             SELECT 1 FROM taotl_account_leaderboards al
              WHERE al.account_id = v_account_id
                AND al.leaderboard_id = l.id
                AND al.role IN ('owner', 'manager', 'member')
           )
         );
      IF v_leaderboard_valid = 0 THEN
        RAISE_APPLICATION_ERROR(-20403, 'Non puoi pubblicare in questa classifica.');
      END IF;
    END IF;

    BEGIN
      SELECT owner_account_id INTO v_existing_owner FROM games WHERE id = v_game_id;
      IF v_is_admin != 'Y' AND v_existing_owner != v_account_id THEN
        RAISE_APPLICATION_ERROR(-20403, 'Questa partita appartiene a un altro account.');
      END IF;
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;

    -- Assicura che ogni giocatore della partita esista in rubrica (id + nome minimi).
    FOR pl IN (
      SELECT id, name
        FROM JSON_TABLE(p_body, '$.players[*]'
               COLUMNS (
                 id   VARCHAR2(60)  PATH '$.id',
                 name VARCHAR2(120) PATH '$.name'
               ))
    ) LOOP
      upsert_player(pl.id, pl.name, v_account_id);
    END LOOP;

    MERGE INTO games g
    USING (SELECT v_game_id AS id FROM dual) src
    ON (g.id = src.id)
    WHEN NOT MATCHED THEN
      INSERT (id, game_mode, num_players, start_dealer_id, created_at, finished_at,
              tie_break_winner_id, leaderboard_id, owner_account_id)
      VALUES (v_game_id, v_mode, v_num_players, v_dealer_id, v_created_at, v_finished_at,
              v_tie_winner, v_leaderboard_id, v_account_id)
    WHEN MATCHED THEN
      UPDATE SET finished_at = v_finished_at,
                 tie_break_winner_id = v_tie_winner,
                 leaderboard_id = v_leaderboard_id;

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

    IF v_leaderboard_id IS NOT NULL THEN
      MERGE INTO taotl_leaderboard_players lp
      USING (
        SELECT v_leaderboard_id AS leaderboard_id, gp.player_id
          FROM game_players gp WHERE gp.game_id = v_game_id
      ) src
      ON (lp.leaderboard_id = src.leaderboard_id AND lp.player_id = src.player_id)
      WHEN NOT MATCHED THEN
        INSERT (leaderboard_id, player_id, added_by)
        VALUES (src.leaderboard_id, src.player_id, v_account_id);
    END IF;

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

  FUNCTION can_read_game(p_account_id IN VARCHAR2, p_game_id IN VARCHAR2) RETURN NUMBER IS
    v_allowed NUMBER;
  BEGIN
    SELECT COUNT(*) INTO v_allowed
      FROM games g
      JOIN taotl_accounts a ON a.id = p_account_id
     WHERE g.id = p_game_id
       AND (a.is_admin = 'Y' OR g.owner_account_id = p_account_id OR EXISTS (
         SELECT 1 FROM taotl_account_leaderboards al
          WHERE al.account_id = p_account_id AND al.leaderboard_id = g.leaderboard_id
       ));
    RETURN v_allowed;
  END can_read_game;

  FUNCTION list_games(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COALESCE(JSON_ARRAYAGG(
      JSON_OBJECT(
        'id' VALUE g.id, 'leaderboardId' VALUE g.leaderboard_id,
        'mode' VALUE g.game_mode,
        'numPlayers' VALUE (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id),
        'winnerId' VALUE g.winner_player_id,
        'startedAt' VALUE TO_CHAR(g.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
        'endedAt' VALUE TO_CHAR(g.finished_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
        'standings' VALUE (
          SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'playerId' VALUE s.player_id, 'name' VALUE s.player_name, 'total' VALUE s.total
            RETURNING CLOB) ORDER BY s.manual_won DESC, s.total DESC NULLS LAST RETURNING CLOB)
          FROM game_standings_v s WHERE s.game_id = g.id
        ) FORMAT JSON RETURNING CLOB
      ) ORDER BY g.created_at DESC RETURNING CLOB), TO_CLOB('[]')) INTO v_json
      FROM games g
     WHERE g.finished_at IS NOT NULL AND can_read_game(v_account_id, g.id) = 1;
    COMMIT;
    RETURN v_json;
  END list_games;

  FUNCTION get_game(p_authorization IN VARCHAR2, p_id IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    IF can_read_game(v_account_id, p_id) = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Partita non trovata.');
    END IF;
    SELECT JSON_OBJECT(
      'id' VALUE g.id, 'leaderboardId' VALUE g.leaderboard_id, 'mode' VALUE g.game_mode,
      'numPlayers' VALUE (SELECT COUNT(*) FROM game_players gp WHERE gp.game_id = g.id),
      'winnerId' VALUE g.winner_player_id, 'startDealerId' VALUE g.start_dealer_id,
      'startedAt' VALUE TO_CHAR(g.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
      'endedAt' VALUE TO_CHAR(g.finished_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
      'players' VALUE (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id' VALUE gp.player_id, 'name' VALUE p.player_name,
          'seatOrder' VALUE gp.seat_order RETURNING CLOB) ORDER BY gp.seat_order RETURNING CLOB)
          FROM game_players gp JOIN player_display_names_v p ON p.id = gp.player_id WHERE gp.game_id = g.id
      ) FORMAT JSON,
      'standings' VALUE (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('playerId' VALUE s.player_id, 'name' VALUE s.player_name,
          'total' VALUE s.total RETURNING CLOB) ORDER BY s.manual_won DESC, s.total DESC NULLS LAST RETURNING CLOB)
          FROM game_standings_v s WHERE s.game_id = g.id
      ) FORMAT JSON,
      'rounds' VALUE (
        SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
          'index' VALUE r.round_index, 'cardsDealt' VALUE r.cards_dealt,
          'presaValue' VALUE r.presa_value, 'rispettoValue' VALUE r.rispetto_value,
          'dealerId' VALUE r.dealer_player_id,
          'results' VALUE (
            SELECT JSON_ARRAYAGG(JSON_OBJECT(
              'playerId' VALUE rb.player_id, 'name' VALUE p.player_name, 'bid' VALUE rb.bid,
              'respected' VALUE CASE rb.respected WHEN 'Y' THEN 'true' ELSE 'false' END FORMAT JSON,
              'scarto' VALUE rb.scarto, 'score' VALUE rb.score RETURNING CLOB)
              ORDER BY gp.seat_order RETURNING CLOB)
              FROM round_bids rb JOIN player_display_names_v p ON p.id = rb.player_id
              JOIN game_players gp ON gp.game_id = g.id AND gp.player_id = rb.player_id
             WHERE rb.round_id = r.id
          ) FORMAT JSON RETURNING CLOB
        ) ORDER BY r.round_index RETURNING CLOB), TO_CLOB('[]'))
          FROM rounds r WHERE r.game_id = g.id
      ) FORMAT JSON RETURNING CLOB
    ) INTO v_json FROM games g WHERE g.id = p_id AND g.finished_at IS NOT NULL;
    COMMIT;
    RETURN v_json;
  EXCEPTION WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20404, 'Partita non trovata.');
  END get_game;

  FUNCTION list_manual_games(p_authorization IN VARCHAR2, p_player_id IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COALESCE(JSON_ARRAYAGG(JSON_OBJECT(
      'id' VALUE g.id, 'leaderboardId' VALUE g.leaderboard_id,
      'playedAt' VALUE TO_CHAR(g.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
      'winnerId' VALUE g.winner_player_id, 'winnerName' VALUE winner.player_name,
      'myScore' VALUE selected_player.final_score,
      'participants' VALUE (
        SELECT JSON_ARRAYAGG(JSON_OBJECT('id' VALUE p.id, 'name' VALUE p.player_name RETURNING CLOB) RETURNING CLOB)
          FROM game_players all_players JOIN player_display_names_v p ON p.id = all_players.player_id
         WHERE all_players.game_id = g.id
      ) FORMAT JSON RETURNING CLOB
    ) ORDER BY g.created_at DESC RETURNING CLOB), TO_CLOB('[]')) INTO v_json
      FROM games g
      JOIN game_players selected_player ON selected_player.game_id = g.id AND selected_player.player_id = p_player_id
      LEFT JOIN player_display_names_v winner ON winner.id = g.winner_player_id
     WHERE g.is_manual = 'Y' AND can_read_game(v_account_id, g.id) = 1;
    COMMIT;
    RETURN v_json;
  END list_manual_games;

END taotl_api;
/
