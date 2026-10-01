const { execSync } = require('child_process');
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

const cmd = `"${edgePath}" --headless=new --window-size=390,1600 --screenshot="D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\mobile_390_fullcard.png" "http://localhost:3000/packages.html"`;
try {
    execSync(cmd);
    console.log('Mobile 390 full card captured.');
} catch (e) {
    console.error(e.message);
}
