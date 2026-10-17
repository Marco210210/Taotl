# Changelog

## 1.0.22 — 2026-10-17

- Barra di sistema, colore del browser e sfondo esterno sincronizzati al tema e alla schermata, su web pubblico e admin.
- Tema applicato prima del caricamento per evitare la fascia chiara all’avvio e durante l’uso offline.

## 1.0.21 — 2026-10-17

- Web app avviabile offline dopo il primo caricamento completo, anche da collegamenti diretti.
- Partite, chiamate, esiti, rubrica, foto e storico locali disponibili dopo riapertura senza rete.
- Ultime classifiche consultate conservate per la sessione corrente; cache rimossa all’uscita o al rifiuto dei permessi.
- Stato offline visibile e disponibilità controllabile nelle impostazioni.
- Aggiornamenti web senza ricaricare automaticamente una partita in corso.

## 1.0.20 — 2026-10-15

- Errori di accesso sempre visibili e riquadri iniziali opachi anche nel tema scuro.
- Scelta esplicita per salvare senza classifica, anche con account e classifica selezionata.
- Dettagli dei turni ordinati per classifica cumulativa al termine di ciascun turno.
- Classica a tre giocatori: 24, 18, 8, 3, 2, 1 carte.
- Nomi lunghi adattati a due righe nelle chiamate e negli esiti, su web e nativo.
- Risolto il ritorno in cima alla lista web dopo aver visitato la classifica durante la partita.

## 1.0.19 — 2026-09-30

- Conferma prima di rimuovere membri o giocatori dalla classifica.
- Vittorie conservate nello storico e ripristinate nella classifica quando si reinserisce lo stesso profilo.
- Doppia conferma per rinominare profili collegati; nome visualizzato dell’account aggiornato nella stessa transazione.
- Nome e foto modificabili soltanto dai gestori di una classifica del giocatore o dal super admin, con controlli server.

## 1.0.18 — 2026-09-30

- Pannello admin compatto con un solo accesso alle classifiche; creazione e partite manuali nella sezione Classifiche.
- Titoli leggibili, percorsi registrati correttamente e navigazione indietro basata sulla provenienza.
- Pannello amministrativo interamente in italiano, indipendente dalla lingua del browser.

## 1.0.17 — 2026-09-30

- Gestione classifiche raggiungibile dal pannello admin; super admin vede tutte le classifiche.
- Ricerca giocatori per nome durante la preparazione e creazione esplicita sotto i risultati.
- Modalità classica con 7 giocatori: primo turno corretto a 10 carte.
- Checklist di sicurezza riutilizzabile con evidenze e limiti separati.

## 1.0.16 — 2026-09-29

- Collegamento al pannello amministratore dal proprio profilo nell'app.
- Pannello su dominio HTTPS separato, accessibile anche dal telefono senza tunnel SSH.
- Schermata amministrativa aperta inizialmente sul login; permessi verificati dalle API.
- Collegamento di un profilo consentito solo con autorizzazione del suo proprietario o di un amministratore, ricontrollata all'accettazione.

## 1.0.15 — 2026-09-22

- Pannello amministrativo in frontend separato, accessibile tramite tunnel SSH.
- Chiave privata del monitor separata dalla telemetria pubblica e ruotata.
- Controlli server su proprietà delle partite, profili, stanze e punteggi.
- Foto limitate a immagini riconosciute e risposte API senza dettagli Oracle.
- Decoder URL corretto contro blocchi su input malformati; patch delle dipendenze XML e glob.
- Test riproducibili di sicurezza e regressione dei salvataggi.
- Allineamento alle patch compatibili Expo SDK 57.0.24.

## 1.0.14 — 2026-09-12

- Aggiornamento a Expo SDK 57 con dipendenze compatibili.
- Pulsanti condivisi con un'unica superficie di tocco su testo, spazio vuoto,
  bordi e freccia; area dei comandi inferiori separata dallo scorrimento.
- Monitor orario delle release Expo, con preavvisi Telegram dalle anteprime,
  avviso distinto al rilascio stabile e promemoria al massimo giornalieri.
- Rilevamento dei manifest Expo obsoleti e degli errori del controllo versioni.
- Correzione del falso allarme ORDS per la risposta della rubrica senza sessione.
- Runtime EAS basato su fingerprint per le future build autonome, per impedire
  aggiornamenti incompatibili con le dipendenze native.
- Versione e data aggiornate nella schermata Impostazioni e nei metadati dell'app.

Verifiche: TypeScript, 21 controlli Expo Doctor, esportazione Android/iOS/web,
84 navigazioni con un solo tocco nel browser e 15 test del monitor. Il test dei
tocchi nel browser non sostituisce la verifica su un dispositivo Android fisico.
