const fs = require('fs');
let t = fs.readFileSync('src/lib/performance-data.ts', 'utf8');

// For each line with a mock id, track seen IDs and add suffix if duplicate
const lines = t.split('\n');
const seenIds = {};
const fixedLines = lines.map(line => {
  const match = line.match(/id:\s*"(mock-[^"]+)"/);
  if (!match) return line;
  const id = match[1];
  if (!seenIds[id]) {
    seenIds[id] = 0;
    return line;
  }
  seenIds[id]++;
  const newId = id + '-' + seenIds[id];
  return line.replace(`"${id}"`, `"${newId}"`);
});

const fixed = fixedLines.join('\n');
fs.writeFileSync('src/lib/performance-data.ts', fixed);

// Verify
const matches = [...fixed.matchAll(/id:\s*"(mock-[^"]+)"/g)];
const ids = matches.map(m => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('Remaining dupes after fix:', dupes.length === 0 ? 'NONE - all good!' : dupes);
