import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import pdf from 'pdf-parse'; // For PDF parsing
import xlsx from 'xlsx'; // For XLS parsing
import { parse as csvParse } from 'csv-parse'; // Correct import for CSV parsing

// Axios instance
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Avoid certificate verification issues
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

// Log setup
const logFile = path.resolve('logs.json');
let logQueue = [];
let isWriting = false;

// Append log entry
function appendToLogFile(logType, message) {
  const logEntry = { type: logType, message, timestamp: new Date().toISOString() };
  logQueue.push(logEntry);
  processLogQueue();
}

// Process log queue
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

// Override console.error
const originalError = console.error;
console.error = (...args) => {
  const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
  appendToLogFile('error', message);
  originalError(...args);
};

// Delay utility
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retry request with rate-limiting
async function requestWithRetry(url, retries = 5, delayBetweenRetries = 2000) {
  try {
    return await axiosInstance.get(url);
  } catch (error) {
    if (error.response?.status === 429 && retries > 0) {
      console.log('Rate-limiting encountered (429). Retrying...');
      await delay(delayBetweenRetries);
      return requestWithRetry(url, retries - 1, delayBetweenRetries);
    } else {
      console.error('Error fetching data:', error.message);
      throw error;
    }
  }
}

// Polona data fetch
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

// Google search
async function searchOnGoogle(query) {
  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
    const response = await requestWithRetry(googleUrl);
    const $ = load(response.data);
    const results = [];
    $('.tF2Cxc').each((index, element) => {
      const title = $(element).find('h3').text();
      const link = $(element).find('a').attr('href');
      if (title && link.includes('gov.pl')) {
        console.log('link', link)
        results.push({ title, link });
      }
    });
    return results;
  } catch (error) {
    console.error('Error searching Google:', error.message);
    return [];
  }
}

// Page content fetch
// async function fetchPageContent(url, title) {
//   try {
//     const response = await requestWithRetry(url);
//     const $ = load(response.data);
//     const pageText = $('body').text();
//     return pageText.includes(title) && pageText.includes('audiobook');
//   } catch (error) {
//     console.error(`Error fetching content from ${url}: ${error.message}`);
//     return false;
//   }
// }
async function fetchPageContent(url, title) {
  try {
    console.log(`Fetching content from: ${url}`);
    const response = await requestWithRetry(url);
    const $ = load(response.data);

    
    // Check if the URL is a direct link to a file
    const isFileLink = /\.(pdf|xls|csv)$/i.test(url) || response.headers['content-type'].includes('application/pdf') || response.headers['content-type'].includes('application/vnd.ms-excel');

    if (isFileLink) {
      console.log('file');
      await downloadFile(url, title);
      return true; // Skip checking for audiobook or title as the file is directly downloadable
    }
    const pageText = $('body').text(); // Get all text content from the page
    const hasAudiobook = pageText.includes('audiobook');
    if (!hasAudiobook) return false;
    const hasTitle = pageText.includes(title);
    if (!hasTitle) return false;
    if (hasTitle && hasAudiobook) {
      console.log(`Match found (title: ${hasTitle}, audiobook: ${hasAudiobook}) on ${url}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}

// File download
async function downloadFile(url, title) {
  try {
    const fileName = path.basename(url);
    const writer = fs.createWriteStream(fileName);

    console.log(`Downloading file: ${fileName}`);

    const response = await axiosInstance.get(url, { responseType: 'stream' });
    response.data.pipe(writer);

    writer.on('finish', async () => {
      console.log(`File downloaded: ${fileName}`);

      // Check content of the downloaded file
      await checkFileContent(fileName, title);
    });

    return new Promise((resolve, reject) => {
      writer.on('error', (err) => {
        console.error(`Error downloading file: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    console.error('Error downloading file:', error.message);
    throw error;
  }
}

// File content check
async function checkFileContent(filePath, title) {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.promises.readFile(filePath);
    if (fileExt === '.pdf') {
      const data = await pdf(fileBuffer);
      return data.text.includes(title) && data.text.includes('audiobook');
    } else if (fileExt === '.csv') {
        console.log('csv');
      const records = [];
      await new Promise((resolve, reject) => {
        csvParse(fileBuffer.toString(), { delimiter: [',', ';'], columns: true })
          .on('data', (row) => records.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
      if(records.some(row => JSON.stringify(row).includes('Nazwa projektu'))) console.log("found in csv");
      return records.some(row => JSON.stringify(row).includes(title) && JSON.stringify(row).includes('audiobook'));
    }
    // Add XLS handling if necessary
  } catch (error) {
    console.error(`Error checking file content: ${error.message}`);
    return false;
  }
}

// Main
async function main() {
    const resultsFile = 'results.json';
    const exactMatchesFile = 'exactMatches.json';
    const cachedResults = {};
  
    let totalSearchTime = 0;
    const exactMatches = [];
  
    try {
      console.log('Fetching data from Polona...');
      const polonaData = await searchPolona();
  
      if (!polonaData.hits || polonaData.hits.length === 0) {
        console.log('No results found from Polona.');
        return;
      }
  
      console.log('Processing Polona results...');
      const results = [];
  
      //for (const hit of polonaData.hits) {
        const title = 'Skrót historji nowożytnej przystosowany do programu Ministerstwa W.R. i O.P';
  
        console.log(`Searching for "${title}" on Google...`);
        const googleResults = await searchOnGoogle(title);
  
        for (const googleResult of googleResults) {
          const found = await fetchPageContent(googleResult.link, title);
  
          if (found) {
            exactMatches.push({ title, url: googleResult.link });
            results.push(googleResult);
            cachedResults[googleResult.link] = true;
          }
        }
      //}
  
      console.log(`Found ${exactMatches.length} exact matches`);
  
      // Save results
      await saveToJSON(resultsFile, results);
      await saveToJSON(exactMatchesFile, exactMatches);
    } catch (error) {
      console.error('Error in main execution:', error.message);
    }
  }
  
async function saveToJSON(fileName, data) {
  try {
    await fs.promises.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved to ${fileName}`);
  } catch (error) {
    console.error(`Error saving to ${fileName}:`, error.message);
  }
}  

main();
