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
                    ''name''     VALUE player_name,
                    ''hasPhoto'' VALUE
                      CASE WHEN photo IS NULL THEN ''false'' ELSE ''true'' END FORMAT JSON
                    RETURNING CLOB
                  )
                  ORDER BY created_at, player_name
                  RETURNING CLOB
                ),
                TO_CLOB(''[]'')
              )
         FROM player_display_names_v
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
                ''name''     VALUE player_name,
                ''hasPhoto'' VALUE
                  CASE WHEN photo IS NULL THEN ''false'' ELSE ''true'' END FORMAT JSON
                RETURNING CLOB
              )
         FROM player_display_names_v
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
         taotl_api.delete_player(:p_authorization, :id);
       END;'
  );

  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.players',
    p_pattern            => ':id',
    p_method             => 'DELETE',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
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

-- Il modulo 'taotl.api' (base_path 'taotl/': games/, auth/*, rooms/*, leaderboard/,
-- admin/*) è definito TUTTO INSIEME in server/ords/04_identity_module.sql.
-- IMPORTANTE: ORDS.DEFINE_MODULE ridefinisce l'intero modulo quando viene richiamato,
-- quindi i template di uno stesso modulo non possono essere sparsi su più script
-- eseguiti separatamente (il secondo script cancellerebbe i pattern del primo) — per
-- questo 'taotl.players' (sopra, base_path separato) resta qui, ma 'taotl.api' vive
-- solo in 04_identity_module.sql.
