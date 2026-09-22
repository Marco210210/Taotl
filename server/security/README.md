# Sicurezza e amministrazione Taotl

Il frontend pubblico non include le schermate e le chiamate amministrative.
Il frontend in `admin/app` viene esportato separatamente e servito solo su
`127.0.0.1:8095`, senza un dominio pubblico. Le API continuano a verificare
sessione, ruolo e proprietà dei dati sul server; la separazione del frontend
non sostituisce questi controlli.

## Accesso al pannello

Dal proprio computer, con la chiave SSH già autorizzata sulla VPS:

```sh
ssh -N -L 8095:127.0.0.1:8095 ubuntu@130.110.16.97
```

Aprire `http://127.0.0.1:8095` e accedere con il proprio account Taotl amministratore.
La modifica di `isAdmin` nella cache del browser non concede accesso.

## Pubblicazione

Esportare in una directory nuova prima di cambiare il collegamento `current`:

```sh
TAOTL_ADMIN_BUILD=1 npx expo export --platform web --output-dir /home/ubuntu/.local/share/taotl-admin/release-1.0.15-final
ln -sfn /home/ubuntu/.local/share/taotl-admin/release-1.0.15-final /home/ubuntu/.local/share/taotl-admin/current
cp server/security/taotl-admin.service /home/ubuntu/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now taotl-admin.service
systemctl --user restart taotl-admin.service
```

Il server risolve la directory all'avvio: riavviarlo dopo aver cambiato il link.
Per il client Expo Go pubblico riavviare `taotl-expo-go.service` dopo la pubblicazione.
Il bundle admin non deve essere caricato su EAS, GitHub Pages o un server pubblico.

Per Oracle, compilare i package aggiornati `01_api_package.sql` e
`03_identity_package.sql`, quindi applicare `06_security_handlers.sql` dopo i
moduli ORDS. Quest'ultimo modifica soltanto gli handler indicati e non ricrea i moduli.
Conservare una copia dei package precedenti fuori da Git prima del deploy.

## Verifiche ripetibili

```sh
npm ci --ignore-scripts
npx tsc --noEmit
node server/security/test_decoder.cjs
python3 -m unittest discover -s server/monitoring -p 'test_*.py'
TAOTL_EXPO_GO=1 npx expo export --platform all --output-dir .local/security/public-export
```

Il test di integrazione Oracle richiede `oracledb`, il wallet e le credenziali
private già configurate in `~/.config/taotl/credentials.env` e
`~/.config/taotl-mail.env`. Crea account, sessioni, foto, stanze e partite con ID
casuali dedicati ai test e li elimina nel blocco `finally`. Non usare account reali.
Eseguirlo esplicitamente contro lo schema che si intende verificare:

```sh
python3 server/security/probe_logic.py --run
```

La dipendenza locale `vendor/decode-uri-component` conserva la licenza e la
provenienza upstream della correzione 0.5.0, con compatibilità CommonJS per
Expo Router 57. Il test riproduce il precedente blocco su una query malformata
in un processo separato con timeout.

Strix è installato fuori dal progetto in `~/.local/share/taotl-security`.
La scansione non è stata eseguita: mancano Docker e una chiave API LLM dedicata.
Non sono state riutilizzate credenziali di Codex. I risultati del rapporto
provengono dai test mirati e dall'analisi del codice, non da Strix.
