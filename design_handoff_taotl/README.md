# Handoff: Taotl — app segnapunti

## Overview
Taotl è un segnapunti da telefono per un gioco di carte fisico a chiamate (2–12 giocatori).
L'app sostituisce il foglio di carta: si scelgono i giocatori, l'ordine, il mazziere e la modalità,
poi a ogni turno si inseriscono le chiamate e si registra chi le ha rispettate. L'app calcola i punti
e aggiorna la classifica. Prima versione: 100% locale, nessun account.

## About the Design Files
I file di questo pacchetto sono **riferimenti di design realizzati in HTML** — prototipi che mostrano
aspetto e comportamento previsti, NON codice di produzione da copiare.
Il lavoro consiste nel **ricreare questi design nell'ambiente del codebase di destinazione**
(React Native, Flutter, SwiftUI, Kotlin, web…) usando i suoi pattern e le sue librerie.
Se il codebase non esiste ancora, scegliere il framework più adatto (per Taotl: React Native o Flutter,
perché serve iOS + Android + tablet + browser) e implementare lì.

## Fidelity
**High-fidelity.** Colori, tipografia, spaziature, gerarchie e interazioni sono definitivi.
La logica di punteggio nel prototipo è quella corretta e va replicata 1:1.

## Screens / Views

Device di riferimento: 402 × 874 px (iPhone 16 Pro). Tutto il layout è a colonna singola,
contenuto scrollabile, CTA primaria **sticky in fondo** (uso a una mano).

Header comune (tutte le schermate tranne Home e Finale):
- padding 58px 18px 13px (58px = safe area status bar), fondo #F8F8F5, bordo inferiore 1px rgba(23,24,29,.08)
- pulsante back 36×36, radius 11, fondo rgba(23,24,29,.06), glifo "‹" 22px
- titolo Manrope 700 15px; sottotitolo Manrope 500 11px rgba(23,24,29,.5)

### 1. Home
- Hero: fondo #17784B, padding 70px 22px 26px, testo #F8F8F5.
  Logo: tile 52×52 radius 14 #F8F8F5 con la maschera (assets/suit-mask.svg, h 34px);
  wordmark "TAOTL" Instrument Serif 400 34px letter-spacing .14em; sotto "SEGNAPUNTI" Manrope 600 10px ls .22em opacity .72.
- Card "Partita in corso" (solo se esiste): #fff, 1px rgba(23,24,29,.12), radius 14, padding 16px.
  Etichetta "PARTITA IN CORSO" Manrope 700 10px ls .15em #CF3545; a destra "Turno n/tot".
  Riga: nome leader 700 15px + punti 800 22px tabular-nums. Barra progresso h 5px radius 99, track rgba(23,24,29,.08), fill #17784B.
- CTA "Nuova partita": #CF3545, radius 14, padding 20px 18px, titolo 800 18px, sub 500 12px opacity .8, freccia "→" 26px.
- Griglia 2×2 di tile (#fff, 1px rgba(23,24,29,.12), radius 14, min-height 104, padding 15, gap 12):
  Storico partite / Profili e statistiche / Regole e punteggi / Impostazioni. Ogni tile ha un seme in alto (24px) e titolo 700 13.5px su due righe.

### 2. Giocatori (roster + selezione)
- Riga di input: testo "Aggiungi un giocatore", radius 12, padding 14px, 1px rgba(23,24,29,.14), font 600 14px; bottone + 52px radius 12 #17181D.
- Righe giocatore: #fff, radius 13, padding 12px 14px, bordo 1.5px — #17784B se selezionato, altrimenti rgba(23,24,29,.10).
  Avatar 38px cerchio con iniziali (800 13px, testo #F8F8F5) colorato dalla palette giocatori.
  Nome 700 14.5px; meta 500 11px rgba(23,24,29,.48) = "posizione N" se selezionato, altrimenti "N partite giocate".
  A destra pastiglia 24px: #17784B con "✓" se selezionato, altrimenti rgba(23,24,29,.12).
- CTA sticky: "Ordine e mazziere · N"; disabilitata (rgba(23,24,29,.25)) con testo "Servono almeno 2 giocatori" se selezionati < 2. Massimo 12.

### 3. Ordine e mazziere
- Nota esplicativa 500 12px rgba(23,24,29,.55).
- Righe: numero posizione (800 13px rgba(23,24,29,.35)), avatar 34px, nome 700 14px,
  pastiglia "MAZZIERE" (700 10px ls .08em) — attiva #E5C51C su testo #17181D, inattiva rgba(23,24,29,.06) su rgba(23,24,29,.4),
  frecce ▲▼ 30×20 radius 6 per riordinare.
- CTA sticky #17181D: "Scegli la modalità".

### 4. Modalità
- 4 card selezionabili (bordo 1.5px #CF3545 se attiva): nome 800 15.5px, numero turni 700 11px,
  descrizione 500 12.5px, e la sequenza dei turni come chip 26px radius 7 fondo rgba(23,24,29,.06) 700 11px.
  - Classica: 1,2,3,4,5,6
  - Completa: da floor(carteMazzo / nGiocatori) fino a 1
  - Breve: 6,5,4,3,2,1
  - Personalizzata: da un massimo scelto (min 6, max 20) fino a 1
- Se "Personalizzata": pannello #17181D con stepper (40px radius 12) per il primo turno.
- CTA sticky #CF3545: "Inizia la partita".

### 5. Chiamate  ← schermata chiave
- Tre stat card in alto (#fff, radius 12, padding 11px 13px): CARTE A TESTA / VALE UNA PRESA (5N) / BONUS (10N).
  Label 700 9.5px ls .12em rgba(23,24,29,.45), valore 800 20px tabular-nums.
- Riga giocatore: #fff radius 14 padding 12px 13px; avatar 36px; nome 700 14.5px;
  nota 600 10.5px — per il mazziere "mazziere · non può chiamare X" in #B85C2B, per gli altri
  "N prese = P punti" in rgba(23,24,29,.45) (opzione "punti attesi in tempo reale").
  Stepper: due tasti 44×44 radius 13 fondo rgba(23,24,29,.06), glifi − / + 24px; il tasto si spegne
  (colore rgba(23,24,29,.25)) al limite 0 / carte. Valore 800 24px tabular-nums, min-width 30px.
  Per il mazziere lo stepper SALTA il valore vietato (non lo mostra mai).
- Footer sticky: "Somma delle chiamate" 600 12px + "S / N carte" 800 14px (verde #17784B se valida, rossa #CF3545 se somma == carte);
  CTA "Registra gli esiti" #17181D, disabilitata con testo "La somma non può fare N".

### 6. Esiti del turno
- Card per giocatore: avatar 34px, nome 700 14.5px, "ha chiamato N prese" 600 11px,
  punti calcolati a destra 800 19px (#17784B se ≥ 0, #CF3545 se negativi, rgba(23,24,29,.25) se non ancora scelto → "—").
- Due bottoni pieni gap 8: "Rispettata" (attivo #17784B testo #F8F8F5) e "Sbagliata" (attivo #CF3545), inattivi rgba(23,24,29,.06) su rgba(23,24,29,.55), radius 11, padding 13px, 700 13px.
- Se "Sbagliata": riga "Prese di scarto" con stepper 40px (fondo rgba(207,53,69,.10), glifi #CF3545), valore 1..carte.
- CTA sticky "Chiudi il turno" #17784B; se manca un esito → "Segna tutti gli esiti" disabilitata.

### 7. Classifica (durante la partita)
- Righe ordinate per punti: posizione (800 15px; il primo #A88A12), avatar, nome 700 14.5px,
  delta ultimo turno 600 11px (verde/rosso), totale 800 24px tabular-nums.
  Il primo ha fondo #FBF6DC, gli altri #fff.
- Blocco "TURNO PER TURNO" (#fff radius 14): per ogni turno, dal più recente,
  titolo "Turno N" 800 12px + meta "N carte · presa 5N · bonus 10N" 600 10.5px,
  poi chip per giocatore (nome 700 10.5px + punti 800 11.5px) su fondo rgba(23,120,75,.10) o rgba(207,53,69,.10).
- CTA sticky #17784B: "Turno N · X carte", oppure "Vedi il risultato finale" all'ultimo turno.

### 8. Risultato finale
- Fondo pieno #17181D. Sigillo logo 46px radius 13 #17784B con maschera.
  "PARTITA CHIUSA" 700 10px ls .22em #E5C51C; nome vincitore Instrument Serif 400 40px;
  riga riassuntiva 600 13px opacity .6.
- Classifica su righe rgba(248,248,245,.06) radius 13 (posizione del primo in #E5C51C).
- CTA: "Rivedi i turni" (fondo rgba(248,248,245,.10)) e "Salva e torna alla home" (#E5C51C su #17181D).

### 9. Storico partite
Card #fff radius 14: data 700 10px ls .13em, meta a destra, maschera 26px, vincitore 800 15px,
elenco altri giocatori 500 11.5px, punti 800 19px.

### 10. Profili e statistiche
Card per giocatore: avatar 36px + nome 800 15px + "N partite" 600 11px;
tre riquadri rgba(23,24,29,.04) radius 10: CHIAMATE OK (%), PUNTI / TURNO, MIGLIOR TURNO (valore 800 18px, label 600 9.5px ls .08em).

### 11. Regole e punteggi
Blocco verde #17784B con la formula in Instrument Serif 22px:
"chiamata × 5N + 10N se rispetti" / "− 5N × scarto se sbagli" (#E5C51C) + nota 500 12px.
Poi due card bianche: vincolo del mazziere, modalità. In fondo la riga dei 5 semi (30px).

### 12. Impostazioni
- "Carte nel mazzo" con stepper (20–120, default 55) — serve alla modalità Completa.
- Tre toggle (track 50×30 radius 99, knob 24px bianco; ON = #17784B, OFF = rgba(23,24,29,.18)):
  blocca la chiamata vietata, punti attesi in tempo reale, vibrazione sugli stepper.
- Nota: account, sync e password amministratore arrivano con la versione online.

## Interactions & Behavior
- Navigazione a stack: ogni "go" impila la schermata corrente, il back la ripristina. Home e Finale non hanno header.
- Flusso partita: Home → Giocatori → Ordine/Mazziere → Modalità → (per ogni turno) Chiamate → Esiti → Classifica → … → Finale → Home (partita salvata nello storico).
- A ogni nuovo turno il mazziere ruota di una posizione: dealer = (dealer + 1) % nGiocatori.
- Chiamate: valore per giocatore 0..carteDelTurno. Al mazziere è vietato il valore
  `vietato = carteDelTurno − sommaChiamateAltri`: lo stepper lo salta in entrambe le direzioni (se l'impostazione è attiva).
- La CTA "Registra gli esiti" è bloccata se `somma === carteDelTurno`.
- Esiti: ogni giocatore deve avere ok = true|false; se false, scarto 1..carteDelTurno (default 1). CTA bloccata finché mancano esiti.
- Nessuna animazione complessa: transizioni schermata standard della piattaforma, feedback tocco sugli stepper (vibrazione opzionale).
- Tutti i target tocco ≥ 44px; comandi principali nella metà bassa dello schermo.

## State Management
```
roster: [{ id, name, games, ok, turns, best }]      // anagrafica giocatori
sel: [id]                                           // giocatori in partita, IN ORDINE (2..12)
dealer: int                                         // indice in sel
mode: 'classica' | 'completa' | 'breve' | 'custom'
customTop: int (6..20)
deck: int (20..120, default 55)
rIdx: int                                           // indice turno corrente
calls:   { [playerId]: int }
results: { [playerId]: { ok: bool, miss: int } }
log: [ { n, cards, rows: [{ id, name, call, ok, miss, pts }] } ]
started: bool
games: [ { date, meta, winner, players, pts } ]     // storico
settings: lockDealer, livePts, haptics
```

Funzioni pure da replicare:
```js
rounds()  // classica [1..6] · breve [6..1] · completa [floor(deck/n)..1] · custom [customTop..1]
cards()   // rounds()[rIdx]
score(n, call, ok, miss) => ok ? call * 5 * n + 10 * n : -(5 * n * miss)
// n = NUMERO DEL TURNO (1-based), non il numero di carte
totals()  // somma dei pts nel log, per giocatore
```
Persistenza: tutto locale (localStorage / AsyncStorage / Core Data). Ripresa della partita in corso dalla Home.

## Dark theme
Tema scuro definito (schermate di riferimento nel prototipo, sezione "TURNO 2"). Non è un'inversione:
- Fondo app **#16171B** · superfici rgba(244,241,232,.06) · bordi rgba(244,241,232,.10) · testo **#F4F1E8** · testo secondario rgba(244,241,232,.45–.5) · disabilitato rgba(244,241,232,.25)
- Rosso **#E8515F** (schiarito) · verde **#2E9E68** · verde hero **#125C3B** · giallo **#E5C51C** invariato
- Avatar: #E8515F, #2E9E68, #D98249, #54A3B5, #F4F1E8, #E5C51C — testo dell'iniziale in #16171B
- Riga in testa alla classifica: fondo rgba(229,197,28,.14) + bordo rgba(229,197,28,.35), numero posizione #E5C51C
- Chip punti: positivo rgba(46,158,104,.16), negativo rgba(232,81,95,.16)
- CTA primaria su scuro: **#F4F1E8 con testo #16171B**; CTA di avanzamento turno #2E9E68 su #0E1A13
- Riga mazziere: fondo rgba(229,197,28,.12) + bordo 1.5px rgba(229,197,28,.55), nota in #E5C51C
Selezione automatica dal tema di sistema, con override manuale nelle impostazioni.

## Design Tokens
Colori (ricavati dal mazzo fisico):
- Rosso #CF3545 · Verde #17784B · Giallo #E5C51C · Inchiostro #17181D · Carta #F8F8F5 · Bianco #FFFFFF
- Evidenza primo posto #FBF6DC · oro testo #A88A12 · terracotta (avatar/mazziere) #B85C2B · teal (avatar) #2E6E7E
- Bordi rgba(23,24,29,.10) e .12 · fondi tenui rgba(23,24,29,.04) / .06 · testo secondario rgba(23,24,29,.5) · disabilitato rgba(23,24,29,.25)
- Positivo rgba(23,120,75,.10) · negativo rgba(207,53,69,.10)

Palette avatar (in ordine di creazione giocatore): #CF3545, #17784B, #B85C2B, #2E6E7E, #17181D, #A88A12.

Tipografia:
- UI: **Manrope** 400/500/600/700/800. Scala usata: 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 13.5 · 14 · 14.5 · 15 · 15.5 · 16 · 18 · 19 · 20 · 22 · 24 · 30px
- Display / logo / formule: **Instrument Serif** 400 — 19 · 22 · 26 · 30 · 34 · 40px
- Tutti i numeri di punteggio: font-variant-numeric: tabular-nums
- Maiuscoletti di etichetta: 700, 9.5–10.5px, letter-spacing .12–.22em

Spaziature: 2 · 3 · 6 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 16 · 18 · 20 · 22 · 26px. Gap liste 8–10px.
Radius: 6 · 7 · 8 · 9 · 10 · 11 · 12 · 13 · 14 · 22 · 30 · 50% · 99px (pastiglie).
Ombre: nessuna nell'app (solo il frame del device nel prototipo). Le superfici si separano con bordi 1px.

## Assets
- `assets/suit-heart.svg`, `suit-diamond.svg`, `suit-club.svg`, `suit-spear.svg`, `suit-mask.svg`
  I cinque semi, file definitivi forniti dal cliente. Proporzioni originali da NON alterare:
  heart 872×1628 · diamond 820×1343 · club 1113×1579 · spear 510×1491 · mask 785×1059.
  Colori nel file: #CF3545 (heart, diamond), #17181D (club, spear), #E5C51C + #17181D (mask).
  Nelle file di più semi le altezze vanno compensate opticamente perché pesino uguale
  (rapporti usati, su base 30px: heart 31 · diamond 29 · club 27 · spear 38 · mask 26).
  Su fondo scuro i semi si usano nel loro colore originale, tranne la maschera dentro il sigillo del logo.
- `assets/cards/card-01…28.svg` — tutte le carte del mazzo vettorizzate (844×1440, angoli arrotondati r42).
  card-28 è il retro (verde #17784B). Utili per home, illustrazioni e futuro gioco online.
- Logo scelto: sigillo verde #17784B radius ~23% con la maschera (`suit-mask.svg`) + wordmark "TAOTL"
  Instrument Serif letter-spacing .14em e sottotitolo "SEGNAPUNTI" Manrope 600 ls .28em.
  Da produrre in PNG 1024 per gli store; nell'app icona 52px radius 14.

## Files
- `Taotl.dc.html` — prototipo interattivo completo (tutte le schermate, logica di punteggio reale) + contesto di design e logo.
  Si apre in un browser. La logica è nella classe `Component` in fondo al file; il markup è nel template.
- `ios-frame.jsx` — solo il finto telefono usato per la presentazione, NON fa parte dell'app.
- `assets/` — semi e carte vettoriali.

## Note
- Da confermare con il cliente: sequenza esatta della modalità Classica (assunta 1→6), numero reale di carte del mazzo
  (assunto 55, configurabile), e il fatto che chi sbaglia non prenda il bonus.
- Roadmap dichiarata: account con login, password amministratore per le eliminazioni, statistiche estese,
  classifiche generali, tornei, tutorial delle regole, partite online e sincronizzazione multi-dispositivo.
  Conviene isolare da subito la logica di punteggio e il repository dei dati dal layer UI.
