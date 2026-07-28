const fs = require('fs');
const PDFParser = require("pdf2json");

let pdfParser = new PDFParser(this, 1);

pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
pdfParser.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("./comissoes.txt", pdfParser.getRawTextContent());
    console.log("comissoes done");
});

pdfParser.loadPDF("./AppBarber - Comissões 01072026 - 20072026.pdf");

let pdfParser2 = new PDFParser(this, 1);
pdfParser2.on("pdfParser_dataReady", pdfData => {
    fs.writeFileSync("./agendamentos.txt", pdfParser2.getRawTextContent());
    console.log("agendamentos done");
});
pdfParser2.loadPDF("./AppBarber - Agendamentos.pdf");
