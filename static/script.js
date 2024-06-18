M.AutoInit();

const modals = document.querySelectorAll('.modal');
M.Modal.init(modals);

const selects = document.querySelectorAll('select');
M.FormSelect.init(selects);

class SongLoader {
    constructor(dataUrl) {
        this.dataUrl = dataUrl;
        this.songs = {};
        this.songNames = [];
        this.categories = [];
    }

    async loadAllSongs(callback) {
        try {
            const response = await fetch(this.dataUrl);
            const data = await response.json();
            this.processData(data);
            if (callback) {
                callback();
            }
        } catch (err) {
            console.error('Error loading songs:', err);
        }
    }

    processData(data) {
        this.songs = { ...data };
        this.songNames = Object.keys(this.songs);
        this.categories = this.getAllCategories();
    }

    getSong(songName) {
        return this.songs[songName] || null;
    }

    getSongIndex(songName) {
        return this.songNames.indexOf(songName);
    }

    getSongNameByIndex(index) {
        return this.songNames[index];
    }

    getSongCount() {
        return this.songNames.length;
    }

    getSongsByCategories(categories) {
        const songsSet = new Set();
        categories.forEach(category => {
            this.songNames.forEach(songName => {
                if (this.songs[songName].categories.includes(category)) {
                    songsSet.add({ name: songName, content: this.songs[songName].content });
                }
            });
        });
        return Array.from(songsSet);
    }

    getAllCategories() {
        const categoriesSet = new Set();
        Object.values(this.songs).forEach(song => {
            song.categories.forEach(category => {
                categoriesSet.add(category);
            });
        });
        return Array.from(categoriesSet);
    }
}

class HomePage {
    constructor(songLoader) {
        this.songLoader = songLoader;
        this.container = document.getElementById('homePage');
        this.loader = document.getElementById('loader');
        this.searchBox = document.getElementById('search');
        this.searchCheckbox = document.getElementById('searchCheckbox');
        this.categoriesList = document.getElementById('categories-list');
        this.noTextMessage = document.getElementById('noTextMessage');
        this.selectedSongs = new Set();
        this.clearButton = document.getElementById('clear-search');


        this.searchBox.addEventListener('input', () => this.searchSongs());
        this.searchCheckbox.addEventListener('change', () => this.searchSongs());
        this.clearButton.addEventListener('click', () => {
            this.searchBox.placeholder = 'Search in all categories';
            this.searchBox.value = '';
            this.clearButton.style.display = 'none';
            this.searchSongs();
        });

        this.welcomeButton = document.getElementById('welcomeButton');
        this.installInstructionsButton = document.getElementById('installInstructionsButton');
        this.singAlongInstructionsButton = document.getElementById('singAlongInstructionsButton');

        document.getElementById('installInstructionsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showInstallInstructionsModal();
        });
        document.getElementById('singAlongInstructionsLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showSingAlongInstructionsModal();
        });
        this.singAlongInstructionsButton.addEventListener('click', () => {
            this.showSingAlongInstructionsModal();
        });
        this.installInstructionsButton.addEventListener('click', () => {
            this.showInstallInstructionsModal();
        });
        this.welcomeButton.addEventListener('click', () => {
            this.showWelcomeModal();
        });

        this.init();
    }

    init() {
        this.showLoader();
        this.songLoader.loadAllSongs(() => {
            this.renderPage();
            this.hideLoader();
            document.querySelectorAll('details').forEach((el) => {
                new Accordion(el);
                el.addEventListener('toggle', () => this.updateSearchPlaceholder());
            });
        });

        if (!this.getCookie('readMeShown')) {
            this.showWelcomeModal();
            this.setCookie('readMeShown', 'true', 365);
        }
    }

    setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i++) {
            var c = ca[i];
            while (c.charAt(0) == ' ') {
                c = c.substring(1, c.length);
            }
            if (c.indexOf(nameEQ) == 0) {
              return c.substring(nameEQ.length, c.length);
            }
        }
        return null;
    }
    renderPage() {
        const categoriesList = document.getElementById('categories-list');
        categoriesList.innerHTML = '';

        const categoryElements = {};

        const sortedCategories = this.songLoader.categories.sort(new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare);

        // Create nested category structure
        sortedCategories.forEach(category => {
            const parts = category.split('\\');
            let currentLevel = categoriesList;

            parts.forEach((part, index) => {
                const categoryPath = parts.slice(0, index + 1).join('\\');
                if (!categoryElements[categoryPath]) {
                    const details = document.createElement('details');
                    const summary = document.createElement('summary');

                    // Add appropriate icon based on the level of the category
                    const icon = document.createElement('i');
                    icon.classList.add('material-icons');
                    icon.id = 'book-icon';
                    if (index === 0) {
                        icon.textContent = 'book';
                    } else {
                        icon.textContent = 'library_books';
                    }

                    summary.appendChild(icon);
                    summary.appendChild(document.createTextNode(` ${part}`));
                    details.appendChild(summary);
                    categoryElements[categoryPath] = details;
                    currentLevel.appendChild(details);

                    // Add ul for nested categories and songs
                    const ul = document.createElement('ul');
                    ul.classList.add('scrollable-list');
                    details.appendChild(ul);
                    categoryElements[categoryPath + '\\ul'] = ul;
                }
                currentLevel = categoryElements[categoryPath + '\\ul'];
            });
        });

        // Add songs to the categories
        Object.keys(this.songLoader.songs).forEach(songName => {
            const song = this.songLoader.songs[songName];
            song.categories.forEach(category => {
                const currentLevel = categoryElements[category + '\\ul'];
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                <div class="song-div" data-song-name="${songName}">
                    <a class="btn deep-purple lighten-1 song" onclick="PageHandler.showPage('songPage', '${songName}')">
                        <span>${songName}</span>
                    </a>
                    <input type="checkbox" class="filled-in btn deep-purple lighten-1 song-checkbox" id="${songName}" data-song-name="${songName}">
                    <label for="${songName}"></label>
                    </div>
                `;
                currentLevel.appendChild(listItem);
            });
        });

        // Add event listeners to checkboxes
        document.querySelectorAll('.song-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const songName = e.target.getAttribute('data-song-name');
                if (e.target.checked) {
                    this.selectedSongs.add(songName);
                } else {
                    this.selectedSongs.delete(songName);
                }
            });
        });
    }
    searchSongs() {
        const searchTerm = this.searchBox.value.toLowerCase();
        const searchInContent = this.searchCheckbox.checked;
        const originalDetails = Array.from(this.categoriesList.querySelectorAll('details'));
        const originalSongButtons = Array.from(document.querySelectorAll('.song-div'));
        this.clearButton.style.display = searchTerm.value ? 'block' : 'none';

        if (searchTerm === '') {
            this.resetSearch();
            return;
        }
        this.clearButton.style.display = "block";

        let results = [];

        // Check if any details are open
        const openDetails = originalDetails.filter(details => details.hasAttribute('open'));

        if (openDetails.length === 0) {
            // Open all details if none are open
            originalDetails.forEach(details => details.setAttribute('open', true));
            results = originalSongButtons;
        } else {
            // Get songs only from open categories
            results = originalSongButtons.filter(button => {
                return openDetails.some(details => details.contains(button));
            });
        }

        if (searchInContent) {
            results = results.filter(button => {
                const songName = button.getAttribute('data-song-name').toLowerCase();
                const song = this.songLoader.getSong(button.getAttribute('data-song-name'));
                const songContent = song ? song.content.toLowerCase() : '';
                return songName.includes(searchTerm) || songContent.includes(searchTerm);
            });
        } else {
            results = results.filter(button => {
                const songName = button.getAttribute('data-song-name').toLowerCase();
                return songName.includes(searchTerm);
            });
        }

        this.toggleResultsVisibility(results, originalSongButtons, searchTerm);
    }

    toggleResultsVisibility(results, originalSongButtons, searchTerm) {
        originalSongButtons.forEach(div => {
            if (results.includes(div)) {
                div.style.display = 'inline-flex';
                this.highlightMatches(div, searchTerm);
            } else {
                div.style.display = 'none';
                this.removeHighlights(div);
            }
        });

        // Hide empty categories
        const detailsElements = document.querySelectorAll('details');
        detailsElements.forEach(details => {
            const ul = details.querySelector('ul');
            const hasVisibleSongs = Array.from(ul.querySelectorAll('li')).some(li => li.querySelector('.song-div').style.display === 'inline-flex');
            details.style.display = hasVisibleSongs ? 'block' : 'none';

            if (hasVisibleSongs) {
                details.setAttribute('open', true);
            } else {
                details.removeAttribute('open');
            }
        });
    }

    highlightMatches(div, searchTerm) {
        const songNameElement = div.querySelector('span');
        const songName = songNameElement.textContent;
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const highlightedText = songName.replace(regex, '<span class="highlight">$1</span>');
        songNameElement.innerHTML = highlightedText;
    }

    removeHighlights(div) {
        const songNameElement = div.querySelector('span');
        const songName = songNameElement.textContent;
        songNameElement.innerHTML = songName; // Reset to original text without highlights
    }
    getCategoryPath(detail) {
        const parts = [];
        let current = detail;

        while (current && current.tagName !== 'BODY') {
            if (current.tagName === 'DETAILS') {
                parts.unshift(current.querySelector('summary').textContent);
            }
            current = current.parentNode;
        }

        return parts.join('\\');
    }

    resetSearch() {
        const allDetails = Array.from(this.categoriesList.querySelectorAll('details'));
        const allSongButtons = Array.from(document.querySelectorAll('.song-div'));

        allDetails.forEach(details => {
            details.style.display = '';
            details.removeAttribute('open');
        });

        allSongButtons.forEach(button => {
            button.style.display = '';
            this.removeHighlights(button);
        });

        this.noTextMessage.innerHTML = '';
    }

    updateSearchPlaceholder() {
        const openDetails = Array.from(this.categoriesList.querySelectorAll('details[open]'));
        const openCategories = openDetails.map(detail => {
            const summary = detail.querySelector('summary');
            let textContent = '';
            summary.childNodes.forEach(node => {
                if (node.nodeType === Node.TEXT_NODE) {
                    textContent += node.textContent.trim();
                }
            });
            return textContent;
        }).map(category => category.replace(/book|library_books/g, '').trim());

        if (openCategories.length > 0) {
            this.searchBox.placeholder = `Search for songs inside ${openCategories.join(', ')}`;
        } else {
            this.searchBox.placeholder = 'Search in all categories';
        }
    }

    showWelcomeModal() {
        M.Modal.getInstance(document.getElementById('readWelcomeModal')).open();
    }
    closeWelcomeModal() {
        M.Modal.getInstance(document.getElementById('readWelcomeModal')).close();
    }
    showInstallInstructionsModal() {
        M.Modal.getInstance(document.getElementById('readInstallInstructionsModal')).open();
    }

    closeInstallInstructionsModal() {
        M.Modal.getInstance(document.getElementById('readInstallInstructionsModal')).close();
    }
    showSingAlongInstructionsModal() {
        M.Modal.getInstance(document.getElementById('readSingAlongInstructionsModal')).open();
    }

    closeSingAlongInstructionsModal() {
        M.Modal.getInstance(document.getElementById('readSingAlongInstructionsModal')).close();
    }
    showLoader() {
        this.loader.style.display = 'block';
    }

    hideLoader() {
        this.loader.style.display = 'none';
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}

class Accordion {
    constructor(el) {
        this.el = el;
        this.summary = el.querySelector('summary');
        this.content = el.querySelector('.scrollable-list');

        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.summary.addEventListener('click', (e) => this.onClick(e));
    }

    onClick(e) {
        e.preventDefault();
        this.el.style.overflow = 'hidden';
        if (this.isClosing || !this.el.open) {
            this.open();
        } else if (this.isExpanding || this.el.open) {
            this.shrink();
        }
    }

    shrink() {
        this.isClosing = true;

        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 300,
            easing: 'ease-in-out'
        });

        this.animation.onfinish = () => this.onAnimationFinish(false);
        this.animation.oncancel = () => this.isClosing = false;
    }

    open() {
        this.el.style.height = `${this.el.offsetHeight}px`;
        this.el.open = true;
        window.requestAnimationFrame(() => this.expand());
    }

    expand() {
        this.isExpanding = true;
        const startHeight = `${this.el.offsetHeight}px`;
        const endHeight = `${this.summary.offsetHeight + this.content.offsetHeight}px`;

        if (this.animation) {
            this.animation.cancel();
        }

        this.animation = this.el.animate({
            height: [startHeight, endHeight]
        }, {
            duration: 300,
            easing: 'ease-in-out'
        });
        this.animation.onfinish = () => this.onAnimationFinish(true);
        this.animation.oncancel = () => this.isExpanding = false;
    }

    onAnimationFinish(open) {
        this.el.open = open;
        this.animation = null;
        this.isClosing = false;
        this.isExpanding = false;
        this.el.style.height = this.el.style.overflow = '';
    }
}


class SingAlong {
    constructor(socket, songLoader, songPage, homePage) {
        this.socket = socket;
        this.songLoader = songLoader;
        this.songPage = songPage;
        this.homePage = homePage;
        this.isHost = false;
        this.currentSingAlong = null;
        this.selectedSongs = [];
        this.playedSongs = [];

        this.init();
    }

    init() {
        document.getElementById('createSingAlongButton').addEventListener('click', () => this.showCreateSingAlongModal());
        document.getElementById('joinSingAlongButton').addEventListener('click', () => this.showJoinSingAlongModal());
        document.getElementById('createSingAlongForm').addEventListener('submit', (e) => this.createSingAlong(e));
        document.getElementById('joinSingAlongForm').addEventListener('submit', (e) => this.joinSingAlong(e));
        document.getElementById('leaveSingAlongButton').addEventListener('click', () => this.leaveSingAlong());

        this.setupSocketEvents();
        this.checkForSingAlongCode();
    }

    setupSocketEvents() {
        this.socket.on('sync_song', data => {
            if (!this.isHost && (data.song && data.sing_along_name === this.currentSingAlong)) {
                this.playedSongs = data.played_songs;
                this.songPage.displaySong(data.song, false); // Do not update nav
                this.updateNavBarSongs();
            }
        });

        this.socket.on('left_sing_along', data => {
            this.isHost = false;
            this.currentSingAlong = null;
            this.selectedSongs = [];
            this.playedSongs = [];
            // PageHandler.showPage('homePage');
            document.getElementById('songPageNextPrevButtons').style.display = 'flex';
            document.getElementById('songPageHome').style.display = 'block';
            document.getElementById('navbarsingAlongSongs').style.display = 'none';
            document.getElementById('navbarSongs').style.display = 'block';
            document.getElementById('sharePage').style.bottom = '110px';
            this.removeSingAlongCodeFromURL()
            // window.location.hash = '';
            M.toast({ html: data.message })
        });

        this.socket.on('joined_sing_song', (data) => {
            this.currentSingAlong = data.sing_along_name;
            this.isHost = data.is_host;
            this.selectedSongs = data.songs;
            this.playedSongs = data.played_songs;
            if (data.song) {
                this.songPage.displaySong(data.song, false);
            }
            this.updateURLWithCode(this.currentSingAlong);
            this.updateNavBarSongs();
            this.closeJoinSingAlongModal();
            if (this.isHost) {
                document.getElementById('leaveSingAlongButton').innerText = 'End Sing Along';
                M.toast({ html: 'Joined as host.' })
            } else {
                document.getElementById('leaveSingAlongButton').innerText = 'Leave Sing Along';
                M.toast({ html: 'Joined sing along.' })
            }
        });
        this.socket.on('error', data => {
            document.getElementById('songPageNextPrevButtons').style.display = 'flex';
            document.getElementById('songPageHome').style.display = 'block';
            document.getElementById('navbarSongs').style.display = 'block';
            document.getElementById('navbarsingAlongSongs').style.display = 'none';
            document.getElementById('sharePage').style.bottom = '110px';
            this.removeSingAlongCodeFromURL();
            window.location.hash = '';
            PageHandler.showPage('homePage');
            M.toast({ html: data.message })
        });
    }

    updateURLWithCode(code) {
        this.removeSingAlongCodeFromURL();
        const url = new URL(window.location);
        url.searchParams.set('singAlongCode', code);
        window.history.pushState({}, '', url);
    }

    removeSingAlongCodeFromURL() {
        const url = new URL(window.location);
        url.searchParams.delete('singAlongCode');
        window.history.pushState({}, '', url);
    }

    checkForSingAlongCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const singAlongCode = urlParams.get('singAlongCode');
        if (singAlongCode) {
            this.joinSingAlongByCode(singAlongCode);
        }
    }

    joinSingAlongByCode(code) {
        const data = { sing_along_name: code, password: '' };
        this.socket.emit('join_sing_along', data);
    }

    createSingAlong(event) {
        event.preventDefault();
        const name = document.getElementById("singAlongName").value;
        const password = document.getElementById("singAlongHostPassword").value;
        const is_private = document.getElementById("isPrivate").checked;
        const songs = Array.from(this.homePage.selectedSongs);
        const description = document.getElementById("singAlongDescription").value;
        this.selectedSongs = songs;

        fetch('/create_sing_along', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, description, songs, password, is_private }),
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.currentSingAlong = name;
                    this.isHost = true;
                    this.updateURLWithCode(name);
                    this.updateNavBarSongs();
                    this.closeCreateSingAlongModal();
                    document.getElementById('leaveSingAlongButton').innerText = 'End Sing Along';
                    M.toast({ html: 'Sing along started!' })
                } else {
                    M.toast({ html: data.message })
                }
            });
    }

    leaveSingAlong() {
        if (this.isHost) {
            fetch('/delete_sing_along', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: this.currentSingAlong }),
            })
        }
        if (this.currentSingAlong) {
            this.currentSingAlong = null;
            this.selectedSongs = [];
            this.playedSongs = [];
            this.removeSingAlongCodeFromURL();
            document.getElementById('songPageNextPrevButtons').style.display = 'flex';
            document.getElementById('songPageHome').style.display = 'block';
            document.getElementById('sharePage').style.bottom = '110px';
            document.getElementById('navbarsingAlongSongs').style.display = 'none';
            document.getElementById('navbarSongs').style.display = 'block';
            this.socket.emit('leave_sing_along', { sing_along_name: this.currentSingAlong, is_host: this.isHost });
            this.isHost = false;
        }
    }

    joinSingAlong(event) {
        event.preventDefault();
        const singAlongCode = document.getElementById("singAlongCode").value;
        const password = document.getElementById("singAlongJoinHostPassword").value;
        const data = { sing_along_name: singAlongCode, password: password };
        this.socket.emit('join_sing_along', data);
        this.currentSingAlong = singAlongCode;
        this.updateNavBarSongs();
    }

    changeSong(newSong) {
        if (this.isHost) {
            this.playedSongs.push(newSong);
            this.socket.emit('change_song', { sing_along_name: this.currentSingAlong, songs: this.selectedSongs, new_song: newSong, is_host: this.isHost });
            this.updateNavBarSongs();
        }
    }

    updateNavBarSongs() {
        const navbarSongsList = document.getElementById('navbarsingAlongSongsList');
        navbarSongsList.innerHTML = '';
        this.selectedSongs.forEach(songName => {
            const listItem = document.createElement('a');
            listItem.className = 'collection-item btn-flat';
            listItem.textContent = songName;

            if (this.playedSongs.includes(songName)) {
                const checkmarkIcon = document.createElement('i');
                checkmarkIcon.className = 'material-icons left';
                checkmarkIcon.textContent = 'check';

                // Insert the checkmark icon before the song name
                listItem.insertBefore(checkmarkIcon, listItem.firstChild);
            }

            if (this.isHost) {
                listItem.addEventListener('click', () => this.songPage.displaySong(songName, false));
            } else {
                listItem.className += ' disabled';
            }

            navbarSongsList.appendChild(listItem);
        });

        document.getElementById('navbarsingAlongSongs').style.display = 'block';

        if (!this.isHost) {
            document.getElementById('songPageNextPrevButtons').style.display = 'none';
            document.getElementById('songPageHome').style.display = 'none';
            document.getElementById('navbarSongs').style.display = 'none';
            document.getElementById('sharePage').style.bottom = '30px';
        } else {
            document.getElementById('songPageNextPrevButtons').style.display = 'flex';
            document.getElementById('songPageHome').style.display = 'block';
            document.getElementById('navbarSongs').style.display = 'block';
            document.getElementById('sharePage').style.bottom = '110px';
        }
    }

    loadPublicSingAlongs() {
        fetch('/get_public_sing_alongs', {
            method: 'GET'
        }).then(response => response.json()).then(data => {
            const publicSingAlongsList = document.getElementById('publicSingAlongsList');
            publicSingAlongsList.innerHTML = '';

            if (Object.keys(data).length === 0) {
                const noSingAlongsMessage = document.createElement('p');
                noSingAlongsMessage.textContent = 'There are no sing-alongs currently online.';
                publicSingAlongsList.appendChild(noSingAlongsMessage);
            } else {
                Object.keys(data).forEach(name => {
                    const singAlong = data[name];
                    const listItem = document.createElement('a');
                    listItem.className = 'btn song btn deep-purple lighten-1';
                    if (data[name].description) {
                        listItem.textContent = name + ' - ' + data[name].description;
                    } else {
                        listItem.textContent = name;
                    }
                    listItem.addEventListener('click', () => this.joinSingAlongByName(name));
                    publicSingAlongsList.appendChild(listItem);
                });
            }
        }).catch(error => console.error('Error:', error));
    }

    joinSingAlongByName(name) {
        this.closeSidenav();
        document.getElementById('singAlongCode').value = name;
        this.joinSingAlong(new Event('submit'));
    }

    showCreateSingAlongModal() {
        M.Modal.getInstance(document.getElementById('createSingAlongModal')).open();
    }

    closeCreateSingAlongModal() {
        M.Modal.getInstance(document.getElementById('createSingAlongModal')).close();
    }

    showJoinSingAlongModal() {
        this.loadPublicSingAlongs();
        M.Modal.getInstance(document.getElementById('joinSingAlongModal')).open();
    }

    closeJoinSingAlongModal() {
        M.Modal.getInstance(document.getElementById('joinSingAlongModal')).close();
    }
    closeSidenav() {
        $('.song-button-collapse').sideNav('hide');
    }

}

class SongPage {
    constructor(songLoader) {
        this.songLoader = songLoader;
        this.container = document.getElementById('songPage');
        this.titleElement = document.getElementById('song-title');
        this.contentElement = document.getElementById('song-content');
        this.previousButton = document.getElementById('previousSongButton');
        this.nextButton = document.getElementById('nextSongButton');
        this.previous10Button = document.getElementById('previous10SongsButton');
        this.next10Button = document.getElementById('next10SongsButton');
        this.navBarTitle = document.getElementById('songPageNavBarTitle');
        this.navbarArrangementName = document.getElementById('navbarArrangementName');
        this.navbarSearch = document.getElementById('navbarSearch');
        this.navbarSongsList = document.getElementById('navbarSongsList');
        this.increaseFontSizeBtn = document.getElementById('increaseFontSize');
        this.decreaseFontSizeBtn = document.getElementById('decreaseFontSize');

        this.increaseFontSizeBtn.addEventListener('click', () => this.adjustFontSize(true));
        this.decreaseFontSizeBtn.addEventListener('click', () => this.adjustFontSize(false));
        this.previousButton.addEventListener('click', () => this.loadPreviousSong());
        this.nextButton.addEventListener('click', () => this.loadNextSong());
        this.navbarSearch.addEventListener('input', () => this.searchSongs());
        this.previous10Button.addEventListener('click', () => this.loadPrevious10Songs());
        this.next10Button.addEventListener('click', () => this.loadNext10Songs());

        this.currentSongIndex = null;

        this.singAlong = null;

        this.loadFontSizePreference();
    }

    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }
    }

    loadFontSizePreference() {
        const savedFontSize = this.getCookie('fontSize');
        if (savedFontSize) {
            this.contentElement.style.fontSize = savedFontSize + 'px';
        }
    }

    adjustFontSize(increase) {
        const currentFontSize = parseFloat(window.getComputedStyle(this.contentElement, null).getPropertyValue('font-size'));
        const newFontSize = increase ? currentFontSize + 1 : currentFontSize - 1;
        this.contentElement.style.fontSize = newFontSize + 'px';
        this.setCookie('fontSize', newFontSize, 365);
    }

    setCookie(name, value, days) {
        let expires = "";
        if (days) {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "") + expires + "; path=/";
    }

    displaySong(songName, updateNav = true) {
        const song = this.songLoader.getSong(songName);
        if (song) {
            this.titleElement.innerHTML = songName;
            this.navBarTitle.innerText = songName;
            this.contentElement.innerHTML = song.content.replace(/\n/g, '<br>') + '<br>' + '<br>' + '<br>' + '<br>' + '<br>';
            window.location.hash = encodeURIComponent(songName);

            this.currentSongIndex = this.songLoader.getSongIndex(songName);
            this.updateNavigationButtons();

            if (updateNav) {
                this.loadSongsInNavBar(song.categories);
            }

            this.navbarArrangementName.innerHTML = song.categories;
            this.highlightCurrentSong(songName);
            this.searchSongs();
            if (this.singAlong) {
                this.singAlong.changeSong(songName);
            }
        } else {
            console.error(`Song not found`);
        }
    }

    loadPrevious10Songs() {
        if (this.currentSongIndex > 0) {
            const newSongIndex = Math.max(0, this.currentSongIndex - 10);
            const previousSongName = this.songLoader.getSongNameByIndex(newSongIndex);
            this.displaySong(previousSongName);
        }
    }

    loadNext10Songs() {
        const songCount = this.songLoader.getSongCount();
        if (this.currentSongIndex < songCount - 1) {
            const newSongIndex = Math.min(songCount - 1, this.currentSongIndex + 10);
            const nextSongName = this.songLoader.getSongNameByIndex(newSongIndex);
            this.displaySong(nextSongName);
        }
    }

    loadPreviousSong() {
        if (this.currentSongIndex > 0) {
            const previousSongName = this.songLoader.getSongNameByIndex(this.currentSongIndex - 1);
            this.displaySong(previousSongName);
        }
    }

    loadNextSong() {
        if (this.currentSongIndex < this.songLoader.getSongCount() - 1) {
            const nextSongName = this.songLoader.getSongNameByIndex(this.currentSongIndex + 1);
            this.displaySong(nextSongName);
        }
    }

    updateNavigationButtons() {
        const songCount = this.songLoader.getSongCount();
        if (this.currentSongIndex === 0) {
            this.previousButton.disabled = true;
            this.previousButton.classList.add('disabled');
            this.previous10Button.disabled = true;
            this.previous10Button.classList.add('disabled');
        } else {
            this.previousButton.disabled = false;
            this.previousButton.classList.remove('disabled');
            this.previous10Button.disabled = false;
            this.previous10Button.classList.remove('disabled');
        }

        if (this.currentSongIndex === songCount - 1) {
            this.nextButton.disabled = true;
            this.nextButton.classList.add('disabled');
            this.next10Button.disabled = true;
            this.next10Button.classList.add('disabled');
        } else {
            this.nextButton.disabled = false;
            this.nextButton.classList.remove('disabled');
            this.next10Button.disabled = false;
            this.next10Button.classList.remove('disabled');
        }
    }
    loadSongsInNavBar(categories) {
        const songs = this.songLoader.getSongsByCategories(categories);
        this.navbarSongsList.innerHTML = '';
        songs.forEach(song => {
            const listItem = document.createElement('a');
            listItem.className = 'collection-item';
            listItem.innerText = song.name;
            listItem.addEventListener('click', () => this.displaySong(song.name));
            this.navbarSongsList.appendChild(listItem);
        });
    }

    searchSongs() {
        const searchTerm = this.navbarSearch.value.toLowerCase();
        const songs = Array.from(this.navbarSongsList.getElementsByTagName('a'));
        songs.forEach(song => {
            const songName = song.textContent.toLowerCase();
            if (songName.includes(searchTerm)) {
                song.style.display = '';
            } else {
                song.style.display = 'none';
            }
        });
    }

    highlightCurrentSong(songName) {
        const songs = Array.from(this.navbarSongsList.getElementsByTagName('a'));
        songs.forEach(song => {
            if (song.textContent === songName) {
                song.classList.add('active');
                song.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                song.classList.remove('active');
            }
        });
    }

    show() {
        this.container.style.display = 'block';
    }

    hide() {
        this.container.style.display = 'none';
    }
}



class PageHandler {
    static pages = {};

    static registerPage(pageName, pageInstance) {
        PageHandler.pages[pageName] = pageInstance;
    }

    static showPage(pageName, songName = null) {
        Object.values(PageHandler.pages).forEach(page => page.hide());
        const page = PageHandler.pages[pageName];
        page.show();
        if (songName && page instanceof SongPage) {
            page.displaySong(songName, true);
        } else if (page instanceof HomePage) {
            this.pages['songPage'].contentElement.innerHTML = "";
            this.pages['songPage'].navbarSongsList.innerHTML = "";
        }
    }
}

async function sharePage() {
    const url = window.location.href;
    const urlObj = new URL(url);
    const urlParams = new URLSearchParams(urlObj.search);
    const singAlongCode = urlParams.get('singAlongCode');

    let finalUrl = url;

    if (singAlongCode) {
        // Construct the base URL without the hashtag
        finalUrl = `${urlObj.origin}${urlObj.pathname}?${urlParams}`;
    }

    // Construct the message
    const message = singAlongCode ? 'Come sing along with us:' : 'Join me to sing:';
    const fullMessage = `${message}\n${finalUrl}`;

    if (navigator.share) {
        await navigator.share({
            title: document.title,
            text: fullMessage,
            url: finalUrl
        }).then(() => {
        }).catch(console.error);
    } else {
        copyToClipboard(fullMessage);
        M.toast({ html: 'Share not supported on this browser, the URL has been copied to your clipboard.' });
    }
}

function copyToClipboard(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
}

document.addEventListener("DOMContentLoaded", function () {
    const songLoader = new SongLoader('./static/data.json');
    const homePage = new HomePage(songLoader);
    const songPage = new SongPage(songLoader);
    const socket = io({ transports: ['websocket', 'polling'] });  // Ensure WebSocket is used first

    socket.on('connect', () => {
        console.log('Connected to the server via WebSocket');
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('disconnect', (reason) => {
        console.warn('Disconnected from the server:', reason);
        if (reason === 'io server disconnect') {
            // The server has forcefully disconnected the socket
            socket.connect(); // Reconnect manually
        }
    });

    songLoader.loadAllSongs(() => {
        PageHandler.registerPage('homePage', homePage);
        PageHandler.registerPage('songPage', songPage);

        PageHandler.showPage('homePage');
        const singAlong = new SingAlong(socket, songLoader, songPage, homePage);
        songPage.singAlong = singAlong;


        const loadSongFromHash = () => {
            const hash = window.location.hash.substring(1);
            if (hash) {
                const songName = decodeURIComponent(hash);
                PageHandler.showPage('songPage', songName);
            } else {
                PageHandler.showPage('homePage');
            }
        };

        window.addEventListener('hashchange', loadSongFromHash, false);
        loadSongFromHash();


    });

    $('.home-button-collapse').sideNav();
    $('.home-button-collapse').sideNav({
        menuWidth: 300, // Default is 300
        edge: 'left', // Choose the horizontal origin
        closeOnClick: true, // Closes side-nav on <a> clicks, useful for Angular/Meteor
        draggable: true, // Choose whether you can drag to open on touch screens,
    });
    $('.song-button-collapse').sideNav();
    $('.song-button-collapse').sideNav({
        menuWidth: 300, // Default is 300
        edge: 'left', // Choose the horizontal origin
        closeOnClick: true, // Closes side-nav on <a> clicks, useful for Angular/Meteor
        draggable: true, // Choose whether you can drag to open on touch screens,
    });
});
