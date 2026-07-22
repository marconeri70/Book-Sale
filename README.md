# BookSale

Prima versione funzionante della webapp per vendere, comprare e scambiare libri.

## Funzioni incluse
- Home con categorie e ultimi annunci
- Ricerca per titolo, autore, ISBN e località
- Filtri per categoria, condizione e prezzo
- Pubblicazione e modifica annunci
- Recupero dati libro da ISBN tramite Open Library
- Foto dalla fotocamera o galleria
- Scanner barcode ISBN sui dispositivi compatibili
- Preferiti
- Gestione annunci e stato venduto
- Profilo e contatti
- Ricerca degli annunci entro 50 km
- Backup e ripristino JSON
- Installazione PWA e cache offline dell'interfaccia

## Avvio in locale
Il modo più semplice è usare un piccolo server HTTP:

```bash
python -m http.server 8000
```

Poi aprire `http://localhost:8000`.

## Pubblicazione su GitHub Pages
1. Crea un repository, ad esempio `booksale`.
2. Carica tutti i file presenti in questa cartella nella radice del repository.
3. Apri **Settings → Pages**.
4. In **Build and deployment**, scegli **Deploy from a branch**.
5. Seleziona il branch `main` e la cartella `/root`.
6. Salva e attendi la pubblicazione.

## Nota importante
Questa versione usa `localStorage`: annunci e profilo rimangono soltanto sul dispositivo. Per rendere gli annunci visibili a tutti gli utenti servirà collegare un database cloud e un sistema di autenticazione.
