const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-sidenav-${rand}@example.com`;
const PASSWORD = 'Sup3rSecure!2026';

function logErrors(page, label) {
    page.on('console', msg => { if (msg.type() === 'error') console.log(`[${label}] CONSOLE ERROR:`, msg.text()); });
    page.on('pageerror', err => console.log(`[${label}] PAGEERROR:`, String(err)));
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--window-size=1400,1000']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    logErrors(page, 'main');

    require('fs').mkdirSync(OUT_DIR, { recursive: true });

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.click('.toggle-mode button');
    await new Promise(r => setTimeout(r, 200));
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('1. Signed up, landed on:', page.url());

    await new Promise(r => setTimeout(r, 500));
    const sidenavPresent = await page.evaluate(() => !!document.querySelector('.app-sidenav'));
    const navLinksGone = await page.evaluate(() => !document.querySelector('.nav-links'));
    console.log('2. Sidenav present:', sidenavPresent, '| Old horizontal nav-links removed:', navLinksGone);
    await page.screenshot({ path: `${OUT_DIR}/sidenav-1-expanded.png` });

    // Collapse
    await page.click('.sidenav-toggle');
    await new Promise(r => setTimeout(r, 300));
    const collapsedClassPresent = await page.evaluate(() => document.querySelector('.app-sidenav').classList.contains('collapsed'));
    console.log('3. Sidenav collapsed class applied after toggle click:', collapsedClassPresent);
    await page.screenshot({ path: `${OUT_DIR}/sidenav-2-collapsed.png` });

    // Header stays visible (toolbar bounding box at top, not overlapped)
    const toolbarBox = await page.evaluate(() => {
        const el = document.querySelector('.shell-toolbar');
        const r = el.getBoundingClientRect();
        return { top: r.top, height: r.height };
    });
    console.log('4. Toolbar box (should be at top, not overlapped):', JSON.stringify(toolbarBox));

    // Expand again, then click a couple nav items and confirm navigation + active state
    await page.click('.sidenav-toggle');
    await new Promise(r => setTimeout(r, 300));

    await page.click('a[href="/coa"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    console.log('5. URL after clicking Chart of Accounts:', page.url());
    const coaActive = await page.evaluate(() => document.querySelector('a[href="/coa"]').classList.contains('active-nav-item'));
    console.log('6. COA sidenav item marked active:', coaActive);
    await page.screenshot({ path: `${OUT_DIR}/sidenav-3-coa-active.png` });

    // Home icon in header
    await page.click('.home-link');
    await page.waitForFunction(() => location.pathname === '/', { timeout: 15000 });
    console.log('7. URL after clicking header Home icon:', page.url());
    const homeActive = await page.evaluate(() => document.querySelector('.home-link').classList.contains('active-icon-link'));
    console.log('8. Home icon marked active:', homeActive);
    await page.screenshot({ path: `${OUT_DIR}/sidenav-4-home-active.png` });

    console.log('DONE, test user:', USERNAME);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
