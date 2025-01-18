import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import stream from 'stream';

import xlsx from 'xlsx'; // For XLS parsing
import { parse as csvParse } from 'csv-parse'; // Correct import for CSV parsing
import mammoth from 'mammoth';
//import audioPlay from 'audio-play';
//import audioLoader from 'audio-loader';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
//import { resolve } from 'dns';
import * as dns from 'dns';
import net from 'net';
//import puppeteer from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import express from 'express';
// Add the stealth plugin to Puppeteer
puppeteer.use(StealthPlugin());

// Create an Axios instance with a custom HTTPS agent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let polonaData;
// Resolve the file path for the MP3 file
const mp3FilePath = join(__dirname, 'error2.mp3');
// const playAudio = () => {
//     // Reload and play the audio every time
//     audioLoader(mp3FilePath, (err, buffer) => {
//         if (err) {
//             console.error('Error loading audio:', err);
//             return;
//         }

//         // Store the audio buffer for future use
//         audioBuffer = buffer;

//         // Play the audio
//         audioPlay(audioBuffer);
//     });
// };
const app = express();

// Use the environment's PORT or default to 3000 if not set
const PORT = process.env.PORT || 3000;

// Your routes and other configurations here

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get('/', async (req, res) => {
    main();

});
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
//const logFile = path.resolve(__dirname, 'logs.json');

let logQueue = [];
let isWriting = false;

//let poloanaHitIndex;
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
  //processLogQueue();
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
// const originalLog = console.log;
// console.log = (...args) => {
//   const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
//   appendToLogFile('log', message);
//   originalLog(...args);
// };

// // Override console.error
// const originalError = console.error;
// console.error = (...args) => {
//   const message = args.map(arg => (typeof arg === 'object' ? JSON.stringify(arg) : arg)).join(' ');
//   appendToLogFile('error', message);
//   originalError(...args);
// };

// Utility function for delay
//const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


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


// const userAgents = [
//   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//   'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:92.0) Gecko/20100101 Firefox/92.0'
//   // Add more user agents as needed
// ];

// async function getRandomUserAgent(previousUserAgent = null) {
//   let newUserAgent;
//   do {
//     newUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
//   } while (previousUserAgent && newUserAgent === previousUserAgent);  // Ensure new user agent is different if previousUserAgent is provided
//   return newUserAgent;
// }
//import userAgents from 'user-agents';
// async function getRandomUserAgent(currentUserAgent = '') {
//   let newUserAgent;
//   do {
//     newUserAgent = new userAgents().toString();
//   } while (newUserAgent === currentUserAgent);
//   return newUserAgent;
// }

async function getRandomUserAgent(currentUserAgent = null) {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    // Add more user agents as needed
  ];

  // Filter out the current user agent if provided
  const filteredAgents = currentUserAgent
    ? userAgents.filter(agent => agent !== currentUserAgent)
    : userAgents;

  // Randomly select a user agent from the filtered list
  const randomIndex = Math.floor(Math.random() * filteredAgents.length);
  return filteredAgents[randomIndex];
}


// Assuming `userAgent` has already been defined


// async function searchGoogle(query) {
//   const userAgent = await getRandomUserAgent();
//   await page.setUserAgent(userAgent);  // Set random User-Agent before each request
//   await page.goto(`https://www.google.com/search?q=${query}`, { waitUntil: 'domcontentloaded' });
//   // Continue with your search actions
// }



//searchOnGoogle('Fr. Kr. Szlossera Dzieje powszechne. T. 1, [Dzieje starożytne. 1, Ludy wschodnie. 2, Ludy okresu grecko-rzymskiego]');


//await searchOnGoogle('Nowy dykcyonarz historyczny albo Historya skrocona wszystkich ludzi, ktorzy się wsławili cnotą, mądrością')
// async function searchOnGoogle(query) {
//   const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " audiobook")}+site:gov.pl`;

//   try {
//     // Launch a headless browser with stealth
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();

//     // Set a random user agent
//     let userAgent = await getRandomUserAgent();
//     await page.setUserAgent(userAgent);

//     // Listen for network responses and check for status 429
//     page.on('response', async (response) => {
//       if (response.status() === 429) {
//         console.error('Received 429 Too Many Requests error.');

//         // Store the current user agent before changing it
//         console.log(`Current User-Agent: ${userAgent}`);

//         // Switch to a new random user agent, ensuring it's different
//         userAgent = await getRandomUserAgent(userAgent);
//         console.log(`Switching to new User-Agent: ${userAgent}`);

//         // Set the new User-Agent for the page
//         await page.setUserAgent(userAgent);

//         // Clear cookies as a precaution
//         // const cookies = await page.cookies();
//         // for (let cookie of cookies) {
//         //   console.log("cookie before ", cookie);
//         //   cookie.expires = -1;
//         //   console.log("cookie after ", cookie);
//         // }

        

//         //console.log('All cookies cleared.');
//         error429 = true;  // Mark that 429 error occurred
//         handle429();
//       }
//     });

//     // Navigate to the Google search results page
//     await page.goto(googleUrl, { waitUntil: 'domcontentloaded', timeout: 0 });

//     // Wait for the search result items to load
//     await page.evaluate(async () => {
//       let totalHeight = 0;
//       const distance = 100; // Scroll step
//       const delay = 100; // Delay between scrolls
//       while (totalHeight < document.body.scrollHeight) {
//         window.scrollBy(0, distance);
//         totalHeight += distance;
//         await new Promise(resolve => setTimeout(resolve, delay));
//       }
//     });

//     // Extract the results using page.evaluate
//     const resultLinks = await page.evaluate(() => {
//       const results = [];
//       const items = document.querySelectorAll('.g');
//       items.forEach((item) => {
//         const title = item.querySelector('h3') ? item.querySelector('h3').innerText : '';
//         const link = item.querySelector('a') ? item.querySelector('a').href : '';
//         if (
//           title &&
//           link &&
//           !link.includes('zpe.gov.pl') &&
//           link.includes('gov.pl') &&
//           !link.includes('sejm.gov.pl') &&
//           !link.includes('senat.gov.pl') &&
//           !link.includes('ipn.gov.pl') &&
//           !link.includes('cbs.stat.gov.pl') &&
//           !link.includes('abw.gov.pl') &&
//           !link.includes('policja.gov.pl')
//         ) {
//           results.push({ title, link });
//         }
//       });
//       return results;
//     });

//     // Close the browser
//     await browser.close();

//     // Return the results
//     return resultLinks;
//   } catch (error) {
//     playAudio();
//     console.error(`Error in searchOnGoogle: ${error.message}`);
//     return []; // Return an empty array to handle errors gracefully
//   }
// }
// async function searchOnGoogle(query) {
//   const duckDuckGoUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query + " audiobook")}+site:gov.pl`;

//   try {
//     const browser = await puppeteer.launch({ headless: true });
//     const page = await browser.newPage();

//     let userAgent = await getRandomUserAgent();
//     await page.setUserAgent(userAgent);

//     await page.goto(duckDuckGoUrl, { waitUntil: 'networkidle2', timeout: 60000 });
//     await page.waitForSelector('#links', { timeout: 60000 }); // Wait for main content container

//     // Debug: Log the page's content
//     const content = await page.content();
//     console.log(content);

//     // Extract search results
//     const resultLinks = await page.evaluate(() => {
//       const results = [];
//       const items = document.querySelectorAll('.result'); // Update based on inspection
//       items.forEach((item) => {
//         const title = item.querySelector('.result__title .result__a')?.innerText || '';
//         const link = item.querySelector('.result__url')?.href || '';
//         if (title && link) {
//           results.push({ title, link });
//         }
//       });
//       return results;
//     });

//     await browser.close();
//     return resultLinks;
//   } catch (error) {
//     console.error(`Error in searchOnDuckDuckGo: ${error.message}`);
//     return [];
//   }
// }



//searchOnGoogle("your search query");


// Example usage
//earchOnGoogle("Dzieje powszechne. Cz. 3, Dzieje nowożytne");

// async function searchOnGoogle(query) {
//   try {
//     console.log(`Starting search on Google for query: "${query}"`);
//     const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " audiobook")}+site:gov.pl`;

//     console.log(`Google search URL: ${googleUrl}`);

//     const response = await requestWithRetry(googleUrl);  // Using requestWithRetry
//     console.log('Received Google search results');

//     const $ = load(response.data);
//     const results = [];

//     console.log('Parsing Google results...');
//     $('.MjjYud').each((index, element) => {
//       const titleGoogle = $(element).find('h3.LC20lb').text();
//       console.log('titleGoogle', titleGoogle);
    
//       const link = $(element).find('a').attr('href');
//       if (
//         titleGoogle &&
//         link &&
//         !link.includes('zpe.gov.pl') &&
//         link.includes('gov.pl') &&
//         !link.includes('sejm.gov.pl') &&
//         !link.includes('senat.gov.pl') &&
//         !link.includes('ipn.gov.pl') &&
//         !link.includes('cbs.stat.gov.pl') &&
//         !link.includes('abw.gov.pl') &&
//         !link.includes('policja.gov.pl')
//       ) {
//         results.push({ titleGoogle, link });
//         console.log('link', link);
//       }
//     });
    

//     console.log(`Found ${results.length} results on Google`);
//     return results;
//   } catch (error) {
//     console.error('Error fetching Google search results:', error.message);
//     return [];
//   }
// }

//await fetchPageContent("https://kronika.gov.pl/obiekt/16750323", "Z zagadnień dydaktyki historyi");

// async function searchOnGoogle(query) {
//  const apiKey = process.env.YAHOO_API_KEY;  // Accessing the API key from environment variables
// const apiUrl = `https://yboss.yahooapis.com/ysearch/web/v1/${encodeURIComponent(query)}?format=json&count=10&apiKey=${apiKey}`;


//   try {
//     // Make the API request to Yahoo Search BOSS
//     const response = await axios.get(apiUrl, {
//       headers: {
//         'Authorization': `Bearer ${apiKey}`,
//       },
//     });

//     // Extract search results
//     const results = response.data.web.results;

//     // Filter results for the desired criteria
//     const filteredResults = results.filter(result => {
//       const link = result.url;
//       return (
//         link.includes('gov.pl') &&  // Filter for .gov.pl domains
//         !link.includes('zpe.gov.pl') &&
//         !link.includes('sejm.gov.pl') &&
//         !link.includes('senat.gov.pl') &&
//         !link.includes('ipn.gov.pl') &&
//         !link.includes('cbs.stat.gov.pl') &&
//         !link.includes('abw.gov.pl') &&
//         !link.includes('policja.gov.pl')
//       );
//     });

//     // Return the filtered results
//     return filteredResults.map(result => ({
//       title: result.title,
//       link: result.url,
//     }));
//   } catch (error) {
//     console.error(`Error in searchOnYahoo: ${error.message}`);
//     return [];  // Return an empty array to handle errors gracefully
//   }
// }
async function searchOnGoogle(query) {
  const apiKey = process.env.YAHOO_API_KEY;  // Make sure your API key is set correctly
  const apiUrl = `https://yboss.yahooapis.com/ysearch/web/v1/${encodeURIComponent(query)}?format=json&count=10`;

  try {
    // Make the API request to Yahoo Search BOSS
    const response = await axios.get(apiUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    // Extract search results
    const results = response.data.web.results;

    // Filter results for the desired criteria
    const filteredResults = results.filter(result => {
      const link = result.url;
      console.log(link);
      return (
        link.includes('gov.pl') &&  // Filter for .gov.pl domains
        !link.includes('zpe.gov.pl') &&
        !link.includes('sejm.gov.pl') &&
        !link.includes('senat.gov.pl') &&
        !link.includes('ipn.gov.pl') &&
        !link.includes('cbs.stat.gov.pl') &&
        !link.includes('abw.gov.pl') &&
        !link.includes('policja.gov.pl')
      );
    });

    // Return the filtered results
    return filteredResults.map(result => ({
      title: result.title,
      link: result.url,
    }));
  } catch (error) {
    console.error('Error in searchOnYahoo:', error.response ? error.response.data : error.message);
    return [];  // Return an empty array to handle errors gracefully
  }
}


async function fetchPageContent(url, title) {
  try {
    console.log(`Fetching content from: ${url}`);
    //const response = await requestWithRetry(url);
    const response = await axiosInstance.get(url)
    const $ = load(response.data);

    // Check if the URL is a direct link to a file
    const isFileLink = /\.(pdf|xls|xlsx|doc|docx|csv)$/i.test(url) || 
      response.headers['content-type']?.includes('application/pdf') || 
      response.headers['content-type']?.includes('application/vnd.ms-excel') || 
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || 
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    if (isFileLink) {
      //const downloaded = await downloadFile(url, title);
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
    //console.log('pageText', pageText);
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
    if (!polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found from Polona.');
      return;
    }

    console.log('Processing Polona results...');
    const results = [];
    const searchStartTime = Date.now();

    for (const hit of polonaData.hits) {
      title = hit.basicFields?.title?.values?.[0];
      console.log(`Searching for "${title}" on Google...`);
      
      const googleResults = await searchOnGoogle(title);
      if (error429) return; // Stop execution if a 429 error occurs
      if (!googleResults || googleResults.length === 0) {
        console.log(`No Google results found for "${title}".`);
        continue;
      }
    
      console.log('Google results:', googleResults);
    
      for (const googleResult of googleResults) {
        console.log('Processing Google Result:', googleResult.link);
        const found = await fetchPageContent(googleResult.link, title);
        
        if (found) {
          console.log(`Exact match found for "${title}" at ${googleResult.link}`);
          exactMatches.push({ title, url: googleResult.link });
          results.push(googleResult);
        }
      }
    
      // Introduce a delay between calls
      const randomDelay = Math.floor(Math.random() * 5000) + 3000; // Random delay between 3 and 8 seconds
      console.log(`Waiting for ${randomDelay / 1000} seconds before the next search...`);
      await delay(randomDelay);
    }
    
    

    const searchEndTime = Date.now();
    totalSearchTime = (searchEndTime - searchStartTime) / 1000;

    console.log(`Found ${exactMatches.length} exact matches`);
    // await saveToJSON(resultsFile, results);
    // await saveToJSON(exactMatchesFile, exactMatches);
    console.log(`Total search time: ${(totalSearchTime / 60).toFixed(2)} minutes`);

  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}


async function searchWhenIPchanged() {
  for (let i = 0; i < notSearchedPolonaData.length; i++)
    console.log(notSearchedPolonaData[i]);
}


//await searchOnGoogle("Mickiewicz");

async function handle429() {
  // Play the notification audio (uncomment and implement if needed)
  //playAudio();

  // Collect the remaining unsearched data
  console.log(title);

  let poloanaHitIndex = -1; // Ensure this is defined

  for (let i = 0; i < polonaData.hits.length; i++) {
    if (title === polonaData.hits[i].basicFields?.title?.values?.[0]) {
      poloanaHitIndex = i;
      break; // Stop the loop as we found the matching title
    }
  }

  for (let i = poloanaHitIndex; i < polonaData.hits.length; i++) {
    notSearchedPolonaData.push(polonaData.hits[i].basicFields?.title?.values?.[0]);
    //console.log("push");
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
}
