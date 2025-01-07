const axios = require('axios');

// Wyszukiwanie proste
const simpleSearch = async (query, page = 0, pageSize = 24, sort = 'RELEVANCE') => {
  const url = `https://polona.pl/api/search-service/search/simple`;
  
  try {
    const response = await axios.post(url, null, {
      params: {
        query: query,
        page: page,
        pageSize: pageSize,
        sort: sort
      }
    });
    
    console.log('Wyniki wyszukiwania proste:', response.data);
  } catch (error) {
    console.error('Błąd wyszukiwania:', error);
  }
};

// Wyszukiwanie zaawansowane
const advancedSearch = async () => {
  const url = `https://polona.pl/api/search-service/search/advanced?page=0&pageSize=24&sort=OLDEST`;

  const body = {
    fieldQueries: {
      publishPlace: [{ isExact: false, query: 'Królewiec' }],
      creator: [{ isExact: false, query: 'fryderyk OR franciszek' }],
      keywords: [{ isExact: false, query: 'dezercja' }]
    },
    filters: {
      keywordFilters: {
        copyright: ['false']
      },
      temporalFilters: {
        dates: {
          startRange: '1700-01-01',
          endRange: '1800-12-31'
        }
      }
    }
  };
  
  try {
    const response = await axios.post(url, body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('Wyniki wyszukiwania zaawansowanego:', response.data);
  } catch (error) {
    console.error('Błąd wyszukiwania zaawansowanego:', error);
  }
};

// Wyszukiwanie pełnotekstowe
const fulltextSearch = async (query, page = 0, pageSize = 24, sort = 'RELEVANCE') => {
  const url = `https://polona.pl/api/search-service/fulltext/polona/fulltext/${page}/${pageSize}`;
  
  const body = {
    filters: {
      keywordFilters: { copyright: ['false'] },
      temporalFilters: null
    }
  };
  
  try {
    const response = await axios.post(url, body, {
      params: { query: query, sort: sort },
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Wyniki wyszukiwania pełnotekstowego:', response.data);
  } catch (error) {
    console.error('Błąd wyszukiwania pełnotekstowego:', error);
  }
};

// Wywołanie funkcji
simpleSearch('dzwonienie');
advancedSearch();
fulltextSearch('ochędóstwo');
