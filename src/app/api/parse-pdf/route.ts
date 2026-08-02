import { NextResponse } from 'next/server';
import PDFParser from 'pdf2json';
import { normalizeProfName } from '@/lib/performance-data';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const pdfParser = new PDFParser(null as any, true);
    
    const parsedText = await new Promise<string>((resolve, reject) => {
      pdfParser.on("pdfParser_dataError", (errData: any) => reject(errData.parserError));
      pdfParser.on("pdfParser_dataReady", () => {
        resolve(pdfParser.getRawTextContent());
      });
      pdfParser.parseBuffer(buffer);
    });

    // Extrair os dados usando Regex baseado no formato de Comissões do AppBarber
    const regex = /([A-Za-zÀ-ÖØ-öø-ÿ]+(?:\s+[A-Za-zÀ-ÖØ-öø-ÿ]+)*)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}):\s*R\$\s*([\d,]+)\s+R\$\s*([\d,]+)\s+(.+?)\s+(\d+\.\d+%)\s+(.+?)\s+\d/g;
    
    const items = [];
    let match;
    while ((match = regex.exec(parsedText)) !== null) {
      // Normaliza o nome do profissional (remove espaços extras)
      const profName = normalizeProfName(match[1].replace(/\s+/g, ' ').trim());

      const servico = match[2].replace(/\s+/g, ' ').trim();
      const date = match[3];
      const hour = match[4];
      const valorComissao = parseFloat(match[5].replace(/\./g, '').replace(',', '.'));
      const valorBruto = parseFloat(match[6].replace(/\./g, '').replace(',', '.'));
      const cliente = match[9].replace(/\s+/g, ' ').trim();

      items.push({
        id: `${profName}-${servico.substring(0, 6)}-${date}-${hour}-${cliente}`.replace(/[\s\/\(\)]/g, ''),
        profissional: profName,
        item: servico,
        data: `${date} ${hour}:00`,
        valorBruto: valorBruto,
        valorComissao: valorComissao,
        cliente: cliente
      });
    }

    return NextResponse.json({ success: true, text: parsedText, items });
  } catch (error: any) {
    console.error("Erro ao fazer parse do PDF:", error);
    return NextResponse.json({ success: false, message: error.message || 'Erro desconhecido' }, { status: 500 });
  }
}
