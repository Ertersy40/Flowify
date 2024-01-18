document.getElementById('login-button').addEventListener('click', function() {
    window.location.href = 'https://flowify-server-1ab4c9347977.herokuapp.com/login';
});


function fetchAndDisplayPlaylists() {
    fetch('https://flowify-server-1ab4c9347977.herokuapp.com/user-playlists')
    .then(response => response.json())
    .then(playlistsData => {
        const playlistsContainer = document.getElementById('playlists-container');
        playlistsData.items.forEach(playlist => {
            const playlistElement = document.createElement('div');
            playlistElement.innerHTML = `<h3>${playlist.name}</h3>`;
            // Add more playlist details if necessary
            playlistsContainer.appendChild(playlistElement);
        });
    })
    .catch(error => console.error('Error fetching playlists:', error));
}

document.addEventListener('DOMContentLoaded', fetchAndDisplayPlaylists);
