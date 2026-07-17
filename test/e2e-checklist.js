const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-checklist-${rand}@example.com`;
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

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--window-size=1500,1100']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1500, height: 1100 });
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
    await page.type('input[name="name"]', 'Lakeside Terrace');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Lakeside Terrace'), { timeout: 15000 });
    console.log('2. Property created');

    // 2. Go to Checklist, confirm empty state, start it
    await page.click('a[routerLink="/checklist"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 400));
    const emptyStateVisible = await page.evaluate(() => document.body.innerText.includes('No PreClose Checklist started yet'));
    console.log('3. Empty state shown before starting:', emptyStateVisible);
    await page.screenshot({ path: `${OUT_DIR}/cl-1-empty.png` });

    await clickButtonWithText(page, 'Start Checklist');
    await page.waitForFunction(() => !!document.querySelector('.category-accordion'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const categoryCount = await page.evaluate(() => document.querySelectorAll('.category-panel').length);
    const progressText = await page.evaluate(() => document.querySelector('.progress-label')?.textContent.trim());
    console.log('4. Categories rendered:', categoryCount, '| progress:', progressText);
    await page.screenshot({ path: `${OUT_DIR}/cl-2-started.png` });

    // 3. Idempotent instantiate: reload the page, confirm the SAME instance (not a fresh blank one)
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const stillHasAccordion = await page.evaluate(() => !!document.querySelector('.category-accordion'));
    console.log('5. Checklist still present after reload (no re-instantiate needed):', stillHasAccordion);

    // 4. Expand the first category, mark the first item "No", add a comment, then flip to "Yes"
    await page.click('.category-panel:nth-of-type(1) mat-expansion-panel-header');
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/cl-3-expanded.png` });

    const firstItemLabel = await page.evaluate(() => document.querySelector('.item-label')?.textContent.trim());
    console.log('6. First item label:', firstItemLabel);

    // Click the "No" toggle on the first item
    await page.evaluate(() => {
        const group = document.querySelector('.status-toggle');
        const buttons = Array.from(group.querySelectorAll('button, .mat-button-toggle-button'));
        const noBtn = buttons.find(b => b.textContent.trim() === 'No');
        if (noBtn) noBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const progressAfterNo = await page.evaluate(() => document.querySelector('.progress-label')?.textContent.trim());
    console.log('7. Progress after marking first item No:', progressAfterNo);

    // Manager comment
    await page.type('.comment-input input', 'Please confirm this was reviewed - looks outstanding.');
    await clickButtonWithText(page, 'Comment');
    await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 0, { timeout: 10000 });
    console.log('8. Manager comment posted, thread length:', await page.evaluate(() => document.querySelectorAll('.comment-row').length));

    // Accountant reply
    await page.type('.comment-input input', 'Reviewed and resolved, marking Yes now.');
    await clickButtonWithText(page, 'Comment');
    await page.waitForFunction(() => document.querySelectorAll('.comment-row').length > 1, { timeout: 10000 });
    const threadAfterReply = await page.evaluate(() => Array.from(document.querySelectorAll('.comment-row .comment-text')).map(e => e.textContent.trim()));
    console.log('9. Full thread after reply (should be 2, in order):', JSON.stringify(threadAfterReply));
    await page.screenshot({ path: `${OUT_DIR}/cl-4-thread.png` });

    // Flip to Yes, confirm thread survives
    await page.evaluate(() => {
        const group = document.querySelector('.status-toggle');
        const buttons = Array.from(group.querySelectorAll('button, .mat-button-toggle-button'));
        const yesBtn = buttons.find(b => b.textContent.trim() === 'Yes');
        if (yesBtn) yesBtn.click();
    });
    await new Promise(r => setTimeout(r, 400));
    const threadAfterYes = await page.evaluate(() => document.querySelectorAll('.comment-row').length);
    const progressAfterYes = await page.evaluate(() => document.querySelector('.progress-label')?.textContent.trim());
    console.log('10. Comment thread preserved after flipping to Yes (should still be 2):', threadAfterYes, '| progress:', progressAfterYes);
    await page.screenshot({ path: `${OUT_DIR}/cl-5-resolved.png` });

    console.log('DONE, test user:', USERNAME);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
