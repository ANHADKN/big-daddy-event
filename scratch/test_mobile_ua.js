const { spawn } = require('child_process');

async function test() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9777',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const listRes = await fetch('http://127.0.0.1:9777/json/list');
        const list = await listRes.json();
        const ws = new WebSocket(list[0].webSocketDebuggerUrl);
        await new Promise(r => ws.onopen = r);

        let id = 1;
        const send = (method, params = {}) => new Promise((resolve) => {
            const reqId = id++;
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

        await send('Network.setUserAgentOverride', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1'
        });

        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true,
            screenWidth: 390,
            screenHeight: 844
        });

        await send('Page.enable');
        await send('Page.navigate', { url: 'http://localhost:3000/packages.html' });
        await new Promise(r => setTimeout(r, 1500));

        const res = await send('Runtime.evaluate', {
            expression: `({ innerW: window.innerWidth, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth })`,
            returnByValue: true
        });

        console.log('Result with mobile UA:', res.result.value);
        ws.close();
    } finally {
        edge.kill();
    }
}

test();
