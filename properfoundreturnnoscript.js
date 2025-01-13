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
      if (title && link && !link.includes('zpe.gov.pl') && link.includes('gov.pl') && !link.includes('sejm.gov.pl') && !link.includes('ipn.gov.pl') && !link.includes('cbs.stat.gov.pl') && !link.includes('abw.gov.pl') && !link.includes('policja.gov.pl')) { // Exclude PDF links and only include gov.pl
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
    const isFileLink = /\.(pdf|xls|xlsx|doc|docx|csv)$/i.test(url) || 
      response.headers['content-type']?.includes('application/pdf') || 
      response.headers['content-type']?.includes('application/vnd.ms-excel') ||
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ||
      response.headers['content-type']?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    if (isFileLink) {
      const downloaded = await downloadFile(url, title);
      if (downloaded) {
        console.log(`Exact match found in file: ${url}`);
        return true; // Return true since the content matched
      }
      return false; // Return false if the content didn’t match
    }

    // Fetch and analyze page text
    //const pageTextTitle = $('body').text().toLowerCase(); // Lowercase for case-insensitive matching
    //$('body').find(':not(script, style, noscript)').text().toLowerCase();

    const pageTextTitle = $('body').find(':not(script)').text();
    const pageTextAudiobook = $('body').find(':not(script)').text().toLowerCase();
    //const hasAudiobook = pageTextAudiobook.includes('audiobook');
    const hasAudiobook = /\baudiobook[a-ząęłńóśźż]*\b/.test(pageTextAudiobook);

    const hasExactTitle = pageTextTitle.includes(title);
    console.log('body ', hasAudiobook, hasExactTitle)
    if (hasExactTitle && hasAudiobook) {
      console.log(`Exact match found (title: ${title}, audiobook) on ${url}`);
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
// Function to download a file
// Function to download a file
async function downloadFile(url, title) {
  try {
    const fileName = path.basename(url.split('?')[0]); // Remove query parameters
    const filePath = path.resolve('./downloads', fileName);
    fs.mkdirSync('./downloads', { recursive: true });

    const writer = fs.createWriteStream(filePath);
    console.log(`Downloading file: ${fileName}`);

    const response = await axiosInstance.get(url, { responseType: 'stream' });
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


// async function checkFileContent(filePath, title) {
//   try {
//     const fileExt = path.extname(filePath).toLowerCase();
//     const fileBuffer = await fs.promises.readFile(filePath);

//     let found = false;

//     if (fileExt === '.pdf') {
//       const data = await pdf(fileBuffer);
//       found = data.text.includes(title);
//     } else if (fileExt === '.xls' || fileExt === '.xlsx') {
//       const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
//       found = workbook.SheetNames.some(sheetName => {
//         const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//         return rows.some(row => JSON.stringify(row).includes(title));
//       });
//     } else if (fileExt === '.csv') {
//       const records = [];
//       await new Promise((resolve, reject) => {
//         csvParse(fileBuffer.toString(), { delimiter: [',', ';'], columns: true })
//           .on('data', row => records.push(row))
//           .on('end', resolve)
//           .on('error', reject);
//       });
//       found = records.some(row => JSON.stringify(row).includes(title));
//     } else if (fileExt === '.docx') {
//       const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
//       found = text.includes(title);
//     }

//     if (found) {
//       console.log(`Found title in file: ${filePath}`);
//     } else {
//       console.log(`Title not found in file: ${filePath}`);
//     }

//     return found;
//   } catch (error) {
//     console.error(`Error checking file content: ${error.message}`);
//     return false;
//   }
// }


// async function checkFileContent(filePath, title) {
//   try {
//     const fileExt = path.extname(filePath).toLowerCase();
//     const fileBuffer = await fs.promises.readFile(filePath);

//     let found = false;

//     // Define the regex for all forms of "audiobook"
//     const audiobookRegex = /\baudiobook[a-ząęłńóśźż]*\b/;

//     if (fileExt === '.pdf') {
//       const data = await pdf(fileBuffer);
//       found = audiobookRegex.test(data.text.toLowerCase());
//     } else if (fileExt === '.xls' || fileExt === '.xlsx') {
//       const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
//       found = workbook.SheetNames.some(sheetName => {
//         const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
//         return rows.some(row => audiobookRegex.test(JSON.stringify(row).toLowerCase()));
//       });
//     } else if (fileExt === '.csv') {
//       const records = [];
//       await new Promise((resolve, reject) => {
//         csvParse(fileBuffer.toString(), { delimiter: [',', ';'], columns: true })
//           .on('data', row => records.push(row))
//           .on('end', resolve)
//           .on('error', reject);
//       });
//       found = records.some(row => audiobookRegex.test(JSON.stringify(row).toLowerCase()));
//     } else if (fileExt === '.docx') {
//       const { value: text } = await mammoth.extractRawText({ buffer: fileBuffer });
//       found = audiobookRegex.test(text.toLowerCase());
//     }

//     if (found) {
//       console.log(`Found "audiobook" in file: ${filePath}`);
//     } else {
//       console.log(`"Audiobook" not found in file: ${filePath}`);
//     }

//     return found;
//   } catch (error) {
//     console.error(`Error checking file content: ${error.message}`);
//     return false;
//   }
// }

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

// Main function
// async function main() {
//   const resultsFile = 'results.json';
//   const exactMatchesFile = 'exactMatches.json';
//   const cachedResults = {};

//   let totalSearchTime = 0;
//   const exactMatches = [];

//   try {
//     console.log('Fetching data from Polona...');
//     const polonaData = await searchPolona();

//     if (!polonaData.hits || polonaData.hits.length === 0) {
//       console.log('No results found from Polona.');
//       return;
//     }

//     console.log('Processing Polona results...');
//     const results = [];

//     for (const hit of polonaData.hits) {
//       const title = hit.basicFields?.title?.values?.[0];

//       console.log(`Searching for "${title}" on Google...`);
//       const googleResults = await searchOnGoogle(title);

//       for (const googleResult of googleResults) {
//         const found = await fetchPageContent(googleResult.link, title);

//         if (found) {
//           exactMatches.push({ title, url: googleResult.link });
//           results.push(googleResult);
//           cachedResults[googleResult.link] = true;
//         }
//         await delay(2000);
//       }
//     }
//     // const googleResults = ['https://spotless-truth-plot.glitch.me',
//     //                         'https://cdn.glitch.global/2e4bd7a0-21fe-42e7-9da5-c3f4aff1d10e/include.pdf?v=1736769153882',
//     //                         'https://cdn.glitch.global/2e4bd7a0-21fe-42e7-9da5-c3f4aff1d10e/include.docx?v=1736771313495',
//     //                         'https://cdn.glitch.global/2e4bd7a0-21fe-42e7-9da5-c3f4aff1d10e/include2.docx?v=1736772551446'
//     // ] 
//     // for (const googleResult of googleResults) {
//     //   const found = await fetchPageContent(googleResult, 'Historia');

//     //   if (found) {
//     //     //exactMatches.push({ title, url: googleResult.link });
//     //     // results.push(googleResult);
//     //     // cachedResults[googleResult.link] = true;
//     //     console.log("FOUND!!!");
//     //   }
//     // }

//     console.log(`Found ${exactMatches.length} exact matches`);

//     // Save results
//     await saveToJSON(resultsFile, results);
//     await saveToJSON(exactMatchesFile, exactMatches);
//   } catch (error) {
//     console.error('Error in main execution:', error.message);
//   }
// }

//time
async function main() {
  const resultsFile = 'results.json';
  const exactMatchesFile = 'exactMatches.json';
  const cachedResults = {};

  const exactMatches = [];
  let totalSearchTime = 0;

  try {
    console.log('Fetching data from Polona...');
    const polonaData = await searchPolona();

    if (!polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found from Polona.');
      return;
    }

    console.log('Processing Polona results...');
    const results = [];

    // Start timing the search process
    const searchStartTime = Date.now();

    for (const hit of polonaData.hits) {
      const title = hit.basicFields?.title?.values?.[0];

      console.log(`Searching for "${title}" on Google...`);
      const googleResults = await searchOnGoogle(title);

      for (const googleResult of googleResults) {
        const found = await fetchPageContent(googleResult.link, title);

        if (found) {
          exactMatches.push({ title, url: googleResult.link });
          results.push(googleResult);
          cachedResults[googleResult.link] = true;
        }
        await delay(2000);
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


main();


