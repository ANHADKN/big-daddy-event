const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function captureViewport(url, width, height, outPath, waitMs = 2500) {
    try {
        execSync('taskkill /F /IM msedge.exe 2>nul');
    } catch(e) {}

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1200));

    try {
        const listRes = await fetch('http://127.0.0.1:9222/json/list');
        const list = await listRes.json();
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

        await send('Page.navigate', { url });
        await new Promise(r => setTimeout(r, waitMs));

        // Evaluate overflow & remove any leftover splash/overlay if still animating
        const result = await send('Runtime.evaluate', {
            expression: `(() => {
                const ov = document.getElementById('cinematicEntranceOverlay');
                if (ov) { ov.style.display = 'none'; ov.remove(); }
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth,
                    innerWidth: window.innerWidth
                };
            })()`,
            returnByValue: true
        });

        const dims = result.result?.value;

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        ws.close();
        return dims;
    } finally {
        try {
            execSync('taskkill /F /IM msedge.exe 2>nul');
        } catch(e) {}
    }
}

module.exports = { captureViewport };

if (require.main === module) {
    (async () => {
        const dims = await captureViewport('http://localhost:3000/index.html', 390, 844, 'scratch/suite_test_390.png', 2500);
        console.log('Capture test finished:', dims);
    })();
}
