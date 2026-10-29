const fs = require('node:fs');
const path = require('node:path');
const sharp = require(process.argv[2] || 'sharp');
const output = 'C:/Users/91730/Downloads/AE-Play-Store-Package';
async function main() {
  fs.mkdirSync(output, { recursive: true });
  const logo = fs.readFileSync(path.join(__dirname, '../public/logo.png')).toString('base64');
  const mark = `<image href="data:image/png;base64,${logo}" x="64" y="142" width="384" height="228"/>`;
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#eef7ff"/>${mark}</svg>`)).ensureAlpha().png().toFile(path.join(output, 'play-icon-512.png'));
  const graphic = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#e9f6ff"/><stop offset="1" stop-color="#dbe5ff"/></linearGradient></defs><rect width="1024" height="500" fill="url(#bg)"/><circle cx="955" cy="25" r="210" fill="#bacfff" opacity=".4"/><circle cx="980" cy="480" r="160" fill="#c6f2ed"/><image href="data:image/png;base64,${logo}" x="86" y="89" width="240" height="145"/><text x="86" y="298" fill="#071a49" font-size="46" font-weight="700" font-family="Segoe UI, sans-serif">Where customers meet</text><text x="86" y="355" fill="#071a49" font-size="46" font-weight="700" font-family="Segoe UI, sans-serif">businesses and beyond</text><text x="88" y="411" fill="#345388" font-size="25" font-family="Segoe UI, sans-serif">Discover shops. Earn points. Explore offers.</text></svg>`;
  await sharp(Buffer.from(graphic)).removeAlpha().png().toFile(path.join(output, 'feature-graphic-1024x500.png'));
  for (const name of ['play-icon-512.png', 'feature-graphic-1024x500.png']) {
    const meta = await sharp(path.join(output, name)).metadata();
    console.log(`${name}: ${meta.width}x${meta.height}, ${meta.channels} channels`);
  }
}
main().catch(error => { console.error(error.message); process.exit(1); });
