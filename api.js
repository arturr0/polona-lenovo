//const fetch = require('node-fetch');
import fetch from 'node-fetch'
async function searchGoogleAPI(query) {
  const apiKey = '';  // Replace with your API key
  const cx = '';  // Replace with your Custom Search Engine ID
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${apiKey}&cx=${cx}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.items) {
      return data.items.map(item => ({ title: item.title, link: item.link }));
      
    } else {
      console.error('No results found');
      return [];
    }
  } catch (error) {
    console.error('Error fetching data from Google Custom Search API:', error);
    return [];
  }
}
const results = await searchGoogleAPI("audiobook");
console.log(results);