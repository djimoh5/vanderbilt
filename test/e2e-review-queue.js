const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const TB_FILE = path.join(__dirname, 'trial-balance-example.xlsx');
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-review-${rand}@example.com`;
const PASSWORD = 'Sup3rSecure!2026';

function logErrors(page, label) {
    page.on('console', msg => { if (msg.type() === 'error') console.log(`[${label}] CONSOLE ERROR:`, msg.text()); });
    page.on('pageerror', err => console.log(`[${label}] PAGEERROR:`, String(err)));
}

async function clickButtonWithText(page, text) {
    return page.evaluate((t) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes(t));
        if (btn) { btn.click(); return true; }
        return false;
    }, text);
}

async function selectDocType(page, label) {
    await page.click('.doctype-select');
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate((l) => {
        const options = Array.from(document.querySelectorAll('mat-option'));
        const opt = options.find(o => o.textContent.trim() === l);
        if (opt) opt.click();
    }, label);
    await new Promise(r => setTimeout(r, 200));
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--window-size=1500,1000']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1000 });
    logErrors(page, 'main');
    require('fs').mkdirSync(OUT_DIR, { recursive: true });

    // 1. Sign up, create a property
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.click('.toggle-mode button');
    await new Promise(r => setTimeout(r, 200));
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('1. Signed up:', USERNAME);

    await page.click('a[routerLink="/properties"]');
    await page.waitForSelector('mat-card-title', { timeout: 15000 });
    await page.type('input[name="name"]', 'Riverside Commons');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Riverside Commons'), { timeout: 15000 });
    console.log('2. Property created');

    // 2. Import Trial Balance for the current (default) global period
    await page.click('a[routerLink="/trial-balance"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    const period = await page.evaluate(() => document.querySelector('.pill-label:nth-of-type(1)')?.parentElement?.textContent || '');
    console.log('3. Trial Balance page, workspace pills:', await page.evaluate(() => Array.from(document.querySelectorAll('.pill-label')).map(e => e.textContent.trim())));

    const tbFileInput = await page.$('input[type="file"]');
    await tbFileInput.uploadFile(TB_FILE);
    await new Promise(r => setTimeout(r, 300));
    await clickButtonWithText(page, 'Import');
    await page.waitForFunction(() => document.body.innerText.includes('accounts'), { timeout: 20000 });
    await new Promise(r => setTimeout(r, 400));
    console.log('4. Trial Balance imported');
    await page.screenshot({ path: `${OUT_DIR}/rq-1-tb-imported.png` });

    // 3. Upload the same file as a Bank Statement document
    await page.click('a[routerLink="/documents"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    await selectDocType(page, 'Bank Statement');
    const docFileInput = await page.$('input[type="file"]');
    await docFileInput.uploadFile(TB_FILE);
    await new Promise(r => setTimeout(r, 300));
    await clickButtonWithText(page, 'Upload');
    await page.waitForFunction(() => document.body.innerText.includes('Bank Statement'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));
    console.log('5. Bank Statement document uploaded');

    // 4. Open its AI Extraction page
    const extractionHref = await page.evaluate(() => {
        const link = document.querySelector('a[matTooltip="AI Extraction"]');
        return link ? link.getAttribute('href') : null;
    });
    console.log('6. Extraction link:', extractionHref);
    await page.goto(`${BASE}${extractionHref}`, { waitUntil: 'networkidle0', timeout: 15000 });
    await page.waitForSelector('.page', { timeout: 15000 });

    // 5. Run extraction (real AI call - allow generous time)
    await clickButtonWithText(page, 'Run Extraction');
    await page.waitForFunction(() => document.body.innerText.includes('Overall confidence'), { timeout: 60000 });
    await new Promise(r => setTimeout(r, 300));
    console.log('7. Extraction complete');
    await page.screenshot({ path: `${OUT_DIR}/rq-2-extracted.png` });

    // 6. Run reconciliation - first attempt fails (no active Cash account), revealing the override input
    await clickButtonWithText(page, 'Run reconciliation');
    await page.waitForFunction(() => !!document.querySelector('input[placeholder="e.g. 1110-000"]'), { timeout: 15000 });
    console.log('8. Account override input revealed (no active Cash account, as expected)');

    await page.type('input[placeholder="e.g. 1110-000"]', '1110-000');
    await clickButtonWithText(page, 'Run reconciliation');
    await page.waitForFunction(() => document.body.innerText.includes('TB account'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const reconStatus = await page.evaluate(() => document.querySelector('.recon-summary mat-chip')?.textContent.trim());
    console.log('9. Reconciliation status:', reconStatus);
    await page.screenshot({ path: `${OUT_DIR}/rq-3-reconciled.png` });

    // 7. Confirm it landed in the Review inbox
    await page.click('a[routerLink="/review"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    const inboxRowText = await page.evaluate(() => document.querySelector('.inbox-table tbody tr')?.textContent.replace(/\s+/g, ' ').trim());
    console.log('10. Review inbox row:', inboxRowText);
    await page.screenshot({ path: `${OUT_DIR}/rq-4-inbox.png` });

    // 8. Open detail, add a comment, approve
    await page.click('.inbox-table tbody tr');
    await page.waitForFunction(() => !!document.querySelector('.detail-meta'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const detailStatus = await page.evaluate(() => document.querySelector('.page-header mat-chip')?.textContent.trim());
    console.log('11. Detail status chip:', detailStatus);
    await page.screenshot({ path: `${OUT_DIR}/rq-5-detail.png` });

    await page.type('.comment-input input', 'Bank statement total does not match a normal field name - please confirm the mapping.');
    await clickButtonWithText(page, 'Comment');
    await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 10000 });
    console.log('12. Comment posted, thread length:', await page.evaluate(() => document.querySelectorAll('.comment-row').length));

    await clickButtonWithText(page, 'Approve');
    await page.waitForFunction(() => document.body.innerText.includes('Approved'), { timeout: 10000 });
    await new Promise(r => setTimeout(r, 300));
    console.log('13. Resolved as Approved (with comment -> expect wasAiCorrect=false in the accuracy log)');
    await page.screenshot({ path: `${OUT_DIR}/rq-6-resolved.png` });

    // 9. Confirm it drops out of the open inbox
    await page.click('a[routerLink="/review"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    const stillInInbox = await page.evaluate(() => !!document.querySelector('.inbox-table'));
    console.log('14. Still shows in open inbox after resolving (should be false):', stillInInbox);
    await page.screenshot({ path: `${OUT_DIR}/rq-7-inbox-after-resolve.png` });

    console.log('DONE, test user:', USERNAME);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
