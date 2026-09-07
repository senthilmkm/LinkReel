const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const html = path.resolve(__dirname, '../../docs/paywall-full.html');
  const png = path.resolve(__dirname, '../../docs/paywall-full.png');
  const pdf = path.resolve(__dirname, '../../docs/paywall-full.pdf');
  const fileUrl = 'file:///' + html.replace(/\\/g, '/');

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  await page.goto(fileUrl, { waitUntil: 'networkidle' });
  const height = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  await page.setViewportSize({ width: 390, height });
  await page.screenshot({ path: png, fullPage: true, type: 'png' });
  await page.pdf({
    path: pdf,
    printBackground: true,
    width: '390px',
    height: `${height}px`,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  });
  await browser.close();
  const stat = fs.statSync(pdf);
  console.log(`PNG ${png}`);
  console.log(`PDF ${pdf} (${stat.size} bytes), height=${height}px`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
