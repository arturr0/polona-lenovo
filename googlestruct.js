import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto('https://www.google.com/search?q=Dzieje%20powszechne.%20Cz.%203%2C%20Dzieje%20nowo%C5%BCytne+site:gov.pl', { waitUntil: 'domcontentloaded' });

    // Wait for results to load
    await page.waitForSelector('.tF2Cxc');

    const structure = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('.tF2Cxc').forEach((el) => {
            results.push({
                title: el.querySelector('.DKV0Md') ? el.querySelector('.DKV0Md').innerText : '', // Title
                link: el.querySelector('a') ? el.querySelector('a').href : '',  // Link to result
                description: el.querySelector('.VwiC3b') ? el.querySelector('.VwiC3b').innerText : ''  // Description
            });
        });
        return results;
    });

    console.log(structure);
    await browser.close();
})();
