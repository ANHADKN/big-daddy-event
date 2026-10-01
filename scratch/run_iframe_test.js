const { spawn } = require('child_process');

async function testOne() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9955',
        '--no-first-run',
        '--no-default-browser-check',
        'http://localhost:3000/testbed.html'
    ]);

    await new Promise(r => setTimeout(r, 1800));

    try {
        const listRes = await fetch('http://127.0.0.1:9955/json/list');
        const list = await listRes.json();
        console.log('Targets:', list.map(t => ({ id: t.id, url: t.url, type: t.type })));
        const target = list.find(t => t.url.includes('testbed.html')) || list[0];
        const ws = new WebSocket(target.webSocketDebuggerUrl);
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

        // Wait a bit for testbed.html to be fully loaded
        await new Promise(r => setTimeout(r, 1000));

        const checkFn = await send('Runtime.evaluate', {
            expression: `typeof window.testViewport`,
            returnByValue: true
        });
        console.log('typeof window.testViewport:', checkFn.result.value);

        const res = await send('Runtime.evaluate', {
            expression: `window.testViewport('/index.html', 390, 844)`,
            awaitPromise: true,
            returnByValue: true
        });

        console.log('Result:', JSON.stringify(res.result.value, null, 2));
        ws.close();
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        edge.kill();
    }
}

testOne();
