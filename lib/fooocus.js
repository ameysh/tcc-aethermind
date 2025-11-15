const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

/**
 * Generate an image on the local Fooocus UI by automating the browser.
 * Strategy:
 *  - Open Fooocus page
 *  - Fill textarea[data-testid="textbox"] with prompt
 *  - Click #generate_button
 *  - Wait for either an <img> element to appear and read its src (which contains the local file path as file=/...),
 *    or poll the outputs directory for a newly-created image file.
 *
 * Returns the absolute path to the generated image file.
 */
async function generateImage(prompt, opts = {}) {
    const FOOCOUS_URL = process.env.FOOCOUS_URL || 'http://127.0.0.1:7865/';
    const OUTPUTS_DIR = process.env.FOOCOUS_OUTPUTS_DIR || '/home/mjolnix/AI/Fooocus-Prime/outputs';
    const TIMEOUT_MS = opts.timeoutMs || 4 * 60 * 1000; // 4 minutes default
    const POLL_INTERVAL = 1000;

    const startTime = Date.now();

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto(FOOCOUS_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Wait for prompt box
        await page.waitForSelector('textarea[data-testid="textbox"]', { timeout: 10000 });
        await page.fill('textarea[data-testid="textbox"]', prompt);

        // Click the generate button
        await page.click('#generate_button');

        // First attempt: wait for an <img> to appear that contains the file= URL
        try {
            const imgHandle = await page.waitForSelector('img', { timeout: Math.min(60000, TIMEOUT_MS) });
            if (imgHandle) {
                const src = await imgHandle.getAttribute('src');
                if (src && src.includes('file=')) {
                    // parse the local file path after 'file='
                    const part = src.split('file=')[1];
                    const filePath = decodeURIComponent(part.split('?')[0]);
                    // If path is relative or missing leading slash, normalize
                    const abs = path.resolve(filePath);
                    if (fs.existsSync(abs)) {
                        return abs;
                    }
                }
            }
        } catch (err) {
            // ignore and fallback to scanning outputs dir
        }

        // Fallback: poll outputs directory for new image files created after startTime
        const endAt = Date.now() + TIMEOUT_MS;
        while (Date.now() < endAt) {
            const candidate = findNewestOutputFile(OUTPUTS_DIR, startTime);
            if (candidate) {
                return candidate;
            }
            await new Promise(r => setTimeout(r, POLL_INTERVAL));
        }

        throw new Error('Timed out waiting for generated image (no image detected in browser and no new output files).');

    } finally {
        try { await browser.close(); } catch (e) { /* ignore */ }
    }
}

function findNewestOutputFile(outputsDir, afterTimestamp) {
    if (!fs.existsSync(outputsDir)) return null;

    let newest = null;

    // outputs directory likely contains subfolders per date
    const dateDirs = fs.readdirSync(outputsDir).map(d => path.join(outputsDir, d)).filter(p => fs.existsSync(p) && fs.statSync(p).isDirectory());

    for (const dir of dateDirs) {
        const files = fs.readdirSync(dir).map(f => path.join(dir, f)).filter(p => fs.existsSync(p) && fs.statSync(p).isFile());
        for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (!['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) continue;
            const stat = fs.statSync(file);
            if (stat.mtimeMs >= afterTimestamp - 1000) {
                if (!newest || stat.mtimeMs > fs.statSync(newest).mtimeMs) {
                    newest = file;
                }
            }
        }
    }

    return newest;
}

module.exports = { generateImage };
