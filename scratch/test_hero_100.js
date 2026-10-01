const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hero Mobile 100% Test</title>
    <link rel="stylesheet" href="style.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .hero {
            position: relative;
            width: 100%;
            min-height: 100svh;
            height: 100svh;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            overflow: hidden;
            background: #031b16;
            padding-bottom: calc(2.5rem + var(--safe-bottom));
        }

        .hero-bg-media {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
        }

        .hero-bg-media img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: right 15% center;
            display: block;
        }

        /* Gradient scrim: dark at top for navbar & brand title, fades to showcase the altar, table & tea gardens */
        .hero-overlay {
            position: absolute;
            inset: 0;
            z-index: 2;
            background: linear-gradient(
                180deg,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.65) 30%,
                rgba(3, 27, 22, 0.35) 55%,
                rgba(3, 27, 22, 0.82) 88%,
                rgba(3, 27, 22, 0.98) 100%
            );
        }

        /* Mobile Hero Content */
        .hero-content-mobile {
            position: relative;
            z-index: 10;
            width: 100%;
            padding: 0 1.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-bottom: auto;
            margin-top: calc(5.5rem + var(--safe-top));
        }

        .mobile-hero-location {
            font-family: var(--font-body);
            font-size: 0.72rem;
            letter-spacing: 0.35em;
            color: var(--color-accent);
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 0.65rem;
            text-shadow: 0 2px 8px rgba(0,0,0,0.9);
        }

        .mobile-hero-title {
            font-family: var(--font-display);
            font-size: clamp(2.35rem, 10vw, 3rem);
            font-weight: 400;
            line-height: 1.04;
            letter-spacing: 0.08em;
            color: #ffffff;
            text-transform: uppercase;
            margin-bottom: 0.65rem;
            text-shadow: 0 3px 15px rgba(0,0,0,0.9);
        }

        .mobile-hero-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            max-width: 140px;
            margin-bottom: 0.65rem;
        }

        .mobile-hero-divider::before,
        .mobile-hero-divider::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--color-accent));
        }
        .mobile-hero-divider::after {
            background: linear-gradient(90deg, var(--color-accent), transparent);
        }
        .mobile-hero-divider span {
            color: var(--color-accent);
            font-size: 0.5rem;
        }

        .mobile-hero-tagline {
            font-family: var(--font-body);
            font-size: 0.72rem;
            letter-spacing: 0.22em;
            color: rgba(245, 240, 235, 0.9);
            text-transform: uppercase;
            font-weight: 400;
            margin-bottom: 1.5rem;
            text-shadow: 0 2px 10px rgba(0,0,0,0.9);
        }

        .mobile-hero-ctas {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            width: 100%;
            max-width: 280px;
        }

        .mobile-btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.85rem 1.5rem;
            background: var(--color-accent);
            color: var(--color-primary);
            font-family: var(--font-body);
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            text-decoration: none;
            border-radius: 2px;
            box-shadow: 0 4px 15px rgba(184, 156, 109, 0.3);
            transition: all 0.3s ease;
        }

        .mobile-btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.8rem 1.5rem;
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            font-family: var(--font-body);
            font-size: 0.75rem;
            font-weight: 500;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            text-decoration: none;
            border: 1px solid rgba(255, 255, 255, 0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-radius: 2px;
            transition: all 0.3s ease;
        }
    </style>
</head>
<body>
    <!-- Nav bar -->
    <nav class="site-nav">
        <a href="index.html" class="nav-brand">
            <img src="assets/images/big_daddy_events_logo_1200x628.png" alt="Big Daddy Events" class="brand-logo brand-logo--light" width="220" height="115">
        </a>
        <div class="nav-right">
            <div class="hamburger"><span></span><span></span><span></span></div>
        </div>
    </nav>

    <section class="hero">
        <div class="hero-bg-media">
            <picture>
                <source srcset="assets/images/hero/home-page.webp" type="image/webp">
                <img src="assets/images/hero/home-page.png" alt="Big Daddy Events Munnar">
            </picture>
        </div>
        <div class="hero-overlay"></div>
        
        <div class="hero-content-mobile">
            <div class="mobile-hero-location">MUNNAR &bull; KERALA &bull; INDIA</div>
            <h1 class="mobile-hero-title">BIG DADDY<br>EVENTS</h1>
            <div class="mobile-hero-divider"><span>♦</span></div>
            <p class="mobile-hero-tagline">LUXURY WEDDINGS &amp; EVENTS</p>
            <div class="mobile-hero-ctas">
                <a href="contact.html" class="mobile-btn-primary">PLAN YOUR WEDDING &rarr;</a>
                <a href="packages.html" class="mobile-btn-secondary">EXPLORE PACKAGES</a>
            </div>
        </div>
    </section>
</body>
</html>`;

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/test_hero_100.html', html);

const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\test_hero_100_390.png`;
execSync(`"${edgePath}" --headless=new --window-size=390,844 --hide-scrollbars --screenshot="${outPath}" "http://localhost:3000/test_hero_100.html"`);
console.log('Saved test_hero_100_390.png');
