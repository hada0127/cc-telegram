# cc-telegram

[![npm version](https://badge.fury.io/js/cc-telegram.svg)](https://www.npmjs.com/package/cc-telegram)
[![GitHub](https://img.shields.io/github/license/hada0127/cc-telegram)](https://github.com/hada0127/cc-telegram)

🌍 **Language / 언어 / 语言**:
[English](README.md) | [한국어](README.ko.md) | [中文](README.zh.md) | [Español](README.es.md) | [हिन्दी](README.hi.md) | [العربية](README.ar.md) | [Português](README.pt.md) | [Русский](README.ru.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Deutsch](README.de.md)

**GitHub**: [https://github.com/hada0127/cc-telegram](https://github.com/hada0127/cc-telegram)

---

Remote Claude Code Ausführung über Telegram Bot.

Steuern Sie Claude Code von überall mit Ihrer Telegram-App. Erstellen Sie Aufgaben, überwachen Sie den Fortschritt und erhalten Sie Abschlussbenachrichtigungen - alles von Ihrem Telefon aus.

## Funktionen

- **Remote-Aufgabenausführung**: Senden Sie Programmieraufgaben an Claude Code über Telegram
- **Parallele Ausführung**: Führen Sie mehrere Aufgaben gleichzeitig aus (konfigurierbar)
- **Prioritätssystem**: Dringend, Hoch, Normal, Niedrig Prioritätsstufen
- **Automatische Wiederholung**: Automatische Wiederholung bei Fehler mit konfigurierbaren Versuchen
- **Echtzeit-Status**: Überwachen Sie Aufgabenfortschritt und Claude-Ausgabe
- **Log-Rotation**: Automatische Bereinigung alter Logs und abgeschlossener Aufgaben

## Anforderungen

- Node.js 18.0.0 oder höher
- [Claude Code CLI](https://claude.ai/claude-code) installiert und authentifiziert
- Telegram-Konto

## Installation

```bash
npx cc-telegram
```

Oder global installieren:

```bash
npm install -g cc-telegram
cc-telegram
```

## Ersteinrichtung

Beim ersten Start führt cc-telegram Sie durch den Einrichtungsprozess:

1. **Telegram Bot erstellen**
   - Öffnen Sie Telegram und suchen Sie nach [@BotFather](https://t.me/BotFather)
   - Senden Sie `/newbot` und folgen Sie den Anweisungen
   - Kopieren Sie das bereitgestellte Bot-Token

2. **Bot-Token eingeben**
   - Fügen Sie Ihr Bot-Token ein, wenn Sie dazu aufgefordert werden
   - Das Tool überprüft, ob das Token gültig ist

3. **Konto verknüpfen**
   - Öffnen Sie Ihren neuen Bot in Telegram
   - Senden Sie `/start` an den Bot
   - Das CLI erkennt Ihre Nachricht und zeigt Ihre Chat-ID an
   - Geben Sie die Chat-ID zur Bestätigung ein

4. **Einstellungen konfigurieren**
   - Legen Sie die Standard-Wiederholungsanzahl fest (empfohlen: 15)
   - Aktivieren/Deaktivieren Sie die parallele Ausführung
   - Legen Sie die maximale Anzahl gleichzeitiger Aufgaben fest (wenn parallel aktiviert)

Ihre Konfiguration wird lokal in `.cc-telegram/config.json` gespeichert (verschlüsselt).

## Verwendung

Nach der Einrichtung führen Sie einfach aus:

```bash
npx cc-telegram
```

Der Bot startet und wartet auf Befehle von Ihrem Telegram-Konto.

## Telegram-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `/new` | Neue Aufgabe erstellen |
| `/list` | Ausstehende und laufende Aufgaben anzeigen |
| `/completed` | Abgeschlossene Aufgaben anzeigen |
| `/failed` | Fehlgeschlagene Aufgaben anzeigen |
| `/status` | Aktuellen Ausführungsstatus prüfen und laufende Aufgaben abbrechen |
| `/debug` | Systeminformationen anzeigen |
| `/cancel` | Aufgabenerstellungsablauf abbrechen |
| `/reset` | Alle Daten zurücksetzen (mit Bestätigung) |

## Aufgaben erstellen

### Einfache Aufgaben
Für einmalige Ausführung ohne Abschlusskriterien:

1. Senden Sie `/new`
2. Wählen Sie "Einfach (keine Abschlusskriterien, keine Wiederholung)"
3. Geben Sie Ihre Anforderung ein
4. Die Aufgabe wird sofort in die Warteschlange gestellt

### Komplexe Aufgaben
Für Aufgaben mit Abschlusskriterien und automatischer Wiederholung:

1. Senden Sie `/new`
2. Wählen Sie "Komplex (mit Abschlusskriterien und Wiederholung)"
3. Geben Sie Ihre Anforderung ein
4. Geben Sie Abschlusskriterien ein (z.B. "Alle Tests bestehen")
5. Wählen Sie die Prioritätsstufe
6. Wählen Sie die Anzahl der Wiederholungen (10 oder benutzerdefiniert)

## Aufgabenpriorität

Aufgaben werden in Prioritätsreihenfolge ausgeführt:

| Priorität | Symbol | Beschreibung |
|-----------|--------|--------------|
| Dringend | 🔴 | Zuerst ausführen |
| Hoch | 🟠 | Hohe Priorität |
| Normal | 🟢 | Standardpriorität |
| Niedrig | 🔵 | Bei Leerlauf ausführen |

## Parallele Ausführung

Wenn während der Einrichtung aktiviert, können mehrere Aufgaben gleichzeitig ausgeführt werden:

- Konfigurieren Sie die maximale Anzahl gleichzeitiger Aufgaben (1-10)
- Jede Aufgabe zeigt ihr ID-Präfix in der Konsolenausgabe
- `/status` zeigt alle laufenden Aufgaben mit Stopp-Buttons zum Abbrechen
- Aufgaben mit höherer Priorität erhalten weiterhin zuerst Slots

### Laufende Aufgaben Abbrechen

Sie können aktuell laufende Aufgaben abbrechen:

1. Senden Sie `/status` um laufende Aufgaben anzuzeigen
2. Jede laufende Aufgabe zeigt einen "Stopp"-Button
3. Klicken Sie auf den Button, um die Aufgabe sofort zu beenden
4. Die abgebrochene Aufgabe wird als fehlgeschlagen markiert

### Konsolenausgabe (Paralleler Modus)

```
[a1b2c3d4] Aufgabe starten...
[e5f6g7h8] Projekt kompilieren...
[a1b2c3d4] Tests bestanden!
```

## Konfiguration

Die Konfiguration wird in `.cc-telegram/config.json` gespeichert:

| Einstellung | Beschreibung | Standard |
|-------------|--------------|----------|
| `botToken` | Telegram Bot-Token (verschlüsselt) | - |
| `chatId` | Ihre Telegram Chat-ID (verschlüsselt) | - |
| `debugMode` | Debug-Protokollierung aktivieren | `false` |
| `claudeCommand` | Benutzerdefinierter Claude CLI-Befehl | `null` (Auto-Erkennung) |
| `logRetentionDays` | Tage zur Aufbewahrung von Log-Dateien | `7` |
| `defaultMaxRetries` | Standard-Wiederholungsanzahl | `15` |
| `parallelExecution` | Parallele Ausführung aktivieren | `false` |
| `maxParallel` | Maximale gleichzeitige Aufgaben | `3` |

### Benutzerdefinierter Claude-Befehl

Wenn Claude CLI an einem nicht standardmäßigen Ort installiert ist:

```json
{
  "claudeCommand": "npx @anthropic-ai/claude-code"
}
```

## Verzeichnisstruktur

```
.cc-telegram/
├── config.json      # Verschlüsselte Konfiguration
├── tasks.json       # Index ausstehender Aufgaben
├── completed.json   # Index abgeschlossener Aufgaben
├── failed.json      # Index fehlgeschlagener Aufgaben
├── tasks/           # Einzelne Aufgabendateien
├── completed/       # Details abgeschlossener Aufgaben
├── failed/          # Details fehlgeschlagener Aufgaben
└── logs/            # Tägliche Log-Dateien
```

## Abschlusserkennung

Claude Code signalisiert den Aufgabenabschluss mit speziellen Markierungen:

- `<promise>COMPLETE</promise>` - Aufgabe erfolgreich abgeschlossen
- `<promise>FAILED</promise>` - Aufgabe mit Grund fehlgeschlagen

Wenn kein Signal erkannt wird, verwendet das System Mustererkennung, um Erfolg oder Misserfolg basierend auf dem Ausgabeinhalt zu bestimmen.

## Log-Verwaltung

- Log-Dateien werden täglich erstellt: `YYYY-MM-DD.log`
- Alte Logs werden nach `logRetentionDays` automatisch gelöscht
- Abgeschlossene/fehlgeschlagene Aufgabendateien werden nach 30 Tagen bereinigt

## Sicherheit

- Bot-Token und Chat-ID werden mit AES-256-GCM verschlüsselt
- Nur Nachrichten von Ihrer registrierten Chat-ID werden verarbeitet
- Alle Daten werden lokal in Ihrem Projektverzeichnis gespeichert

## Fehlerbehebung

### Bot antwortet nicht
- Stellen Sie sicher, dass der Bot läuft (`npx cc-telegram`)
- Überprüfen Sie, ob Ihre Chat-ID mit der konfigurierten übereinstimmt
- Überprüfen Sie die Internetverbindung

### Claude Code nicht gefunden
- Stellen Sie sicher, dass Claude CLI installiert ist: `npm install -g @anthropic-ai/claude-code`
- Oder setzen Sie einen benutzerdefinierten Befehl in config: `"claudeCommand": "npx @anthropic-ai/claude-code"`

### Aufgaben hängen im Fortschritt fest
- Beim Neustart werden verwaiste Aufgaben automatisch auf "ready" zurückgesetzt
- Verwenden Sie `/reset`, um bei Bedarf alle Daten zu löschen

## Lizenz

MIT
