-- Taotl ID e stanze per la partecipazione verificata.
--
-- Migrazione esclusivamente ADDITIVA: crea nuove tabelle e non modifica né elimina
-- PLAYERS, GAMES o lo storico esistente. Eseguire come utente TAOTL_APP.

CREATE TABLE taotl_accounts (
  id                 VARCHAR2(60)  NOT NULL PRIMARY KEY,
  handle_normalized  VARCHAR2(24)  NOT NULL,
  display_name       VARCHAR2(80)  NOT NULL,
  pin_salt           VARCHAR2(64)  NOT NULL,
  pin_hash           VARCHAR2(64)  NOT NULL,
  failed_attempts    NUMBER(2) DEFAULT 0 NOT NULL,
  locked_until       TIMESTAMP WITH TIME ZONE,
  is_active          CHAR(1) DEFAULT 'Y' NOT NULL,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT uq_taotl_accounts_handle UNIQUE (handle_normalized),
  CONSTRAINT chk_taotl_accounts_active CHECK (is_active IN ('Y', 'N')),
  CONSTRAINT chk_taotl_accounts_failed CHECK (failed_attempts BETWEEN 0 AND 5)
);

CREATE TABLE taotl_sessions (
  token_hash         VARCHAR2(64) NOT NULL PRIMARY KEY,
  account_id         VARCHAR2(60) NOT NULL
                     REFERENCES taotl_accounts(id) ON DELETE CASCADE,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
);

CREATE INDEX ix_taotl_sessions_account ON taotl_sessions(account_id);
CREATE INDEX ix_taotl_sessions_expiry ON taotl_sessions(expires_at);

CREATE TABLE taotl_game_rooms (
  id                 VARCHAR2(60) NOT NULL PRIMARY KEY,
  join_code          VARCHAR2(6)  NOT NULL,
  host_account_id    VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id),
  status             VARCHAR2(12) DEFAULT 'open' NOT NULL,
  game_id            VARCHAR2(60) REFERENCES games(id) ON DELETE SET NULL,
  created_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT uq_taotl_rooms_code UNIQUE (join_code),
  CONSTRAINT chk_taotl_rooms_status
    CHECK (status IN ('open', 'playing', 'finished', 'cancelled'))
);

CREATE INDEX ix_taotl_rooms_host ON taotl_game_rooms(host_account_id);
CREATE INDEX ix_taotl_rooms_expiry ON taotl_game_rooms(expires_at);

CREATE TABLE taotl_room_participants (
  room_id            VARCHAR2(60) NOT NULL
                     REFERENCES taotl_game_rooms(id) ON DELETE CASCADE,
  account_id         VARCHAR2(60) NOT NULL
                     REFERENCES taotl_accounts(id) ON DELETE CASCADE,
  is_host            CHAR(1) DEFAULT 'N' NOT NULL,
  joined_at          TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  confirmed_at       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_taotl_room_participants PRIMARY KEY (room_id, account_id),
  CONSTRAINT chk_taotl_room_host CHECK (is_host IN ('Y', 'N'))
);

CREATE INDEX ix_taotl_room_part_account
  ON taotl_room_participants(account_id, joined_at);

-- Questa tabella verrà popolata soltanto quando una partita conclusa viene legata
-- alla stanza e il singolo account conferma dal proprio dispositivo il posto occupato.
-- Evita che l'organizzatore attribuisca da solo una partita a un account assente.
CREATE TABLE taotl_verified_game_accounts (
  game_id            VARCHAR2(60) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  account_id         VARCHAR2(60) NOT NULL
                     REFERENCES taotl_accounts(id) ON DELETE CASCADE,
  room_id            VARCHAR2(60) NOT NULL REFERENCES taotl_game_rooms(id),
  player_id          VARCHAR2(60) NOT NULL REFERENCES players(id),
  confirmed_at       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT pk_taotl_verified_games PRIMARY KEY (game_id, account_id),
  CONSTRAINT uq_taotl_verified_seat UNIQUE (game_id, player_id)
);

