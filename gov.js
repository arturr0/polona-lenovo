const axios = require('axios');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Function to perform a search query
async function searchPolona() {
  try {
    const response = await axios.post('https://polona.pl/api/search-service/search/simple?query=&page=0&pageSize=4000&sort=RELEVANCE', {
      keywordFilters: {
        copyright: ['false'],
        keywords: ['Fizyka'],
        category: ['Książki']
      },
    });
    return response.data; // Return the response data
  } catch (error) {
    console.error('Error searching Polona:', error.message);
    throw error; // Rethrow the error to handle it in the caller
  }
}

// Function to fetch available filters
async function fetchFilters() {
  try {
    const response = await axios.get('https://polona.pl/api/search-service/search/filters');
    return response.data; // Return the filters data
  } catch (error) {
    console.error('Error fetching filters:', error.message);
    throw error; // Rethrow the error to handle it in the caller
  }
}

// Define the /search route
app.get('/search', async (req, res) => {
  //return filters and hits
  // try {
  //   const searchData = await searchPolona(); // Get search results
  //   const filters = await fetchFilters(); // Get filters data

  //   // Send data as a JSON response
  //   res.status(200).json({
  //     searchData,
  //     filters
  //   });
  // } catch (error) {
  //   console.error('Error in /search route:', error.message);
  //   res.status(500).json({ error: 'Internal server error' });
  // }


  //return filters struct
  // try {
  //   const filters = await fetchFilters(); // Get filters data

  //   // Send only filters as a JSON response
  //   res.status(200).json(filters);
  // } catch (error) {
  //   console.error('Error in /search route:', error.message);
  //   res.status(500).json({ error: 'Internal server error' });
  // }

  //return hits struct
  try {
    const searchData = await searchPolona(); // Get search results

    // Send only searchData as a JSON response
    res.status(200).json(searchData);
  } catch (error) {
    console.error('Error in /search route:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
