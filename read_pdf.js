const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('./AppBarber - Comissões 01072026 - 20072026.pdf');

pdf(dataBuffer).then(function(data) {
    fs.writeFileSync('./comissoes.txt', data.text);
    console.log("Comissões saved to comissoes.txt");
});

let dataBuffer2 = fs.readFileSync('./AppBarber - Agendamentos.pdf');

pdf(dataBuffer2).then(function(data) {
    fs.writeFileSync('./agendamentos.txt', data.text);
    console.log("Agendamentos saved to agendamentos.txt");
});
