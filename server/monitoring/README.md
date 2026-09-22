# Monitor errori Taotl

Il collector gira sulla VPS esistente e non crea servizi Oracle o risorse cloud.
Riceve gli errori già ripuliti dall'app, li salva nel file locale
`~/.local/state/taotl-monitor/errors.jsonl` e, se configurato, invia un avviso Telegram.

Comandi del bot disponibili soltanto nella chat configurata:

- `/status`: stato Expo Go e Oracle/ORDS, compatibilità SDK e data dell'ultimo controllo riuscito;
- `/ultimi`: ultimi cinque errori;
- `/errore ID`: dettaglio di uno specifico errore.

Il watchdog può riavviare soltanto il servizio Expo Go dopo due controlli falliti.
Non riavvia e non modifica mai Oracle automaticamente.
Per ORDS riconosce la risposta applicativa `401 / Sessione mancante.` della
rubrica protetta come servizio raggiungibile; altri 401 e gli errori Oracle
continuano a essere segnalati. Questo controllo non verifica il login di un account.

## Preavviso compatibilità Expo Go

Il collector controlla all'avvio e ogni ora il manifest pubblico aperto dai
telefoni, la versione Expo effettivamente installata e i dist-tag ufficiali npm
(`latest`, `next`, `beta`, `canary`). Usa le credenziali Telegram già configurate.
Avvisa per:

- un nuovo SDK in anteprima, prima del rilascio stabile;
- un SDK stabile più recente di quello servito ai telefoni;
- un manifest che serve un SDK diverso da quello installato;
- due controlli di compatibilità consecutivi falliti.

Le patch dello stesso SDK non generano un allarme di incompatibilità. Ogni avviso
viene ricordato al massimo una volta al giorno; la deduplicazione sopravvive ai
riavvii in `~/.local/state/taotl-monitor/expo-compatibility.json`. Gli invii Telegram
falliti vengono ritentati al controllo successivo. Non installa dipendenze né
riavvia Metro in risposta a una nuova versione. Il controllo delle release gira
separatamente dal watchdog, così un errore npm non viene scambiato per un guasto
del server Expo. In `/status` e `/health` un controllo fallito risulta sconosciuto,
conservando la data dell'ultima verifica riuscita.

Per attivare modifiche al collector sul server esistente:

```sh
python3 -m unittest discover -s server/monitoring -p 'test_*.py'
systemctl --user restart taotl-error-monitor.service
curl --fail http://127.0.0.1:8091/health
```

Gli avvisi dipendono dalla pubblicazione delle anteprime, dall'accesso a npm e
dalla disponibilità di Telegram; non possono garantire un anticipo preciso o
conoscere la versione di Expo Go installata su ciascun telefono. Il blocco di
compatibilità avviene prima che il codice Taotl sia eseguito: l'app non può
aggiornarsi da quella schermata. Per giocare indipendentemente dagli aggiornamenti
di Expo Go serve installare una build autonoma Taotl (il profilo EAS `preview`
produce un APK Android con codice incorporato).

Per le future build e gli aggiornamenti EAS, `app.json` usa la policy runtime
`fingerprint`: cambiamenti a SDK e dipendenze native producono automaticamente un
runtime diverso e impediscono di recapitare codice incompatibile a una vecchia
build. Serve una nuova build per adottare questa policy; le build esistenti con
runtime `appVersion` non ricevono i nuovi aggiornamenti con fingerprint. Expo Go
continua a usare `TAOTL_EXPO_GO=1`, che esclude le impostazioni EAS. Il controllo
degli aggiornamenti all'avvio e la copia locale sono già i default di Expo Updates;
non viene forzato alcun riavvio durante una partita.

Riferimenti: [Expo SDK 57 Updates](https://docs.expo.dev/versions/v57.0.0/sdk/updates/),
[aggiornamento SDK ed Expo Go](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

Il servizio Expo Go deve restare in modalità watch: non impostare `CI=1`, perché
disabilita il rilevamento delle modifiche e lascia ai telefoni il vecchio bundle
Metro. La configurazione canonica è `taotl-expo-go.service`; per installarla:

```sh
cp server/monitoring/taotl-expo-go.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user restart taotl-expo-go.service
```

Le credenziali Telegram vanno salvate fuori dalla cartella dell'app, nel file
`~/.config/taotl-monitor.env`, così Metro non può includerle nel bundle mobile:

```sh
cp server/monitoring/taotl-monitor.env.example ~/.config/taotl-monitor.env
chmod 600 ~/.config/taotl-monitor.env
systemctl --user restart taotl-error-monitor.service
```

Prima di riavviare, sostituire nel file il token generato da BotFather e l'ID numerico
della chat autorizzata.

## Separazione delle credenziali

`GET /v1/errors` richiede `TAOTL_MONITOR_KEY`, generata casualmente e conservata
solo nel file privato del server. Non è la vecchia chiave pubblica dell'app.
`POST /v1/errors` riceve telemetria non autenticata con limiti per IP e globali;
le notifiche client sono marcate non verificate e limitate globalmente a una ogni
cinque minuti. Gli avvisi di compatibilità SDK e il watchdog restano indipendenti.
Non sovrascrivere il file privato esistente con l'esempio durante gli aggiornamenti.
