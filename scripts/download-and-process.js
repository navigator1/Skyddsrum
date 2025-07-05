#!/usr/bin/env node

/**
 * Script för att ladda ner och processa skyddsrum data från MSB Atom Feed
 * Kör detta script när du vill uppdatera datan
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const xml2js = require('xml2js');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');

// MSB Atom Feed URL
const MSB_ATOM_FEED_URL = 'https://inspire.msb.se/nedladdning/MSB_TopAtomFeed_skyddsrum.xml';

// Direkta datafil-länkar från MSB
const MSB_DATA_URLS = {
  shapefile: 'https://inspire.msb.se/nedladdning/filer/shape/Skyddsrum.zip',
  gmlCore: 'https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteCore.zip',
  gmlExtended: 'https://inspire.msb.se/nedladdning/filer/gml/zip/us.governmentalServiceCivilProtectionSiteExtended.zip'
};

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
    
    fs.writeFileSync(shpPath, shpEntry.getData());
    fs.writeFileSync(dbfPath, dbfEntry.getData());
    
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
    
    console.log(`� Läste ${features.length} features från Shapefile`);
    
    // Rensa upp temporära filer
    fs.unlinkSync(shpPath);
    fs.unlinkSync(dbfPath);
    
    return features;
    
  } catch (error) {
    console.error('❌ Fel vid nedladdning av Shapefile:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
    }
    throw error;
  }
}

async function findAndDownloadDataFiles(atomFeed) {
  try {
    console.log('� Letar efter datafiler i Atom Feed...');
    
    const entries = atomFeed.feed?.entry || [];
    console.log(`📊 Processing ${entries.length} entries`);
    
    let dataUrls = [];
    
    for (const entry of entries) {
      console.log('📊 Entry title:', entry.title?.[0]);
      
      // Leta efter links till datafiler
      const links = entry.link || [];
      
      for (const link of links) {
        const href = link.$.href;
        const type = link.$.type;
        const rel = link.$.rel;
        
        console.log(`🔗 Link: ${href} (type: ${type}, rel: ${rel})`);
        
        // Leta efter GeoPackage, Shapefile eller GML filer
        if (href && (
          href.includes('.gpkg') || 
          href.includes('.shp') || 
          href.includes('.gml') ||
          href.includes('.zip') ||
          type?.includes('application/geopackage') ||
          type?.includes('application/x-shapefile') ||
          type?.includes('application/gml')
        )) {
          dataUrls.push({
            url: href,
            type: type,
            rel: rel,
            title: entry.title?.[0]
          });
        }
      }
    }
    
    console.log(`📥 Found ${dataUrls.length} potential data files:`, dataUrls);
    
    // Prioritera GeoPackage, sedan Shapefile, sedan GML
    const prioritizedUrl = dataUrls.find(f => f.url.includes('.gpkg')) ||
                          dataUrls.find(f => f.url.includes('.shp')) ||
                          dataUrls.find(f => f.url.includes('.gml')) ||
                          dataUrls[0];
    
    if (!prioritizedUrl) {
      console.log('⚠️ Ingen direktlänk till datafil hittades');
      return null;
    }
    
    console.log('🎯 Använder datafil:', prioritizedUrl.url);
    
    // Om det är en ZIP-fil, ladda ner och extrahera
    if (prioritizedUrl.url.includes('.zip')) {
      console.log('📦 ZIP-fil upptäckt, laddar ner...');
      // Här skulle vi behöva implementera ZIP-hantering
      return null;
    }
    
    // För nu, returnera URL:en så vi kan använda den som WFS endpoint
    return prioritizedUrl.url;
    
  } catch (error) {
    console.error('❌ Fel vid analys av Atom Feed:', error);
    return null;
  }
}

async function downloadFromWFS(wfsUrl) {
  try {
    console.log('🔄 Använder WFS endpoint:', wfsUrl);
    
    const response = await axios.get(wfsUrl, {
      params: {
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeName: 'skyddsrum:Skyddsrum',
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        bbox: `${STOCKHOLM_BOUNDS.west},${STOCKHOLM_BOUNDS.south},${STOCKHOLM_BOUNDS.east},${STOCKHOLM_BOUNDS.north},EPSG:4326`
      },
      timeout: 30000
    });

    if (!response.data || !response.data.features) {
      throw new Error('Ingen data erhållen från WFS');
    }

    console.log(`📥 Erhöll ${response.data.features.length} features från WFS`);
    return response.data.features;
    
  } catch (error) {
    console.error('❌ Fel vid WFS-anrop:', error.message);
    throw error;
  }
}

async function downloadAndProcessData() {
  try {
    // Steg 1: Hämta och parsa Atom Feed
    const atomFeed = await parseAtomFeed();
    
    // Steg 2: Hitta datafiler i feed
    const dataUrl = await findAndDownloadDataFiles(atomFeed);
    
    let features = [];
    
    if (dataUrl) {
      // Steg 3: Ladda ner från upptäckt URL
      features = await downloadFromWFS(dataUrl);
    } else {
      // Fallback: Använd vanlig WFS
      console.log('⚠️ Använder fallback WFS endpoint');
      const fallbackUrl = 'https://inspire.msb.se/skyddsrum/wfs';
      features = await downloadFromWFS(fallbackUrl);
    }

    // Steg 4: Processa data
    const processedShelters = features
      .filter(feature => {
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
          status: props.status || 'Aktivt',
          lastUpdated: new Date().toISOString()
        };
      });

    console.log(`✅ Processade ${processedShelters.length} skyddsrum i Stockholms län`);

    // Steg 5: Spara till JSON-fil
    const outputPath = path.join(__dirname, '../data/skyddsrum-stockholm.json');
    
    // Skapa data-mapp om den inte finns
    const dataDir = path.dirname(outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputData = {
      lastUpdated: new Date().toISOString(),
      source: 'MSB Atom Feed + WFS',
      region: 'Stockholms län',
      count: processedShelters.length,
      municipalities: STOCKHOLM_MUNICIPALITIES,
      atomFeedUrl: MSB_ATOM_FEED_URL,
      shelters: processedShelters
    };

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`💾 Sparade ${processedShelters.length} skyddsrum till ${outputPath}`);

    // Spara även en kompakt version
    const compactPath = path.join(__dirname, '../data/skyddsrum-stockholm.min.json');
    fs.writeFileSync(compactPath, JSON.stringify(outputData));
    console.log(`💾 Sparade kompakt version till ${compactPath}`);

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
      console.log('🎉 Klar! Data uppdaterad från MSB Atom Feed.');
      console.log(`📊 Totalt ${data.length} skyddsrum laddade`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Misslyckades:', error);
      process.exit(1);
    });
}

module.exports = { downloadAndProcessData };
