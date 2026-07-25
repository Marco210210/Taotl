-- Definizione degli endpoint REST. Da eseguire dopo 01_api_package.sql, connessi allo
-- stesso schema applicativo (es. TAOTL_APP), con il pacchetto ORDS disponibile.
--
-- IMPORTANTE: questo script non è stato eseguito contro un'istanza Oracle reale (in questa
-- sessione non ho accesso alla VPS). È scritto seguendo i pattern documentati ORDS
-- standard, ma và testato ed eventualmente corretto passo passo quando lo si esegue
-- davvero: lanciare ogni blocco singolarmente e controllare l'esito prima di proseguire.

-- 1) Abilita lo schema per l'accesso REST (alias usato nell'URL pubblico, es. .../ords/taotl_app/...)
BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => USER,
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'taotl_app',
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
END;
/

-- 2) Disabilita AutoREST sulla tabella: le scritture devono passare dai handler
--    espliciti sotto, che verificano X-App-Key e supportano aggiornamenti parziali.
BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled      => FALSE,
    p_schema       => USER,
    p_object       => 'PLAYERS',
    p_object_type  => 'TABLE',
    p_object_alias => 'players'
  );
  COMMIT;
END;
/

-- 3) Modulo rubrica. Base path: .../players/...
BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'taotl.players',
    p_base_path      => 'players/',
    p_items_per_page => 0
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'taotl.players',
    p_pattern     => '.'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players',
    p_pattern     => '.',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT ''application/json'',
              COALESCE(
                JSON_ARRAYAGG(
                  JSON_OBJECT(
                    ''id''       VALUE id,
                    ''name''     VALUE name,
                    ''hasPhoto'' VALUE
                      CASE WHEN photo IS NULL THEN ''false'' ELSE ''true'' END FORMAT JSON
                    RETURNING CLOB
                  )
                  ORDER BY created_at, name
                  RETURNING CLOB
                ),
                TO_CLOB(''[]'')
              )
         FROM players
        WHERE is_active = ''Y'''
  );

  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.players',
    p_pattern       => '.',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        =>
      'BEGIN
         taotl_api.create_player(:p_app_key, :body);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => '.',
    p_method             => 'POST',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'taotl.players',
    p_pattern     => ':id'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players',
    p_pattern     => ':id',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT ''application/json'',
              JSON_OBJECT(
                ''id''       VALUE id,
                ''name''     VALUE name,
                ''hasPhoto'' VALUE
                  CASE WHEN photo IS NULL THEN ''false'' ELSE ''true'' END FORMAT JSON
                RETURNING CLOB
              )
         FROM players
        WHERE id = :id
          AND is_active = ''Y'''
  );

  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.players',
    p_pattern       => ':id',
    p_method        => 'PUT',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        =>
      'BEGIN
         taotl_api.update_player(:p_app_key, :id, :body);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => ':id',
    p_method             => 'PUT',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players',
    p_pattern     => ':id',
    p_method      => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source      =>
      'BEGIN
         taotl_api.delete_player(:p_app_key, :id);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => ':id',
    p_method             => 'DELETE',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(
    p_module_name => 'taotl.players',
    p_pattern     => ':id/photo'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players',
    p_pattern     => ':id/photo',
    p_method      => 'GET',
    p_source_type => ORDS.source_type_media,
    p_source      =>
      'SELECT NVL(photo_media_type, ''application/octet-stream''), photo
         FROM players
        WHERE id = :id
          AND is_active = ''Y''
          AND photo IS NOT NULL'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players',
    p_pattern     => ':id/photo',
    p_method      => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source      =>
      'BEGIN
         taotl_api.update_player_photo(
           :p_app_key,
           :id,
           :body,
           :p_content_type
         );
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => ':id/photo',
    p_method             => 'PUT',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => ':id/photo',
    p_method             => 'PUT',
    p_name               => 'Content-Type',
    p_bind_variable_name => 'p_content_type',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  COMMIT;
END;
/

-- 4) Modulo custom "taotl" per le operazioni con logica applicativa (sincronizzazione
--    partite concluse e storico). Base path: .../taotl/...
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
                             ''name''      VALUE p.name,
                             ''seatOrder'' VALUE gp.seat_order
                             RETURNING CLOB
                           )
                           ORDER BY gp.seat_order
                           RETURNING CLOB
                         )
                    FROM game_players gp
                    JOIN players p ON p.id = gp.player_id
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
                                          ''name''      VALUE p.name,
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
                                 JOIN players p ON p.id = rb.player_id
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
          AND g.finished_at IS NOT NULL'
  );

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api',
    p_pattern     => 'games/:id',
    p_method      => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source      =>
      'BEGIN
         taotl_api.delete_game(:p_app_key, :id);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.api',
    p_pattern            => 'games/:id',
    p_method             => 'DELETE',
    p_name               => 'X-App-Key',
    p_bind_variable_name => 'p_app_key',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  COMMIT;
END;
/
