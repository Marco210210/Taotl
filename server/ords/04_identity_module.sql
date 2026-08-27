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
  -- GET /taotl/games -> storico completo, incluse le partite inserite a mano
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
                    ''leaderboardId'' VALUE g.leaderboard_id,
                    ''mode''       VALUE g.game_mode,
                    ''numPlayers'' VALUE (
                      SELECT COUNT(*) FROM game_players gp_count WHERE gp_count.game_id = g.id
                    ),
                    ''winnerId''   VALUE g.winner_player_id,
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
                               ORDER BY v.manual_won DESC, v.total DESC NULLS LAST
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
        WHERE g.finished_at IS NOT NULL'
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
                ''leaderboardId'' VALUE g.leaderboard_id,
                ''mode''          VALUE g.game_mode,
                ''numPlayers''    VALUE (
                  SELECT COUNT(*) FROM game_players gp_count WHERE gp_count.game_id = g.id
                ),
                ''winnerId''      VALUE g.winner_player_id,
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
                           ORDER BY v.manual_won DESC, v.total DESC NULLS LAST
                           RETURNING CLOB
                         )
                    FROM game_standings_v v
                   WHERE v.game_id = g.id
                ) FORMAT JSON,
                ''rounds''        VALUE (
                  SELECT COALESCE(JSON_ARRAYAGG(
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
                         ), TO_CLOB(''[]''))
                    FROM rounds r
                   WHERE r.game_id = g.id
                ) FORMAT JSON
                RETURNING CLOB
              )
         FROM games g
        WHERE g.id = :id
          AND g.finished_at IS NOT NULL'
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

  ---------------------------------------------------------------------------
  -- GET /taotl/players/:id/manual-games -> partite manuali (senza round, solo
  -- vincitore e punteggio finale se noto) in cui quel giocatore è coinvolto.
  -- Mantenuto per la scheda del singolo giocatore, anche se ora le partite
  -- manuali compaiono pure nello storico generale.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'taotl.api',
    p_pattern     => 'players/:id/manual-games'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'players/:id/manual-games',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT ''application/json'',
              COALESCE(
                JSON_ARRAYAGG(
                  JSON_OBJECT(
                    ''id''          VALUE g.id,
                    ''leaderboardId'' VALUE g.leaderboard_id,
                    ''playedAt''    VALUE
                      TO_CHAR(g.created_at, ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM''),
                    ''winnerId''    VALUE g.winner_player_id,
                    ''winnerName''  VALUE wp.player_name,
                    ''myScore''     VALUE gp.final_score,
                    ''participants'' VALUE (
                      SELECT JSON_ARRAYAGG(
                               JSON_OBJECT(
                                 ''id''   VALUE pp.id,
                                 ''name'' VALUE pp.player_name
                                 RETURNING CLOB
                               )
                               RETURNING CLOB
                             )
                        FROM game_players gp2
                        JOIN player_display_names_v pp ON pp.id = gp2.player_id
                       WHERE gp2.game_id = g.id
                    ) FORMAT JSON
                    RETURNING CLOB
                  )
                  ORDER BY g.created_at DESC
                  RETURNING CLOB
                ),
                TO_CLOB(''[]'')
              )
         FROM games g
         JOIN game_players gp ON gp.game_id = g.id AND gp.player_id = :id
         LEFT JOIN player_display_names_v wp ON wp.id = g.winner_player_id
        WHERE g.is_manual = ''Y'''
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
        v_json    CLOB;
        v_status  PLS_INTEGER := 200;
        v_reason  VARCHAR2(40);
        v_code    PLS_INTEGER;
        v_message VARCHAR2(4000);
      BEGIN
        BEGIN
          v_json := taotl_identity_api.my_account(:p_authorization);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20401 THEN 401
              WHEN -20403 THEN 403
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 401 THEN 'Unauthorized'
              WHEN 403 THEN 'Forbidden'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20401, -20403)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Profilo non disponibile. Riprova tra poco.'
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
    p_pattern            => 'auth/me/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'auth/me/leaderboards/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'auth/me/leaderboards/',
    p_method        => 'PUT',
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
          v_json := taotl_identity_api.update_my_leaderboards(:p_authorization, :body);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20400 THEN 400
              WHEN -20401 THEN 401
              WHEN -20403 THEN 403
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 400 THEN 'Bad Request'
              WHEN 401 THEN 'Unauthorized'
              WHEN 403 THEN 'Forbidden'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20400, -20401, -20403)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Preferenze non aggiornate. Riprova tra poco.'
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
    p_pattern            => 'auth/me/leaderboards/',
    p_method             => 'PUT',
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
  -- GET/POST /taotl/leaderboards -> elenco o creazione di una classifica.
  ---------------------------------------------------------------------------
  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'leaderboards/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.list_leaderboards();
        OWA_UTIL.mime_header('application/json', FALSE);
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.api',
    p_pattern       => 'leaderboards/',
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
          v_json := taotl_identity_api.create_leaderboard(:p_authorization, :body);
        EXCEPTION
          WHEN OTHERS THEN
            v_code := SQLCODE;
            ROLLBACK;
            v_status := CASE v_code
              WHEN -20400 THEN 400
              WHEN -20401 THEN 401
              WHEN -20403 THEN 403
              WHEN -20409 THEN 409
              ELSE 500
            END;
            v_reason := CASE v_status
              WHEN 400 THEN 'Bad Request'
              WHEN 401 THEN 'Unauthorized'
              WHEN 403 THEN 'Forbidden'
              WHEN 409 THEN 'Conflict'
              ELSE 'Internal Server Error'
            END;
            v_message := CASE
              WHEN v_code IN (-20400, -20401, -20403, -20409)
                THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
              ELSE 'Creazione classifica non riuscita. Riprova tra poco.'
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
    p_pattern            => 'leaderboards/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'leaderboards/:id/',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source      => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.overall_leaderboard(:id);
        OWA_UTIL.mime_header('application/json', FALSE);
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ---------------------------------------------------------------------------
  -- GET /taotl/leaderboard -> classifica generale (vittorie complessive),
  -- endpoint di compatibilità per le versioni precedenti dell'app.
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
        v_json := taotl_identity_api.overall_leaderboard('lb_general');
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
        v_code PLS_INTEGER;
        v_status PLS_INTEGER := 200;
        v_message VARCHAR2(4000);
      BEGIN
        BEGIN
          v_json := taotl_identity_api.request_password_reset(:body);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE;
          ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 ELSE 500 END;
          v_message := CASE WHEN v_code = -20400
            THEN REGEXP_REPLACE(SQLERRM, '^ORA-[0-9]+: *', '')
            ELSE 'Richiesta non riuscita. Riprova tra poco.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN
          OWA_UTIL.status_line(v_status, CASE WHEN v_status = 400 THEN 'Bad Request' ELSE 'Internal Server Error' END, FALSE);
        END IF;
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

  ---------------------------------------------------------------------------
  -- Collaborazione privata (ridefinisce anche gli handler legacy sopra).
  ---------------------------------------------------------------------------
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'games/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN v_json := taotl_api.list_games(:p_authorization);
        EXCEPTION WHEN OTHERS THEN v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20401,-20403) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Storico non disponibile.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status, CASE v_status WHEN 401 THEN 'Unauthorized' WHEN 403 THEN 'Forbidden' ELSE 'Internal Server Error' END, FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','games/','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'games/', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN taotl_api.sync_game(:p_authorization,:body);
        EXCEPTION WHEN OTHERS THEN v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Salvataggio non riuscito.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status, CASE v_status WHEN 400 THEN 'Bad Request' WHEN 401 THEN 'Unauthorized' WHEN 403 THEN 'Forbidden' WHEN 404 THEN 'Not Found' WHEN 409 THEN 'Conflict' ELSE 'Internal Server Error' END, FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','games/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'games/:id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN v_json := taotl_api.get_game(:p_authorization,:id);
        EXCEPTION WHEN OTHERS THEN v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Partita non disponibile.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status, CASE v_status WHEN 401 THEN 'Unauthorized' WHEN 403 THEN 'Forbidden' WHEN 404 THEN 'Not Found' ELSE 'Internal Server Error' END, FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','games/:id','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.list_leaderboards(:p_authorization); OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN IF SQLCODE=-20401 THEN OWA_UTIL.status_line(401,'Unauthorized',FALSE); ELSE OWA_UTIL.status_line(500,'Internal Server Error',FALSE); END IF; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE=-20401 THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Classifiche non disponibili.' END)); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/','GET','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.create_leaderboard(:p_authorization,:body); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20409 THEN 409 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20400,-20401,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Creazione non riuscita.' END)); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.leaderboard_entries(:p_authorization,:id); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Classifica non disponibile.' END)); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.rename_leaderboard(:p_authorization,:id,:body); OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; taotl_api.print_clob(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20400,-20401,-20403,-20404,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Rinomina non riuscita.' END)); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/','PUT','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/players/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/players/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json:=taotl_api.list_leaderboard_players(:p_authorization,:id); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Giocatori non disponibili.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; taotl_api.print_clob(v_json); END;~'
  );
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/players/', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB:='{}'; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN taotl_collaboration_api.add_player(:p_authorization,:id,:body); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Giocatore non aggiunto.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/players/','GET','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/players/','PUT','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/players/:playerId');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/players/:playerId', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB:='{}'; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN taotl_collaboration_api.remove_player(:p_authorization,:id,:playerId); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Giocatore non rimosso.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/players/:playerId','DELETE','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/join/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/join/', p_method => 'POST', p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.join_leaderboard(:p_authorization,:body); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20401 THEN 401 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20401,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Invito non utilizzabile.' END)); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/join/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/invites/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/invites/', p_method => 'POST', p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.create_invite(:p_authorization,:id,:body); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20400,-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Invito non creato.' END)); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/invites/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/members/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/members/', p_method => 'GET', p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json := taotl_collaboration_api.list_members(:p_authorization,:id); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Membri non disponibili.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/members/', p_method => 'PUT', p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB:='{}'; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN taotl_collaboration_api.update_member_role(:p_authorization,:id,:body); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20400,-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Ruolo non aggiornato.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/members/','GET','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/members/','PUT','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/members/:accountId');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/members/:accountId', p_method => 'DELETE', p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB:='{}'; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN taotl_collaboration_api.remove_member(:p_authorization,:id,:accountId); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Membro non rimosso.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/members/:accountId','DELETE','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/link-requests/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'leaderboards/:id/link-requests/', p_method => 'POST', p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json:=taotl_collaboration_api.create_link_request(:p_authorization,:id,:body); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Richiesta non inviata.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboards/:id/link-requests/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'profile-link-requests/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'profile-link-requests/', p_method => 'GET', p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json:=taotl_collaboration_api.list_link_requests(:p_authorization); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Richieste non disponibili.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','profile-link-requests/','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.api', p_pattern => 'profile-link-requests/:id/respond/');
  ORDS.DEFINE_HANDLER(p_module_name => 'taotl.api', p_pattern => 'profile-link-requests/:id/respond/', p_method => 'POST', p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json:=taotl_collaboration_api.respond_link_request(:p_authorization,:id,:body); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; ROLLBACK; OWA_UTIL.status_line(CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Risposta non salvata.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~');
  ORDS.DEFINE_PARAMETER('taotl.api','profile-link-requests/:id/respond/','POST','Authorization','p_authorization','HEADER','STRING','IN');

  -- Chiude gli ultimi endpoint legacy che esponevano dati senza sessione.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'leaderboard/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_collaboration_api.leaderboard_entries(:p_authorization,'lb_general'); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE 'Classifica non disponibile.')); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','leaderboard/','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'players/:id/manual-games', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; BEGIN v_json := taotl_api.list_manual_games(:p_authorization,:id); OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; HTP.prn(v_json); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20401 THEN 401 WHEN -20403 THEN 403 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE 'Partite non disponibili.')); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','players/:id/manual-games','GET','Authorization','p_authorization','HEADER','STRING','IN');

  COMMIT;
END;
/
