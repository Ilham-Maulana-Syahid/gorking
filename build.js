#!/usr/bin/env node
/**
 * build.js — mengubah google_Dorks.txt menjadi index.html statis (tanpa dependency).
 *
 *   node build.js
 *
 * Hasil: index.html (satu file, semua payload ter-embed, bisa dibuka offline).
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'google_Dorks.txt');
const TPL = path.join(ROOT, 'template.html');
const OUT = path.join(ROOT, 'index.html');

/** Ubah kutip "pintar" dan karakter mirip menjadi ASCII supaya Google memprosesnya benar. */
function normalizeChars(line) {
  return line
    .replace(/[\u201C\u201D\u201E\u201F\u2033\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/\u00A0/g, ' ')
    .replace(/\u2013|\u2014/g, '-');
}

/** Deteksi dork yang membutuhkan/normalnya memakai target (site:). */
const needsTarget = (d) => /(^|[^a-z])site:/i.test(d);

function parseDorks(text) {
  const seen = new Set();
  const out = [];
  const stats = { skippedHeader: 0, skippedDup: 0, skippedShort: 0 };

  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;

    // Banner, judul markdown, atribusi, dan garis pemisah/section.
    if (/^[#▄█▀╗💡📌]/.test(line)) { stats.skippedHeader++; continue; }
    if (/^\*\*/.test(line)) { stats.skippedHeader++; continue; }
    if (/^[-*=]{2,}[A-Za-z ]*[-*=]*$/.test(line)) { stats.skippedHeader++; continue; }
    if (/^(A collection of|Hi there|Get the full|\[)/i.test(line)) { stats.skippedHeader++; continue; }
    if (/hackingpassion\.com|udemy\.com|BullsEye0/i.test(line)) { stats.skippedHeader++; continue; }

    // Bersihkan sisa format penulisan di file: "12. ", "keyword : ", "google = "
    line = line.replace(/^\d{1,4}[.)]\s+/, '');
    line = line.replace(/^(key\s?words?|keyworld|google)\s*[:=]\s*/i, '');
    line = normalizeChars(line);

    // Perbaiki operator yang rusak di file sumber, mis. "inurlp:hpnuke" -> "inurl:hpnuke"
    line = line.replace(
      /\b(allinurl|allintitle|allintext|inanchor|inurl|intitle|intext|filetype|ext|site|define|link|cache|related|info)p:/gi,
      '$1:'
    );
    line = line.replace(/\s+/g, ' ').trim();

    if (line.length < 2) { stats.skippedShort++; continue; }

    const key = line.toLowerCase();
    if (seen.has(key)) { stats.skippedDup++; continue; }
    seen.add(key);
    out.push(line);
  }

  return { dorks: out, stats };
}

function main() {
  if (!fs.existsSync(SRC)) {
    console.error(`File sumber tidak ditemukan: ${SRC}`);
    process.exit(1);
  }
  if (!fs.existsSync(TPL)) {
    console.error(`Template tidak ditemukan: ${TPL}`);
    process.exit(1);
  }

  const { dorks, stats } = parseDorks(fs.readFileSync(SRC, 'utf8'));
  const withTarget = dorks.filter(needsTarget).length;

  const json = JSON.stringify(dorks).replace(/</g, '\\u003c');
  const html = fs
    .readFileSync(TPL, 'utf8')
    .replace('/*__DORKS__*/[]', () => json)
    .replace('__TOTAL__', String(dorks.length))
    .replace('__WITH_TARGET__', String(withTarget))
    .replace('__BUILD_DATE__', new Date().toISOString().slice(0, 10));

  fs.writeFileSync(OUT, html, 'utf8');

  console.log(`Sumber          : ${stats.skippedHeader} baris header/pemisah dibuang`);
  console.log(`Duplikat        : ${stats.skippedDup} baris dibuang`);
  console.log(`Total dork unik : ${dorks.length}`);
  console.log(`Butuh target    : ${withTarget}`);
  console.log(`Output          : ${OUT} (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
}

main();
