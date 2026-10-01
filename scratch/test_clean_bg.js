const sharp = require('sharp');
const fs = require('fs');

async function testInpaint() {
    const img = sharp('public/assets/images/hero/home-page.png');
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const clean = Buffer.from(data);

    // Let's inspect the mountain behind the text.
    // The text letters have high luminance or distinct color.
    // A mountain pixel typically has: r < 140, g < 140, b < 150.
    // The text letters have: (r > 160 && g > 160 && b > 160) or (r > 130 && g > 105 && b < 85 && r-b > 40)
    
    // For every pixel in the text region (y: 260 to 650, x: 440 to 1210):
    // If it is text: replace it by searching horizontally for the nearest non-text pixel on the left and right, and lerping them!
    
    function isText(x, y) {
        if (x < 440 || x > 1210 || y < 260 || y > 650) return false;
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        
        // White letters (BIG DADDY EVENTS)
        if (r > 155 && g > 155 && b > 155) return true;
        // Anti-aliased edges with high brightness
        if ((r + g + b) / 3 > 150 && (r > 120 && g > 120)) return true;
        // Gold text / flourish
        if (r > 130 && g > 100 && (r - b) > 35) return true;
        
        return false;
    }

    // Dilate text mask slightly (1-2 px) to catch all anti-aliased fringe
    const textMask = new Uint8Array(width * height);
    for (let y = 260; y <= 650; y++) {
        for (let x = 440; x <= 1210; x++) {
            if (isText(x, y)) {
                textMask[y * width + x] = 1;
            }
        }
    }

    // Dilate
    const dilatedMask = new Uint8Array(width * height);
    for (let y = 260; y <= 650; y++) {
        for (let x = 440; x <= 1210; x++) {
            if (textMask[y * width + x]) {
                for (let dy = -2; dy <= 2; dy++) {
                    for (let dx = -2; dx <= 2; dx++) {
                        dilatedMask[(y + dy) * width + (x + dx)] = 1;
                    }
                }
            }
        }
    }

    // Replace masked pixels using horizontal interpolation from closest non-text pixels
    for (let y = 260; y <= 650; y++) {
        for (let x = 440; x <= 1210; x++) {
            if (dilatedMask[y * width + x]) {
                // Find left non-text pixel
                let xLeft = x - 1;
                while (xLeft >= 400 && dilatedMask[y * width + xLeft]) {
                    xLeft--;
                }
                // Find right non-text pixel
                let xRight = x + 1;
                while (xRight <= 1250 && dilatedMask[y * width + xRight]) {
                    xRight++;
                }

                const idx = (y * width + x) * channels;
                if (xLeft >= 400 && xRight <= 1250) {
                    const idxL = (y * width + xLeft) * channels;
                    const idxR = (y * width + xRight) * channels;
                    const t = (x - xLeft) / (xRight - xLeft);

                    clean[idx] = Math.round(data[idxL] * (1 - t) + data[idxR] * t);
                    clean[idx + 1] = Math.round(data[idxL + 1] * (1 - t) + data[idxR + 1] * t);
                    clean[idx + 2] = Math.round(data[idxL + 2] * (1 - t) + data[idxR + 2] * t);
                } else if (xLeft >= 400) {
                    const idxL = (y * width + xLeft) * channels;
                    clean[idx] = data[idxL];
                    clean[idx + 1] = data[idxL + 1];
                    clean[idx + 2] = data[idxL + 2];
                } else if (xRight <= 1250) {
                    const idxR = (y * width + xRight) * channels;
                    clean[idx] = data[idxR];
                    clean[idx + 1] = data[idxR + 1];
                    clean[idx + 2] = data[idxR + 2];
                }
            }
        }
    }

    await sharp(clean, { raw: { width, height, channels } })
        .webp({ quality: 85 })
        .toFile('scratch/clean_hero_test.webp');
    console.log('Saved scratch/clean_hero_test.webp');
}

testInpaint();
