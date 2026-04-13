/**
 * Strip fake/hardcoded comments from all post pages.
 * Removes the entire post-comments and post-comments-form sections.
 */
const fs = require('fs');
const path = require('path');

const POSTS_DIR = path.join(__dirname, '..', 'build', 'posts');
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.html'));

let fixed = 0;
for (const f of files) {
  const fp = path.join(POSTS_DIR, f);
  let html = fs.readFileSync(fp, 'utf8');
  
  if (!html.includes('Mark Stark') && !html.includes('Marina Valentine')) continue;
  
  // Remove the entire post-comments div (contains fake comments)
  html = html.replace(/<div class="post-comments"[^>]*>[\s\S]*?<\/ol>\s*<\/div>/g, '');
  
  // Remove the comment form section
  html = html.replace(/<div class="post-comments-form"[^>]*>[\s\S]*?<\/form>\s*<\/div>/g, '');
  
  // Clean up any remaining placeholder
  html = html.replace('<!-- COMMENTS_PLACEHOLDER -->', '');
  
  fs.writeFileSync(fp, html, 'utf8');
  fixed++;
  console.log(`  Stripped comments from: ${f}`);
}

console.log(`\nDone! Fixed ${fixed} posts.`);
