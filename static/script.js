var isSearching = false;
var suneditor = SUNEDITOR.create('songTextArea', { 'height': '300px', 'min-height': '300px' });
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register("/static/sw.js", { scope: '/static/' })
            .then(function (registration) {
                // Registration was successful
                console.log('ServiceWorker registration successful with scope :) ', registration.scope);
            }, function (err) {
                // registration failed :(
                console.log('ServiceWorker registration failed :( ', err);
            });
        backToHomePage();
    });
}

function populateCodeOptions() {
    fetch('./static/codes.json')
        .then(response => response.json())
        .then(codesData => {
            var selectElement = document.getElementById('codeSelection');
            selectElement.innerHTML = '';
            // selectElement.innerHTML = '<option value="" disabled selected>Choose a public code</option>';

            Object.keys(codesData).forEach(function (category) {
                if (!codesData[category]['private']) {
                    var optionElement = document.createElement('option');
                    optionElement.value = category;
                    optionElement.text = category;
                    if (codeIsInCookies(category)) {
                        optionElement.selected = true;
                    }
                    selectElement.appendChild(optionElement);
                }
            });
            $('select').material_select();
        })
        .catch(err => {
            console.error(err);
        });
}

function codeIsInCookies(other_code) {
    var cookie_codes = document.cookie.split('; ');
    for (var cookie_code of cookie_codes) {
        if (cookie_code == '') {
            return false;
        }
        code = cookie_code.split('=')[0].replace("\"", "");
        folder_name = cookie_code.split('=')[1].replace(/"/g, '').replace("\"", "");
        if (other_code == code || other_code == folder_name) {
            return true;
        }
    }
    return false;
}

function getCodeName(arrangement) {
    var cookie_codes = document.cookie.split('; ');
    for (var cookie_code of cookie_codes) {
        code = cookie_code.split('=')[0].replace("\"", "");
        folder_name = cookie_code.split('=')[1].replace(/"/g, '').replace("\"", "");
        if (arrangement == folder_name) {
            return code;
        }
    }
}

function updateOnlineStatus() {
    if (navigator.onLine) {
        // Materialize.toast('You are online, updating files!', 3000)
        $('#floating-button').show();
    } else {
        Materialize.toast('You are offline, using cache!', 3000)
        $('#floating-button').hide();
    }
}

function groupCreateFile(arrangement, groupName) {
    var Form = document.getElementById("editSong");
    Form.style.display = "block";
    void Form.offsetWidth;
    Form.style.opacity = 1;

    var inputText = document.getElementById('new_song_name');
    inputText.value = "Enter file name";
    var submitButton = document.getElementById('submitEditSong');
    submitButton.removeAttribute('onclick');
    submitButton.setAttribute('onclick', `sumbitAddNewSong('${arrangement}', '${groupName}')`);
    var deleteGroupButton = document.getElementById('delete_song');
    deleteGroupButton.removeAttribute("onclick");
    deleteGroupButton.setAttribute('onclick', `closeEditSongForm()`);
    suneditor.insertHTML('');
    document.body.style.overflow = "hidden";
}

function groupAddExistingSong(group, groupName) {
    console.log(group, groupName);
    Materialize.toast("groupAddExistingSong", 3000)
}

async function groupUploadFIles(group, groupName) {
    try {
        const files = await openFileOrFiles(true);
        if (files && files.length > 0) {
            const formData = new FormData();
            formData.append('arrangement', group);
            formData.append('group', groupName);

            files.forEach((file) => {
                formData.append('files', file);
            });

            const response = await fetch('http://10.11.2.76:5000/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                // const result = await response.json();
                Materialize.toast('Successfully uploaded files!', 3000)
                loadAllSongs();
            } else {
                console.error('Failed to upload files');
                Materialize.toast('Failed to upload files!', 6000)
            }
        }
    } catch (err) {
        console.log(err);
    }
}

function renameGroup(arrangement, oldGroupName) {
    var inputText = document.getElementById('new_group_name');
    var newGroupName = inputText.value;
    const apiUrl = `http://10.11.2.76:5000/rename_group/${arrangement}/${oldGroupName}/${newGroupName}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            setTimeout(function () {
                closeForm("editGroup");
            }, 300);
            Materialize.toast("Success", 3000)
            loadAllArrangements();
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function renameArrangement(oldArrangementName, oldCodeName) {
    var newName = document.getElementById('new_folder_name').value;
    var newCode = document.getElementById('new_code_name').value;
    var newPrivate = document.getElementById('new_privateCheckbox').checked;
    const apiUrl = `http://10.11.2.76:5000/rename_arrangement/${oldArrangementName}/${newName}/${oldCodeName}/${newCode}/${newPrivate}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            setTimeout(function () {
                closeForm("editArrangement");
            }, 300);
            Materialize.toast("Success", 3000)
            loadAllArrangements();
            loadAllSongs();
            populateCodeOptions();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function deleteGroup(arrangement, groupName) {
    const apiUrl = `http://10.11.2.76:5000/delete_group/${arrangement}/${groupName}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            setTimeout(function () {
                closeForm("editGroup");
            }, 300);
            Materialize.toast("Success", 3000);
            loadAllArrangements();
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function deleteArrangement(arrangement, codeName) {
    const apiUrl = `http://10.11.2.76:5000/delete_arrangement/${arrangement}/${codeName}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            setTimeout(function () {
                closeForm("editArrangement");
            }, 300);
            Materialize.toast("Success", 3000)
            loadAllArrangements();
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function arrangementCreateFile(arrangement) {
    var Form = document.getElementById("editSong");
    Form.style.display = "block";
    void Form.offsetWidth;
    Form.style.opacity = 1;

    var inputText = document.getElementById('new_song_name');
    inputText.value = "Enter file name";
    var submitButton = document.getElementById('submitEditSong');
    submitButton.removeAttribute('onclick');
    submitButton.setAttribute('onclick', `sumbitAddNewSong('${arrangement}', '')`);
    var deleteGroupButton = document.getElementById('delete_song');
    deleteGroupButton.removeAttribute("onclick");
    deleteGroupButton.setAttribute('onclick', `closeEditSongForm()`);
    suneditor.insertHTML('');
    document.body.style.overflow = "hidden";
}

function arrangementAddExistingSongs(arrangement) {
    console.log(group);
    Materialize.toast("arrangementAddExistingSongs", 3000)
}

function editTextFromArrangement(arrangement, oldSongName) {
    fetch('./static/custom_content.json').then(response => {
        return response.json();
    }).then(data => {
        var Form = document.getElementById("editSong");
        Form.style.display = "block";
        void Form.offsetWidth;
        Form.style.opacity = 1;
        var inputText = document.getElementById('new_song_name');
        inputText.value = oldSongName;
        var submitButton = document.getElementById('submitEditSong');
        submitButton.removeAttribute('onclick');
        submitButton.setAttribute('onclick', `submitEditSong('${arrangement}', '', '${oldSongName}')`);
        var deleteGroupButton = document.getElementById('delete_song');
        deleteGroupButton.removeAttribute("onclick");
        deleteGroupButton.setAttribute('onclick', `deleteSong('${arrangement}', '', '${oldSongName}')`);
        suneditor.insertHTML(data[arrangement][oldSongName]);
        document.body.style.overflow = "hidden";
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }).catch(err => {
        console.log(err);
    })
}

function editTextFromGroup(arrangement, groupName, oldSongName) {
    fetch('./static/custom_content.json').then(response => {
        return response.json();
    }).then(data => {
        var Form = document.getElementById("editSong");
        Form.style.display = "block";
        void Form.offsetWidth;
        Form.style.opacity = 1;

        var inputText = document.getElementById('new_song_name');
        inputText.value = oldSongName;
        var submitButton = document.getElementById('submitEditSong');
        submitButton.removeAttribute('onclick');
        submitButton.setAttribute('onclick', `submitEditSong('${arrangement}', '${groupName}', '${oldSongName}')`);
        var deleteGroupButton = document.getElementById('delete_song');
        deleteGroupButton.removeAttribute("onclick");
        deleteGroupButton.setAttribute('onclick', `deleteSong('${arrangement}', '${groupName}', '${oldSongName}')`);
        suneditor.insertHTML(data[arrangement][groupName][oldSongName]);
        document.body.style.overflow = "hidden";
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }).catch(err => {
        console.log(err);
    })
}

function closeEditSongForm() {
    suneditor.setContents('');
    document.body.style.overflow = "scroll";
    var Form = document.getElementById("editSong");
    Form.style.opacity = 0;
    Form.addEventListener("transitionend", function () {
        Form.style.display = "none";
    }, { once: true });
}

function submitEditSong(arrangement, groupName, oldSongName) {
    const song_content = suneditor.getContents();
    const newSongName = document.getElementById("new_song_name").value;
    const data = {
        arrangement: arrangement,
        groupName: groupName,
        oldSongName: oldSongName,
        newSongName: newSongName,
        songContent: song_content
    };

    fetch('/edit_song', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then(result => {
            console.log('Edit submitted successfully:', result);
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error submitting edit:', error);
        });
}

function sumbitAddNewSong(arrangement, groupName) {
    const song_content = document.getElementById("songTextArea").value;
    const songName = document.getElementById("new_song_name").value;
    const data = {
        arrangement: arrangement,
        groupName: groupName,
        songName: songName,
        songContent: song_content
    };

    fetch('/add_new_song', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then(result => {
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error submitting edit:', error);
        });
}

function deleteSong(arrangement, groupName, songName) {
    const song_content = document.getElementById("songTextArea").value;
    const newSongName = document.getElementById("new_song_name").value;
    const data = {
        arrangement: arrangement,
        groupName: groupName,
        songName: songName,
    };

    fetch('/delete_song', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
        .then(response => response.json())
        .then(result => {
            loadAllSongs();
            closeEditSongForm();
        })
        .catch(error => {
            console.error('Error submitting edit:', error);
        });
}

async function arrangementUploadFiles(arrangement) {
    try {
        const files = await openFileOrFiles(true);
        if (files && files.length > 0) {
            const formData = new FormData();
            formData.append('arrangement', arrangement);
            formData.append('group', '');

            files.forEach((file) => {
                formData.append('files', file);
            });

            const response = await fetch('http://10.11.2.76:5000/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                // const result = await response.json();
                Materialize.toast('Successfully uploaded files!', 3000)
                loadAllSongs();
            } else {
                console.error('Failed to upload files');
                Materialize.toast('Failed to upload files!', 6000)
            }
        }
    } catch (err) {
        console.log(err);
    }
}

function arrangementCreateGroup(arrangement) {
    var groupName = document.getElementById('group_name').value;
    if (groupName != "null" && groupName != "") {
        const apiUrl = `http://10.11.2.76:5000/create_group/${arrangement}/${groupName}`;
        fetch(apiUrl)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
            })
            .then(data => {
                Materialize.toast('Success!', 3000);
                setTimeout(function () {
                    closeForm("createGroup");
                }, 300);
                loadAllArrangements();
                loadAllSongs();
            })
            .catch(error => {
                console.error('Error:', error);
                Materialize.toast(error, 6000)
            });
    }
}


const openFileOrFiles = async (multiple = true) => {
    const supportsFileSystemAccess =
        "showOpenFilePicker" in window &&
        (() => {
            try {
                return window.self === window.top;
            } catch {
                return false;
            }
        })();

    if (supportsFileSystemAccess) {
        let fileOrFiles = undefined;
        try {
            const options = {
                multiple,
                types: [
                    {
                        description: 'Text Files',
                        accept: {
                            'text/plain': ['.txt'],
                        },
                    },
                ],
            };

            const handles = await showOpenFilePicker(options);

            if (!multiple) {
                fileOrFiles = await handles[0].getFile();
                fileOrFiles.handle = handles[0];
            } else {
                fileOrFiles = await Promise.all(
                    handles.map(async (handle) => {
                        const file = await handle.getFile();
                        file.handle = handle;
                        return file;
                    })
                );
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error(err.name, err.message);
            }
        }
        return fileOrFiles;
    }

    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.style.display = 'none';
        input.type = 'file';
        document.body.append(input);
        if (multiple) {
            input.multiple = true;
        }
        input.accept = '.txt'; // Set the accept attribute to only allow .txt files
        input.addEventListener('change', () => {
            input.remove();
            if (!input.files) {
                return;
            }
            const selectedFiles = Array.from(input.files);
            const txtFiles = selectedFiles.filter(file => file.name.endsWith('.txt'));
            resolve(multiple ? txtFiles : txtFiles[0]);
        });
        if ('showPicker' in HTMLInputElement.prototype) {
            input.showPicker();
        } else {
            input.click();
        }
    });
};

function loadAllArrangements() {
    const fetchDataJson = fetch('./static/data.json').then(response => {
        return response.json();
    });
    const fetchCustomContentJson = fetch('./static/custom_content.json').then(response => {
        return response.json();
    });
    Promise.all([fetchDataJson, fetchCustomContentJson])
        .then(([data, customContent]) => {
            const filesListContainer = document.getElementById('filesListContainer');
            var details_html = ""

            for (const [group, files] of Object.entries(data)) {
                details_html += `<details id='details-book'><summary><i class="material-icons" id="book-icon">book</i>${group}</summary><div id="${group}" style="overflow-y: scroll; max-height: 300px;"></div>`;
                for (const [groupName, groupData] of Object.entries(files)) {
                    if (typeof groupData == 'object' && groupData != null) {
                        details_html += `<details id='details-group'><summary><i class="material-icons" id="book-icon">library_books</i>${groupName}</summary><div id="${group}-${groupName}" style="overflow-y: scroll; max-height: 300px;"></div></details>`;
                    }
                }
                details_html += `</details>`;
            }
            details_html += `<br><h4>Custom Arrangements</h4>`;
            for (const [group, files] of Object.entries(customContent)) {
                if (!codeIsInCookies(group)) {
                    continue;
                }
                console.log("added group: " + group);
                details_html += `<details id='details-book'><summary><i class="material-icons" id="book-icon">book</i>${group}</summary><br><div id="${group}" style="overflow-y: scroll; max-height: 300px;"></div>`;
                for (const [groupName, groupData] of Object.entries(files)) {
                    console.log("added subgroup: " + groupName);
                    if (typeof groupData == 'object' && groupData != null) {
                        details_html += `<details id='details-group'><summary><i class="material-icons" id="book-icon">library_books</i>${groupName}</summary><br><div id="${group}-${groupName}" style="overflow-y: scroll; max-height: 300px;"></div></details>`;
                    }
                }
                details_html += `</details>`;
            }
            filesListContainer.innerHTML = details_html;
            populateCodeOptions();
        })
        .catch(err => {
            console.log(err);
        });
}

function loadAllSongs() {
    startLoading();
    const fetchDataJson = fetch('./static/data.json').then(response => {
        return response.json();
    });
    const fetchCustomContentJson = fetch('./static/custom_content.json').then(response => {
        return response.json();
    });
    Promise.all([fetchDataJson, fetchCustomContentJson])
        .then(([data, customContent]) => {
            for (const [group, files] of Object.entries(data)) {
                var details_arrangement = document.getElementById(group);
                let details_arrangements_html = ""
                for (const [groupName, groupData] of Object.entries(files)) {
                    if (typeof groupData === 'object' && groupData !== null) {
                        var details_group = document.getElementById(group + '-' + groupName);
                        let details_group_html = "";
                        for (const [fileName, fileData] of Object.entries(groupData)) {
                            var safeFileName = fileName.replace("\'", "\\'");
                            details_group_html += `<a class="waves-effect waves-light btn song" onclick="loadFileContentFromGroup('${group}', '${groupName}', '${safeFileName}')">${fileName}</a>`;
                        }
                        details_group.innerHTML = details_group_html;
                    } else {
                        var safeFileName = groupName.replace("\'", "\\'")
                        details_arrangements_html += `<a class="waves-effect waves-light btn song" onclick="loadFileContent('${group}', '${safeFileName}')">${groupName}</a>`;
                    }
                }
                details_arrangement.innerHTML = details_arrangements_html;
            }
            for (const [group, files] of Object.entries(customContent)) {
                if (!codeIsInCookies(group)) {
                    continue;
                }
                var details_arrangement = document.getElementById(group);
                console.log(details_arrangement, group);
                let details_arrangements_html = ""
                for (const [groupName, groupData] of Object.entries(files)) {
                    if (typeof groupData === 'object' && groupData !== null) {
                        var details_group = document.getElementById(group + '-' + groupName);
                        let details_group_html = "";
                        for (const [fileName, fileData] of Object.entries(groupData)) {
                            var safeFileName = fileName.replace("\'", "\\'")
                            if (navigator.onLine) {
                                details_group_html += `<ul style="display: inline-flex; margin: 0 15px 0 0" id="custonContentLayout">
                                                <a class="waves-effect waves-light btn song" onclick="loadFileCustomContentFromGroup('${group}', '${groupName}', '${safeFileName}')">${fileName}</a>
                                                <li><a class="btn-floating aqua" onclick="editTextFromGroup('${group}', '${groupName}', '${fileName}')"><i class="material-icons">mode_edit</i></a></li>
                                            </ul>`;
                            } else {
                                details_group_html += `<a class="waves-effect waves-light btn song" onclick="loadFileCustomContentFromGroup('${group}', '${groupName}', '${safeFileName}')">${fileName}</a>`;
                            }
                        }
                        if (navigator.onLine) {
                            details_group_html += `<div class="fixed-action-btn horizontal tool-bar click-to-toggle" id="addCustomContentButton">
                                            <a class="btn-floating btn-large aqua"><i class="large material-icons">more_horiz</i></a>
                                            <ul>
                                                <li><a class="btn-floating aqua" onclick="groupCreateFile('${group}', '${groupName}')"><i class="material-icons">insert_drive_file</i></a></li>
                                                <li><a class="btn-floating aqua" onclick="groupAddExistingSong('${group}', '${groupName}')"><i class="material-icons">library_add</i></a></li>
                                                <li><a class="btn-floating aqua" onclick="groupUploadFIles('${group}', '${groupName}')"><i class="material-icons">file_upload</i></a></li>
                                                <li><a class="btn-floating aqua" onclick="openForm('editGroup', '${group}', '${groupName}')"><i class="material-icons">mode_edit</i></a></li>
                                            </ul>
                                        </div>`
                        }
                        details_group.innerHTML = details_group_html;
                    } else {
                        var safeFileName = groupName.replace("\'", "\\'")
                        if (navigator.onLine) {
                            details_arrangements_html += `<ul style="display: inline-flex; margin: 0 15px 0 0" id="custonContentLayout">
                                            <a class="waves-effect waves-light btn song" onclick="loadFileCustomContent('${group}', '${safeFileName}')">${groupName}</a>
                                            <li><a class="btn-floating  aqua" onclick="editTextFromArrangement('${group}', '${groupName}')"><i class="material-icons">mode_edit</i></a></li>
                                        </ul>`;
                        } else {
                            details_arrangements_html += `<a class="waves-effect waves-light btn song" onclick="loadFileCustomContent('${group}', '${safeFileName}')">${groupName}</a>`;
                        }
                    }
                }
                if (navigator.onLine) {
                    details_arrangements_html += `<div class="fixed-action-btn horizontal tool-bar click-to-toggle" id="addCustomContentButton">
                                    <a class="btn-floating btn-large aqua"><i class="large material-icons">more_horiz</i></a>
                                    <ul>
                                        <li><a class="btn-floating aqua" onclick="arrangementCreateFile('${group}')"><i class="material-icons">insert_drive_file</i></a></li>
                                        <li><a class="btn-floating aqua" onclick="arrangementAddExistingSongs('${group}')"><i class="material-icons">library_add</i></a></li>
                                        <li><a class="btn-floating aqua" onclick="arrangementUploadFiles('${group}')"><i class="material-icons">file_upload</i></a></li>
                                        <li><a class="btn-floating aqua" onclick="openForm('createGroup', '${group}', '')"><i class="material-icons">create_new_folder</i></a></li>
                                        <li><a class="btn-floating aqua" onclick="openForm('editArrangement', '${group}', '')"><i class="material-icons">mode_edit</i></a></li>
                                    </ul>
        
                                </div>`
                }
                details_arrangement.innerHTML = details_arrangements_html;
            }
            stopLoading();
        })
        .catch(err => {
            console.log(err);
            stopLoading();
        });
}

function filterSongs() {
    startLoading();
    var searchText = document.getElementById('search').value.toLowerCase();
    var originalDetails = $("details");
    if (searchText) {
        isSearching = true;
        originalDetails.attr("open", true);
    } else {
        isSearching = false;
        originalDetails.removeAttr("open");
    }
    var homePage = $("#homePage");
    var originalSongButtons = $(".waves-effect.waves-light.btn.song");
    var noTextMessage = document.getElementById('noTextMessage')

    if (searchText != "") {
        if ($('#searchCheckbox').prop('checked')) {
            const fetchDataJson = fetch('./static/data.json').then(response => {
                return response.json();
            });
            const fetchCustomContentJson = fetch('./static/custom_content.json').then(response => {
                return response.json();
            });
            Promise.all([fetchDataJson, fetchCustomContentJson])
                .then(([data, customContent]) => {
                    var songs = [];
                    var jsonString = JSON.stringify(data, null, 8) + JSON.stringify(customContent, null, 8);
                    var regex = new RegExp(`(?:"|\')([^"]*)(?:"|\')(?=:)(?:\:\s*).{1,}${searchText}`, 'gmi');
                    var matches = jsonString.match(regex);
                    if (matches) {
                        for (var i = 0; i < matches.length; i++) {
                            var songName = matches[i].split("\": ")[0].trim().replace('\"', "").toLowerCase();
                            songs.push(songName.toString());
                        }
                    }
                    var filteredFiles = originalSongButtons.filter(function () {
                        var buttonText = $(this).text().toLowerCase().trim();
                        for (var song of songs) {
                            if (song.toLowerCase() === buttonText) {
                                return true;
                            }
                        }
                    });
                    originalSongButtons.hide();
                    filteredFiles.show();
                    originalDetails.each(function () {
                        var details = $(this);
                        var detailFilteredElements = details.find(".waves-effect.waves-light.btn").filter(function () {
                            return $(this).css("display") === "inline-block";
                        });
                        if (detailFilteredElements.length > 0) {
                            details.show();
                        } else {
                            details.hide();
                        }
                    });
                    var visibleBooks = homePage.find('details:visible').length;
                    if (visibleBooks === 0) {
                        noTextMessage.innerHTML = "<br>No songs found with this name"
                    } else {
                        noTextMessage.innerHTML = ""
                    }
                    stopLoading();
                }).catch(err => {
                    console.log(err);
                    return Promise.reject(err);
                });
        } else {
            var filteredFiles = originalSongButtons.filter(function () {
                return $(this).text().toLowerCase().includes(searchText);
            });

            originalSongButtons.hide();
            filteredFiles.show();
            originalDetails.each(function () {
                var details = $(this);
                var detailFilteredElements = details.find(".waves-effect.waves-light.btn").filter(function () {
                    return $(this).css("display") == "inline-block";
                });
                if (detailFilteredElements.length > 0) {
                    details.show();
                } else {
                    details.hide();
                }
            });
            var visibleBooks = homePage.find('details:visible').length;
            if (visibleBooks == 0) {
                noTextMessage.innerHTML = "<br>No songs found with this name"
            } else {
                noTextMessage.innerHTML = ""
            }
            stopLoading();
        }
    } else {
        originalDetails.show();
        originalSongButtons.show();
        stopLoading();
    }
}

var debounceTimer;
$(document).on("change", "#searchCheckbox", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
        filterSongs();
    }, 300);
});

$(document).on("input", "#search", function () {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
        filterSongs();
    }, 300);
});

$(document).on("input", "#navbarSearch", function () {
    var searchText = $('#navbarSearch').val().toLowerCase();
    var navbar = $("#navbarSongsList");
    var originalElements = navbar.find('.collection-item');

    if (searchText !== "") {
        var filteredElements = navbar.find(".collection-item").filter(function () {
            return $(this).text().toLowerCase().includes(searchText);
        });
        originalElements.hide();
        filteredElements.show();
    } else {
        originalElements.show();
    }
});

function addCode(event) {
    event.preventDefault();
    var codeName = document.getElementById('codeSelection');
    var selectedItems = [];
    for (var i = 0; i < codeName.options.length; i++) {
        if (codeName.options[i].selected) {
            selectedItems.push(codeName.options[i].value);
        }
    }
    const apiUrl = `http://10.11.2.76:5000/add_code/${selectedItems}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            console.log(data);
            setTimeout(function () {
                closeAddExistingCodeForm();
            }, 300);
            Materialize.toast('Success!', 3000);
            loadAllArrangements();
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function createLibrary(event) {
    event.preventDefault();
    var codeName = document.getElementById('code_name').value;
    var folderName = document.getElementById('folder_name').value;
    var private = document.getElementById('privateCheckbox').checked;
    const apiUrl = `http://10.11.2.76:5000/create_code/${codeName}/${folderName}/${private}`;
    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        })
        .then(data => {
            console.log(data);
            setTimeout(function () {
                closeCreateCodeForm();
            }, 300);
            populateCodeOptions();
            Materialize.toast('Success!', 3000)
            loadAllArrangements();
            loadAllSongs();
        })
        .catch(error => {
            console.error('Error:', error);
            Materialize.toast(error, 6000)
        });
}

function openForm(formName, arrangement, groupName) {
    if (formName == "editGroup") {
        var inputText = document.getElementById('new_group_name');
        inputText.value = groupName;
        var submitButton = document.getElementById('groupRenameSubmitButton');
        submitButton.removeAttribute('onclick');
        submitButton.setAttribute('onclick', `renameGroup('${arrangement}','${groupName}')`);
        var deleteGroupButton = document.getElementById('delete_group');
        deleteGroupButton.removeAttribute("onclick");
        deleteGroupButton.setAttribute('onclick', `deleteGroup('${arrangement}','${groupName}')`);
    } else if (formName == "editArrangement") {
        var inputText = document.getElementById('new_folder_name');
        inputText.value = arrangement;
        var codeInputText = document.getElementById('new_code_name');
        var oldCodeName = getCodeName(arrangement);
        codeInputText.value = oldCodeName;
        var submitButton = document.getElementById('arrangementRenameSubmitButton');
        submitButton.removeAttribute('onclick');
        submitButton.setAttribute('onclick', `renameArrangement('${arrangement}', '${oldCodeName}')`);
        var deleteGroupButton = document.getElementById('delete_arrangement');
        deleteGroupButton.removeAttribute("onclick");
        deleteGroupButton.setAttribute('onclick', `deleteArrangement('${arrangement}', '${oldCodeName}')`);
    } else if (formName == "createGroup") {
        var inputText = document.getElementById('group_name');
        inputText.value = "";
        var submitButton = document.getElementById('newGroupSubmitButton');
        submitButton.removeAttribute('onclick');
        submitButton.setAttribute('onclick', `arrangementCreateGroup('${arrangement}')`);
    }
    var Form = document.getElementById(formName);
    Form.style.display = "block";
    void Form.offsetWidth;
    Form.style.transform = "translate(-50%, -50%)";
    Form.style.opacity = 1;
}

function closeForm(formName) {
    var Form = document.getElementById(formName);
    Form.style.transform = "translate(-50%, 10%)";
    Form.style.opacity = 0;
    Form.addEventListener("transitionend", function () {
        Form.style.display = "none";
    }, { once: true });

}

function openAddExistingCodeForm() {
    if (document.getElementById("createCodeForm").style.display === "block") {
        closeCreateCodeForm();
    }
    var addExistingCodeForm = document.getElementById("addExistingCodeForm");
    addExistingCodeForm.style.display = "block";
    void addExistingCodeForm.offsetWidth;
    addExistingCodeForm.style.transform = "translate(-50%, -50%)";
    addExistingCodeForm.style.opacity = 1;

    $('#code-options').click();
}

function closeAddExistingCodeForm() {
    var addExistingCodeForm = document.getElementById("addExistingCodeForm");
    addExistingCodeForm.style.transform = "translate(-50%, 10%)";
    addExistingCodeForm.style.opacity = 0;
    addExistingCodeForm.addEventListener("transitionend", function () {
        addExistingCodeForm.style.display = "none";
    }, { once: true });
}

function openCreateCodeForm() {
    if (document.getElementById("addExistingCodeForm").style.display === "block") {
        closeAddExistingCodeForm();
    }
    var createCodeForm = document.getElementById("createCodeForm");
    createCodeForm.style.display = "block";
    void createCodeForm.offsetWidth;
    createCodeForm.style.transform = "translate(-50%, -50%)";
    createCodeForm.style.opacity = 1;

    $('#code-options').click();
}

function closeCreateCodeForm() {
    var createCodeForm = document.getElementById("createCodeForm");
    createCodeForm.style.transform = "translate(-50%, 10%)";
    createCodeForm.style.opacity = 0;
    createCodeForm.addEventListener("transitionend", function () {
        createCodeForm.style.display = "none";
    }, { once: true });
}

function calculateColumnCount() {
    var container = document.getElementById('text');
    var totalWidth = container.scrollWidth;
    var availableWidth = window.innerWidth;
    var columnCount = Math.floor((availableWidth - 250) / ((totalWidth + 50) / 4));
    container.style.columnCount = columnCount;
}

function loadFileContentFromGroup(book, group, song_name, reloadNavBar = true) {
    fetch('./static/data.json').then(response => {
        return response.json();
    }).then(data => {
        var formattedContent = data[book][group][song_name].replace(/\n/g, '<br>');
        $('#chapter-title').html(song_name);
        $('#text').html(formattedContent);
        $('#songPageNavBarTitle').html(song_name);
        if (reloadNavBar) {
            $('#navbarSearch').val("");
            document.getElementById('navbarArrangementName').innerText = book;
            var navbarSongsList = document.getElementById('navbarSongsList');
            var html = ""
            for (const [sub_group, files] of Object.entries(data[book])) {
                html += `<li class="collection-header"><h4>${sub_group}</h4></li>`
                for (const [songName, groupData] of Object.entries(files)) {
                    var safeFileName = songName.replace("\'", "\\'");
                    html += `<li><a class="collection-item" onclick="loadFileContentFromGroup('${book}', '${sub_group}', '${safeFileName}', false)">${songName}</a></li>`;
                }
            }
            navbarSongsList.innerHTML = html;
        }
        var navbarSongsList = $("#navbarSongsList");
        var filteredElements = navbarSongsList.find(".collection-item").filter(function () {
            $(this).removeClass('active');
        });
        var selectedElement = navbarSongsList.find('.collection-item:contains("' + song_name + '")');
        selectedElement.addClass("active");

        var keys = Object.keys(data[book][group]);
        var currentIndex = keys.indexOf(song_name);
        if (currentIndex !== -1 && currentIndex < keys.length - 1) {
            var nextSongName = keys[currentIndex + 1];
            var safeFileName = nextSongName.replace("\'", "\\'");
            $('#nextSongButton').removeClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
            $('#nextSongButton').attr('onclick', `loadFileContentFromGroup('${book}', '${group}', '${safeFileName}', false)`);
        } else {
            $('#nextSongButton').addClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
        }
        if (currentIndex !== -1 && currentIndex > 0) {
            var previousSongName = keys[currentIndex - 1];
            var safeFileName = previousSongName.replace("\'", "\\'");
            $('#previousSongButton').removeClass('disabled');
            $('#previousSongButton').removeAttr("onclick");
            $('#previousSongButton').attr('onclick', `loadFileContentFromGroup('${book}', '${group}', '${safeFileName}', false)`);
        } else {
            $('#previousSongButton').addClass('disabled');
            $('#previousSongButton').removeAttr("onclick");

        }
        showSongPage();
    }).catch(err => {
        console.log(err);
    })
}

function loadFileContent(book, song_name, reloadNavBar = true) {
    fetch('./static/data.json').then(response => {
        return response.json();
    }).then(data => {
        var formattedContent = data[book][song_name].replace(/\n/g, '<br>');
        $('#chapter-title').html(song_name);
        $('#text').html(formattedContent);
        $('#songPageNavBarTitle').html(song_name);
        if (reloadNavBar) {
            $('#navbarSearch').val("");
            document.getElementById('navbarArrangementName').innerText = book;
            var navbarSongsList = document.getElementById('navbarSongsList');
            var html = ""
            for (const [song, files] of Object.entries(data[book])) {
                var safeFileName = song.replace("\'", "\\'")
                html += `<li><a href="#!" class="collection-item" onclick="loadFileContent('${book}', '${safeFileName}', false)">${song}</a></li>`;
            }
            navbarSongsList.innerHTML = html;
        }
        var navbarSongsList = $("#navbarSongsList");
        var filteredElements = navbarSongsList.find(".collection-item").filter(function () {
            $(this).removeClass('active');
        });
        var selectedElement = navbarSongsList.find('.collection-item:contains("' + song_name + '")');
        selectedElement.addClass("active");

        var keys = Object.keys(data[book]);
        var currentIndex = keys.indexOf(song_name);
        if (currentIndex !== -1 && currentIndex < keys.length - 1) {
            var nextSongName = keys[currentIndex + 1];
            var safeFileName = nextSongName.replace("\'", "\\'");
            $('#nextSongButton').removeClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
            $('#nextSongButton').attr('onclick', `loadFileContent('${book}', '${safeFileName}', false)`);
        } else {
            $('#nextSongButton').addClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
        }
        if (currentIndex !== -1 && currentIndex > 0) {
            var previousSongName = keys[currentIndex - 1];
            var safeFileName = previousSongName.replace("\'", "\\'");
            $('#previousSongButton').removeClass('disabled');
            $('#previousSongButton').removeAttr("onclick");
            $('#previousSongButton').attr('onclick', `loadFileContent('${book}', '${safeFileName}', false)`);
        } else {
            $('#previousSongButton').addClass('disabled');
            $('#previousSongButton').removeAttr("onclick");

        }
        showSongPage();
    }).catch(err => {
        console.log(err);
    })
}

function loadFileCustomContent(book, song_name, reloadNavBar = true) {
    fetch('./static/custom_content.json').then(response => {
        return response.json();
    }).then(data => {
        var formattedContent = data[book][song_name].replace(/\n/g, '<br>');
        $('#chapter-title').html(song_name);
        $('#text').html(formattedContent);
        $('#songPageNavBarTitle').html(song_name);
        if (reloadNavBar) {
            $('#navbarSearch').val("");
            document.getElementById('navbarArrangementName').innerText = book;
            var navbarSongsList = document.getElementById('navbarSongsList');
            var html = ""
            for (const [song, files] of Object.entries(data[book])) {
                var safeFileName = song.replace("\'", "\\'")
                if (typeof files == 'string' && files != null) {
                    var safeFileName = song.replace("\'", "\\'");
                    html += `<li><a class="collection-item" onclick="loadFileCustomContent('${book}', '${safeFileName}', false)">${song}</a></li>`;
                } else {
                    html += `<li class="collection-header"><h4>${song}</h4></li>`
                }
            }
            navbarSongsList.innerHTML = html;
        }
        var navbarSongsList = $("#navbarSongsList");
        var filteredElements = navbarSongsList.find(".collection-item").filter(function () {
            $(this).removeClass('active');
        });
        var selectedElement = navbarSongsList.find('.collection-item:contains("' + song_name + '")');
        selectedElement.addClass("active");

        var keys = Object.keys(data[book]);
        var currentIndex = keys.indexOf(song_name);
        if (currentIndex !== -1 && currentIndex < keys.length - 1) {
            var nextSongName = keys[currentIndex + 1];
            var safeFileName = nextSongName.replace("\'", "\\'");
            $('#nextSongButton').removeClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
            $('#nextSongButton').attr('onclick', `loadFileCustomContent('${book}', '${safeFileName}', false)`);
        } else {
            $('#nextSongButton').addClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
        }
        if (currentIndex !== -1 && currentIndex > 0) {
            var previousSongName = keys[currentIndex - 1];
            var safeFileName = previousSongName.replace("\'", "\\'");
            $('#previousSongButton').removeClass('disabled');
            $('#previousSongButton').removeAttr("onclick");
            $('#previousSongButton').attr('onclick', `loadFileCustomContent('${book}', '${safeFileName}', false)`);
        } else {
            $('#previousSongButton').addClass('disabled');
            $('#previousSongButton').removeAttr("onclick");

        }
        showSongPage();
    }).catch(err => {
        console.log(err);
    })
}

function loadFileCustomContentFromGroup(book, group, song_name, reloadNavBar = true) {
    fetch('./static/custom_content.json').then(response => {
        return response.json();
    }).then(data => {
        var formattedContent = data[book][group][song_name].replace(/\n/g, '<br>');
        $('#chapter-title').html(song_name);
        $('#text').html(formattedContent);
        $('#songPageNavBarTitle').html(song_name);
        if (reloadNavBar) {
            $('#navbarSearch').val("");
            document.getElementById('navbarArrangementName').innerText = book;
            var navbarSongsList = document.getElementById('navbarSongsList');
            var html = ""
            for (const [sub_group, files] of Object.entries(data[book])) {
                html += `<li class="collection-header"><h4>${sub_group}</h4></li>`
                for (const [songName, groupData] of Object.entries(files)) {
                    if (typeof groupData == 'string' && groupData != null) {
                        var safeFileName = songName.replace("\'", "\\'");
                        html += `<li><a class="collection-item" onclick="loadFileCustomContentFromGroup('${book}', '${sub_group}', '${safeFileName}', false)">${songName}</a></li>`;
                    } else {
                        html += `<li class="collection-header"><h4>${sub_group}</h4></li>`
                    }
                }
            }
            navbarSongsList.innerHTML = html;
        }
        var navbarSongsList = $("#navbarSongsList");
        var filteredElements = navbarSongsList.find(".collection-item").filter(function () {
            $(this).removeClass('active');
        });
        var selectedElement = navbarSongsList.find('.collection-item:contains("' + song_name + '")');
        selectedElement.addClass("active");


        var keys = Object.keys(data[book][group]);
        var currentIndex = keys.indexOf(song_name);
        if (currentIndex !== -1 && currentIndex < keys.length - 1) {
            var nextSongName = keys[currentIndex + 1];
            var safeFileName = nextSongName.replace("\'", "\\'");
            $('#nextSongButton').removeClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
            $('#nextSongButton').attr('onclick', `loadFileCustomContentFromGroup('${book}', '${group}', '${safeFileName}', false)`);
        } else {
            $('#nextSongButton').addClass('disabled');
            $('#nextSongButton').removeAttr("onclick");
        }
        if (currentIndex !== -1 && currentIndex > 0) {
            var previousSongName = keys[currentIndex - 1];
            var safeFileName = previousSongName.replace("\'", "\\'");
            $('#previousSongButton').removeClass('disabled');
            $('#previousSongButton').removeAttr("onclick");
            $('#previousSongButton').attr('onclick', `loadFileCustomContentFromGroup('${book}', '${group}', '${safeFileName}', false)`);
        } else {
            $('#previousSongButton').addClass('disabled');
            $('#previousSongButton').removeAttr("onclick");

        }
        showSongPage();
    }).catch(err => {
        console.log(err);
    })
}

function startLoading() {
    $('#loader').show();
}

function stopLoading() {
    $('#loader').hide();
}

function showSongPage() {
    $('#homePage').hide();
    $('#songPage').show();
    calculateColumnCount();
}

function backToHomePage() {
    $('#homePage').show();
    $('#songPage').hide();
}

function userAgree() {
    localStorage.setItem('userAgreed', true);
    $('#modal1').hide();
}

document.addEventListener("DOMContentLoaded", function () {
    if (!localStorage.getItem('userAgreed')) {
        $('#modal1').show();
        $('#agreeButton').on('click', function () {
            localStorage.setItem('userAgreed', true);
            $('#modal1').hide();
        });

    }
    updateOnlineStatus();
    loadAllArrangements();
    loadAllSongs();
    $(".dropdown-button").dropdown();

    $('.home-button-collapse').sideNav({
        menuWidth: 300, // Default is 300
        edge: 'left', // Choose the horizontal origin
        closeOnClick: true, // Closes side-nav on <a> clicks, useful for Angular/Meteor
        draggable: true, // Choose whether you can drag to open on touch screens,
    }
    );
    $('.song-button-collapse').sideNav({
        menuWidth: 300, // Default is 300
        edge: 'left', // Choose the horizontal origin
        closeOnClick: true, // Closes side-nav on <a> clicks, useful for Angular/Meteor
        draggable: true, // Choose whether you can drag to open on touch screens,
    }
    );
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    window.addEventListener('resize', calculateColumnCount);
});
