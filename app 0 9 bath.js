const axios = require('axios');
const express = require('express');

async function searchPolonaWithPagination(query, totalPages = 100, pageSize = 1000, sort = 'RELEVANCE', batchSize = 10) {
    const results = [];
    let maxPages = totalPages;

    for (let batchStart = 0; batchStart < maxPages; batchStart += batchSize) {
        console.log(`Fetching pages ${batchStart} to ${Math.min(batchStart + batchSize - 1, maxPages - 1)}...`);

        // Array of promises for the current batch of 10 pages
        const batchRequests = [];
        for (let page = batchStart; page < batchStart + batchSize && page < maxPages; page++) {
            const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;
            batchRequests.push(
                axios.get(url, {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }).catch((error) => {
                    console.error(`Error fetching page ${page}:`, error.message);
                    return null; // Avoid throwing on a single request failure
                })
            );
        }

        try {
            // Wait for all the batch requests to resolve
            const responses = await Promise.all(batchRequests);

            for (const [index, response] of responses.entries()) {
                if (!response || !response.data.hits) continue;

                console.log(`Page ${batchStart + index} response: ${response.data.hits.length} hits`);

                // Dynamically adjust maxPages based on totalPages from the first response
                if (batchStart === 0 && response.data.totalPages) {
                    maxPages = Math.min(totalPages, response.data.totalPages);
                    console.log(`Adjusted maxPages to ${maxPages}`); // Debug
                }

                const filteredHits = response.data.hits.filter((hit, index) => {
                    const rights = hit.expandedFields?.rights?.values?.[0];
                    console.log(`Hit ${index}:`, rights); // Debug each item's rights field
                    return rights === "Domena Publiczna. Wolno zwielokrotniać, zmieniać i rozpowszechniać oraz wykonywać utwór, nawet w celach komercyjnych, bez konieczności pytania o zgodę. Wykorzystując utwór należy pamiętać o poszanowaniu autorskich praw osobistych Twórcy.";
                });

                results.push(...filteredHits);
            }

            // Break early if no more results (based on API's response length)
            if (responses.every((response) => response && response.data.hits.length < pageSize)) {
                console.log('No more results in this batch. Breaking loop.');
                break;
            }
        } catch (error) {
            console.error(`Error processing batch starting at page ${batchStart}:`, error.message);
            break; // Exit the loop on unexpected errors
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
        const data = await searchPolonaWithPagination("historia", 100, 1000, sort);

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