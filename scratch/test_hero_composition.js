const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// Let's create a quick test HTML page in public/ to experiment with hero compositions without modifying index.html yet
const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hero Mobile Test</title>
    <link rel="stylesheet" href="style.css">
    <style>
        /* Test specific overrides */
    </style>
</head>
<body>
    <!-- Nav -->
    <nav class="site-nav">
        <a href="index.html" class="nav-brand">
            <img src="assets/images/big_daddy_events_logo_1200x628.png" alt="Big Daddy Events" class="brand-logo brand-logo--light" width="220" height="115">
        </a>
        <div class="nav-right">
            <div class="hamburger"><span></span><span></span><span></span></div>
        </div>
    </nav>

    <!-- Test 1: Current Hero -->
    <section class="hero" id="hero-test">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.6) 100%); z-index: 0;"></div>
        <picture>
            <source srcset="assets/images/hero/home-page.webp" type="image/webp">
            <img src="assets/images/hero/home-page.png" alt="Big Daddy Events" class="hero-image" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -1;">
        </picture>
    </section>
</body>
</html>`;

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/test_hero.html', testHtml);
console.log('Created test_hero.html');
