const { execSync } = require('child_process');
const http = require('http');

http.get('http://localhost:3000/packages.html', (res) => {
    console.log('HTTP status:', res.statusCode);
    
    // Take headless screenshot at 390x844
    const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
    const screenshotCmd = `"${edgePath}" --headless=new --window-size=390,844 --screenshot="D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\mobile_390_verify.png" "http://localhost:3000/packages.html"`;
    
    try {
        execSync(screenshotCmd);
        console.log('Mobile 390 screenshot saved successfully.');
    } catch (e) {
        console.error('Screenshot error:', e.message);
    }
}).on('error', (e) => {
    console.error('Server error:', e.message);
});
