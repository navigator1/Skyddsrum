#!/usr/bin/env node

/**
 * Test API för att hitta skyddsrum nära Dragonvägen 4, Upplands Väsby
 */

const axios = require('axios');

// Koordinater för Dragonvägen 4, Upplands Väsby (ungefär)
const TEST_COORDINATES = {
  lat: 59.5186,
  lng: 17.9114
};

async function testAPI() {
  try {
    console.log('🔍 Testar API för Dragonvägen 4, Upplands Väsby');
    console.log(`📍 Koordinater: ${TEST_COORDINATES.lat}, ${TEST_COORDINATES.lng}`);
    
    const response = await axios.post('http://localhost:5000/api/find-nearest', {
      lat: TEST_COORDINATES.lat,
      lng: TEST_COORDINATES.lng,
      limit: 10
    });
    
    console.log('\n✅ API-respons:');
    console.log(`📊 Totalt ${response.data.nearestShelters.length} skyddsrum hittades`);
    console.log(`📊 ${response.data.totalSheltersInArea} skyddsrum inom 2km`);
    
    console.log('\n🏠 Närmaste skyddsrum:');
    response.data.nearestShelters.forEach((shelter, index) => {
      console.log(`${index + 1}. ${shelter.name}`);
      console.log(`   📍 Adress: ${shelter.address}`);
      console.log(`   📏 Avstånd: ${shelter.distanceText}`);
      console.log(`   🏛️ Kommun: ${shelter.municipality}`);
      console.log(`   👥 Kapacitet: ${shelter.capacity} personer`);
      console.log(`   🎯 Koordinater: ${shelter.lat.toFixed(6)}, ${shelter.lng.toFixed(6)}`);
      console.log('');
    });
    
    // Kontrollera om det finns skyddsrum i Upplands Väsby
    const uppsala = response.data.nearestShelters.filter(s => s.municipality === 'Upplands Väsby');
    if (uppsala.length > 0) {
      console.log(`✅ Hittade ${uppsala.length} skyddsrum i Upplands Väsby`);
    } else {
      console.log('❌ Inga skyddsrum hittades i Upplands Väsby');
    }
    
  } catch (error) {
    console.error('❌ Fel vid API-test:', error.message);
    if (error.response) {
      console.error('❌ Response status:', error.response.status);
      console.error('❌ Response data:', error.response.data);
    }
  }
}

// Testa även med GPS-koordinater för Upplands Väsby centrum
async function testGPSCoordinates() {
  console.log('\n🛰️ Testar med GPS-koordinater för Upplands Väsby centrum');
  
  try {
    const response = await axios.post('http://localhost:5000/api/find-nearest', {
      lat: 59.5186,
      lng: 17.9114,
      limit: 5
    });
    
    console.log('\n📱 GPS-test resultat:');
    response.data.nearestShelters.slice(0, 3).forEach((shelter, index) => {
      console.log(`${index + 1}. ${shelter.name} (${shelter.distanceText})`);
      console.log(`   📍 ${shelter.address}, ${shelter.municipality}`);
    });
    
  } catch (error) {
    console.error('❌ GPS-test misslyckades:', error.message);
  }
}

// Kör tester
testAPI().then(() => {
  return testGPSCoordinates();
}).then(() => {
  console.log('\n🎉 Alla tester klara!');
}).catch(error => {
  console.error('❌ Test misslyckades:', error);
});
