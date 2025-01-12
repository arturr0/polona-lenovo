import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';

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

// Override console.log and console.error to include logging
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
  appendToLogFile('log', args.join(' '));
  originalLog(...args);
};

console.error = (...args) => {
  appendToLogFile('error', args.join(' '));
  originalError(...args);
};

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
    originalError('Error writing to log file:', error.message);
  } finally {
    isWriting = false;
    if (logQueue.length > 0) processLogQueue(); // Process remaining items in the queue
  }
}

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

// Function to search on Google
async function searchOnGoogle(query) {
  try {
    console.log(`Starting search on Google for query: "${query}"`);
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+filetype:pdf+OR+filetype:csv+OR+filetype:xls+OR+filetype:txt+OR+filetype:epub+OR+filetype:audiobook`;

    const response = await requestWithRetry(googleUrl);
    const $ = load(response.data);
    const results = [];

    $('.tF2Cxc').each((_, element) => {
      const title = $(element).find('h3').text();
      const link = $(element).find('a').attr('href');
      if (title && link && !link.includes('zpe.gov.pl') && !link.includes('ipn.gov.pl') && !link.includes('sejm.gov.pl')) {
        results.push({ title, link });
        console.log(title, link);
      }
    });

    return results;
  } catch (error) {
    console.error('Error fetching Google search results:', error.message);
    return [];
  }
}

// Function to fetch page content and check for an exact title match, filetype, and the word "audiobook"
async function fetchPageContent(url, title) {
  try {
    const response = await requestWithRetry(url);
    const $ = load(response.data);
    const pageText = $('body').text();

    const hasAudiobookInBody = pageText.includes('audiobook');
    if(!hasAudiobookInBody) return;
    const hasTitleInBody = pageText.includes(title);
    if(!hasTitleInBody) return;

    const isFileType = /\.(pdf|csv|xls|txt|epub)$/i.test(url);
    if(isFileType) console.log("file", title, url);
    return isFileType || (hasTitleInBody && hasAudiobookInBody);
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}

// Function to save data to a JSON file
async function saveToJSON(fileName, data) {
  try {
    await fs.promises.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved to ${fileName}`);
  } catch (error) {
    console.error(`Error saving to ${fileName}:`, error.message);
  }
}

// Main function
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
      console.log('No results found on Polona.');
      return;
    }

    for (const hit of polonaData.hits) {
      const title = hit.basicFields?.title?.values?.[0];
      if (!title) continue;

      const startTime = Date.now();
      const googleResults = await searchOnGoogle(`${title} audiobook`);
      totalSearchTime += Date.now() - startTime;

      cachedResults[title] = googleResults;

      for (const result of googleResults) {
        const isExactMatch = await fetchPageContent(result.link, title);
        if (isExactMatch) {
          exactMatches.push({ title, url: result.link });
        }
        await delay(4000);
      }
    }

    await saveToJSON(resultsFile, cachedResults);
    await saveToJSON(exactMatchesFile, exactMatches);
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute main function
main();
