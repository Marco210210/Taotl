-- API Taotl ID. Richiede prima server/sql/04_identity_and_verified_rooms.sql
-- e server/sql/05_profile_and_admin.sql (nome/cognome/is_admin/taotl_account_players)
-- e server/sql/08_verified_stats_and_legacy_wins.sql
-- (games.counts_for_win_rate e player_overall_stats_v).
-- Richiede anche, eseguito una volta come ADMIN: GRANT EXECUTE ON DBMS_CRYPTO TO taotl_app;
--
-- La password non viene mai salvata: viene memorizzato solo hash_password(salt,
-- password), cioè SHA-256 applicato 100.000 volte in catena. Le iterazioni alzano
-- il costo di un attacco a forza bruta offline (es. se il database venisse mai
-- copiato) da istantaneo a minuti/ore anche con hardware potente.
-- I token di sessione restano su singolo SHA-256: sono valori casuali ad alta
-- entropia (non una password scelta da una persona), quindi non serve lo stretching.

CREATE OR REPLACE PACKAGE taotl_identity_api AS
  -- Dichiarate qui (anche se di uso interno) perché richiamate da dentro istruzioni
  -- SQL nel package body: Oracle richiede che siano nella specifica per poterle usare in SQL.
  FUNCTION sha256(p_value IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION hash_password(p_salt IN VARCHAR2, p_password IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION normalized_handle(p_value IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION account_json(p_account_id IN VARCHAR2) RETURN CLOB;

  FUNCTION register_account(p_body IN BLOB) RETURN CLOB;
  FUNCTION login_account(p_body IN BLOB) RETURN CLOB;
  FUNCTION my_account(p_authorization IN VARCHAR2) RETURN CLOB;
  PROCEDURE logout_account(p_authorization IN VARCHAR2);
  FUNCTION create_room(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION join_room(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION get_room(p_authorization IN VARCHAR2, p_room_id IN VARCHAR2) RETURN CLOB;
  FUNCTION complete_room_game(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;

  -- Amministrazione: richiamate da fuori questo package (taotl_api, handler ORDS),
  -- quindi devono stare nella specifica.
  FUNCTION require_admin(p_authorization IN VARCHAR2) RETURN VARCHAR2;
  FUNCTION link_account_player(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION add_manual_game(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION overall_leaderboard RETURN CLOB;
  FUNCTION list_accounts(p_authorization IN VARCHAR2) RETURN CLOB;

  -- Recupero password via email. Non rivela mai se un handle/email esiste
  -- (stessa risposta generica in ogni caso) per non permettere di scoprire
  -- chi è registrato.
  FUNCTION request_password_reset(p_body IN BLOB) RETURN CLOB;
  FUNCTION confirm_password_reset(p_body IN BLOB) RETURN CLOB;
END taotl_identity_api;
/

CREATE OR REPLACE PACKAGE BODY taotl_identity_api AS

  FUNCTION sha256(p_value IN VARCHAR2) RETURN VARCHAR2 IS
    PRAGMA UDF;
    v_hash VARCHAR2(64);
  BEGIN
    SELECT LOWER(RAWTOHEX(STANDARD_HASH(p_value, 'SHA256')))
      INTO v_hash
      FROM dual;
    RETURN v_hash;
  END sha256;

  FUNCTION hash_password(p_salt IN VARCHAR2, p_password IN VARCHAR2) RETURN VARCHAR2 IS
    PRAGMA UDF;
    c_rounds CONSTANT PLS_INTEGER := 100000;
    v_raw RAW(2000);
  BEGIN
    v_raw := UTL_RAW.CAST_TO_RAW(p_salt || ':' || p_password);
    FOR i IN 1..c_rounds LOOP
      v_raw := DBMS_CRYPTO.HASH(v_raw, DBMS_CRYPTO.HASH_SH256);
    END LOOP;
    RETURN LOWER(RAWTOHEX(v_raw));
  END hash_password;

  FUNCTION normalized_handle(p_value IN VARCHAR2) RETURN VARCHAR2 IS
    PRAGMA UDF;
  BEGIN
    RETURN LOWER(TRIM(REPLACE(p_value, '@', '')));
  END normalized_handle;

  FUNCTION account_json(p_account_id IN VARCHAR2) RETURN CLOB IS
    PRAGMA UDF;
    v_json CLOB;
  BEGIN
    SELECT JSON_OBJECT(
             'id'             VALUE a.id,
             'handle'         VALUE a.handle_normalized,
             'displayName'    VALUE a.display_name,
             'firstName'      VALUE a.first_name,
             'lastName'       VALUE a.last_name,
             'email'          VALUE a.email,
             'isAdmin'        VALUE CASE WHEN a.is_admin = 'Y' THEN 'true' ELSE 'false' END FORMAT JSON,
             'linkedPlayerId' VALUE ap.player_id,
             'createdAt'      VALUE TO_CHAR(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
             RETURNING CLOB
           )
      INTO v_json
      FROM taotl_accounts a
      LEFT JOIN taotl_account_players ap ON ap.account_id = a.id
     WHERE a.id = p_account_id
       AND a.is_active = 'Y';
    RETURN v_json;
  END account_json;

  FUNCTION new_session(p_account_id IN VARCHAR2) RETURN CLOB IS
    v_token      VARCHAR2(64);
    v_token_hash VARCHAR2(64);
    v_expires_at TIMESTAMP WITH TIME ZONE := SYSTIMESTAMP + INTERVAL '30' DAY;
    v_json       CLOB;
  BEGIN
    v_token := LOWER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));
    v_token_hash := sha256(v_token);

    DELETE FROM taotl_sessions
     WHERE account_id = p_account_id
       AND expires_at <= SYSTIMESTAMP;

    INSERT INTO taotl_sessions(token_hash, account_id, expires_at)
    VALUES (v_token_hash, p_account_id, v_expires_at);

    SELECT JSON_OBJECT(
             'token'     VALUE v_token,
             'expiresAt' VALUE TO_CHAR(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
             'account'   VALUE account_json(p_account_id) FORMAT JSON
             RETURNING CLOB
           )
      INTO v_json
      FROM dual;
    RETURN v_json;
  END new_session;

  FUNCTION require_account(p_authorization IN VARCHAR2) RETURN VARCHAR2 IS
    v_token      VARCHAR2(200);
    v_account_id taotl_accounts.id%TYPE;
  BEGIN
    IF p_authorization IS NULL OR UPPER(SUBSTR(TRIM(p_authorization), 1, 7)) != 'BEARER ' THEN
      RAISE_APPLICATION_ERROR(-20401, 'Sessione mancante.');
    END IF;

    v_token := SUBSTR(TRIM(p_authorization), 8);
    SELECT s.account_id
      INTO v_account_id
      FROM taotl_sessions s
      JOIN taotl_accounts a ON a.id = s.account_id
     WHERE s.token_hash = sha256(v_token)
       AND s.expires_at > SYSTIMESTAMP
       AND a.is_active = 'Y';

    UPDATE taotl_sessions
       SET last_seen_at = SYSTIMESTAMP
     WHERE token_hash = sha256(v_token);
    RETURN v_account_id;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20401, 'Sessione scaduta o non valida.');
  END require_account;

  FUNCTION require_admin(p_authorization IN VARCHAR2) RETURN VARCHAR2 IS
    v_account_id taotl_accounts.id%TYPE;
    v_is_admin   taotl_accounts.is_admin%TYPE;
  BEGIN
    v_account_id := require_account(p_authorization);
    SELECT is_admin INTO v_is_admin FROM taotl_accounts WHERE id = v_account_id;
    IF v_is_admin != 'Y' THEN
      RAISE_APPLICATION_ERROR(-20403, 'Solo l''amministratore puo'' eseguire questa azione.');
    END IF;
    RETURN v_account_id;
  END require_admin;

  FUNCTION room_json(p_room_id IN VARCHAR2) RETURN CLOB IS
    PRAGMA UDF;
    v_json CLOB;
  BEGIN
    SELECT JSON_OBJECT(
             'id'        VALUE r.id,
             'code'      VALUE r.join_code,
             'status'    VALUE r.status,
             'expiresAt' VALUE TO_CHAR(r.expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'),
             'participants' VALUE (
               SELECT COALESCE(
                        JSON_ARRAYAGG(
                          JSON_OBJECT(
                            'userId'      VALUE a.id,
                            'handle'      VALUE a.handle_normalized,
                            'displayName' VALUE a.display_name,
                            'isHost'      VALUE
                              CASE WHEN p.is_host = 'Y' THEN 'true' ELSE 'false' END FORMAT JSON,
                            'joinedAt'    VALUE
                              TO_CHAR(p.joined_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
                            RETURNING CLOB
                          )
                          ORDER BY p.is_host DESC, p.joined_at
                          RETURNING CLOB
                        ),
                        TO_CLOB('[]')
                      )
                 FROM taotl_room_participants p
                 JOIN taotl_accounts a ON a.id = p.account_id
                WHERE p.room_id = r.id
             ) FORMAT JSON
             RETURNING CLOB
           )
      INTO v_json
      FROM taotl_game_rooms r
     WHERE r.id = p_room_id;
    RETURN v_json;
  END room_json;

  FUNCTION register_account(p_body IN BLOB) RETURN CLOB IS
    v_id           taotl_accounts.id%TYPE;
    v_handle       taotl_accounts.handle_normalized%TYPE;
    v_display_name taotl_accounts.display_name%TYPE;
    v_first_name   taotl_accounts.first_name%TYPE;
    v_last_name    taotl_accounts.last_name%TYPE;
    v_email        taotl_accounts.email%TYPE;
    v_password     VARCHAR2(200);
    v_salt         VARCHAR2(64);
    v_json         CLOB;
    v_existing     NUMBER;
  BEGIN
    SELECT normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           TRIM(JSON_VALUE(p_body, '$.displayName' RETURNING VARCHAR2(80))),
           TRIM(JSON_VALUE(p_body, '$.firstName' RETURNING VARCHAR2(80))),
           TRIM(JSON_VALUE(p_body, '$.lastName' RETURNING VARCHAR2(80))),
           LOWER(TRIM(JSON_VALUE(p_body, '$.email' RETURNING VARCHAR2(160)))),
           JSON_VALUE(p_body, '$.password' RETURNING VARCHAR2(200))
      INTO v_handle, v_display_name, v_first_name, v_last_name, v_email, v_password
      FROM dual;

    IF NOT REGEXP_LIKE(v_handle, '^[a-z0-9_]{3,24}$') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Taotl ID non valido.');
    END IF;
    IF v_display_name IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Nome mostrato obbligatorio.');
    END IF;
    IF v_first_name IS NULL OR v_last_name IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Nome e cognome sono obbligatori.');
    END IF;
    IF v_email IS NULL OR NOT REGEXP_LIKE(v_email, '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Indirizzo email non valido.');
    END IF;
    IF v_password IS NULL OR LENGTH(v_password) < 8 OR LENGTH(v_password) > 72
       OR NOT REGEXP_LIKE(v_password, '[[:upper:]]')
       OR NOT REGEXP_LIKE(v_password, '[0-9]') THEN
      RAISE_APPLICATION_ERROR(-20400,
        'La password deve avere da 8 a 72 caratteri, una maiuscola e un numero.');
    END IF;

    SELECT COUNT(*)
      INTO v_existing
      FROM taotl_accounts
     WHERE handle_normalized = v_handle;
    IF v_existing > 0 THEN
      RAISE_APPLICATION_ERROR(-20409, 'Questo Taotl ID è già in uso.');
    END IF;

    SELECT COUNT(*)
      INTO v_existing
      FROM taotl_accounts
     WHERE email = v_email;
    IF v_existing > 0 THEN
      RAISE_APPLICATION_ERROR(-20409, 'Questa email è già collegata a un account.');
    END IF;

    v_id := 'usr_' || LOWER(RAWTOHEX(SYS_GUID()));
    v_salt := LOWER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));

    INSERT INTO taotl_accounts(
      id, handle_normalized, display_name, first_name, last_name, email, password_salt, password_hash
    ) VALUES (
      v_id, v_handle, v_display_name, v_first_name, v_last_name, v_email, v_salt,
      hash_password(v_salt, v_password)
    );

    v_json := new_session(v_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20409, 'Questo Taotl ID o questa email sono già in uso.');
  END register_account;

  FUNCTION login_account(p_body IN BLOB) RETURN CLOB IS
    v_handle        taotl_accounts.handle_normalized%TYPE;
    v_password      VARCHAR2(200);
    v_account_id    taotl_accounts.id%TYPE;
    v_salt          taotl_accounts.password_salt%TYPE;
    v_password_hash taotl_accounts.password_hash%TYPE;
    v_failed        taotl_accounts.failed_attempts%TYPE;
    v_locked_until  taotl_accounts.locked_until%TYPE;
    v_json          CLOB;
  BEGIN
    SELECT normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           JSON_VALUE(p_body, '$.password' RETURNING VARCHAR2(200))
      INTO v_handle, v_password
      FROM dual;

    SELECT id, password_salt, password_hash, failed_attempts, locked_until
      INTO v_account_id, v_salt, v_password_hash, v_failed, v_locked_until
      FROM taotl_accounts
     WHERE handle_normalized = v_handle
       AND is_active = 'Y'
       FOR UPDATE;

    IF v_locked_until IS NOT NULL AND v_locked_until > SYSTIMESTAMP THEN
      RAISE_APPLICATION_ERROR(-20429, 'Troppi tentativi. Riprova tra 15 minuti.');
    END IF;

    IF v_password IS NULL OR LENGTH(v_password) > 72
       OR hash_password(v_salt, v_password) != v_password_hash THEN
      v_failed := CASE WHEN v_failed >= 5 THEN 1 ELSE v_failed + 1 END;
      UPDATE taotl_accounts
         SET failed_attempts = LEAST(v_failed, 5),
             locked_until = CASE
               WHEN v_failed >= 5 THEN SYSTIMESTAMP + INTERVAL '15' MINUTE
               ELSE NULL
             END
       WHERE id = v_account_id;
      COMMIT;
      RAISE_APPLICATION_ERROR(-20401, 'Taotl ID o password non corretti.');
    END IF;

    UPDATE taotl_accounts
       SET failed_attempts = 0,
           locked_until = NULL
     WHERE id = v_account_id;

    v_json := new_session(v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20401, 'Taotl ID o password non corretti.');
  END login_account;

  FUNCTION my_account(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id taotl_accounts.id%TYPE;
    v_json       CLOB;
  BEGIN
    v_account_id := require_account(p_authorization);
    v_json := account_json(v_account_id);
    COMMIT;
    RETURN v_json;
  END my_account;

  PROCEDURE logout_account(p_authorization IN VARCHAR2) IS
    v_token VARCHAR2(200);
  BEGIN
    IF p_authorization IS NOT NULL
       AND UPPER(SUBSTR(TRIM(p_authorization), 1, 7)) = 'BEARER ' THEN
      v_token := SUBSTR(TRIM(p_authorization), 8);
      DELETE FROM taotl_sessions WHERE token_hash = sha256(v_token);
      COMMIT;
    END IF;
  END logout_account;

  FUNCTION create_room(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id taotl_accounts.id%TYPE;
    v_room_id    taotl_game_rooms.id%TYPE;
    v_code       taotl_game_rooms.join_code%TYPE;
    v_created    BOOLEAN := FALSE;
    v_json       CLOB;
  BEGIN
    v_account_id := require_account(p_authorization);
    v_room_id := 'room_' || LOWER(RAWTOHEX(SYS_GUID()));

    -- Un organizzatore usa un solo codice attivo alla volta: crearne uno nuovo
    -- chiude gli eventuali codici precedenti senza eliminare alcun dato.
    UPDATE taotl_game_rooms
       SET status = 'cancelled'
     WHERE host_account_id = v_account_id
       AND status = 'open';

    FOR i IN 1..10 LOOP
      BEGIN
        v_code := UPPER(SUBSTR(RAWTOHEX(SYS_GUID()), 1, 6));
        INSERT INTO taotl_game_rooms(
          id, join_code, host_account_id, expires_at
        ) VALUES (
          v_room_id, v_code, v_account_id, SYSTIMESTAMP + INTERVAL '24' HOUR
        );
        v_created := TRUE;
        EXIT;
      EXCEPTION
        WHEN DUP_VAL_ON_INDEX THEN NULL;
      END;
    END LOOP;

    IF NOT v_created THEN
      RAISE_APPLICATION_ERROR(-20500, 'Impossibile generare il codice tavolo.');
    END IF;

    INSERT INTO taotl_room_participants(room_id, account_id, is_host)
    VALUES (v_room_id, v_account_id, 'Y');

    v_json := room_json(v_room_id);
    COMMIT;
    RETURN v_json;
  END create_room;

  FUNCTION join_room(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id taotl_accounts.id%TYPE;
    v_code       taotl_game_rooms.join_code%TYPE;
    v_room_id    taotl_game_rooms.id%TYPE;
    v_json       CLOB;
  BEGIN
    v_account_id := require_account(p_authorization);
    SELECT UPPER(TRIM(JSON_VALUE(p_body, '$.code' RETURNING VARCHAR2(20))))
      INTO v_code
      FROM dual;

    SELECT id
      INTO v_room_id
      FROM taotl_game_rooms
     WHERE join_code = v_code
       AND status = 'open'
       AND expires_at > SYSTIMESTAMP;

    MERGE INTO taotl_room_participants p
    USING (
      SELECT v_room_id AS room_id, v_account_id AS account_id FROM dual
    ) src
    ON (p.room_id = src.room_id AND p.account_id = src.account_id)
    WHEN MATCHED THEN UPDATE SET confirmed_at = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (room_id, account_id, is_host)
      VALUES (src.room_id, src.account_id, 'N');

    v_json := room_json(v_room_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20404, 'Codice tavolo non valido o scaduto.');
  END join_room;

  FUNCTION get_room(p_authorization IN VARCHAR2, p_room_id IN VARCHAR2) RETURN CLOB IS
    v_account_id taotl_accounts.id%TYPE;
    v_exists     NUMBER;
    v_json       CLOB;
  BEGIN
    v_account_id := require_account(p_authorization);
    SELECT COUNT(*)
      INTO v_exists
      FROM taotl_room_participants p
      JOIN taotl_game_rooms r ON r.id = p.room_id
     WHERE p.room_id = p_room_id
       AND p.account_id = v_account_id
       AND r.status = 'open'
       AND r.expires_at > SYSTIMESTAMP;
    IF v_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20403, 'Non fai parte di questa stanza.');
    END IF;

    v_json := room_json(p_room_id);
    COMMIT;
    RETURN v_json;
  END get_room;

  -- Collega definitivamente una stanza alla partita appena conclusa. Può farlo
  -- soltanto l'account che ha creato la stanza. Ogni partecipante viene associato
  -- alla partita esclusivamente se:
  --   1) era entrato con il proprio Taotl ID usando il codice;
  --   2) il suo account è collegato a un giocatore della rubrica;
  --   3) quel giocatore era effettivamente tra i partecipanti della partita.
  -- In questo modo il telefono che tiene il punteggio non può attribuire da solo
  -- la presenza a un account che non ha confermato dal proprio dispositivo.
  FUNCTION complete_room_game(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id     taotl_accounts.id%TYPE;
    v_room_id        taotl_game_rooms.id%TYPE;
    v_game_id        games.id%TYPE;
    v_room_valid     NUMBER;
    v_game_valid     NUMBER;
    v_participants   NUMBER;
    v_verified       NUMBER;
    v_json           CLOB;
  BEGIN
    v_account_id := require_account(p_authorization);

    SELECT JSON_VALUE(p_body, '$.roomId' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.gameId' RETURNING VARCHAR2(60))
      INTO v_room_id, v_game_id
      FROM dual;

    IF v_room_id IS NULL OR v_game_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'roomId e gameId sono obbligatori.');
    END IF;

    SELECT COUNT(*)
      INTO v_room_valid
      FROM taotl_game_rooms
     WHERE id = v_room_id
       AND host_account_id = v_account_id
       AND (
         status = 'open'
         OR (status = 'finished' AND game_id = v_game_id)
       );

    IF v_room_valid = 0 THEN
      RAISE_APPLICATION_ERROR(-20403, 'Solo l''organizzatore può verificare questa partita.');
    END IF;

    SELECT COUNT(*)
      INTO v_game_valid
      FROM games
     WHERE id = v_game_id
       AND finished_at IS NOT NULL
       AND is_manual = 'N';

    IF v_game_valid = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Partita conclusa non trovata.');
    END IF;

    MERGE INTO taotl_verified_game_accounts target
    USING (
      SELECT v_game_id AS game_id,
             rp.account_id,
             v_room_id AS room_id,
             ap.player_id
        FROM taotl_room_participants rp
        JOIN taotl_account_players ap ON ap.account_id = rp.account_id
        JOIN game_players gp
          ON gp.game_id = v_game_id
         AND gp.player_id = ap.player_id
       WHERE rp.room_id = v_room_id
    ) source
    ON (target.game_id = source.game_id AND target.account_id = source.account_id)
    WHEN MATCHED THEN
      UPDATE SET target.room_id = source.room_id,
                 target.player_id = source.player_id,
                 target.confirmed_at = SYSTIMESTAMP
    WHEN NOT MATCHED THEN
      INSERT (game_id, account_id, room_id, player_id)
      VALUES (source.game_id, source.account_id, source.room_id, source.player_id);

    UPDATE taotl_game_rooms
       SET status = 'finished',
           game_id = v_game_id
     WHERE id = v_room_id;

    SELECT COUNT(*)
      INTO v_participants
      FROM taotl_room_participants
     WHERE room_id = v_room_id;

    SELECT COUNT(*)
      INTO v_verified
      FROM taotl_verified_game_accounts
     WHERE room_id = v_room_id
       AND game_id = v_game_id;

    SELECT JSON_OBJECT(
             'verifiedCount'  VALUE v_verified,
             'unmatchedCount' VALUE GREATEST(0, v_participants - v_verified)
             RETURNING CLOB
           )
      INTO v_json
      FROM dual;

    COMMIT;
    RETURN v_json;
  END complete_room_game;

  FUNCTION link_account_player(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_admin_id          VARCHAR2(60);
    v_account_id        VARCHAR2(60);
    v_player_id         VARCHAR2(60);
    v_existing_player_id VARCHAR2(60);
    v_exists            NUMBER;
    v_json              CLOB;
  BEGIN
    v_admin_id := require_admin(p_authorization);

    SELECT JSON_VALUE(p_body, '$.accountId' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.playerId' RETURNING VARCHAR2(60))
      INTO v_account_id, v_player_id
      FROM dual;

    IF v_account_id IS NULL OR v_player_id IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'accountId e playerId sono obbligatori.');
    END IF;

    SELECT COUNT(*)
      INTO v_exists
      FROM taotl_accounts
     WHERE id = v_account_id
       AND is_active = 'Y';
    IF v_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Account non trovato.');
    END IF;

    SELECT COUNT(*)
      INTO v_exists
      FROM players
     WHERE id = v_player_id
       AND is_active = 'Y';
    IF v_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.');
    END IF;

    BEGIN
      SELECT player_id
        INTO v_existing_player_id
        FROM taotl_account_players
       WHERE account_id = v_account_id;

      IF v_existing_player_id = v_player_id THEN
        v_json := account_json(v_account_id);
        COMMIT;
        RETURN v_json;
      END IF;
      RAISE_APPLICATION_ERROR(-20409,
        'Questo account è già collegato a un altro giocatore.');
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        NULL;
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM taotl_account_players
     WHERE player_id = v_player_id;
    IF v_exists > 0 THEN
      RAISE_APPLICATION_ERROR(-20409,
        'Questo giocatore è già collegato a un altro account.');
    END IF;

    INSERT INTO taotl_account_players(account_id, player_id)
    VALUES (v_account_id, v_player_id);

    v_json := account_json(v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20409, 'Questo giocatore è già collegato a un altro account.');
  END link_account_player;

  FUNCTION add_manual_game(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_admin_id     VARCHAR2(60);
    v_winner_id    VARCHAR2(60);
    v_played_at_s  VARCHAR2(40);
    v_played_at    TIMESTAMP WITH TIME ZONE;
    v_num_players  NUMBER;
    v_winner_found NUMBER;
    v_winner_exists NUMBER;
    v_winner_only_s VARCHAR2(10);
    v_winner_only   BOOLEAN;
    v_counts_for_rate CHAR(1);
    v_stored_num_players NUMBER;
    v_game_id      games.id%TYPE;
    v_json         CLOB;
  BEGIN
    v_admin_id := require_admin(p_authorization);

    SELECT JSON_VALUE(p_body, '$.winnerId' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.playedAt' RETURNING VARCHAR2(40)),
           JSON_VALUE(p_body, '$.winnerOnly' RETURNING VARCHAR2(10))
      INTO v_winner_id, v_played_at_s, v_winner_only_s
      FROM dual;
    v_winner_only := LOWER(NVL(v_winner_only_s, 'false')) = 'true';
    v_counts_for_rate := CASE WHEN v_winner_only THEN 'N' ELSE 'Y' END;

    v_played_at := CASE
      WHEN v_played_at_s IS NULL THEN SYSTIMESTAMP
      ELSE TO_TIMESTAMP_TZ(v_played_at_s || ' 12:00:00 +00:00', 'YYYY-MM-DD HH24:MI:SS TZH:TZM')
    END;

    SELECT COUNT(*) INTO v_num_players
      FROM JSON_TABLE(p_body, '$.players[*]' COLUMNS (player_id VARCHAR2(60) PATH '$'));

    IF NOT v_winner_only AND v_num_players < 2 THEN
      RAISE_APPLICATION_ERROR(-20400, 'Servono almeno due giocatori.');
    END IF;

    SELECT COUNT(*)
      INTO v_winner_exists
      FROM players
     WHERE id = v_winner_id
       AND is_active = 'Y';

    IF v_winner_id IS NULL OR v_winner_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il vincitore non esiste nella rubrica.');
    END IF;

    IF NOT v_winner_only THEN
      SELECT COUNT(*) INTO v_winner_found
        FROM JSON_TABLE(p_body, '$.players[*]' COLUMNS (player_id VARCHAR2(60) PATH '$'))
       WHERE player_id = v_winner_id;

      IF v_winner_found = 0 THEN
        RAISE_APPLICATION_ERROR(-20400, 'Il vincitore deve essere uno dei partecipanti.');
      END IF;
    END IF;

    v_game_id := 'game_' || LOWER(RAWTOHEX(SYS_GUID()));
    v_stored_num_players := CASE WHEN v_winner_only THEN 0 ELSE v_num_players END;

    INSERT INTO games (
      id, game_mode, num_players, start_dealer_id, created_at, finished_at,
      is_manual, winner_player_id, counts_for_win_rate
    ) VALUES (
      v_game_id, 'manuale', v_stored_num_players, NULL, v_played_at, v_played_at,
      'Y', v_winner_id, v_counts_for_rate
    );

    IF v_winner_only THEN
      INSERT INTO game_players (game_id, player_id, seat_order)
      VALUES (v_game_id, v_winner_id, 1);
    ELSE
      INSERT INTO game_players (game_id, player_id, seat_order)
      SELECT v_game_id, player_id, ROWNUM
        FROM JSON_TABLE(p_body, '$.players[*]' COLUMNS (player_id VARCHAR2(60) PATH '$'));
    END IF;

    SELECT JSON_OBJECT('id' VALUE v_game_id RETURNING CLOB) INTO v_json FROM dual;
    COMMIT;
    RETURN v_json;
  END add_manual_game;

  FUNCTION overall_leaderboard RETURN CLOB IS
    v_json CLOB;
  BEGIN
    SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'playerId'    VALUE player_id,
                 'name'        VALUE player_name,
                 'gamesPlayed' VALUE games_played,
                 'wins'        VALUE wins,
                 'rateWins'    VALUE rate_wins
                 RETURNING CLOB
               )
               ORDER BY wins DESC, games_played DESC, player_name
               RETURNING CLOB
             ),
             TO_CLOB('[]')
           )
      INTO v_json
      FROM player_overall_stats_v;
    RETURN v_json;
  END overall_leaderboard;

  FUNCTION list_accounts(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_admin_id VARCHAR2(60);
    v_json     CLOB;
  BEGIN
    v_admin_id := require_admin(p_authorization);

    SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id'             VALUE a.id,
                 'handle'         VALUE a.handle_normalized,
                 'displayName'    VALUE a.display_name,
                 'firstName'      VALUE a.first_name,
                 'lastName'       VALUE a.last_name,
                 'linkedPlayerId' VALUE ap.player_id
                 RETURNING CLOB
               )
               ORDER BY a.handle_normalized
               RETURNING CLOB
             ),
             TO_CLOB('[]')
           )
      INTO v_json
      FROM taotl_accounts a
      LEFT JOIN taotl_account_players ap ON ap.account_id = a.id
     WHERE a.is_active = 'Y';
    RETURN v_json;
  END list_accounts;

  -- Punto di innesto per il vero invio email (oggi non collegato a nessun
  -- servizio: serve un provider esterno, es. via UTL_HTTP verso un'API tipo
  -- Resend/Mailgun/SendGrid con una chiave, oppure UTL_SMTP con un server SMTP
  -- vero). Finché non è collegato, il codice di reset non arriva a nessuno:
  -- va recuperato da chi ha accesso al database, in taotl_password_resets.
  PROCEDURE send_reset_email(p_email IN VARCHAR2, p_token IN VARCHAR2, p_display_name IN VARCHAR2) IS
  BEGIN
    NULL;
  END send_reset_email;

  FUNCTION request_password_reset(p_body IN BLOB) RETURN CLOB IS
    v_handle       taotl_accounts.handle_normalized%TYPE;
    v_email        taotl_accounts.email%TYPE;
    v_account_id   taotl_accounts.id%TYPE;
    v_display_name taotl_accounts.display_name%TYPE;
    v_token        VARCHAR2(64);
    v_json         CLOB;
  BEGIN
    SELECT normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           LOWER(TRIM(JSON_VALUE(p_body, '$.email' RETURNING VARCHAR2(160))))
      INTO v_handle, v_email
      FROM dual;

    BEGIN
      SELECT id, display_name
        INTO v_account_id, v_display_name
        FROM taotl_accounts
       WHERE handle_normalized = v_handle
         AND email = v_email
         AND is_active = 'Y';

      v_token := LOWER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));

      DELETE FROM taotl_password_resets WHERE account_id = v_account_id;
      INSERT INTO taotl_password_resets(token_hash, account_id, expires_at)
      VALUES (sha256(v_token), v_account_id, SYSTIMESTAMP + INTERVAL '30' MINUTE);

      send_reset_email(v_email, v_token, v_display_name);
      COMMIT;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        NULL;
    END;

    -- Risposta sempre identica: non deve rivelare se un handle/email esiste.
    SELECT JSON_OBJECT(
             'message' VALUE 'Se i dati sono corretti riceverai un''email con le istruzioni per il reset.'
             RETURNING CLOB
           )
      INTO v_json
      FROM dual;
    RETURN v_json;
  END request_password_reset;

  FUNCTION confirm_password_reset(p_body IN BLOB) RETURN CLOB IS
    v_token      VARCHAR2(200);
    v_password   VARCHAR2(200);
    v_account_id taotl_accounts.id%TYPE;
    v_salt       VARCHAR2(64);
    v_json       CLOB;
  BEGIN
    SELECT JSON_VALUE(p_body, '$.token' RETURNING VARCHAR2(200)),
           JSON_VALUE(p_body, '$.password' RETURNING VARCHAR2(200))
      INTO v_token, v_password
      FROM dual;

    IF v_password IS NULL OR LENGTH(v_password) < 8 OR LENGTH(v_password) > 72
       OR NOT REGEXP_LIKE(v_password, '[A-Z]')
       OR NOT REGEXP_LIKE(v_password, '[0-9]') THEN
      RAISE_APPLICATION_ERROR(-20400,
        'La password deve avere almeno 8 caratteri, una maiuscola e un numero.');
    END IF;

    SELECT account_id
      INTO v_account_id
      FROM taotl_password_resets
     WHERE token_hash = sha256(v_token)
       AND expires_at > SYSTIMESTAMP;

    v_salt := LOWER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));

    UPDATE taotl_accounts
       SET password_salt   = v_salt,
           password_hash   = hash_password(v_salt, v_password),
           failed_attempts = 0,
           locked_until    = NULL
     WHERE id = v_account_id;

    DELETE FROM taotl_password_resets WHERE account_id = v_account_id;
    DELETE FROM taotl_sessions WHERE account_id = v_account_id;

    v_json := new_session(v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20401, 'Codice di reset non valido o scaduto.');
  END confirm_password_reset;

END taotl_identity_api;
/
