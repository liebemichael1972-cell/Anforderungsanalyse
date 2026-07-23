# Anforderungsanalyse

Eine leichtgewichtige, webbasierte Anwendung zum Erfassen von **fachlichen** und
**nicht-fachlichen Anforderungen** sowie **Abnahmekriterien**. Das Ergebnis wird
als **Markdown-Datei** ausgegeben, die direkt an **Claude Code** übergeben werden
kann, um die Umsetzung zu starten.

## Funktionen

- **Projektübersicht** – Titel, Autor, Zielsetzung, Technologie-Rahmen, Out of Scope
- **Fachliche Anforderungen** (funktional) – mit Kurztitel, Beschreibung und Priorität (Muss/Soll/Kann)
- **Nicht-fachliche Anforderungen** (nicht-funktional) – zusätzlich mit Kategorie
  (Performance, Sicherheit, Usability, Datenschutz, Betrieb …)
- **Abnahmekriterien** – optional im Gegeben/Wenn/Dann-Format, mit Zuordnung zu einer Anforderung
- **Live-Markdown-Vorschau** rechts, jederzeit aktuell
- **Download `.md`** und **Kopieren** in die Zwischenablage
- **Automatisches Speichern** im Browser (LocalStorage) – nichts geht verloren
- **JSON-Export/-Import** zum Sichern und Weitergeben des kompletten Projekts

Es wird **kein Server und keine Installation** benötigt – alles läuft lokal im Browser.

## Nutzung

1. `index.html` im Browser öffnen (Doppelklick genügt), oder lokal servieren:
   ```bash
   python3 -m http.server 8000
   # dann http://localhost:8000 öffnen
   ```
2. Projektangaben und Anforderungen erfassen.
3. Rechts **Download .md** klicken – die Markdown-Datei wird gespeichert.

## Weitergabe an Claude Code

Die erzeugte Markdown-Datei (z. B. `mein-projekt-anforderungen.md`) ins Projekt legen
und Claude Code beauftragen:

```bash
claude "Setze die Anforderungen aus mein-projekt-anforderungen.md um."
```

Die Datei enthält am Ende einen expliziten **Umsetzungsauftrag** samt Priorisierungs-
hinweis (Muss vor Soll vor Kann), sodass Claude Code direkt loslegen kann.

## Dateien

| Datei         | Zweck                                    |
|---------------|------------------------------------------|
| `index.html`  | Struktur der Anwendung                   |
| `styles.css`  | Gestaltung (Dark Theme, responsiv)       |
| `app.js`      | Logik, Speicherung, Markdown-Generierung |
