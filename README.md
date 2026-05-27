# OpenPSM

Minimalistischer, client-seitiger Web-Assistent zur Erstellung von PDF-Berichten für Pflanzenschutzmittel-Anwendungen. Hilft österreichischen Landwirten bei der Dokumentation gemäß EU-DVO 2023/564 und § 11 PflSchG.

## Merkmale

- **Keine Datenspeicherung:** Es werden keine Cookies und keine Benutzerdaten gespeichert.
- **Kein Login erforderlich:** Die App funktioniert sofort im Browser.
- **EPPO-Code-Suche:** Durchsuchbarer Katalog basierend auf der offiziellen österreichischen EPPO-Kulturliste.
- **PSM-Register-Suche:** Produktsuche im offiziellen BAES PSM-Register (~1.900 Produkte) mit Auto-Fill von Produktname und Zulassungsnummer.
- **GPS-Standort:** Ermittlung der aktuellen Koordinaten per Browser-Geolocation.
- **Tankmischungen:** Dokumentation mehrerer Produkte pro Anwendung.
- **PDF-Export:** Formatierter A4-Bericht zum Herunterladen.

## Technologie

Reines HTML/CSS/JS ohne Framework, Build-Tools oder Backend. PDF-Generierung via [jsPDF](https://github.com/parallax/jsPDF) (CDN).

## Verwendung

1. `index.html` in einem modernen Browser öffnen (oder auf einem statischen Webserver hosten).
2. Alle Pflichtfelder ausfüllen.
3. Auf "PDF-Bericht erstellen" klicken.
4. Der Bericht wird als PDF-Datei heruntergeladen.


## Lizenz

MIT
