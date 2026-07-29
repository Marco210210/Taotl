-- Endpoint sotto .../ords/taotl_app/taotl/...: TUTTO il modulo 'taotl.api' vive in
-- questo unico file (partite/storico, Taotl ID, stanze, classifica generale, admin).
-- Richiede 01_api_package.sql e 03_identity_package.sql.
--
-- IMPORTANTE: ORDS.DEFINE_MODULE ridefinisce l'intero modulo ogni volta che viene
-- chiamato — se i template di uno stesso modulo fossero definiti in più script
-- eseguiti separatamente, l'ultimo eseguito cancellerebbe i pattern degli altri.
-- Per questo motivo il modulo 'taotl.api' NON va mai diviso in più file: qualunque
-- aggiunta futura ai suoi endpoint va fatta qui.

BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'taotl.api',
    p_base_path      => 'taotl/',
    p_items_per_page => 0
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/games  -> registra una partita conclusa (vedi taotl_api.sync_game)
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name  => 'taotl.api',
    p_pattern      => 'games/'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name    => 'taotl.api',
    p_pattern        => 'games/',
    p_method         => 'POST',
    p_source_type    => ORDS.source_type_plsql,
    p_source         =>
      'BEGIN
         taotl_api.check_app_key(:p_app_key);
         taotl_api.sync_game(:body);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'games/',
    p_method             => 'POST',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method       => 'IN'
  );

  ---------------------------------------------------------------------------
  -- GET /taotl/games -> storico partite concluse, con classifica per partita
  ---------------------------------------------------------------------------
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'games/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT ''application/json'',
              COALESCE(
                JSON_ARRAYAGG(
                  JSON_OBJECT(
                    ''id''         VALUE g.id,
                    ''mode''       VALUE g.game_mode,
                    ''numPlayers'' VALUE g.num_players,
                    ''startedAt''  VALUE
                      TO_CHAR(g.created_at,  ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM''),
                    ''endedAt''    VALUE
                      TO_CHAR(g.finished_at, ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM''),
                    ''standings''  VALUE (
                      SELECT JSON_ARRAYAGG(
                               JSON_OBJECT(
                                 ''playerId'' VALUE v.player_id,
                                 ''name''     VALUE v.player_name,
                                 ''total''    VALUE v.total
                                 RETURNING CLOB
                               )
                               ORDER BY v.total DESC
                               RETURNING CLOB
                             )
                        FROM game_standings_v v
                       WHERE v.game_id = g.id
                    ) FORMAT JSON
                    RETURNING CLOB
                  )
                  ORDER BY g.created_at DESC
                  RETURNING CLOB
                ),
                TO_CLOB(''[]'')
              )
         FROM games g
        WHERE g.finished_at IS NOT NULL
          AND g.is_manual = ''N'''
  );

  ---------------------------------------------------------------------------
  -- GET/DELETE /taotl/games/:id -> dettaglio completo o eliminazione partita
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'taotl.api',
    p_pattern     => 'games/:id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'games/:id',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT ''application/json'',
              JSON_OBJECT(
                ''id''            VALUE g.id,
                ''mode''          VALUE g.game_mode,
                ''numPlayers''    VALUE g.num_players,
                ''startDealerId'' VALUE g.start_dealer_id,
                ''startedAt''     VALUE
                  TO_CHAR(g.created_at, ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM''),
                ''endedAt''       VALUE
                  TO_CHAR(g.finished_at, ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM''),
                ''players''       VALUE (
                  SELECT JSON_ARRAYAGG(
                           JSON_OBJECT(
                             ''id''        VALUE gp.player_id,
                             ''name''      VALUE p.player_name,
                             ''seatOrder'' VALUE gp.seat_order
                             RETURNING CLOB
                           )
                           ORDER BY gp.seat_order
                           RETURNING CLOB
                         )
                    FROM game_players gp
                    JOIN player_display_names_v p ON p.id = gp.player_id
                   WHERE gp.game_id = g.id
                ) FORMAT JSON,
                ''standings''     VALUE (
                  SELECT JSON_ARRAYAGG(
                           JSON_OBJECT(
                             ''playerId'' VALUE v.player_id,
                             ''name''     VALUE v.player_name,
                             ''total''    VALUE v.total
                             RETURNING CLOB
                           )
                           ORDER BY v.total DESC
                           RETURNING CLOB
                         )
                    FROM game_standings_v v
                   WHERE v.game_id = g.id
                ) FORMAT JSON,
                ''rounds''        VALUE (
                  SELECT JSON_ARRAYAGG(
                           JSON_OBJECT(
                             ''index''          VALUE r.round_index,
                             ''cardsDealt''     VALUE r.cards_dealt,
                             ''presaValue''     VALUE r.presa_value,
                             ''rispettoValue''  VALUE r.rispetto_value,
                             ''dealerId''       VALUE r.dealer_player_id,
                             ''results''        VALUE (
                               SELECT JSON_ARRAYAGG(
                                        JSON_OBJECT(
                                          ''playerId''  VALUE rb.player_id,
                                          ''name''      VALUE p.player_name,
                                          ''bid''       VALUE rb.bid,
                                          ''respected'' VALUE
                                            CASE rb.respected
                                              WHEN ''Y'' THEN ''true''
                                              ELSE ''false''
                                            END FORMAT JSON,
                                          ''scarto''    VALUE rb.scarto,
                                          ''score''     VALUE rb.score
                                          RETURNING CLOB
                                        )
                                        ORDER BY gp.seat_order
                                        RETURNING CLOB
                                      )
                                 FROM round_bids rb
                                 JOIN player_display_names_v p ON p.id = rb.player_id
                                 JOIN game_players gp
                                   ON gp.game_id = g.id
                                  AND gp.player_id = rb.player_id
                                WHERE rb.round_id = r.id
                             ) FORMAT JSON
                             RETURNING CLOB
                           )
                           ORDER BY r.round_index
                           RETURNING CLOB
                         )
                    FROM rounds r
                   WHERE r.game_id = g.id
                ) FORMAT JSON
                RETURNING CLOB
              )
         FROM games g
        WHERE g.id = :id
          AND g.finished_at IS NOT NULL
          AND g.is_manual = ''N'''
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'games/:id',
    p_method      => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source      =>
      'BEGIN
         taotl_api.delete_game(:p_authorization, :id);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'games/:id',
    p_method             => 'DELETE',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/register/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'auth/register/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json    CLOB;
        v_status  PLS_INTEGER := 200;
        v_reason  VARCHAR2(40);
        v_code    PLS_INTEGER;
        v_message VARCHAR2(4000);
      BEGIN
        BEGIN
          v_json := taotl_identity_api.register_account(:body);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20400 THEN 400
              WHEN -20409 THEN 409
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 400 THEN 'Bad Request'
              WHEN 409 THEN 'Conflict'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20400, -20409)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Registrazione non riuscita. Riprova tra poco.'
            END;
            SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB)
              INTO v_json
              FROM dual;
        END;
        IF v_status != 200 THEN
          OWA_UTIL.status_line(v_status, v_reason, FALSE);
        END IF;
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/login/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'auth/login/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json    CLOB;
        v_status  PLS_INTEGER := 200;
        v_reason  VARCHAR2(40);
        v_code    PLS_INTEGER;
        v_message VARCHAR2(4000);
      BEGIN
        BEGIN
          v_json := taotl_identity_api.login_account(:body);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20401 THEN 401
              WHEN -20429 THEN 429
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 401 THEN 'Unauthorized'
              WHEN 429 THEN 'Too Many Requests'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20401, -20429)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Accesso non riuscito. Riprova tra poco.'
            END;
            SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB)
              INTO v_json
              FROM dual;
        END;
        IF v_status != 200 THEN
          OWA_UTIL.status_line(v_status, v_reason, FALSE);
        END IF;
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/me/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'auth/me/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.my_account(:p_authorization);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'auth/me/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/logout/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'auth/logout/',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => 'BEGIN taotl_identity_api.logout_account(:p_authorization); END;'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'auth/logout/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'rooms/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'rooms/',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.create_room(:p_authorization);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'rooms/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'rooms/join/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'rooms/join/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.join_room(:p_authorization, :body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'rooms/join/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/rooms/complete -> collega una stanza verificata alla partita
  -- appena conclusa. Solo l'organizzatore della stanza può farlo.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'rooms/complete/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'rooms/complete/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.complete_room_game(:p_authorization, :body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'rooms/complete/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'rooms/:id/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'rooms/:id/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.get_room(:p_authorization, :id);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'rooms/:id/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ---------------------------------------------------------------------------
  -- GET /taotl/leaderboard -> classifica generale (vittorie complessive),
  -- pubblica, non richiede login.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboard/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'leaderboard/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.overall_leaderboard();
        OWA_UTIL.mime_header('application/json', FALSE);
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/admin/games -> aggiunge una partita manuale (solo admin).
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'admin/games/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'admin/games/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.add_manual_game(:p_authorization, :body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'admin/games/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/admin/link-player -> collega un account Taotl ID a un
  -- giocatore già presente in rubrica (solo admin).
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'admin/link-player/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'admin/link-player/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json    CLOB;
        v_status  PLS_INTEGER := 200;
        v_reason  VARCHAR2(40);
        v_code    PLS_INTEGER;
        v_message VARCHAR2(4000);
      BEGIN
        BEGIN
          v_json := taotl_identity_api.link_account_player(:p_authorization, :body);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20400 THEN 400
              WHEN -20401 THEN 401
              WHEN -20403 THEN 403
              WHEN -20404 THEN 404
              WHEN -20409 THEN 409
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 400 THEN 'Bad Request'
              WHEN 401 THEN 'Unauthorized'
              WHEN 403 THEN 'Forbidden'
              WHEN 404 THEN 'Not Found'
              WHEN 409 THEN 'Conflict'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20400, -20401, -20403, -20404, -20409)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Collegamento non riuscito. Riprova tra poco.'
            END;
            SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB)
              INTO v_json
              FROM dual;
        END;
        IF v_status != 200 THEN
          OWA_UTIL.status_line(v_status, v_reason, FALSE);
        END IF;
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'admin/link-player/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ---------------------------------------------------------------------------
  -- GET /taotl/admin/accounts -> elenco account registrati, per scegliere a chi
  -- collegare un giocatore già in rubrica (solo admin).
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'admin/accounts/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'admin/accounts/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.list_accounts(:p_authorization);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'admin/accounts/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/auth/forgot-password -> richiede un reset password via email.
  -- Risposta sempre identica, non richiede login.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/forgot-password/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'auth/forgot-password/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.request_password_reset(:body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ---------------------------------------------------------------------------
  -- POST /taotl/auth/reset-password -> conferma il reset con il codice ricevuto.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/reset-password/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'auth/reset-password/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.confirm_password_reset(:body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  COMMIT;
END;
/
