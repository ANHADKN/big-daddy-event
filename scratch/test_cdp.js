const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const html = `
<!DOCTYPE html>
<html>
<head>
<script>
window.location.href = 'http://localhost:3000/packages.html';
</script>
</head>
<body></body>
</html>
`;

// Let's use CDP to get the document width and take a mobile emulated screenshot!
const http = require('http');

async function testMobile() {
    const { spawn } = require('child_process');
    const edge = spawn(edgePath, [
        '--headless=new',
        '--remote-debugging-port=9333',
        '--window-size=450,900',
        'about:blank'
    ]);

    await new Promise(r => setTimeout(r, 1000));

    try {
        const listRes = await fetch('http://127.0.0.1:9333/json/list');
        const list = await listRes.json();
        const page = list[0];
        
        // We can communicate with CDP via simple websocket or fetch
        console.log('Target ID:', page.id);
    } catch(e) {
        console.log('CDP error:', e.message);
    } finally {
        edge.kill();
    }
}

testMobile();
