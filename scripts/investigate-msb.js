#!/usr/bin/env node

/**
 * Script för att undersöka MSB's datafeed struktur och hämta skyddsrum data
 */

const axios = require('axios');
const xml2js = require('xml2js');

async function investigateMSBStructure() {
  console.log('🔍 Undersöker MSB datafeed struktur...');
  
  try {
    // Steg 1: Kolla WFS capabilities
    console.log('\n📋 1. Kollar WFS Capabilities...');
    const capabilitiesUrl = 'https://inspire.msb.se/skyddsrum/wfs?service=WFS&request=GetCapabilities';
    
    try {
      const capResponse = await axios.get(capabilitiesUrl, { timeout: 10000 });
      console.log('✅ WFS Capabilities response received');
      console.log('📊 Response size:', capResponse.data.length);
      
      // Spara till fil för analys
      require('fs').writeFileSync('wfs-capabilities.xml', capResponse.data);
      console.log('💾 Saved to wfs-capabilities.xml');
      
    } catch (capError) {
      console.log('❌ WFS Capabilities failed:', capError.message);
    }
    
    // Steg 2: Hämta sub-feed från Atom
    console.log('\n📋 2. Hämtar skyddsrum sub-feed...');
    const subFeedUrl = 'https://inspire.msb.se/nedladdning/skyddsrum.xml';
    
    try {
      const subResponse = await axios.get(subFeedUrl, { 
        timeout: 10000,
        headers: { 'User-Agent': 'Skyddsrum-Finder/1.0' }
      });
      
      console.log('✅ Sub-feed response received');
      console.log('📊 Response size:', subResponse.data.length);
      
      const parser = new xml2js.Parser();
      const subResult = await parser.parseStringPromise(subResponse.data);
      
      console.log('📊 Sub-feed structure:', JSON.stringify(subResult, null, 2));
      
      // Spara till fil för analys
      require('fs').writeFileSync('sub-feed.json', JSON.stringify(subResult, null, 2));
      console.log('💾 Saved sub-feed to sub-feed.json');
      
    } catch (subError) {
      console.log('❌ Sub-feed failed:', subError.message);
    }
    
    // Steg 3: Testa olika WFS typeName alternativ
    console.log('\n📋 3. Testar olika WFS typeName alternativ...');
    
    const typeNames = [
      'skyddsrum:Skyddsrum',
      'skyddsrum:skyddsrum', 
      'Skyddsrum',
      'skyddsrum',
      'ms:Skyddsrum',
      'msb:Skyddsrum'
    ];
    
    for (const typeName of typeNames) {
      console.log(`🧪 Testar typeName: ${typeName}`);
      
      try {
        const testUrl = 'https://inspire.msb.se/skyddsrum/wfs';
        const testResponse = await axios.get(testUrl, {
          params: {
            service: 'WFS',
            version: '2.0.0',
            request: 'GetFeature',
            typeName: typeName,
            outputFormat: 'application/json',
            maxFeatures: 1
          },
          timeout: 10000
        });
        
        console.log(`✅ ${typeName} fungerar! Status: ${testResponse.status}`);
        console.log('📊 Sample data:', JSON.stringify(testResponse.data, null, 2).substring(0, 500));
        
        // Om vi lyckas, använd denna för att hämta allt
        return { typeName, wfsUrl: testUrl };
        
      } catch (testError) {
        console.log(`❌ ${typeName} misslyckades:`, testError.response?.data?.substring(0, 200) || testError.message);
      }
    }
    
    // Steg 4: Testa andra WFS endpoints
    console.log('\n📋 4. Testar andra WFS endpoints...');
    
    const wfsEndpoints = [
      'https://inspire.msb.se/geoserver/wfs',
      'https://inspire.msb.se/wfs',
      'https://geodata.msb.se/wfs',
      'https://opendata.msb.se/wfs'
    ];
    
    for (const endpoint of wfsEndpoints) {
      console.log(`🧪 Testar endpoint: ${endpoint}`);
      
      try {
        const capUrl = `${endpoint}?service=WFS&request=GetCapabilities`;
        const capResponse = await axios.get(capUrl, { timeout: 10000 });
        
        console.log(`✅ ${endpoint} svarar! Status: ${capResponse.status}`);
        console.log('📊 Response size:', capResponse.data.length);
        
      } catch (endpointError) {
        console.log(`❌ ${endpoint} misslyckades:`, endpointError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Allmänt fel:', error);
  }
}

// Kör undersökningen
if (require.main === module) {
  investigateMSBStructure()
    .then(() => {
      console.log('\n🎉 Undersökning klar!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Undersökning misslyckades:', error);
      process.exit(1);
    });
}
