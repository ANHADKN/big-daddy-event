const { spawn } = require('child_process');

async function inspectGallery() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9888',
        '--window-size=390,844',
        '--disable-extensions',
        'http://localhost:3000/gallery.html'
    ]);

    await new Promise(r => setTimeout(r, 3000));

    try {
        const listRes = await fetch('http://127.0.0.1:9888/json/list');
        const list = await listRes.json();
        const page = list.find(t => t.type === 'page');
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

        await send('Runtime.enable');
        // Wait 1.5s for dynamic fetch to render pills
        await new Promise(r => setTimeout(r, 1500));
        const res = await send('Runtime.evaluate', {
            expression: `(() => {
                const pills = document.querySelectorAll('.filter-pill');
                const container = document.querySelector('.gallery-filter-container');
                const section = document.querySelector('.gallery-filter-section');
                return {
                    pillCount: pills.length,
                    containerDisplay: getComputedStyle(container).display,
                    containerFlexWrap: getComputedStyle(container).flexWrap,
                    containerWidth: container.offsetWidth,
                    sectionWidth: section.offsetWidth,
                    windowInnerWidth: window.innerWidth,
                    documentScrollWidth: document.documentElement.scrollWidth,
                    pills: Array.from(pills).map(p => ({
                        text: p.innerText.trim().replace(/\\s+/g, ' '),
                        width: p.offsetWidth,
                        offsetLeft: p.offsetLeft,
                        offsetTop: p.offsetTop
                    }))
                };
            })()`,
            returnByValue: true
        });

        console.log('Inspection result:', JSON.stringify(res.result.value, null, 2));
        ws.close();
    } catch(e) {
        console.error('Error:', e.message);
    } finally {
        edge.kill();
    }
}

inspectGallery();
