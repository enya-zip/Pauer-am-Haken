PAUER AM HAKEN – ULRICH IMBODEN
Export vom 11. November 2026

Das Paket enthält den aktuellen gespeicherten Projektstand des Kranspiels:
Spielcode, Server, Bilder, Imboden-Logo, Schriften, Musik und Soundeffekte.
Die Originaldateien sind unverändert enthalten.

So übernimmt dein Partner das Spiel:
1. In ChatGPT den eigenen Higgsfield-Account verbinden.
2. Diese ZIP-Datei in einen neuen Chat hochladen.
3. Den Text aus IMPORTPROMPT.txt senden.
4. Das neue Spiel im eigenen Account erstellen und unter einer eigenen URL bereitstellen lassen.

Dies ist ein Quellcodepaket zur Übernahme in ein neues Higgsfield-Spiel.
Ein natives ZIP-Importformat oder automatischer Kontotransfer ist damit nicht bestätigt.
Falls die Oberfläche keinen ZIP-Import anbietet, erfolgt die Übernahme über den
Higgsfield-Assistenten anhand der Dateien. Zugang zum Zielaccount ist dafür nötig.

Die bisherige URL bleibt beim bisherigen Account:
https://pauer-am-haken.higgsfield.app

Was beim Übernehmen angepasst werden muss:
- Neues Spiel im Zielaccount anlegen, Typ game, Kategorie arcade.
- app/ in das neue Projekt übernehmen; dort liegen Spiel und Build-Konfiguration.
- app.manifest.json beibehalten: durableObject = Room; db, r2 und kv = false.
- Bild- und Favicon-URLs in app/src/app-meta.json sowie og:image in
  app/public/index.html auf die neue Spiel-URL setzen. Die Dateien liegen in
  app/public/assets/: favicon.svg, cover.png, og-wide.png und og.png.
- WebSocket-Verbindungen müssen auf die neue eigene Domain zeigen.
  Die vorhandenen relativen Verbindungen im Client beibehalten.
- Das Spiel muss öffentlich ohne Login funktionieren.
- Bestehende Grafik, Kranmechanik, Texte, Ton und Bonuslogik beibehalten.
- Keine neue Bild- oder Musikgenerierung nötig.

Spielstände:
Persönliche Rekorde liegen im Browser der jeweiligen Person. Sie wechseln bei
einer neuen Domain nicht automatisch mit. Laufende Runden und Infrastruktur
werden im Zielaccount neu angelegt. Das Paket enthält keine Zugangsdaten.

Prüfung des Exports:
- Alle versionierten Projektdateien übernommen; keine .git-Historie.
- Lokale Bilder, Musik, Fonts und referenzierte /assets/-Dateien vorhanden.
- Server- und Browser-Spielregeln stimmen bytegenau überein.
- Bestehender Logik-Check und Regeltest erfolgreich; Client-Syntax geprüft.
- Vollständiger Build nicht ausgeführt: Bun und Projektabhängigkeiten fehlen
  in der Exportumgebung.
- Import im fremden Zielaccount noch nicht ausgeführt.
- Der Produktionsstatus wurde von Higgsfield als deployed gemeldet.
  Ein direkter HTTP-Abgleich der Live-Dateien war mit HTTP 403 blockiert.

Dateien:
app/                    Vollständiges Originalprojekt
design/                 Ursprüngliche Asset-Dokumentation
IMPORTPROMPT.txt         Auftrag für den Partneraccount
export-manifest.json    Herkunft, Revision und Prüfumfang
SHA256SUMS.txt           Prüfsummen der enthaltenen Dateien
