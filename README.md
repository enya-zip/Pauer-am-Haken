# Pauer am Haken – Ulrich Imboden

Das Baustellenspiel von Ulrich Imboden: Ein Kran, dein Timing. Stockwerk um Stockwerk bauen,
dreimal perfekt = Pauer-Bonus.

- Spiel: `app/public` (wird bei jedem Push auf `main` automatisch auf GitHub Pages veröffentlicht,
  siehe `.github/workflows/pages.yml`).
- Rangliste mit Name und E-Mail über Supabase: siehe [RANGLISTE.md](RANGLISTE.md).
- Auf GitHub Pages gibt es keinen Server. `app/public/local-room.js` ersetzt deshalb die WebSocket-Verbindung
  zum Higgsfield-Server und rechnet mit denselben Spielregeln (`app/public/rules.js`) direkt im Browser.
  Der ursprüngliche Server-Code in `app/src` ist unverändert geblieben.
- Originalexport vom 11.11.2026: `IMPORTPROMPT.txt`, `README_IMPORT.txt`, `export-manifest.json`, `SHA256SUMS.txt`.
