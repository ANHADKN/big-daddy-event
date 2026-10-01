const { spawn } = require('child_process');
const fs = require('fs');

const VIEWPORTS = [
    { name: 'Mobile 390x844', width: 390, height: 844 },
    { name: 'Mobile 412x915', width: 412, height: 915 },
    { name: 'Mobile 480x900', width: 480, height: 900 },
    { name: 'Tablet 768x1024', width: 768, height: 1024 },
    { name: 'Tablet 820x1180', width: 820, height: 1180 },
    { name: 'Large Tablet 1024x1366', width: 1024, height: 1366 },
    { name: 'Compact Laptop 1280x800', width: 1280, height: 800 },
    { name: 'Standard Laptop 1366x768', width: 1366, height: 768 },
    { name: 'Desktop Monitor 1440x900', width: 1440, height: 900 },
    { name: 'Large Desktop 1920x1080', width: 1920, height: 1080 }
];

const PAGES = [
    { name: 'Home (index.html)', url: 'http://localhost:3000/index.html' },
    { name: 'Packages (packages.html)', url: 'http://localhost:3000/packages.html' },
    { name: 'Gallery (gallery.html)', url: 'http://localhost:3000/gallery.html' },
    { name: 'About (about.html)', url: 'http://localhost:3000/about.html' },
    { name: 'Contact (contact.html)', url: 'http://localhost:3000/contact.html' }
];

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testPageViewport(url, width, height) {
    const port = 9000 + Math.floor(Math.random() * 800);
    const edge = spawn(edgePath, [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        `--window-size=${width},${height}`,
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        url
    ]);

    await new Promise(r => setTimeout(r, 1600));

    try {
        const listRes = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await listRes.json();
        const page = list[0];
        if (!page) throw new Error('No target page');

        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        const send = (method, params = {}) => new Promise((resolve) => {
            const reqId = id++;
            const handler = (evt) => {
                const msg = JSON.parse(evt.data);
                if (msg.id === reqId) {
                    ws.removeEventListener('message', handler);
                    resolve(msg.result);
                }
            };
            ws.addEventListener('message', handler);
            ws.send(JSON.stringify({ id: reqId, method, params }));
        });

        // Set device metrics
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width < 768,
            screenWidth: width,
            screenHeight: height
        });

        await new Promise(r => setTimeout(r, 600));

        const metrics = await send('Runtime.evaluate', {
            expression: `(() => {
                const winW = window.innerWidth;
                const winH = window.innerHeight;
                const docEl = document.documentElement;
                const scrollW = docEl.scrollWidth;
                const bodyScrollW = document.body.scrollWidth;
                
                // Elements exceeding viewport width
                const overflowing = [];
                document.querySelectorAll('*').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > winW + 1.5 || el.scrollWidth > winW + 1.5) {
                        overflowing.push({
                            tag: el.tagName,
                            cls: (el.className || '').toString().slice(0, 40),
                            id: el.id || '',
                            right: Math.round(rect.right),
                            diff: Math.round(rect.right - winW)
                        });
                    }
                });

                // Check hero height and presence
                const hero = document.querySelector('.hero, .page-hero, .gallery-hero, .contact-hero, .packages-hero');
                const heroHeight = hero ? Math.round(hero.getBoundingClientRect().height) : null;

                // Check nav height and presence
                const nav = document.querySelector('.site-nav, .navbar');
                const navWidth = nav ? Math.round(nav.getBoundingClientRect().width) : null;
                const navLogo = document.querySelector('.nav-logo-img, .logo img');
                const navLogoVisible = navLogo ? (navLogo.getBoundingClientRect().width > 0 && navLogo.getBoundingClientRect().height > 0) : false;

                // Check touch targets under 44px
                const smallTouchTargets = [];
                if (winW < 768) {
                    document.querySelectorAll('a, button, [role="button"]').forEach(btn => {
                        const r = btn.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0 && (r.height < 40 || r.width < 40)) {
                            if (!btn.closest('.cinematic-entrance-overlay') && !btn.closest('#overflow-debug')) {
                                smallTouchTargets.push({
                                    text: (btn.innerText || btn.ariaLabel || '').trim().slice(0, 20),
                                    w: Math.round(r.width),
                                    h: Math.round(r.height),
                                    cls: (btn.className || '').toString().slice(0, 30)
                                });
                            }
                        }
                    });
                }

                return {
                    winW,
                    winH,
                    scrollW,
                    bodyScrollW,
                    hasOverflow: scrollW > winW + 1,
                    overflowCount: overflowing.length,
                    topOverflows: overflowing.slice(0, 5),
                    heroHeight,
                    navWidth,
                    navLogoVisible,
                    smallTouchTargetsCount: smallTouchTargets.length,
                    sampleTouchTargets: smallTouchTargets.slice(0, 3)
                };
            })()`,
            returnByValue: true
        });

        ws.close();
        return metrics.result ? metrics.result.value : null;
    } catch(e) {
        return { error: e.message };
    } finally {
        edge.kill();
    }
}

async function run() {
    console.log('STARTING COMPLETE RESPONSIVE AUDIT...');
    const results = {};

    for (const page of PAGES) {
        console.log(`\n=== Testing ${page.name} ===`);
        results[page.name] = [];

        for (const vp of VIEWPORTS) {
            const data = await testPageViewport(page.url, vp.width, vp.height);
            if (!data || data.error) {
                console.log(`  [ERR] ${vp.name.padEnd(25)}: ${data ? data.error : 'No data'}`);
                continue;
            }

            const status = data.hasOverflow ? `FAIL (Overflow +${data.scrollW - data.winW}px)` : `PASS`;
            console.log(`  [${status}] ${vp.name.padEnd(25)} winW=${data.winW} scrollW=${data.scrollW} heroH=${data.heroHeight}px touch<40px=${data.smallTouchTargetsCount}`);
            if (data.hasOverflow && data.topOverflows.length > 0) {
                console.log(`         Overflow elements:`, data.topOverflows.map(o => `${o.tag}.${o.cls}#${o.id} (+${o.diff}px)`).join(', '));
            }
            results[page.name].push({ viewport: vp.name, width: vp.width, height: vp.height, ...data });
        }
    }

    fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/scratch/full_audit_summary.json', JSON.stringify(results, null, 2));
    console.log('\nAudit complete! Saved to scratch/full_audit_summary.json');
}

run();
