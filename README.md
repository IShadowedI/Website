Opens the site at **http://localhost:3001**.

## Pages

| Section | Pages |
|---------|-------|
| **Landing** | `index.html` (image bg), `index-2.html` (video bg) |
| **Home** | `home.html` (news feed + featured players carousel) |
| **Team** | `team-selection-*.html`, `team-overview.html`, `team-player-*.html`, `management-and-staff.html`, `staff-member.html` |
| **Matches** | `matches-scores.html`, `matches-upcoming.html`, `matches-standings.html`, `matches-stats-*.html`, `matches-lineups-*.html`, `matches-overview-*.html`, `matches-replay.html` |
| **News/Blog** | `blog-1.html` through `blog-4.html`, `blog-classic.html`, `blog-post.html` |
| **Shop** | `shop.html`, `shop-product.html`, `shop-checkout.html`, `shop-account-*.html` |
| **Streams** | `streams-archive.html` |
| **Features** | `features-about-us.html`, `features-contact-us.html`, `features-faqs.html`, `features-404.html` |
| **Utility** | `login-register.html`, `partners.html` |

## Customization

### Content
Edit the HTML files directly in `build/`. Key files:
- `build/index.html` — Landing page hero and branding
- `build/home.html` — Main homepage with news feed
- `build/assets/css/custom.css` — Add custom CSS overrides here

### Images
Replace images in `build/assets/img/`:
- `logo.png` / `logo@2x.png` — Site logo
- `samples/` — Team, player, and content images
- `favicons/` — Browser favicon files

### Colors / Styling
All styling in `build/assets/css/style.css`. For overrides, use `custom.css`.

## Build System (Optional)

If you have the full source files (Handlebars + SCSS), you can use the Gulp pipeline:

```bash
npm install          # Install Gulp + dependencies (requires Node 16)
npm start            # Build + watch + BrowserSync dev server 
npm run build        # Production build (minified)
```

**Note:** The Gulp build requires Node.js 16 and the source Handlebars templates in `source/`. The `build/` folder already contains pre-compiled production-ready files.

## Deploy to Netlify (Free)

1. Push this repo to GitHub
2. Go to [netlify.com](https://netlify.com) → Import project
3. Set publish directory to `build`
4. Deploy — done!

The `netlify.toml` is already configured. Free tier includes:
- 100GB bandwidth/month
- Custom domain + HTTPS
- Continuous deploys from Git

## Tech Stack

- **CSS:** Bootstrap + Custom SCSS (compiled)
- **JS:** jQuery, Bootstrap, Slick Carousel, Isotope, Magnific Popup, CountUp, Countdown
- **Icons:** Font Awesome + Custom SVG Sprites
- **Fonts:** Rajdhani (Google Fonts)
- **Build:** Gulp + Panini (Handlebars) + SCSS
