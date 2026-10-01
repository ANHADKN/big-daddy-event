const { spawn } = require('child_process');

async function test(url, width, height) {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9911',
        `--window-size=${width},${height}`,
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        url
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const listRes = await fetch('http://127.0.0.1:9911/json/list');
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

        // Enable Page and Emulation BEFORE navigating!
        // Set device metrics override on already loaded page
        await send('Emulation.setDeviceMetricsOverride', {
            width,
            height,
            deviceScaleFactor: 2,
            mobile: true,
            screenWidth: width,
            screenHeight: height
        });
        await new Promise(r => setTimeout(r, 1000));

        const res = await send('Runtime.evaluate', {
            expression: `({
                innerW: window.innerWidth,
                innerH: window.innerHeight,
                clientW: document.documentElement.clientWidth,
                scrollW: document.documentElement.scrollWidth,
                overflowing: Array.from(document.querySelectorAll('*'))
                    .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
                    .map(el => ({ tag: el.tagName, cls: el.className, id: el.id, right: Math.round(el.getBoundingClientRect().right), diff: Math.round(el.getBoundingClientRect().right - window.innerWidth) }))
            })`,
            returnByValue: true
        });

        console.log(`URL: ${url} (${width}x${height}):`, res.result.value);
        ws.close();
    } finally {
        edge.kill();
    }
}

test('http://localhost:3000/packages.html', 390, 844);
