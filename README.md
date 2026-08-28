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

## Distribuzione agli amici

La pagina pubblica [Taotl](https://marco210210.github.io/Taotl/) contiene i collegamenti
per installare Expo Go e aprire la versione live dell'app su Android, iPhone e iPad.
La stessa pagina ospita anche l'informativa privacy e i termini di servizio.

Il bundle live viene servito dal tunnel Expo Go gestito sulla VPS. Quando viene
pubblicato un nuovo APK Android autonomo, può essere allegato a una release GitHub e
collegato dalla stessa pagina senza modificare l'indirizzo condiviso con gli utenti.

## Verifiche eseguite in sviluppo

- Motore di gioco: script di verifica con gli esempi reali forniti (tabella classica,
  distribuzione "completa"/"breve", sequenza personalizzata 14-12-10-8-6-4-3-2-1 con 5
  giocatori, vincolo di chiamata del mazziere, rotazione mazziere).
- Percorso completo nell'app (Expo web): selezione giocatori → modalità classica →
  scelta mazziere → chiamate turno 1 → blocco della chiamata vietata per il mazziere →
  punteggio turno (verificato contro i calcoli attesi) → turno 2 con mazziere e ordine di
  chiamata ruotati correttamente → classifica live.
- Il backend Oracle/ORDS e il tunnel Expo Go vengono distribuiti separatamente usando
  le configurazioni descritte nella cartella `server/`.
