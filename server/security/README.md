# Sicurezza e amministrazione Taotl

Il frontend pubblico non include le schermate e le chiamate amministrative.
Il frontend in `admin/app` viene esportato separatamente e servito solo su
`127.0.0.1:8095`, senza un dominio pubblico. Le API continuano a verificare
sessione, ruolo e proprietà dei dati sul server; la separazione del frontend
non sostituisce questi controlli.

## Accesso al pannello

Se il progetto è aperto in VS Code tramite Remote SSH, non serve un secondo
comando SSH. Aprire la scheda **Porte / Ports** accanto al Terminale, scegliere
**Inoltra una porta / Forward a Port**, inserire `8095`, quindi aprire nel browser
`http://127.0.0.1:8095`. Se la scheda non è visibile, usare `Ctrl+Shift+P` e cercare
**Ports: Focus on Ports View**. La configurazione `.vscode/settings.json` assegna
alla porta il nome “Taotl — pannello amministratore privato” e abilita il ripristino
degli inoltri. La porta locale 8095 deve essere libera.

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

## Strix

Strix è installato fuori dal progetto in `~/.local/share/taotl-security`.
Docker è disponibile e l'immagine `ghcr.io/usestrix/strix-sandbox:1.3.0` è stata
scaricata e avviata con successo su ARM64 (verifica del 29 settembre 2026).
Resta necessario autenticare Strix con un account
modello: `strix auth status` non rileva un accesso. La CLI supporta un login
dedicato con ChatGPT, come documentato da Strix, oppure una chiave API LLM.
Non è necessario acquistare una chiave API se il login in abbonamento supportato
da Strix funziona per il proprio account; la disponibilità del modello va verificata
dopo il login. Non vengono copiate le credenziali dell'estensione Codex.

Nel terminale remoto di VS Code:

```sh
~/.local/bin/strix auth login chatgpt --manual
```

Aprire il link mostrato e completare l'accesso personalmente. Se il browser
termina su una pagina localhost che non carica, copiare l'indirizzo completo
dalla barra e incollarlo **nel terminale che attende**, non nella chat o in Git.
La modalità manuale evita di dover inoltrare anche la porta OAuth 1455.

Dopo l'accesso:

```sh
~/.local/bin/strix auth status
bash server/security/run_strix.sh
```

Il launcher usa una copia dei soli file committati, fuori dalla cartella live,
senza `.env`, wallet o storia Git. I test sono limitati allo snapshot e ai servizi
locali creati nella sandbox. Il container ha limiti di CPU e memoria; risultati in
`~/.local/share/taotl-security/runs`. Per usare un provider API configurare
`STRIX_LLM` e `LLM_API_KEY` nel proprio ambiente privato prima dell'avvio.

Finché l'accesso non viene completato, non è stata eseguita una scansione Strix:
i risultati del rapporto 1.0.15 provengono dai test mirati e dall'analisi del codice.
Riferimento: https://github.com/usestrix/strix#sign-in-with-a-chatgpt-subscription
