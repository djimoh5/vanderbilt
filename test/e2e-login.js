const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT_DIR = path.join(__dirname, 'screenshots');
const BASE = 'http://localhost:4300';
const rand = Math.random().toString(36).slice(2, 8);
const USERNAME = `e2e-${rand}@example.com`;
const PASSWORD = 'Sup3rSecure!2026';

function logErrors(page, label) {
    page.on('console', msg => { if (msg.type() === 'error') console.log(`[${label}] CONSOLE ERROR:`, msg.text()); });
    page.on('pageerror', err => console.log(`[${label}] PAGEERROR:`, String(err)));
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ['--no-sandbox', '--window-size=1280,900']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    logErrors(page, 'main');

    require('fs').mkdirSync(OUT_DIR, { recursive: true });

    // 1. Fresh visit to root -> should redirect to /login
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    console.log('1. URL after visiting / with no session:', page.url());
    await page.screenshot({ path: `${OUT_DIR}/e2e-1-redirect-to-login.png` });

    // 2. Toggle to signup and create an account
    await page.click('.toggle-mode button');
    await new Promise(r => setTimeout(r, 200));
    await page.screenshot({ path: `${OUT_DIR}/e2e-2-signup-mode.png` });

    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('3. URL after signup:', page.url());
    await new Promise(r => setTimeout(r, 300));
    await page.screenshot({ path: `${OUT_DIR}/e2e-3-after-signup-home.png` });

    // 3. Reload page -> session should persist (resume), still on home, not bounced to /login
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 500));
    console.log('4. URL after reload (session persistence check):', page.url());
    await page.screenshot({ path: `${OUT_DIR}/e2e-4-after-reload.png` });

    // 4. Clear stored token to simulate logout, confirm guard redirects back to /login
    await page.evaluate(() => localStorage.clear());
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    console.log('5. URL after clearing token and revisiting /:', page.url());
    await page.screenshot({ path: `${OUT_DIR}/e2e-5-logged-out-redirect.png` });

    // 5. Wrong password shows inline error
    await page.type('input[name="username"]', USERNAME);
    await page.type('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await new Promise(r => setTimeout(r, 500));
    console.log('6. URL after wrong password attempt (should stay on /login):', page.url());
    await page.screenshot({ path: `${OUT_DIR}/e2e-6-wrong-password-error.png` });

    // 6. Correct password logs in
    await page.evaluate(() => { document.querySelector('input[name="password"]').value = ''; });
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => !location.pathname.includes('/login'), { timeout: 15000 });
    console.log('7. URL after correct login:', page.url());
    await page.screenshot({ path: `${OUT_DIR}/e2e-7-login-success.png` });

    // 7. One-time code screen renders
    await page.goto(`${BASE}/login/code`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.screenshot({ path: `${OUT_DIR}/e2e-8-login-code.png` });

    // 8. Forgot password screen renders
    await page.goto(`${BASE}/password/reset`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('mat-card', { timeout: 15000 });
    await page.screenshot({ path: `${OUT_DIR}/e2e-9-forgot-password.png` });

    console.log('DONE, test user:', USERNAME);
    await browser.close();
})().catch(e => { console.error('SCRIPT_ERROR', e); process.exit(1); });
