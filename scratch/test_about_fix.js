const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testAbout() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9995',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9995/json/list');
                list = await listRes.json();
                if (list && list.length > 0) break;
            } catch(e) {
                await new Promise(r => setTimeout(r, 300));
            }
        }
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
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true
        });

        const baseHtml = fs.readFileSync('public/about.html', 'utf8');

        // Test with fixed hero-cinematic styles
        const injected = baseHtml.replace('</head>', `
            <style>
                .hero-cinematic {
                    margin-top: 2rem !important;
                    height: 48vh !important;
                    min-height: 280px !important;
                    max-height: 420px !important;
                    border: none !important;
                }
                .hero-cinematic picture {
                    display: block !important;
                    width: 100% !important;
                    height: 100% !important;
                }
                .hero-cinematic img {
                    display: block !important;
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }
            </style>
        </head>`);
        fs.writeFileSync('public/test_about_tmp.html', injected);

        await send('Page.navigate', { url: 'http://localhost:3000/test_about_tmp.html' });
        await new Promise(r => setTimeout(r, 1200));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const outPath = `scratch/test_about_fixed.png`;
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved: ${outPath}`);

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_about_tmp.html'); } catch(e) {}
    }
}

testAbout();
