const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imgDir = path.join(__dirname, '..', 'build', 'assets', 'img', 'news');
const files = fs.readdirSync(imgDir).filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));

async function check() {
  let bad = 0;
  for (const f of files) {
    const p = path.join(imgDir, f);
    const stat = fs.statSync(p);
    if (stat.size < 2000) { console.log('TINY: ' + f + ' (' + stat.size + 'b)'); bad++; continue; }
    try {
      const meta = await sharp(p).metadata();
      if (!meta.width || meta.width < 200) { console.log('SMALL: ' + f + ' (' + meta.width + 'x' + meta.height + ')'); bad++; continue; }
      const { data, info } = await sharp(p).resize(30, 30, { fit: 'cover' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let dark = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 15 && data[i + 1] < 15 && data[i + 2] < 15) dark++;
      }
      if (dark / (info.width * info.height) > 0.85) { console.log('BLACK: ' + f); bad++; }
    } catch (e) { console.log('CORRUPT: ' + f + ' - ' + e.message); bad++; }
  }
  console.log('\nChecked ' + files.length + ' images, ' + bad + ' bad');
}
check();
