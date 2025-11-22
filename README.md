# Discord AI Image Assistant

Bot Discord per generare ed editare immagini tramite OpenAI (`gpt-image-1`), pensato come assistente generale per server/community.

## Requisiti

- Node.js **>= 18**
- Un bot Discord registrato nel Developer Portal
- Un progetto OpenAI con API key abilitata alle immagini

## Setup

1. Clona o scarica questo progetto.

2. Installa le dipendenze:

   ```bash
   npm install
   ```

3. Copia il file `.env.example` in `.env` e compila i valori:

   ```bash
   cp .env.example .env
   ```

   Dentro `.env` imposta:

   ```env
   OPENAI_API_KEY=LA_TUA_API_KEY_OPENAI
   DISCORD_TOKEN=IL_TUO_BOT_TOKEN_DISCORD
   AI_BOT_LOG_CHANNEL_ID=ID_DEL_CANALE_LOG_OPZIONALE
   ```

   > **Attenzione:** il valore `DISCORD_TOKEN` deve essere il **vero token del bot** dal Developer Portal,
   > **non** la URL di invito OAuth2.

4. Avvia il bot in locale:

   ```bash
   npm start
   ```

   Al primo avvio, il bot registrerà automaticamente i comandi slash globali `/prompt` e `/edit`.

## Comandi principali

### `/prompt`

Genera una nuova immagine.

- `prompt` (stringa, obbligatorio): descrizione dell'immagine desiderata.
- `image` (attachment, opzionale): immagine di partenza da trasformare.

Se viene fornito solo il testo, il bot genera un'immagine da zero.
Se viene fornita anche un'immagine, il bot la usa come base per un edit/variation.

Ogni immagine generata viene salvata su disco e registrata in SQLite, tenendo per ogni utente solo le **ultime 10** generazioni.

### `/edit`

Modifica una delle ultime immagini generata dallo stesso utente.

Due modalità:

1. **Diretta**, con parametri:
   - `slot` (intero opzionale): indice dell'immagine (1 = più recente).
   - `prompt` (stringa opzionale): nuovo prompt di modifica.

   Se passi **sia** `slot` che `prompt`, il bot modifica direttamente quell'immagine.

2. **Interattiva**, senza parametri:  
   il bot mostra un menu selezionabile con le ultime 10 immagini generate dall'utente; dopo la scelta apre un modal per inserire il nuovo prompt di edit.

Anche le immagini modificate vengono salvate e aggiunte alla cronologia dell'utente (sempre max 10 voci).

## Limiti e budget

Il bot implementa:

- limite per utente: **5 immagini/giorno** (configurabile via env `MAX_DAILY_IMAGES_PER_USER`);
- stima del costo mensile: assume **0,04 USD** per immagine 1024×1024 standard e confronta con `MAX_MONTHLY_COST_USD` (default 20).

Se l'utente supera il limite giornaliero o il budget stimato, il bot risponde con un messaggio chiaro e non invia la richiesta a OpenAI.

## Storage

- Database: `data/bot.db` (SQLite, tramite `better-sqlite3`).
- Immagini: salvate in `data/images/` come PNG.
- Ogni record memorizza:
  - `user_id`
  - `prompt`
  - `created_at`
  - `image_path`
  - `source_type` (`base` o `edit`)
  - `parent_generation_id` (se derivata da un'altra immagine)

## Deploy

Puoi eseguire questo progetto su qualsiasi hosting che supporti Node.js 24/7 (Pella, VPS, ecc.):

- imposta le stesse variabili d'ambiente (`OPENAI_API_KEY`, `DISCORD_TOKEN`, ecc.);
- esegui `npm install` e poi `npm start` (o configura lo script di avvio secondo la piattaforma).

I comandi slash verranno gestiti automaticamente dal codice all'avvio del bot.
