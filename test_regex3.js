const fs = require('fs');

const text = fs.readFileSync('./comissoes.txt', 'utf8');

const regex = /(Henrique\s+Botelho)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):\s*R\$\s*([\d,]+)\s+R\$\s*([\d,]+)\s+(.+?)\s+(\d+\.\d+%)\s+(.+?)\s+\d/g;

let match;
let count = 0;
while ((match = regex.exec(text)) !== null) {
    count++;
    if (count === 1) console.log(`Prof: ${match[1]}, Serv: ${match[2].trim()}, Data: ${match[3]} ${match[4]}:00, Com: ${match[5]}, Fat: ${match[6]}`);
}
console.log(`Found ${count} records in comissoes.txt`);
