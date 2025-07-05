const axios = require('axios');

async function quickTest() {
  try {
    const response = await axios.post('http://localhost:5000/api/find-nearest', {
      lat: 59.396,
      lng: 18.036
    });
    
    const morby = response.data.nearestShelters.filter(s => 
      s.address && s.address.includes('Mörby')
    );
    
    console.log(`✅ Hittade ${morby.length} skyddsrum med korrekt "Mörby"`);
    
    if (morby.length > 0) {
      console.log(`Exempel: ${morby[0].address} (Korrekt!)`);
    }
    
    const marby = response.data.nearestShelters.filter(s => 
      s.address && s.address.includes('Märby')
    );
    
    if (marby.length > 0) {
      console.log('❌ PROBLEM: Hittade felaktiga "Märby"');
    } else {
      console.log('✅ Inga felaktiga "Märby" hittades');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

quickTest();
