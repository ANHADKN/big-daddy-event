const { execSync } = require('child_process');
const fs = require('fs');

// We re-create testbed.html if not present or create a dedicated screenshot preview page
const previewHTML = (url, width, height) => `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #1A261D; display: flex; justify-content: center; align-items: flex-start; padding: 20px 0; }
  .device-shell {
      width: ${width}px;
      height: ${height}px;
      border: 4px solid #C8A45D;
      border-radius: 12px;
      overflow: hidden;
      background: #FAF8F5;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  iframe {
      width: ${width}px;
      height: ${height}px;
      border: none;
      display: block;
  }
</style>
</head>
<body>
  <div class="device-shell">
    <iframe src="${url}"></iframe>
  </div>
</body>
</html>
`;

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function captureDevice(pageName, url, width, height) {
    const htmlPath = `D:\\BIG BADDY\\big daddy\\big daddy\\public\\preview_${pageName}.html`;
    fs.writeFileSync(htmlPath, previewHTML(url, width, height));

    const outImg = `D:\\BIG BADDY\\big daddy\\big daddy\\scratch\\device_${pageName}_${width}.png`;
    const winW = width + 100;
    const winH = height + 100;

    const cmd = `"${edgePath}" --headless=new --window-size=${winW},${winH} --hide-scrollbars --screenshot="${outImg}" "http://localhost:3000/preview_${pageName}.html"`;
    try {
        execSync(cmd);
        console.log(`Saved device preview: device_${pageName}_${width}.png`);
    } catch (e) {
        console.error(`Failed ${pageName}:`, e.message);
    } finally {
        if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
    }
}

async function runAll() {
    await captureDevice('home', '/index.html', 390, 844);
    await captureDevice('packages', '/packages.html', 390, 844);
    await captureDevice('gallery', '/gallery.html', 390, 844);
    await captureDevice('contact', '/contact.html', 390, 844);
}

runAll();
