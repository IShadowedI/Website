#!/usr/bin/env node
/**
 * integrate-ads.js — Place real AdSense ad units across Dragon's Shadow site
 *
 * Ad Units:
 *   Horizontal1:          3056266148
 *   Vertical1:            5825899715
 *   InArticle1:           1611322532
 *   InFeed1:              5770059391
 *   MultiplexHorizontal1: 4177776122
 *   MultiplexVertical1:   4832382245
 */

const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');
const CLIENT = 'ca-pub-5492466041818466';

// ── Ad unit HTML snippets ──

function horizontal(id) {
  return `
<!-- Ad: Horizontal -->
<div class="ds-ad-unit ds-ad-unit--horizontal">
  <ins class="adsbygoogle" style="display:block"
    data-ad-client="${CLIENT}" data-ad-slot="3056266148"
    data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function vertical() {
  return `
<!-- Ad: Vertical -->
<div class="ds-ad-unit ds-ad-unit--vertical">
  <ins class="adsbygoogle" style="display:block"
    data-ad-client="${CLIENT}" data-ad-slot="5825899715"
    data-ad-format="auto" data-full-width-responsive="true"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function inArticle() {
  return `
<!-- Ad: In-Article -->
<div class="ds-ad-unit ds-ad-unit--in-article">
  <ins class="adsbygoogle" style="display:block; text-align:center"
    data-ad-layout="in-article" data-ad-format="fluid"
    data-ad-client="${CLIENT}" data-ad-slot="1611322532"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function inFeed() {
  return `
<!-- Ad: In-Feed -->
<div class="ds-ad-unit ds-ad-unit--in-feed">
  <ins class="adsbygoogle" style="display:block"
    data-ad-format="fluid" data-ad-layout-key="-fb+5w+4e-db+86"
    data-ad-client="${CLIENT}" data-ad-slot="5770059391"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function multiplexHorizontal() {
  return `
<!-- Ad: Multiplex Horizontal -->
<div class="ds-ad-unit ds-ad-unit--multiplex">
  <ins class="adsbygoogle" style="display:block"
    data-ad-format="autorelaxed"
    data-ad-client="${CLIENT}" data-ad-slot="4177776122"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

function multiplexVertical() {
  return `
<!-- Ad: Multiplex Vertical -->
<div class="ds-ad-unit ds-ad-unit--multiplex">
  <ins class="adsbygoogle" style="display:block"
    data-ad-format="autorelaxed"
    data-ad-client="${CLIENT}" data-ad-slot="4832382245"></ins>
  <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;
}

// ── Helpers ──

function stripOldAds(html) {
  // Remove old placeholder ad-slot divs
  html = html.replace(/<div class="ad-slot[^"]*"[^>]*>[\s\S]*?<\/div>\s*/g, '');
  // Remove old adsbygoogle <ins> blocks that aren't wrapped in ds-ad-unit
  // (leave the head <script> tag)
  html = html.replace(/\s*<!-- Ad:[^>]*-->\s*<ins class="adsbygoogle"[^>]*><\/ins>\s*/g, '');
  // Remove old push calls that were inline (not in ds-ad-unit wrapper)
  html = html.replace(/\s*<script>\s*\(adsbygoogle\s*=\s*window\.adsbygoogle[^<]*<\/script>\s*/g, (match, offset) => {
    // Keep if inside ds-ad-unit
    const before = html.substring(Math.max(0, offset - 200), offset);
    if (before.includes('ds-ad-unit')) return match;
    return '';
  });
  return html;
}

function ensureAdsenseScript(html) {
  if (!html.includes('pagead2.googlesyndication.com')) {
    const insertPoint = html.indexOf('</head>');
    if (insertPoint > -1) {
      const tag = `\n\t<!-- Google AdSense -->\n\t<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}" crossorigin="anonymous"></script>\n`;
      html = html.slice(0, insertPoint) + tag + html.slice(insertPoint);
    }
  }
  return html;
}

// ── Page-specific ad integration ──

let stats = { pages: 0, ads: 0 };

function processFile(filePath, adPlacer) {
  let html = fs.readFileSync(filePath, 'utf8');
  html = stripOldAds(html);
  html = ensureAdsenseScript(html);
  const result = adPlacer(html);
  if (result !== html) {
    fs.writeFileSync(filePath, result, 'utf8');
    stats.pages++;
  }
  return result;
}

// Tool pages: horizontal ad above the tool + vertical ad below
function placeToolAds(html) {
  let count = 0;

  // Before </main> — horizontal ad
  if (!html.includes('ds-ad-unit') && html.includes('</main>')) {
    html = html.replace('</main>', horizontal() + '\n\t\t</main>');
    count++;
  }

  stats.ads += count;
  return html;
}

// Blog post pages: in-article ad mid-content + horizontal at bottom
function placePostAds(html) {
  let count = 0;

  // Add in-article ad after the article content, before post tags/sharing
  const postBodyEnd = html.indexOf('</article>');
  if (postBodyEnd > -1 && !html.includes('ds-ad-unit')) {
    html = html.slice(0, postBodyEnd) + inArticle() + '\n\t\t\t\t\t' + html.slice(postBodyEnd);
    count++;
  }

  // Add multiplex horizontal after the article (related content area)
  const mainEnd = html.indexOf('</main>');
  if (mainEnd > -1) {
    html = html.slice(0, mainEnd) + multiplexHorizontal() + '\n\t\t' + html.slice(mainEnd);
    count++;
  }

  stats.ads += count;
  return html;
}

// Blog listing pages: in-feed ads between articles + multiplex at bottom
function placeBlogListAds(html) {
  let count = 0;

  // Add in-feed ad after the RSS feed container or article listings
  if (!html.includes('ds-ad-unit--in-feed')) {
    // Try inserting after rss-feed-container closing div
    const rssEnd = html.indexOf('<!-- /rss-feed-container -->');
    if (rssEnd > -1) {
      html = html.slice(0, rssEnd + 27) + inFeed() + html.slice(rssEnd + 27);
      count++;
    }
  }

  // Add multiplex at bottom before </main>
  if (!html.includes('ds-ad-unit--multiplex')) {
    const mainEnd = html.indexOf('</main>');
    if (mainEnd > -1) {
      html = html.slice(0, mainEnd) + multiplexHorizontal() + '\n\t\t' + html.slice(mainEnd);
      count++;
    }
  }

  stats.ads += count;
  return html;
}

// Home page: keep existing good placement, update slot IDs, add multiplex
function placeHomeAds(html) {
  let count = 0;

  // Fix existing in-feed ad slot
  if (html.includes('data-ad-layout-key="-fb+5w+4e-db+86"')) {
    html = html.replace(
      /data-ad-layout-key="-fb\+5w\+4e-db\+86"[\s\S]*?data-ad-slot="[^"]*"/,
      'data-ad-layout-key="-fb+5w+4e-db+86"\n\t\t\t\t\tdata-ad-client="' + CLIENT + '"\n\t\t\t\t\tdata-ad-slot="5770059391"'
    );
  }

  // Add multiplex before </main> if not present
  if (!html.includes('ds-ad-unit--multiplex')) {
    const mainEnd = html.indexOf('</main>');
    if (mainEnd > -1) {
      html = html.slice(0, mainEnd) + multiplexHorizontal() + '\n\t\t' + html.slice(mainEnd);
      count++;
    }
  }

  stats.ads += count;
  return html;
}

// Standard content pages: horizontal at top/bottom
function placeStandardAds(html) {
  let count = 0;

  if (!html.includes('ds-ad-unit')) {
    // Add horizontal before </main>
    const mainEnd = html.indexOf('</main>');
    if (mainEnd > -1) {
      html = html.slice(0, mainEnd) + horizontal() + '\n\t\t' + html.slice(mainEnd);
      count++;
    }
  }

  stats.ads += count;
  return html;
}

// Dragon project pages: vertical sidebar-style ad at bottom
function placeDragonAds(html) {
  let count = 0;

  if (!html.includes('ds-ad-unit')) {
    const mainEnd = html.indexOf('</main>');
    if (mainEnd > -1) {
      html = html.slice(0, mainEnd) + vertical() + '\n\t\t' + html.slice(mainEnd);
      count++;
    }
  }

  stats.ads += count;
  return html;
}

// Shop page: in-feed between products + horizontal at bottom
function placeShopAds(html) {
  let count = 0;

  if (!html.includes('ds-ad-unit--multiplex')) {
    const mainEnd = html.indexOf('</main>');
    if (mainEnd > -1) {
      html = html.slice(0, mainEnd) + multiplexHorizontal() + '\n\t\t' + html.slice(mainEnd);
      count++;
    }
  }

  stats.ads += count;
  return html;
}

// ── Main ──

console.log('Integrating ads across Dragon\'s Shadow...\n');

// 1. Tool pages
const toolFiles = fs.readdirSync(BUILD).filter(f => f.startsWith('tools-') && f.endsWith('.html'));
for (const f of toolFiles) {
  processFile(path.join(BUILD, f), placeToolAds);
}
console.log(`  Tool pages: ${toolFiles.length}`);

// 2. Blog post pages
const postsDir = path.join(BUILD, 'posts');
if (fs.existsSync(postsDir)) {
  const postFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.html'));
  for (const f of postFiles) {
    processFile(path.join(postsDir, f), placePostAds);
  }
  console.log(`  Post pages: ${postFiles.length}`);
}

// 3. Blog listing pages
for (const f of ['blog-1.html', 'blog-classic.html']) {
  const fp = path.join(BUILD, f);
  if (fs.existsSync(fp)) processFile(fp, placeBlogListAds);
}
console.log('  Blog listing pages: 2');

// 4. Home page
processFile(path.join(BUILD, 'home.html'), placeHomeAds);
console.log('  Home page: 1');

// 5. Shop
processFile(path.join(BUILD, 'shop.html'), placeShopAds);
console.log('  Shop page: 1');

// 6. Dragon pages
const dragonFiles = fs.readdirSync(BUILD).filter(f => f.startsWith('dragon') && f.endsWith('.html'));
for (const f of dragonFiles) {
  processFile(path.join(BUILD, f), placeDragonAds);
}
console.log(`  Dragon pages: ${dragonFiles.length}`);

// 7. Tools hub
processFile(path.join(BUILD, 'tools.html'), placeStandardAds);

// 8. Standard content pages
const standardPages = ['about.html', 'api.html', 'contact.html', 'faqs.html', 'invoice.html',
  'login-register.html', 'partners.html', 'plugins.html', 'plugins-submit.html',
  '404.html', 'index.html'];
for (const f of standardPages) {
  const fp = path.join(BUILD, f);
  if (fs.existsSync(fp)) processFile(fp, placeStandardAds);
}
console.log(`  Standard pages: ${standardPages.length}`);

// 9. Update blog-post.html template for future posts
const tmpl = path.join(BUILD, 'blog-post.html');
if (fs.existsSync(tmpl)) {
  processFile(tmpl, placePostAds);
  console.log('  Blog post template: 1');
}

console.log(`\nDone! Updated ${stats.pages} pages with ${stats.ads} new ad placements.`);
