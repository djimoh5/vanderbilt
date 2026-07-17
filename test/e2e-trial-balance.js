const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const TB_FILE = path.join(__dirname, 'trial-balance-example.xlsx');
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-tb-${rand}@example.com`;
const PASSWORD = 'Sup3rSecure!2026';
const PERIOD = '2026-05';

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

    // Sign up (creates a tenant), create a property
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.click('.toggle-mode button');
    await new Promise(r => setTimeout(r, 200));
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('1. Signed up, landed on:', page.url());

    await page.click('a[routerLink="/properties"]');
    await page.waitForSelector('mat-card-title', { timeout: 15000 });
    await page.type('input[name="name"]', 'Northbridge Centre');
    await page.type('input[name="yardiCode"]', 'pbnor001');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Northbridge Centre'), { timeout: 15000 });
    console.log('2. Property created');

    // Navigate to Trial Balance
    await page.click('a[routerLink="/trial-balance"]');
    await page.waitForSelector('input[type="month"]', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/tb-1-empty.png` });

    // Set period - set the native month input's value directly and dispatch events so Angular's ngModel picks it up
    await page.$eval('input[type="month"]', (el, value) => {
        const proto = Object.getPrototypeOf(el);
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }, PERIOD);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/tb-2-period-set.png` });

    // Upload file
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(TB_FILE);
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/tb-3-file-chosen.png` });

    // Click import
    const importClicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Import'));
        if (btn) { btn.click(); return true; }
        return false;
    });
    console.log('3. Import clicked:', importClicked);

    await page.waitForFunction(() => document.body.innerText.includes('accounts'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT_DIR}/tb-4-imported.png`, fullPage: true });

    const summary = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, table tr.mat-mdc-row');
        const meta = document.querySelector('.snapshot-meta');
        // find a known row - Petty Cash account 1105-000
        const bodyText = document.body.innerText;
        return {
            rowCount: rows.length,
            metaText: meta ? meta.textContent.trim() : null,
            hasPettyCash: bodyText.includes('1105-000') && bodyText.includes('Petty Cash'),
            hasDisbursement: bodyText.includes('1110-000') && bodyText.includes('Cash Account - Disbursement')
        };
    });
    console.log('4. Import result summary:', JSON.stringify(summary));

    // Re-navigate away and back to confirm persisted snapshot loads via GET
    await page.click('a[routerLink="/coa"]');
    await new Promise(r => setTimeout(r, 300));
    await page.click('a[routerLink="/trial-balance"]');
    await page.waitForFunction(() => document.body.innerText.includes('accounts'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT_DIR}/tb-5-reloaded-snapshot.png` });
    const reloadedMeta = await page.evaluate(() => {
        const meta = document.querySelector('.snapshot-meta');
        return meta ? meta.textContent.trim() : null;
    });
    console.log('5. Reloaded snapshot meta (should show account count again):', reloadedMeta);

    // Re-import same period to confirm overwrite (not duplicate) - upload again
    const fileInput2 = await page.$('input[type="file"]');
    await fileInput2.uploadFile(TB_FILE);
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Import'));
        if (btn) btn.click();
    });
    await new Promise(r => setTimeout(r, 1500));
    const reimportMeta = await page.evaluate(() => {
        const meta = document.querySelector('.snapshot-meta');
        return meta ? meta.textContent.trim() : null;
    });
    console.log('6. Re-import meta (account count should be unchanged, not doubled):', reimportMeta);
    await page.screenshot({ path: `${OUT_DIR}/tb-6-reimported.png` });

    console.log('DONE, test user:', USERNAME, 'period:', PERIOD);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
