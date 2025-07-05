# Skyddsrum Finder - Uppdaterad med MSB Data

## Översikt
Skyddsrum Finder är nu uppdaterad för att använda **officiell data från MSB (Myndigheten för samhällsskydd och beredskap)** via deras INSPIRE-kompatibla Atom Feed och Shapefile-format. Appen innehåller nu **15,988 skyddsrum** i Stockholms län med hög precision och tillförlitlighet.

## Nya Funktioner

### 📊 Tillförlitlig Data
- **15,988 skyddsrum** från MSB:s officiella databas
- **Högprecisionskoordinater** konverterade från SWEREF99 TM till WGS84
- **Uppdaterad information** direkt från MSB:s Shapefile-format
- **Detaljerad metadata** inklusive kapacitet, adresser och INSPIRE-ID

### 🔄 Automatisk Datauppdatering
- Ny script för att ladda ner och processa data från MSB
- Använder direkta länkar från MSB:s Atom Feed
- Konverterar koordinatsystem automatiskt
- Filtrerar för Stockholms län specifikt

## Datastruktur

### Skyddsrum-objekt
```json
{
  "id": "01JZ9A8PVTSXAKB12BGMDJEW0A",
  "name": "115180-7",
  "lat": 59.366502786082506,
  "lng": 17.844409799939903,
  "address": "Fritrappan 1",
  "capacity": 84,
  "type": "civilProtectionSite",
  "description": "civilProtectionSite - Civilbefolkning",
  "municipality": "Stockholm",
  "owner": "The Swedish Civil Contingencies Agency (MSB)",
  "status": "Aktivt",
  "inspireId": "01JZ9A8PVTSXAKB12BGMDJEW0A",
  "servicelevel": "STA",
  "typeOfOccupancy": "Civilbefolkning",
  "lastUpdated": "2025-07-04T10:43:33.517Z"
}
```

## Användning

### Starta Servern
```bash
npm start
```

### Uppdatera Data
```bash
npm run update-data
```

### Gamla WFS-metoden (backup)
```bash
npm run update-data-old
```

### Statisk Server
```bash
npm run start-static
```

## Datakällor

### Primär: MSB Shapefile
- **URL**: https://inspire.msb.se/nedladdning/filer/shape/Skyddsrum.zip
- **Format**: Shapefile (ZIP)
- **Koordinatsystem**: SWEREF99 TM (EPSG:3006)
- **Konverterat till**: WGS84 (EPSG:4326)
- **Uppdateringsfrekvens**: Manual (kör `npm run update-data`)

### Alternativ: GML-format
- **Core**: https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteCore.zip
- **Extended**: https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteExtended.zip

## Tekniska Detaljer

### Koordinatkonvertering
- Använder `proj4` för att konvertera från SWEREF99 TM till WGS84
- Automatisk validering av koordinater inom Stockholms län
- Filtrera baserat på geografiska gränser

### Dataprocessering
- Läser Shapefile-format med `shapefile` npm-paketet
- Extraherar ZIP-filer med `adm-zip`
- Validerar och rensar data automatiskt
- Mappar MSB-fält till appens datastruktur

### Statistik
- **Totalt**: 15,988 skyddsrum
- **Stockholm**: 15,883 skyddsrum
- **Vallentuna**: 81 skyddsrum
- **Salem**: 10 skyddsrum
- **Övriga kommuner**: 14 skyddsrum

## API Endpoints

### `POST /api/find-nearest`
Hitta närmaste skyddsrum baserat på position.

**Request:**
```json
{
  "lat": 59.3293,
  "lng": 18.0686
}
```

**Response:**
```json
{
  "nearestShelters": [
    {
      "id": "01JZ9A8PVTSXAKB12BGMDJEW0A",
      "name": "115180-7",
      "distance": 0.234,
      "lat": 59.366502786082506,
      "lng": 17.844409799939903,
      "address": "Fritrappan 1",
      "capacity": 84,
      "municipality": "Stockholm"
    }
  ]
}
```

### `GET /api/shelters`
Hämta alla skyddsrum (för utveckling).

## Deployment

### Heroku
Appen är konfigurerad för deployment på Heroku med automatisk datauppdatering:

```bash
git push heroku main
```

### Miljövariabler
```
NODE_ENV=production
PORT=5000
```

## Utveckling

### Lokalt
```bash
npm run dev
```

### Debugging
```bash
node scripts/debug-shapefile.js
```

### Test av ny data
```bash
node scripts/download-and-process-new.js
```

## Filer

### Huvudfiler
- `server.js` - Huvudserver med API endpoints
- `scripts/download-and-process-new.js` - Nya data-scriptet
- `data/skyddsrum-stockholm.json` - Processerad data (15,988 skyddsrum)
- `data/skyddsrum-stockholm.min.json` - Kompakt version

### Backup/Utveckling
- `server-static.js` - Statisk server för backup
- `scripts/download-and-process.js` - Gamla WFS-scriptet
- `scripts/debug-shapefile.js` - Debug-verktyg

## Säkerhet och Prestanda

### Caching
- Data cachas i 1 timme för att minska laddningstider
- Automatisk cache-invalidering vid datauppdatering

### Minnesskydd
- Stora datafiler läses vid behov
- Temporära filer rensas automatiskt

## Kommande Förbättringar

1. **Automatiserad uppdatering** - Cron-jobb för regelbundna uppdateringar
2. **Datavalidering** - Mer omfattande validering av MSB-data
3. **Performanceoptimering** - Spatial indexering för snabbare sökningar
4. **Backup-källor** - Flera datakällor för redundans

## Support

För frågor eller problem, kontrollera:
1. Loggar i terminalen
2. Nätverksstatus för MSB-tjänster
3. Datafilernas integritet

**Senast uppdaterad**: 2025-07-04
**Dataversion**: MSB Shapefile (15,988 skyddsrum)
