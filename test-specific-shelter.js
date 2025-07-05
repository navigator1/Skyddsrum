#!/usr/bin/env node

/**
 * Test script to find the specific shelter being returned
 */

const fs = require('fs');
const path = require('path');

// Test coordinates from the API call
const testLat = 59.3293;
const testLng = 18.0686;

// Read the data files
const finalPath = path.join(__dirname, 'data', 'skyddsrum-stockholm-final.json');
const improvedPath = path.join(__dirname, 'data', 'skyddsrum-stockholm-improved.json');

console.log('🔍 Analyzing shelter data files...');

// Check which file exists and load data
let data = null;
let dataSource = '';

if (fs.existsSync(finalPath)) {
  data = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
  dataSource = 'final';
  console.log('📂 Using final data file');
} else if (fs.existsSync(improvedPath)) {
  data = JSON.parse(fs.readFileSync(improvedPath, 'utf8'));
  dataSource = 'improved';
  console.log('📂 Using improved data file');
} else {
  console.log('❌ No data files found');
  process.exit(1);
}

console.log(`📊 Total shelters: ${data.shelters.length}`);
console.log(`🗓️ Last updated: ${data.lastUpdated}`);
console.log(`📍 Source: ${data.source}`);

// Calculate distance function
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c * 1000; // meters
}

// Find the closest shelter
const sheltersWithDistance = data.shelters.map(shelter => ({
  ...shelter,
  distance: calculateDistance(testLat, testLng, shelter.lat, shelter.lng)
}));

// Sort by distance
sheltersWithDistance.sort((a, b) => a.distance - b.distance);

console.log('\n🎯 Closest shelters to test coordinates (59.3293, 18.0686):');
sheltersWithDistance.slice(0, 5).forEach((shelter, i) => {
  console.log(`${i + 1}. ID: ${shelter.id}`);
  console.log(`   Name: ${shelter.name}`);
  console.log(`   Address: ${shelter.address}`);
  console.log(`   Municipality: ${shelter.municipality}`);
  console.log(`   Distance: ${Math.round(shelter.distance)}m`);
  console.log(`   Coordinates: ${shelter.lat}, ${shelter.lng}`);
  console.log(`   Capacity: ${shelter.capacity}`);
  console.log('');
});

// Look for the specific shelter ID from the API response
const targetId = '01JZ9A9SGN08R97TGTKGD5YY3C';
const targetShelter = data.shelters.find(s => s.id === targetId);

if (targetShelter) {
  console.log(`🎯 Found target shelter ${targetId}:`);
  console.log(`   Name: ${targetShelter.name}`);
  console.log(`   Address: ${targetShelter.address}`);
  console.log(`   Municipality: ${targetShelter.municipality}`);
  console.log(`   Coordinates: ${targetShelter.lat}, ${targetShelter.lng}`);
  console.log(`   Distance: ${Math.round(calculateDistance(testLat, testLng, targetShelter.lat, targetShelter.lng))}m`);
} else {
  console.log(`❌ Target shelter ${targetId} not found in ${dataSource} data`);
}

// Check for text encoding issues
console.log('\n🔍 Checking for text encoding issues...');
const problematicShelters = data.shelters.filter(s => 
  s.address && s.address.includes('?')
);

if (problematicShelters.length > 0) {
  console.log(`⚠️ Found ${problematicShelters.length} shelters with text encoding issues`);
  problematicShelters.slice(0, 5).forEach((shelter, i) => {
    console.log(`${i + 1}. ${shelter.name} - ${shelter.address}`);
  });
} else {
  console.log('✅ No text encoding issues found');
}
