const axios = require('axios');
const express = require('express');

async function searchPolona(query, page = 0, pageSize = 24, sort = 'RELEVANCE') {
    const url = `https://polona.pl/api/search-service/search/simple?query=${query}&page=${page}&pageSize=${pageSize}&sort=${sort}`;

    try {
        // Wykonanie zapytania do Polona API
        const response = await axios.get(url, {
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // Calculate total pages based on totalElements and pageSize
        const totalPages = Math.ceil(response.data.totalElements / pageSize);

        // Filtracja wyników po "rights" i "Książki" w expandedFields
        const filteredHits = response.data.hits.filter(hit => {
            const rights = hit.expandedFields?.rights?.values?.[0];
            const documentTypes = hit.attributes?.documentTypes?.stringArrValues?.[0];
            
            return (
                rights === "Domena Publiczna. Wolno zwielokrotniać, zmieniać i rozpowszechniać oraz wykonywać utwór, nawet w celach komercyjnych, bez konieczności pytania o zgodę. Wykorzystując utwór należy pamiętać o poszanowaniu autorskich praw osobistych Twórcy." &&
                documentTypes === "Książki"
            );
        });

        // Zwrócenie danych po filtracji i aktualizacji totalPages
        return { 
            ...response.data, 
            totalPages: totalPages,  // Override totalPages to be totalElements divided by pageSize
            hits: filteredHits 
        };
    } catch (error) {
        // Obsługa błędów
        throw new Error(`Błąd API Polona: ${error.message}`);
    }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Endpoint wyszukiwania
app.get('/search', async (req, res) => {
    const { query, page = 0, pageSize = 24, sort = 'RELEVANCE' } = req.query;

    try {
        // Wykonanie wyszukiwania za pomocą Polona API
        const data = await searchPolona("historia", page, pageSize, sort);

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
