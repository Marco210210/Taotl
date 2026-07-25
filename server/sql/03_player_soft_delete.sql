-- Migrazione non distruttiva per installazioni Taotl già esistenti.
-- I giocatori eliminati spariscono dalla rubrica, ma restano nel database per
-- preservare tutte le partite e i punteggi storici che li referenziano.

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM user_tab_columns
   WHERE table_name = 'PLAYERS'
     AND column_name = 'IS_ACTIVE';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE players ADD is_active CHAR(1) DEFAULT ON NULL ''Y'' NOT NULL';
  END IF;
END;
/

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM user_constraints
   WHERE table_name = 'PLAYERS'
     AND constraint_name = 'CHK_PLAYERS_ACTIVE';

  IF v_count = 0 THEN
    EXECUTE IMMEDIATE
      'ALTER TABLE players ADD CONSTRAINT chk_players_active ' ||
      'CHECK (is_active IN (''Y'', ''N''))';
  END IF;
END;
/
