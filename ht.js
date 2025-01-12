import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs/promises';

// Create an Axios instance with a custom HTTPS agent
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false, // Avoid certificate verification issues
  }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

// Utility function for delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    
    const response = await axiosInstance.get(googleUrl);
    console.log('Received Google search results');

    const $ = load(response.data);
    const results = [];

    console.log('Parsing Google results...');
    $('.tF2Cxc').each((index, element) => {
      const title = $(element).find('h3').text();
      const link = $(element).find('a').attr('href');
      if (title && link) {
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

// Function to fetch page content and check for an exact title match
async function fetchPageContent(url, title) {
  try {
    console.log(`Fetching content from: ${url}`);
    const response = await axiosInstance.get(url);
    const $ = load(response.data);

    const pageText = $('body').text(); // Get all text content from the page
    const isExactMatch = pageText.includes(title); // Check for exact title match
    console.log(isExactMatch ? `Exact match found on ${url}` : `No exact match on ${url}`);

    return isExactMatch;
  } catch (error) {
    console.error(`Error fetching content from ${url}: ${error.message}`);
    return false;
  }
}

// Function to save data to a JSON file
async function saveToJSON(fileName, data) {
  try {
    await fs.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
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

    console.log(`Found ${polonaData.hits.length} items on Polona.`);
    for (const hit of polonaData.hits) {
      const title = hit.basicFields?.title?.values?.[0];
      if (!title) continue;

      console.log(`Searching for "${title}" on Google...`);
      const startTime = Date.now();
      const googleResults = await searchOnGoogle(title);
      const elapsedTime = Date.now() - startTime;
      totalSearchTime += elapsedTime;

      if (googleResults.length === 0) {
        console.log(`No results for "${title}"`);
        continue;
      }

      cachedResults[title] = googleResults;

      // Process filtered results
      for (const result of googleResults) {
        console.log(`Checking page content for "${title}" at ${result.link}...`);
        const isExactMatch = await fetchPageContent(result.link, title);
        if (isExactMatch) {
          exactMatches.push({ title, url: result.link });
          console.log(`Exact match found for "${title}" at ${result.link}`);
        }

        // Delay to avoid rate-limiting
        await delay(2000);
      }
    }

    console.log(`Total search time: ${totalSearchTime}ms`);

    // Save results to JSON
    await saveToJSON(resultsFile, cachedResults);
    await saveToJSON(exactMatchesFile, exactMatches);
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute main function
main();
