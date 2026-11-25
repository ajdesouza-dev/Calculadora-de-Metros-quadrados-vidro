const assert = require("assert");
const {
  CATEGORIES,
  roundMm,
  pieceAreaM2,
  normalizeText,
  classifyMaterial,
  computeTotals,
  parseWebGlassText,
} = require("../engine.js");

function test(name, fn) {
  try {
    fn();
    console.log("PASS", name);
  } catch (err) {
    console.error("FAIL", name);
    console.error(err.message);
    process.exitCode = 1;
  }
}

test("CATEGORIES has 11 entries in spec order", () => {
  assert.strictEqual(CATEGORIES.length, 11);
  assert.deepStrictEqual(
    CATEGORIES.map((c) => c.id),
    [
      "incolor-6",
      "incolor-8",
      "incolor-10",
      "fume-6",
      "fume-8",
      "fume-10",
      "verde-6",
      "verde-8",
      "verde-10",
      "espelho-3",
      "espelho-4-bisote",
    ]
  );
});

test("roundMm rounds up to next 50 mm", () => {
  assert.strictEqual(roundMm(301), 350);
  assert.strictEqual(roundMm(1490), 1500);
  assert.strictEqual(roundMm(2128), 2150);
  assert.strictEqual(roundMm(2123), 2150);
  assert.strictEqual(roundMm(170), 200);
  assert.strictEqual(roundMm(1155), 1200);
  assert.strictEqual(roundMm(1045), 1050);
  assert.strictEqual(roundMm(2163), 2200);
  assert.strictEqual(roundMm(2155), 2200);
});

test("roundMm keeps exact multiples of 50", () => {
  assert.strictEqual(roundMm(1000), 1000);
  assert.strictEqual(roundMm(50), 50);
  assert.strictEqual(roundMm(0), 0);
});

test("pieceAreaM2 uses billed sides in meters times qty", () => {
  const a = pieceAreaM2(301, 1490, 1);
  assert.strictEqual(a.widthBilled, 350);
  assert.strictEqual(a.heightBilled, 1500);
  assert.strictEqual(a.m2, 0.525);

  const b = pieceAreaM2(1000, 2128, 1);
  assert.strictEqual(b.widthBilled, 1000);
  assert.strictEqual(b.heightBilled, 2150);
  assert.strictEqual(b.m2, 2.15);

  const c = pieceAreaM2(170, 2123, 2);
  assert.strictEqual(c.widthBilled, 200);
  assert.strictEqual(c.heightBilled, 2150);
  assert.strictEqual(c.m2, 0.86);
});

test("normalizeText uppercases and strips accents", () => {
  assert.strictEqual(normalizeText("Matéria-prima"), "MATERIA-PRIMA");
  assert.strictEqual(normalizeText("Fumê"), "FUME");
});

test("classifyMaterial maps WebGlass materia-prima strings", () => {
  assert.strictEqual(classifyMaterial("CRISTAL INCOLOR 08 MM"), "incolor-8");
  assert.strictEqual(classifyMaterial("CRISTAL INCOLOR 8 MM"), "incolor-8");
  assert.strictEqual(classifyMaterial("VIDRO INCOLOR 6MM"), "incolor-6");
  assert.strictEqual(classifyMaterial("INCOLOR 10 MM"), "incolor-10");
  assert.strictEqual(classifyMaterial("FUME 06 MM"), "fume-6");
  assert.strictEqual(classifyMaterial("CRISTAL FUME 8 MM"), "fume-8");
  assert.strictEqual(classifyMaterial("VIDRO FUME 10MM"), "fume-10");
  assert.strictEqual(classifyMaterial("VERDE 6 MM"), "verde-6");
  assert.strictEqual(classifyMaterial("CRISTAL VERDE 08 MM"), "verde-8");
  assert.strictEqual(classifyMaterial("VERDE 10 MM"), "verde-10");
  assert.strictEqual(classifyMaterial("ESPELHO CRISTAL 3 MM"), "espelho-3");
  assert.strictEqual(classifyMaterial("ESPELHO CRISTAL 4 MM COM BISOTE"), "espelho-4-bisote");
  assert.strictEqual(classifyMaterial("ALUMINIO PRETO"), "nao-classificado");
  assert.strictEqual(classifyMaterial(""), "nao-classificado");
});

test("ERICA eight pieces total 17.100 m2 in incolor-8", () => {
  const dims = [
    [1000, 2128],
    [170, 2123],
    [1155, 2163],
    [1045, 2163],
    [1045, 2163],
    [1155, 2155],
    [1045, 2155],
    [1045, 2155],
  ];
  const pieces = dims.map((d, i) => ({
    id: String(i),
    client: "180 - ERICA",
    categoryId: "incolor-8",
    qty: 1,
    widthMm: d[0],
    heightMm: d[1],
    source: "pdf",
    fileName: "180 - ERICA-1.pdf",
  }));
  const totals = computeTotals(pieces, { "incolor-8": 100 });
  assert.strictEqual(totals.totalM2, 17.1);
  assert.strictEqual(totals.totalPay, 1710);
  assert.strictEqual(totals.byCategory["incolor-8"].m2, 17.1);
  assert.strictEqual(totals.byCategory["incolor-8"].pay, 1710);
  assert.strictEqual(totals.byClient.length, 1);
  assert.strictEqual(totals.byClient[0].client, "180 - ERICA");
  assert.strictEqual(totals.byClient[0].m2, 17.1);
});

test("computeTotals skips unclassified from pay and sorts clients by SN", () => {
  const pieces = [
    {
      id: "b",
      client: "153 - MARIA",
      categoryId: "incolor-10",
      qty: 1,
      widthMm: 1000,
      heightMm: 1000,
      source: "manual",
      fileName: "",
    },
    {
      id: "a",
      client: "151 - ANDERSON",
      categoryId: "incolor-8",
      qty: 1,
      widthMm: 1000,
      heightMm: 1000,
      source: "pdf",
      fileName: "a.pdf",
    },
    {
      id: "c",
      client: "151 - ANDERSON",
      categoryId: "nao-classificado",
      qty: 1,
      widthMm: 500,
      heightMm: 500,
      source: "pdf",
      fileName: "a.pdf",
    },
  ];
  const totals = computeTotals(pieces, { "incolor-8": 80, "incolor-10": 120 });
  assert.strictEqual(totals.totalM2, 2);
  assert.strictEqual(totals.totalPay, 200);
  assert.strictEqual(totals.byClient[0].client, "151 - ANDERSON");
  assert.strictEqual(totals.byClient[1].client, "153 - MARIA");
  assert.strictEqual(totals.byClient[0].m2, 1);
  assert.strictEqual(totals.byClient[0].unclassifiedCount, 1);
});

const PAGE1 = `ADALBERTO JOSE DE SOUZA UCHOGA 35838461845
Rua Paschoal Gripe, 2294 Jardim Eldorado CEP: 15501097
FORNECEDOR : DIVIMAX CNPJ: 12.939.804/0001-30
Pedido Compra No.: 059104/001
PROJETO : PROJ-001301 - PORTA DE ABRIR - MEDIDA DE VÃO - 1335
AMBIENTE : SN: 180 - ERICA
MATÉRIA-PRIMA : CRISTAL INCOLOR 08 MM
RELAÇÃO DE PEÇAS
QTDE PEÇA LARGURA ALTURA
1 1 1000 2128
1X
ALUMINIO PRETO
WebGlass : 89F3E6462D259D62502514FC18E9A5BC Data/Hora : 05/11/2026 09:36`;

test("parseWebGlassText reads SN, material and piece table", () => {
  const { pieces, warnings } = parseWebGlassText(PAGE1, "180 - ERICA-1.pdf");
  assert.strictEqual(warnings.length, 0);
  assert.strictEqual(pieces.length, 1);
  assert.strictEqual(pieces[0].client, "180 - ERICA");
  assert.strictEqual(pieces[0].categoryId, "incolor-8");
  assert.strictEqual(pieces[0].qty, 1);
  assert.strictEqual(pieces[0].widthMm, 1000);
  assert.strictEqual(pieces[0].heightMm, 2128);
  assert.strictEqual(pieces[0].source, "pdf");
  assert.strictEqual(pieces[0].fileName, "180 - ERICA-1.pdf");
});

test("parseWebGlassText warns when SN is missing", () => {
  const text = `MATÉRIA-PRIMA : CRISTAL INCOLOR 08 MM
RELAÇÃO DE PEÇAS
QTDE PEÇA LARGURA ALTURA
1 1 1000 2128`;
  const { pieces, warnings } = parseWebGlassText(text, "sem-sn.pdf");
  assert.strictEqual(pieces.length, 1);
  assert.strictEqual(pieces[0].client, "SEM SN");
  assert.ok(warnings.some((w) => /SN/i.test(w)));
});

test("parseWebGlassText marks unknown material as nao-classificado", () => {
  const text = `AMBIENTE : SN: 99 - TESTE
MATÉRIA-PRIMA : TEMPERADO ESPECIAL 12 MM
RELAÇÃO DE PEÇAS
QTDE PEÇA LARGURA ALTURA
1 1 500 500`;
  const { pieces } = parseWebGlassText(text, "x.pdf");
  assert.strictEqual(pieces[0].categoryId, "nao-classificado");
});

test("parseWebGlassText warns when table is missing", () => {
  const text = `AMBIENTE : SN: 1 - A
MATÉRIA-PRIMA : CRISTAL INCOLOR 08 MM`;
  const { pieces, warnings } = parseWebGlassText(text, "vazio.pdf");
  assert.strictEqual(pieces.length, 0);
  assert.ok(warnings.length > 0);
});

test("parseWebGlassText still finds pieces when spaces replace newlines", () => {
  const flat = PAGE1.replace(/\n/g, " ");
  const { pieces } = parseWebGlassText(flat, "flat.pdf");
  assert.strictEqual(pieces.length, 1);
  assert.strictEqual(pieces[0].client, "180 - ERICA");
  assert.strictEqual(pieces[0].widthMm, 1000);
  assert.strictEqual(pieces[0].heightMm, 2128);
});

test("all eight ERICA pages parse to 17.1 m2", () => {
  const pages = [
    { sn: "180 - ERICA", w: 1000, h: 2128 },
    { sn: "180 - ERICA", w: 170, h: 2123 },
    { sn: "180 - ERICA", w: 1155, h: 2163 },
    { sn: "180 - ERICA", w: 1045, h: 2163 },
    { sn: "180 - ERICA", w: 1045, h: 2163 },
    { sn: "180 - ERICA", w: 1155, h: 2155 },
    { sn: "180 - ERICA", w: 1045, h: 2155 },
    { sn: "180 - ERICA", w: 1045, h: 2155 },
  ];
  const all = pages.flatMap((p, i) => {
    const text = `AMBIENTE : SN: ${p.sn}
MATÉRIA-PRIMA : CRISTAL INCOLOR 08 MM
RELAÇÃO DE PEÇAS
QTDE PEÇA LARGURA ALTURA
1 1 ${p.w} ${p.h}`;
    return parseWebGlassText(text, "erica.pdf p." + (i + 1)).pieces;
  });
  const totals = computeTotals(all, { "incolor-8": 100 });
  assert.strictEqual(all.length, 8);
  assert.strictEqual(totals.totalM2, 17.1);
  assert.strictEqual(totals.totalPay, 1710);
});

if (!process.exitCode) {
  console.log("ALL PASS");
}
