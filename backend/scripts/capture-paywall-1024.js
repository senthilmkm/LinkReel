const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const html = path.resolve(__dirname, '../../docs/paywall-1024.html');
  const png = path.resolve(__dirname, '../../docs/paywall-1024.png');
  const pdf = path.resolve(__dirname, '../../docs/paywall-1024.pdf');
  const fileUrl = 'file:///' + html.replace(/\\/g, '/');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1024, height: 1024 },
    deviceScaleFactor: 1,
  });
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  await page.screenshot({ path: png, type: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  await page.pdf({
    path: pdf,
    printBackground: true,
    width: '1024px',
    height: '1024px',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();

  const { createCanvas, loadImage } = require('canvas');
  const img = await loadImage(png);
  console.log(`PNG ${png} ${img.width}x${img.height}`);
  console.log(`PDF ${pdf} (${fs.statSync(pdf).size} bytes)`);
  if (img.width !== 1024 || img.height !== 1024) {
    const canvas = createCanvas(1024, 1024);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 1024, 1024);
    fs.writeFileSync(png, canvas.toBuffer('image/png'));
    console.log('Resized PNG to 1024x1024');
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
