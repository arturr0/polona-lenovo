import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs';
//import dirname from 'dirname';
import pdfParse from 'pdf-parse';
import csv from 'csv-parser';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Now you can use __dirname to resolve the file dirname
//const filePath = dirname.resolve(__dirname, 'test', 'data', '05-versions-space.pdf');
// Axios instance
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
});
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
      if (title && link && !link.includes('zpe.gov.pl') && link.includes('gov.pl')  && !link.includes('sejm.gov.pl')  && !link.includes('ipn.gov.pl'))  // Exclude PDF links and only include gov.pl
        { 
        results.push({ title, link });
      }
    });

    console.log(`Found ${results.length} results on Google`);
    return results;
  } catch (error) {
    console.error('Error fetching Google search results:', error.message);
    return [];
  }
}
// Helper function to determine file type from headers or content
async function getFileType(url, headers) {
  const contentType = headers['content-type'];
  if (contentType.includes('pdf')) return 'pdf';
  if (contentType.includes('csv')) return 'csv';
  if (contentType.includes('excel') || contentType.includes('spreadsheet')) return 'xlsx';

  // Download small part of the file to infer type
  const { data } = await axiosInstance.get(url, { responseType: 'arraybuffer' });
  const type = await fileType.fromBuffer(data);
  return type?.ext || null;
}

// Function to handle downloadable files
async function processFile(url, type, title) {
  try {
    const response = await axiosInstance.get(url, { responseType: 'arraybuffer' });
    const tempFilePath = dirname.resolve(`temp.${type}`);
    fs.writeFileSync(tempFilePath, response.data);

    let content = '';
    if (type === 'pdf') {
      const pdfData = await pdfParse(fs.readFileSync(tempFilePath));
      content = pdfData.text;
    } else if (type === 'csv') {
      content = await new Promise((resolve) => {
        const rows = [];
        fs.createReadStream(tempFilePath)
          .pipe(csv())
          .on('data', (row) => rows.push(row))
          .on('end', () => resolve(rows.map((row) => JSON.stringify(row)).join(' ')));
      });
    } else if (type === 'xlsx') {
      const workbook = xlsx.readFile(tempFilePath);
      content = workbook.SheetNames.map((sheet) =>
        xlsx.utils.sheet_to_csv(workbook.Sheets[sheet])
      ).join(' ');
    }

    // Search for title and audiobook
    const hasTitle = content.includes(title);
    const hasAudiobook = content.includes('audiobook');
    return hasTitle && hasAudiobook;
  } catch (error) {
    console.error(`Error processing file: ${error.message}`);
    return false;
  }
}

// Enhanced fetchPageContent function
async function fetchPageContent(url, title) {
  try {
    const response = await axiosInstance.get(url, { responseType: 'stream' });
    const headers = response.headers;

    // Check if URL points to a downloadable file
    const fileType = await getFileType(url, headers);
    if (fileType) {
      console.log(`File detected (${fileType}). Processing...`);
      return await processFile(url, fileType, title);
    }

    // Otherwise, scrape the page
    const html = await response.data;
    const $ = load(html);
    const pageText = $('body').text();
    return pageText.includes(title) && pageText.includes('audiobook');
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}

// Main function remains largely unchanged but now supports file detection
async function main() {
  const resultsFile = 'results.json';
  const exactMatchesFile = 'exactMatches.json';
  const cachedResults = {};
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

      console.log(`Searching for "${title}" on Google...`);
      const googleResults = await searchOnGoogle(`${title} audiobook`);

      for (const result of googleResults) {
        console.log(`Checking page content for "${title}" at ${result.link}...`);
        const isExactMatch = await fetchPageContent(result.link, title);
        if (isExactMatch) {
          exactMatches.push({ title, url: result.link });
          console.log(`Exact match found for "${title}" at ${result.link}`);
        }
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
