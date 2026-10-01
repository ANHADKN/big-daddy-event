const fs = require('fs');

// Create testbed HTML that loads any target page in an iframe with exact viewport dimensions
const testbedHTML = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Viewport Testbed</title>
<style>
  body { margin: 0; padding: 20px; background: #222; font-family: sans-serif; color: #fff; }
  #frame-container { border: 2px solid #A98250; display: inline-block; overflow: hidden; background: #fff; }
  iframe { border: none; display: block; }
</style>
</head>
<body>
<div id="frame-container">
  <iframe id="test-frame" src="about:blank"></iframe>
</div>
<script>
window.testViewport = function(url, width, height) {
    return new Promise((resolve) => {
        const frame = document.getElementById('test-frame');
        frame.style.width = width + 'px';
        frame.style.height = height + 'px';
        frame.onload = () => {
            try {
                const doc = frame.contentDocument || frame.contentWindow.document;
                const win = frame.contentWindow;
                
                // Allow page scripts and layout to settle
                setTimeout(() => {
                    const scrollW = doc.documentElement.scrollWidth;
                    const innerW = win.innerWidth;
                    const overflowing = [];
                    
                    doc.querySelectorAll('*').forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > innerW + 1.5 || el.scrollWidth > innerW + 1.5) {
                            overflowing.push({
                                tag: el.tagName,
                                cls: (el.className || '').toString().slice(0, 40),
                                id: el.id || '',
                                right: Math.round(rect.right),
                                scrollW: el.scrollWidth,
                                diff: Math.round(rect.right - innerW)
                            });
                        }
                    });

                    resolve({
                        url,
                        width,
                        height,
                        innerW,
                        scrollW,
                        hasOverflow: scrollW > innerW + 1,
                        overflowCount: overflowing.length,
                        overflowing: overflowing.slice(0, 10)
                    });
                }, 800);
            } catch(e) {
                resolve({ error: e.message });
            }
        };
        frame.src = url;
    });
};
</script>
</body>
</html>
`;

fs.writeFileSync('D:/BIG BADDY/big daddy/big daddy/public/testbed.html', testbedHTML);
console.log('testbed.html created in public directory');
