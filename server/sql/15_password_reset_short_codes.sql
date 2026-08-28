-- Codici di recupero brevi, scadenza rapida e limite ai tentativi.
-- Migrazione idempotente da eseguire come TAOTL_APP.
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_exists
    FROM user_tab_columns
   WHERE table_name = 'TAOTL_PASSWORD_RESETS'
     AND column_name = 'ATTEMPTS';

  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_password_resets ADD attempts NUMBER(2) DEFAULT 0 NOT NULL';
  END IF;
END;
/

-- I token creati con il vecchio formato a 64 caratteri non devono restare
-- validi dopo il passaggio ai codici numerici di 8 cifre.
DELETE FROM taotl_password_resets;
COMMIT;
