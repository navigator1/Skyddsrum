const axios = require('axios');

console.log('🔍 Testar textkodning i data...');

async function testTextEncoding() {
  try {
    const response = await axios.post('http://localhost:5000/api/find-nearest', {
      lat: 59.52,  // Mörby-området i Vallentuna/Täby
      lng: 18.11
    });
    
    console.log('\n📊 Söker efter skyddsrum nära Mörby...');
    
    // Leta efter adresser med Mörby
    const morbyResults = response.data.nearestShelters.filter(shelter => 
      shelter.address && shelter.address.includes('Mörby')
    );
    
    if (morbyResults.length > 0) {
      console.log('✅ Hittade skyddsrum med korrekt "Mörby":');
      morbyResults.slice(0, 3).forEach((shelter, i) => {
        console.log(`  ${i + 1}. ${shelter.name}`);
        console.log(`     📍 ${shelter.address}`);
        console.log(`     🏛️ ${shelter.municipality}`);
        console.log(`     📏 ${shelter.distance.toFixed(0)}m bort`);
        console.log();
      });
    } else {
      console.log('❌ Inga skyddsrum med "Mörby" hittades');
    }
    
    // Kontrollera att det inte finns några felaktiga "Märby"
    const marbyResults = response.data.nearestShelters.filter(shelter => 
      shelter.address && shelter.address.includes('Märby')
    );
    
    if (marbyResults.length > 0) {
      console.log('❌ PROBLEM: Hittade felaktig "Märby":');
      marbyResults.forEach((shelter, i) => {
        console.log(`  ${i + 1}. ${shelter.address} (FEL!)`);
      });
    } else {
      console.log('✅ Inga felaktiga "Märby" hittades');
    }
    
    // Leta efter andra korrekta ersättningar
    const otherCorrections = response.data.nearestShelters.filter(shelter => 
      shelter.address && (
        shelter.address.includes('Gästsalen') ||
        shelter.address.includes('Förmaket') ||
        shelter.address.includes('Väsby') ||
        shelter.address.includes('Gästvåningen')
      )
    );
    
    if (otherCorrections.length > 0) {
      console.log('\n✅ Andra korrekta textersättningar:');
      otherCorrections.slice(0, 3).forEach((shelter, i) => {
        console.log(`  ${i + 1}. ${shelter.address}`);
      });
    }
    
  } catch (error) {
    console.error('❌ API Error:', error.message);
  }
}

testTextEncoding();
