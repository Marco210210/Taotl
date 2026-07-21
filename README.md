# Taotl — Conteggio punti

App per contare i punti del gioco di carte Taotl al tavolo con gli amici, senza blocco
note. Frontend Expo/React Native (iOS + Android da un'unica codebase), backend Oracle
Database + ORDS.

## Struttura del progetto

```
app/            Schermate (Expo Router)
src/game/       Motore di gioco puro (modalità, punteggi, regole) — nessuna dipendenza da React
src/state/      Stato della partita in corso (Context + reducer) e rubrica giocatori
src/api/        Client verso il backend ORDS, con fallback locale se non raggiungibile
src/components/ Componenti UI riusabili
server/         Script SQL/ORDS e guida di deploy sulla VPS (vedi server/README_DEPLOY_VPS.md)
```

Le regole del gioco (modalità classica/completa/breve/personalizzata, punteggi, vincolo
del mazziere, rotazione) sono documentate nei commenti di `src/game/` e verificate con
gli esempi reali di partita forniti durante lo sviluppo.

## Sviluppo locale

```bash
npm install
npx expo start
```

Scansiona il QR code con l'app **Expo Go** (iOS/Android) per vedere l'app in tempo reale
mentre modifichi il codice. Senza backend configurato, l'app funziona comunque:
rubrica giocatori e storico partite restano salvati solo sul telefono (AsyncStorage)
finché non colleghi il backend Oracle (vedi sotto).

## Collegare il backend Oracle

1. Segui `server/README_DEPLOY_VPS.md` per creare le tabelle su Oracle ed esporre ORDS
   pubblicamente in HTTPS (gratis, via VPS Oracle Cloud Always Free).
2. Copia `.env.example` in `.env` e valorizza `EXPO_PUBLIC_API_BASE_URL` e
   `EXPO_PUBLIC_APP_KEY` con l'URL pubblico e la chiave scelti in fase di deploy.
3. Riavvia `npx expo start`.

## Distribuzione agli amici (gratis)

### Android — file APK installabile

```bash
npx eas login          # richiede un account Expo gratuito
eas build:configure
eas build -p android --profile preview
```

A fine build, Expo fornisce un link per scaricare l'APK: condividilo con i tuoi amici
Android, lo installano e lo trovano come app vera in home screen.

### iOS — via Expo Go (nessun account sviluppatore Apple richiesto)

```bash
eas update --branch production
```

Manda ai tuoi amici iOS il link al progetto pubblicato (mostrato dal comando). Aprendolo
la prima volta con **Expo Go** installato, lancia l'app; dalle volte successive la
trovano nella lista "Recenti" di Expo Go senza bisogno del link.

Ogni volta che modifichi l'interfaccia o la logica (non le dipendenze native), un nuovo
`eas update` aggiorna l'app per tutti — sia su Android (nel file APK) sia su iOS (via
Expo Go) — senza bisogno di ridistribuire nulla.

## Verifiche eseguite in sviluppo

- Motore di gioco: script di verifica con gli esempi reali forniti (tabella classica,
  distribuzione "completa"/"breve", sequenza personalizzata 14-12-10-8-6-4-3-2-1 con 5
  giocatori, vincolo di chiamata del mazziere, rotazione mazziere).
- Percorso completo nell'app (Expo web): selezione giocatori → modalità classica →
  scelta mazziere → chiamate turno 1 → blocco della chiamata vietata per il mazziere →
  punteggio turno (verificato contro i calcoli attesi) → turno 2 con mazziere e ordine di
  chiamata ruotati correttamente → classifica live.
- Non ancora testati end-to-end con backend reale: sincronizzazione partite/rubrica su
  Oracle (gli script `server/` sono pronti ma da eseguire e verificare sulla VPS), build
  EAS per Android/iOS (richiedono il tuo account Expo).
