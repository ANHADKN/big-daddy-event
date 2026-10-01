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

async function captureAll(width = 390, height = 844, suffix = '_390_after') {
    // Kill any existing edge instances
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9955',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9955/json/list');
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

        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 1,
            mobile: width < 768
        });

        const results = [];

        for (const p of pages) {
            console.log(`Navigating to ${p.name}...`);
            await send('Page.navigate', { url: `http://localhost:3000/${p.path}` });
            await new Promise(r => setTimeout(r, p.wait));

            // Dismiss entrance overlay if present
            await send('Runtime.evaluate', {
                expression: `(() => {
                    const ov = document.getElementById('cinematicEntranceOverlay');
                    if (ov) { ov.style.display = 'none'; ov.remove(); }
                })()`
            });

            // Check dimensions
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
            console.log(`[${p.name}] ${width}x${height} - scrollWidth: ${dims?.scrollWidth}, innerWidth: ${dims?.innerWidth}, overflow: ${hasOverflow}`);

            // Screenshot
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/device_${p.name}${suffix}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Saved: ${outPath} (${fs.statSync(outPath).size} bytes)`);

            results.push({ page: p.name, dims, hasOverflow });
        }

        ws.close();
        return results;
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
    }
}

if (require.main === module) {
    captureAll(390, 844, '_390_after').then(res => {
        console.log('Capture finished successfully:', res);
    }).catch(err => {
        console.error('Capture failed:', err);
    });
}

module.exports = { captureAll };
