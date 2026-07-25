-- Taotl — schema applicativo.
-- Da eseguire connessi allo schema/utente dedicato all'app (es. TAOTL_APP), non a SYS/SYSTEM.

CREATE TABLE players (
  id                VARCHAR2(60)  NOT NULL PRIMARY KEY, -- id generato dall'app (client-side), non una sequence
  name              VARCHAR2(120) NOT NULL,
  photo             BLOB,
  photo_media_type  VARCHAR2(60),
  is_active         CHAR(1) DEFAULT ON NULL 'Y' NOT NULL,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT ON NULL SYSTIMESTAMP NOT NULL,
  CONSTRAINT chk_players_active CHECK (is_active IN ('Y', 'N'))
);

CREATE TABLE games (
  id                VARCHAR2(60)  NOT NULL PRIMARY KEY, -- id generato dall'app
  game_mode         VARCHAR2(20)  NOT NULL,
  num_players       NUMBER(3)     NOT NULL,
  start_dealer_id   VARCHAR2(60)  NOT NULL REFERENCES players(id),
  created_at        TIMESTAMP WITH TIME ZONE NOT NULL,
  finished_at       TIMESTAMP WITH TIME ZONE,
  synced_at         TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT chk_games_mode CHECK (game_mode IN ('classica', 'completa', 'breve', 'personalizzata'))
);

CREATE TABLE game_players (
  game_id           VARCHAR2(60) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id         VARCHAR2(60) NOT NULL REFERENCES players(id),
  seat_order        NUMBER(3)    NOT NULL,
  CONSTRAINT pk_game_players PRIMARY KEY (game_id, player_id)
);

CREATE TABLE rounds (
  id                NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  game_id           VARCHAR2(60) NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  round_index       NUMBER(3)    NOT NULL,
  cards_dealt       NUMBER(3)    NOT NULL,
  presa_value       NUMBER(5)    NOT NULL,
  rispetto_value    NUMBER(5)    NOT NULL,
  dealer_player_id  VARCHAR2(60) NOT NULL REFERENCES players(id),
  CONSTRAINT uq_rounds UNIQUE (game_id, round_index)
);

CREATE TABLE round_bids (
  round_id          NUMBER       NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
  player_id         VARCHAR2(60) NOT NULL REFERENCES players(id),
  bid               NUMBER(3)    NOT NULL,
  respected         CHAR(1)      NOT NULL,
  scarto            NUMBER(3)    DEFAULT 0 NOT NULL,
  score             NUMBER(6)    NOT NULL,
  CONSTRAINT pk_round_bids PRIMARY KEY (round_id, player_id),
  CONSTRAINT chk_round_bids_respected CHECK (respected IN ('Y', 'N'))
);
