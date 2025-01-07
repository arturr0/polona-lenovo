const axios = require('axios');

// Replace these with your own API Key and Custom Search Engine ID
const API_KEY = 'your_api_key'; // Replace with your Google API Key
const CX = 'your_search_engine_id'; // Replace with your Custom Search Engine ID

/**
 * Function to search for a keyword across all gov.pl domains
 * @param {string} keyword - The word to search for
 */
async function searchAcrossGovPL(keyword) {
  // Query restricted to all domains under gov.pl
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    keyword
  )}+site:gov.pl&key=${API_KEY}&cx=${CX}`;

  try {
    const response = await axios.get(url);
    console.log('Search Results:', response.data);

    // Return only the items (results) if available
    return response.data.items || [];
  } catch (error) {
    console.error('Error searching Google:', error.message);
    if (error.response) {
      console.error('Response Data:', error.response.data);
    }
  }
}

// Example usage
(async () => {
  const keyword = 'job'; // Replace with your search term
  const results = await searchAcrossGovPL(keyword);

  // Output results
  if (results.length > 0) {
    results.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} - ${item.link}`);
    });
  } else {
    console.log('No results found.');
  }
})();
