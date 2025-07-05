const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Verbose logging
console.log('🔧 Starting Skyddsrum Finder Server...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🌐 Port:', PORT);
console.log('📁 Current directory:', __dirname);
console.log('📦 Client build path:', path.join(__dirname, 'client/build'));

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Response logging middleware
app.use((req, res, next) => {
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(body) {
    console.log(`📤 ${req.method} ${req.path} - Status: ${res.statusCode}`);
    console.log(`📝 Full Response Body:`, body);
    return originalSend.call(this, body);
  };
  
  res.json = function(obj) {
    console.log(`📤 ${req.method} ${req.path} - Status: ${res.statusCode}`);
    console.log(`📝 Full JSON Response:`, JSON.stringify(obj, null, 2));
    return originalJson.call(this, obj);
  };
  
  next();
});

// MSB's WFS endpoint för skyddsrum
const MSB_WFS_URL = 'https://inspire.msb.se/geoserver/wfs';

// Stockholms län kommuner (för filtrering)
const STOCKHOLM_MUNICIPALITIES = [
  'Stockholm', 'Upplands Väsby', 'Vallentuna', 'Österåker', 'Värmdö', 'Järfälla',
  'Ekerö', 'Huddinge', 'Botkyrka', 'Salem', 'Haninge', 'Tyresö', 'Upplands-Bro',
  'Nykvarn', 'Täby', 'Danderyd', 'Sollentuna', 'Sundbyberg', 'Solna', 'Lidingö',
  'Vaxholm', 'Norrtälje', 'Sigtuna', 'Nynäshamn', 'Södertälje', 'Nacka'
];

// Geografiska gränser för Stockholms län (ungefärliga koordinater)
const STOCKHOLM_BOUNDS = {
  north: 60.0,
  south: 58.7,
  east: 18.8,
  west: 17.0
};

// Cache för skyddsrum data
let skyddsrumCache = [];
let lastCacheUpdate = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 timme

// Funktion för att kontrollera om koordinater är inom Stockholms län
function isWithinStockholmRegion(lat, lng) {
  return lat >= STOCKHOLM_BOUNDS.south && 
         lat <= STOCKHOLM_BOUNDS.north && 
         lng >= STOCKHOLM_BOUNDS.west && 
         lng <= STOCKHOLM_BOUNDS.east;
}

// Funktion för att hämta skyddsrum från MSB:s API
async function fetchSkyddsrumFromMSB() {
  try {
    console.log('🔄 Hämtar skyddsrum från MSB API...');
    console.log('🌐 MSB URL:', MSB_WFS_URL);
    
    const params = {
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeName: 'skyddsrum:Skyddsrum',
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      // Begränsa till Stockholms län område
      bbox: `${STOCKHOLM_BOUNDS.west},${STOCKHOLM_BOUNDS.south},${STOCKHOLM_BOUNDS.east},${STOCKHOLM_BOUNDS.north},EPSG:4326`
    };
    
    console.log('📊 Request parameters:', params);
    
    const response = await axios.get(MSB_WFS_URL, {
      params: params,
      timeout: 15000
    });

    console.log('✅ MSB API Response received');
    console.log('📊 Response status:', response.status);
    console.log('📊 Response headers:', response.headers);
    
    if (response.data && response.data.features) {
      console.log(`📥 Raw data from MSB: ${response.data.features.length} features`);
      console.log('📊 Sample feature:', JSON.stringify(response.data.features[0], null, 2));
      
      const filteredShelters = response.data.features
        .filter(feature => {
          // Kontrollera koordinater
          if (!feature.geometry || !feature.geometry.coordinates) return false;
          
          const [lng, lat] = feature.geometry.coordinates;
          return isWithinStockholmRegion(lat, lng);
        })
        .map((feature, index) => {
          const [lng, lat] = feature.geometry.coordinates;
          const props = feature.properties || {};
          
          return {
            id: feature.id || `msb_${index + 1}`,
            name: props.namn || props.name || props.beteckning || 'Skyddsrum',
            lat: lat,
            lng: lng,
            address: props.adress || props.address || props.gatuadress || 'Adress ej tillgänglig',
            capacity: props.antalplatser || props.capacity || props.platser || 'Okänd',
            type: props.typ || props.type || props.skyddsrumstyp || 'Skyddsrum',
            description: props.beskrivning || props.description || 'Skyddsrum från MSB',
            municipality: props.kommun || props.municipality || extractMunicipality(props.adress || props.address),
            owner: props.agare || props.owner || 'Okänd',
            status: props.status || 'Aktivt'
          };
        });

      console.log(`✅ Processed and filtered to ${filteredShelters.length} shelters in Stockholm County`);
      console.log('📊 Sample processed shelter:', JSON.stringify(filteredShelters[0], null, 2));
      return filteredShelters;
    } else {
      console.log('⚠️ No features in MSB API response');
      console.log('📊 Full response data:', JSON.stringify(response.data, null, 2));
    }
    
    console.log('⚠️ Using fallback data instead of MSB API');
    return getLocalSkyddsrumData();
    
  } catch (error) {
    console.error('❌ MSB API Error Details:');
    console.error('❌ Error message:', error.message);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error response:', error.response?.data);
    console.error('❌ Error status:', error.response?.status);
    console.log('🔄 Falling back to local data');
    return getLocalSkyddsrumData();
  }
}

// Funktion för att extrahera kommun från adress
function extractMunicipality(address) {
  if (!address) return 'Okänd';
  
  const addressUpper = address.toUpperCase();
  
  for (const municipality of STOCKHOLM_MUNICIPALITIES) {
    if (addressUpper.includes(municipality.toUpperCase())) {
      return municipality;
    }
  }
  
  return 'Stockholm'; // Default
}

// Läs skyddsrum från den förbättrade JSON-filen
function getLocalSkyddsrumData() {
  try {
    // Försök läsa olika versioner av data (i prioritetsordning)
    const finalPath = path.join(__dirname, 'data', 'skyddsrum-stockholm-final.json');
    const improvedPath = path.join(__dirname, 'data', 'skyddsrum-stockholm-improved.json');
    const originalPath = path.join(__dirname, 'data', 'skyddsrum-stockholm.json');
    
    let dataPath = originalPath;
    
    if (fs.existsSync(finalPath)) {
      // Kontrollera att final-versionen inte är tom
      const finalData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
      if (finalData.shelters && finalData.shelters.length > 0 && finalData.shelters[0].name) {
        dataPath = finalPath;
        console.log('📂 Använder final skyddsrum-data (förbättrad + adresser)');
      } else {
        console.log('⚠️ Final-data verkar vara skadad, använder improved-data');
        dataPath = improvedPath;
      }
    } else if (fs.existsSync(improvedPath)) {
      dataPath = improvedPath;
      console.log('📂 Använder förbättrad skyddsrum-data');
    } else {
      console.log('📂 Använder ursprunglig skyddsrum-data');
    }
    
    console.log('📂 Läser lokal skyddsrum-data från:', dataPath);
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    if (data && data.shelters && Array.isArray(data.shelters)) {
      console.log(`✅ Laddade ${data.shelters.length} skyddsrum från lokal fil`);
      console.log(`📊 Data uppdaterad: ${data.lastUpdated}`);
      console.log(`📊 Källa: ${data.source}`);
      
      // Visa kommun-statistik
      const municipalities = {};
      data.shelters.forEach(shelter => {
        municipalities[shelter.municipality] = (municipalities[shelter.municipality] || 0) + 1;
      });
      
      console.log('📊 Kommun-fördelning:');
      Object.entries(municipalities)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([municipality, count]) => {
          console.log(`  ${municipality}: ${count} skyddsrum`);
        });
      
      return data.shelters;
    } else {
      console.log('⚠️ Ogiltig data-struktur i lokal fil');
    }
  } catch (error) {
    console.error('❌ Fel vid läsning av lokal skyddsrum-data:', error);
  }
  
  console.log('⚠️ Använder minimal fallback-data');
  return getMinimalFallbackData();
}

// Minimal fallback om allt annat misslyckas
function getMinimalFallbackData() {
  return [
    // Stockholm stad
    {
      id: 1,
      name: "Tunnelbanestation Östermalmstorg",
      lat: 59.3347,
      lng: 18.0738,
      address: "Östermalmstorg, 114 42 Stockholm",
      capacity: 1000,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation som kan användas som skyddsrum",
      municipality: "Stockholm"
    },
    {
      id: 2,
      name: "Tunnelbanestation T-Centralen",
      lat: 59.3312,
      lng: 18.0592,
      address: "T-Centralen, 111 20 Stockholm",
      capacity: 2000,
      type: "Tunnelbanestation",
      description: "Stockholms centralstation under jorden",
      municipality: "Stockholm"
    },
    {
      id: 3,
      name: "Tunnelbanestation Slussen",
      lat: 59.3199,
      lng: 18.0719,
      address: "Slussen, 118 20 Stockholm",
      capacity: 800,
      type: "Tunnelbanestation",
      description: "Stor tunnelbanestation vid Slussen",
      municipality: "Stockholm"
    },
    
    // Upplands Väsby
    {
      id: 4,
      name: "Skyddsrum Upplands Väsby Centrum",
      lat: 59.5186,
      lng: 17.9114,
      address: "Centralplan, 194 80 Upplands Väsby",
      capacity: 600,
      type: "Kommunalt skyddsrum",
      description: "Centralt beläget skyddsrum i Upplands Väsby",
      municipality: "Upplands Väsby"
    },
    {
      id: 5,
      name: "Skyddsrum Väsby Station",
      lat: 59.5164,
      lng: 17.9095,
      address: "Stationsområdet, 194 30 Upplands Väsby",
      capacity: 400,
      type: "Järnvägsskyddsrum",
      description: "Skyddsrum vid Väsby station",
      municipality: "Upplands Väsby"
    },
    
    // Solna
    {
      id: 6,
      name: "Tunnelbanestation Solna Centrum",
      lat: 59.3598,
      lng: 18.0005,
      address: "Solna Centrum, 171 45 Solna",
      capacity: 750,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Solna",
      municipality: "Solna"
    },
    
    // Sundbyberg
    {
      id: 7,
      name: "Tunnelbanestation Sundbyberg",
      lat: 59.3617,
      lng: 17.9709,
      address: "Sundbyberg, 172 67 Sundbyberg",
      capacity: 500,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Sundbyberg",
      municipality: "Sundbyberg"
    },
    
    // Huddinge
    {
      id: 8,
      name: "Tunnelbanestation Huddinge Centrum",
      lat: 59.2369,
      lng: 17.9821,
      address: "Huddinge Centrum, 141 30 Huddinge",
      capacity: 800,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Huddinge",
      municipality: "Huddinge"
    },
    
    // Botkyrka
    {
      id: 9,
      name: "Tunnelbanestation Hallunda",
      lat: 59.2391,
      lng: 17.8372,
      address: "Hallunda, 147 50 Tumba",
      capacity: 600,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Botkyrka",
      municipality: "Botkyrka"
    },
    
    // Haninge
    {
      id: 10,
      name: "Tunnelbanestation Handen",
      lat: 59.1686,
      lng: 18.1439,
      address: "Handen, 136 40 Haninge",
      capacity: 700,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Haninge",
      municipality: "Haninge"
    },
    
    // Täby
    {
      id: 11,
      name: "Skyddsrum Täby Centrum",
      lat: 59.4439,
      lng: 18.0686,
      address: "Täby Centrum, 183 30 Täby",
      capacity: 550,
      type: "Kommunalt skyddsrum",
      description: "Centralt skyddsrum i Täby",
      municipality: "Täby"
    },
    
    // Sollentuna
    {
      id: 12,
      name: "Skyddsrum Sollentuna Centrum",
      lat: 59.4286,
      lng: 17.9506,
      address: "Sollentuna Centrum, 192 30 Sollentuna",
      capacity: 450,
      type: "Kommunalt skyddsrum",
      description: "Centralt skyddsrum i Sollentuna",
      municipality: "Sollentuna"
    },
    
    // Nacka
    {
      id: 13,
      name: "Tunnelbanestation Nacka",
      lat: 59.3106,
      lng: 18.1597,
      address: "Nacka, 131 40 Nacka",
      capacity: 650,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation i Nacka",
      municipality: "Nacka"
    },
    
    // Värmdö
    {
      id: 14,
      name: "Skyddsrum Gustavsberg",
      lat: 59.3258,
      lng: 18.3894,
      address: "Gustavsberg, 134 30 Gustavsberg",
      capacity: 350,
      type: "Kommunalt skyddsrum",
      description: "Skyddsrum på Värmdö",
      municipality: "Värmdö"
    },
    
    // Lidingö
    {
      id: 15,
      name: "Skyddsrum Lidingö Centrum",
      lat: 59.3656,
      lng: 18.1331,
      address: "Lidingö Centrum, 181 30 Lidingö",
      capacity: 500,
      type: "Kommunalt skyddsrum",
      description: "Centralt skyddsrum på Lidingö",
      municipality: "Lidingö"
    }
  ];
}

// Funktion för att få skyddsrum data (med cache)
async function getSkyddsrumData() {
  const now = Date.now();
  
  // Kontrollera om cache är giltig
  if (skyddsrumCache.length > 0 && (now - lastCacheUpdate) < CACHE_DURATION) {
    return skyddsrumCache;
  }

  // Hämta data från lokal JSON-fil (uppdaterad från MSB Shapefile)
  console.log('🔄 Hämtar aktuell data från lokal fil (MSB Shapefile)...');
  skyddsrumCache = getLocalSkyddsrumData();
  lastCacheUpdate = now;
  
  console.log(`✅ Skyddsrum data uppdaterad: ${skyddsrumCache.length} skyddsrum i Stockholms län`);
  return skyddsrumCache;
}

// Funktion för att beräkna avstånd mellan två koordinater (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Jordens radie i km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// API endpoint för att hitta närmaste skyddsrum
app.post('/api/find-nearest', async (req, res) => {
  const { lat, lng, limit = 5 } = req.body;
  
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitud och longitud krävs' });
  }

  try {
    // Hämta aktuell skyddsrum data
    const skyddsrumData = await getSkyddsrumData();
    
    if (skyddsrumData.length === 0) {
      return res.status(500).json({ error: 'Ingen skyddsrum data tillgänglig' });
    }

    // Beräkna avstånd till alla skyddsrum
    const skyddsrumWithDistance = skyddsrumData.map(skyddsrum => ({
      ...skyddsrum,
      distance: calculateDistance(lat, lng, skyddsrum.lat, skyddsrum.lng)
    }));

    // Sortera efter avstånd
    skyddsrumWithDistance.sort((a, b) => a.distance - b.distance);

    // Returnera de närmaste skyddsrummen
    const nearestShelters = skyddsrumWithDistance.slice(0, Math.min(limit, 10));
    
    // Förbered respons med extra information
    const response = {
      userLocation: { lat, lng },
      nearestShelters: nearestShelters.map(shelter => ({
        id: shelter.id,
        name: shelter.name,
        address: shelter.address,
        municipality: shelter.municipality,
        distance: Math.round(shelter.distance * 1000), // meters
        distanceText: shelter.distance < 1 ? 
          `${Math.round(shelter.distance * 1000)}m` : 
          `${shelter.distance.toFixed(1)}km`,
        capacity: shelter.capacity,
        lat: shelter.lat,
        lng: shelter.lng,
        description: shelter.description
      })),
      totalSheltersInArea: skyddsrumWithDistance.filter(s => s.distance <= 2).length, // inom 2km
      searchRadius: '2km'
    };

    // Logga för debugging
    console.log(`🔍 Sök från (${lat}, ${lng})`);
    console.log(`📍 Närmaste skyddsrum: ${nearestShelters[0].name} - ${nearestShelters[0].distance.toFixed(3)}km`);
    console.log(`📊 Totalt ${nearestShelters.length} skyddsrum returnerade`);
    
    res.json(response);
  } catch (error) {
    console.error('Fel vid beräkning av avstånd:', error);
    res.status(500).json({ error: 'Serverfel vid beräkning av avstånd' });
  }
});

// API endpoint för att få skyddsrum per kommun
app.get('/api/shelters/municipality/:municipality', async (req, res) => {
  try {
    const { municipality } = req.params;
    const skyddsrumData = await getSkyddsrumData();
    
    const filteredShelters = skyddsrumData.filter(shelter => 
      shelter.municipality && 
      shelter.municipality.toLowerCase().includes(municipality.toLowerCase())
    );
    
    res.json(filteredShelters);
  } catch (error) {
    console.error('Fel vid hämtning av skyddsrum per kommun:', error);
    res.status(500).json({ error: 'Serverfel vid hämtning av skyddsrum' });
  }
});

// API endpoint för att få alla skyddsrum
app.get('/api/shelters', async (req, res) => {
  console.log('🏠 /api/shelters endpoint called');
  try {
    const skyddsrumData = await getSkyddsrumData();
    console.log(`📊 Returning ${skyddsrumData.length} shelters`);
    res.json(skyddsrumData);
  } catch (error) {
    console.error('❌ Error in /api/shelters:', error);
    res.status(500).json({ error: 'Serverfel vid hämtning av skyddsrum' });
  }
});

// API endpoint för att få alla kommuner
app.get('/api/municipalities', async (req, res) => {
  try {
    const skyddsrumData = await getSkyddsrumData();
    const municipalities = [...new Set(skyddsrumData.map(shelter => shelter.municipality))];
    res.json(municipalities.sort());
  } catch (error) {
    console.error('Fel vid hämtning av kommuner:', error);
    res.status(500).json({ error: 'Serverfel vid hämtning av kommuner' });
  }
});

// API endpoint för att uppdatera cache manuellt
app.post('/api/refresh-data', async (req, res) => {
  try {
    console.log('🔄 Manuell uppdatering av skyddsrum data...');
    skyddsrumCache = await fetchSkyddsrumFromMSB();
    lastCacheUpdate = Date.now();
    
    res.json({ 
      message: 'Data uppdaterad från MSB', 
      count: skyddsrumCache.length,
      timestamp: new Date().toISOString(),
      region: 'Stockholms län'
    });
  } catch (error) {
    console.error('Fel vid manuell uppdatering:', error);
    res.status(500).json({ error: 'Fel vid uppdatering av data' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    dataSource: 'MSB öppen data',
    region: 'Stockholms län',
    municipalities: STOCKHOLM_MUNICIPALITIES.length,
    cacheAge: Date.now() - lastCacheUpdate,
    shelterCount: skyddsrumCache.length
  });
});

// Test endpoint för att se om servern fungerar
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint called');
  res.json({ message: 'Server fungerar!', timestamp: new Date().toISOString() });
});

// Ladda initial data vid server start
async function initializeServer() {
  console.log('🚀 Startar server för Stockholms län...');
  console.log('📡 Hämtar initial data från MSB...');
  console.log(`🏛️ Inkluderar ${STOCKHOLM_MUNICIPALITIES.length} kommuner:`, STOCKHOLM_MUNICIPALITIES.join(', '));
  
  try {
    console.log('⏳ Calling getSkyddsrumData()...');
    await getSkyddsrumData();
    console.log('✅ Data loading completed successfully');
  } catch (error) {
    console.error('❌ Error during data loading:', error);
  }

  // Servera React build i produktion - EFTER alla API routes
  if (process.env.NODE_ENV === 'production') {
    console.log('🏭 Production mode detected - setting up static file serving');
    
    // Check if build directory exists
    const buildPath = path.join(__dirname, 'client/build');
    const indexPath = path.join(buildPath, 'index.html');
    console.log('📂 Build directory path:', buildPath);
    console.log('📄 Index file path:', indexPath);
    
    try {
      const fs = require('fs');
      if (fs.existsSync(buildPath)) {
        console.log('✅ Build directory exists');
        if (fs.existsSync(indexPath)) {
          console.log('✅ Index.html exists');
        } else {
          console.log('❌ Index.html NOT found!');
        }
      } else {
        console.log('❌ Build directory NOT found!');
      }
    } catch (err) {
      console.error('❌ Error checking build files:', err);
    }
    
    // Servera statiska filer från client/build
    app.use(express.static(path.join(__dirname, 'client/build')));
    console.log('📁 Static files middleware configured');
    
    // Catch-all handler: skicka tillbaka React's index.html fil för alla icke-API routes
    app.get('*', (req, res) => {
      console.log('🔄 Catch-all route triggered for:', req.path);
      const indexFile = path.join(__dirname, 'client/build/index.html');
      console.log('📄 Serving index.html from:', indexFile);
      res.sendFile(indexFile);
    });
    console.log('🎯 Catch-all route configured');
  } else {
    console.log('🛠️ Development mode - no static file serving');
  }

  app.listen(PORT, () => {
    console.log('🎉 =================================');
    console.log(`🚀 Server körs på port ${PORT}`);
    console.log(`📍 Skyddsrum data laddad: ${skyddsrumCache.length} skyddsrum`);
    console.log(`🌍 Täcker hela Stockholms län`);
    console.log(`🔗 Datakälla: MSB öppen data`);
    console.log('🎉 =================================');
  });
}

// Starta servern
initializeServer();