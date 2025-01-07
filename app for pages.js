const axios = require('axios');
const express = require('express');

async function searchPolonaWithPagination(query, totalPages = 10, pageSize = 1000, sort = 'RELEVANCE') {
    const results = [];
    for (let page = 0; page < totalPages; page++) {
        console.log(`Fetching page ${page}...`); // Debug

        const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
        try {
            const response = await axios.get(url, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log(`Page ${page} response:`, response.data.hits.length); // Debug

            const filteredHits = response.data.hits.filter((hit, index) => {
                const rights = hit.expandedFields?.rights?.values?.[0];
                console.log(`Hit ${index}:`, rights); // Debug each item's rights field
                return rights === "Domena Publiczna. Wolno zwielokrotniać, zmieniać i rozpowszechniać oraz wykonywać utwór, nawet w celach komercyjnych, bez konieczności pytania o zgodę. Wykorzystując utwór należy pamiętać o poszanowaniu autorskich praw osobistych Twórcy.";
            });

            results.push(...filteredHits);

            // Break early if no more results
            if (response.data.hits.length < pageSize) {
                console.log('No more results. Breaking loop.'); // Debug
                break;
            }
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error.message);
            break; // Optional: Exit loop on error
        }
    }
    return results;
}



const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint wyszukiwania
app.get('/search', async (req, res) => {
    const { query, page = 0, pageSize = 100000, sort = 'RELEVANCE' } = req.query;

    try {
        // Wykonanie wyszukiwania za pomocą Polona API
        const data = await searchPolonaWithPagination("historia", 10, 1000, sort);

        // Wysłanie danych do przeglądarki
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json(data);
    } catch (error) {
        console.error('Błąd podczas wyszukiwania:', error.message);

        // Wysłanie błędu w przypadku niepowodzenia
        res.status(500).json({ error: error.message });
    }
});

// Uruchomienie serwera
app.listen(PORT, () => {
    console.log(`Serwer działa na http://localhost:${PORT}`);
});