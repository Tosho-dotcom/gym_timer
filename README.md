# Gym Timer

Jednostavna web aplikacija (PWA) za trening: gore ukupno vrijeme treninga, dolje timer za pauze između serija.

## Funkcije

- Glavni timer: Start, Pauza/Nastavi, Kraj treninga (drži gumb oko 1,2 s). Nakon kraja prikazuje se ukupno vrijeme, zatvara se dodirom.
- Pauze: brzi izbori 1:30, 2:00, 3:00 i jedan dodatni izbor koji se može dodati, urediti i ukloniti.
- Gumb "Namjesti": kotačići za minute i sekunde, uz "Pokreni" i "Spremi".
- Odbrojavanje: prijelazna animacija, pulsiranje u zadnjih 5 sekundi, "+15 s" i "Prekini".
- Ekran ostaje upaljen dok traje trening ili pauza (Screen Wake Lock). Svjetlinu zaslona web aplikacije ne mogu mijenjati, zato je sučelje tamno.
- Stanje se sprema lokalno, pa se trening nastavlja i nakon osvježavanja ili zatvaranja aplikacije.

## Postavljanje na Vercel

1. Na vercel.com prijavi se putem GitHuba i odaberi "Add New... > Project".
2. Odaberi repozitorij `tosho-dotcom/gym_timer` i klikni "Import".
3. Ništa ne mijenjaj: Framework Preset "Other", Build Command i Output Directory ostaju prazni.
4. Klikni "Deploy". Vercel daje adresu oblika `https://gym-timer-xxxx.vercel.app`.
5. Svaki sljedeći push na glavnu granu automatski objavljuje novu verziju.

## Instalacija na Android

1. Otvori adresu u Chromeu.
2. Izbornik (tri točkice) > "Instaliraj aplikaciju" (ili "Dodaj na početni zaslon").
3. Aplikacija se otvara preko cijelog zaslona, s vlastitom ikonom.

Nakon objave nove verzije zatvori aplikaciju i ponovno je otvori (po potrebi dvaput) da se učita ažuriranje.

## Lokalno pokretanje

```
python3 -m http.server 8000
```

Zatim otvori `http://localhost:8000`.
