#!/usr/bin/env node

/**
 * Script för att förbättra och verifiera skyddsrum-data
 * Förbättrar namn, adresser och datakvalitet
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Läs befintlig data
const dataPath = path.join(__dirname, '../data/skyddsrum-stockholm.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

console.log('📊 Analyserar befintlig data...');
console.log(`📥 Totalt ${data.shelters.length} skyddsrum`);

// Analysera datakvalitet
const analysis = {
  emptyNames: 0,
  crypticNames: 0,
  emptyAddresses: 0,
  corruptText: 0,
  duplicateCoordinates: 0,
  municipalities: {}
};

const coordinateMap = new Map();

data.shelters.forEach((shelter, index) => {
  // Analysera namn
  if (!shelter.name || shelter.name.trim() === '') {
    analysis.emptyNames++;
  } else if (shelter.name.match(/^\d{6}-\d$/)) {
    analysis.crypticNames++;
  }
  
  // Analysera adresser
  if (!shelter.address || shelter.address.trim() === '') {
    analysis.emptyAddresses++;
  } else if (shelter.address.includes('?')) {
    analysis.corruptText++;
  }
  
  // Analysera koordinater
  const coordKey = `${shelter.lat.toFixed(6)},${shelter.lng.toFixed(6)}`;
  if (coordinateMap.has(coordKey)) {
    analysis.duplicateCoordinates++;
  } else {
    coordinateMap.set(coordKey, true);
  }
  
  // Analysera kommuner
  if (!analysis.municipalities[shelter.municipality]) {
    analysis.municipalities[shelter.municipality] = 0;
  }
  analysis.municipalities[shelter.municipality]++;
});

console.log('\n📊 Datakvalitetsanalys:');
console.log(`❌ Tomma namn: ${analysis.emptyNames}`);
console.log(`❌ Kryptiska namn: ${analysis.crypticNames}`);
console.log(`❌ Tomma adresser: ${analysis.emptyAddresses}`);
console.log(`❌ Korrupt text: ${analysis.corruptText}`);
console.log(`❌ Dubbletter av koordinater: ${analysis.duplicateCoordinates}`);

console.log('\n📊 Kommuner:');
Object.entries(analysis.municipalities)
  .sort(([,a], [,b]) => b - a)
  .forEach(([municipality, count]) => {
    console.log(`  ${municipality}: ${count} skyddsrum`);
  });

// Förbättra data
console.log('\n🔧 Förbättrar data...');

const improvedShelters = data.shelters.map((shelter, index) => {
  const improved = { ...shelter };
  
  // Förbättra namn
  if (improved.name.match(/^\d{6}-\d$/)) {
    improved.name = `Skyddsrum ${improved.name}`;
  }
  
  // Förbättra adresser
  if (improved.address) {
    // Fixa textkodning - specifika och korrekta ersättningar
    improved.address = improved.address
      // Specifika platsnamn först
      .replace(/M\?rby/g, 'Mörby')        // Mörby (inte Märby!)
      .replace(/V\?sby/g, 'Väsby')        // Väsby
      .replace(/S\?dert\?lje/g, 'Södertälje')  // Södertälje
      .replace(/K\?ping/g, 'Köping')      // Köping
      .replace(/F\?rmaket/g, 'Förmaket')  // Förmaket
      .replace(/Upplands V\?sby/g, 'Upplands Väsby')  // Upplands Väsby
      // Specifika fastighetsnamn
      .replace(/Gyllenl\?dret/g, 'Gyllenlädret')     // Gyllenlädret
      .replace(/G\?stsalen/g, 'Gästsalen')           // Gästsalen
      .replace(/G\?stv\?ningen/g, 'Gästvåningen')    // Gästvåningen
      .replace(/Herrek\?ket/g, 'Herreköket')         // Herreköket
      .replace(/Herres\?tet/g, 'Herresätet')         // Herresätet
      // Mer allmänna ersättningar (försiktiga)
      .replace(/\?nder/g, 'änder')        // -änder endings
      .replace(/\?ng/g, 'äng')            // -äng endings
      .replace(/\?ll/g, 'äll')            // -äll endings
      .replace(/\?k/g, 'ök')              // -ök patterns
      .replace(/\?s/g, 'äs')              // -äs patterns
      // Undvik generell ? -> ö ersättning för att inte förstöra andra ord
    
    // Lägg till kommun i adress om den saknas
    if (!improved.address.includes(improved.municipality) && 
        !improved.address.match(/\d{3}\s?\d{2}/) && // Redan har postnummer
        improved.municipality !== 'Stockholm') {
      improved.address = `${improved.address}, ${improved.municipality}`;
    }
  }
  
  // Förbättra beskrivning
  if (improved.description === 'civilProtectionSite - Civilbefolkning') {
    improved.description = `Skyddsrum för civilbefolkning - ${improved.capacity} platser`;
  }
  
  return improved;
});

// Förbättra kommun-mappning baserat på koordinater
console.log('\n🗺️ Förbättrar kommun-mappning...');

const KOMMUN_BOUNDS = {
  'Upplands Väsby': { north: 59.53, south: 59.50, east: 17.95, west: 17.85 },
  'Vallentuna': { north: 59.55, south: 59.50, east: 18.10, west: 17.90 },
  'Österåker': { north: 59.52, south: 59.45, east: 18.45, west: 18.15 },
  'Värmdö': { north: 59.40, south: 59.25, east: 18.45, west: 18.25 },
  'Järfälla': { north: 59.45, south: 59.40, east: 17.95, west: 17.75 },
  'Ekerö': { north: 59.35, south: 59.25, east: 17.85, west: 17.65 },
  'Huddinge': { north: 59.30, south: 59.20, east: 18.15, west: 17.95 },
  'Botkyrka': { north: 59.25, south: 59.15, east: 17.95, west: 17.75 },
  'Salem': { north: 59.25, south: 59.20, east: 17.90, west: 17.80 },
  'Haninge': { north: 59.25, south: 59.10, east: 18.25, west: 18.05 },
  'Tyresö': { north: 59.25, south: 59.20, east: 18.25, west: 18.15 },
  'Täby': { north: 59.50, south: 59.42, east: 18.15, west: 18.00 },
  'Danderyd': { north: 59.42, south: 59.39, east: 18.10, west: 18.05 },
  'Sollentuna': { north: 59.47, south: 59.42, east: 18.00, west: 17.90 },
  'Sundbyberg': { north: 59.37, south: 59.35, east: 18.00, west: 17.95 },
  'Solna': { north: 59.38, south: 59.35, east: 18.05, west: 17.95 },
  'Lidingö': { north: 59.38, south: 59.35, east: 18.15, west: 18.10 },
  'Nacka': { north: 59.35, south: 59.30, east: 18.20, west: 18.10 },
  'Vaxholm': { north: 59.43, south: 59.40, east: 18.37, west: 18.33 },
  'Norrtälje': { north: 59.85, south: 59.70, east: 18.75, west: 18.65 },
  'Sigtuna': { north: 59.65, south: 59.60, east: 17.75, west: 17.65 },
  'Nynäshamn': { north: 58.92, south: 58.88, east: 17.97, west: 17.93 },
  'Södertälje': { north: 59.22, south: 59.18, east: 17.65, west: 17.60 },
  'Upplands-Bro': { north: 59.60, south: 59.55, east: 17.70, west: 17.65 },
  'Nykvarn': { north: 59.20, south: 59.15, east: 17.70, west: 17.65 }
};

function getBetterMunicipality(lat, lng, currentMunicipality) {
  for (const [municipality, bounds] of Object.entries(KOMMUN_BOUNDS)) {
    if (lat >= bounds.south && lat <= bounds.north && 
        lng >= bounds.west && lng <= bounds.east) {
      return municipality;
    }
  }
  return currentMunicipality; // Behåll ursprunglig om ingen match
}

let municipalityImprovements = 0;
const finalShelters = improvedShelters.map(shelter => {
  const betterMunicipality = getBetterMunicipality(shelter.lat, shelter.lng, shelter.municipality);
  if (betterMunicipality !== shelter.municipality) {
    municipalityImprovements++;
    return { ...shelter, municipality: betterMunicipality };
  }
  return shelter;
});

console.log(`✅ Förbättrade ${municipalityImprovements} kommun-mappningar`);

// Spara förbättrad data
const improvedData = {
  ...data,
  shelters: finalShelters,
  lastUpdated: new Date().toISOString(),
  source: 'MSB Shapefile (Förbättrad)',
  improvements: {
    textEncoding: 'Fixat svenska tecken',
    municipalityMapping: 'Förbättrat baserat på koordinater',
    nameFormatting: 'Förbättrat namn-format',
    descriptionEnhancement: 'Förbättrat beskrivningar'
  }
};

const improvedPath = path.join(__dirname, '../data/skyddsrum-stockholm-improved.json');
fs.writeFileSync(improvedPath, JSON.stringify(improvedData, null, 2));

console.log(`\n💾 Sparade förbättrad data till ${improvedPath}`);
console.log(`📊 Totalt ${finalShelters.length} skyddsrum`);

// Visa förbättrad statistik
const improvedStats = {};
finalShelters.forEach(shelter => {
  if (!improvedStats[shelter.municipality]) {
    improvedStats[shelter.municipality] = 0;
  }
  improvedStats[shelter.municipality]++;
});

console.log('\n📊 Förbättrad kommun-statistik:');
Object.entries(improvedStats)
  .sort(([,a], [,b]) => b - a)
  .forEach(([municipality, count]) => {
    console.log(`  ${municipality}: ${count} skyddsrum`);
  });

// Testa koordinater för Upplands Väsby
console.log('\n🔍 Exempel från Upplands Väsby:');
const uppsalaVasbyShelters = finalShelters.filter(s => s.municipality === 'Upplands Väsby');
if (uppsalaVasbyShelters.length > 0) {
  uppsalaVasbyShelters.slice(0, 5).forEach((shelter, i) => {
    console.log(`  ${i + 1}. ${shelter.name} - ${shelter.address} (${shelter.lat}, ${shelter.lng})`);
  });
}
