-- Coda transitoria per le email di recupero password.
-- Il worker sulla VPS elimina ogni riga subito dopo l'invio.
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_MAIL_OUTBOX';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_mail_outbox (
        id          VARCHAR2(60) NOT NULL PRIMARY KEY,
        recipient   VARCHAR2(160) NOT NULL,
        subject     VARCHAR2(240) NOT NULL,
        body_text   VARCHAR2(4000) NOT NULL,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        attempts    NUMBER(3) DEFAULT 0 NOT NULL,
        last_error  VARCHAR2(1000)
      )~';
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_taotl_mail_outbox_created ON taotl_mail_outbox(created_at)';
  END IF;
END;
/

COMMIT;
