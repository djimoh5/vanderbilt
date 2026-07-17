const puppeteer = require('puppeteer-core');

const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-d1-${rand}@example.com`;
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

    // Sign up (creates a tenant)
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.click('.toggle-mode button'); // toggle to signup
    await new Promise(r => setTimeout(r, 200));
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('1. Signed up, landed on:', page.url());
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `${OUT_DIR}/d1-1-home-shell.png` });

    // Navigate to Properties
    await page.click('a[routerLink="/properties"]');
    await page.waitForSelector('mat-card-title', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/d1-2-properties-empty.png` });

    // Create a property
    await page.type('input[name="name"]', 'Northbridge Centre');
    await page.type('input[name="yardiCode"]', 'pbnor001');
    await page.click('.section-card:nth-of-type(1) button[type="submit"]');
    await page.waitForFunction(() => document.body.innerText.includes('Northbridge Centre'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/d1-3-property-created.png` });

    // Invite a teammate
    const TEAMMATE = `e2e-d1-teammate-${rand}@example.com`;
    await page.type('input[name="inviteUsername"]', TEAMMATE);
    const forms = await page.$$('form');
    const inviteForm = forms[forms.length - 1];
    await inviteForm.$eval('button[type="submit"]', b => b.click());
    await page.waitForFunction(() => document.body.innerText.includes('Assign them a role'), { timeout: 15000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/d1-4-invite-sent.png` });

    // Assign role: select property + role, submit
    // Angular Material mat-select isn't a native <select>; click to open and choose option
    const selects = await page.$$('mat-select');
    // First mat-select in the assign-role form is property, second is role
    const assignPropertySelect = selects[selects.length - 2];
    const assignRoleSelect = selects[selects.length - 1];

    await assignPropertySelect.click();
    await page.waitForSelector('mat-option', { timeout: 5000 });
    await page.click('mat-option');
    await new Promise(r => setTimeout(r, 200));

    await assignRoleSelect.click();
    await page.waitForSelector('mat-option', { timeout: 5000 });
    await page.click('mat-option'); // first option = accountant
    await new Promise(r => setTimeout(r, 200));

    await page.screenshot({ path: `${OUT_DIR}/d1-5-assign-role-filled.png` });

    const allForms = await page.$$('form');
    const roleForm = allForms[allForms.length - 1];
    await roleForm.$eval('button[type="submit"]', b => b.click());
    await new Promise(r => setTimeout(r, 800));
    await page.screenshot({ path: `${OUT_DIR}/d1-6-role-assigned.png` });

    // Navigate to Chart of Accounts
    await page.click('a[routerLink="/coa"]');
    await page.waitForSelector('mat-accordion', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT_DIR}/d1-7-coa-config.png` });

    // Expand first category panel and toggle an account
    await page.click('mat-expansion-panel-header');
    await page.waitForSelector('mat-slide-toggle', { timeout: 5000 });
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/d1-8-coa-expanded.png` });

    const toggleButton = await page.$('mat-slide-toggle button');
    await toggleButton.click();
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: `${OUT_DIR}/d1-9-coa-toggled.png` });

    console.log('DONE, test user:', USERNAME, 'teammate:', TEAMMATE);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
