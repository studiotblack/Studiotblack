const xlsx = require('xlsx');
const wb = xlsx.readFile('./AppBarber  Comissões.xlsx');
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(ws, { defval: '' });

// Print column names
console.log('=== COLUMNS ===');
console.log(Object.keys(rows[0]));

// Print first 5 rows
console.log('\n=== FIRST 5 ROWS ===');
rows.slice(0, 5).forEach((row, i) => {
  console.log(`--- Row ${i+1} ---`);
  Object.entries(row).forEach(([k, v]) => console.log(`  "${k}": "${v}"`));
});
