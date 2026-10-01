const { spawn } = require('child_process');
const fs = require('fs');

async function run() {
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9555',
        '--no-first-run',
        '--no-default-browser-check',
        '--hide-scrollbars',
        'http://localhost:3000/packages.html'
    ]);

    await new Promise(r => setTimeout(r, 2000));

    try {
        const listRes = await fetch('http://127.0.0.1:9555/json/list');
        const list = await listRes.json();
        const page = list.find(p => p.url.includes('packages.html')) || list[0];
        console.log('Connecting to', page.webSocketDebuggerUrl);

        const ws = new WebSocket(page.webSocketDebuggerUrl);
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

        // Set viewport to exact 390x844
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 2,
            mobile: true,
            screenWidth: 390,
            screenHeight: 844
        });

        await new Promise(r => setTimeout(r, 1000));

        // Evaluate layout metrics
        const evalRes = await send('Runtime.evaluate', {
            expression: `(() => {
                const tabs = document.querySelector('.package-tabs');
                const card = document.querySelector('.pkg-editorial-item');
                return {
                    docWidth: document.documentElement.clientWidth,
                    docScrollWidth: document.documentElement.scrollWidth,
                    winInnerWidth: window.innerWidth,
                    tabsWidth: tabs ? tabs.getBoundingClientRect().width : null,
                    cardWidth: card ? card.getBoundingClientRect().width : null,
                    activeTab: document.querySelector('.pkg-tab-btn.active') ? document.querySelector('.pkg-tab-btn.active').dataset.tab : null,
                    tabsButtons: Array.from(document.querySelectorAll('.pkg-tab-btn')).map(b => ({
                        tab: b.dataset.tab,
                        width: b.getBoundingClientRect().width,
                        text: b.querySelector('.pkg-tab-text') ? b.querySelector('.pkg-tab-text').innerText : b.innerText
                    }))
                };
            })()`,
            returnByValue: true
        });

        console.log('LAYOUT EVALUATION:', JSON.stringify(evalRes.result.value, null, 2));

        // Scroll to tabs
        await send('Runtime.evaluate', {
            expression: `document.querySelector('.package-tabs-wrapper').scrollIntoView({ behavior: 'instant', block: 'start' });`
        });
        await new Promise(r => setTimeout(r, 500));

        // Capture screenshot of mobile tabs and top of card
        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/scratch/cdp_mobile_390.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Mobile screenshot saved to scratch/cdp_mobile_390.png');

        ws.close();
    } catch(err) {
        console.error('CDP script error:', err);
    } finally {
        edge.kill();
    }
}

run();
