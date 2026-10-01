const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tests = [
    {
        name: 'balanced_hero_63_74',
        shift: -28,
        paddingTop: '5rem',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 63%,
                rgba(3, 27, 22, 0.45) 69%,
                rgba(3, 27, 22, 0) 74%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 63%, transparent 74%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 63%, transparent 74%) !important;
        `
    },
    {
        name: 'balanced_hero_64_75',
        shift: -32,
        paddingTop: '5rem',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 64%,
                rgba(3, 27, 22, 0.45) 70%,
                rgba(3, 27, 22, 0) 75%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 64%, transparent 75%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 64%, transparent 75%) !important;
        `
    },
    {
        name: 'balanced_hero_65_76',
        shift: -35,
        paddingTop: '5.2rem',
        scrim: `
            background: linear-gradient(
                to bottom,
                rgba(3, 27, 22, 0.88) 0%,
                rgba(3, 27, 22, 0.96) 30%,
                rgba(3, 27, 22, 0.94) 65%,
                rgba(3, 27, 22, 0.45) 71%,
                rgba(3, 27, 22, 0) 76%
            ) !important;
            mask-image: linear-gradient(to bottom, black 0%, black 65%, transparent 76%) !important;
            -webkit-mask-image: linear-gradient(to bottom, black 0%, black 65%, transparent 76%) !important;
        `
    }
];

async function run() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9993',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9993/json/list');
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
                    .hero-content-mobile {
                        padding-top: calc(${t.paddingTop} + var(--safe-top)) !important;
                    }
                    .hero-mobile-dissolve-scrim {
                        ${t.scrim}
                    }
                </style>
            </head>`);
            fs.writeFileSync('public/test_shift_tmp3.html', injected);

            await send('Page.navigate', { url: 'http://localhost:3000/test_shift_tmp3.html' });
            await new Promise(r => setTimeout(r, 1200));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/test_${t.name}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Generated: ${outPath}`);
        }

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_shift_tmp3.html'); } catch(e) {}
    }
}

run();
