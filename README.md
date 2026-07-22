# BookSale Cloudflare

Versione di BookSale collegata a Cloudflare:

- **Cloudflare D1**: database condiviso degli annunci.
- **Cloudflare R2**: archiviazione delle foto caricate dagli utenti.
- **Cloudflare Worker**: API che collega la webapp a D1 e R2.
- **Open Library**: compilazione dei dati tramite ISBN.
- **localStorage**: profilo, preferiti e chiave privata del dispositivo.

## Struttura della cartella

```text
BookSale-Cloudflare/
├── index.html
├── style.css
├── app.js
├── config.js
├── manifest.webmanifest
├── sw.js
├── icon-192.png
├── icon-512.png
├── GUIDA-CLOUDFLARE.md
└── cloudflare-worker/
    ├── package.json
    ├── wrangler.jsonc
    ├── schema.sql
    ├── seed.sql
    └── src/index.js
```

## Prima configurazione

Segui il file `GUIDA-CLOUDFLARE.md` nell'ordine indicato.

## Sicurezza della proprietà degli annunci

BookSale crea sul dispositivo una chiave privata casuale. Il Worker salva soltanto la sua impronta SHA-256. Solo chi possiede la chiave può modificare, segnare come venduto o eliminare gli annunci associati.

Il backup JSON contiene anche la chiave privata. Conservalo in un luogo sicuro: importandolo su un altro telefono potrai continuare a gestire i tuoi annunci.

## Modalità senza cloud

Finché `config.js` contiene l'indirizzo segnaposto, l'app continua a funzionare in modalità dimostrativa locale. Dopo aver inserito l'URL reale del Worker, passa automaticamente alla modalità condivisa.
