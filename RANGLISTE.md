# Rangliste einrichten (Supabase)

Die Rangliste von «Pauer am Haken» speichert Name, E-Mail-Adresse, Punkte und Höhe im
bestehenden Supabase-Projekt **«Ranglisten der Spiele»** (dasselbe wie bei Iischi Party, HORNOX
und dem Schnyder-Game). Die Tabellen heissen `pauer_am_haken_…`, die anderen Spiele werden nicht berührt.
Andere Spieler sehen nur **Platz, Name, Höhe und Punkte**. E-Mail-Adressen sind nur im Supabase-Dashboard sichtbar.

## 1. Datenbank vorbereiten (einmalig)
1. Auf https://supabase.com das Projekt **«Ranglisten der Spiele»** öffnen.
2. Links **SQL Editor** öffnen.
3. Den ganzen Inhalt von [`supabase/rangliste.sql`](supabase/rangliste.sql) einfügen und auf **Run** klicken.

## 2. Spiel verbinden
Ist bereits erledigt: [`app/public/leaderboard-config.js`](app/public/leaderboard-config.js) enthält
die Projekt-Adresse und den öffentlichen **Publishable key** (`sb_publishable_…`).
Den **Secret key** (`sb_secret_…`) niemals dort eintragen.

## Einträge ansehen
Supabase → **Table Editor**:
- `pauer_am_haken_rangliste`: bestes Ergebnis pro Spieler mit Platz, Name, E-Mail, Punkten, Höhe in Metern,
  Stockwerken, perfekten Treffern, bester Serie, Anzahl Läufe und Datum.
- `pauer_am_haken_alle_spiele`: alle einzelnen Spiele. Hier lassen sich Einträge löschen
  (z. B. bei Auskunfts- oder Löschanfragen nach Datenschutzgesetz oder bei verdächtigen Punktzahlen).

## Gut zu wissen
- Rangiert wird nach **Punkten**. Pro E-Mail-Adresse zählt nur das beste Ergebnis.
- Pro E-Mail-Adresse sind höchstens 20 Einträge pro Stunde möglich (Spam-Schutz).
- Die Punkte werden im Browser berechnet. Wer sich mit Technik auskennt, könnte eine falsche Punktzahl einsenden.
  Die Datenbank lehnt unmögliche Werte ab (mehr als 350 Punkte pro Stockwerk). Verdächtige Einträge trotzdem vor einer
  Gewinnerauswahl prüfen.
- Falls das Spiel auf einer Website mit Content-Security-Policy eingebettet wird, muss `connect-src` die Supabase-Adresse erlauben.
