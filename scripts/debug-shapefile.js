#!/usr/bin/env node

/**
 * Debug script för att undersöka Shapefile-strukturen
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const shapefile = require('shapefile');

const MSB_DATA_URLS = {
  shapefile: 'https://inspire.msb.se/nedladdning/filer/shape/Skyddsrum.zip'
};

async function debugShapefileStructure() {
  try {
    console.log('🔍 Undersöker Shapefile-struktur...');
    
    const response = await axios.get(MSB_DATA_URLS.shapefile, {
      timeout: 60000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Skyddsrum-Finder/1.0'
      }
    });

    const zip = new AdmZip(response.data);
    const zipEntries = zip.getEntries();
    
    const shpEntry = zipEntries.find(e => e.entryName.endsWith('.shp'));
    const dbfEntry = zipEntries.find(e => e.entryName.endsWith('.dbf'));
    
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    zipEntries.forEach(entry => {
      if (entry.entryName.includes('.')) {
        const tempPath = path.join(tempDir, entry.entryName);
        fs.writeFileSync(tempPath, entry.getData());
      }
    });
    
    const shpPath = path.join(tempDir, shpEntry.entryName);
    const source = await shapefile.open(shpPath);
    
    // Läs första 5 features för debugging
    const sampleFeatures = [];
    let result = await source.read();
    let count = 0;
    
    while (!result.done && count < 5) {
      if (result.value) {
        sampleFeatures.push(result.value);
        count++;
      }
      result = await source.read();
    }
    
    console.log('\n📊 Första 5 features:');
    sampleFeatures.forEach((feature, index) => {
      console.log(`\n--- Feature ${index + 1} ---`);
      console.log('Geometry:', feature.geometry);
      console.log('Properties keys:', Object.keys(feature.properties || {}));
      console.log('Properties:', feature.properties);
    });
    
    // Rensa upp
    zipEntries.forEach(entry => {
      if (entry.entryName.includes('.')) {
        const tempPath = path.join(tempDir, entry.entryName);
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      }
    });
    
    console.log('\n🧹 Temporära filer rensade');
    
  } catch (error) {
    console.error('❌ Fel:', error);
  }
}

debugShapefileStructure();
