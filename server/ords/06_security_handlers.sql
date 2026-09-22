-- Apply after 02_module.sql and 04_identity_module.sql. No modules are recreated.
BEGIN
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'admin/accounts/', p_method => 'GET',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN v_json := taotl_identity_api.list_accounts(:p_authorization);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','admin/accounts/','GET','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'admin/games/', p_method => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN v_json := taotl_identity_api.add_manual_game(:p_authorization,:body);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','admin/games/','POST','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.api', p_pattern => 'games/:id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN taotl_api.delete_game(:p_authorization,:id);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.api','games/:id','DELETE','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id', p_method => 'DELETE',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN taotl_api.delete_player(:p_authorization,:id);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id','DELETE','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN taotl_api.update_player(:p_authorization,:id,:body);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id','PUT','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.players', p_pattern => ':id/photo', p_method => 'PUT',
    p_source_type => ORDS.source_type_plsql,
    p_source => q'~
      DECLARE v_json CLOB := '{}'; v_code PLS_INTEGER; v_status PLS_INTEGER := 200; v_message VARCHAR2(4000);
      BEGIN
        BEGIN taotl_api.update_player_photo(:p_authorization,:id,:body,:p_content_type);
        EXCEPTION WHEN OTHERS THEN
          v_code := SQLCODE; ROLLBACK;
          v_status := CASE v_code WHEN -20400 THEN 400 WHEN -20401 THEN 401 WHEN -20403 THEN 403 WHEN -20404 THEN 404 WHEN -20409 THEN 409 WHEN -20429 THEN 429 ELSE 500 END;
          v_message := CASE WHEN v_code IN (-20400,-20401,-20403,-20404,-20409,-20429)
            THEN REGEXP_REPLACE(SQLERRM,'^ORA-[0-9]+: *','') ELSE 'Operazione non riuscita.' END;
          SELECT JSON_OBJECT('message' VALUE v_message RETURNING CLOB) INTO v_json FROM dual;
        END;
        IF v_status != 200 THEN OWA_UTIL.status_line(v_status,'Error',FALSE); END IF;
        OWA_UTIL.mime_header('application/json',FALSE);
        HTP.p('Cache-Control: no-store'); HTP.p('X-Content-Type-Options: nosniff');
        OWA_UTIL.http_header_close; taotl_api.print_clob(v_json);
      END;~'
  );
  ORDS.DEFINE_PARAMETER('taotl.players',':id/photo','PUT','Authorization','p_authorization','HEADER','STRING','IN');
  ORDS.DEFINE_PARAMETER('taotl.players',':id/photo','PUT','Content-Type','p_content_type','HEADER','STRING','IN');
  COMMIT;
END;
/
