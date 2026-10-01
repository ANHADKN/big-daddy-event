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
    { id: 'home', title: 'Home', path: '/index.html' },
    { id: 'packages', title: 'Packages', path: '/packages.html' },
    { id: 'gallery', title: 'Gallery', path: '/gallery.html' },
    { id: 'about', title: 'About', path: '/about.html' },
    { id: 'contact', title: 'Contact', path: '/contact.html' }
];

async function runAudit() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9966',
        '--disable-extensions',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1920,1080',
        'http://localhost:3000/testbed.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    const auditReport = [];

    try {
        const listRes = await fetch('http://127.0.0.1:9966/json/list');
        const list = await listRes.json();
        const pageTarget = list.find(t => t.type === 'page' && t.url.includes('testbed.html')) || list.find(t => t.type === 'page');

        if (!pageTarget) {
            throw new Error('Could not find active page target in Edge');
        }

        console.log(`Connected to Page Target ID: ${pageTarget.id} (${pageTarget.url})`);
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let msgId = 1;
        const send = (method, params = {}) => new Promise((resolve) => {
            const reqId = msgId++;
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

        // Listen for console errors
        const consoleErrors = [];
        ws.addEventListener('message', (evt) => {
            const msg = JSON.parse(evt.data);
            if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.type === 'error') {
                consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
            }
        });
        await send('Runtime.enable');

        console.log('\n============================================================');
        console.log('STARTING AUDIT: 5 PAGES x 10 VIEWPORTS = 50 TESTS');
        console.log('============================================================\n');

        for (const page of PAGES) {
            console.log(`--- Testing ${page.title} (${page.path}) ---`);
            const pageResults = [];

            for (const vp of VIEWPORTS) {
                const evalRes = await send('Runtime.evaluate', {
                    expression: `window.testViewport('${page.path}', ${vp.width}, ${vp.height})`,
                    awaitPromise: true,
                    returnByValue: true
                });

                const res = evalRes.result ? evalRes.result.value : { error: 'Evaluation failed' };
                if (res.error) {
                    console.log(`  [ERROR] ${vp.name}: ${res.error}`);
                    pageResults.push({ viewport: vp.name, width: vp.width, height: vp.height, status: 'ERROR', error: res.error });
                } else {
                    const status = res.hasOverflow ? 'FAIL' : 'PASS';
                    const diffText = res.hasOverflow ? ` (OVERFLOW: scrollW=${res.scrollW} > innerW=${res.innerW})` : ` (scrollW=${res.scrollW} <= innerW=${res.innerW})`;
                    console.log(`  [${status}] ${vp.name.padEnd(25)} ${diffText} overflows=${res.overflowCount}`);
                    if (res.hasOverflow && res.overflowing.length > 0) {
                        console.log(`         Culprit elements:`, res.overflowing.map(o => `${o.tag}.${o.cls}#${o.id} (+${o.diff}px)`).join('; '));
                    }
                    pageResults.push({
                        viewport: vp.name,
                        width: vp.width,
                        height: vp.height,
                        innerW: res.innerW,
                        scrollW: res.scrollW,
                        status,
                        hasOverflow: res.hasOverflow,
                        overflowCount: res.overflowCount,
                        overflowing: res.overflowing
                    });
                }
            }

            auditReport.push({
                page: page.title,
                path: page.path,
                results: pageResults
            });
            console.log('');
        }

        ws.close();
    } catch(err) {
        console.error('Audit execution error:', err.message);
    } finally {
        edge.kill();
    }

    fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/scratch/clean_audit_report.json', JSON.stringify(auditReport, null, 2));
    console.log('Audit completed and saved to scratch/clean_audit_report.json');
}

runAudit();
