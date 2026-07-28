const xlsx = require('xlsx');
const fs = require('fs');

const files = fs.readdirSync('./');
const target = files.find(f => f.startsWith('sistema - Taxa de'));
const wb = xlsx.readFile(target);

console.log('=== SHEETS ===');
console.log(wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
  console.log(`\n=== SHEET: ${sheetName} ===`);
  const ws = wb.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(ws, { defval: '', header: 1 });
  rows.slice(0, 5).forEach((row, i) => console.log(`Row ${i+1}:`, row));
});
