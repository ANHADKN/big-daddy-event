const { spawn } = require('child_process');
const fs = require('fs');

const VIEWPORTS = [
    { name: 'Mobile 390x844', width: 390, height: 844, isMobile: true },
    { name: 'Mobile 412x915', width: 412, height: 915, isMobile: true },
    { name: 'Mobile 480x900', width: 480, height: 900, isMobile: true },
    { name: 'Tablet 768x1024', width: 768, height: 1024, isMobile: false },
    { name: 'Tablet 820x1180', width: 820, height: 1180, isMobile: false },
    { name: 'Large Tablet 1024x1366', width: 1024, height: 1366, isMobile: false },
    { name: 'Compact Laptop 1280x800', width: 1280, height: 800, isMobile: false },
    { name: 'Standard Laptop 1366x768', width: 1366, height: 768, isMobile: false },
    { name: 'Desktop Monitor 1440x900', width: 1440, height: 900, isMobile: false },
    { name: 'Large Desktop 1920x1080', width: 1920, height: 1080, isMobile: false }
];

const PAGES = [
    'http://localhost:3000/index.html',
    'http://localhost:3000/packages.html',
    'http://localhost:3000/gallery.html',
    'http://localhost:3000/about.html',
    'http://localhost:3000/contact.html'
];

async function main() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9666',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const auditResults = [];

    try {
        const listRes = await fetch('http://127.0.0.1:9666/json/list');
        const list = await listRes.json();
        const pageTarget = list[0];

        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

        await send('Page.enable');

        for (const pageUrl of PAGES) {
            const pageName = pageUrl.split('/').pop();
            console.log(`\n==================================================`);
            console.log(`Auditing Page: ${pageName}`);
            console.log(`==================================================`);

            for (const vp of VIEWPORTS) {
                // Emulate viewport
                await send('Emulation.setDeviceMetricsOverride', {
                    width: vp.width,
                    height: vp.height,
                    deviceScaleFactor: 1,
                    mobile: vp.isMobile,
                    screenWidth: vp.width,
                    screenHeight: vp.height
                });

                // Navigate or reload
                await send('Page.navigate', { url: pageUrl });
                await new Promise(r => setTimeout(r, 1000));

                // Measure page metrics
                const evalRes = await send('Runtime.evaluate', {
                    expression: `(() => {
                        const docEl = document.documentElement;
                        const scrollW = docEl.scrollWidth;
                        const clientW = docEl.clientWidth;
                        const innerW = window.innerWidth;
                        const hasOverflow = scrollW > innerW + 1;

                        // Find overflowing elements
                        const overflowing = [];
                        document.querySelectorAll('*').forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (rect.right > innerW + 1.5 || el.scrollWidth > innerW + 1.5) {
                                overflowing.push({
                                    tag: el.tagName,
                                    cls: (el.className || '').toString().slice(0, 50),
                                    id: el.id || '',
                                    right: Math.round(rect.right),
                                    scrollWidth: el.scrollWidth,
                                    clientWidth: el.clientWidth,
                                    diff: Math.round(rect.right - innerW)
                                });
                            }
                        });

                        // Check small touch targets on mobile (<44px)
                        const smallTouchTargets = [];
                        if (${vp.isMobile}) {
                            document.querySelectorAll('a, button, input, select, [role="button"]').forEach(el => {
                                const rect = el.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0 && (rect.width < 38 || rect.height < 38)) {
                                    // ignore hidden or microscopic items
                                    if (rect.height > 5 && rect.width > 5 && !el.closest('.cinematic-entrance-overlay')) {
                                        smallTouchTargets.push({
                                            tag: el.tagName,
                                            cls: (el.className || '').toString().slice(0, 40),
                                            text: (el.innerText || el.ariaLabel || '').slice(0, 25),
                                            w: Math.round(rect.width),
                                            h: Math.round(rect.height)
                                        });
                                    }
                                }
                            });
                        }

                        return {
                            scrollW,
                            clientW,
                            innerW,
                            hasOverflow,
                            overflowCount: overflowing.length,
                            topOverflows: overflowing.slice(0, 5),
                            smallTouchTargetsCount: smallTouchTargets.length,
                            sampleSmallTouchTargets: smallTouchTargets.slice(0, 4)
                        };
                    })()`,
                    returnByValue: true
                });

                const data = evalRes.result ? evalRes.result.value : { error: 'Failed eval' };
                const statusStr = data.hasOverflow ? `FAIL (Overflow by ${data.scrollW - vp.width}px)` : `PASS`;
                console.log(`  [${statusStr}] ${vp.name.padEnd(25)} scrollW=${data.scrollW} innerW=${data.innerW} overCount=${data.overflowCount}`);
                if (data.hasOverflow && data.topOverflows && data.topOverflows.length > 0) {
                    console.log(`       Top overflowing:`, data.topOverflows.map(o => `${o.tag}.${o.cls}#${o.id} (right=${o.right} diff=+${o.diff}px)`).join(' | '));
                }

                auditResults.push({
                    page: pageName,
                    viewport: vp.name,
                    width: vp.width,
                    height: vp.height,
                    scrollW: data.scrollW,
                    innerW: data.innerW,
                    hasOverflow: data.hasOverflow,
                    overflowCount: data.overflowCount,
                    topOverflows: data.topOverflows,
                    smallTouchTargetsCount: data.smallTouchTargetsCount
                });
            }
        }

        ws.close();
    } catch(err) {
        console.error('Audit run error:', err);
    } finally {
        edge.kill();
    }

    fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/scratch/audit_results.json', JSON.stringify(auditResults, null, 2));
    console.log('\nAudit complete. Results saved to scratch/audit_results.json');
}

main();
