# Taotl web

Versione browser della stessa app: schermate in `app/`, componenti e motore in
`src/`. Non è una copia da mantenere separatamente. La build produce HTML,
JavaScript, font e immagini in `web-build/`: in produzione non servono Expo Go,
Metro, EAS o un server Node.

Sito: **https://web-taotl.130.110.16.97.sslip.io/**.

## Comandi

```bash
npm ci
npm run web         # sviluppo web, porta 8090
npm run build:web   # sito statico in web-build/
npm run serve:web   # anteprima su http://127.0.0.1:8096
```

`PORT=8098 npm run serve:web` cambia la porta. In locale puoi usare
`HOST=0.0.0.0` se vuoi aprire l'anteprima da un altro dispositivo della tua rete.
Il tunnel Expo Go continua a usare la porta 8082; `npm start`, `npm run ios` e
`npm run android` restano disponibili. Non occorre riavviare il tunnel per
pubblicare un nuovo sito statico.

La configurazione web è attivata solo da `TAOTL_WEB_BUILD=1`, impostata dallo
script. Gli script web azzerano i flag Expo Go e amministrazione nel proprio
processo. Non cambiano `.env`, configurazione EAS o servizi esistenti.

## Dati e account

La build legge le stesse variabili pubbliche in `.env.example` dell'app mobile.
`EXPO_PUBLIC_API_BASE_URL` deve puntare al backend HTTPS; la nuova origine web
deve essere accettata dal backend per le richieste CORS e i relativi preflight.
Le variabili vengono incorporate alla build: dopo un cambio occorre ricostruire.

Account, classifiche e partite sincronizzate usano lo stesso backend. I dati
locali di Expo Go **non vengono trasferiti automaticamente al browser**.
Partite ospite, partita in corso, rubrica locale e impostazioni restano nel
browser utilizzato; cancellare i dati del sito li rimuove. La preparazione di
una partita resiste al refresh della stessa scheda tramite `sessionStorage`.
Le foto vengono conservate come miniature persistenti, anche dopo un refresh.

La sessione web usa il salvataggio browser già previsto dall'app; iOS e Android
continuano a usare SecureStore. Il browser non offre tutte le funzioni native:
vibrazione dipende dal supporto del dispositivo e il ritaglio foto del selettore
nativo non è disponibile nel selettore file web. La prima apertura e la
ricarica della pagina richiedono rete; non è installato un service worker.

## Verifiche ripetibili

```bash
npx playwright install chromium
npm run check
npm run build:web
npm run test:web
TAOTL_WEB_TEST_URL=https://web-taotl.130.110.16.97.sslip.io npm run test:web
TAOTL_EXPO_GO=1 npx expo export --platform ios --platform android --output-dir .local/web-native-check --max-workers 2
```

I test aprono la build di produzione su una porta dedicata (8097), con browser
desktop e mobile. Verificano una partita classica completa con punteggi attesi,
refresh durante preparazione/chiamate/esiti, storico, foto, preferenze e accesso.
Le richieste remote dei test sono bloccate o simulate: non creano utenti,
partite o classifiche nel database reale. Per le prove dell'accesso serve una
build con `EXPO_PUBLIC_API_BASE_URL` impostato, anche a un URL fittizio HTTPS.
La compilazione nativa non sostituisce una prova su telefono fisico.

## Pubblicazione sulla VPS

`web/Caddyfile` definisce soltanto `web-taotl.130.110.16.97.sslip.io`, con HTTPS,
file statici e fallback a `index.html` per collegamenti diretti e refresh delle
pagine. La root è `/srv/taotl-web/current`, un link alla release pubblicata.
Il file viene installato in `/etc/caddy/taotl-web.Caddyfile` e importato dal
Caddyfile principale. Gli altri siti e il tunnel mantengono le proprie route.

Per aggiornare, esegui build e test, copia **solo** `web-build/` in una nuova
directory sotto `/srv/taotl-web/releases/`, quindi sostituisci atomicamente il
link `current`. Non servire mai la cartella del repository. Conserva le release
precedenti per il rollback e gli asset con hash precedenti per le schede già
aperte. Il frontend di amministrazione mantiene la propria build e origine.

Su un altro hosting statico pubblica il contenuto di `web-build/` alla radice
di un dominio e configura il fallback SPA verso `/index.html`. Questa build
non è configurata per una sottocartella come `/Taotl/` su GitHub Pages.

Riferimenti: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/),
[pubblicazione web Expo](https://docs.expo.dev/guides/publishing-websites/).
