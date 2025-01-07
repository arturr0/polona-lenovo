document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const query = document.getElementById('searchQuery').value;

    try {
        const response = await fetch(`http://localhost:3000/api/search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';  // Czyścimy poprzednie wyniki

        if (data.hits && data.hits.length > 0) {
            data.hits.forEach(hit => {
                const div = document.createElement('div');
                div.classList.add('result-item');
                div.innerHTML = `
                    <h3>${hit.title}</h3>
                    <p>${hit.description}</p>
                `;
                resultsDiv.appendChild(div);
            });
        } else {
            resultsDiv.innerHTML = '<p>Brak wyników.</p>';
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
});
