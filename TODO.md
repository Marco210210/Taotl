# Taotl — Cose da fare sulla VPS

Questo file è la checklist operativa per la sessione Claude Code aperta via VS Code
Remote-SSH sulla VPS Oracle Cloud, con questa cartella `Conteggio-app` caricata. Segui le
fasi in ordine: **priorità alla Fase 1-3 (backend + APK Android da testare sul Samsung)**,
la Fase 4 (iOS) va fatta più avanti, non ora.

L'app (frontend Expo, in `app/` e `src/`) è già completa e funzionante — è stata
sviluppata e testata in un'altra sessione (vedi `README.md`). Qui bisogna solo: mettere
online il backend Oracle, e produrre l'APK Android da installare per il primo test reale
con gli amici.

## Fase 1 — Backend Oracle (Database + ORDS)

Dettagli completi, comandi e alternative in [server/README_DEPLOY_VPS.md](server/README_DEPLOY_VPS.md).
Riassunto:

- [ ] Verifica se Oracle Database è già installato sulla VPS; se no, installa **Oracle
      Database Free 23ai** (gratis per sempre, no licenza)
- [ ] Verifica se **ORDS** è già installato/avviato; se no, installalo (richiede solo Java)
- [ ] Crea l'utente/schema applicativo `TAOTL_APP` (comandi in `server/README_DEPLOY_VPS.md` §1)
- [ ] Connesso come `taotl_app`, esegui in ordine:
  - [ ] `server/sql/01_tables.sql`
  - [ ] `server/sql/02_views.sql`
  - [ ] Apri `server/ords/01_api_package.sql` e **cambia la costante `c_expected_app_key`**
        con una chiave a caso, robusta — segnatela, serve dopo
  - [ ] `server/ords/01_api_package.sql`
  - [ ] `server/ords/02_module.sql` (esegui i blocchi uno alla volta se qualcosa fallisce,
        vedi nota in cima al file: non è stato testato contro un'istanza reale)
- [ ] Verifica con curl in locale sulla VPS:
  - [ ] `curl http://localhost:8080/ords/taotl_app/players` → deve rispondere `[]`
  - [ ] `curl http://localhost:8080/ords/taotl_app/taotl/games` → deve rispondere `[]`
- [ ] Apri la porta 443 nella Network Security Group / Security List della VPS
- [ ] Installa **Caddy**, configuralo con il tuo IP pubblico + `sslip.io` (nessun dominio
      da comprare — dettagli in `server/README_DEPLOY_VPS.md` §4), riavvialo
- [ ] Verifica da browser: `https://<tuo-ip-pubblico>.sslip.io/ords/taotl_app/players`
      risponde `[]` in HTTPS

## Fase 2 — Collegare l'app al backend

- [ ] Copia `.env.example` in `.env`
- [ ] Compila `EXPO_PUBLIC_API_BASE_URL` con `https://<tuo-ip-pubblico>.sslip.io/ords/taotl_app`
- [ ] Compila `EXPO_PUBLIC_APP_KEY` con la stessa chiave scelta in Fase 1
- [ ] (facoltativo) `npx expo start` in locale e verifica che aggiungendo un giocatore in
      rubrica compaia in `curl .../ords/taotl_app/players`

## Fase 3 — Build APK Android e test sul Samsung (priorità)

- [ ] Crea un account Expo gratuito se non ne hai già uno: https://expo.dev/signup
- [ ] `npm install` nella cartella `Conteggio-app` (se non già fatto sulla VPS)
- [ ] Login EAS:
  - Se la sessione è interattiva (hai un browser a disposizione): `npx eas login`
  - Se la sessione è "headless" (solo terminale, niente browser): genera un access token
    su https://expo.dev/accounts/[tuo-utente]/settings/access-tokens e imposta
    `export EXPO_TOKEN=il-token-generato` prima dei comandi seguenti
- [ ] `npx eas build:configure` (prima volta soltanto)
- [ ] `npx eas build -p android --profile preview`
- [ ] A build finita, scarica l'APK dal link mostrato in terminale (o dalla dashboard
      expo.dev, sezione Builds)
- [ ] Trasferisci l'APK sul tuo Samsung (es. te lo mandi via email/drive/telegram, oppure
      apri direttamente sul telefono il link/QR code che EAS mostra a fine build)
- [ ] Sul Samsung: quando apri il file APK, il sistema chiederà di abilitare "Installa app
      da questa origine" per l'app che stai usando per aprirlo (Chrome, File, ecc.) —
      confermalo, poi procedi con l'installazione
- [ ] Apri l'app Taotl e segui il piano di test qui sotto

### Piano di test funzionale (sul Samsung)

- [ ] Rubrica: aggiungi almeno 3-4 giocatori, con e senza foto
- [ ] Nuova partita → seleziona 5 giocatori → modalità **Classica** → scegli mazziere →
      "Inizia partita"
- [ ] Turno 1: verifica che le carte distribuite corrispondano alla tabella classica per
      quel numero di giocatori (vedi tabella nel messaggio originale/README)
- [ ] Inserisci le chiamate in ordine; sull'ultimo giocatore (il mazziere) prova a chiamare
      il valore che renderebbe la somma uguale alle carte in mano: deve essere bloccato con
      un messaggio d'errore
- [ ] Schermata punteggio: prova sia "Ha rispettato" che "Non ha rispettato" (con scarto) e
      controlla che i punti calcolati corrispondano (presa×chiamata+rispetto se rispettato,
      −presa×scarto se no)
- [ ] "Vedi classifica": controlla ordinamento e storico turni
- [ ] Verifica che al turno successivo il mazziere sia ruotato correttamente
- [ ] Prova anche una partita in modalità **Personalizzata**: inserisci tu le carte turno
      per turno, verifica che non si possa scendere a 2 se il turno prima non era 3 (e
      stessa cosa per 1 dopo 2), e che non si possa finire prima del turno 6
- [ ] Porta una partita fino alla fine: controlla la classifica finale e il messaggio di
      sincronizzazione ("Salvata online" se il backend è raggiungibile, altrimenti "Salvata
      solo su questo telefono")
- [ ] Chiudi del tutto l'app a metà partita e riaprila: deve proporre "Riprendi partita"
      esattamente dal punto in cui l'avevi lasciata
- [ ] Controlla "Rubrica giocatori" e "Storico partite" dalla home

Se qualcosa non torna rispetto a queste attese, segnalalo com'è andata (schermata,
passaggi) così si corregge.

## Fase 4 — Test su iOS via Expo Go (più avanti, non ora)

- [ ] Assicurati che i tuoi amici iOS abbiano **Expo Go** installato dall'App Store
- [ ] `npx eas update --branch production`
- [ ] Condividi il link mostrato dal comando
- [ ] Chi lo apre con Expo Go installato vede l'app lanciarsi; le volte successive la
      trova in "Recenti" dentro Expo Go, senza bisogno del link
- [ ] Nessun account sviluppatore Apple richiesto

## Fase 5 — Manutenzione (facoltativa, più avanti)

- [ ] Pianifica un export/backup periodico del database Oracle (es. `expdp` via cron)
- [ ] Se in futuro serve autenticazione vera (oltre alla chiave condivisa), va progettata
      a parte
