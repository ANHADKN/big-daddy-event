const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tests = [
    {
        name: 'perfect_scrim60_70',
        shift: -20,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 60%,
                rgba(3, 27, 22, 0.45) 66%,
                rgba(3, 27, 22, 0) 71%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 71%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 60%, transparent 71%) !important;
        `
    },
    {
        name: 'perfect_scrim61_72',
        shift: -25,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 61%,
                rgba(3, 27, 22, 0.45) 67%,
                rgba(3, 27, 22, 0) 72%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 61%, transparent 72%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 61%, transparent 72%) !important;
        `
    },
    {
        name: 'perfect_scrim62_73',
        shift: -30,
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 62%,
                rgba(3, 27, 22, 0.45) 68%,
                rgba(3, 27, 22, 0) 73%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 62%, transparent 73%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 62%, transparent 73%) !important;
        `
    }
];

async function run() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9991',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9991/json/list');
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
            fs.writeFileSync('public/test_shift_tmp2.html', injected);

            await send('Page.navigate', { url: 'http://localhost:3000/test_shift_tmp2.html' });
            await new Promise(r => setTimeout(r, 1200));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/test_${t.name}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Generated: ${outPath}`);
        }

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_shift_tmp2.html'); } catch(e) {}
    }
}

run();
