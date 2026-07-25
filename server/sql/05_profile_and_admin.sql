-- Password al posto del PIN, profilo esteso (nome/cognome), ruolo admin, e
-- collegamento fra un account Taotl ID e un giocatore già esistente in rubrica.
-- Eseguire come utente TAOTL_APP, dopo 04_identity_and_verified_rooms.sql.

ALTER TABLE taotl_accounts RENAME COLUMN pin_salt TO password_salt;
ALTER TABLE taotl_accounts RENAME COLUMN pin_hash TO password_hash;

ALTER TABLE taotl_accounts ADD first_name VARCHAR2(80);
ALTER TABLE taotl_accounts ADD last_name  VARCHAR2(80);
ALTER TABLE taotl_accounts ADD is_admin CHAR(1) DEFAULT 'N' NOT NULL;
ALTER TABLE taotl_accounts ADD CONSTRAINT chk_taotl_accounts_admin CHECK (is_admin IN ('Y', 'N'));

-- Collega un account (login) a un giocatore già presente in rubrica, così le
-- partite passate di quel giocatore contano per l'account. Solo l'admin può
-- creare/aggiornare questo collegamento (vedi taotl_identity_api.link_account_player).
CREATE TABLE taotl_account_players (
  account_id VARCHAR2(60) NOT NULL PRIMARY KEY REFERENCES taotl_accounts(id),
  player_id  VARCHAR2(60) NOT NULL UNIQUE REFERENCES players(id),
  linked_at  TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

-- Partite inserite manualmente dall'admin (es. partite "carta e penna" giocate senza
-- l'app, o storico pregresso): si registra solo chi ha vinto, non il punteggio
-- round per round.
ALTER TABLE games MODIFY start_dealer_id NULL;
ALTER TABLE games ADD is_manual CHAR(1) DEFAULT 'N' NOT NULL;
ALTER TABLE games ADD CONSTRAINT chk_games_manual CHECK (is_manual IN ('Y', 'N'));
ALTER TABLE games ADD winner_player_id VARCHAR2(60) REFERENCES players(id);

ALTER TABLE games DROP CONSTRAINT chk_games_mode;
ALTER TABLE games ADD CONSTRAINT chk_games_mode
  CHECK (game_mode IN ('classica', 'completa', 'breve', 'personalizzata', 'manuale'));
