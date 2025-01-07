const axios = require('axios');

// Function to perform a simple search
const searchPolona = async (query, page = 0, pageSize = 24, sort = 'RELEVANCE') => {
  try {
    // Define the API URL with query parameters
    const url = `https://polona.pl/api/search-service/search/simple?query=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
    
    // Send the GET request with the correct URL
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
      }
    });

    // Handle the response
    const data = response.data;
    
    // Output the results
    console.log(`Total Results: ${data.totalElements}`);
    console.log('Results:');
    data.hits.forEach((item, index) => {
      console.log(`${index + 1}. Title: ${item.title}, Author: ${item.creator}`);
    });
  } catch (error) {
    console.error('Error during search:', error.message);
  }
};

// Example usage of the search function
const query = 'historia';  // Example search term
const page = 0;               // First page
const pageSize = 5;           // Number of results per page
const sort = 'RELEVANCE';     // Sorting by relevance

searchPolona(query, page, pageSize, sort);
