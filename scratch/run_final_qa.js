const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pages = [
    { name: 'home', path: 'index.html', wait: 2200 },
    { name: 'packages', path: 'packages.html', wait: 2000 },
    { name: 'gallery', path: 'gallery.html', wait: 2000 },
    { name: 'about', path: 'about.html', wait: 1500 },
    { name: 'contact', path: 'contact.html', wait: 1500 }
];

async function runSession(viewports) {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9980',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    const auditSummary = {
        screens: [],
        consoleErrors: [],
        overflows: []
    };

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9980/json/list');
                list = await listRes.json();
                if (list && list.length > 0) break;
            } catch(e) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
        if (!list) throw new Error('Could not connect to Edge debugger');

        const page = list.find(t => t.type === 'page') || list[0];
        const ws = new WebSocket(page.webSocketDebuggerUrl);
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
        await send('Runtime.enable');
        await send('Log.enable');

        ws.addEventListener('message', (evt) => {
            const msg = JSON.parse(evt.data);
            if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
                auditSummary.consoleErrors.push({
                    text: msg.params.args.map(a => a.value || a.description).join(' ')
                });
            } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
                auditSummary.consoleErrors.push({
                    text: msg.params.entry.text
                });
            }
        });

        for (const vp of viewports) {
            console.log(`\n=== Testing Viewport: ${vp.width}x${vp.height} (${vp.label}) ===`);
            await send('Emulation.setDeviceMetricsOverride', {
                width: vp.width,
                height: vp.height,
                deviceScaleFactor: 1,
                mobile: vp.isMobile
            });

            for (const p of vp.pages) {
                console.log(`[${vp.width}x${vp.height}] Navigating to ${p.name}...`);
                await send('Page.navigate', { url: `http://localhost:3000/${p.path}` });
                await new Promise(r => setTimeout(r, p.wait));

                // Dismiss entrance overlay if present
                await send('Runtime.evaluate', {
                    expression: `(() => {
                        const ov = document.getElementById('cinematicEntranceOverlay');
                        if (ov) { ov.style.display = 'none'; ov.remove(); }
                    })()`
                });

                // Check overflow
                const dimRes = await send('Runtime.evaluate', {
                    expression: `({
                        scrollWidth: document.documentElement.scrollWidth,
                        clientWidth: document.documentElement.clientWidth,
                        innerWidth: window.innerWidth
                    })`,
                    returnByValue: true
                });
                const dims = dimRes.result?.value;
                const hasOverflow = dims ? dims.scrollWidth > dims.innerWidth : false;

                if (hasOverflow) {
                    auditSummary.overflows.push({ page: p.name, vp: `${vp.width}x${vp.height}`, dims });
                }

                // Screenshot
                const shot = await send('Page.captureScreenshot', { format: 'png' });
                const outPath = `scratch/${vp.prefix}_${p.name}_${vp.width}.png`;
                fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
                console.log(`Saved: ${outPath} | scrollWidth: ${dims?.scrollWidth}, innerWidth: ${dims?.innerWidth}, overflow: ${hasOverflow}`);

                auditSummary.screens.push({
                    page: p.name,
                    viewport: `${vp.width}x${vp.height}`,
                    overflow: hasOverflow,
                    file: outPath
                });
            }
        }

        ws.close();
        return auditSummary;
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
    }
}

async function main() {
    const mobile390 = {
        width: 390,
        height: 844,
        isMobile: true,
        label: 'iPhone 12/13/14 Baseline',
        prefix: 'final_qa',
        pages: pages // all 5 pages
    };

    const mobile412 = {
        width: 412,
        height: 915,
        isMobile: true,
        label: 'Pixel 7 Baseline',
        prefix: 'final_qa',
        pages: [pages[0], pages[1]] // home & packages
    };

    const mobile480 = {
        width: 480,
        height: 900,
        isMobile: true,
        label: 'Large Mobile',
        prefix: 'final_qa',
        pages: [pages[0]] // home
    };

    const desktops = [
        { width: 1280, height: 800, isMobile: false, label: 'Desktop 1280', prefix: 'desktop_reg', pages: [pages[0]] },
        { width: 1366, height: 768, isMobile: false, label: 'Desktop 1366', prefix: 'desktop_reg', pages: [pages[0]] },
        { width: 1440, height: 900, isMobile: false, label: 'Desktop 1440', prefix: 'desktop_reg', pages: [pages[0]] },
        { width: 1920, height: 1080, isMobile: false, label: 'Desktop 1920', prefix: 'desktop_reg', pages: [pages[0]] }
    ];

    const results = await runSession([mobile390, mobile412, mobile480, ...desktops]);
    fs.writeFileSync('scratch/final_qa_report.json', JSON.stringify(results, null, 2));
    console.log('\n=======================================');
    console.log('FINAL QA COMPLETED!');
    console.log(`Total screens captured: ${results.screens.length}`);
    console.log(`Console errors: ${results.consoleErrors.length}`);
    console.log(`Horizontal overflows: ${results.overflows.length}`);
    console.log('=======================================');
}

main().catch(err => {
    console.error('QA session failed:', err);
    process.exit(1);
});
