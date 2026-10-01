const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const variants = [
    {
        id: 'var1_transY_scrim50',
        imageTransform: 'transform: translateY(-50px); height: calc(100% + 50px);',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.95) 30%,
                rgba(3, 27, 22, 0.90) 48%,
                rgba(3, 27, 22, 0.35) 56%,
                rgba(3, 27, 22, 0) 64%
            );
            mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 62%);
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 62%);
        `
    },
    {
        id: 'var2_transY_scrim48',
        imageTransform: 'transform: translateY(-70px); height: calc(100% + 70px);',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.95) 28%,
                rgba(3, 27, 22, 0.90) 46%,
                rgba(3, 27, 22, 0.30) 54%,
                rgba(3, 27, 22, 0) 60%
            );
            mask-image: linear-gradient(to bottom, black 0%, black 46%, transparent 58%);
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 46%, transparent 58%);
        `
    },
    {
        id: 'var3_transY_scrim54',
        imageTransform: 'transform: translateY(-40px); height: calc(100% + 40px);',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.95) 32%,
                rgba(3, 27, 22, 0.92) 50%,
                rgba(3, 27, 22, 0.35) 58%,
                rgba(3, 27, 22, 0) 65%
            );
            mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 64%);
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 64%);
        `
    }
];

async function runTest() {
    // Read original index.html
    const html = fs.readFileSync('public/index.html', 'utf8');

    // Launch Edge once
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9933',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9933/json/list');
        const list = await listRes.json();
        const page = list[0];
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

        for (const v of variants) {
            // Write temporary test file
            let testHtml = html.replace('</head>', `
            <style>
                .hero-image { ${v.imageTransform} }
                .hero-mobile-dissolve-scrim { ${v.scrim} }
                /* Disable entrance overlay for testing */
                #cinematicEntranceOverlay { display: none !important; }
            </style>
            </head>`);

            fs.writeFileSync('public/test_hero_var.html', testHtml);

            await send('Page.navigate', { url: 'http://localhost:3000/test_hero_var.html' });
            await new Promise(r => setTimeout(r, 1500));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/hero_${v.id}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Saved: ${outPath}`);
        }

        ws.close();
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        edge.kill();
    }
}

runTest();
