# Changelog

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
