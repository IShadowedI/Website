/**
 * Tabletop Gaming News Aggregator
 * 
 * Fetches RSS feeds from tabletop gaming news sources and generates
 * static blog pages for the Dragon's Den site.
 * 
 * Usage: node scripts/fetch-news.js
 * Or:    npm run update-news
 */

const RSSParser = require('rss-parser');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const sharp = require('sharp');

const BUILD = path.join(__dirname, '..', 'build');
const DATA_FILE = path.join(__dirname, '..', 'news-data.json');
const POSTS_DIR = path.join(BUILD, 'posts');
const IMG_DIR = path.join(BUILD, 'assets', 'img', 'news');

// Max concurrent image downloads
const MAX_CONCURRENT_DOWNLOADS = 4;

// Tabletop gaming RSS feeds — D&D focused, with MTG and other tabletop
const FEEDS = [
  // D&D / RPG focused (primary)
  {
    url: 'https://www.belloflostsouls.net/category/dungeons-and-dragons/feed',
    source: 'Bell of Lost Souls',
    category: 'D&D',
    color: 'color-danger',
    maxItems: 15
  },
  {
    url: 'https://nerdist.com/tag/dungeons-and-dragons/feed/',
    source: 'Nerdist',
    category: 'D&D',
    color: 'color-danger',
    maxItems: 12
  },
  {
    url: 'https://www.dndbeyond.com/posts/rss',
    source: 'D&D Beyond',
    category: 'D&D',
    color: 'color-danger',
    maxItems: 12
  },
  // MTG
  {
    url: 'https://www.belloflostsouls.net/category/magic-the-gathering/feed',
    source: 'Bell of Lost Souls',
    category: 'MTG',
    color: 'color-primary',
    maxItems: 10
  },
  {
    url: 'https://www.wargamer.com/feed',
    source: 'Wargamer',
    category: 'Tabletop',
    color: 'color-warning',
    maxItems: 10
  },
  // General tabletop
  {
    url: 'https://www.dicebreaker.com/feed',
    source: 'Dicebreaker',
    category: 'Tabletop',
    color: 'color-success',
    maxItems: 10
  },
  {
    url: 'https://www.goonhammer.com/feed/',
    source: 'Goonhammer',
    category: 'Wargaming',
    color: 'color-warning',
    maxItems: 10
  },
  {
    url: 'https://www.tabletopgamingnews.com/feed/',
    source: 'Tabletop Gaming News',
    category: 'Board Games',
    color: 'color-success',
    maxItems: 8
  }
];

// Fallback placeholder images for posts (cycled through)
const PLACEHOLDER_IMGS = [
  'assets/img/samples/news-v1-post-img-01.jpg',
  'assets/img/samples/news-v1-post-img-02.jpg',
  'assets/img/samples/news-v1-post-img-03.jpg',
  'assets/img/samples/news-v1-post-img-04.jpg',
];

const CAROUSEL_IMGS = [
  'assets/img/samples/widget-posts-carousel-img-01.jpg',
  'assets/img/samples/widget-posts-carousel-img-02.jpg',
  'assets/img/samples/widget-posts-carousel-img-03.jpg',
];

// ============================================================
// Utility functions
// ============================================================

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Unknown Date';
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  const day = d.getDate();
  const suffix = (day === 1 || day === 21 || day === 31) ? 'st' :
                 (day === 2 || day === 22) ? 'nd' :
                 (day === 3 || day === 23) ? 'rd' : 'th';
  return `${months[d.getMonth()]} ${day}${suffix}, ${d.getFullYear()}`;
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractExcerpt(content, maxLen = 200) {
  const text = stripHtml(content);
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).replace(/\s+\S*$/, '') + '...';
}

function extractImage(item) {
  const candidates = [];

  // Try enclosure
  if (item.enclosure && item.enclosure.url) candidates.push(item.enclosure.url);
  // Try media content
  if (item['media:content'] && item['media:content'].$ && item['media:content'].$.url) {
    candidates.push(item['media:content'].$.url);
  }
  // Try media thumbnail
  if (item['media:thumbnail'] && item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
    candidates.push(item['media:thumbnail'].$.url);
  }
  // Try finding all <img> in content and pick the largest-looking one
  const content = item['content:encoded'] || item.content || '';
  const imgMatches = content.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*/gi);
  for (const m of imgMatches) {
    candidates.push(m[1]);
  }

  if (candidates.length === 0) return null;

  // Prefer the largest image: try to strip WordPress size suffixes (-300x150, -1024x768 etc)
  // and pick the one with the largest dimensions or the full-size version
  const upgraded = candidates.map(url => upgradeImageUrl(url));
  // Prefer images that look like full-size (no dimension suffix)
  const fullSize = upgraded.find(u => !/-\d+x\d+\./.test(u));
  return fullSize || upgraded[0];
}

/**
 * Try to get a higher-resolution version of an image URL.
 * WordPress sites often serve -300x150 thumbnails; strip the size suffix
 * to request the original full-size image.
 */
function upgradeImageUrl(url) {
  if (!url) return url;
  // WordPress: remove -300x150, -1024x768 etc before extension
  const upgraded = url.replace(/-\d{2,4}x\d{2,4}(\.[a-z]{3,4})/i, '$1');
  return upgraded;
}

function sanitizeContent(html) {
  if (!html) return '';
  // Remove scripts, iframes, styles
  let clean = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')  // Remove event handlers
    .replace(/javascript:/gi, '')  // Remove javascript: URIs
    .replace(/<form[^>]*>[\s\S]*?<\/form>/gi, '');  // Remove forms
  
  // Wrap bare text blocks in <p> if needed
  // Keep existing <p>, <h2-h6>, <figure>, <img>, <ul>, <ol>, <blockquote>, <a>
  return clean.trim();
}

// ============================================================
// Image downloading
// ============================================================

/**
 * Download an image from a URL to the local news images directory.
 * Returns the local relative path (from build/) or null on failure.
 */
function downloadImage(imageUrl, slug, index) {
  return new Promise((resolve) => {
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return resolve(null);
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return resolve(null);
    }

    const ext = path.extname(parsedUrl.pathname).split('?')[0] || '.jpg';
    const validExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif'];
    const fileExt = validExts.includes(ext.toLowerCase()) ? ext.toLowerCase() : '.jpg';
    const filename = `${slug}-${index}${fileExt}`;
    const localPath = path.join(IMG_DIR, filename);
    const relativePath = `assets/img/news/${filename}`;

    // Skip if already downloaded
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 1000) {
      return resolve(relativePath);
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const request = client.get(imageUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*',
        'Referer': parsedUrl.origin + '/',
      }
    }, (res) => {
      // Follow redirects (up to 3)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return downloadImage(res.headers.location, slug, index).then(resolve);
      }

      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }

      const contentType = res.headers['content-type'] || '';
      if (!contentType.startsWith('image/')) {
        res.resume();
        return resolve(null);
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 500) return resolve(null); // Too small, probably error page
        try {
          fs.writeFileSync(localPath, buffer);
          resolve(relativePath);
        } catch {
          resolve(null);
        }
      });
      res.on('error', () => resolve(null));
    });

    request.on('error', () => resolve(null));
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
  });
}

/**
 * Validate a downloaded image meets quality standards.
 * Checks: minimum resolution, not predominantly black, not corrupt.
 * Returns true if image passes, false if it should be discarded.
 */
async function validateImage(localAbsPath) {
  try {
    if (!fs.existsSync(localAbsPath)) return false;
    const stats = fs.statSync(localAbsPath);
    if (stats.size < 2000) return false; // too small to be a real image

    const metadata = await sharp(localAbsPath).metadata();
    if (!metadata.width || !metadata.height) return false;

    // Minimum 400×200
    if (metadata.width < 400 || metadata.height < 200) {
      console.log(`    [SKIP] Too small: ${metadata.width}x${metadata.height} — ${path.basename(localAbsPath)}`);
      return false;
    }

    // Sample pixels to detect predominantly black / single-colour images
    const { data, info } = await sharp(localAbsPath)
      .resize(50, 50, { fit: 'cover' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels = info.width * info.height;
    let darkPixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r < 15 && g < 15 && b < 15) darkPixels++;
    }
    const darkRatio = darkPixels / pixels;
    if (darkRatio > 0.85) {
      console.log(`    [SKIP] Nearly black (${(darkRatio * 100).toFixed(0)}% dark) — ${path.basename(localAbsPath)}`);
      return false;
    }

    return true;
  } catch (err) {
    console.log(`    [SKIP] Corrupt/unreadable image — ${path.basename(localAbsPath)}: ${err.message}`);
    return false;
  }
}

/**
 * Download images in batches to avoid overwhelming servers.
 */
async function downloadImagesForItems(items) {
  console.log(`\nDownloading images for ${items.length} articles...`);
  let downloaded = 0;
  let failed = 0;
  let rejected = 0;

  for (let i = 0; i < items.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = items.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    const results = await Promise.all(
      batch.map(async (item) => {
        if (!item.image) return null;
        const localPath = await downloadImage(item.image, item.slug, 0);
        if (localPath) {
          const absPath = path.join(BUILD, localPath);
          const valid = await validateImage(absPath);
          if (valid) {
            item.localImage = localPath;
            downloaded++;
          } else {
            // Remove the bad image file
            try { fs.unlinkSync(absPath); } catch {}
            item.localImage = null;
            rejected++;
          }
        } else {
          failed++;
        }
        return localPath;
      })
    );
  }

  console.log(`  Downloaded: ${downloaded}, Rejected: ${rejected}, Failed: ${failed}, No image: ${items.filter(i => !i.image).length}`);
}

/**
 * Replace external image URLs in article body HTML with locally downloaded versions.
 * Downloads each unique image found in the content.
 */
async function localizeBodyImages(items) {
  console.log('Downloading embedded body images...');
  let count = 0;

  for (const item of items) {
    if (!item.content) continue;
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    let imgIndex = 1;
    const replacements = [];

    while ((match = imgRegex.exec(item.content)) !== null) {
      const externalUrl = match[1];
      if (!externalUrl.startsWith('http')) continue;

      const localPath = await downloadImage(externalUrl, item.slug, imgIndex);
      if (localPath) {
        replacements.push({ from: externalUrl, to: localPath });
        count++;
      }
      imgIndex++;
    }

    for (const r of replacements) {
      item.content = item.content.split(r.from).join(r.to);
    }
  }

  console.log(`  Localized ${count} embedded images`);
}

// ============================================================
// Full article scraping + comment extraction
// ============================================================

/**
 * Fetch a page's HTML content via HTTP(S).
 */
function fetchPage(url) {
  return new Promise((resolve) => {
    let parsedUrl;
    try { parsedUrl = new URL(url); } catch { return resolve(null); }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const req = client.get(url, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        res.resume();
        return fetchPage(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

/**
 * Scrape the full article body from a page URL using cheerio.
 * Returns { fullContent, comments[] } or null.
 */
async function scrapeArticle(url, source) {
  const html = await fetchPage(url);
  if (!html) return null;

  const $ = cheerio.load(html);

  // ── Extract SEO metadata before stripping the page ──
  const seo = {};
  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content')
    || $('meta[property="og:description"]').attr('content') || '';
  if (metaDesc) seo.description = metaDesc.substring(0, 300);
  // Meta keywords
  const metaKw = $('meta[name="keywords"]').attr('content') || '';
  if (metaKw) seo.keywords = metaKw.substring(0, 500);
  // OG tags
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  if (ogImage) seo.ogImage = ogImage;
  // Article tags (common on blogs)
  const tags = [];
  $('meta[property="article:tag"]').each((_, el) => {
    const t = $(el).attr('content');
    if (t) tags.push(t.trim());
  });
  // Also try to extract from visible tag links
  $('.post-tags a, .tags a, .tagcloud a, [rel="tag"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length < 40 && !tags.includes(t)) tags.push(t);
  });
  if (tags.length) seo.tags = tags.slice(0, 10);
  // Article author
  const author = $('meta[name="author"]').attr('content')
    || $('meta[property="article:author"]').attr('content')
    || $('[rel="author"]').first().text().trim() || '';
  if (author) seo.author = author.substring(0, 80);

  // Remove unwanted elements
  $('script, style, nav, header, footer, .sidebar, .related-posts, .share-buttons, .social-share, .newsletter-signup, .ad, .advertisement, [class*="adsbygoogle"], .wp-block-embed').remove();

  let articleHtml = '';

  // Source-specific selectors for article content
  const contentSelectors = [
    'article .entry-content',           // WordPress standard
    '.post-content',                     // Common blog
    '.article-content',                  // News sites
    '.entry-content',                    // WordPress
    'article .content',                  // Generic
    '.post__content',                    // Some themes
    '.article__body',                    // News
    '.article-body',                     // News
    '[itemprop="articleBody"]',          // Schema.org
    '.single-post-content',             // WordPress
    '.td-post-content',                 // Flavor theme
    '.c-entry-content',                 // Vox Media
    'article',                          // Fallback
  ];

  for (const sel of contentSelectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 100) {
      // Clean up the content
      el.find('.social-share, .author-bio, .related, .tags, .comments-link, .navigation, .wp-block-buttons, .sharedaddy').remove();
      articleHtml = el.html();
      break;
    }
  }

  if (!articleHtml || articleHtml.length < 50) return null;

  // Extract comments
  const comments = [];
  const commentSelectors = [
    '.comment-list > .comment, .comment-list > li',
    '#comments .comment',
    '.comments .comment',
    '.comment-body',
    '#disqus_thread .post',
  ];

  for (const sel of commentSelectors) {
    $(sel).slice(0, 5).each((i, el) => {
      const $el = $(el);
      const author = $el.find('.comment-author, .fn, .comment__author, .author-name').first().text().trim();
      const text = $el.find('.comment-content, .comment-text, .comment-body p, .comment__body p').first().text().trim();
      const date = $el.find('.comment-date, time, .comment-meta time, .comment__date').first().text().trim();

      if (author && text && text.length > 10) {
        comments.push({
          author: author.substring(0, 50),
          text: text.substring(0, 300),
          date: date || ''
        });
      }
    });
    if (comments.length > 0) break;
  }

  return {
    fullContent: sanitizeContent(articleHtml),
    comments: comments.slice(0, 3),  // Max 3 top comments
    seo
  };
}

/**
 * Scrape full articles for all items, replacing RSS excerpts with full content.
 */
async function scrapeFullArticles(items) {
  console.log(`\nScraping full articles for ${items.length} items...`);
  let scraped = 0, withComments = 0, withSeo = 0, failed = 0;

  for (let i = 0; i < items.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = items.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    await Promise.all(batch.map(async (item) => {
      try {
        const result = await scrapeArticle(item.link, item.source);
        if (result && result.fullContent && result.fullContent.length > item.content.length) {
          item.content = result.fullContent;
          item.excerpt = extractExcerpt(result.fullContent);
          scraped++;
          if (result.comments.length > 0) {
            item.comments = result.comments;
            withComments++;
          }
          if (result.seo && Object.keys(result.seo).length > 0) {
            item.seo = result.seo;
            withSeo++;
          }
        }
      } catch (err) {
        failed++;
      }
    }));
  }

  console.log(`  Scraped: ${scraped}, With SEO data: ${withSeo}, With comments: ${withComments}, Failed/shorter: ${failed}`);
}

// ============================================================
// Feed fetching
// ============================================================

async function fetchAllFeeds() {
  const parser = new RSSParser({
    timeout: 15000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DragonsDenNewsBot/1.0)',
      'Accept': 'application/rss+xml, application/xml, text/xml, */*'
    },
    customFields: {
      item: [['media:content'], ['media:thumbnail']]
    }
  });

  const allItems = [];

  for (const feed of FEEDS) {
    try {
      console.log(`  Fetching: ${feed.source} (${feed.url})`);
      const result = await parser.parseURL(feed.url);
      const items = (result.items || []).slice(0, feed.maxItems || 8);
      
      for (const item of items) {
        const title = item.title || 'Untitled';
        const link = item.link || '#';
        const date = item.pubDate || item.isoDate || new Date().toISOString();
        const content = item['content:encoded'] || item.content || item.contentSnippet || '';
        const excerpt = extractExcerpt(content);
        const image = extractImage(item);
        
        allItems.push({
          title: stripHtml(title),
          link,
          date,
          dateFormatted: formatDate(date),
          content: sanitizeContent(content),
          excerpt,
          image,
          source: feed.source,
          category: feed.category,
          color: feed.color,
          slug: slugify(title),
        });
      }
      
      console.log(`    Got ${items.length} articles from ${feed.source}`);
    } catch (err) {
      console.error(`    FAILED: ${feed.source} - ${err.message}`);
    }
  }

  // Sort by date, newest first
  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Deduplicate by slug
  const seen = new Set();
  const unique = allItems.filter(item => {
    if (seen.has(item.slug)) return false;
    seen.add(item.slug);
    return true;
  });

  return unique;
}

// ============================================================
// Page generation
// ============================================================

function getPostTemplate() {
  return fs.readFileSync(path.join(BUILD, 'blog-post.html'), 'utf8');
}

function getBlogListTemplate() {
  return fs.readFileSync(path.join(BUILD, 'blog-1.html'), 'utf8');
}

function generatePostPage(item, index, template) {
  let html = template;
  
  const postImg = item.localImage || PLACEHOLDER_IMGS[index % PLACEHOLDER_IMGS.length];
  const safeTitle = escapeHtml(item.title);
  
  // Update title
  html = html.replace(/<title>.*?<\/title>/, `<title>${safeTitle} - Dragon's Den</title>`);
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${escapeHtml(item.excerpt)}">`
  );

  // ── Inject scraped SEO metadata into <head> ──
  if (item.seo) {
    const seoTags = [];
    if (item.seo.keywords) {
      seoTags.push(`<meta name="keywords" content="${escapeHtml(item.seo.keywords)}">`);
    }
    if (item.seo.tags && item.seo.tags.length) {
      const kwFromTags = item.seo.tags.join(', ');
      // Merge with any existing keywords or add new
      if (!item.seo.keywords) {
        seoTags.push(`<meta name="keywords" content="${escapeHtml(kwFromTags)}">`);
      }
      seoTags.push(`<meta property="article:tag" content="${escapeHtml(item.seo.tags[0])}">`);
      for (const tag of item.seo.tags.slice(1)) {
        seoTags.push(`<meta property="article:tag" content="${escapeHtml(tag)}">`);
      }
    }
    if (item.seo.author) {
      seoTags.push(`<meta name="author" content="${escapeHtml(item.seo.author)}">`);
      seoTags.push(`<meta property="article:author" content="${escapeHtml(item.seo.author)}">`);
    }
    // JSON-LD Article schema with extracted SEO
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'NewsArticle',
      headline: item.title,
      datePublished: item.date,
      description: item.seo.description || item.excerpt,
      publisher: { '@type': 'Organization', name: "Dragon's Den" },
      mainEntityOfPage: { '@type': 'WebPage', '@id': `https://dragonsshadow.com/posts/${item.slug}.html` }
    };
    if (item.seo.author) jsonLd.author = { '@type': 'Person', name: item.seo.author };
    if (item.localImage) jsonLd.image = `https://dragonsshadow.com/${item.localImage}`;
    if (item.seo.tags) jsonLd.keywords = item.seo.tags.join(', ');
    seoTags.push(`<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`);

    if (seoTags.length) {
      html = html.replace('</head>', seoTags.join('\n') + '\n</head>');
    }
  }
  
  // Replace the entire article content block
  const articleStart = html.indexOf('<!-- Post -->');
  const articleEnd = html.indexOf('<!-- Post / End -->');
  
  if (articleStart !== -1 && articleEnd !== -1) {
    const before = html.substring(0, articleStart);
    const after = html.substring(articleEnd + '<!-- Post / End -->'.length);
    
    const articleHtml = `<!-- Post -->
					<article class="post post--single">
						<figure class="post__thumbnail">
							<img src="${escapeHtml(postImg)}" alt="${safeTitle}">
						</figure>
						<ul class="post__sharing">
							<li class="post__sharing-item post__sharing-item--menu"><a href="home.html"><i>&nbsp;</i></a></li>
							<li class="post__sharing-item"><a href="#" data-social="facebook"></a></li>
							<li class="post__sharing-item"><a href="#" data-social="twitter"></a></li>
						</ul>
						<div class="post__header">
							<div class="post__cats h6">
								<span class="${item.color}">${escapeHtml(item.category)}</span>
							</div>
							<h2 class="post__title h3">${safeTitle}</h2>
							<div class="post__meta">
								<span class="meta-item meta-item--date">${item.dateFormatted}</span>
								<span class="meta-item meta-item--source">via <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source)}</a></span>
							</div>
						</div>
						<div class="post__body">
							${item.content || '<p>' + escapeHtml(item.excerpt) + '</p>'}
							<div class="spacer"></div>
							<p class="text-small"><em>Originally published on <a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source)}</a>.</em></p>
						</div>
					</article>
					<!-- Post / End -->`;
    
    html = before + articleHtml + after;
  }
  
  // Insert comments section: scraped comments + Giscus user comment widget
  const commentsPlaceholder = html.indexOf('<!-- COMMENTS_PLACEHOLDER -->');
  if (commentsPlaceholder !== -1) {
    let commentsHtml = '';

    // Scraped source-page comments (if any)
    if (item.comments && item.comments.length > 0) {
      const commentItems = item.comments.map(c => `
							<li class="comment">
								<div class="comment__body">
									<h6 class="comment__author">${escapeHtml(c.author)}</h6>
									<p>${escapeHtml(c.text)}</p>
									<div class="comment__meta">
										<time class="comment__date">${escapeHtml(c.date)}</time>
									</div>
								</div>
							</li>`).join('');
      commentsHtml += `
					<div class="post-comments" id="comments">
						<h4 class="post-comments__title">Top Comments (${item.comments.length})</h4>
						<ol class="comments">${commentItems}
						</ol>
					</div>`;
    }

    // Giscus user comment widget (GitHub Discussions)
    commentsHtml += `
					<div class="ds-comments" id="user-comments">
						<h4 class="ds-comments__title">Leave a Comment</h4>
						<script src="https://giscus.app/client.js"
							data-repo="IShadowedI/Website"
							data-repo-id=""
							data-category="Article Comments"
							data-category-id=""
							data-mapping="pathname"
							data-strict="0"
							data-reactions-enabled="1"
							data-emit-metadata="0"
							data-input-position="top"
							data-theme="dark_dimmed"
							data-lang="en"
							data-loading="lazy"
							crossorigin="anonymous"
							async>
						</script>
					</div>`;

    html = html.replace('<!-- COMMENTS_PLACEHOLDER -->', commentsHtml);
  }
  
  return html;
}

function generateBlogListing(items, template) {
  let html = template;
  
  // Generate carousel items (top 3)
  const carouselItems = items.slice(0, 3);
  const carouselHtml = carouselItems.map((item, i) => {
    const img = item.localImage || CAROUSEL_IMGS[i % CAROUSEL_IMGS.length];
    return `				<article class="widget-carousel__item post slick-slide">
					<div class="post__thumbnail">
						<img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}">
					</div>
					<div class="post__body">
						<ul class="post__cats list-unstyled">
							<li class="post__cats-item ${item.color}">
								<a href="#">${escapeHtml(item.category)}</a>
							</li>
						</ul>
						<h2 class="post__title"><a href="posts/${item.slug}.html">${escapeHtml(item.title)}</a></h2>
						<ul class="post__meta list-unstyled">
							<li class="post__meta-item post__meta-item--date">
								<a href="#">${item.dateFormatted}</a>
							</li>
						</ul>
					</div>
				</article>`;
  }).join('\n');

  // Replace carousel
  const carouselStart = html.indexOf('<div class="widget widget-carousel slick-slider">');
  const carouselEnd = html.indexOf('</div>\n\t\t\t</div>\n\t\t\t<div class="content blog-layout');
  if (carouselStart !== -1 && carouselEnd !== -1) {
    const before = html.substring(0, carouselStart);
    const after = html.substring(carouselEnd);
    html = before + `<div class="widget widget-carousel slick-slider">\n${carouselHtml}\n\t\t\t\t</div>` + after;
  }

  // Generate post listing items
  const listItems = items.slice(0, 20); // Show up to 20 posts
  const postsHtml = listItems.map((item, i) => {
    const img = item.localImage || PLACEHOLDER_IMGS[i % PLACEHOLDER_IMGS.length];
    return `			<article class="post has-post-thumbnail ">
				<div class="post__thumbnail">
					<a href="posts/${item.slug}.html"><img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}"></a>
				</div>
				<div class="post__body">
					<div class="post__header">
						<ul class="post__cats list-unstyled">
							<li class="post__cats-item ${item.color}">
								<a href="#">${escapeHtml(item.category)}</a>
							</li>
						</ul>
						<h2 class="post__title h4"><a href="posts/${item.slug}.html">${escapeHtml(item.title)}</a></h2>
						<ul class="post__meta list-unstyled">
							<li class="post__meta-item post__meta-item--date">
								<a href="#">${item.dateFormatted}</a>
							</li>
						</ul>
					</div>
					<div class="post__excerpt">
						${escapeHtml(item.excerpt)}</div>
				</div>
			</article>`;
  }).join('\n');

  // Replace the blog content area
  const contentStart = html.indexOf('<div class="content blog-layout--style-1">');
  // Find the closing of the content area before </main>
  const contentEndMarker = '\n\t\t</main>';
  const contentEnd = html.indexOf(contentEndMarker);
  if (contentStart !== -1 && contentEnd !== -1) {
    const before = html.substring(0, contentStart);
    const after = html.substring(contentEnd);
    html = before + `<div class="content blog-layout--style-1">

${postsHtml}

			</div>` + after;
  }
  
  // Update page title
  html = html.replace(/<title>.*?<\/title>/, '<title>Tabletop Gaming News - Dragon\'s Den</title>');
  
  return html;
}

// ============================================================
// Pagination
// ============================================================

function buildPaginationNav(currentPage, totalPages) {
  const pageFile = (p) => p === 1 ? 'news.html' : `news-${p}.html`;

  let links = '';

  // Previous
  if (currentPage > 1) {
    links += `<a class="prev page-numbers" href="${pageFile(currentPage - 1)}"><span><i class="fa fa-chevron-left"></i></span></a> `;
  } else {
    links += `<span class="prev page-numbers placeholder"><span><i class="fa fa-chevron-left"></i></span> </span>`;
  }

  // Page numbers — show first, last, current, and neighbors
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      if (p === currentPage) {
        links += `<span aria-current="page" class="page-numbers current">${p}</span> `;
      } else {
        links += `<a class="page-numbers" href="${pageFile(p)}">${p}</a> `;
      }
    } else if (p === currentPage - 2 || p === currentPage + 2) {
      links += `<span class="page-numbers dots">\u2026</span> `;
    }
  }

  // Next
  if (currentPage < totalPages) {
    links += `<a class="next page-numbers" href="${pageFile(currentPage + 1)}"><span><i class="fa fa-chevron-right"></i></span></a>`;
  }

  return `<nav class="navigation pagination" role="navigation" aria-label="Posts"><div class="nav-links">${links}</div></nav>`;
}

function buildNewsPaginationNav(currentPage, totalPages) {
  const pageFile = (p) => p === 1 ? 'news.html' : `news-${p}.html`;
  let links = '';

  // Previous
  if (currentPage > 1) {
    links += `<a href="${pageFile(currentPage - 1)}"><i class="fa fa-chevron-left"></i></a> `;
  }

  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
      if (p === currentPage) {
        links += `<span class="current">${p}</span> `;
      } else {
        links += `<a href="${pageFile(p)}">${p}</a> `;
      }
    } else if (p === currentPage - 2 || p === currentPage + 2) {
      links += `<span class="dots">&hellip;</span> `;
    }
  }

  // Next
  if (currentPage < totalPages) {
    links += `<a href="${pageFile(currentPage + 1)}"><i class="fa fa-chevron-right"></i></a>`;
  }

  return `<nav class="news-pagination" id="news-pagination" role="navigation" aria-label="Posts">${links}</nav>`;
}

// ============================================================
// Main
// ============================================================

async function main() {
  console.log('=== Dragon\'s Den News Aggregator ===');
  console.log('Fetching tabletop gaming news feeds...\n');

  // Ensure directories exist
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

  // Fetch all feeds
  const items = await fetchAllFeeds();
  console.log(`\nTotal articles fetched: ${items.length}`);

  if (items.length === 0) {
    console.log('No articles fetched. Check your internet connection or feed URLs.');
    return;
  }

  // Download article images locally
  await downloadImagesForItems(items);

  // Scrape full article content and comments from source pages
  await scrapeFullArticles(items);

  // Download and localize images embedded in article body HTML
  await localizeBodyImages(items);

  // Save data for reference
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf8');
  console.log(`Saved article data to news-data.json`);

  // Load templates
  const postTemplate = getPostTemplate();
  const listTemplate = getBlogListTemplate();

  // Generate individual post pages
  console.log('\nGenerating post pages...');
  let generated = 0;
  for (let i = 0; i < Math.min(items.length, 60); i++) {
    const item = items[i];
    const postHtml = generatePostPage(item, i, postTemplate);
    const filename = `${item.slug}.html`;
    
    // Post pages are in /posts/ subfolder, so fix asset paths
    const fixedHtml = postHtml
      .replace(/(href|src|srcset|xlink:href)="assets\//g, '$1="../assets/')
      .replace(/src="assets\/img\/news\//g, 'src="../assets/img/news/');
    
    fs.writeFileSync(path.join(POSTS_DIR, filename), fixedHtml, 'utf8');
    generated++;
  }
  console.log(`Generated ${generated} post pages in /posts/`);

  // Regenerate blog listing pages
  console.log('\nUpdating blog listing (blog-1.html)...');
  const listingHtml = generateBlogListing(items, listTemplate);
  fs.writeFileSync(path.join(BUILD, 'blog-1.html'), listingHtml, 'utf8');
  console.log('Updated blog-1.html');

  // Also update blog-4.html (News Feed) with a similar listing
  if (fs.existsSync(path.join(BUILD, 'blog-4.html'))) {
    const blog4Template = fs.readFileSync(path.join(BUILD, 'blog-4.html'), 'utf8');
    // blog-4 may have a different layout, replace just the articles
    const feedPostsHtml = items.slice(0, 15).map((item, i) => {
      const img = item.localImage || PLACEHOLDER_IMGS[i % PLACEHOLDER_IMGS.length];
      return `			<article class="post has-post-thumbnail ">
				<div class="post__thumbnail">
					<a href="posts/${item.slug}.html"><img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}"></a>
				</div>
				<div class="post__body">
					<div class="post__header">
						<ul class="post__cats list-unstyled">
							<li class="post__cats-item ${item.color}">
								<a href="#">${escapeHtml(item.category)}</a>
							</li>
						</ul>
						<h2 class="post__title h4"><a href="posts/${item.slug}.html">${escapeHtml(item.title)}</a></h2>
						<ul class="post__meta list-unstyled">
							<li class="post__meta-item post__meta-item--date">
								<a href="#">${item.dateFormatted}</a>
							</li>
						</ul>
					</div>
					<div class="post__excerpt">
						${escapeHtml(item.excerpt)}</div>
				</div>
			</article>`;
    }).join('\n');
    
    // Try to replace content in blog-4
    let b4 = blog4Template;
    const b4ContentStart = b4.indexOf('<div class="content');
    const b4ContentEnd = b4.indexOf('\n\t\t</main>');
    if (b4ContentStart !== -1 && b4ContentEnd !== -1) {
      const before = b4.substring(0, b4ContentStart);
      const after = b4.substring(b4ContentEnd);
      b4 = before + `<div class="content blog-layout--style-1">\n\n${feedPostsHtml}\n\n\t\t\t</div>` + after;
      b4 = b4.replace(/<title>.*?<\/title>/, '<title>News Feed - Dragon\'s Den</title>');
      fs.writeFileSync(path.join(BUILD, 'blog-4.html'), b4, 'utf8');
      console.log('Updated blog-4.html');
    }
  }

  // Fix links in post pages: blog-post.html links should point to home
  // Fix all internal links inside /posts/ to go up one level  
  console.log('\nFixing relative paths in post pages...');
  const postFiles = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.html'));
  for (const pf of postFiles) {
    const pfPath = path.join(POSTS_DIR, pf);
    let content = fs.readFileSync(pfPath, 'utf8');
    // Fix links to other pages (not assets which were already fixed)
    content = content.replace(/href="((?!#|http|mailto|\.\.\/assets)[a-zA-Z0-9_-]+\.html)/g, 'href="../$1');
    content = content.replace(/href="posts\//g, 'href="');
    fs.writeFileSync(pfPath, content, 'utf8');
  }
  console.log(`Fixed paths in ${postFiles.length} post pages`);

  // ── Update home.html news section ──
  console.log('\nUpdating home.html news feed...');
  const homePath = path.join(BUILD, 'home.html');
  if (fs.existsSync(homePath)) {
    let homeHtml = fs.readFileSync(homePath, 'utf8');
    const homeArticles = items.slice(0, 7).map((item, i) => {
      const img = item.localImage || PLACEHOLDER_IMGS[i % PLACEHOLDER_IMGS.length];
      return `\t\t\t\t<article class="post has-post-thumbnail">
\t\t\t\t\t<div class="post__thumbnail">
\t\t\t\t\t\t<a href="posts/${item.slug}.html"><img src="${escapeHtml(img)}" alt="${escapeHtml(item.title)}"></a>
\t\t\t\t\t</div>
\t\t\t\t\t<div class="post__body">
\t\t\t\t\t\t<div class="post__header">
\t\t\t\t\t\t\t<ul class="post__cats list-unstyled">
\t\t\t\t\t\t\t\t<li class="post__cats-item ${item.color}">
\t\t\t\t\t\t\t\t\t<a href="#">${escapeHtml(item.category)}</a>
\t\t\t\t\t\t\t\t</li>
\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t\t<h2 class="post__title h4"><a href="posts/${item.slug}.html">${escapeHtml(item.title)}</a></h2>
\t\t\t\t\t\t\t<ul class="post__meta list-unstyled">
\t\t\t\t\t\t\t\t<li class="post__meta-item post__meta-item--date">
\t\t\t\t\t\t\t\t\t<a href="#">${item.dateFormatted}</a>
\t\t\t\t\t\t\t\t</li>
\t\t\t\t\t\t\t</ul>
\t\t\t\t\t\t</div>
\t\t\t\t\t\t<div class="post__excerpt">${escapeHtml(item.excerpt)}</div>
\t\t\t\t\t</div>
\t\t\t\t</article>`;
    }).join('\n\n');

    // Replace content inside #rss-feed-container
    const rssStart = homeHtml.indexOf('<div id="rss-feed-container">');
    if (rssStart !== -1) {
      const rssEnd = homeHtml.indexOf('</div>', homeHtml.indexOf('</article>', rssStart + 100));
      // Find the closing </div> that matches rss-feed-container (after all articles)
      // Safer: find the pattern </div>\n\t\t\t</div> which closes rss-feed-container + content
      const rssContainerClose = homeHtml.indexOf('\n\t\t\t</div>\n\t\t\t</div>', rssStart);
      if (rssContainerClose !== -1) {
        const before = homeHtml.substring(0, rssStart);
        const after = homeHtml.substring(rssContainerClose);
        homeHtml = before + `<div id="rss-feed-container">\n\n${homeArticles}\n\n\t\t\t\t</div>` + after;
        fs.writeFileSync(homePath, homeHtml, 'utf8');
        console.log('Updated home.html news section');
      }
    }
  }

  // ── Update news.html with new layout ──
  console.log('Generating paginated news pages...');
  const newsPath = path.join(BUILD, 'news.html');
  if (fs.existsSync(newsPath)) {
    const newsTemplate = fs.readFileSync(newsPath, 'utf8');
    const ITEMS_PER_PAGE = 10;
    const totalPages = Math.ceil(Math.min(items.length, 60) / ITEMS_PER_PAGE);

    for (let page = 1; page <= totalPages; page++) {
      const startIdx = (page - 1) * ITEMS_PER_PAGE;
      const pageItems = items.slice(startIdx, startIdx + ITEMS_PER_PAGE);

      let newsHtml = newsTemplate;

      // ─── Hero article (first item on page 1, first on each page) ───
      const heroItem = pageItems[0];
      const heroImg = heroItem.localImage || PLACEHOLDER_IMGS[0];
      const heroBlock = `<div class="news-hero" id="news-hero">
        <img class="news-hero__img" src="${escapeHtml(heroImg)}" alt="${escapeHtml(heroItem.title)}">
        <div class="news-hero__overlay">
          <span class="news-hero__cat">${escapeHtml(heroItem.category)}</span>
          <h2 class="news-hero__title"><a href="posts/${heroItem.slug}.html">${escapeHtml(heroItem.title)}</a></h2>
          <div class="news-hero__meta">
            <span>${heroItem.dateFormatted}</span>
            <span>&bull;</span>
            <span>via ${escapeHtml(heroItem.source)}</span>
          </div>
        </div>
      </div>`;

      // Replace the hero block
      const heroStart = newsHtml.indexOf('<div class="news-hero"');
      const heroEnd = newsHtml.indexOf('</div>\n', newsHtml.indexOf('</div>\n', newsHtml.indexOf('</div>\n', heroStart + 1) + 1) + 1) + 6;
      // Safer: find the closing of news-hero by counting
      const heroCloseTag = '</div>\n\n      <!-- Right Sidebar';
      const heroEndSafe = newsHtml.indexOf(heroCloseTag, heroStart);
      if (heroStart !== -1 && heroEndSafe !== -1) {
        newsHtml = newsHtml.substring(0, heroStart) + heroBlock + '\n\n      <!-- Right Sidebar' + newsHtml.substring(heroEndSafe + heroCloseTag.length);
      }

      // ─── Latest Posts sidebar (3 items, offset from hero) ───
      const latestItems = page === 1 ? items.slice(1, 4) : items.slice(0, 3);
      const latestHtml = latestItems.map(it => {
        const img = it.localImage || PLACEHOLDER_IMGS[0];
        return `          <div class="news-sidebar-post">
            <div class="news-sidebar-post__thumb"><img src="${escapeHtml(img)}" alt=""></div>
            <div class="news-sidebar-post__body">
              <span class="news-sidebar-post__cat">${escapeHtml(it.category)}</span>
              <h4 class="news-sidebar-post__title"><a href="posts/${it.slug}.html">${escapeHtml(it.title)}</a></h4>
              <div class="news-sidebar-post__date">${it.dateFormatted}</div>
            </div>
          </div>`;
      }).join('\n');

      // Replace Latest Posts widget content
      const lpStart = newsHtml.indexOf('<div class="news-sidebar-widget" id="news-latest-posts">');
      const lpEnd = newsHtml.indexOf('</div>\n\n        <!-- Most Popular Posts');
      if (lpStart !== -1 && lpEnd !== -1) {
        const lpInner = `<div class="news-sidebar-widget" id="news-latest-posts">
          <h3 class="news-sidebar-widget__title">Latest Posts</h3>
${latestHtml}
        </div>`;
        newsHtml = newsHtml.substring(0, lpStart) + lpInner + '\n\n        <!-- Most Popular Posts' + newsHtml.substring(lpEnd + '</div>\n\n        <!-- Most Popular Posts'.length);
      }

      // ─── Most Popular Posts sidebar (5 items) ───
      const popularItems = items.slice(4, 9);
      const popularHtml = popularItems.map((it, i) => {
        return `          <div class="news-popular-post">
            <span class="news-popular-post__num">${i + 1}</span>
            <div class="news-popular-post__body">
              <h4 class="news-popular-post__title"><a href="posts/${it.slug}.html">${escapeHtml(it.title)}</a></h4>
              <div class="news-popular-post__meta">${it.dateFormatted} &bull; ${escapeHtml(it.source)}</div>
            </div>
          </div>`;
      }).join('\n');

      // Replace Most Popular Posts widget content
      const mpStart = newsHtml.indexOf('<div class="news-sidebar-widget" id="news-popular-posts">');
      const mpEnd = newsHtml.indexOf('</div>\n      </div>\n      <!-- Right Sidebar / End -->');
      if (mpStart !== -1 && mpEnd !== -1) {
        const mpInner = `<div class="news-sidebar-widget" id="news-popular-posts">
          <h3 class="news-sidebar-widget__title">Most Popular Posts</h3>
${popularHtml}
        </div>`;
        newsHtml = newsHtml.substring(0, mpStart) + mpInner + '\n      </div>\n      <!-- Right Sidebar / End -->' + newsHtml.substring(mpEnd + '</div>\n      </div>\n      <!-- Right Sidebar / End -->'.length);
      }

      // ─── News feed cards (remaining items on the page, skip hero) ───
      const feedItems = pageItems.slice(1);
      const feedHtml = feedItems.map(it => {
        const img = it.localImage || PLACEHOLDER_IMGS[0];
        return `      <div class="news-feed-card">
        <div class="news-feed-card__thumb"><img src="${escapeHtml(img)}" alt="${escapeHtml(it.title)}"></div>
        <div class="news-feed-card__body">
          <span class="news-feed-card__cat">${escapeHtml(it.category)}</span>
          <h4 class="news-feed-card__title"><a href="posts/${it.slug}.html">${escapeHtml(it.title)}</a></h4>
          <p class="news-feed-card__excerpt">${escapeHtml(it.excerpt)}</p>
          <div class="news-feed-card__meta">${it.dateFormatted} &bull; via ${escapeHtml(it.source)}</div>
        </div>
      </div>`;
      }).join('\n\n');

      // Replace news feed content
      const feedStart = newsHtml.indexOf('<div class="news-feed" id="news-feed">');
      const feedEnd = newsHtml.indexOf('</div>\n    <!-- News Feed / End -->');
      if (feedStart !== -1 && feedEnd !== -1) {
        const feedBlock = `<div class="news-feed" id="news-feed">
      <h3 class="news-feed__header">More News</h3>

${feedHtml}

    </div>`;
        newsHtml = newsHtml.substring(0, feedStart) + feedBlock + '\n    <!-- News Feed / End -->' + newsHtml.substring(feedEnd + '</div>\n    <!-- News Feed / End -->'.length);
      }

      // ─── Pagination ───
      const paginationHtml = buildNewsPaginationNav(page, totalPages);
      const pagStart = newsHtml.indexOf('<nav class="news-pagination"');
      const pagEnd = newsHtml.indexOf('</nav>', pagStart) + '</nav>'.length;
      if (pagStart !== -1 && pagEnd > pagStart) {
        newsHtml = newsHtml.substring(0, pagStart) + paginationHtml + newsHtml.substring(pagEnd);
      }

      const pageFilename = page === 1 ? 'news.html' : `news-${page}.html`;
      fs.writeFileSync(path.join(BUILD, pageFilename), newsHtml, 'utf8');
      console.log(`  Generated ${pageFilename} (${pageItems.length} articles)`);
    }
    console.log(`  ${totalPages} news pages total`);
  }

  console.log('\n=== Done! ===');
  console.log(`  ${generated} post pages generated`);
  console.log(`  blog-1.html updated with latest articles`);
  console.log(`  Run again anytime to refresh: npm run update-news`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
