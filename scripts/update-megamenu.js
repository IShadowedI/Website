const fs = require('fs');
const path = require('path');
const glob = require('glob');

const buildDir = path.join(__dirname, '..', 'build');
const files = glob.sync('**/*.html', { cwd: buildDir, absolute: true });

// New mega-menu with {P} placeholder for path prefix ('' or '../')
const newMenu = `<div class="main-nav__megamenu">
							<div class="row">
								<div class="col-md-3 mega-col">
									<div class="mega-col__title"><span class="mega-icon"><img src="{P}assets/img/dragon/app/d20.png" class="mega-icon-img" alt="Projects"></span> Project Pages</div>
									<ul>
										<li><a href="{P}dragon.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/Dragon Horn Logo.png" class="mega-link-icon-img" alt="Dragon"></span>Dragon Social</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/crystal-ball.png" class="mega-link-icon-img" alt="Little Grotto"></span>Little Grotto</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/coin.png" class="mega-link-icon-img" alt="Shadow Coin"></span>Shadow Coin</a></li>
									</ul>
								</div>
								<div class="col-md-3 mega-col">
									<div class="mega-col__title"><span class="mega-icon"><img src="{P}assets/img/dragon/app/anvil.png" class="mega-icon-img" alt="Tools"></span> Tools and Utilities</div>
									<ul>
										<li><a href="{P}tools.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/anvil.png" class="mega-link-icon-img" alt="Tools"></span>Tool Suite</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/monitor.png" class="mega-link-icon-img" alt="Utilities"></span>Utilities</a></li>
										<li><a href="{P}plugins.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/spellbook.png" class="mega-link-icon-img" alt="Plugins"></span>Plugins</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/shield.png" class="mega-link-icon-img" alt="Mods"></span>Mods</a></li>
									</ul>
								</div>
								<div class="col-md-3 mega-col">
									<div class="mega-col__title"><span class="mega-icon"><img src="{P}assets/img/dragon/app/mana.png" class="mega-icon-img" alt="Community"></span> Community</div>
									<ul>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/magnifying-glass-icon.png" class="mega-link-icon-img" alt="Browse"></span>Browse Community Creations</a></li>
										<li><a href="{P}plugins-submit.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/teleport.png" class="mega-link-icon-img" alt="Submit Plugin"></span>Submit a Plugin</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/edit.png" class="mega-link-icon-img" alt="Submit Mod"></span>Submit a Mod</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/scroll.png" class="mega-link-icon-img" alt="Docs"></span>Creation Docs</a></li>
									</ul>
								</div>
								<div class="col-md-3 mega-col">
									<div class="mega-col__title"><span class="mega-icon"><img src="{P}assets/img/dragon/app/crystal-ball.png" class="mega-icon-img" alt="Details"></span> Details</div>
									<ul>
										<li><a href="{P}about.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/scroll.png" class="mega-link-icon-img" alt="About"></span>About</a></li>
										<li><a href="#"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/swords.png" class="mega-link-icon-img" alt="Apply"></span>Apply</a></li>
										<li><a href="{P}contact.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/inbox-icon.png" class="mega-link-icon-img" alt="Contact"></span>Contact</a></li>
										<li><a href="{P}login-register.html"><span class="mega-link-icon"><img src="{P}assets/img/dragon/app/user-icon.png" class="mega-link-icon-img" alt="Account"></span>Account</a></li>
									</ul>
								</div>
							</div>
						</div>`;

let count = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  if (!html.includes('main-nav__megamenu')) continue;

  // Determine prefix: posts/ uses ../, root uses ''
  const rel = path.relative(buildDir, file);
  const prefix = rel.includes(path.sep) ? '../' : '';

  // Build the replacement with correct prefix
  const replacement = newMenu.replace(/\{P\}/g, prefix);

  // Match and replace the entire megamenu div
  const megaStart = html.indexOf('<div class="main-nav__megamenu">');
  if (megaStart === -1) continue;

  // Find the closing tag - count nested divs
  let depth = 0;
  let megaEnd = -1;
  let i = megaStart;
  while (i < html.length) {
    if (html.substr(i, 4) === '<div') {
      depth++;
    } else if (html.substr(i, 6) === '</div>') {
      depth--;
      if (depth === 0) {
        megaEnd = i + 6; // include </div>
        break;
      }
    }
    i++;
  }

  if (megaEnd === -1) {
    console.log(`  WARNING: Could not find closing div for megamenu in ${rel}`);
    continue;
  }

  const before = html.substring(0, megaStart);
  const after = html.substring(megaEnd);
  html = before + replacement + after;

  fs.writeFileSync(file, html);
  count++;
}

console.log(`Updated mega-menu in ${count} files`);
