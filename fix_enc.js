const fs = require('fs');
let c = fs.readFileSync('mock_output.ts', 'utf8');
c = c.replace(/ǜ/g, 'ã');
c = c.replace(/Ǹ/g, 'é');
c = c.replace(//g, 'ó');
c = c.replace(/ǜ/g, 'ã');
fs.writeFileSync('mock_output_fixed.ts', c);
