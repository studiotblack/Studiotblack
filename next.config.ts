import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // tesseract.js spawna um worker_thread apontando pro seu próprio arquivo de script em
  // disco — o bundling padrão do Turbopack reescreve esse caminho e quebra a resolução
  // ("Cannot find module ...\tesseract.js\src\worker-script\node\index.js"). Precisa
  // rodar via require nativo do Node, sem bundling.
  serverExternalPackages: ["tesseract.js"],
};

export default nextConfig;
