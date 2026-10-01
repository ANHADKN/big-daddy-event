const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const tests = [
    {
        name: 'shift30_scrim52',
        css: `
            .hero-image {
                height: 108% !important;
                transform: translateY(-35px) !important;
            }
            .hero-mobile-dissolve-scrim {
                background: linear-gradient(
                    to bottom,
                    rgba(3, 27, 22, 0.88) 0%,
                    rgba(3, 27, 22, 0.96) 30%,
                    rgba(3, 27, 22, 0.94) 50%,
                    rgba(3, 27, 22, 0.45) 58%,
                    rgba(3, 27, 22, 0) 65%
                ) !important;
                mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 63%) !important;
                -webkit-mask-image: linear-gradient(to bottom, black 0%, black 50%, transparent 63%) !important;
            }
        `
    },
    {
        name: 'shift45_scrim50',
        css: `
            .hero-image {
                height: 110% !important;
                transform: translateY(-45px) !important;
            }
            .hero-mobile-dissolve-scrim {
                background: linear-gradient(
                    to bottom,
                    rgba(3, 27, 22, 0.88) 0%,
                    rgba(3, 27, 22, 0.96) 28%,
                    rgba(3, 27, 22, 0.93) 48%,
                    rgba(3, 27, 22, 0.35) 55%,
                    rgba(3, 27, 22, 0) 62%
                ) !important;
                mask-image: linear-gradient(to bottom, black 0%, black 48%, transparent 60%) !important;
                -webkit-mask-image: linear-gradient(to bottom, black 0%, black 48%, transparent 60%) !important;
            }
        `
    },
    {
        name: 'shift55_scrim53',
        css: `
            .hero-image {
                height: 112% !important;
                transform: translateY(-55px) !important;
            }
            .hero-mobile-dissolve-scrim {
                background: linear-gradient(
                    to bottom,
                    rgba(3, 27, 22, 0.88) 0%,
                    rgba(3, 27, 22, 0.96) 30%,
                    rgba(3, 27, 22, 0.94) 52%,
                    rgba(3, 27, 22, 0.40) 59%,
                    rgba(3, 27, 22, 0) 66%
                ) !important;
                mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 64%) !important;
                -webkit-mask-image: linear-gradient(to bottom, black 0%, black 52%, transparent 64%) !important;
            }
        `
    },
    {
        name: 'balanced_cinematic',
        css: `
            .hero-image {
                height: 110% !important;
                transform: translateY(-48px) !important;
            }
            .hero-content-mobile {
                padding-top: calc(4.2rem + var(--safe-top)) !important;
                padding-bottom: 0 !important;
            }
            .mobile-hero-tagline {
                margin-bottom: 1.15rem !important;
            }
            .mobile-hero-ctas {
                gap: 0.65rem !important;
            }
            .mobile-btn-primary, .mobile-btn-secondary {
                padding: 0.78rem 1.4rem !important;
            }
            .hero-mobile-dissolve-scrim {
                background: linear-gradient(
                    to bottom,
                    rgba(3, 27, 22, 0.88) 0%,
                    rgba(3, 27, 22, 0.96) 28%,
                    rgba(3, 27, 22, 0.93) 47%,
                    rgba(3, 27, 22, 0.38) 54%,
                    rgba(3, 27, 22, 0) 61%
                ) !important;
                mask-image: linear-gradient(to bottom, black 0%, black 47%, transparent 59%) !important;
                -webkit-mask-image: linear-gradient(to bottom, black 0%, black 47%, transparent 59%) !important;
            }
        `
    }
];

async function run() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9966',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        let list = null;
        for (let retry = 0; retry < 10; retry++) {
            try {
                const listRes = await fetch('http://127.0.0.1:9966/json/list');
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
                    ${t.css}
                </style>
            </head>`);
            fs.writeFileSync('public/test_hero_tmp.html', injected);

            await send('Page.navigate', { url: 'http://localhost:3000/test_hero_tmp.html' });
            await new Promise(r => setTimeout(r, 1200));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/test_hero_${t.name}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Generated: ${outPath}`);
        }

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_hero_tmp.html'); } catch(e) {}
    }
}

run();
