const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Verbose logging
console.log('🔧 Starting Skyddsrum Finder Server (Static Data Version)...');
console.log('📊 Environment:', process.env.NODE_ENV || 'development');
console.log('🌐 Port:', PORT);
console.log('📁 Current directory:', __dirname);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  next();
});

// Ladda skyddsrum data från statisk JSON-fil
let skyddsrumData = null;
let dataMetadata = null;

function loadSkyddsrumData() {
  try {
    const dataPath = path.join(__dirname, 'data/skyddsrum-stockholm.json');
    console.log('📂 Loading data from:', dataPath);
    
    if (fs.existsSync(dataPath)) {
      const rawData = fs.readFileSync(dataPath, 'utf8');
      const data = JSON.parse(rawData);
      
      skyddsrumData = data.shelters || [];
      dataMetadata = {
        lastUpdated: data.lastUpdated,
        source: data.source,
        region: data.region,
        count: data.count,
        municipalities: data.municipalities
      };
      
      console.log(`✅ Loaded ${skyddsrumData.length} shelters from static data`);
      console.log(`📅 Data last updated: ${dataMetadata.lastUpdated}`);
      console.log(`📍 Region: ${dataMetadata.region}`);
      
      return true;
    } else {
      console.log('⚠️ Static data file not found, using fallback');
      return false;
    }
  } catch (error) {
    console.error('❌ Error loading static data:', error);
    return false;
  }
}

// Fallback data om statisk fil inte finns
function getFallbackData() {
  return [
    {
      id: 1,
      name: "Tunnelbanestation T-Centralen",
      lat: 59.3312,
      lng: 18.0592,
      address: "T-Centralen, 111 20 Stockholm",
      capacity: 2000,
      type: "Tunnelbanestation",
      description: "Stockholms centralstation under jorden",
      municipality: "Stockholm",
      owner: "SL",
      status: "Aktivt"
    },
    {
      id: 2,
      name: "Tunnelbanestation Östermalmstorg",
      lat: 59.3347,
      lng: 18.0738,
      address: "Östermalmstorg, 114 42 Stockholm",
      capacity: 1000,
      type: "Tunnelbanestation",
      description: "Tunnelbanestation som kan användas som skyddsrum",
      municipality: "Stockholm",
      owner: "SL",
      status: "Aktivt"
    }
  ];
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

// API endpoint för att få alla skyddsrum
app.get('/api/shelters', (req, res) => {
  console.log('🏠 /api/shelters endpoint called');
  console.log(`📊 Returning ${skyddsrumData.length} shelters`);
  res.json(skyddsrumData);
});

// API endpoint för att få alla kommuner
app.get('/api/municipalities', (req, res) => {
  console.log('🏛️ /api/municipalities endpoint called');
  const municipalities = [...new Set(skyddsrumData.map(shelter => shelter.municipality))];
  console.log(`📊 Returning ${municipalities.length} municipalities`);
  res.json(municipalities.sort());
});

// API endpoint för att få skyddsrum per kommun
app.get('/api/shelters/municipality/:municipality', (req, res) => {
  console.log(`🏛️ /api/shelters/municipality/${req.params.municipality} endpoint called`);
  const { municipality } = req.params;
  
  const filteredShelters = skyddsrumData.filter(shelter => 
    shelter.municipality && 
    shelter.municipality.toLowerCase().includes(municipality.toLowerCase())
  );
  
  console.log(`📊 Returning ${filteredShelters.length} shelters for ${municipality}`);
  res.json(filteredShelters);
});

// API endpoint för att hitta närmaste skyddsrum
app.post('/api/find-nearest', (req, res) => {
  console.log('🎯 /api/find-nearest endpoint called');
  const { lat, lng } = req.body;
  
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Latitud och longitud krävs' });
  }

  console.log(`📍 Finding nearest shelter to coordinates: ${lat}, ${lng}`);

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

  const nearest = skyddsrumWithDistance[0];
  console.log(`🎯 Found nearest shelter: ${nearest.name} (${nearest.distance.toFixed(2)} km)`);

  res.json(nearest);
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check endpoint called');
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    dataSource: dataMetadata?.source || 'Fallback data',
    region: dataMetadata?.region || 'Stockholm',
    shelterCount: skyddsrumData.length,
    dataLastUpdated: dataMetadata?.lastUpdated || 'Unknown'
  });
});

// Test endpoint för att se om servern fungerar
app.get('/test', (req, res) => {
  console.log('🧪 Test endpoint called');
  res.json({ 
    message: 'Server fungerar!', 
    timestamp: new Date().toISOString(),
    dataLoaded: skyddsrumData.length > 0,
    shelterCount: skyddsrumData.length
  });
});

// Endpoint för att manuellt ladda om data
app.post('/api/reload-data', (req, res) => {
  console.log('🔄 Manual data reload requested');
  const success = loadSkyddsrumData();
  
  if (success) {
    res.json({
      message: 'Data reloaded successfully',
      count: skyddsrumData.length,
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(500).json({
      error: 'Failed to reload data',
      timestamp: new Date().toISOString()
    });
  }
});

// Ladda initial data vid server start
async function initializeServer() {
  console.log('🚀 Initializing server...');
  
  // Ladda skyddsrum data
  const dataLoaded = loadSkyddsrumData();
  
  if (!dataLoaded) {
    console.log('⚠️ Using fallback data');
    skyddsrumData = getFallbackData();
    dataMetadata = {
      source: 'Fallback data',
      region: 'Stockholm (limited)',
      count: skyddsrumData.length,
      lastUpdated: new Date().toISOString()
    };
  }

  // Servera React build i produktion
  if (process.env.NODE_ENV === 'production') {
    console.log('🏭 Production mode - setting up static file serving');
    
    const buildPath = path.join(__dirname, 'client/build');
    const indexPath = path.join(buildPath, 'index.html');
    console.log('📂 Build directory:', buildPath);
    console.log('📄 Index file:', indexPath);
    
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
    
    app.use(express.static(path.join(__dirname, 'client/build')));
    console.log('📁 Static files configured');
    
    app.get('*', (req, res) => {
      console.log('🔄 Catch-all route for:', req.path);
      res.sendFile(path.join(__dirname, 'client/build/index.html'));
    });
    console.log('🎯 Catch-all route configured');
  } else {
    console.log('🛠️ Development mode');
  }

  app.listen(PORT, () => {
    console.log('🎉 =================================');
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📍 Loaded ${skyddsrumData.length} shelters`);
    console.log(`🌍 Region: ${dataMetadata.region}`);
    console.log(`📅 Data updated: ${dataMetadata.lastUpdated}`);
    console.log(`🔗 Source: ${dataMetadata.source}`);
    console.log('🎉 =================================');
  });
}

// Starta servern
initializeServer();
