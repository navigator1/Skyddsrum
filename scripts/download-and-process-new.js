#!/usr/bin/env node

/**
 * Script för att ladda ner och processa skyddsrum data från MSB
 * Använder direkta datafiler från MSB istället för opålitligt WFS API
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');
const proj4 = require('proj4');

// Direkta datafil-länkar från MSB
const MSB_DATA_URLS = {
  shapefile: 'https://inspire.msb.se/nedladdning/filer/shape/Skyddsrum.zip',
  gmlCore: 'https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteCore.zip',
  gmlExtended: 'https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteExtended.zip'
};

// Koordinatsystem-definitioner
// SWEREF99 TM (EPSG:3006) - det som MSB använder
const SWEREF99_TM = '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
// WGS84 (EPSG:4326) - vanliga lat/lng koordinater
const WGS84 = '+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs';

function convertCoordinates(swerefX, swerefY) {
  try {
    const [lng, lat] = proj4(SWEREF99_TM, WGS84, [swerefX, swerefY]);
    return [lng, lat];
  } catch (error) {
    console.error('❌ Fel vid koordinat-konvertering:', error);
    return null;
  }
}

const STOCKHOLM_MUNICIPALITIES = [
  'Stockholm', 'Upplands Väsby', 'Vallentuna', 'Österåker', 'Värmdö', 'Järfälla',
  'Ekerö', 'Huddinge', 'Botkyrka', 'Salem', 'Haninge', 'Tyresö', 'Upplands-Bro',
  'Nykvarn', 'Täby', 'Danderyd', 'Sollentuna', 'Sundbyberg', 'Solna', 'Lidingö',
  'Vaxholm', 'Norrtälje', 'Sigtuna', 'Nynäshamn', 'Södertälje', 'Nacka'
];

const STOCKHOLM_BOUNDS = {
  north: 60.0,
  south: 58.7,
  east: 18.8,
  west: 17.0
};

function isWithinStockholmRegion(lat, lng) {
  return lat >= STOCKHOLM_BOUNDS.south && 
         lat <= STOCKHOLM_BOUNDS.north && 
         lng >= STOCKHOLM_BOUNDS.west && 
         lng <= STOCKHOLM_BOUNDS.east;
}

function extractMunicipality(address) {
  if (!address) return 'Okänd';
  
  const addressUpper = address.toUpperCase();
  
  for (const municipality of STOCKHOLM_MUNICIPALITIES) {
    if (addressUpper.includes(municipality.toUpperCase())) {
      return municipality;
    }
  }
  
  return 'Stockholm';
}

async function downloadShapefileData() {
  try {
    console.log('🔄 Laddar ner Shapefile från MSB...');
    console.log('🌐 URL:', MSB_DATA_URLS.shapefile);
    
    const response = await axios.get(MSB_DATA_URLS.shapefile, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Skyddsrum-Finder/1.0'
      }
    });

    console.log('✅ Shapefile nedladdad, storlek:', response.data.length, 'bytes');
    
    // Extrahera ZIP-fil
    const zip = new AdmZip(response.data);
    const zipEntries = zip.getEntries();
    
    console.log('📦 ZIP-innehåll:', zipEntries.map(e => e.entryName));
    
    // Hitta .shp och .dbf filer
    const shpEntry = zipEntries.find(e => e.entryName.endsWith('.shp'));
    const dbfEntry = zipEntries.find(e => e.entryName.endsWith('.dbf'));
    
    if (!shpEntry || !dbfEntry) {
      throw new Error('Kunde inte hitta .shp eller .dbf filer i ZIP');
    }
    
    console.log('📊 Shapefile funnen:', shpEntry.entryName);
    console.log('📊 DBF funnen:', dbfEntry.entryName);
    
    // Skapa temporära filer för shapefile-läsning
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const shpPath = path.join(tempDir, shpEntry.entryName);
    const dbfPath = path.join(tempDir, dbfEntry.entryName);
    
    // Spara även andra filer som kanske behövs (.shx, .prj, etc.)
    zipEntries.forEach(entry => {
      if (entry.entryName.includes('.')) {
        const tempPath = path.join(tempDir, entry.entryName);
        fs.writeFileSync(tempPath, entry.getData());
      }
    });
    
    console.log('📁 Temporära filer skapade');
    
    // Läs shapefile
    const features = [];
    const source = await shapefile.open(shpPath);
    
    let result = await source.read();
    while (!result.done) {
      if (result.value) {
        features.push(result.value);
      }
      result = await source.read();
    }
    
    console.log(`📥 Läste ${features.length} features från Shapefile`);
    
    // Rensa upp temporära filer
    try {
      zipEntries.forEach(entry => {
        if (entry.entryName.includes('.')) {
          const tempPath = path.join(tempDir, entry.entryName);
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        }
      });
      console.log('🧹 Temporära filer rensade');
    } catch (cleanupError) {
      console.warn('⚠️ Kunde inte rensa alla temporära filer:', cleanupError.message);
    }
    
    return features;
    
  } catch (error) {
    console.error('❌ Fel vid nedladdning av Shapefile:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
    }
    throw error;
  }
}

async function processShapefileFeatures(features) {
  try {
    console.log('🔄 Processar Shapefile-data...');
    
    const processedShelters = features
      .filter(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return false;
        
        // Konvertera SWEREF99 TM till WGS84
        const [swerefX, swerefY] = feature.geometry.coordinates;
        const convertedCoords = convertCoordinates(swerefX, swerefY);
        
        if (!convertedCoords) return false;
        
        const [lng, lat] = convertedCoords;
        return isWithinStockholmRegion(lat, lng);
      })
      .map((feature, index) => {
        const [swerefX, swerefY] = feature.geometry.coordinates;
        const [lng, lat] = convertCoordinates(swerefX, swerefY);
        const props = feature.properties || {};
        
        // Logga några egenskaper för debugging
        if (index < 3) {
          console.log(`📊 Feature ${index + 1} properties:`, Object.keys(props));
          console.log(`📊 Feature ${index + 1} coords: SWEREF99(${swerefX}, ${swerefY}) -> WGS84(${lat}, ${lng})`);
          console.log(`📊 Feature ${index + 1} props:`, props);
        }
        
        return {
          id: props.InspireID || props.name || `msb_${index + 1}`,
          name: props.name || 'Skyddsrum',
          lat: lat,
          lng: lng,
          address: props.additional || 'Adress ej tillgänglig',
          capacity: props.numberOfOc || 'Okänd',
          type: props.serviceTyp || 'civilProtectionSite',
          description: `${props.serviceTyp || 'Skyddsrum'} - ${props.typeOfOccu || 'Civilbefolkning'}`,
          municipality: extractMunicipality(props.additional),
          owner: props.pointOfCon || 'MSB',
          status: 'Aktivt',
          inspireId: props.InspireID,
          servicelevel: props.serviceLev,
          typeOfOccupancy: props.typeOfOccu,
          lastUpdated: new Date().toISOString()
        };
      });

    console.log(`✅ Processade ${processedShelters.length} skyddsrum i Stockholms län`);
    return processedShelters;
    
  } catch (error) {
    console.error('❌ Fel vid processning av Shapefile-data:', error);
    throw error;
  }
}

async function downloadAndProcessData() {
  try {
    console.log('🚀 Startar nedladdning av skyddsrum-data från MSB...');
    
    // Steg 1: Ladda ner Shapefile
    const features = await downloadShapefileData();
    
    // Steg 2: Processa data
    const processedShelters = await processShapefileFeatures(features);

    // Steg 3: Spara till JSON-fil
    const outputPath = path.join(__dirname, '../data/skyddsrum-stockholm.json');
    
    // Skapa data-mapp om den inte finns
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputData = {
      lastUpdated: new Date().toISOString(),
      source: 'MSB Shapefile',
      sourceUrl: MSB_DATA_URLS.shapefile,
      region: 'Stockholms län',
      count: processedShelters.length,
      municipalities: STOCKHOLM_MUNICIPALITIES,
      bounds: STOCKHOLM_BOUNDS,
      shelters: processedShelters
    };

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 Sparade ${processedShelters.length} skyddsrum till ${outputPath}`);

    // Spara även en kompakt version
    const compactPath = path.join(__dirname, '../data/skyddsrum-stockholm.min.json');
    fs.writeFileSync(compactPath, JSON.stringify(outputData));
    console.log(`💾 Sparade kompakt version till ${compactPath}`);

    // Visa statistik
    const municipalityStats = processedShelters.reduce((acc, shelter) => {
      acc[shelter.municipality] = (acc[shelter.municipality] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 Statistik per kommun:');
    Object.entries(municipalityStats)
      .sort(([,a], [,b]) => b - a)
      .forEach(([municipality, count]) => {
        console.log(`  ${municipality}: ${count} skyddsrum`);
      });

    return processedShelters;

  } catch (error) {
    console.error('❌ Fel vid nedladdning:', error);
    throw error;
  }
}

// Kör om scriptet körs direkt
if (require.main === module) {
  downloadAndProcessData()
    .then(data => {
      console.log('\n🎉 Klar! Data uppdaterad från MSB Shapefile.');
      console.log(`📊 Totalt ${data.length} skyddsrum laddade`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Misslyckades:', error);
      process.exit(1);
    });
}

module.exports = { downloadAndProcessData };
