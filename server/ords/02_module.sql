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

  -- Ridefinizioni autenticate: ogni account vede i profili propri e quelli
  -- condivisi dalle sue classifiche; la vecchia chiave comune non concede più accesso.
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => '.', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; v_message VARCHAR2(4000); BEGIN BEGIN v_json := taotl_api.list_players(:p_authorization); EXCEPTION WHEN OTHERS THEN IF SQLCODE=-20401 THEN OWA_UTIL.status_line(401,'Unauthorized',FALSE); v_message:=REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *',''); ELSE OWA_UTIL.status_line(500,'Internal Server Error',FALSE); v_message:='Rubrica non disponibile.'; END IF; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players','.','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => '.', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~BEGIN taotl_api.create_player(:p_authorization,:body); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn('{}'); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20409 THEN 409 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn(JSON_OBJECT('message' VALUE CASE WHEN SQLCODE IN (-20400,-20401,-20403,-20409) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Profilo non creato.' END)); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players','.','POST','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~DECLARE v_json CLOB; v_code PLS_INTEGER; v_message VARCHAR2(4000); BEGIN BEGIN v_json:=taotl_api.get_player(:p_authorization,:id); EXCEPTION WHEN OTHERS THEN v_code:=SQLCODE; OWA_UTIL.status_line(CASE v_code WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); v_message:=CASE WHEN v_code IN (-20401,-20403,-20404) THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Profilo non disponibile.' END; SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual; END; OWA_UTIL.mime_header('application/json',FALSE); HTP.p('Cache-Control: no-store'); OWA_UTIL.http_header_close; HTP.prn(v_json); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id/photo', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~BEGIN taotl_api.serve_player_photo(:p_authorization,:id); EXCEPTION WHEN OTHERS THEN OWA_UTIL.status_line(CASE SQLCODE WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 ELSE 500 END,'Error',FALSE); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn('{"message":"Foto non disponibile."}'); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id/photo','GET','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql, p_mimes_allowed => 'application/json',
    p_source => q'~BEGIN taotl_api.update_player(:p_authorization,:id,:body); OWA_UTIL.mime_header('application/json',FALSE); OWA_UTIL.http_header_close; HTP.prn('{}'); END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id','PUT','Authorization','p_authorization','HEADER','STRING','IN');

  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id/photo', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source => 'BEGIN taotl_api.update_player_photo(:p_authorization,:id,:body,:p_content_type); END;'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id/photo','PUT','Authorization','p_authorization','HEADER','STRING','IN');

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
