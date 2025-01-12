import axios from 'axios';
import puppeteer from 'puppeteer';
import { performance } from 'perf_hooks';
import fs from 'fs/promises'; // For saving JSON file

// Function to perform a search query on Polona
async function searchPolona() {
  try {
    const response = await axios.post(
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
    return response.data; // Return the response data
  } catch (error) {
    console.error('Error searching Polona:', error.message);
    throw error;
  }
}

// Function to search on Google for results containing "gov.pl" and match the exact title on the content of the page
async function searchOnGoogleGov(query, exactTitle) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  );

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
    await page.goto(searchUrl);

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.tF2Cxc')).map((element) => ({
        title: element.querySelector('h3')?.innerText || '',
        link: element.querySelector('a')?.href || '',
        snippet: element.querySelector('.VwiC3b')?.innerText || '',
      }));
    });

    // Filter results to check if the exact title exists in the page content
    const matchedResults = [];
    for (const result of results) {
      try {
        await page.goto(result.link);
        const pageContent = await page.content();
        if (pageContent.includes(exactTitle)) {
          matchedResults.push(result);
        }
      } catch (error) {
        console.error(`Error visiting page ${result.link}:`, error.message);
      }
    }

    return matchedResults;
  } catch (error) {
    console.error(`Error searching Google for "${query}":`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to introduce a delay between requests
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Main function
async function main() {
  try {
    console.log('Fetching data from Polona...');
    const polonaStart = performance.now();
    const polonaData = await searchPolona();
    const polonaTime = performance.now() - polonaStart;

    if (!polonaData || !polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found on Polona.');
      return;
    }

    console.log(`Found ${polonaData.hits.length} items on Polona.`);
    const batchSize = 5;

    const matchedResultsData = [];
    const googleStart = performance.now();

    for (let i = 0; i < polonaData.hits.length; i += batchSize) {
      const batch = polonaData.hits.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (hit) => {
          const title = hit.basicFields?.title?.values?.[0];
          if (title) {
            console.log(`Searching for "${title}" on Google (site:gov.pl)...`);
            const googleResults = await searchOnGoogleGov(title, title);

            if (googleResults.length > 0) {
              console.log(
                `Google results with exact title match for "${title}" (site:gov.pl):`,
                googleResults
              );

              matchedResultsData.push({
                title,
                urls: googleResults.map((result) => result.link),
              });
            } else {
              console.log(`No results found for "${title}" on Google (site:gov.pl).`);
            }

            await delay(1500); // 1.5-second delay between requests
          }
        })
      );
    }

    const googleTime = performance.now() - googleStart;

    // Save matched results to JSON file
    await fs.writeFile(
      'matchedResults.json',
      JSON.stringify(matchedResultsData, null, 2),
      'utf8'
    );

    console.log(
      `Total matched results: ${matchedResultsData.length} (URLs saved to matchedResults.json)`
    );
    console.log(`Total time spent on Polona search: ${(polonaTime / 1000).toFixed(2)}s`);
    console.log(`Total time spent on Google search: ${(googleTime / 1000).toFixed(2)}s`);
    console.log(
      `Overall time: ${((polonaTime + googleTime) / 1000).toFixed(2)}s`
    );
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute the main function
main();
