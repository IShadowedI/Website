/**
 * Audit post pages for quality issues:
 * - Short body text (failed scrapes)
 * - Placeholder images (samples/)
 * - Advertisement text in body
 * - Broken/missing main images
 * - Template filler text
 */
const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, '..', 'build', 'posts');
const imgDir = path.join(__dirname, '..', 'build', 'assets', 'img', 'news');

const TEMPLATE_PHRASES = [
  'Pushing the boundaries of competitive gaming',
  'every Dragon\'s Den player has the resources',
  'every Dragon\'s Shadow player has the resources',
  'Our dedication to excellence drives everything we do',
  'League of heroes presented a new character',
  'From practice to competition, every member is committed',
];

const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));
const issues = [];
const toRemove = [];

for (const f of files) {
  const c = fs.readFileSync(path.join(postsDir, f), 'utf8');
  const name = f.replace('.html', '');
  const problems = [];

  // Check body length
  const bodyStart = c.indexOf('class="post__body"');
  const bodyEnd = c.indexOf('</article>', bodyStart > 0 ? bodyStart : 0);
  if (bodyStart > 0 && bodyEnd > 0) {
    const body = c.substring(bodyStart, bodyEnd);
    const text = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length < 150) problems.push(`SHORT_BODY (${text.length} chars)`);
  }

  // Check placeholder images
  const imgM = c.match(/class="post__thumbnail">\s*<img src="([^"]+)"/);
  if (imgM && imgM[1].includes('samples/')) {
    problems.push('PLACEHOLDER_IMG');
  }

  // Check main image file exists
  if (imgM && !imgM[1].includes('samples/')) {
    const imgPath = imgM[1].replace('../', '');
    const absPath = path.join(__dirname, '..', 'build', imgPath);
    if (!fs.existsSync(absPath)) {
      problems.push('MISSING_IMG');
    } else {
      const stat = fs.statSync(absPath);
      if (stat.size < 1000) problems.push('TINY_IMG (' + stat.size + 'b)');
    }
  }

  // Check for advertisement text
  const adCount = (c.match(/Advertisement/gi) || []).length;
  if (adCount > 1) problems.push(`ADS_IN_BODY (${adCount})`);

  // Check for template filler text
  for (const phrase of TEMPLATE_PHRASES) {
    if (c.includes(phrase)) {
      problems.push('TEMPLATE_FILLER');
      break;
    }
  }

  if (problems.length > 0) {
    issues.push({ name, problems });
    // Auto-remove if short body or template filler
    if (problems.some(p => p.startsWith('SHORT_BODY') || p === 'TEMPLATE_FILLER')) {
      toRemove.push(f);
    }
  }
}

console.log(`\nAudited ${files.length} post pages`);
console.log(`Issues found in ${issues.length} articles:\n`);
issues.forEach(i => console.log(`  ${i.name}: ${i.problems.join(', ')}`));
console.log(`\nRecommend removal: ${toRemove.length}`);
toRemove.forEach(f => console.log(`  ${f}`));
