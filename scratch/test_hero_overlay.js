const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hero Mobile Composition Test</title>
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
            justify-content: center;
            align-items: center;
            text-align: center;
            overflow: hidden;
            background: #031b16;
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
            object-position: 75% 50%;
            display: block;
        }

        /* Scrim overlay: soft deep emerald/charcoal gradient that obscures baked text while keeping lush hills visible */
        .hero-overlay {
            position: absolute;
            inset: 0;
            z-index: 2;
            background: radial-gradient(circle at 50% 45%, rgba(3, 27, 22, 0.82) 0%, rgba(3, 27, 22, 0.7) 60%, rgba(3, 27, 22, 0.88) 100%),
                        linear-gradient(to bottom, rgba(3, 27, 22, 0.75) 0%, rgba(3, 27, 22, 0.3) 50%, rgba(3, 27, 22, 0.95) 100%);
            backdrop-filter: blur(2px);
            -webkit-backdrop-filter: blur(2px);
        }

        /* Mobile Hero Content */
        .hero-content-mobile {
            position: relative;
            z-index: 10;
            padding: 0 1.5rem;
            max-width: 360px;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-top: 1rem;
        }

        .mobile-hero-badge {
            display: inline-block;
            margin-bottom: 0.75rem;
        }

        .mobile-hero-badge img {
            width: 52px;
            height: auto;
            filter: drop-shadow(0 4px 12px rgba(0,0,0,0.5));
        }

        .mobile-hero-location {
            font-family: var(--font-body);
            font-size: 0.72rem;
            letter-spacing: 0.32em;
            color: var(--color-accent);
            text-transform: uppercase;
            font-weight: 500;
            margin-bottom: 0.65rem;
            text-shadow: 0 2px 8px rgba(0,0,0,0.8);
        }

        .mobile-hero-title {
            font-family: var(--font-display);
            font-size: clamp(2.4rem, 10.5vw, 3.1rem);
            font-weight: 400;
            line-height: 1.05;
            letter-spacing: 0.08em;
            color: #ffffff;
            text-transform: uppercase;
            margin-bottom: 0.75rem;
            text-shadow: 0 4px 20px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8);
        }

        .mobile-hero-divider {
            width: 60px;
            height: 1px;
            background: linear-gradient(90deg, transparent, var(--color-accent), transparent);
            margin-bottom: 0.75rem;
            position: relative;
        }

        .mobile-hero-divider::after {
            content: '♦';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 0.45rem;
            color: var(--color-accent);
            background: #031b16;
            padding: 0 4px;
        }

        .mobile-hero-tagline {
            font-family: var(--font-body);
            font-size: 0.75rem;
            letter-spacing: 0.22em;
            color: rgba(245, 240, 235, 0.88);
            text-transform: uppercase;
            font-weight: 400;
            margin-bottom: 2rem;
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
            padding: 0.9rem 1.5rem;
            background: var(--color-accent);
            color: var(--color-primary);
            font-family: var(--font-body);
            font-size: 0.78rem;
            font-weight: 600;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            text-decoration: none;
            border-radius: 2px;
            box-shadow: 0 6px 20px rgba(184, 156, 109, 0.35);
            transition: all 0.3s ease;
        }

        .mobile-btn-secondary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.85rem 1.5rem;
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            font-family: var(--font-body);
            font-size: 0.75rem;
            font-weight: 500;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            text-decoration: none;
            border: 1px solid rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-radius: 2px;
            transition: all 0.3s ease;
        }
    </style>
</head>
<body>
    <section class="hero">
        <div class="hero-bg-media">
            <picture>
                <source srcset="assets/images/hero/home-page.webp" type="image/webp">
                <img src="assets/images/hero/home-page.png" alt="Big Daddy Events Munnar">
            </picture>
        </div>
        <div class="hero-overlay"></div>
        
        <div class="hero-content-mobile">
            <div class="mobile-hero-badge">
                <img src="assets/images/big_daddy_events_logo_1200x628.png" alt="Big Daddy Events Crest">
            </div>
            <div class="mobile-hero-location">MUNNAR &bull; KERALA &bull; INDIA</div>
            <h1 class="mobile-hero-title">BIG DADDY<br>EVENTS</h1>
            <div class="mobile-hero-divider"></div>
            <p class="mobile-hero-tagline">LUXURY WEDDINGS &amp; EVENTS</p>
            <div class="mobile-hero-ctas">
                <a href="contact.html" class="mobile-btn-primary">PLAN YOUR WEDDING &rarr;</a>
                <a href="packages.html" class="mobile-btn-secondary">EXPLORE PACKAGES</a>
            </div>
        </div>
    </section>
</body>
</html>`;

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/test_hero_overlay.html', html);

const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\test_overlay_390.png`;
execSync(`"${edgePath}" --headless=new --window-size=390,844 --hide-scrollbars --screenshot="${outPath}" "http://localhost:3000/test_hero_overlay.html"`);
console.log('Saved test_overlay_390.png');
