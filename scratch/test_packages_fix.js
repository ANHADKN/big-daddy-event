const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function testPackages() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9996',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9996/json/list');
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

        const baseHtml = fs.readFileSync('public/packages.html', 'utf8');

        // Test with refined spacing
        const injected = baseHtml.replace('</head>', `
            <style>
                @media (max-width: 768px) {
                    .packages-hero {
                        padding: calc(4.8rem + var(--safe-top, 0px)) 5vw 1.6rem !important;
                    }
                    .packages-hero .hero-logo {
                        margin-bottom: 0.85rem !important;
                        max-width: 110px !important;
                    }
                    .editorial-eyebrow {
                        margin-bottom: 0.6rem !important;
                    }
                    .editorial-hero-title {
                        font-size: 2.2rem !important;
                        margin-bottom: 0.35rem !important;
                    }
                    .editorial-gold-line {
                        height: 20px !important;
                        margin: 0.6rem auto !important;
                    }
                    .editorial-hero-lead {
                        margin-bottom: 0.35rem !important;
                        font-size: 1rem !important;
                    }
                    .editorial-hero-desc {
                        font-size: 0.85rem !important;
                        line-height: 1.45 !important;
                    }
                    .package-tabs-wrapper {
                        padding: 0.85rem 10px 0.65rem !important;
                    }
                }
            </style>
        </head>`);
        fs.writeFileSync('public/test_packages_tmp.html', injected);

        await send('Page.navigate', { url: 'http://localhost:3000/test_packages_tmp.html' });
        await new Promise(r => setTimeout(r, 2000));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const outPath = `scratch/test_packages_fixed.png`;
        fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
        console.log(`Saved: ${outPath}`);

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_packages_tmp.html'); } catch(e) {}
    }
}

testPackages();
