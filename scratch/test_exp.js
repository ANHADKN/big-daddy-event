const { spawn, execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const experiments = [
    {
        name: 'exp1_shift50_scrim55',
        imgTransform: 'height: 110%; transform: translateY(-50px); object-position: 50% 50%;',
        scrimBg: `linear-gradient(
            to bottom,
            rgba(3, 27, 22, 0.88) 0%,
            rgba(3, 27, 22, 0.96) 30%,
            rgba(3, 27, 22, 0.94) 52%,
            rgba(3, 27, 22, 0.45) 59%,
            rgba(3, 27, 22, 0) 65%
        )`,
        mask: `linear-gradient(to bottom, black 0%, black 51%, transparent 63%)`
    },
    {
        name: 'exp2_shift60_scrim53',
        imgTransform: 'height: 112%; transform: translateY(-60px); object-position: 50% 50%;',
        scrimBg: `linear-gradient(
            to bottom,
            rgba(3, 27, 22, 0.88) 0%,
            rgba(3, 27, 22, 0.96) 28%,
            rgba(3, 27, 22, 0.94) 50%,
            rgba(3, 27, 22, 0.40) 57%,
            rgba(3, 27, 22, 0) 63%
        )`,
        mask: `linear-gradient(to bottom, black 0%, black 49%, transparent 61%)`
    },
    {
        name: 'exp3_shift70_scrim52',
        imgTransform: 'height: 114%; transform: translateY(-70px); object-position: 50% 50%;',
        scrimBg: `linear-gradient(
            to bottom,
            rgba(3, 27, 22, 0.88) 0%,
            rgba(3, 27, 22, 0.96) 28%,
            rgba(3, 27, 22, 0.94) 48%,
            rgba(3, 27, 22, 0.35) 55%,
            rgba(3, 27, 22, 0) 61%
        )`,
        mask: `linear-gradient(to bottom, black 0%, black 47%, transparent 59%)`
    },
    {
        name: 'exp4_shift80_scrim50',
        imgTransform: 'height: 116%; transform: translateY(-80px); object-position: 50% 50%;',
        scrimBg: `linear-gradient(
            to bottom,
            rgba(3, 27, 22, 0.88) 0%,
            rgba(3, 27, 22, 0.96) 26%,
            rgba(3, 27, 22, 0.94) 47%,
            rgba(3, 27, 22, 0.35) 54%,
            rgba(3, 27, 22, 0) 60%
        )`,
        mask: `linear-gradient(to bottom, black 0%, black 46%, transparent 58%)`
    }
];

async function runExp() {
    try { execSync('taskkill /F /IM msedge.exe', { stdio: 'ignore' }); } catch(e) {}
    await new Promise(r => setTimeout(r, 600));

    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9977',
        '--disable-extensions',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const listRes = await fetch('http://127.0.0.1:9977/json/list');
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
            width: 390,
            height: 844,
            deviceScaleFactor: 1,
            mobile: true
        });

        const baseHtml = fs.readFileSync('public/index.html', 'utf8');

        for (const e of experiments) {
            const injected = baseHtml.replace('</head>', `
                <style>
                    #cinematicEntranceOverlay { display: none !important; }
                    .hero-image { ${e.imgTransform} }
                    .hero-mobile-dissolve-scrim {
                        background: ${e.scrimBg} !important;
                        mask-image: ${e.mask} !important;
                        -webkit-mask-image: ${e.mask} !important;
                    }
                </style>
            </head>`);
            fs.writeFileSync('public/test_exp.html', injected);

            await send('Page.navigate', { url: 'http://localhost:3000/test_exp.html' });
            await new Promise(r => setTimeout(r, 1200));

            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `scratch/exp_${e.name}.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Saved: ${outPath}`);
        }

        ws.close();
    } finally {
        try { execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' }); } catch(e) {}
        try { fs.unlinkSync('public/test_exp.html'); } catch(e) {}
    }
}

runExp();
