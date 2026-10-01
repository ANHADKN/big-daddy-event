const { spawn } = require('child_process');

async function testMobileViewport() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9922',
        '--window-size=390,844',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1500));

    try {
        const listRes = await fetch('http://127.0.0.1:9922/json/list');
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

        // 1. Set emulation parameters on about:blank
        await send('Page.enable');
        await send('Emulation.setUserAgentOverride', {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        });
        await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true,
            screenWidth: 390,
            screenHeight: 844
        });

        // 2. Navigate to index.html
        await send('Page.navigate', { url: 'http://localhost:3000/index.html' });
        await new Promise(r => setTimeout(r, 2000));

        // 3. Measure
        const res = await send('Runtime.evaluate', {
            expression: `({
                innerW: window.innerWidth,
                innerH: window.innerHeight,
                scrollW: document.documentElement.scrollWidth,
                clientW: document.documentElement.clientWidth,
                overflowElements: Array.from(document.querySelectorAll('*'))
                    .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
                    .map(el => ({ tag: el.tagName, cls: el.className, right: Math.round(el.getBoundingClientRect().right) }))
            })`,
            returnByValue: true
        });

        console.log('TEST RESULT ON 390x844:');
        console.log(JSON.stringify(res.result.value, null, 2));

        ws.close();
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        edge.kill();
    }
}

testMobileViewport();
