const fs = require('fs');
const t = fs.readFileSync('src/lib/performance-data.ts', 'utf8');
const matches = [...t.matchAll(/id:\s*"(mock-[^"]+)"/g)];
const ids = matches.map(m => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
const uniqueDupes = [...new Set(dupes)];
if (uniqueDupes.length === 0) {
  console.log('No duplicate IDs found!');
} else {
  console.log('Duplicate IDs:', uniqueDupes);
}
