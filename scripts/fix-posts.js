const fs = require('fs');
const path = require('path');
const postsDir = path.join(__dirname, '..', 'build', 'posts');
const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));
let fixed = 0;
for (const f of files) {
  const p = path.join(postsDir, f);
  let c = fs.readFileSync(p, 'utf8');
  const orig = c;
  const bodyStart = c.indexOf('class="post__body"');
  if (bodyStart === -1) continue;
  const bodyEnd = c.indexOf('</article>', bodyStart);
  if (bodyEnd === -1) continue;
  const before = c.substring(0, bodyStart);
  let body = c.substring(bodyStart, bodyEnd);
  const after = c.substring(bodyEnd);
  // Strip width/height attributes from img tags
  body = body.replace(/<img([^>]*)\s+width="\d+"([^>]*)>/gi, '<img$1$2>');
  body = body.replace(/<img([^>]*)\s+height="\d+"([^>]*)>/gi, '<img$1$2>');
  body = body.replace(/<img([^>]*)\s+width="\d+"([^>]*)>/gi, '<img$1$2>');
  body = body.replace(/<img([^>]*)\s+height="\d+"([^>]*)>/gi, '<img$1$2>');
  // Strip srcset
  body = body.replace(/\s+srcset="[^"]*"/gi, '');
  // Strip "Advertisement" text
  body = body.replace(/<span[^>]*>[\s]*Advertisement[\s]*<\/span>/gi, '');
  body = body.replace(/\s*Advertisement\s*(?=<)/gi, '');
  c = before + body + after;
  if (c !== orig) { fs.writeFileSync(p, c, 'utf8'); fixed++; }
}
console.log('Fixed ' + fixed + ' posts');
