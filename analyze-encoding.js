#!/usr/bin/env node

/**
 * Analyze text encoding issues in detail
 */

const fs = require('fs');
const path = require('path');

// Read the improved data
const improvedPath = path.join(__dirname, 'data', 'skyddsrum-stockholm-improved.json');
const data = JSON.parse(fs.readFileSync(improvedPath, 'utf8'));

console.log('🔍 Analyzing text encoding issues in improved data...');

// Find all addresses with ? characters
const problematicAddresses = [];
data.shelters.forEach(shelter => {
  if (shelter.address && shelter.address.includes('?')) {
    problematicAddresses.push(shelter.address);
  }
});

console.log(`📊 Found ${problematicAddresses.length} addresses with ? characters`);

// Get unique problematic patterns
const uniqueProblems = [...new Set(problematicAddresses)];
console.log(`🔍 Unique problematic address patterns: ${uniqueProblems.length}`);

// Show first 20 examples
console.log('\n📝 Examples of problematic addresses:');
uniqueProblems.slice(0, 20).forEach((addr, i) => {
  console.log(`${i + 1}. ${addr}`);
});

// Look for specific patterns
console.log('\n🔍 Analyzing specific patterns:');
const patterns = {
  'Lantm?taren': uniqueProblems.filter(addr => addr.includes('Lantm?taren')),
  'Bj?rnen': uniqueProblems.filter(addr => addr.includes('Bj?rnen')),
  'N?ckebro': uniqueProblems.filter(addr => addr.includes('N?ckebro')),
  'N?ckstr?m': uniqueProblems.filter(addr => addr.includes('N?ckstr?m')),
  'K?ping': uniqueProblems.filter(addr => addr.includes('K?ping')),
  'S?der': uniqueProblems.filter(addr => addr.includes('S?der')),
  'other_?': uniqueProblems.filter(addr => addr.includes('?') && 
    !addr.includes('Lantm?taren') && !addr.includes('Bj?rnen') && 
    !addr.includes('N?ckebro') && !addr.includes('N?ckstr?m') &&
    !addr.includes('K?ping') && !addr.includes('S?der'))
};

Object.entries(patterns).forEach(([pattern, addresses]) => {
  if (addresses.length > 0) {
    console.log(`${pattern}: ${addresses.length} addresses`);
    addresses.slice(0, 3).forEach(addr => console.log(`  - ${addr}`));
  }
});
