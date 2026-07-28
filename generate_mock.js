const fs = require('fs');

const text = fs.readFileSync('./comissoes.txt', 'utf8');
const regex = /(Henrique\s+Botelho)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):\s*R\$\s*([\d,]+)\s+R\$\s*([\d,]+)\s+(.+?)\s+(\d+\.\d+%)\s+(.+?)\s+\d/g;

const items = [];
let match;
while ((match = regex.exec(text)) !== null) {
    const profName = 'Henrique Botelho';
    const servico = match[2].replace(/\s+/g, ' ').trim();
    const date = match[3];
    const hour = match[4];
    const valorComissao = parseFloat(match[5].replace(/\./g, '').replace(',', '.'));
    const valorBruto = parseFloat(match[6].replace(/\./g, '').replace(',', '.'));
    const cliente = match[9].replace(/\s+/g, ' ').trim();

    items.push(`  { id: "mock-${date.replace(/\//g, '')}-${hour}-${cliente.substring(0, 3)}", profissional: "${profName}", data: "${date} ${hour}:00", cliente: "${cliente}", item: "${servico}", valorBruto: ${valorBruto}, valorComissao: ${valorComissao} }`);
}

const mockDataCode = `export const mockPdfData: DesempenhoProfissional[] = [\n${items.join(',\n')}\n];`;
fs.writeFileSync('./mock_output.ts', mockDataCode);
console.log("mock_output.ts generated");
