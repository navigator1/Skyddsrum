const axios = require('axios');

// Koordinater för Dragonvägen 4, Upplands Väsby
const testCoordinates = {
  lat: 59.518, // Ungefär Dragonvägen 4
  lng: 17.911  // Upplands Väsby
};

console.log('🔍 Testar API med koordinater för Dragonvägen 4, Upplands Väsby...');
console.log(`📍 Koordinater: ${testCoordinates.lat}, ${testCoordinates.lng}`);

async function testAPI() {
  try {
    const response = await axios.post('http://localhost:5000/api/find-nearest', testCoordinates);
    
    console.log('\n✅ API Response:');
    console.log(`📊 Totalt ${response.data.nearestShelters.length} skyddsrum hittades`);
    console.log(`📊 Inom ${response.data.searchRadius}km radie`);
    
    console.log('\n🎯 Närmaste 5 skyddsrum:');
    response.data.nearestShelters.slice(0, 5).forEach((shelter, i) => {
      console.log(`${i + 1}. ${shelter.name}`);
      console.log(`   📍 ${shelter.address}`);
      console.log(`   🏛️ ${shelter.municipality}`);
      console.log(`   📏 ${shelter.distance.toFixed(0)}m bort`);
      console.log(`   👥 ${shelter.capacity} platser`);
      console.log(`   🌐 ${shelter.lat}, ${shelter.lng}`);
      console.log();
    });
    
    // Kontrollera kommun-fördelning
    const municipalities = {};
    response.data.nearestShelters.forEach(shelter => {
      municipalities[shelter.municipality] = (municipalities[shelter.municipality] || 0) + 1;
    });
    
    console.log('📊 Kommun-fördelning i resultaten:');
    Object.entries(municipalities).forEach(([municipality, count]) => {
      console.log(`  ${municipality}: ${count} skyddsrum`);
    });
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

testAPI();
