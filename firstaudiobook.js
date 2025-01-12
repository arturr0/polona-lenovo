import axios from 'axios';
import { load } from 'cheerio';
import https from 'https';
import fs from 'fs/promises';

// Axios setup with proper headers and HTTPS agent
const axiosInstance = axios.create({
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  },
});

// Delay utility to manage request intervals
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry logic for requests
async function requestWithRetry(url, retries = 5, delayBetweenRetries = 2000) {
  try {
    const response = await axiosInstance.get(url);
    return response;
  } catch (error) {
    if (error.response?.status === 429 && retries > 0) {
      console.log('Rate-limited. Retrying...');
      await delay(delayBetweenRetries);
      return requestWithRetry(url, retries - 1, delayBetweenRetries);
    } else {
      console.error('Request failed:', error.message);
      throw error;
    }
  }
}

// Fetch Polona data
async function fetchPolonaHits() {
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
    return response.data.hits || [];
  } catch (error) {
    console.error('Error fetching Polona hits:', error.message);
    throw error;
  }
}

// Search Google for `gov.pl` URLs
async function searchGovPlUrls(query) {
  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
    const response = await requestWithRetry(googleUrl);
    const $ = load(response.data);
    const urls = [];

    $('.tF2Cxc').each((_, element) => {
      const link = $(element).find('a').attr('href');
      if (link && link.includes('gov.pl') && !link.includes('.pdf')) {
        urls.push(link);
      }
    });

    console.log(`Found ${urls.length} gov.pl URLs.`);
    return urls;
  } catch (error) {
    console.error('Error searching Google:', error.message);
    return [];
  }
}

// Check if a page contains "audiobook"
async function containsAudiobook(url) {
  try {
    const response = await requestWithRetry(url);
    const $ = load(response.data);
    const pageText = $('body').text();
    return pageText.includes('audiobook');
  } catch (error) {
    console.error(`Error checking for "audiobook" in ${url}: ${error.message}`);
    return false;
  }
}

// Check if a page contains an exact title
async function containsExactTitle(url, title) {
  try {
    const response = await requestWithRetry(url);
    const $ = load(response.data);
    const pageText = $('body').text();
    return pageText.includes(title);
  } catch (error) {
    console.error(`Error checking for title in ${url}: ${error.message}`);
    return false;
  }
}

// Save results to a JSON file
async function saveResults(fileName, data) {
  try {
    await fs.writeFile(fileName, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Results saved to ${fileName}`);
  } catch (error) {
    console.error(`Error saving to ${fileName}: ${error.message}`);
  }
}

// Main function
async function main() {
  const govUrlsFile = 'govUrls.json';
  const matchesFile = 'exactMatches.json';
  const exactMatches = [];

  try {
    console.log('Fetching Polona data...');
    const hits = await fetchPolonaHits();

    if (hits.length === 0) {
      console.log('No Polona hits found.');
      return;
    }

    console.log(`Found ${hits.length} Polona hits. Extracting titles.`);
    const titles = hits.map((hit) => hit.basicFields?.title?.values?.[0]).filter(Boolean);

    console.log('Searching for gov.pl URLs...');
    const govUrls = await searchGovPlUrls('audiobook');

    console.log('Filtering URLs for "audiobook" content...');
    const urlsWithAudiobook = [];
    for (const url of govUrls) {
      const hasAudiobook = await containsAudiobook(url);
      if (hasAudiobook) {
        urlsWithAudiobook.push(url);
      }
      await delay(2000); // Prevent overwhelming servers
    }

    console.log(`Found ${urlsWithAudiobook.length} URLs with "audiobook." Checking for exact titles.`);
    for (const url of urlsWithAudiobook) {
      for (const title of titles) {
        const isExactMatch = await containsExactTitle(url, title);
        if (isExactMatch) {
          exactMatches.push({ url, title });
          console.log(`Exact match found: "${title}" at ${url}`);
        }
      }
    }

    // Save results
    await saveResults(govUrlsFile, { govUrls, urlsWithAudiobook });
    await saveResults(matchesFile, exactMatches);

    console.log('Process complete.');
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute the main function
main();
