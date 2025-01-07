const axios = require('axios');

// Wyszukiwanie proste (tylko po słowie kluczowym)
const simpleSearch = async (query, page = 0, pageSize = 24, sort = 'RELEVANCE') => {
  const url = `https://polona.pl/api/search-service/search/simple`;

  if (!query) {
    console.error('Query parameter is required for search.');
    return;
  }

  try {
    // Send request using GET method (since query parameters are being sent)
    const response = await axios.get(url, {
      params: {
        query: query,       // Przeszukiwane słowo kluczowe
        page: page,         // Numer strony
        pageSize: pageSize, // Liczba wyników na stronę
        sort: sort          // Sortowanie wyników
      },
    });

    console.log('Wyniki wyszukiwania proste:', response.data);
  } catch (error) {
    console.error('Błąd wyszukiwania:', error.response ? error.response.data : error.message);
  }
};

// Wywołanie funkcji z przykładowym słowem kluczowym
simpleSearch('historia');  // Szuka po słowie kluczowym 'historia'
