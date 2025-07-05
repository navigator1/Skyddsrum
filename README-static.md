# Skyddsrum Finder - Statisk Data Version

## Översikt

Denna version använder förprocessad statisk data istället för att anropa MSB's API i realtid. Detta ger:

- **Bättre prestanda** - Ingen väntetid på API-anrop
- **Högre tillförlitlighet** - Ingen risk för API-fel
- **Bättre precision** - Data processas en gång och lagras optimalt
- **Lägre kostnader** - Färre externa API-anrop

## Hur det fungerar

1. **Data hämtas** från MSB's WFS API och processas med `scripts/download-and-process.js`
2. **Sparas som JSON** i `data/skyddsrum-stockholm.json`
3. **Servern läser** den statiska JSON-filen vid uppstart
4. **API-endpoints** använder den lokala datan

## Användning

### Starta servern med statisk data
```bash
npm run start-static
```

### Uppdatera data manuellt
```bash
npm run update-data
```

### Utveckling
```bash
# Vanlig server (med MSB API)
npm run dev

# Statisk server för test
npm run start-static
```

## Deployment på Heroku

### Alternativ 1: Automatisk data-uppdatering
```json
{
  "scripts": {
    "heroku-postbuild": "npm install --prefix client && npm run build --prefix client && npm run update-data"
  }
}
```

### Alternativ 2: Manuell data-uppdatering
1. Kör `npm run update-data` lokalt
2. Commita `data/skyddsrum-stockholm.json`
3. Deploya till Heroku

## Fördelar med statisk data

### Prestanda
- Inga externa API-anrop under runtime
- Snabbare svarstider
- Mindre minnesanvändning

### Tillförlitlighet
- Ingen dependency på MSB's API status
- Konsekvent data
- Ingen risk för timeout

### Precision
- Data valideras en gång
- Konsistent format
- Möjlighet att korrigera fel manuellt

## Nackdelar

### Datauppdateringar
- Måste uppdateras manuellt eller via cron job
- Inte alltid senaste data
- Kräver deployment för uppdateringar

### Lagring
- Tar mer plats i repo
- Måste hantera stora JSON-filer

## Rekommendation

**För produktion**: Använd statisk data (`server-static.js`)
**För utveckling**: Använd MSB API (`server.js`)

## Datastruktur

```json
{
  "lastUpdated": "2025-07-03T...",
  "source": "MSB öppen data",
  "region": "Stockholms län",
  "count": 1500,
  "municipalities": [...],
  "shelters": [
    {
      "id": "msb_1",
      "name": "Tunnelbanestation T-Centralen",
      "lat": 59.3312,
      "lng": 18.0592,
      "address": "T-Centralen, 111 20 Stockholm",
      "capacity": 2000,
      "type": "Tunnelbanestation",
      "description": "Stockholms centralstation under jorden",
      "municipality": "Stockholm",
      "owner": "SL",
      "status": "Aktivt",
      "lastUpdated": "2025-07-03T..."
    }
  ]
}
```
