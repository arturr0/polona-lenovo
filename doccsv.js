import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';
import pdf from 'pdf-parse'; // For PDF parsing
import xlsx from 'xlsx'; // For XLS parsing
import { parse as csvParse } from 'csv-parse/sync'; // Synchronous CSV parsing

// Create an Axios instance with a custom HTTPS agent
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Avoid certificate verification issues
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

// Setup log file and write stream
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
    const existingLogs = await fs.promises.readFile(logFile, 'utf-8').catch(() => '[]');
    const logs = JSON.parse(existingLogs);
    logs.push(...logQueue);
    logQueue = [];
    await fs.promises.writeFile(logFile, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to log file:', error.message);
  } finally {
    isWriting = false;
    if (logQueue.length > 0) processLogQueue();
  }
}

// Override console.log
const originalLog = console.log;
console.log = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  appendToLogFile('log', message);
  originalLog(...args);
};

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to handle rate-limiting and retries on 429 errors
async function requestWithRetry(url, retries = 5, delayBetweenRetries = 2000) {
  try {
    const response = await axiosInstance.get(url);
    return response;
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.log('Rate-limiting encountered (429). Retrying...');
      await delay(delayBetweenRetries);
      return requestWithRetry(url, retries - 1, delayBetweenRetries);
    } else {
      console.error('Error fetching data:', error.message);
      throw error;
    }
  }
}

// Function to search Polona
async function searchPolona() {
  try {
    const response = await axiosInstance.post(
      'https://polona.pl/api/search-service/search/simple?query=&page=0&pageSize=4000&sort=RELEVANCE',
      {
        keywordFilters: {
          copyright: ['false'],
          keywords: ['Historia'],
          category: ['Książki'],
          language: ['polski'],
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error searching Polona:', error.message);
    throw error;
  }
}

// Function to parse CSV with flexible delimiter
function parseCSV(content) {
  return csvParse(content, {
    columns: true,
    skipEmptyLines: true,
    delimiter: /[,;]/,
  });
}

// Function to fetch page content and check for title match
async function fetchPageContent(url, title) {
  try {
    const response = await requestWithRetry(url);
    const $ = load(response.data);
    const isFileLink = /\.(pdf|xls|csv)$/i.test(url);

    if (isFileLink) {
      await downloadFile(url, title);
      return true;
    }

    const pageText = $('body').text();
    const hasAudiobook = pageText.includes('audiobook');
    const hasTitle = pageText.includes(title);

    return hasAudiobook && hasTitle;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}

// Function to download a file
async function downloadFile(url, title) {
  const fileName = path.basename(url);
  const writer = fs.createWriteStream(fileName);

  console.log(`Downloading file: ${fileName}`);
  const response = await axiosInstance.get(url, { responseType: 'stream' });
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', async () => {
      await checkFileContent(fileName, title);
      resolve();
    });
    writer.on('error', (err) => {
      console.error(`Error downloading file: ${err.message}`);
      reject(err);
    });
  });
}

// Function to check the content of PDF, XLS, or CSV for title and audiobook
async function checkFileContent(filePath, title) {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.promises.readFile(filePath);

    if (fileExt === '.pdf') {
      const data = await pdf(fileBuffer);
      if (data.text.includes(title) && data.text.includes('audiobook')) {
        console.log(`Match found in PDF: ${filePath}`);
      }
    } else if (['.xls', '.xlsx'].includes(fileExt)) {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      workbook.SheetNames.forEach((sheetName) => {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        rows.forEach((row) => {
          if (JSON.stringify(row).includes(title) && JSON.stringify(row).includes('audiobook')) {
            console.log(`Match found in Excel file: ${filePath}`);
          }
        });
      });
    } else if (fileExt === '.csv') {
      const content = fileBuffer.toString();
      const records = parseCSV(content);
      records.forEach((row) => {
        if (JSON.stringify(row).includes(title) && JSON.stringify(row).includes('audiobook')) {
          console.log(`Match found in CSV: ${filePath}`);
        }
      });
    }
  } catch (error) {
    console.error(`Error checking file content (${filePath}): ${error.message}`);
  }
}

// Main function
async function main() {
  try {
    console.log('Fetching data from Polona...');
    const polonaData = await searchPolona();

    if (!polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found.');
      return;
    }

    for (const hit of polonaData.hits) {
      const title = hit.basicFields?.title?.values?.[0];
      const googleResults = await searchOnGoogle(title);

      for (const result of googleResults) {
        await fetchPageContent(result.link, title);
      }
    }
  } catch (error) {
    console.error('Error in main:', error.message);
  }
}

main();
