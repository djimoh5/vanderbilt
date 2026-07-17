const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-ws-${rand}@example.com`;
const PASSWORD = 'Sup3rSecure!2026';

function logErrors(page, label) {
    page.on('console', msg => { if (msg.type() === 'error') console.log(`[${label}] CONSOLE ERROR:`, msg.text()); });
    page.on('pageerror', err => console.log(`[${label}] PAGEERROR:`, String(err)));
}

async function selectOption(page, selectSelector, optionText) {
    await page.click(selectSelector);
    await new Promise(r => setTimeout(r, 200));
    await page.evaluate((text) => {
        const options = Array.from(document.querySelectorAll('mat-option'));
        const opt = options.find(o => o.textContent.trim().includes(text));
        if (opt) opt.click();
    }, optionText);
    await new Promise(r => setTimeout(r, 300));
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

    // Sign up (creates a tenant with zero properties)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.click('.toggle-mode button');
    await new Promise(r => setTimeout(r, 200));
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('1. Signed up, landed on:', page.url());

    // Zero properties -> header should show "Add a property" affordance, not selects
    await new Promise(r => setTimeout(r, 400));
    const emptyState = await page.evaluate(() => !!document.querySelector('.workspace-empty'));
    console.log('2. Header shows empty-state add-property link with zero properties:', emptyState);
    await page.screenshot({ path: `${OUT_DIR}/ws-1-empty-header.png` });

    // Create two properties
    await page.click('a[routerLink="/properties"]');
    await page.waitForSelector('mat-card-title', { timeout: 15000 });
    await page.type('input[name="name"]', 'Northbridge Centre');
    await page.type('input[name="yardiCode"]', 'pbnor001');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Northbridge Centre'), { timeout: 15000 });
    console.log('3. Property 1 created');

    await new Promise(r => setTimeout(r, 300));
    await page.type('input[name="name"]', 'Southgate Plaza');
    await page.type('input[name="yardiCode"]', 'pbsou002');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Southgate Plaza'), { timeout: 15000 });
    console.log('4. Property 2 created');

    // Header should now show the selectors (not empty state), defaulted to property 1
    await new Promise(r => setTimeout(r, 400));
    const headerAfterCreate = await page.evaluate(() => ({
        hasEmptyState: !!document.querySelector('.workspace-empty'),
        hasSelectors: !!document.querySelector('.workspace-selectors'),
        propertyText: document.querySelector('.workspace-property-select')?.textContent.trim()
    }));
    console.log('5. Header state after creating properties:', JSON.stringify(headerAfterCreate));
    await page.screenshot({ path: `${OUT_DIR}/ws-2-header-with-properties.png` });

    // No per-page selectors should remain on Trial Balance / COA / Documents
    await page.click('a[routerLink="/trial-balance"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const tbHasOwnSelectors = await page.evaluate(() => !!document.querySelector('.page .selectors, .page .property-select'));
    console.log('6. Trial Balance page has its own selectors (should be false):', tbHasOwnSelectors);
    await page.screenshot({ path: `${OUT_DIR}/ws-3-trial-balance-no-selectors.png` });

    await page.click('a[routerLink="/coa"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const coaHasOwnSelectors = await page.evaluate(() => !!document.querySelector('.page .property-select'));
    console.log('7. COA page has its own property select (should be false):', coaHasOwnSelectors);

    await page.click('a[routerLink="/documents"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const docsHasOwnSelectors = await page.evaluate(() => !!document.querySelector('.page .selectors, .page .property-select'));
    console.log('8. Documents page has its own property/period selectors (should be false):', docsHasOwnSelectors);
    await page.screenshot({ path: `${OUT_DIR}/ws-4-documents-no-selectors.png` });

    // Switch property from the header while on Documents page, confirm it reflects live (event-driven reload)
    await selectOption(page, '.workspace-property-select', 'Southgate Plaza');
    await new Promise(r => setTimeout(r, 400));
    const propertyAfterSwitch = await page.evaluate(() => document.querySelector('.workspace-property-select')?.textContent.trim());
    console.log('9. Property select text after switching to Southgate on Documents page:', propertyAfterSwitch);

    // Navigate to Trial Balance, confirm the switched property carried over
    await page.click('a[routerLink="/trial-balance"]');
    await page.waitForSelector('.page', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    const propertyOnTB = await page.evaluate(() => document.querySelector('.workspace-property-select')?.textContent.trim());
    console.log('10. Property select text on Trial Balance after nav (should still be Southgate):', propertyOnTB);

    // Reload browser, confirm persisted selection survives
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    const propertyAfterReload = await page.evaluate(() => document.querySelector('.workspace-property-select')?.textContent.trim());
    console.log('11. Property select text after full page reload (localStorage persistence):', propertyAfterReload);
    await page.screenshot({ path: `${OUT_DIR}/ws-5-after-reload.png` });

    // "+ Add new property" sentinel option navigates to /properties and reverts selection
    await selectOption(page, '.workspace-property-select', 'Add new property');
    await new Promise(r => setTimeout(r, 500));
    console.log('12. URL after picking "Add new property":', page.url());
    const propertyAfterAddNewClick = await page.evaluate(() => document.querySelector('.workspace-property-select')?.textContent.trim());
    console.log('13. Property select text after Add-new-property nav (should revert to real property, not blank):', propertyAfterAddNewClick);
    await page.screenshot({ path: `${OUT_DIR}/ws-6-after-add-new-property-click.png` });

    console.log('DONE, test user:', USERNAME);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
