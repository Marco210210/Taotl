-- Endpoint Taotl ID: .../ords/taotl_app/taotl/...
-- Richiede 03_identity_package.sql. Non ridefinisce i moduli rubrica/storico.

BEGIN
  ORDS.DEFINE_MODULE(
    p_module_name    => 'taotl.identity',
    p_base_path      => 'taotl/',
    p_items_per_page => 0
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'auth/register/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.identity',
    p_pattern       => 'auth/register/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.register_account(:body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'auth/login/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.identity',
    p_pattern       => 'auth/login/',
    p_method        => 'POST',
    p_source_type   => ORDS.source_type_plsql,
    p_mimes_allowed => 'application/json',
    p_source        => q'~
      DECLARE
        v_json CLOB;
      BEGIN
        v_json := taotl_identity_api.login_account(:body);
        OWA_UTIL.mime_header('application/json', FALSE);
        HTP.p('Cache-Control: no-store');
        OWA_UTIL.http_header_close;
        HTP.prn(v_json);
      END;~'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'auth/me/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.identity',
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
    p_module_name        => 'taotl.identity',
    p_pattern            => 'auth/me/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'auth/logout/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.identity',
    p_pattern     => 'auth/logout/',
    p_method      => 'POST',
    p_source_type => ORDS.source_type_plsql,
    p_source      => 'BEGIN taotl_identity_api.logout_account(:p_authorization); END;'
  );
  ORDS.DEFINE_PARAMETER(
    p_module_name        => 'taotl.identity',
    p_pattern            => 'auth/logout/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'rooms/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.identity',
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
    p_module_name        => 'taotl.identity',
    p_pattern            => 'rooms/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'rooms/join/');
  ORDS.DEFINE_HANDLER(
    p_module_name   => 'taotl.identity',
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
    p_module_name        => 'taotl.identity',
    p_pattern            => 'rooms/join/',
    p_method             => 'POST',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  ORDS.DEFINE_TEMPLATE(p_module_name => 'taotl.identity', p_pattern => 'rooms/:id/');
  ORDS.DEFINE_HANDLER(
    p_module_name => 'taotl.identity',
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
    p_module_name        => 'taotl.identity',
    p_pattern            => 'rooms/:id/',
    p_method             => 'GET',
    p_name               => 'Authorization',
    p_bind_variable_name => 'p_authorization',
    p_source_type        => 'HEADER',
    p_param_type         => 'STRING',
    p_access_method      => 'IN'
  );

  COMMIT;
END;
/

