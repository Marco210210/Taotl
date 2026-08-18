# Deploy del backend Taotl sulla VPS Oracle

Questa guida è pensata per essere seguita nella sessione che aprirai più avanti via VS
Code Remote-SSH sulla tua VPS Oracle Cloud (Always Free), con questa cartella `server/`
copiata lì dentro. Copre: installazione/configurazione di Oracle DB + ORDS (se non già
pronti), creazione dello schema applicativo, deploy degli script SQL/ORDS di questo
progetto, ed esposizione pubblica gratuita via HTTPS.

Gli script sono mantenuti e verificati sull'istanza Oracle/ORDS di Taotl. Prima di
applicarli altrove controlla comunque l'esito di ogni file e non proseguire se Oracle
segnala errori.

## 0. Prerequisiti

- Una VPS Oracle Cloud Always Free (compute instance) raggiungibile via SSH, con porta
  443 aperta nella Network Security Group / Security List (per l'HTTPS pubblico).
- Se Oracle Database non è ancora installato: **Oracle Database Free 23ai** è la scelta
  giusta, gratuita per sempre, nessuna licenza da comprare
  (https://www.oracle.com/database/free/). In alternativa va bene una XE già esistente.
- **ORDS** (Oracle REST Data Services), gratuito, scaricabile da
  https://www.oracle.com/database/technologies/appdev/rest.html — se non è già installato
  seguire la guida "Quick Start" ufficiale (richiede solo Java, incluso di norma).

## 1. Schema applicativo

Connesso come utente amministrativo (es. SYSTEM o SYS), crea un utente/schema dedicato
all'app, ad esempio `TAOTL_APP`:

```sql
CREATE USER taotl_app IDENTIFIED BY "una-password-robusta";
GRANT CONNECT, RESOURCE, CREATE VIEW TO taotl_app;
ALTER USER taotl_app QUOTA UNLIMITED ON users;
GRANT PLSQL_GATEWAY TO taotl_app; -- se richiesto dalla tua versione ORDS (su Autonomous Database questo ruolo non esiste: ignora l'errore)
GRANT EXECUTE ON DBMS_CRYPTO TO taotl_app; -- serve all'hashing rinforzato del PIN in 03_identity_package.sql
```

## 2. Tabelle, viste, package, endpoint

Per una nuova installazione, connesso **come `taotl_app`** (non come admin), esegui in
ordine:

```sql
@sql/01_tables.sql
@sql/03_player_soft_delete.sql
@sql/04_identity_and_verified_rooms.sql
@sql/05_profile_and_admin.sql
@sql/07_email_and_password_reset.sql
@sql/02_views.sql
@sql/08_verified_stats_and_legacy_wins.sql
@sql/09_account_display_names_and_repairs.sql
@sql/10_manual_game_scores.sql
@sql/11_tie_break_winner.sql
@ords/03_identity_package.sql
@ords/01_api_package.sql
@ords/02_module.sql
@ords/04_identity_module.sql
```

Prima di eseguire i package, apri il file e **cambia la costante
`c_expected_app_key`** in `ords/01_api_package.sql` con una chiave a tua scelta (una
stringa lunga, casuale): sarà la chiave condivisa che l'app userà per scrivere sul
backend.

Se un blocco fallisce (es. per una differenza di sintassi tra versioni ORDS), risolvilo
lì per lì prima di andare avanti — sono pensati per essere eseguiti uno alla volta.

Su un'installazione già esistente che arriva dalla versione precedente, la migrazione
additiva per percentuale vittorie, vittorie storiche e chiusura delle stanze è:

```sql
@sql/08_verified_stats_and_legacy_wins.sql
@sql/09_account_display_names_and_repairs.sql
@ords/03_identity_package.sql
@ords/01_api_package.sql
@ords/02_module.sql
@ords/04_identity_module.sql
```

Su un'installazione già esistente con `09_account_display_names_and_repairs.sql` già
applicato, la migrazione additiva per punteggi finali sulle partite manuali e per lo
spareggio risolto a mano è:

```sql
@sql/10_manual_game_scores.sql
@sql/11_tie_break_winner.sql
@ords/03_identity_package.sql
@ords/01_api_package.sql
@ords/04_identity_module.sql
```

(`02_module.sql` non serve rieseguirlo qui: non è cambiato — solo i package e il modulo
`04_identity_module.sql`, che ora espone anche `GET /taotl/players/:id/manual-games`.)

## 3. Verifica rapida da riga di comando

Con ORDS in esecuzione (di norma su porta 8080/8443 in locale sulla VPS):

```bash
curl http://localhost:8080/ords/taotl_app/players
curl http://localhost:8080/ords/taotl_app/taotl/games
```

Entrambe dovrebbero rispondere con un JSON (array vuoto `[]` all'inizio, è normale).

## 4. Esporre l'API pubblicamente in HTTPS, gratis

La tua VPS ha già un IP pubblico (a differenza del server-di-casa ipotizzato dalla guida
originale), quindi non serve per forza un tunnel: basta un reverse proxy con HTTPS
automatico davanti a ORDS. Opzione più semplice e gratuita: **Caddy** +
**sslip.io** (un servizio DNS gratuito che risolve `<IP>.sslip.io` al tuo IP, senza
bisogno di comprare un dominio).

1. Installa Caddy sulla VPS (pacchetto ufficiale per la tua distro Linux).
2. Configura `/etc/caddy/Caddyfile`:

   ```
   <tuo-ip-pubblico>.sslip.io {
     reverse_proxy localhost:8080
   }
   ```

3. Riavvia Caddy (`sudo systemctl restart caddy`). Otterrà automaticamente un
   certificato Let's Encrypt e servirà ORDS in HTTPS su quell'indirizzo.
4. Verifica: `https://<tuo-ip-pubblico>.sslip.io/ords/taotl_app/players` dal browser.

Se in futuro comprerai un dominio, puoi sostituire l'hostname sslip.io con un
sottodominio tuo (es. `taotl.tuodominio.it`) puntato via DNS all'IP della VPS: stessa
configurazione Caddy, solo l'hostname cambia.

**Alternativa**: se preferisci non aprire porte pubbliche sulla VPS, **Cloudflare
Tunnel** (gratuito) funziona comunque, ma per un URL stabile nel tempo richiede un
dominio gestito su Cloudflare (anche gratuito da registrare/collegare). Con la VPS,
Caddy+sslip.io resta la via più semplice.

## 5. Collegare l'app

Nel progetto Expo (`Conteggio-app/`), crea un file `.env` (non versionato) con:

```
EXPO_PUBLIC_API_BASE_URL=https://<tuo-ip-pubblico>.sslip.io/ords/taotl_app
EXPO_PUBLIC_APP_KEY=<la-stessa-chiave-messa-in-c_expected_app_key>
```

Riavvia `npx expo start` (le variabili `EXPO_PUBLIC_*` vengono lette al build/dev). Da
questo momento rubrica giocatori (con foto) e storico partite saranno salvati sul
database Oracle invece che solo in locale.

## 6. Backup

Essendo l'unica copia "vera" dei dati (rubrica, storico), pianifica un export periodico,
anche solo con `expdp` schedulato via cron sulla VPS.
