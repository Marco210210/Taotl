-- API Taotl ID. Richiede prima server/sql/04_identity_and_verified_rooms.sql.
--
-- Il PIN non viene mai salvato: viene memorizzato solo SHA-256(salt:PIN).
-- I token restituiti al client vengono salvati nel database soltanto come hash.

CREATE OR REPLACE PACKAGE taotl_identity_api AS
  FUNCTION register_account(p_body IN BLOB) RETURN CLOB;
  FUNCTION login_account(p_body IN BLOB) RETURN CLOB;
  FUNCTION my_account(p_authorization IN VARCHAR2) RETURN CLOB;
  PROCEDURE logout_account(p_authorization IN VARCHAR2);
  FUNCTION create_room(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION join_room(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION get_room(p_authorization IN VARCHAR2, p_room_id IN VARCHAR2) RETURN CLOB;
END taotl_identity_api;
/

CREATE OR REPLACE PACKAGE BODY taotl_identity_api AS

  FUNCTION sha256(p_value IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN LOWER(RAWTOHEX(STANDARD_HASH(p_value, 'SHA256')));
  END sha256;

  FUNCTION normalized_handle(p_value IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN LOWER(TRIM(REPLACE(p_value, '@', '')));
  END normalized_handle;

  FUNCTION account_json(p_account_id IN VARCHAR2) RETURN CLOB IS
    v_json CLOB;
  BEGIN
    SELECT JSON_OBJECT(
             'id'          VALUE id,
             'handle'      VALUE handle_normalized,
             'displayName' VALUE display_name,
             'createdAt'   VALUE TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
             RETURNING CLOB
           )
      INTO v_json
      FROM taotl_accounts
     WHERE id = p_account_id
       AND is_active = 'Y';
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

  FUNCTION room_json(p_room_id IN VARCHAR2) RETURN CLOB IS
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
    v_pin          VARCHAR2(20);
    v_salt         VARCHAR2(64);
    v_json         CLOB;
  BEGIN
    SELECT normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           TRIM(JSON_VALUE(p_body, '$.displayName' RETURNING VARCHAR2(80))),
           JSON_VALUE(p_body, '$.pin' RETURNING VARCHAR2(20))
      INTO v_handle, v_display_name, v_pin
      FROM dual;

    IF NOT REGEXP_LIKE(v_handle, '^[a-z0-9_]{3,24}$') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Taotl ID non valido.');
    END IF;
    IF v_display_name IS NULL THEN
      RAISE_APPLICATION_ERROR(-20400, 'Nome mostrato obbligatorio.');
    END IF;
    IF NOT REGEXP_LIKE(v_pin, '^[0-9]{6}$') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il PIN deve avere 6 cifre.');
    END IF;

    v_id := 'usr_' || LOWER(RAWTOHEX(SYS_GUID()));
    v_salt := LOWER(RAWTOHEX(SYS_GUID()) || RAWTOHEX(SYS_GUID()));

    INSERT INTO taotl_accounts(
      id, handle_normalized, display_name, pin_salt, pin_hash
    ) VALUES (
      v_id, v_handle, v_display_name, v_salt, sha256(v_salt || ':' || v_pin)
    );

    v_json := new_session(v_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20409, 'Questo Taotl ID è già utilizzato.');
  END register_account;

  FUNCTION login_account(p_body IN BLOB) RETURN CLOB IS
    v_handle       taotl_accounts.handle_normalized%TYPE;
    v_pin          VARCHAR2(20);
    v_account_id   taotl_accounts.id%TYPE;
    v_salt         taotl_accounts.pin_salt%TYPE;
    v_pin_hash     taotl_accounts.pin_hash%TYPE;
    v_failed       taotl_accounts.failed_attempts%TYPE;
    v_locked_until taotl_accounts.locked_until%TYPE;
    v_json         CLOB;
  BEGIN
    SELECT normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           JSON_VALUE(p_body, '$.pin' RETURNING VARCHAR2(20))
      INTO v_handle, v_pin
      FROM dual;

    SELECT id, pin_salt, pin_hash, failed_attempts, locked_until
      INTO v_account_id, v_salt, v_pin_hash, v_failed, v_locked_until
      FROM taotl_accounts
     WHERE handle_normalized = v_handle
       AND is_active = 'Y'
       FOR UPDATE;

    IF v_locked_until IS NOT NULL AND v_locked_until > SYSTIMESTAMP THEN
      RAISE_APPLICATION_ERROR(-20429, 'Troppi tentativi. Riprova tra 15 minuti.');
    END IF;

    IF NOT REGEXP_LIKE(v_pin, '^[0-9]{6}$')
       OR sha256(v_salt || ':' || v_pin) != v_pin_hash THEN
      v_failed := CASE WHEN v_failed >= 5 THEN 1 ELSE v_failed + 1 END;
      UPDATE taotl_accounts
         SET failed_attempts = LEAST(v_failed, 5),
             locked_until = CASE
               WHEN v_failed >= 5 THEN SYSTIMESTAMP + INTERVAL '15' MINUTE
               ELSE NULL
             END
       WHERE id = v_account_id;
      COMMIT;
      RAISE_APPLICATION_ERROR(-20401, 'Taotl ID o PIN non corretti.');
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
      RAISE_APPLICATION_ERROR(-20401, 'Taotl ID o PIN non corretti.');
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
      FROM taotl_room_participants
     WHERE room_id = p_room_id
       AND account_id = v_account_id;
    IF v_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20403, 'Non fai parte di questa stanza.');
    END IF;

    v_json := room_json(p_room_id);
    COMMIT;
    RETURN v_json;
  END get_room;

END taotl_identity_api;
/

