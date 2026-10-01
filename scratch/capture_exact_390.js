const { spawn } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const pages = [
    { name: 'home', path: 'index.html', wait: 2000 },
    { name: 'packages', path: 'packages.html', wait: 2000 },
    { name: 'gallery', path: 'gallery.html', wait: 2000 },
    { name: 'about', path: 'about.html', wait: 1500 },
    { name: 'contact', path: 'contact.html', wait: 1500 }
];

async function captureAll390() {
    for (const p of pages) {
        console.log(`Capturing exact 390px for ${p.name}...`);
        const edge = spawn(edgePath, [
            '--headless=new',
            '--remote-debugging-port=9922',
            '--disable-extensions',
            `http://localhost:3000/${p.path}`
        ]);

        await new Promise(r => setTimeout(r, 2000));

        try {
            let list = null;
            for (let retry = 0; retry < 10; retry++) {
                try {
                    const listRes = await fetch('http://127.0.0.1:9922/json/list');
                    list = await listRes.json();
                    if (list && list.length > 0) break;
                } catch (e) {
                    await new Promise(r => setTimeout(r, 400));
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
                width: 390,
                height: 844,
                deviceScaleFactor: 1,
                mobile: true
            });

            await send('Runtime.enable');
            await new Promise(r => setTimeout(r, p.wait));

            // Verify overflow
            const dimRes = await send('Runtime.evaluate', {
                expression: `({
                    scrollWidth: document.documentElement.scrollWidth,
                    clientWidth: document.documentElement.clientWidth,
                    innerWidth: window.innerWidth
                })`,
                returnByValue: true
            });
            const dims = dimRes.result.value;
            console.log(`[${p.name}] scrollWidth: ${dims.scrollWidth}, innerWidth: ${dims.innerWidth}, overflow: ${dims.scrollWidth > dims.innerWidth}`);

            // Capture screenshot
            const shot = await send('Page.captureScreenshot', { format: 'png' });
            const outPath = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\device_${p.name}_390_after.png`;
            fs.writeFileSync(outPath, Buffer.from(shot.data, 'base64'));
            console.log(`Saved: device_${p.name}_390_after.png (${fs.statSync(outPath).size} bytes)`);

            ws.close();
        } catch (e) {
            console.error(`Error capturing ${p.name}:`, e.message);
        } finally {
            try {
                const { execSync } = require('child_process');
                execSync(`taskkill /F /T /PID ${edge.pid}`, { stdio: 'ignore' });
            } catch (err) {}
        }
        await new Promise(r => setTimeout(r, 600));
    }
    console.log('All 5 pages captured at exact 390px mobile viewport!');
}

captureAll390();
