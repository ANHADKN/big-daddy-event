const { execSync } = require('child_process');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const cmd = `"${edgePath}" --headless=new --window-size=390,844 --dump-dom "http://localhost:3000/packages_debug.html"`;

try {
    const stdout = execSync(cmd, { maxBuffer: 10 * 1024 * 1024 });
    const match = stdout.toString().match(/<div id="overflow-debug">([\s\S]*?)<\/div>/);
    if (match) {
        console.log('OVERFLOW RESULT:');
        console.log(JSON.parse(match[1]));
    } else {
        console.log('No overflow-debug found');
    }
} catch (e) {
    console.error('Error:', e.message);
}
