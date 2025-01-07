const axios = require('axios');

// Function to perform a search query
async function searchPolona() {
  try {
    const response = await axios.post('https://polona.pl/api/search-service/search/simple?query=&page=0&pageSize=24&sort=RELEVANCE', {
      keywordFilters: {
        copyright: ['false'],
        keywords: ['Fizyka']
      },
      temporalFilters: {
        dates: {
          startRange: '1900-01-01',
          endRange: '2000-12-31'
        }
      }
    });

    // Process the response data
    const data = response.data;
    console.log('Total elements:', data.totalElements);
    console.log('Number of pages:', data.totalPages);
    //for (let i = 0; i < data.hits.lenght; i++)
    console.log('Hits:', data.hits[0].expandedFields.keywords);

  } catch (error) {
    console.error('Error searching Polona:', error);
  }
}

// Function to fetch available filters
async function fetchFilters() {
  try {
    const response = await axios.get('https://polona.pl/api/search-service/search/filters');
    
    // Process the filter data
    const filters = response.data;
    console.log('Available filters:', filters);

  } catch (error) {
    console.error('Error fetching filters:', error);
  }
}

// Call the functions
searchPolona();
fetchFilters();
