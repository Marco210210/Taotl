-- Classifiche private, ruoli, inviti e richieste di collegamento profilo.
-- Richiede 13_private_leaderboards_and_history.sql e taotl_identity_api.

CREATE OR REPLACE PACKAGE taotl_collaboration_api AS
  FUNCTION list_leaderboards(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION create_leaderboard(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION rename_leaderboard(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION leaderboard_entries(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2) RETURN CLOB;
  FUNCTION join_leaderboard(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  PROCEDURE add_player(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB);
  PROCEDURE remove_player(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_player_id IN VARCHAR2);
  FUNCTION create_invite(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION list_members(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2) RETURN CLOB;
  PROCEDURE update_member_role(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB);
  PROCEDURE remove_member(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_account_id IN VARCHAR2);
  FUNCTION create_link_request(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
  FUNCTION list_link_requests(p_authorization IN VARCHAR2) RETURN CLOB;
  FUNCTION respond_link_request(p_authorization IN VARCHAR2, p_request_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB;
END taotl_collaboration_api;
/

CREATE OR REPLACE PACKAGE BODY taotl_collaboration_api AS

  FUNCTION role_weight(p_role IN VARCHAR2) RETURN PLS_INTEGER IS
  BEGIN
    RETURN CASE p_role
      WHEN 'viewer' THEN 1
      WHEN 'member' THEN 2
      WHEN 'manager' THEN 3
      WHEN 'owner' THEN 4
      WHEN 'superadmin' THEN 5
      ELSE 0
    END;
  END role_weight;

  FUNCTION account_is_superadmin(p_account_id IN VARCHAR2) RETURN BOOLEAN IS
    v_admin taotl_accounts.is_admin%TYPE;
  BEGIN
    SELECT is_admin INTO v_admin FROM taotl_accounts
     WHERE id = p_account_id AND is_active = 'Y';
    RETURN v_admin = 'Y';
  EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN FALSE;
  END account_is_superadmin;

  FUNCTION membership_role(p_account_id IN VARCHAR2, p_leaderboard_id IN VARCHAR2) RETURN VARCHAR2 IS
    v_role taotl_account_leaderboards.role%TYPE;
  BEGIN
    IF account_is_superadmin(p_account_id) THEN RETURN 'superadmin'; END IF;
    SELECT al.role INTO v_role
      FROM taotl_account_leaderboards al
      JOIN taotl_leaderboards l ON l.id = al.leaderboard_id
     WHERE al.account_id = p_account_id
       AND al.leaderboard_id = p_leaderboard_id
       AND l.is_active = 'Y';
    RETURN v_role;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN NULL;
  END membership_role;

  FUNCTION require_role(
    p_authorization IN VARCHAR2,
    p_leaderboard_id IN VARCHAR2,
    p_min_weight IN PLS_INTEGER
  ) RETURN VARCHAR2 IS
    v_account_id VARCHAR2(60);
    v_role       VARCHAR2(20);
    v_exists     NUMBER;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT COUNT(*) INTO v_exists FROM taotl_leaderboards
     WHERE id = p_leaderboard_id AND is_active = 'Y';
    IF v_exists = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Classifica non trovata.');
    END IF;
    v_role := membership_role(v_account_id, p_leaderboard_id);
    IF role_weight(v_role) < p_min_weight THEN
      RAISE_APPLICATION_ERROR(-20403, 'Non hai i permessi per questa classifica.');
    END IF;
    RETURN v_account_id;
  END require_role;

  FUNCTION board_json(p_leaderboard_id IN VARCHAR2, p_account_id IN VARCHAR2) RETURN CLOB IS
    v_json CLOB;
    v_role VARCHAR2(20);
    v_weight PLS_INTEGER;
  BEGIN
    v_role := membership_role(p_account_id, p_leaderboard_id);
    v_weight := role_weight(v_role);
    SELECT JSON_OBJECT(
             'id'        VALUE l.id,
             'name'      VALUE l.name,
             'visibility' VALUE l.visibility,
             'role'      VALUE v_role,
             'canManage' VALUE CASE WHEN v_weight >= 3 THEN 'true' ELSE 'false' END FORMAT JSON,
             'canSubmit' VALUE CASE WHEN v_weight >= 2 THEN 'true' ELSE 'false' END FORMAT JSON,
             'createdAt' VALUE TO_CHAR(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
             RETURNING CLOB
           )
      INTO v_json
      FROM taotl_leaderboards l
     WHERE l.id = p_leaderboard_id
       AND l.is_active = 'Y';
    RETURN v_json;
  END board_json;

  FUNCTION list_leaderboards(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_admin_flag PLS_INTEGER := 0;
    v_json       CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    IF account_is_superadmin(v_account_id) THEN v_admin_flag := 1; END IF;
    SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id'         VALUE l.id,
                 'name'       VALUE l.name,
                 'visibility' VALUE l.visibility,
                 'role'       VALUE CASE WHEN v_admin_flag = 1 THEN 'superadmin' ELSE al.role END,
                 'canManage'  VALUE CASE WHEN v_admin_flag = 1 OR al.role IN ('owner', 'manager') THEN 'true' ELSE 'false' END FORMAT JSON,
                 'canSubmit'  VALUE CASE WHEN v_admin_flag = 1 OR al.role IN ('owner', 'manager', 'member') THEN 'true' ELSE 'false' END FORMAT JSON,
                 'createdAt'  VALUE TO_CHAR(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
                 RETURNING CLOB
               )
               ORDER BY CASE WHEN al.is_default = 'Y' THEN 0 ELSE 1 END, l.name
               RETURNING CLOB
             ),
             TO_CLOB('[]')
           )
      INTO v_json
      FROM taotl_leaderboards l
      LEFT JOIN taotl_account_leaderboards al
        ON al.leaderboard_id = l.id AND al.account_id = v_account_id
     WHERE l.is_active = 'Y'
       AND (v_admin_flag = 1 OR al.account_id IS NOT NULL);
    RETURN v_json;
  END list_leaderboards;

  FUNCTION create_leaderboard(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_id         VARCHAR2(60);
    v_name       VARCHAR2(80);
    v_count      NUMBER;
    v_json       CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT TRIM(JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(80))) INTO v_name FROM dual;
    IF v_name IS NULL OR LENGTH(v_name) < 2 THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il nome deve avere almeno 2 caratteri.');
    END IF;
    SELECT COUNT(*) INTO v_count FROM taotl_account_leaderboards WHERE account_id = v_account_id;
    v_id := 'lb_' || LOWER(RAWTOHEX(SYS_GUID()));
    INSERT INTO taotl_leaderboards(id, name, owner_account_id, visibility)
    VALUES (v_id, v_name, v_account_id, 'private');
    INSERT INTO taotl_account_leaderboards(account_id, leaderboard_id, is_default, role)
    VALUES (v_account_id, v_id, CASE WHEN v_count = 0 THEN 'Y' ELSE 'N' END, 'owner');
    INSERT INTO taotl_leaderboard_players(leaderboard_id, player_id, added_by)
    SELECT v_id, ap.player_id, v_account_id
      FROM taotl_account_players ap
     WHERE ap.account_id = v_account_id;
    v_json := board_json(v_id, v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20409, 'Hai già una classifica con questo nome.');
  END create_leaderboard;

  FUNCTION rename_leaderboard(
    p_authorization IN VARCHAR2,
    p_leaderboard_id IN VARCHAR2,
    p_body IN BLOB
  ) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_name       VARCHAR2(80);
    v_json       CLOB;
  BEGIN
    -- Proprietario, gestori e superadmin hanno peso almeno 3.
    v_account_id := require_role(p_authorization, p_leaderboard_id, 3);
    SELECT TRIM(JSON_VALUE(p_body, '$.name' RETURNING VARCHAR2(80)))
      INTO v_name
      FROM dual;
    IF v_name IS NULL OR LENGTH(v_name) < 2 THEN
      RAISE_APPLICATION_ERROR(-20400, 'Il nome deve avere almeno 2 caratteri.');
    END IF;

    UPDATE taotl_leaderboards
       SET name = v_name
     WHERE id = p_leaderboard_id
       AND is_active = 'Y';
    IF SQL%ROWCOUNT = 0 THEN
      RAISE_APPLICATION_ERROR(-20404, 'Classifica non trovata.');
    END IF;

    v_json := board_json(p_leaderboard_id, v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20409, 'Esiste già una classifica con questo nome.');
  END rename_leaderboard;

  FUNCTION leaderboard_entries(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := require_role(p_authorization, p_leaderboard_id, 1);
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
             ), TO_CLOB('[]'))
      INTO v_json
      FROM player_overall_stats_v
     WHERE leaderboard_id = p_leaderboard_id;
    RETURN v_json;
  END leaderboard_entries;

  FUNCTION join_leaderboard(p_authorization IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_code       VARCHAR2(40);
    v_board_id   VARCHAR2(60);
    v_role       VARCHAR2(12);
    v_existing   NUMBER;
    v_defaults   NUMBER;
    v_json       CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT UPPER(TRIM(JSON_VALUE(p_body, '$.code' RETURNING VARCHAR2(40)))) INTO v_code FROM dual;
    SELECT leaderboard_id, role
      INTO v_board_id, v_role
      FROM taotl_leaderboard_invites
     WHERE token_hash = taotl_identity_api.sha256(v_code)
       AND revoked_at IS NULL
       AND expires_at > SYSTIMESTAMP
       AND used_count < max_uses
       FOR UPDATE;

    SELECT COUNT(*) INTO v_existing FROM taotl_account_leaderboards
     WHERE account_id = v_account_id AND leaderboard_id = v_board_id;
    IF v_existing = 0 THEN
      SELECT COUNT(*) INTO v_defaults FROM taotl_account_leaderboards WHERE account_id = v_account_id;
      INSERT INTO taotl_account_leaderboards(account_id, leaderboard_id, is_default, role)
      VALUES (v_account_id, v_board_id, CASE WHEN v_defaults = 0 THEN 'Y' ELSE 'N' END, v_role);
      UPDATE taotl_leaderboard_invites SET used_count = used_count + 1
       WHERE token_hash = taotl_identity_api.sha256(v_code);
    END IF;
    MERGE INTO taotl_leaderboard_players lp
    USING (SELECT v_board_id leaderboard_id, ap.player_id
             FROM taotl_account_players ap WHERE ap.account_id = v_account_id) src
       ON (lp.leaderboard_id = src.leaderboard_id AND lp.player_id = src.player_id)
     WHEN NOT MATCHED THEN INSERT (leaderboard_id, player_id, added_by)
       VALUES (src.leaderboard_id, src.player_id, v_account_id);
    v_json := board_json(v_board_id, v_account_id);
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      ROLLBACK;
      RAISE_APPLICATION_ERROR(-20404, 'Invito non valido, scaduto o esaurito.');
  END join_leaderboard;

  PROCEDURE add_player(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) IS
    v_account_id VARCHAR2(60);
    v_player_id VARCHAR2(60);
    v_allowed NUMBER;
  BEGIN
    v_account_id := require_role(p_authorization, p_leaderboard_id, 3);
    SELECT JSON_VALUE(p_body, '$.playerId' RETURNING VARCHAR2(60)) INTO v_player_id FROM dual;
    SELECT COUNT(*) INTO v_allowed
      FROM players p
      JOIN taotl_accounts a ON a.id = v_account_id
     WHERE p.id = v_player_id AND p.is_active = 'Y'
       AND (a.is_admin = 'Y' OR p.owner_account_id = v_account_id OR EXISTS (
         SELECT 1 FROM taotl_leaderboard_players lp
         JOIN taotl_account_leaderboards al ON al.leaderboard_id = lp.leaderboard_id
          WHERE lp.player_id = p.id AND al.account_id = v_account_id
       ));
    IF v_allowed = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Giocatore non trovato.'); END IF;
    MERGE INTO taotl_leaderboard_players lp
    USING (SELECT p_leaderboard_id leaderboard_id, v_player_id player_id FROM dual) src
       ON (lp.leaderboard_id = src.leaderboard_id AND lp.player_id = src.player_id)
     WHEN NOT MATCHED THEN INSERT (leaderboard_id, player_id, added_by)
       VALUES (src.leaderboard_id, src.player_id, v_account_id);
    COMMIT;
  END add_player;

  PROCEDURE remove_player(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_player_id IN VARCHAR2) IS
    v_account_id VARCHAR2(60);
  BEGIN
    v_account_id := require_role(p_authorization, p_leaderboard_id, 3);
    DELETE FROM taotl_leaderboard_players
     WHERE leaderboard_id = p_leaderboard_id AND player_id = p_player_id;
    IF SQL%ROWCOUNT = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Giocatore non presente nella classifica.'); END IF;
    COMMIT;
  END remove_player;

  FUNCTION create_invite(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_actor_role VARCHAR2(20);
    v_role       VARCHAR2(12);
    v_code       VARCHAR2(12);
    v_id         VARCHAR2(60);
    v_expires_at TIMESTAMP WITH TIME ZONE := SYSTIMESTAMP + INTERVAL '7' DAY;
    v_json       CLOB;
  BEGIN
    v_account_id := require_role(p_authorization, p_leaderboard_id, 3);
    v_actor_role := membership_role(v_account_id, p_leaderboard_id);
    SELECT NVL(JSON_VALUE(p_body, '$.role' RETURNING VARCHAR2(12)), 'member') INTO v_role FROM dual;
    IF v_role NOT IN ('manager', 'member', 'viewer') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Ruolo invito non valido.');
    END IF;
    IF v_role = 'manager' AND role_weight(v_actor_role) < 4 THEN
      RAISE_APPLICATION_ERROR(-20403, 'Solo il proprietario può invitare un gestore.');
    END IF;
    v_code := UPPER(SUBSTR(RAWTOHEX(SYS_GUID()), 1, 8));
    v_id := 'inv_' || LOWER(RAWTOHEX(SYS_GUID()));
    INSERT INTO taotl_leaderboard_invites(
      id, leaderboard_id, token_hash, role, created_by, expires_at
    ) VALUES (
      v_id, p_leaderboard_id, taotl_identity_api.sha256(v_code), v_role, v_account_id, v_expires_at
    );
    SELECT JSON_OBJECT(
             'code'      VALUE v_code,
             'role'      VALUE v_role,
             'expiresAt' VALUE TO_CHAR(v_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
             RETURNING CLOB
           ) INTO v_json FROM dual;
    COMMIT;
    RETURN v_json;
  END create_invite;

  FUNCTION list_members(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_json CLOB;
  BEGIN
    v_account_id := require_role(p_authorization, p_leaderboard_id, 1);
    SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'accountId'  VALUE a.id,
                 'handle'     VALUE a.handle_normalized,
                 'displayName' VALUE a.display_name,
                 'role'       VALUE al.role,
                 'playerId'   VALUE ap.player_id
                 RETURNING CLOB
               ) ORDER BY CASE al.role WHEN 'owner' THEN 1 WHEN 'manager' THEN 2 WHEN 'member' THEN 3 ELSE 4 END,
                          a.display_name RETURNING CLOB
             ), TO_CLOB('[]'))
      INTO v_json
      FROM taotl_account_leaderboards al
      JOIN taotl_accounts a ON a.id = al.account_id AND a.is_active = 'Y'
      LEFT JOIN taotl_account_players ap ON ap.account_id = a.id
     WHERE al.leaderboard_id = p_leaderboard_id;
    RETURN v_json;
  END list_members;

  PROCEDURE update_member_role(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) IS
    v_actor_id  VARCHAR2(60);
    v_account_id VARCHAR2(60);
    v_role      VARCHAR2(12);
    v_old_role  VARCHAR2(12);
  BEGIN
    v_actor_id := require_role(p_authorization, p_leaderboard_id, 4);
    SELECT JSON_VALUE(p_body, '$.accountId' RETURNING VARCHAR2(60)),
           JSON_VALUE(p_body, '$.role' RETURNING VARCHAR2(12))
      INTO v_account_id, v_role FROM dual;
    IF v_role NOT IN ('manager', 'member', 'viewer') THEN
      RAISE_APPLICATION_ERROR(-20400, 'Ruolo non valido.');
    END IF;
    SELECT role INTO v_old_role FROM taotl_account_leaderboards
     WHERE account_id = v_account_id AND leaderboard_id = p_leaderboard_id FOR UPDATE;
    IF v_old_role = 'owner' THEN
      RAISE_APPLICATION_ERROR(-20403, 'Il ruolo del proprietario non può essere modificato.');
    END IF;
    UPDATE taotl_account_leaderboards SET role = v_role
     WHERE account_id = v_account_id AND leaderboard_id = p_leaderboard_id;
    COMMIT;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20404, 'Membro non trovato.');
  END update_member_role;

  PROCEDURE remove_member(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_account_id IN VARCHAR2) IS
    v_actor_id VARCHAR2(60);
    v_role VARCHAR2(12);
  BEGIN
    v_actor_id := require_role(p_authorization, p_leaderboard_id, 4);
    SELECT role INTO v_role FROM taotl_account_leaderboards
     WHERE account_id = p_account_id AND leaderboard_id = p_leaderboard_id;
    IF v_role = 'owner' THEN
      RAISE_APPLICATION_ERROR(-20403, 'Il proprietario non può essere rimosso.');
    END IF;
    DELETE FROM taotl_account_leaderboards
     WHERE account_id = p_account_id AND leaderboard_id = p_leaderboard_id;
    COMMIT;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20404, 'Membro non trovato.');
  END remove_member;

  FUNCTION create_link_request(p_authorization IN VARCHAR2, p_leaderboard_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_actor_id  VARCHAR2(60);
    v_handle    VARCHAR2(24);
    v_target_id VARCHAR2(60);
    v_player_id VARCHAR2(60);
    v_request_id VARCHAR2(60);
    v_count     NUMBER;
    v_current_player_id VARCHAR2(60);
    v_json      CLOB;
  BEGIN
    v_actor_id := require_role(p_authorization, p_leaderboard_id, 3);
    SELECT taotl_identity_api.normalized_handle(JSON_VALUE(p_body, '$.handle' RETURNING VARCHAR2(100))),
           JSON_VALUE(p_body, '$.playerId' RETURNING VARCHAR2(60))
      INTO v_handle, v_player_id FROM dual;
    SELECT id INTO v_target_id FROM taotl_accounts
     WHERE handle_normalized = v_handle AND is_active = 'Y';
    SELECT COUNT(*) INTO v_count FROM taotl_leaderboard_players
     WHERE leaderboard_id = p_leaderboard_id AND player_id = v_player_id;
    IF v_count = 0 THEN RAISE_APPLICATION_ERROR(-20404, 'Profilo non presente nella classifica.'); END IF;
    SELECT COUNT(*) INTO v_count FROM taotl_account_players WHERE player_id = v_player_id;
    IF v_count > 0 THEN RAISE_APPLICATION_ERROR(-20409, 'Profilo già collegato.'); END IF;
    BEGIN
      SELECT player_id INTO v_current_player_id FROM taotl_account_players WHERE account_id = v_target_id;
      SELECT COUNT(*) INTO v_count FROM game_players WHERE player_id = v_current_player_id;
      IF v_count > 0 THEN
        RAISE_APPLICATION_ERROR(-20409, 'L''account ha già uno storico: il collegamento richiede prima una fusione profili.');
      END IF;
    EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
    END;
    SELECT COUNT(*) INTO v_count FROM taotl_profile_link_requests
     WHERE leaderboard_id = p_leaderboard_id AND player_id = v_player_id
       AND target_account_id = v_target_id AND status = 'pending';
    IF v_count > 0 THEN RAISE_APPLICATION_ERROR(-20409, 'Richiesta già inviata.'); END IF;
    v_request_id := 'link_' || LOWER(RAWTOHEX(SYS_GUID()));
    INSERT INTO taotl_profile_link_requests(
      id, leaderboard_id, player_id, target_account_id, requested_by
    ) VALUES (
      v_request_id, p_leaderboard_id, v_player_id, v_target_id, v_actor_id
    );
    SELECT JSON_OBJECT('id' VALUE v_request_id, 'status' VALUE 'pending' RETURNING CLOB)
      INTO v_json FROM dual;
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20404, 'Taotl ID non trovato.');
  END create_link_request;

  FUNCTION list_link_requests(p_authorization IN VARCHAR2) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_admin_flag PLS_INTEGER := 0;
    v_json CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    IF account_is_superadmin(v_account_id) THEN v_admin_flag := 1; END IF;
    SELECT COALESCE(
             JSON_ARRAYAGG(
               JSON_OBJECT(
                 'id' VALUE r.id,
                 'leaderboardId' VALUE r.leaderboard_id,
                 'leaderboardName' VALUE l.name,
                 'playerId' VALUE r.player_id,
                 'playerName' VALUE p.player_name,
                 'targetAccountId' VALUE r.target_account_id,
                 'targetHandle' VALUE a.handle_normalized,
                 'status' VALUE r.status,
                 'createdAt' VALUE TO_CHAR(r.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM')
                 RETURNING CLOB
               ) ORDER BY r.created_at DESC RETURNING CLOB
             ), TO_CLOB('[]'))
      INTO v_json
      FROM taotl_profile_link_requests r
      JOIN taotl_leaderboards l ON l.id = r.leaderboard_id
      JOIN player_display_names_v p ON p.id = r.player_id
      JOIN taotl_accounts a ON a.id = r.target_account_id
      LEFT JOIN taotl_account_leaderboards al
        ON al.leaderboard_id = r.leaderboard_id AND al.account_id = v_account_id
     WHERE r.status = 'pending'
       AND (v_admin_flag = 1 OR r.target_account_id = v_account_id OR al.role IN ('owner', 'manager'));
    RETURN v_json;
  END list_link_requests;

  FUNCTION respond_link_request(p_authorization IN VARCHAR2, p_request_id IN VARCHAR2, p_body IN BLOB) RETURN CLOB IS
    v_account_id VARCHAR2(60);
    v_target_id  VARCHAR2(60);
    v_player_id  VARCHAR2(60);
    v_accept_s   VARCHAR2(10);
    v_status     VARCHAR2(12);
    v_count      NUMBER;
    v_current_player_id VARCHAR2(60);
    v_json       CLOB;
  BEGIN
    v_account_id := taotl_identity_api.require_account(p_authorization);
    SELECT target_account_id, player_id
      INTO v_target_id, v_player_id
      FROM taotl_profile_link_requests
     WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
    IF v_account_id != v_target_id AND NOT account_is_superadmin(v_account_id) THEN
      RAISE_APPLICATION_ERROR(-20403, 'Solo il destinatario può rispondere.');
    END IF;
    SELECT JSON_VALUE(p_body, '$.accept' RETURNING VARCHAR2(10)) INTO v_accept_s FROM dual;
    IF LOWER(NVL(v_accept_s, 'false')) = 'true' THEN
      SELECT COUNT(*) INTO v_count FROM taotl_account_players WHERE player_id = v_player_id;
      IF v_count > 0 THEN RAISE_APPLICATION_ERROR(-20409, 'Profilo già collegato.'); END IF;
      BEGIN
        SELECT player_id INTO v_current_player_id FROM taotl_account_players
         WHERE account_id = v_target_id FOR UPDATE;
        SELECT COUNT(*) INTO v_count FROM game_players WHERE player_id = v_current_player_id;
        IF v_count > 0 THEN
          RAISE_APPLICATION_ERROR(-20409, 'Il profilo attuale ha già uno storico e non può essere sostituito automaticamente.');
        END IF;
        DELETE FROM taotl_account_players WHERE account_id = v_target_id;
        DELETE FROM taotl_leaderboard_players WHERE player_id = v_current_player_id;
        DELETE FROM players WHERE id = v_current_player_id AND owner_account_id = v_target_id;
      EXCEPTION WHEN NO_DATA_FOUND THEN NULL;
      END;
      INSERT INTO taotl_account_players(account_id, player_id) VALUES (v_target_id, v_player_id);
      UPDATE players SET owner_account_id = v_target_id WHERE id = v_player_id;
      v_status := 'accepted';
    ELSE
      v_status := 'rejected';
    END IF;
    UPDATE taotl_profile_link_requests
       SET status = v_status, responded_at = SYSTIMESTAMP
     WHERE id = p_request_id;
    IF v_status = 'accepted' THEN
      UPDATE taotl_profile_link_requests
         SET status = 'cancelled', responded_at = SYSTIMESTAMP
       WHERE id != p_request_id AND status = 'pending'
         AND (target_account_id = v_target_id OR player_id = v_player_id);
    END IF;
    SELECT JSON_OBJECT('id' VALUE p_request_id, 'status' VALUE v_status RETURNING CLOB)
      INTO v_json FROM dual;
    COMMIT;
    RETURN v_json;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20404, 'Richiesta non trovata o già gestita.');
  END respond_link_request;

END taotl_collaboration_api;
/
