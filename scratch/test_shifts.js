const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tests = [
    {
        name: 'shift25_scrim57_67',
        shift: -25,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 57%,
                rgba(3, 27, 22, 0.45) 63%,
                rgba(3, 27, 22, 0) 68%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 57%, transparent 68%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 57%, transparent 68%) !important;
        `
    },
    {
        name: 'shift30_scrim56_66',
        shift: -30,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 56%,
                rgba(3, 27, 22, 0.45) 62%,
                rgba(3, 27, 22, 0) 67%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 56%, transparent 67%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 56%, transparent 67%) !important;
        `
    },
    {
        name: 'shift35_scrim55_65',
        shift: -35,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 55%,
                rgba(3, 27, 22, 0.45) 61%,
                rgba(3, 27, 22, 0) 66%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 66%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 55%, transparent 66%) !important;
        `
    },
    {
        name: 'shift40_scrim54_64',
        shift: -40,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 54%,
                rgba(3, 27, 22, 0.45) 60%,
                rgba(3, 27, 22, 0) 65%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 54%, transparent 65%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 54%, transparent 65%) !important;
        `
    }
];

async function run() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9988',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9988/json/list');
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

        const baseHtml = fs.readFileSync('public/index.html', 'utf8');

        for (const t of tests) {
            const injected = baseHtml.replace('</head>', `
                <style>
                    #cinematicEntranceOverlay { display: none !important; }
                    .hero-image {
                        height: calc(100% + ${Math.abs(t.shift)}px) !important;
                        transform: translateY(${t.shift}px) !important;
                        object-position: 50% 50% !important;
                    }
                    .hero-mobile-dissolve-scrim {
                        ${t.scrim}
                    }
                </style>
            </head>`);
            fs.writeFileSync('public/test_shift_tmp.html', injected);

            await send('Page.navigate', { url: 'http://localhost:3000/test_shift_tmp.html' });
            await new Promise(r => setTimeout(r, 1200));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/test_${t.name}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Generated: ${outPath}`);
        }

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_shift_tmp.html'); } catch(e) {}
    }
}

run();
