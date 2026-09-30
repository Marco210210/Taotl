# Controlli di sicurezza riutilizzabili

Questo documento raccoglie i controlli svolti su Taotl e li trasforma in una
checklist per un'altra applicazione. Le caselle sono volutamente vuote: vanno
compilate da capo per ogni progetto, con data, versione, evidenza e responsabile.
Non è una certificazione di sicurezza né un elenco esaustivo di ogni possibile
vulnerabilità. Una revisione del codice, una prova automatica e una verifica
manuale sono evidenze diverse e devono essere indicate separatamente.

## 1. Perimetro e architettura

- [ ] Inventariare frontend pubblico, amministrazione, API, database, servizi e monitor.
- [ ] Individuare rotte, operazioni privilegiate e passaggi dei dati tra componenti.
- [ ] Distinguere dati pubblici, privati, condivisi e riservati agli amministratori.
- [ ] Definire ruoli e proprietà delle risorse, inclusi i casi senza proprietario.
- [ ] Verificare quali configurazioni, migrazioni e handler siano realmente distribuiti.
- [ ] Preparare account e dati temporanei isolati, con pulizia finale verificabile.

## 2. Separazione dell'amministrazione

- [ ] Esportare e servire il pannello su un frontend e un dominio separati.
- [ ] Escludere schermate e client API amministrativi dal bundle pubblico.
- [ ] Verificare che il frontend pubblico non renda disponibili le pagine admin.
- [ ] Verificare sessione e ruolo sul backend per ogni operazione privilegiata.
- [ ] Non considerare attendibile un ruolo conservato nello stato locale del client.
- [ ] Verificare accesso consentito all'admin e negato agli account ordinari.
- [ ] Non passare credenziali o token nei collegamenti tra app e pannello.
- [ ] Verificare HTTPS, proxy, esposizione delle porte e intestazioni del servizio admin.

## 3. Credenziali e file distribuiti

- [ ] Cercare password, chiavi e token nei sorgenti, configurazioni e bundle esportati.
- [ ] Separare variabili pubbliche del client e segreti del server.
- [ ] Escludere file .env privati, wallet, cache e configurazioni locali da Git e bundle.
- [ ] Controllare che il resolver del frontend non includa cartelle server o private.
- [ ] Ruotare le credenziali precedentemente esposte e verificarne la revoca.
- [ ] Considerare anche le credenziali rimaste nella storia Git; ignorare un file non cancella la storia.
- [ ] Conservare credenziali operative e risultati sensibili fuori dal repository.

## 4. Autenticazione e sessioni

- [ ] Esaminare registrazione, login, recupero password, logout e lettura dell'account.
- [ ] Verificare che le operazioni protette richiedano una sessione valida.
- [ ] Usare generatori crittograficamente sicuri per token e codici sensibili.
- [ ] Esaminare scadenza e revoca delle sessioni nei percorsi implementati.
- [ ] Evitare che errori interni del database siano restituiti integralmente al client.
- [ ] Distinguere verifica del codice da prove end-to-end effettivamente eseguite.

## 5. Autorizzazioni e proprietà

- [ ] Verificare lettura e scrittura delle risorse in base all'account e al ruolo.
- [ ] Controllare separatamente accesso a partite, profili, foto, classifiche e stanze.
- [ ] Gestire esplicitamente i valori NULL nei confronti di proprietà.
- [ ] Verificare i permessi sulle risorse referenziate, non soltanto su quella principale.
- [ ] Separare proprietario del profilo, gestore della classifica e super amministratore.
- [ ] Richiedere consenso del destinatario per i collegamenti di profilo.
- [ ] Ricontrollare l'autorizzazione quando una richiesta precedente viene accettata.
- [ ] Verificare i casi legittimi, per evitare che una correzione blocchi gli utenti autorizzati.

## 6. Integrità dei dati e logica applicativa

- [ ] Validare sul server struttura, tipi, limiti e riferimenti dei dati ricevuti.
- [ ] Ricalcolare o verificare i valori derivati, senza fidarsi del risultato del client.
- [ ] Controllare completezza e unicità di partecipanti e risultati.
- [ ] Verificare che le risorse collegate appartengano al contesto autorizzato.
- [ ] Gestire reinvii e sincronizzazioni ripetute senza duplicazioni indesiderate.
- [ ] Usare transazioni e rollback per evitare salvataggi parziali.
- [ ] Verificare il comportamento dei blocchi di riga e degli errori del database.
- [ ] Documentare ciò che il server non può certificare, per esempio eventi avvenuti fuori dall'app.

## 7. Query, rendering e upload

- [ ] Esaminare query e binding, privilegiando parametri rispetto a concatenazioni.
- [ ] Esaminare flussi di login e dati alla ricerca di SQL injection e bypass di autorizzazione.
- [ ] Esaminare rendering del testo e contenuti caricati alla ricerca di XSS.
- [ ] Accettare solo i formati necessari e imporre limiti alla dimensione dei file.
- [ ] Verificare coerenza tra MIME dichiarato e firma del contenuto.
- [ ] Proteggere lettura e modifica dei file con gli stessi permessi della risorsa.
- [ ] Configurare Content-Type, nosniff e le opportune restrizioni sulla risposta.
- [ ] Documentare se il controllo verifica solo la firma o decodifica l'intero file.

## 8. Log, telemetria e notifiche

- [ ] Separare la ricezione di eventi pubblici dalla lettura privilegiata dei log.
- [ ] Trattare la telemetria client come non verificata.
- [ ] Imporre limiti per sorgente e globali agli eventi ricevuti.
- [ ] Deduplicare le notifiche per contenere abusi e invii ripetuti.
- [ ] Evitare segreti nei messaggi e nei risultati pubblicati.
- [ ] Eseguire i test delle notifiche con destinatari simulati.
- [ ] Mantenere i controlli di compatibilità indipendenti dagli errori segnalati dal client.

## 9. Dipendenze e disponibilità

- [ ] Esaminare gli avvisi delle dipendenze dirette e transitive.
- [ ] Distinguere gravità dichiarata, raggiungibilità nel progetto e rischio dimostrato.
- [ ] Applicare aggiornamenti compatibili e documentare le eccezioni rimaste.
- [ ] Verificare i parser con test locali limitati e timeout, senza test di carico pubblici.
- [ ] Verificare installazione riproducibile e coerenza del lockfile.
- [ ] Controllare compatibilità tra SDK, runtime e dipendenze native.
- [ ] Configurare preavvisi sugli aggiornamenti; non confonderli con migrazioni automatiche.

## 10. Verifica e distribuzione

- [ ] Eseguire controlli dei tipi e test di regressione pertinenti.
- [ ] Esportare separatamente i bundle pubblici e amministrativi.
- [ ] Ricontrollare l'assenza del codice amministrativo nei bundle pubblici.
- [ ] Verificare i percorsi principali nel browser, inclusi login e navigazione.
- [ ] Indicare separatamente i test su dispositivo fisico effettivamente eseguiti.
- [ ] Preparare backup e ripristino per le modifiche al backend.
- [ ] Controllare versione live, risposte HTTPS e stato dei servizi dopo il rilascio.
- [ ] Verificare pulizia dei dati di test, push Git e controlli CI.
- [ ] Registrare evidenze, limiti e controlli rimasti aperti.

## 11. Strumenti AI: attività distinta

- [ ] Definire perimetro, dati accessibili e limiti di consumo prima di avviarli.
- [ ] Separare gli strumenti di analisi dall'applicazione distribuita.
- [ ] Non includere segreti nello snapshot consegnato allo strumento.
- [ ] Registrare interruzioni e quota consumata; non dichiarare completo un lavoro interrotto.
- [ ] Non trasformare automaticamente ipotesi o risultati parziali in vulnerabilità confermate.

## Evidenze e limiti del lavoro Taotl

La checklist deriva dalle revisioni e dalle prove descritte nei rapporti
[1.0.15](../server/security/REPORT-2026-09-22.md) e
[1.0.16](../server/security/REPORT-2026-09-30.md). Non ogni voce corrisponde a un
pentest dinamico completo: i rapporti distinguono analisi del codice, test
mirati, controlli dei bundle e verifiche di distribuzione.

Sono documentati 13 controlli Oracle della release 1.0.15, 19 test del monitor,
controlli TypeScript, regressione decoder, esportazioni e prove nel browser.
Il trasferimento autorizzato del profilo è stato verificato nella release 1.0.16.
La scansione Strix è incompleta e resta sospesa. Non sono certificati: assenza
assoluta di vulnerabilità, concorrenza esaustiva, infrastruttura completa,
resistenza a carichi ostili o funzionamento su ogni telefono fisico.

## Risultati Taotl, separati dalla checklist

Correzioni documentate: separazione del pannello admin; rimozione e rotazione
chiave pubblica dei log; controlli di proprietà delle partite e dei profili;
validazione dei punteggi e dei riferimenti; controlli sugli upload;
generazione sicura dei token; rollback delle sincronizzazioni; correzione del
decoder URL; limiti e deduplicazione della telemetria; consenso e autorizzazione
per il collegamento dei profili. Restano i limiti e gli avvisi di dipendenza
indicati nei rapporti: questo documento non li dichiara risolti implicitamente.
