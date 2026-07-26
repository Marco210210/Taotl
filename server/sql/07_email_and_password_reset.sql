-- Email sul profilo (per il recupero password) e tabella dei token di reset.
-- Eseguire come utente TAOTL_APP, dopo 05_profile_and_admin.sql.

ALTER TABLE taotl_accounts ADD email VARCHAR2(160);
ALTER TABLE taotl_accounts ADD CONSTRAINT uq_taotl_accounts_email UNIQUE (email);

-- Token di reset password: salvato solo come hash, come i token di sessione.
CREATE TABLE taotl_password_resets (
  token_hash VARCHAR2(64) NOT NULL PRIMARY KEY,
  account_id VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX ix_taotl_password_resets_account ON taotl_password_resets(account_id);
