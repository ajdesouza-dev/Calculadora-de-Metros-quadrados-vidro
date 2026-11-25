(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    Object.assign(root, factory());
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  var CATEGORIES = [
    { id: "incolor-6", nome: "Vidro Incolor 6 mm" },
    { id: "incolor-8", nome: "Vidro Incolor 8 mm" },
    { id: "incolor-10", nome: "Vidro Incolor 10 mm" },
    { id: "fume-6", nome: "Vidro Fume 6 mm" },
    { id: "fume-8", nome: "Vidro Fume 8 mm" },
    { id: "fume-10", nome: "Vidro Fume 10 mm" },
    { id: "verde-6", nome: "Vidro Verde 6 mm" },
    { id: "verde-8", nome: "Vidro Verde 8 mm" },
    { id: "verde-10", nome: "Vidro Verde 10 mm" },
    { id: "espelho-3", nome: "Espelho Cristal 3 mm comum" },
    { id: "espelho-4-bisote", nome: "Espelho Cristal 4 mm com bisote" },
  ];

  function roundMm(mm) {
    var n = Number(mm) || 0;
    if (n <= 0) return 0;
    return Math.ceil(n / 50) * 50;
  }

  function pieceAreaM2(widthMm, heightMm, qty) {
    var widthBilled = roundMm(widthMm);
    var heightBilled = roundMm(heightMm);
    var q = Number(qty) || 0;
    var m2 = (widthBilled * heightBilled * q) / 1000000;
    return { widthBilled: widthBilled, heightBilled: heightBilled, m2: m2 };
  }

  function normalizeText(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
  }

  function classifyMaterial(raw) {
    var t = normalizeText(raw);
    if (!t) return "nao-classificado";
    var mmMatch = t.match(/(\d+)\s*MM/);
    var mm = mmMatch ? parseInt(mmMatch[1], 10) : null;
    var hasBisote = t.indexOf("BISOTE") !== -1;

    if (t.indexOf("ESPELHO") !== -1) {
      if (mm === 4 && hasBisote) return "espelho-4-bisote";
      if (mm === 3) return "espelho-3";
      return "nao-classificado";
    }

    var color = null;
    if (t.indexOf("INCOLOR") !== -1) color = "incolor";
    else if (t.indexOf("FUME") !== -1) color = "fume";
    else if (t.indexOf("VERDE") !== -1) color = "verde";

    if (!color || (mm !== 6 && mm !== 8 && mm !== 10)) return "nao-classificado";
    return color + "-" + mm;
  }

  function categoryName(id) {
    if (id === "nao-classificado") return "Nao classificado";
    var found = CATEGORIES.find(function (c) {
      return c.id === id;
    });
    return found ? found.nome : id;
  }

  function snSortKey(client) {
    var m = String(client || "").match(/(\d+)/);
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  }

  function emptyCat() {
    return { m2: 0, pay: 0, qty: 0 };
  }

  function computeTotals(pieces, prices) {
    prices = prices || {};
    var totalMm2 = 0;
    var totalPay = 0;
    var byCategory = {};
    var clientMap = {};

    (pieces || []).forEach(function (p) {
      var area = pieceAreaM2(p.widthMm, p.heightMm, p.qty);
      var classified = p.categoryId && p.categoryId !== "nao-classificado";
      var price = classified ? Number(prices[p.categoryId]) || 0 : 0;
      var pay = classified ? area.m2 * price : 0;
      var client = p.client || "SEM SN";

      if (!clientMap[client]) {
        clientMap[client] = {
          client: client,
          m2: 0,
          pay: 0,
          unclassifiedCount: 0,
          byCategory: {},
          pieces: [],
        };
      }
      var bucket = clientMap[client];
      bucket.pieces.push(p);

      if (!classified) {
        bucket.unclassifiedCount += 1;
        return;
      }

      totalMm2 += area.widthBilled * area.heightBilled * (Number(p.qty) || 0);
      totalPay += pay;

      if (!byCategory[p.categoryId]) byCategory[p.categoryId] = emptyCat();
      byCategory[p.categoryId].m2 += area.m2;
      byCategory[p.categoryId].pay += pay;
      byCategory[p.categoryId].qty += Number(p.qty) || 0;

      if (!bucket.byCategory[p.categoryId]) bucket.byCategory[p.categoryId] = emptyCat();
      bucket.byCategory[p.categoryId].m2 += area.m2;
      bucket.byCategory[p.categoryId].pay += pay;
      bucket.byCategory[p.categoryId].qty += Number(p.qty) || 0;
      bucket.m2 += area.m2;
      bucket.pay += pay;
    });

    var byClient = Object.keys(clientMap)
      .map(function (k) {
        return clientMap[k];
      })
      .sort(function (a, b) {
        var da = snSortKey(a.client) - snSortKey(b.client);
        if (da !== 0) return da;
        return a.client.localeCompare(b.client, "pt-BR");
      });

    return {
      totalM2: totalMm2 / 1000000,
      totalPay: totalPay,
      byCategory: byCategory,
      byClient: byClient,
    };
  }

  function parseFourNumbers(line) {
    var n = normalizeText(line).trim();
    var m = n.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (!m) return null;
    return {
      qty: parseInt(m[1], 10),
      pieceNo: parseInt(m[2], 10),
      widthMm: parseInt(m[3], 10),
      heightMm: parseInt(m[4], 10),
    };
  }

  function isPlausiblePiece(row) {
    return (
      row.qty >= 1 &&
      row.qty <= 999 &&
      row.widthMm >= 10 &&
      row.widthMm <= 10000 &&
      row.heightMm >= 10 &&
      row.heightMm <= 10000
    );
  }

  function parseWebGlassText(pageText, fileName) {
    var warnings = [];
    var pieces = [];
    var raw = String(pageText || "");
    fileName = fileName || "";

    var snMatch = raw.match(/SN:\s*(\d+)\s*[-–]\s*([^\n\r]+)/i);
    var client = "SEM SN";
    if (snMatch) {
      var name = snMatch[2].trim().replace(/\s*MAT[EÉ]RIA-PRIMA.*$/i, "").trim();
      client = snMatch[1] + " - " + name;
    } else {
      warnings.push("Pagina sem SN em " + fileName);
    }

    var matMatch = raw.match(/MAT[EÉ]RIA-PRIMA\s*:\s*([^\n\r]+)/i);
    var material = matMatch ? matMatch[1].trim() : "";
    var categoryId = classifyMaterial(material);

    var lines = raw.split(/\r?\n/);
    var inTable = false;
    var seenHeader = false;
    var i;
    for (i = 0; i < lines.length; i++) {
      var nline = normalizeText(lines[i]);
      if (/RELACAO DE PECAS/.test(nline)) {
        inTable = true;
        continue;
      }
      if (!inTable) continue;
      if (/QTDE/.test(nline) && /LARGURA/.test(nline)) {
        seenHeader = true;
        continue;
      }
      var row = parseFourNumbers(lines[i]);
      if (row && isPlausiblePiece(row)) {
        seenHeader = true;
        pieces.push({
          id: fileName + "-" + pieces.length + "-" + i,
          client: client,
          categoryId: categoryId,
          qty: row.qty,
          widthMm: row.widthMm,
          heightMm: row.heightMm,
          source: "pdf",
          fileName: fileName,
        });
        continue;
      }
      if (pieces.length > 0) break;
    }

    if (pieces.length === 0) {
      var norm = normalizeText(raw);
      var tableIdx = norm.search(/RELACAO DE PECAS/);
      if (tableIdx === -1) {
        warnings.push("Pagina sem RELACAO DE PECAS em " + fileName);
        return { pieces: pieces, warnings: warnings };
      }
      var after = norm.slice(tableIdx);
      var headerIdx = after.search(/LARGURA\s+ALTURA/);
      var slice = headerIdx >= 0 ? after.slice(headerIdx) : after;
      var re = /(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/g;
      var m;
      while ((m = re.exec(slice))) {
        var fallback = {
          qty: parseInt(m[1], 10),
          widthMm: parseInt(m[3], 10),
          heightMm: parseInt(m[4], 10),
        };
        if (!isPlausiblePiece(fallback)) continue;
        pieces.push({
          id: fileName + "-f-" + pieces.length,
          client: client,
          categoryId: categoryId,
          qty: fallback.qty,
          widthMm: fallback.widthMm,
          heightMm: fallback.heightMm,
          source: "pdf",
          fileName: fileName,
        });
      }
    }

    if (pieces.length === 0) {
      warnings.push("Nenhuma peca encontrada em " + fileName);
    }

    return { pieces: pieces, warnings: warnings };
  }

  return {
    CATEGORIES: CATEGORIES,
    roundMm: roundMm,
    pieceAreaM2: pieceAreaM2,
    normalizeText: normalizeText,
    classifyMaterial: classifyMaterial,
    categoryName: categoryName,
    computeTotals: computeTotals,
    parseWebGlassText: parseWebGlassText,
  };
});
