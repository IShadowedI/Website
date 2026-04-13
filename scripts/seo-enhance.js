/**
 * SEO Enhancement Script
 * Adds Open Graph, Twitter Card, canonical links, JSON-LD,
 * preconnect hints, and manifest reference to all pages.
 */

const fs = require('fs');
const path = require('path');
const buildDir = path.join(__dirname, '..', 'build');

const SITE_URL = 'https://dragonsshadow.com';
const SITE_NAME = "Dragon's Den";
const DEFAULT_IMAGE = 'assets/img/dragon/app/DragonCircleLogo.png';
const TWITTER_HANDLE = '@DragonsDen';

// Per-page SEO metadata overrides
const PAGE_META = {
  'home.html': {
    ogTitle: "Dragon's Den — Tabletop & Creator Hub",
    ogDesc: 'Tools, news, and resources for tabletop gamers, streamers, and content creators.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: 'Tools, news, and resources for tabletop gamers, streamers, and content creators.',
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL }
    }
  },
  'dragon.html': {
    ogTitle: 'Dragon Social — The social platform forged for gamers',
    ogDesc: 'Unite your party. A social platform built for tabletop gamers, campaign tracking, and group coordination.',
    ogImage: 'assets/img/dragon/app/DragonCircleLogo.png',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Dragon Social',
      applicationCategory: 'SocialNetworkingApplication',
      operatingSystem: 'Web',
      description: 'The social platform forged for gamers — campaign tracking, group coordination, and party management.',
      url: SITE_URL + '/dragon.html',
      publisher: { '@type': 'Organization', name: SITE_NAME }
    }
  },
  'shadow-coin.html': {
    ogTitle: 'Shadow Coin — Smart Crypto Arbitrage Engine',
    ogDesc: 'Spot the gap. Seize the margin. Automated crypto arbitrage scanning across multiple exchanges.',
    ogImage: 'assets/img/dragon/app/ShadowCoinLogo.png',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Shadow Coin',
      applicationCategory: 'FinanceApplication',
      operatingSystem: 'Web, Windows, macOS',
      description: 'Smart crypto arbitrage engine — automated scanning across multiple exchanges.',
      url: SITE_URL + '/shadow-coin.html',
      publisher: { '@type': 'Organization', name: SITE_NAME }
    }
  },
  'little-grotto.html': {
    ogTitle: 'Little Grotto — A cozy world of gardens and quiet adventures',
    ogDesc: 'Tend your grotto, befriend creatures, and discover the quiet magic hidden in every corner.',
    ogImage: 'assets/img/dragon/app/GodotImage.png',
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'VideoGame',
      name: 'Little Grotto',
      genre: ['Simulation', 'Adventure', 'Casual'],
      description: 'A peaceful world of gardens, creatures, and quiet adventures.',
      url: SITE_URL + '/little-grotto.html',
      publisher: { '@type': 'Organization', name: SITE_NAME }
    }
  },
  'shop.html': {
    ogTitle: "Dragon's Den — Digital Shop",
    ogDesc: 'OBS tools, stream overlays, tabletop assets, and creator resources.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: "Dragon's Den Digital Shop",
      description: 'OBS tools, stream overlays, tabletop assets, and creator resources.',
      url: SITE_URL + '/shop.html'
    }
  },
  'blog-classic.html': {
    ogTitle: "Dragon's Den — News & Articles",
    ogDesc: 'The latest tabletop gaming news, creator spotlights, and community updates.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: "Dragon's Den News",
      description: 'The latest tabletop gaming news, creator spotlights, and community updates.',
      url: SITE_URL + '/blog-classic.html'
    }
  },
  'about.html': {
    ogTitle: "About Dragon's Den",
    ogDesc: 'Learn about the team, mission, and community behind the Dragon\'s Shadow tabletop & creator hub.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website',
    schema: {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: "About Dragon's Den",
      description: "Learn about the team, mission, and community behind Dragon's Den.",
      url: SITE_URL + '/about.html'
    }
  },
  'contact.html': {
    ogTitle: "Contact Dragon's Den",
    ogDesc: 'Get in touch with the Dragon\'s Shadow team — questions, feedback, or partnership inquiries.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website'
  },
  'plugins.html': {
    ogTitle: "Dragon's Den — Plugins & Extensions",
    ogDesc: 'Browse community-built plugins, mods, and extensions for the Dragon\'s Shadow ecosystem.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website'
  },
  'api.html': {
    ogTitle: "Dragon's Den — API Service",
    ogDesc: 'Developer API access for building tools and integrations on the Dragon\'s Shadow platform.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website'
  }
};

// Performance hint tags to inject (preconnect to external domains)
const PERF_HINTS = `
	<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link rel="dns-prefetch" href="https://cdn.snipcart.com">
	<link rel="dns-prefetch" href="https://pagead2.googlesyndication.com">`;

let updatedCount = 0;

function getPageMeta(filename) {
  if (PAGE_META[filename]) return PAGE_META[filename];

  // Blog posts
  if (filename.startsWith('blog-classic-') || filename.startsWith('blog-')) {
    return {
      ogTitle: "Dragon's Den — News",
      ogDesc: 'Tabletop gaming news, creator spotlights, and community updates.',
      ogImage: DEFAULT_IMAGE,
      ogType: 'website'
    };
  }

  // Tool pages
  if (filename.startsWith('tools-')) {
    const toolName = filename.replace('tools-', '').replace('.html', '').replace(/-/g, ' ');
    const capitalized = toolName.replace(/\b\w/g, c => c.toUpperCase());
    return {
      ogTitle: `${capitalized} — Free Online Tool | Dragon's Den`,
      ogDesc: `Use the free ${capitalized} tool from Dragon's Den tool suite. No sign-up required.`,
      ogImage: DEFAULT_IMAGE,
      ogType: 'website'
    };
  }

  // Dragon sub-pages
  if (filename.startsWith('dragon-')) {
    const sub = filename.replace('dragon-', '').replace('.html', '').replace(/-/g, ' ');
    const capitalized = sub.replace(/\b\w/g, c => c.toUpperCase());
    return {
      ogTitle: `Dragon Social — ${capitalized}`,
      ogDesc: `${capitalized} page for Dragon Social, the social platform forged for gamers.`,
      ogImage: 'assets/img/dragon/app/DragonCircleLogo.png',
      ogType: 'website'
    };
  }

  // Default fallback
  return {
    ogTitle: "Dragon's Den — Tabletop & Creator Hub",
    ogDesc: 'Tools, news, and resources for tabletop gamers, streamers, and content creators.',
    ogImage: DEFAULT_IMAGE,
    ogType: 'website'
  };
}

function buildOgTags(filename, meta) {
  const url = `${SITE_URL}/${filename}`;
  const imgUrl = `${SITE_URL}/${meta.ogImage}`;
  return `
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content="${meta.ogType}">
	<meta property="og:url" content="${url}">
	<meta property="og:title" content="${meta.ogTitle}">
	<meta property="og:description" content="${meta.ogDesc}">
	<meta property="og:image" content="${imgUrl}">
	<meta property="og:site_name" content="${SITE_NAME}">

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image">
	<meta name="twitter:url" content="${url}">
	<meta name="twitter:title" content="${meta.ogTitle}">
	<meta name="twitter:description" content="${meta.ogDesc}">
	<meta name="twitter:image" content="${imgUrl}">

	<!-- Canonical -->
	<link rel="canonical" href="${url}">`;
}

function buildSchemaTag(meta) {
  if (!meta.schema) return '';
  return `\n\t<script type="application/ld+json">${JSON.stringify(meta.schema)}</script>`;
}

function processFile(filepath) {
  const filename = path.basename(filepath);
  let content = fs.readFileSync(filepath, 'utf8');

  // Skip if already has OG tags (e.g., tools.html)
  if (content.includes('og:title')) return;

  const meta = getPageMeta(filename);
  const ogTags = buildOgTags(filename, meta);
  const schemaTag = buildSchemaTag(meta);

  // Insert OG/Twitter/canonical after viewport meta tag
  const viewportPattern = /<meta name="viewport"[^>]*>/;
  const viewportMatch = content.match(viewportPattern);
  if (viewportMatch) {
    const insertPos = content.indexOf(viewportMatch[0]) + viewportMatch[0].length;
    content = content.slice(0, insertPos) + ogTags + content.slice(insertPos);
  }

  // Insert schema before </head>
  if (schemaTag) {
    content = content.replace('</head>', schemaTag + '\n</head>');
  }

  // Add perf hints if not already present
  if (!content.includes('preconnect')) {
    // Insert after charset meta
    const charsetPattern = /<meta charset="utf-8">/;
    const charsetMatch = content.match(charsetPattern);
    if (charsetMatch) {
      const insertPos = content.indexOf(charsetMatch[0]) + charsetMatch[0].length;
      content = content.slice(0, insertPos) + PERF_HINTS + content.slice(insertPos);
    }
  }

  // Add manifest link if not present
  if (!content.includes('manifest')) {
    content = content.replace('</head>', '\t<link rel="manifest" href="/manifest.json">\n</head>');
  }

  fs.writeFileSync(filepath, content, 'utf8');
  updatedCount++;
}

// Process all top-level HTML files in build/
const files = fs.readdirSync(buildDir).filter(f => f.endsWith('.html'));
files.forEach(f => processFile(path.join(buildDir, f)));

// Also process blog post files
const postsDir = path.join(buildDir, 'posts');
if (fs.existsSync(postsDir)) {
  fs.readdirSync(postsDir).filter(f => f.endsWith('.html')).forEach(f => {
    processFile(path.join(postsDir, f));
  });
}

console.log(`SEO enhanced: ${updatedCount} files updated`);
