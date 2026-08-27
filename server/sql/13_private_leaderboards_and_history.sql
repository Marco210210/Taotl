-- Taotl — storico privato, classifiche private, ruoli, inviti e collegamenti
-- profilo con consenso. Migrazione esclusivamente additiva e idempotente.
-- Richiede 12_multiple_leaderboards.sql.

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tab_columns
   WHERE table_name = 'TAOTL_LEADERBOARDS' AND column_name = 'VISIBILITY';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_leaderboards ADD visibility VARCHAR2(12) DEFAULT ''private'' NOT NULL';
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_leaderboards ADD CONSTRAINT chk_taotl_lb_visibility CHECK (visibility IN (''private'', ''public''))';
  END IF;
END;
/

-- La classifica Generale appartiene al superadmin esistente.
UPDATE taotl_leaderboards l
   SET owner_account_id = (
     SELECT MIN(id) KEEP (DENSE_RANK FIRST ORDER BY created_at)
       FROM taotl_accounts
      WHERE is_admin = 'Y' AND is_active = 'Y'
   )
 WHERE l.id = 'lb_general'
   AND l.owner_account_id IS NULL;

-- I nomi sono unici per proprietario, non più globalmente: nel mondo possono
-- esistere molte classifiche private chiamate "Amici".
DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes
   WHERE index_name = 'UQ_TAOTL_LEADERBOARDS_NAME';
  IF v_exists > 0 THEN
    EXECUTE IMMEDIATE 'DROP INDEX uq_taotl_leaderboards_name';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes
   WHERE index_name = 'UQ_TAOTL_LB_OWNER_NAME';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE UNIQUE INDEX uq_taotl_lb_owner_name ON taotl_leaderboards (
        CASE WHEN is_active = 'Y' THEN owner_account_id END,
        CASE WHEN is_active = 'Y' THEN LOWER(TRIM(name)) END
      )~';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tab_columns
   WHERE table_name = 'TAOTL_ACCOUNT_LEADERBOARDS' AND column_name = 'ROLE';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_account_leaderboards ADD role VARCHAR2(12) DEFAULT ''member'' NOT NULL';
    EXECUTE IMMEDIATE
      'ALTER TABLE taotl_account_leaderboards ADD CONSTRAINT chk_taotl_lb_role CHECK (role IN (''owner'', ''manager'', ''member'', ''viewer''))';
  END IF;
END;
/

UPDATE taotl_account_leaderboards al
   SET role = 'owner'
 WHERE EXISTS (
   SELECT 1 FROM taotl_leaderboards l
    WHERE l.id = al.leaderboard_id
      AND l.owner_account_id = al.account_id
 );

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tab_columns
   WHERE table_name = 'GAMES' AND column_name = 'OWNER_ACCOUNT_ID';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE games ADD owner_account_id VARCHAR2(60) REFERENCES taotl_accounts(id)';
  END IF;
END;
/

UPDATE games
   SET owner_account_id = (
     SELECT MIN(id) KEEP (DENSE_RANK FIRST ORDER BY created_at)
       FROM taotl_accounts
      WHERE is_admin = 'Y' AND is_active = 'Y'
   )
 WHERE owner_account_id IS NULL;

-- NULL significa partita privata: è intenzionale e sostituisce il vecchio
-- obbligo di assegnare ogni partita a Generale.
DECLARE
  v_nullable user_tab_columns.nullable%TYPE;
BEGIN
  SELECT nullable INTO v_nullable FROM user_tab_columns
   WHERE table_name = 'GAMES' AND column_name = 'LEADERBOARD_ID';
  IF v_nullable = 'N' THEN
    EXECUTE IMMEDIATE 'ALTER TABLE games MODIFY leaderboard_id NULL';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'IX_GAMES_OWNER';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'CREATE INDEX ix_games_owner ON games(owner_account_id, created_at)';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tab_columns
   WHERE table_name = 'PLAYERS' AND column_name = 'OWNER_ACCOUNT_ID';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE players ADD owner_account_id VARCHAR2(60) REFERENCES taotl_accounts(id)';
  END IF;
END;
/

UPDATE players
   SET owner_account_id = (
     SELECT MIN(id) KEEP (DENSE_RANK FIRST ORDER BY created_at)
       FROM taotl_accounts
      WHERE is_admin = 'Y' AND is_active = 'Y'
   )
 WHERE owner_account_id IS NULL;

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_LEADERBOARD_PLAYERS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_leaderboard_players (
        leaderboard_id VARCHAR2(60) NOT NULL REFERENCES taotl_leaderboards(id) ON DELETE CASCADE,
        player_id      VARCHAR2(60) NOT NULL REFERENCES players(id) ON DELETE CASCADE,
        added_by       VARCHAR2(60) REFERENCES taotl_accounts(id) ON DELETE SET NULL,
        added_at       TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        CONSTRAINT pk_taotl_leaderboard_players PRIMARY KEY (leaderboard_id, player_id)
      )~';
  END IF;
END;
/

MERGE INTO taotl_leaderboard_players target
USING (
  SELECT DISTINCT g.leaderboard_id, gp.player_id, g.owner_account_id added_by
    FROM games g
    JOIN game_players gp ON gp.game_id = g.id
   WHERE g.leaderboard_id IS NOT NULL
) source
ON (target.leaderboard_id = source.leaderboard_id AND target.player_id = source.player_id)
WHEN NOT MATCHED THEN
  INSERT (leaderboard_id, player_id, added_by)
  VALUES (source.leaderboard_id, source.player_id, source.added_by);

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_LEADERBOARD_INVITES';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_leaderboard_invites (
        id             VARCHAR2(60) NOT NULL PRIMARY KEY,
        leaderboard_id VARCHAR2(60) NOT NULL REFERENCES taotl_leaderboards(id) ON DELETE CASCADE,
        token_hash     VARCHAR2(64) NOT NULL UNIQUE,
        role           VARCHAR2(12) DEFAULT 'member' NOT NULL,
        created_by     VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id),
        created_at     TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        expires_at     TIMESTAMP WITH TIME ZONE NOT NULL,
        max_uses       NUMBER(5) DEFAULT 50 NOT NULL,
        used_count     NUMBER(5) DEFAULT 0 NOT NULL,
        revoked_at     TIMESTAMP WITH TIME ZONE,
        CONSTRAINT chk_taotl_invite_role CHECK (role IN ('manager', 'member', 'viewer')),
        CONSTRAINT chk_taotl_invite_uses CHECK (max_uses > 0 AND used_count >= 0)
      )~';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'IX_TAOTL_INVITES_BOARD';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_taotl_invites_board ON taotl_leaderboard_invites(leaderboard_id, expires_at)';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_tables WHERE table_name = 'TAOTL_PROFILE_LINK_REQUESTS';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE q'~
      CREATE TABLE taotl_profile_link_requests (
        id                VARCHAR2(60) NOT NULL PRIMARY KEY,
        leaderboard_id    VARCHAR2(60) NOT NULL REFERENCES taotl_leaderboards(id) ON DELETE CASCADE,
        player_id         VARCHAR2(60) NOT NULL REFERENCES players(id),
        target_account_id VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id) ON DELETE CASCADE,
        requested_by      VARCHAR2(60) NOT NULL REFERENCES taotl_accounts(id),
        status            VARCHAR2(12) DEFAULT 'pending' NOT NULL,
        created_at        TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
        responded_at      TIMESTAMP WITH TIME ZONE,
        CONSTRAINT chk_taotl_link_request_status CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled'))
      )~';
  END IF;
END;
/

DECLARE
  v_exists NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'IX_TAOTL_LINK_REQUESTS_TARGET';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_taotl_link_requests_target ON taotl_profile_link_requests(target_account_id, status, created_at)';
  END IF;
  SELECT COUNT(*) INTO v_exists FROM user_indexes WHERE index_name = 'IX_TAOTL_LINK_REQUESTS_BOARD';
  IF v_exists = 0 THEN
    EXECUTE IMMEDIATE
      'CREATE INDEX ix_taotl_link_requests_board ON taotl_profile_link_requests(leaderboard_id, status, created_at)';
  END IF;
END;
/

COMMIT;
