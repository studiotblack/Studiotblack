import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawna um worker_thread apontando pro seu próprio arquivo de script em
  // disco — o bundling padrão do Turbopack reescreve esse caminho e quebra a resolução
  // ("Cannot find module ...\tesseract.js\src\worker-script\node\index.js"). Precisa
  // rodar via require nativo do Node, sem bundling.
  serverExternalPackages: ["tesseract.js"],
  // O rastreamento automático de arquivos da Vercel só inclui o que é importado via
  // require/import — o pacote de dados treinados do português (@tesseract.js-data/por) é
  // referenciado só como caminho de arquivo (langPath) dentro da rota de sincronização do
  // WhatsApp, então precisa ser incluído manualmente ou fica de fora do deploy e o OCR
  // volta a tentar baixar da CDN em produção (a causa real dos timeouts de 60s).
  outputFileTracingIncludes: {
    "/api/financeiro/whatsapp/sincronizar": ["./node_modules/@tesseract.js-data/por/**/*"],
  },
};

export default nextConfig;
