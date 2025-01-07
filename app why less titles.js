const axios = require('axios');

// Wyszukiwanie po słowach kluczowych w Polonie
const simpleSearch = async (query, page = 0, pageSize = 24, sort = 'RELEVANCE') => {
  const url = `https://polona.pl/api/search-service/search/simple`;

  if (!query) {
    console.error('Query parameter is required for search.');
    return;
  }

  try {
    // Send request using GET method with query focused on 'keywords'
    const response = await axios.get(url, {
      params: {
        query: `keywords:${query}`,  // Szuka tylko w słowach kluczowych
        page: page,                  // Numer strony
        pageSize: pageSize,          // Liczba wyników na stronę
        sort: sort                   // Sortowanie wyników
      },
    });

    console.log('Wyniki wyszukiwania proste:');

    // Log all hits
    if (response.data.hits && Array.isArray(response.data.hits)) {
      response.data.hits.forEach((hit, index) => {
        console.log(`Hit ${index + 1}:`, hit.basicFields.title);
      });
    } else {
      console.log('No hits found.');
    }

  } catch (error) {
    console.error('Błąd wyszukiwania:', error.response ? error.response.data : error.message);
  }
};

// Wywołanie funkcji z przykładowym słowem kluczowym
simpleSearch('historia');  // Szuka po słowie kluczowym 'historia'
