const sharp = require('sharp');

async function findTextBounds() {
    const { data, info } = await sharp('D:/BIG BADDY/big daddy/big daddy/public/assets/images/hero/home-page.png')
        .raw()
        .toBuffer({ resolveWithObject: true });

    let minX = info.width, maxX = 0, minY = info.height, maxY = 0;

    // Search for near-white pixels (r, g, b > 230) in the upper-middle area (y between 250 and 650)
    for (let y = 250; y < 650; y++) {
        for (let x = 300; x < 1200; x++) {
            const idx = (y * info.width + x) * info.channels;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            if (r > 235 && g > 235 && b > 235) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    console.log(`Text bounds in 1536x1024: x=${minX} to ${maxX} (width=${maxX - minX}), y=${minY} to ${maxY} (height=${maxY - minY})`);
    console.log(`Center x: ${(minX + maxX) / 2}, Center y: ${(minY + maxY) / 2}`);
}

findTextBounds();
