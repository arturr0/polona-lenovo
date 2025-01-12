import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';
import pdf from 'pdf-parse'; // For PDF parsing
import xlsx from 'xlsx'; // For XLS parsing
import { parse as csvParse } from 'csv-parse'; // Correct import for CSV parsing

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

// Function to fetch Polona data
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
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
    console.log(`Google search URL: ${googleUrl}`);

    const response = await requestWithRetry(googleUrl);
    console.log('Received Google search results');

    const $ = load(response.data);
    const results = [];

    console.log('Parsing Google results...');
    $('.tF2Cxc').each((index, element) => {
      const title = $(element).find('h3').text();
      const link = $(element).find('a').attr('href');
      if (title && link && !link.includes('zpe.gov.pl') && link.includes('gov.pl') && !link.includes('sejm.gov.pl') && !link.includes('ipn.gov.pl')) { // Exclude PDF links and only include gov.pl
        results.push({ title, link });
        console.log(link);
      }
    });

    console.log(`Found ${results.length} results on Google`);
    return results;
  } catch (error) {
    console.error('Error fetching Google search results:', error.message);
    return [];
  }
}

// Function to fetch page content and check for an exact title match and the word "audiobook"
async function fetchPageContent(url, title) {
  try {
    console.log(`Fetching content from: ${url}`);
    const response = await requestWithRetry(url);
    const $ = load(response.data);

    // Check if the URL is a direct link to a file
    const isFileLink = /\.(pdf|xls|csv)$/i.test(url) || 
      response.headers['content-type']?.includes('application/pdf') || 
      response.headers['content-type']?.includes('application/vnd.ms-excel');

    if (isFileLink) {
      await downloadFile(url, title);
      return false; // Content check happens after download, not here
    }

    // Fetch and analyze page text
    const pageText = $('body').text().toLowerCase(); // Lowercase for case-insensitive matching
    const hasAudiobook = pageText.includes('audiobook');
    const hasTitle = pageText.includes(title.toLowerCase());

    if (hasTitle && hasAudiobook) {
      console.log(`Match found (title: ${title}, audiobook) on ${url}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}


// Function to download a file
// async function downloadFile(url, title) {
//   try {
//     const fileName = path.basename(url);
//     const writer = fs.createWriteStream(fileName);

//     console.log(`Downloading file: ${fileName}`);

//     const response = await axiosInstance.get(url, { responseType: 'stream' });
//     response.data.pipe(writer);

//     writer.on('finish', async () => {
//       console.log(`File downloaded: ${fileName}`);

//       // Check content of the downloaded file
//       await checkFileContent(fileName, title);
//     });

//     return new Promise((resolve, reject) => {
//       writer.on('error', (err) => {
//         console.error(`Error downloading file: ${err.message}`);
//         reject(err);
//       });
//     });
//   } catch (error) {
//     console.error('Error downloading file:', error.message);
//     throw error;
//   }
// }
async function downloadFile(url, title) {
  try {
    const fileName = path.basename(url);
    const writer = fs.createWriteStream(fileName);

    console.log(`Downloading file: ${fileName}`);

    const response = await axiosInstance.get(url, { responseType: 'stream' });
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        console.log(`File downloaded: ${fileName}`);
        await checkFileContent(fileName, title);
        resolve(); // Resolve the promise here
      });

      writer.on('error', (err) => {
        console.error(`Error downloading file: ${err.message}`);
        reject(err); // Reject the promise on error
      });
    });
  } catch (error) {
    console.error('Error downloading file:', error.message);
    throw error;
  }
}

// Function to check the content of PDF, XLS, or CSV for title and audiobook
async function checkFileContent(filePath, title) {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.promises.readFile(filePath);

    let found = false;

    if (fileExt === '.pdf') {
      const data = await pdf(fileBuffer);
      //found = data.text.includes(title) && data.text.includes('audiobook');
      found = data.text.includes(title);
    } else if (fileExt === '.xls' || fileExt === '.xlsx') {
      console.log("excel");
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      found = workbook.SheetNames.some((sheetName) => {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        return rows.some(row => JSON.stringify(row).includes(title) && JSON.stringify(row).includes('audiobook'));
      });
    } else if (fileExt === '.csv') {
      const records = [];
      await new Promise((resolve, reject) => {
        csvParse(fileBuffer.toString(), { delimiter: [',', ';'], columns: true })
          .on('data', row => records.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
      found = records.some(row => {
        const rowString = JSON.stringify(row);
        return rowString.includes(title) && rowString.includes('audiobook');
      });
    }

    if (found) {
      console.log(`Found title and audiobook in file: ${filePath}`);
    } else {
      console.log(`Title or audiobook not found in file: ${filePath}`);
    }

    return found;
  } catch (error) {
    console.error(`Error checking file content: ${error.message}`);
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
      console.log('No results found from Polona.');
      return;
    }

    console.log('Processing Polona results...');
    const results = [];
    
    const title = "Skrót historji nowożytnej przystosowany do programu Ministerstwa W.R. i O.P"

      console.log(`Searching for "${title}" on Google...`);
      const googleResults = await searchOnGoogle(title);

      for (const googleResult of googleResults) {
        const title = googleResult.title;
        const found = await fetchPageContent(googleResult.link, title);
      
        if (found) {
          console.log(`Adding exact match: ${title} (${googleResult.link})`);
          exactMatches.push({ title, url: googleResult.link });
          results.push(googleResult);
          cachedResults[googleResult.link] = true;
        }
      }
      
    // for (const hit of polonaData.hits) {
    //   const title = hit.basicFields?.title?.values?.[0];

    //   console.log(`Searching for "${title}" on Google...`);
    //   const googleResults = await searchOnGoogle(title);

    //   for (const googleResult of googleResults) {
    //     const found = await fetchPageContent(googleResult.link, title);

    //     if (found) {
    //       exactMatches.push({ title, url: googleResult.link });
    //       results.push(googleResult);
    //       cachedResults[googleResult.link] = true;
    //     }
    //   }
    // }

    console.log(`Found ${exactMatches.length} exact matches`);

    // Save results
    await saveToJSON(resultsFile, results);
    await saveToJSON(exactMatchesFile, exactMatches);
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Run the main function
main();
