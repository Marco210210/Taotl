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

-- 2) AutoREST sulla tabella players: espone GET/POST/PUT/DELETE su .../players
--    e la foto (colonna BLOB "photo") come sotto-risorsa .../players/{id}/photo.
BEGIN
  ORDS.ENABLE_OBJECT(
    p_enabled      => TRUE,
    p_schema       => USER,
    p_object       => 'PLAYERS',
    p_object_type  => 'TABLE',
    p_object_alias => 'players'
  );
  COMMIT;
END;
/

-- 3) Modulo custom "taotl" per le operazioni con logica applicativa (sincronizzazione
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
    p_name               => 'p_app_key',
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
    p_source_type => ORDS.source_type_query,
    p_source      =>
      'SELECT g.id,
              g.mode,
              g.num_players                                                     AS "numPlayers",
              TO_CHAR(g.created_at,  ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'')      AS "startedAt",
              TO_CHAR(g.finished_at, ''YYYY-MM-DD"T"HH24:MI:SS.FF3TZH:TZM'')      AS "endedAt",
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  ''playerId'' VALUE v.player_id,
                  ''name''     VALUE v.player_name,
                  ''total''    VALUE v.total
                )
                ORDER BY v.total DESC
              )                                                                  AS standings
         FROM games g
         JOIN game_standings_v v ON v.game_id = g.id
        WHERE g.finished_at IS NOT NULL
        GROUP BY g.id, g.mode, g.num_players, g.created_at, g.finished_at
        ORDER BY g.created_at DESC'
  );

  COMMIT;
END;
/
