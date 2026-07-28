const fs = require('fs');

const text = fs.readFileSync('./comissoes.txt', 'utf8');

const regex = /([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\s+R\$\s+([\d,]+)\s+R\$\s+([\d,]+)/g;

let match;
let count = 0;
while ((match = regex.exec(text)) !== null) {
    count++;
    // console.log(`Prof: ${match[1]}, Serv: ${match[2].trim()}, Data: ${match[3]}, Com: ${match[4]}, Fat: ${match[5]}`);
    if (count === 1) console.log(`Prof: ${match[1]}, Serv: ${match[2].trim()}, Data: ${match[3]}, Com: ${match[4]}, Fat: ${match[5]}`);
}
console.log(`Found ${count} records in comissoes.txt`);
