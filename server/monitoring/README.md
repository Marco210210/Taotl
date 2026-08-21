# Monitor errori Taotl

Il collector gira sulla VPS esistente e non crea servizi Oracle o risorse cloud.
Riceve gli errori già ripuliti dall'app, li salva nel file locale
`~/.local/state/taotl-monitor/errors.jsonl` e, se configurato, invia un avviso Telegram.

Comandi del bot disponibili soltanto nella chat configurata:

- `/status`: stato Expo Go e Oracle/ORDS;
- `/ultimi`: ultimi cinque errori;
- `/errore ID`: dettaglio di uno specifico errore.

Il watchdog può riavviare soltanto il servizio Expo Go dopo due controlli falliti.
Non riavvia e non modifica mai Oracle automaticamente.

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
