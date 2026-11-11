// O ícone do app é o FAVICON do site. Ele pode ser PNG, JPEG, GIF, SVG ou .ico, em qualquer tamanho; a
// PWA exige PNG em 192 e 512. Aqui só a parte pura: reconhecer o formato pelos bytes e, no caso do .ico,
// extrair o maior PNG embutido (ICOs modernos guardam os quadros como PNG). Testado em icon-source.test.ts.
export type ImageKind = "png" | "jpeg" | "gif" | "svg" | "ico";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return "ico";
  const head = new TextDecoder().decode(bytes.slice(0, 512)).trimStart().toLowerCase();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg"))) return "svg";
  return null;
}

// Maior quadro PNG de um .ico. Quadro em BMP (ICO antigo) não é lido: devolve null e quem chama cai no
// ícone padrão.
export function extractPngFromIco(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 6 || !startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(4, true);
  let best: { width: number; offset: number; size: number } | null = null;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    if (entry + 16 > bytes.length) break;
    const width = bytes[entry] === 0 ? 256 : bytes[entry];
    const size = view.getUint32(entry + 8, true);
    const offset = view.getUint32(entry + 12, true);
    if (offset + size > bytes.length || !startsWith(bytes, PNG_SIGNATURE, offset)) continue;
    if (!best || width > best.width) best = { width, offset, size };
  }
  return best ? bytes.slice(best.offset, best.offset + best.size) : null;
}

const MIME: Record<Exclude<ImageKind, "ico">, string> = { png: "image/png", jpeg: "image/jpeg", gif: "image/gif", svg: "image/svg+xml" };

// PNG sem transparência (cor RGB ou cinza, sem chunk tRNS): a imagem já é um quadrado cheio e deve ocupar o
// ícone INTEIRO. Com transparência (RGBA, paleta com tRNS), SVG e GIF, o desenho é centralizado sobre a cor
// de fundo. JPEG nunca tem transparência.
export function isOpaquePng(bytes: Uint8Array): boolean {
  if (!startsWith(bytes, PNG_SIGNATURE) || bytes.length < 33) return false;
  const colorType = bytes[25];
  if (colorType === 4 || colorType === 6) return false;
  if (colorType === 3) {
    // Paleta: só é opaca se não houver tRNS antes dos dados.
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 8 <= bytes.length) {
      const length = view.getUint32(offset);
      const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
      if (type === "tRNS") return false;
      if (type === "IDAT") break;
      offset += 12 + length;
    }
  }
  return true;
}

export type IconSource = { uri: string; opaque: boolean };

// Imagem pronta para o gerador de ícones (data URI + se preenche o quadrado), ou null se o formato não for
// suportado.
export function toIconSource(bytes: Uint8Array): IconSource | null {
  const kind = sniffImage(bytes);
  if (!kind) return null;
  const source = kind === "ico" ? extractPngFromIco(bytes) : bytes;
  if (!source) return null;
  const effective: Exclude<ImageKind, "ico"> = kind === "ico" ? "png" : kind;
  return {
    uri: `data:${MIME[effective]};base64,${Buffer.from(source).toString("base64")}`,
    opaque: effective === "jpeg" || (effective === "png" && isOpaquePng(source)),
  };
}

// Muda quando o favicon muda: entra na URL dos ícones para o navegador/CDN não servir o antigo.
export function versionOf(text: string): string {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  return hash.toString(36);
}

// Revisão do DESENHO do ícone: sobe quando a forma de renderizar muda (ex.: passou a preencher o quadrado),
// para o navegador/CDN não servirem o PNG antigo da mesma URL.
const RENDER_REVISION = "2";

export function iconVersion(faviconUrl: string): string {
  return versionOf(`${faviconUrl}|r${RENDER_REVISION}`);
}
