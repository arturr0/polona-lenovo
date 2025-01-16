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
import mammoth from 'mammoth';
import audioPlay from 'audio-play';
import audioLoader from 'audio-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
//import { resolve } from 'dns';
import * as dns from 'dns';
import net from 'net';
import puppeteer from 'puppeteer';

// Create an Axios instance with a custom HTTPS agent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let polonaData;
// Resolve the file path for the MP3 file
const mp3FilePath = join(__dirname, 'error2.mp3');
const playAudio = () => {
    // Reload and play the audio every time
    audioLoader(mp3FilePath, (err, buffer) => {
        if (err) {
            console.error('Error loading audio:', err);
            return;
        }

        // Store the audio buffer for future use
        audioBuffer = buffer;

        // Play the audio
        audioPlay(audioBuffer);
    });
};
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Avoid certificate verification issues
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});
let audioBuffer;
// Setup log file and write stream
//const logFile = path.resolve('logs.json');
//const logFile = resolve(__dirname, 'logs.json');
const logFile = path.resolve(__dirname, 'logs.json');

let logQueue = [];
let isWriting = false;

let poloanaHitIndex;
let title = '';
const notSearchedPolonaData = [];
let error429 = false;
// Append log entry to queue
function appendToLogFile(logType, message) {
  if (typeof logType !== 'string' || typeof message !== 'string') {
    console.error('Invalid log data:', logType, message);
    return;
  }
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
    let logs;
    try {
      logs = JSON.parse(existingLogs);
    } catch (error) {
      logs = [];
      console.error('Log file corrupted, initializing empty logs.');
    }

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

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));



function isConnected() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1500); // Timeout after 1.5 seconds

    socket.once('connect', () => {
      socket.destroy();
      resolve(true); // Internet connection available
    });

    socket.once('error', () => {
      socket.destroy();
      resolve(false); // No internet connection
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false); // No internet connection
    });

    socket.connect(80, '1.1.1.1'); // Test connection to Cloudflare's public DNS
  });
}

function checkInternetConnection() { 
  return new Promise((resolve, reject) => {
    dns.resolve('google.com', (err) => {
      if (err) {
        reject('No internet connection');
      } else {
        resolve('Connected to the internet');
      }
    });
  });
}

async function requestWithRetry(url, retries = 5, delayBetweenRetries = 2000) {
  try {
    const response = await axiosInstance.get(url);
    return response;
  } catch (error) {
    if (error.response && error.response.status === 429) {
      error429 = true;
      console.log('Rate-limiting encountered (429). Stopping the main function.');

      // Play the notification audio
      //playAudio();

      // Collect the remaining unsearched data
      console.log(title);
      for (let i = 0; i < polonaData.hits.length; i++) {
        if (title === polonaData.hits[i].basicFields?.title?.values?.[0]) {
        poloanaHitIndex = i;
        //console.log("title");
        }
      }
      for (let i = poloanaHitIndex; i < polonaData.hits.length; i++) {
        notSearchedPolonaData.push(polonaData.hits[i].basicFields?.title?.values?.[0]);
        console.log("push");
      }

      // Stop the main function and exit immediately
      console.log('Press Enter to retry or Ctrl+C to quit.');
      process.stdin.setRawMode(true);
      process.stdin.resume();

      // Listen for user input
      process.stdin.on('data', async (key) => {
        if (key.toString() === '\r') { // Enter key
          if (await isConnected()) {
            console.log('Internet connection restored. Running searchWhenIPchanged...');
            searchWhenIPchanged();  // Run the alternative function
          } else {
            console.log('No internet connection. Please try again.');
          }
        } else if (key.toString() === '\u0003') { // Ctrl+C to exit
          console.log('Exiting...');
          process.exit(); // Quit the application immediately
        }
      });

      // Exit the main function (stop further execution)
      return Promise.reject(new Error('Rate-limiting error (429). Execution stopped.'));
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
// async function searchOnGoogle(query) {
//   try {
//     console.log(`Starting search on Google for query: "${query}"`);
//     //const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
//     const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " audiobook")}+site:gov.pl`;

//     console.log(`Google search URL: ${googleUrl}`);

//     const response = await requestWithRetry(googleUrl);
//     console.log('Received Google search results');

//     const $ = load(response.data);
//     const results = [];

//     console.log('Parsing Google results...');
//     $('.tF2Cxc').each((index, element) => {
//       const title = $(element).find('h3').text();
//       const link = $(element).find('a').attr('href');
//       if (title && link && !link.includes('zpe.gov.pl') && link.includes('gov.pl') && !link.includes('sejm.gov.pl') && !link.includes('senat.gov.pl') && !link.includes('ipn.gov.pl') && !link.includes('cbs.stat.gov.pl') && !link.includes('abw.gov.pl') && !link.includes('policja.gov.pl')) { 
//         results.push({ title, link });
//         console.log(link);
//       }
//     });

//     console.log(`Found ${results.length} results on Google`);
//     return results;
//   } catch (error) {
//     console.error('Error fetching Google search results:', error.message);
//     return [];
//   }
// }


async function searchOnGoogle(query) {
  try {
    console.log(`Starting search on Google for query: "${query}"`);

    // Construct the Google search URL with query and filter for 'audiobook' in site:gov.pl
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " audiobook")}+site:gov.pl`;

    console.log(`Google search URL: ${googleUrl}`);

    // Launch Puppeteer browser instance
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.goto(googleUrl, { waitUntil: 'domcontentloaded' });

    // Wait for search result elements to load
    await page.waitForSelector('.tF2Cxc'); // Adjust selector for the actual search result blocks

    // Extract search results
    const structure = await page.evaluate(() => {
      const results = [];
      document.querySelectorAll('.tF2Cxc').forEach((el) => {
        const titleGoogle = el.querySelector('.DKV0Md') ? el.querySelector('.DKV0Md').innerText : '';
        const link = el.querySelector('a') ? el.querySelector('a').href : '';

        // Filter out unwanted domains
        if (
          titleGoogle &&
          link &&
          !link.includes('zpe.gov.pl') &&
          link.includes('gov.pl') &&
          !link.includes('sejm.gov.pl') &&
          !link.includes('senat.gov.pl') &&
          !link.includes('ipn.gov.pl') &&
          !link.includes('cbs.stat.gov.pl') &&
          !link.includes('abw.gov.pl') &&
          !link.includes('policja.gov.pl')
        ) {
          results.push({ titleGoogle, link });
        }
      });
      return results;
    });

    console.log(`Found ${structure.length} results on Google`);

    // Close Puppeteer browser instance
    await browser.close();

    return structure;
  } catch (error) {
    console.error('Error fetching Google search results:', error.message);
    return [];
  }
}

export { searchOnGoogle };



async function fetchPageContent(url, title) {
  try {
    console.log(`Fetching content from: ${url}`);
    const response = await requestWithRetry(url);
    const $ = load(response.data);

    // Check if the URL is a direct link to a file
    const isFileLink = /\.(pdf|xls|xlsx|doc|docx|csv)$/i.test(url) || 
      response.headers['content-type']?.includes('application/pdf') || 
      response.headers['content-type']?.includes('application/vnd.ms-excel') || 
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || 
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    if (isFileLink) {
      const downloaded = await downloadFile(url, title);
      if (downloaded) {
        console.log(`Exact match found in file: ${url}`);
        return true;
      }
      return false;
    }

    // Extract and analyze text from the page
    const pageText = $('body')
      .find('*')
      .not('script, style')
      .contents()
      .filter(function () {
        // Use cheerio's `type` property to identify text nodes
        return this.type === 'text' && $(this).text().trim().length > 0;
      })
      .map(function () {
        return $(this).text();
      })
      .get()
      .join(' ')
      .toLowerCase();

    // Check for the exact title and audiobook keyword
    const hasExactTitle = pageText.includes(title.toLowerCase());
    const hasAudiobook = /\baudiobook[a-ząęłńóśźż]*\b/.test(pageText);

    console.log('Text analysis:', { hasExactTitle, hasAudiobook });

    if (hasExactTitle && hasAudiobook) {
      console.log(`Exact match found (title: "${title}", audiobook) on ${url}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}




async function downloadFile(url, title) {
  try {
    const fileName = path.basename(url.split('?')[0]); // Remove query parameters
    const filePath = path.resolve('./downloads', fileName);
    fs.mkdirSync('./downloads', { recursive: true });

    const writer = fs.createWriteStream(filePath);
    console.log(`Downloading file: ${fileName}`);

    const response = await axios.get(url, { responseType: 'stream' });
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', async () => {
        console.log(`File downloaded: ${filePath}`);
        try {
          const found = await checkFileContent(filePath, title);
          resolve(found); // Resolve based on the content check
        } catch (err) {
          reject(err);
        }
      });

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

async function checkFileContent(filePath, title) {
  try {
    const fileExt = path.extname(filePath).toLowerCase();
    const fileBuffer = await fs.promises.readFile(filePath);

    let foundExactTitle = false;
    let foundAudiobook = false;

    // Define the regex for all forms of "audiobook" in Polish
    const audiobookRegex = /\baudiobook[a-ząęłńóśźż]*\b/;

    const checkContent = (content) => {
      // Check for exact title match (case-sensitive)
      foundExactTitle = content.includes(title);
      // Check for any form of "audiobook" in Polish
      foundAudiobook = audiobookRegex.test(content);
    };

    if (fileExt === '.pdf') {
      const data = await pdf(fileBuffer);
      checkContent(data.text);
    } else if (fileExt === '.xls' || fileExt === '.xlsx') {
      const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
      workbook.SheetNames.forEach(sheetName => {
        const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        rows.forEach(row => {
          checkContent(JSON.stringify(row));
        });
      });
    } else if (fileExt === '.csv') {
      const records = [];
      await new Promise((resolve, reject) => {
        csvParse(fileBuffer.toString(), { delimiter: [',', ';'], columns: true })
          .on('data', row => records.push(row))
          .on('end', resolve)
          .on('error', reject);
      });
      records.forEach(row => {
        checkContent(JSON.stringify(row));
      });
    } else if (fileExt === '.docx') {
      const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
      checkContent(text);
    }

    // Log results
    if (foundExactTitle) {
      console.log(`Exact title found in file: ${filePath}`);
    }
    if (foundAudiobook) {
      console.log(`Forms of "audiobook" found in file: ${filePath}`);
    }
    if (!foundExactTitle && !foundAudiobook) {
      console.log(`Neither exact title nor "audiobook" forms found in file: ${filePath}`);
    }

    // Return true if either match is found
    return foundExactTitle && foundAudiobook;
  } catch (error) {
    console.error(`Error checking file content: ${error.message}`);
    return false;
  }
}





async function extractTextFromDocx(filePath) {
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });

    console.log('Extracted text:', text);
    return text;
  } catch (error) {
    console.error(`Error processing DOCX file: ${error.message}`);
    return null;
  }
}

// Usage



// Function to save data to a JSON file
async function saveToJSON(fileName, data) {
  try {
    await fs.promises.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Saved to ${fileName}`);
  } catch (error) {
    console.error(`Error saving to ${fileName}:`, error.message);
  }
}



// async function main() {
//   const resultsFile = 'results.json';
//   const exactMatchesFile = 'exactMatches.json';
//   const cachedResults = {};

//   const exactMatches = [];
//   let totalSearchTime = 0;

//   try {
//     console.log('Fetching data from Polona...');
//     polonaData = await searchPolona();
//     //console.log()
//     if (!polonaData.hits || polonaData.hits.length === 0) {
//       console.log('No results found from Polona.');
//       return;
//     }

//     console.log('Processing Polona results...');
//     const results = [];

//     // Start timing the search process
//     const searchStartTime = Date.now();
    
//     for (const hit of polonaData.hits) {
//       title = hit.basicFields?.title?.values?.[0];
      
//       console.log(`Searching for "${title}" on Google...`);
//       const googleResults = await searchOnGoogle(title);

//       for (const googleResult of googleResults) {
//         // const found = await fetchPageContent(googleResult.link, title);

//         // if (found) {
//         //   exactMatches.push({ title, url: googleResult.link });
//         //   results.push(googleResult);
//         //   cachedResults[googleResult.link] = true;
//         // }
//         // await delay(2000);
        
//         exactMatches.push({ title, url: googleResult.link });
//         results.push(googleResult);
//         cachedResults[googleResult.link] = true;

//       }
//     }

//     // End timing the search process
//     const searchEndTime = Date.now();
//     totalSearchTime = (searchEndTime - searchStartTime) / 1000; // Convert to seconds

//     console.log(`Found ${exactMatches.length} exact matches`);

//     // Save results
//     await saveToJSON(resultsFile, results);
//     await saveToJSON(exactMatchesFile, exactMatches);

//     // Log the total search time
//     console.log(`Total search time: ${(totalSearchTime / 60).toFixed(2)} minutes`);

//   } catch (error) {
//     console.error('Error in main execution:', error.message);
//   }
// }

async function main() {
  const resultsFile = 'results.json';
  const exactMatchesFile = 'exactMatches.json';
  const cachedResults = {};

  const exactMatches = [];
  let totalSearchTime = 0;

  try {
    console.log('Fetching data from Polona...');
    polonaData = await searchPolona();
    //console.log(polonaData);
    if (!polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found from Polona.');
      return;
    }

    console.log('Processing Polona results...');
    const results = [];

    // Start timing the search process
    const searchStartTime = Date.now();
    
    for (const hit of polonaData.hits) {
      title = hit.basicFields?.title?.values?.[0];

      console.log(`Searching for "${title}" on Google...`);
      const googleResults = await searchOnGoogle(title);
      console.log('google result run', googleResults)
      for (const googleResult of googleResults) {
        const found = await fetchPageContent(googleResult.link, title);
        
        if (found) {
          exactMatches.push({ title, url: googleResult.link });
          results.push(googleResult);
          cachedResults[googleResult.link] = true;
        }
        await delay(5000);
      }
    }
    // End timing the search process
    const searchEndTime = Date.now();
    totalSearchTime = (searchEndTime - searchStartTime) / 1000; // Convert to seconds

    console.log(`Found ${exactMatches.length} exact matches`);

    // Save results
    await saveToJSON(resultsFile, results);
    await saveToJSON(exactMatchesFile, exactMatches);

    // Log the total search time
    console.log(`Total search time: ${(totalSearchTime / 60).toFixed(2)} minutes`);

  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

async function searchWhenIPchanged() {
  for (let i = 0; i < notSearchedPolonaData.length; i++)
    console.log(notSearchedPolonaData[i]);
}

main();


