const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hero Mobile Perfected Test 3</title>
    <link rel="stylesheet" href="style.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        .site-nav .logo img {
            height: 38px !important;
            width: auto !important;
            object-fit: contain;
        }

        .hero {
            position: relative;
            width: 100%;
            min-height: 100svh;
            height: 100svh;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            align-items: center;
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
            object-position: 50% 50%;
            display: block;
        }

        /* Ambient dark vignette for overall cinematic contrast */
        .hero-vignette {
            position: absolute;
            inset: 0;
            z-index: 2;
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.7) 0%,
                rgba(3, 27, 22, 0.35) 40%,
                rgba(3, 27, 22, 0.05) 70%,
                rgba(3, 27, 22, 0.85) 100%
            );
            pointer-events: none;
        }

        /* Dissolve mask: Blurs and dissolves the baked text into misty mountain ambience */
        .hero-dissolve-scrim {
            position: absolute;
            inset: 0;
            z-index: 3;
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 35%,
                rgba(3, 27, 22, 0.94) 65%,
                rgba(3, 27, 22, 0.45) 72%,
                rgba(3, 27, 22, 0) 78%
            );
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            mask-image: linear-gradient(to bottom, black 0%, black 67%, transparent 77%);
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 67%, transparent 77%);
            pointer-events: none;
        }

        /* Mobile Hero Content */
        .hero-content-mobile {
            position: relative;
            z-index: 10;
            width: 100%;
            max-width: 370px;
            padding: calc(4.6rem + var(--safe-top)) 1.25rem 0.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
        }

        .mobile-hero-badge {
            margin-bottom: 0.85rem;
            display: flex;
            justify-content: center;
        }

        .mobile-hero-badge img {
            height: 56px;
            width: auto;
            max-width: 200px;
            object-fit: contain;
            filter: drop-shadow(0 3px 12px rgba(0,0,0,0.85));
        }

        .mobile-hero-location {
            font-family: var(--font-body);
            font-size: 0.72rem;
            letter-spacing: 0.36em;
            color: var(--color-accent);
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 0.65rem;
            text-shadow: 0 2px 10px rgba(0,0,0,0.9);
        }

        .mobile-hero-title {
            font-family: var(--font-display);
            font-size: clamp(2.35rem, 10.5vw, 3.1rem);
            font-weight: 400;
            line-height: 1.04;
            letter-spacing: 0.08em;
            color: #ffffff;
            text-transform: uppercase;
            margin-bottom: 0.65rem;
            text-shadow: 0 4px 20px rgba(0,0,0,0.95);
        }

        .mobile-hero-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            max-width: 130px;
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
            font-size: 0.45rem;
        }

        .mobile-hero-tagline {
            font-family: var(--font-body);
            font-size: 0.72rem;
            letter-spacing: 0.22em;
            color: rgba(245, 240, 235, 0.92);
            text-transform: uppercase;
            font-weight: 500;
            margin-bottom: 1.5rem;
            text-shadow: 0 2px 10px rgba(0,0,0,0.9);
        }

        .mobile-hero-ctas {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            width: 100%;
            max-width: 270px;
        }

        .mobile-btn-primary {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0.85rem 1.5rem;
            background: var(--color-accent);
            color: var(--color-primary);
            font-family: var(--font-body);
            font-size: 0.76rem;
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
            padding: 0.8rem 1.5rem;
            background: rgba(255, 255, 255, 0.08);
            color: #ffffff;
            font-family: var(--font-body);
            font-size: 0.74rem;
            font-weight: 500;
            letter-spacing: 0.15em;
            text-transform: uppercase;
            text-decoration: none;
            border: 1px solid rgba(255, 255, 255, 0.28);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            border-radius: 2px;
            transition: all 0.3s ease;
        }
    </style>
</head>
<body>
    <!-- Site nav with transparent white logo -->
    <nav class="site-nav">
        <a href="index.html" class="logo">
            <img src="assets/images/big-daddy-events-logo-white.png" alt="Big Daddy Events" class="nav-logo-img">
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
        <div class="hero-vignette"></div>
        <div class="hero-dissolve-scrim"></div>
        
        <div class="hero-content-mobile">
            <div class="mobile-hero-badge">
                <img src="assets/images/big-daddy-events-logo-white.png" alt="Big Daddy Events Crest">
            </div>
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

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/test_hero_dissolve.html', html);

const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\test_hero_perfect3_390.png`;
execSync(`"${edgePath}" --headless=new --window-size=390,844 --hide-scrollbars --screenshot="${outPath}" "http://localhost:3000/test_hero_dissolve.html"`);
console.log('Saved test_hero_perfect3_390.png');
