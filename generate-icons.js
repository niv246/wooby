const sharp = require('sharp');
const path = require('path');

const sizes = [192, 512];
const input = path.join(__dirname, 'client/public/logo-clean.png');

async function generate() {
  for (const size of sizes) {
    await sharp(input)
      .resize(size, size, { fit: 'contain', background: { r: 200, g: 185, b: 154, alpha: 1 } })
      .png()
      .toFile(path.join(__dirname, `client/public/icons/icon-${size}.png`));
    console.log(`Created icon-${size}.png`);
  }
}
generate();
