// Rewrite shop.html product grid with images, new products, and correct Snipcart URLs
const fs = require('fs');
const path = require('path');

const shopPath = path.join(__dirname, '..', 'build', 'shop.html');
let html = fs.readFileSync(shopPath, 'utf8');

const SITE_URL = 'https://whimsical-moonbeam-9ff2dd.netlify.app/shop.html';

// Product definitions
const products = [
  // Maps (4)
  { id: 'dungeon-map-pack-vol-1', cat: 'maps', catLabel: 'Maps &amp; Battlemaps', name: 'Dungeon Map Pack Vol. 1', desc: '20 hand-drawn dungeon maps in high-res PNG &amp; PDF. Gridded and gridless versions included.', price: 9.99, img: 'dungeon-map-pack', badge: 'Popular' },
  { id: 'wilderness-encounters-pack', cat: 'maps', catLabel: 'Maps &amp; Battlemaps', name: 'Wilderness Encounters Pack', desc: '15 outdoor battlemaps — forests, mountains, rivers, camps. Day &amp; night variants.', price: 7.99, img: 'wilderness-encounters' },
  { id: 'coastal-and-sea-maps', cat: 'maps', catLabel: 'Maps &amp; Battlemaps', name: 'Coastal &amp; Sea Maps', desc: '12 nautical battlemaps — ports, ships, sea caves, underwater ruins. Perfect for seafaring campaigns.', price: 8.99, img: 'coastal-sea-maps' },
  { id: 'tavern-inn-maps', cat: 'maps', catLabel: 'Maps &amp; Battlemaps', name: 'Tavern &amp; Inn Maps', desc: '10 unique tavern, inn, and shop interior maps. Includes furnished and unfurnished variants. VTT-ready.', price: 6.99, img: 'tavern-inn-maps', badge: 'New' },

  // Templates (4)
  { id: 'character-sheet-bundle', cat: 'templates', catLabel: 'Templates', name: 'Character Sheet Bundle', desc: 'Fillable PDF character sheets for 5e, Pathfinder, and system-agnostic play. Print-friendly design.', price: 4.99, img: 'character-sheet-bundle' },
  { id: 'session-planner-and-notes', cat: 'templates', catLabel: 'Templates', name: 'Session Planner &amp; Notes', desc: 'Printable session planner with encounter trackers, NPC logs, and campaign timeline. A4 &amp; Letter.', price: 3.99, img: 'session-planner' },
  { id: 'resume-and-cv-pack', cat: 'templates', catLabel: 'Templates', name: 'Resume &amp; CV Pack', desc: '3 modern resume templates in Word &amp; Google Docs. ATS-friendly, minimal, and creative styles.', price: 6.99, img: 'resume-cv-pack' },
  { id: 'npc-generator-cards', cat: 'templates', catLabel: 'Templates', name: 'NPC Generator Cards', desc: '60 printable NPC cards with randomized traits, motivations, secrets, and plot hooks. Cut-and-play ready.', price: 4.99, img: 'npc-generator-cards', badge: 'New' },

  // Design Assets (3)
  { id: 'fantasy-icon-set', cat: 'assets', catLabel: 'Design Assets', name: 'Fantasy Icon Set (200+)', desc: '200+ fantasy-themed icons — weapons, potions, spells, creatures. SVG &amp; PNG formats.', price: 14.99, img: 'fantasy-icon-set', badge: 'Popular' },
  { id: 'token-maker-portraits', cat: 'assets', catLabel: 'Design Assets', name: 'Token Maker Portraits (100)', desc: '100 circular character portraits for VTT tokens. Diverse races, classes, and styles.', price: 11.99, img: 'token-maker-portraits' },
  { id: 'map-asset-pack', cat: 'assets', catLabel: 'Design Assets', name: 'Map Asset Pack', desc: '250+ map-making assets — trees, buildings, furniture, terrain textures. Transparent PNG. Works with Dungeondraft &amp; Inkarnate.', price: 9.99, img: 'map-asset-pack', badge: 'New' },

  // Plugins (4)
  { id: 'dragon-dice-roller', cat: 'plugins', catLabel: 'Plugins', name: 'Dragon Dice Roller Plugin', desc: 'Advanced dice-rolling plugin for Dragon Social. Custom macros, advantage/disadvantage, roll history.', price: 0, img: 'dragon-dice-roller', free: true },
  { id: 'initiative-tracker-pro', cat: 'plugins', catLabel: 'Plugins', name: 'Initiative Tracker Pro', desc: 'Dragon plugin for combat initiative tracking. HP bars, conditions, turn timers, and encounter save/load.', price: 2.99, img: 'initiative-tracker', badge: 'New' },
  { id: 'ambience-soundboard', cat: 'plugins', catLabel: 'Plugins', name: 'Ambience Soundboard', desc: 'Dragon plugin with 50+ ambient sound loops — taverns, dungeons, forests, storms. Mixer controls.', price: 0, img: 'ambience-soundboard', free: true },
  { id: 'loot-generator-plugin', cat: 'plugins', catLabel: 'Plugins', name: 'Loot Generator Plugin', desc: 'Generate random treasure hoards, magic items, and loot tables by CR. Customizable rarity weights.', price: 1.99, img: 'loot-generator' },

  // Tools (3)
  { id: 'budget-tracker-spreadsheet', cat: 'tools', catLabel: 'Tools', name: 'Budget Tracker Spreadsheet', desc: 'Google Sheets &amp; Excel budget tracker. Automated categories, monthly summaries, visual charts.', price: 5.99, img: 'budget-tracker' },
  { id: 'encounter-calculator', cat: 'tools', catLabel: 'Tools', name: 'Encounter Calculator', desc: 'Balance combat encounters for 5e and PF2e. Input party size, levels, and CR — get difficulty ratings and XP totals.', price: 3.99, img: 'encounter-calculator', badge: 'New' },
  { id: 'campaign-wiki-template', cat: 'tools', catLabel: 'Tools', name: 'Campaign Wiki Template', desc: 'Notion &amp; Obsidian templates for organizing your campaign world — locations, NPCs, factions, session logs, and lore.', price: 4.99, img: 'campaign-wiki-template' },

  // Streaming (8)
  { id: 'dragon-s-shadow-obs-overlay-pack', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: "Dragon's Den OBS Overlay Pack", desc: 'Complete stream overlay set — webcam frame, alerts, panels, screens (starting, BRB, ending). Dark fantasy theme. PNG &amp; PSD sources.', price: 14.99, img: 'obs-overlay-pack', badge: 'Popular' },
  { id: 'minimal-stream-alerts-free', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Minimal Stream Alerts (Free)', desc: 'Clean follow, sub, and donation alert animations. Dragon-themed with customizable accent color. Works with StreamElements &amp; Streamlabs.', price: 0, img: 'minimal-stream-alerts', free: true, badge: 'Free' },
  { id: 'animated-stinger-transitions', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Animated Stinger Transitions', desc: '6 animated scene transitions (WEBM with alpha) — dragon swipe, flame wipe, smoke, portal, slash, and fade.', price: 9.99, img: 'stinger-transitions', badge: 'New' },
  { id: 'stream-info-panels-20-pack', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Stream Info Panels (20-Pack)', desc: 'Twitch/YouTube profile panels — About, Schedule, Rules, Donate, Discord, Social, FAQ. Dark fantasy style. PNG + editable PSD.', price: 7.99, img: 'stream-info-panels' },
  { id: 'webcam-border-frames-10-pack', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Webcam Border Frames (10-Pack)', desc: '10 dragon/fantasy webcam frames in PNG with transparency. Sizes for 16:9 and circle cams. Color variants included.', price: 4.99, img: 'webcam-frames' },
  { id: 'stream-starting-screen-kit', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Stream Starting Screen Kit', desc: 'Animated Starting Soon, BRB, and Stream Ending screens with countdown timer. Dragon theme with particle effects. MP4 &amp; WEBM.', price: 12.99, img: 'stream-starting-kit' },
  { id: 'stream-schedule-template', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Stream Schedule Template', desc: 'Weekly schedule graphic templates — PSD, Figma, and Canva link. Swap colors and text. Share-ready for Twitter, Discord, and Twitch panels.', price: 5.99, img: 'stream-schedule' },
  { id: 'ultimate-streamer-bundle', cat: 'streaming', catLabel: 'Streaming &amp; OBS', name: 'Ultimate Streamer Bundle', desc: 'Everything you need — overlays, alerts, transitions, panels, webcam frames, screens, schedule. Save 40% vs buying separately.', price: 19.99, img: 'ultimate-streamer-bundle', badge: 'Best Value' }
];

function buildCard(p) {
  const badgeHtml = p.badge ? `\n\t\t\t\t\t\t\t\t\t<div class="shop-card__badge">${p.badge}</div>` : '';
  const priceLabel = p.price === 0 ? 'Free' : `$${p.price.toFixed(2)}`;
  
  let btnHtml;
  if (p.free) {
    btnHtml = `<button class="btn btn-primary btn-sm">Download</button>`;
  } else {
    btnHtml = `<button class="btn btn-primary btn-sm snipcart-add-item"
\t\t\t\t\t\t\t\t\t\tdata-item-id="${p.id}"
\t\t\t\t\t\t\t\t\t\tdata-item-name="${p.name.replace(/&amp;/g, '&')}"
\t\t\t\t\t\t\t\t\t\tdata-item-price="${p.price.toFixed(2)}"
\t\t\t\t\t\t\t\t\t\tdata-item-url="${SITE_URL}"
\t\t\t\t\t\t\t\t\t\tdata-item-description="${p.desc.replace(/&amp;/g, '&')}"
\t\t\t\t\t\t\t\t\t\tdata-item-categories="${p.cat}">Add to Cart</button>`;
  }

  return `
\t\t\t\t\t\t\t<div class="shop-card" data-category="${p.cat}" data-price="${p.price}" data-name="${p.name.replace(/&amp;/g, '&amp;')}">
\t\t\t\t\t\t\t\t<div class="shop-card__img">${badgeHtml}
\t\t\t\t\t\t\t\t\t<img class="shop-card__thumb" src="assets/img/shop/${p.img}.svg" alt="${p.name.replace(/&amp;/g, '&')}">
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t<div class="shop-card__body">
\t\t\t\t\t\t\t\t\t<div class="shop-card__category">${p.catLabel}</div>
\t\t\t\t\t\t\t\t\t<h5 class="shop-card__title">${p.name}</h5>
\t\t\t\t\t\t\t\t\t<p class="shop-card__desc">${p.desc}</p>
\t\t\t\t\t\t\t\t\t<div class="shop-card__footer">
\t\t\t\t\t\t\t\t\t\t<span class="shop-card__price">${priceLabel}</span>
\t\t\t\t\t\t\t\t\t\t${btnHtml}
\t\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t\t</div>
\t\t\t\t\t\t\t</div>`;
}

const gridHtml = `\t\t\t\t\t\t<!-- Product Grid -->
\t\t\t\t\t\t<div class="shop-grid" id="shopGrid">${products.map(buildCard).join('\n')}

\t\t\t\t\t\t</div>`;

// Replace old grid
const gridStart = html.indexOf('<!-- Product Grid -->');
const gridEnd = html.indexOf('<!-- No results message -->');
if (gridStart === -1 || gridEnd === -1) {
  console.error('Could not find product grid markers!');
  process.exit(1);
}

html = html.substring(0, gridStart) + gridHtml + '\n\t\t\t\t\t\t' + html.substring(gridEnd);

// Also fix the product count
html = html.replace(/<span id="shopCount">\d+<\/span> products/, `<span id="shopCount">${products.length}</span> products`);

// Fix ALL Snipcart URLs from dragonsshadow.com to actual live URL
html = html.replace(/data-item-url="https:\/\/dragonsshadow\.com\/shop\.html"/g, `data-item-url="${SITE_URL}"`);

fs.writeFileSync(shopPath, html, 'utf8');
console.log(`Rewrote shop grid: ${products.length} products with images and Snipcart URLs`);
