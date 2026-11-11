import { describe, expect, it } from "vitest";
import { extractPngFromIco, sniffImage, toIconDataUri, versionOf } from "./icon-source";

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (marker: number, extra = 4) => new Uint8Array([...PNG_HEAD, marker, ...new Array(extra).fill(7)]);

// ICO com N quadros: cabeçalho (6) + N entradas (16) + dados.
function ico(frames: { width: number; data: Uint8Array }[]): Uint8Array {
  const header = new Uint8Array(6 + frames.length * 16);
  const view = new DataView(header.buffer);
  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, frames.length, true);
  let offset = header.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    header[entry] = frame.width === 256 ? 0 : frame.width;
    header[entry + 1] = header[entry];
    view.setUint32(entry + 8, frame.data.length, true);
    view.setUint32(entry + 12, offset, true);
    offset += frame.data.length;
  });
  return new Uint8Array([...header, ...frames.flatMap((frame) => [...frame.data])]);
}

describe("sniffImage", () => {
  it("reconhece o formato pelos bytes (não pela extensão)", () => {
    expect(sniffImage(png(1))).toBe("png");
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(sniffImage(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39]))).toBe("gif");
    expect(sniffImage(new TextEncoder().encode('  <?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>'))).toBe("svg");
    expect(sniffImage(new TextEncoder().encode("<svg/>"))).toBe("svg");
    expect(sniffImage(ico([{ width: 16, data: png(1) }]))).toBe("ico");
    expect(sniffImage(new TextEncoder().encode("<html>"))).toBeNull();
  });
});

describe("extractPngFromIco", () => {
  it("pega o MAIOR quadro PNG", () => {
    const small = png(1);
    const big = png(2, 40);
    const result = extractPngFromIco(ico([{ width: 16, data: small }, { width: 256, data: big }, { width: 32, data: png(3) }]));
    expect(Array.from(result!)).toEqual(Array.from(big));
  });

  it("ICO só com quadros BMP (antigo) não é suportado", () => {
    expect(extractPngFromIco(ico([{ width: 16, data: new Uint8Array([40, 0, 0, 0, 1, 1]) }]))).toBeNull();
    expect(extractPngFromIco(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("toIconDataUri / versionOf", () => {
  it("PNG e ICO viram data URI de PNG; formato desconhecido, null", () => {
    expect(toIconDataUri(png(1))).toMatch(/^data:image\/png;base64,/);
    expect(toIconDataUri(ico([{ width: 32, data: png(9) }]))).toMatch(/^data:image\/png;base64,/);
    expect(toIconDataUri(new TextEncoder().encode("nada"))).toBeNull();
  });

  it("a versão muda com a URL do favicon", () => {
    expect(versionOf("/media/a.png")).toBe(versionOf("/media/a.png"));
    expect(versionOf("/media/a.png")).not.toBe(versionOf("/media/b.png"));
  });
});
