import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Setup log file
const logFile = path.resolve('logs.json');
let logQueue = [];
let isWriting = false;

// Append log entry to queue
function appendToLogFile(logType, message) {
  const logEntry = { type: logType, message, timestamp: new Date().toISOString() };
  logQueue.push(logEntry);
  processLogQueue();
}

// Process the log queue sequentially
async function processLogQueue() {
  if (isWriting || logQueue.length === 0) return;
  isWriting = true;

  try {
    // Read existing logs from the file
    const existingLogs = await fs.promises.readFile(logFile, 'utf-8').catch(() => '[]');
    const logs = JSON.parse(existingLogs);

    // Add new logs to the array
    logs.push(...logQueue);
    logQueue = [];

    // Write updated logs to the file
    await fs.promises.writeFile(logFile, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to log file:', error.message);
  } finally {
    isWriting = false;
    if (logQueue.length > 0) processLogQueue(); // Process remaining items in the queue
  }
}

// Override console.log
const originalLog = console.log;
console.log = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  appendToLogFile('log', message);
  originalLog(...args);
};

// Override console.error
const originalError = console.error;
console.error = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  appendToLogFile('error', message);
  originalError(...args);
};

// Function to search on Google using Puppeteer
async function searchOnGoogleWithPuppeteer(query) {
    console.log(`Starting search on Google with Puppeteer for query: "${query}"`);
    const startTime = Date.now();
  
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });
  
    try {
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
      console.log(`Navigating to Google URL: ${googleUrl}`);
      await page.goto(googleUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('div[data-hveid]', { timeout: 60000 });
  
      const results = await page.evaluate(() => {
        const elements = document.querySelectorAll('div[data-hveid]');
        const data = [];
        elements.forEach((el) => {
          const title = el.querySelector('h3')?.innerText;
          const link = el.querySelector('a')?.href;
          if (title && link && !link.includes('.pdf') && link.includes('gov.pl')) {
            data.push({ title, link });
          }
        });
        return data;
      });
  
      console.log(`Found ${results.length} results using Puppeteer`);
      return results;
    } catch (error) {
      console.error('Error during Puppeteer search:', error.message);
      return [];
    } finally {
      await browser.close();
      const endTime = Date.now();
      console.log(`Total time for search: ${(endTime - startTime) / 1000} seconds`);
    }
  }
  

// Main function
async function main() {
  const query = 'example query'; // Replace with your query
  const results = await searchOnGoogleWithPuppeteer(query);

  // Handle results or save them as needed
  console.log('Search Results:', results);

  // Optional: Save results to a JSON file
  const resultsFile = path.resolve('results.json');
  await fs.promises.writeFile(resultsFile, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`Results saved to ${resultsFile}`);
}

main();
