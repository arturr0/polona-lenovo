const fetch = require('node-fetch'); // Import node-fetch
const cheerio = require('cheerio');

// Funkcja do wyszukiwania frazy na domenach .gov.pl
async function searchOnGoogle(fraza) {
  try {
    const query = `site:gov.pl ${fraza}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;

    // Wysyłanie zapytania HTTP do Google
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    // Parsowanie odpowiedzi za pomocą Cheerio (biblioteka do parsowania HTML)
    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];
    
    $('a').each((index, element) => {
      const link = $(element).attr('href');
      if (link && link.startsWith('http') && link.includes('gov.pl')) {
        results.push(link);
      }
    });

    return results;
  } catch (error) {
    console.error('Błąd wyszukiwania:', error.message);
    return [];
  }
}

// Funkcja do przetwarzania wyników z Polona i wyszukiwania fraz na stronach .gov.pl
async function processPolonaResults() {
  const polonaResults = [
    { title: 'Historia sztuki w Polsce', keywords: ['sztuka', 'historia', 'kultura'] },
    { title: 'Polska literatura', keywords: ['literatura', 'polska', 'kultura'] },
  ];

  for (const result of polonaResults) {
    for (const keyword of result.keywords) {
      const govResults = await searchOnGoogle(keyword);
      console.log(`Wyniki wyszukiwania dla frazy "${keyword}":`, govResults);
    }
  }
}

// Uruchomienie procesu
processPolonaResults().catch(console.error);
