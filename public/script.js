document.addEventListener('DOMContentLoaded', () => {
    const videoList = document.getElementById('video-list');
    const mainVideo = document.getElementById('main-video');
    const mainIframe = document.getElementById('main-iframe');
    const mainImage = document.getElementById('main-image');
    const placeholder = document.getElementById('placeholder');
    const videoTitle = document.getElementById('video-title');
    const videoStatus = document.getElementById('video-status');
    const breadcrumb = document.getElementById('breadcrumb');
    const backBtn = document.getElementById('back-btn');
    const mkdirBtn = document.getElementById('mkdir-btn');
    const appFooter = document.getElementById('app-footer');
    const mobileBrand = document.getElementById('mobile-brand-name');
    const sidebarBrand = document.getElementById('sidebar-brand-name');
    const contextMenuBrand = document.getElementById('context-menu-brand');
    const menuCopyright = document.getElementById('menu-copyright');
    const menuGithub = document.getElementById('menu-github');
    const menuTiktok = document.getElementById('menu-tiktok');
    const menuInstagram = document.getElementById('menu-instagram');

    // Fetch Config
    // Ensure loader is hidden on init
    const loaderInit = document.getElementById('video-loader');
    if (loaderInit) loaderInit.style.display = 'none';

    console.log('Fetching config...');
    fetch('/api/config')
        .then(res => res.json())
        .then(config => {
            if (config.appName) {
                document.title = config.appName;
                if (mobileBrand) mobileBrand.textContent = config.appName;
                if (sidebarBrand) sidebarBrand.textContent = config.appName;
                if (contextMenuBrand) contextMenuBrand.textContent = config.appName;
            }

            if (config.accentColor) {
                document.documentElement.style.setProperty('--accent-color', config.accentColor);
            }

            // Mouse Aura Logic
            document.addEventListener('mousemove', (e) => {
                const x = (e.clientX / window.innerWidth) * 100;
                const y = (e.clientY / window.innerHeight) * 100;
                document.body.style.setProperty('--mouse-x', `${x}%`);
                document.body.style.setProperty('--mouse-y', `${y}%`);
            });

            // Apply Social & Copyright
            if (menuCopyright) menuCopyright.textContent = config.copyrightText;
            if (menuGithub) {
                if (config.socialGithub) {
                    menuGithub.style.display = 'block';
                    menuGithub.onclick = () => window.open(config.socialGithub, '_blank');
                } else menuGithub.style.display = 'none';
            }
            if (menuTiktok) {
                if (config.socialTiktok) {
                    menuTiktok.style.display = 'block';
                    menuTiktok.onclick = () => window.open(config.socialTiktok, '_blank');
                } else menuTiktok.style.display = 'none';
            }
            if (menuInstagram) {
                if (config.socialInstagram) {
                    menuInstagram.style.display = 'block';
                    menuInstagram.onclick = () => window.open(config.socialInstagram, '_blank');
                } else menuInstagram.style.display = 'none';
            }

            // Apply Accent Color
            if (config.accentColor) {
                document.documentElement.style.setProperty('--accent-color', config.accentColor);
            }

            if (appFooter) {
                appFooter.textContent = config.footerText;
                appFooter.style.display = 'block';
            }

            // Handle Embed visibility
            if (!config.enableEmbed && window.location.pathname === '/embed') {
                document.body.innerHTML = '<div style="color: white; padding: 20px;">Embed mode is disabled by administrator.</div>';
            }
        })
        .catch(err => console.error('Error loading config:', err));

    // Recent Card Elements
    const recentPlayArea = document.getElementById('recent-play-area');
    const recentTitle = document.getElementById('recent-title');
    const recentProgress = document.getElementById('recent-progress');
    const resumeBtn = document.getElementById('resume-btn');
    const closeRecent = document.getElementById('close-recent');

    let currentPath = '';
    let currentRoot = 'public'; // 'public' or 'private'
    let selectedItems = new Set();
    let privatePassword = ''; // In-memory only
    let currentFiles = []; // Currently displayed playable files (filtered/sorted)
    let allFetchedFiles = []; // All files in current directory (raw)
    let currentIndex = -1; // Index of currently playing file
    let isLocked = false; // Lockeye state
    let isEmbedMode = false;
    let wakeLock = null;
    const urlParams = new URLSearchParams(window.location.search);

    const sourceVideoBtn = document.getElementById('source-video');
    const sourceLocalBtn = document.getElementById('source-local');
    const searchInput = document.getElementById('search-input');
    const uploadBtn = document.getElementById('upload-btn');
    const fileUploadInput = document.getElementById('file-upload');
    const passwordModal = document.getElementById('password-modal');
    const passwordInput = document.getElementById('private-password-input');
    const submitPasswordBtn = document.getElementById('submit-password');
    const closePasswordModal = document.getElementById('close-password-modal');

    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const mobileMenuOpen = document.getElementById('mobile-menu-open');
    const mobileMenuClose = document.getElementById('mobile-menu-close');

    mobileMenuOpen.onclick = () => {
        sidebar.classList.add('active');
        overlay.classList.add('active');
    };

    mobileMenuClose.onclick = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };

    overlay.onclick = () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    };

    function closeSidebarOnMobile() {
        if (window.innerWidth <= 992) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }
    }

    // Embed Mode Detection & Logic
    async function initEmbedMode() {
        const id = urlParams.get('id');
        const directUrl = urlParams.get('url');
        const title = urlParams.get('title') || 'External Media';

        if (id || directUrl) {
            isEmbedMode = true;
            document.body.classList.add('embed-mode');
            
            // UI Toggles
            document.querySelector('.source-switch').style.display = 'none';
            document.getElementById('breadcrumb').style.display = 'none';
            document.getElementById('mkdir-btn').style.display = 'none';
            document.getElementById('upload-btn').style.display = 'none';
            document.getElementById('back-btn').style.display = 'none';

            if (directUrl) {
                playEmbed(directUrl, title, id);
            } else if (id) {
                try {
                    const res = await fetch(`/api/embeds/${id}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.history && data.history.length > 0) {
                            playEmbed(data.history[0].url, data.history[0].title, id, false); // false = don't re-save immediately
                        }
                    } else {
                        videoTitle.textContent = 'Embed ID not found';
                    }
                } catch (e) {
                    console.error('Error fetching embed:', e);
                }
            }
            renderHistory();
        } else {
            fetchFiles();
        }
    }

    function playEmbed(url, title, id = null, saveToServer = true) {
        placeholder.style.display = 'none';
        mainImage.style.display = 'none';
        videoTitle.textContent = title;
        
        // Hide both initially
        mainVideo.style.display = 'none';
        mainIframe.style.display = 'none';

        const isDirectVideo = url.match(/\.(mp4|mkv|webm|mov|avi)(\?.*)?$/i);
        
        if (isDirectVideo) {
            mainVideo.style.display = 'block';
            mainVideo.src = url;
            mainVideo.play().catch(e => console.warn('Autoplay blocked'));
            document.getElementById('video-controls').style.display = 'flex';
        } else {
            mainIframe.style.display = 'block';
            mainIframe.src = url;
            document.getElementById('video-controls').style.display = 'none'; // Iframe has own controls
        }

        if (id && saveToServer) {
            addToHistory({ id, url, title });
        }
    }

    async function addToHistory(item) {
        if (!item.url || !item.id) return;
        
        // Save to Server (embeds.json)
        try {
            const res = await fetch('/api/embeds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, url: item.url, title: item.title })
            });
            if (res.ok && isEmbedMode) renderHistory();
        } catch (err) {
            console.error('Failed to save embed to server:', err);
        }
    }

    async function renderHistory() {
        const currentId = urlParams.get('id');
        if (!currentId) return;

        try {
            const res = await fetch(`/api/embeds/${currentId}`);
            if (!res.ok) return;
            const data = await res.json();
            const history = data.history || [];
            const query = searchInput.value.toLowerCase();
            
            // Filter by search query only (scoping is done by server via currentId)
            const filtered = history.filter(h => 
                h.title.toLowerCase().includes(query) || (h.id && h.id.toLowerCase().includes(query))
            );
            
            videoList.innerHTML = '';
            if (filtered.length === 0) {
                videoList.innerHTML = '<p style="padding: 20px; color: #94a3b8;">No history found on server.</p>';
                return;
            }

            filtered.forEach(item => {
                const li = document.createElement('li');
                li.className = 'video history-item';
                li.innerHTML = `
                    <div class="item-icon">🕒</div>
                    <div class="item-details">
                        <div class="item-title">${item.title}</div>
                        <div class="item-meta"><span>📺</span> ${currentId} <span style="margin: 0 4px; opacity: 0.3;">|</span> <span>📅</span> ${new Date(item.time).toLocaleDateString()}</div>
                    </div>
                `;
                li.onclick = () => playEmbed(item.url, item.title, currentId, true);
                videoList.appendChild(li);
            });
        } catch (e) {
            console.error('Error rendering history:', e);
        }
    }

    sourceVideoBtn.onclick = () => switchSource('public');
    sourceLocalBtn.onclick = () => switchSource('private');

    function switchSource(root) {
        if (currentRoot === root) return;
        
        if (root === 'private' && !privatePassword) {
            passwordModal.style.display = 'flex';
            passwordInput.focus();
            return;
        }

        currentRoot = root;
        sourceVideoBtn.classList.toggle('active', root === 'public');
        sourceLocalBtn.classList.toggle('active', root === 'private');

        // Apply restrictions
        mkdirBtn.classList.toggle('private-hidden', root === 'private');
        backBtn.classList.toggle('private-hidden', root === 'private');

        closeSidebarOnMobile();
        fetchFiles('');
    }

    submitPasswordBtn.onclick = () => {
        privatePassword = passwordInput.value;
        passwordModal.style.display = 'none';
        passwordInput.value = '';
        currentRoot = 'private'; // Set it anyway to try
        sourceVideoBtn.classList.remove('active');
        sourceLocalBtn.classList.add('active');
        
        // Apply restrictions immediately
        mkdirBtn.classList.add('private-hidden');
        backBtn.classList.add('private-hidden');
        
        fetchFiles('');
    };

    closePasswordModal.onclick = () => {
        passwordModal.style.display = 'none';
    };

    function getAuthHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (currentRoot === 'private') headers['x-private-password'] = privatePassword;
        return headers;
    }

    // Modal Helpers
    const confirmModal = document.getElementById('confirm-modal');
    const inputModal = document.getElementById('input-modal');
    const genericInput = document.getElementById('generic-input');

    function showConfirm(title, message, callback) {
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        confirmModal.style.display = 'flex';
        
        document.getElementById('confirm-yes').onclick = () => {
            confirmModal.style.display = 'none';
            callback();
        };
        document.getElementById('confirm-no').onclick = () => {
            confirmModal.style.display = 'none';
        };
    }

    function showPrompt(title, message, callback, type = 'text', defaultValue = '') {
        document.getElementById('input-title').textContent = title;
        document.getElementById('input-message').textContent = message;
        genericInput.type = type;
        genericInput.value = defaultValue;
        inputModal.style.display = 'flex';
        genericInput.focus();

        const handleSave = () => {
            const val = genericInput.value;
            inputModal.style.display = 'none';
            callback(val);
        };

        document.getElementById('input-save').onclick = handleSave;
        document.getElementById('input-cancel').onclick = () => {
            inputModal.style.display = 'none';
        };
        genericInput.onkeydown = (e) => { if(e.key === 'Enter') handleSave(); };
    }

    // Danger Alert Logic
    const dangerModal = document.getElementById('danger-modal');
    const dangerRetryBtn = document.getElementById('danger-retry-btn');

    function showDangerAlert() {
        dangerModal.style.display = 'flex';
        // Re-trigger animation
        const content = dangerModal.querySelector('.danger-content');
        content.style.animation = '€none';
        content.offsetHeight; /* trigger reflow */
        content.style.animation = null; 
    }

    dangerRetryBtn.onclick = () => {
        dangerModal.style.display = 'none';
        // If we were trying to access private, maybe switch back or prompt again
        // For now, just close it.
        if (currentRoot === 'private') {
            passwordModal.style.display = 'flex';
            passwordInput.focus();
        }
    };

    // Sorting State
    // Sorting State
    let currentSort = 'name';
    const sortToggleBtn = document.getElementById('sort-toggle-btn');
    const sortMenuDropdown = document.getElementById('sort-menu-dropdown');
    const sortOptions = document.querySelectorAll('.dropdown-item');

    sortToggleBtn.onclick = (e) => {
        e.stopPropagation();
        const isVisible = sortMenuDropdown.style.display === 'flex';
        sortMenuDropdown.style.display = isVisible ? 'none' : 'flex';
    };

    sortOptions.forEach(option => {
        option.onclick = () => {
            currentSort = option.dataset.sort;
            
            // Update UI
            sortOptions.forEach(opt => opt.classList.remove('active'));
            option.classList.add('active');
            
            
            sortMenuDropdown.style.display = 'none';
            // Trigger re-render with current sort
            renderFileList(allFetchedFiles);
        };
    });

    document.addEventListener('click', (e) => {
        if (!sortToggleBtn.contains(e.target) && !sortMenuDropdown.contains(e.target)) {
            sortMenuDropdown.style.display = 'none';
        }
    });

    // Helper: Human-readable size
    function formatSize(bytes) {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    // Fetch files from API
    async function fetchFiles(path = '') {
        currentPath = path;
        breadcrumb.textContent = (currentRoot === 'private' ? 'private / ' : 'public / ') + path;
        videoList.innerHTML = '<div class="loader"></div>';
        selectedItems.clear();
        updateSelectionUI();
        
        try {
            const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}&root=${currentRoot}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok && response.status !== 401) {
                throw new Error(`Server returned ${response.status}`);
            }


            if (response.status === 401) {
                showDangerAlert();
                privatePassword = '';
                return;
            }

            const files = await response.json();
            allFetchedFiles = files;
            renderFileList(allFetchedFiles);

        } catch (error) {
            console.error('Error fetching files:', error);
            videoList.innerHTML = '<p style="padding: 20px; color: #ef4444;">Error loading files.</p>';
        }
    }

    // Render Logic (Extracted for Search)
    function renderFileList(files) {
        
        // Sorting (apply currentSort to the subset provided)
        files.sort((a, b) => {
            if (a.type === 'directory' && b.type !== 'directory') return -1;
            if (a.type !== 'directory' && b.type === 'directory') return 1;

            if (currentSort === 'name') {
                return a.name.localeCompare(b.name);
            } else if (currentSort === 'date') {
                return new Date(b.mtime) - new Date(a.mtime);
            } else if (currentSort === 'size') {
                return (b.size || 0) - (a.size || 0);
            } else if (currentSort === 'type') {
                return a.type.localeCompare(b.type);
            }
            return 0;
        });

        // Update playlist context
        currentFiles = files.filter(f => f.type !== 'directory');
        
        videoList.innerHTML = '';
        
        if (files.length === 0) {
            videoList.innerHTML = '<p style="padding: 20px; color: #94a3b8;">No items found.</p>';
            return;
        }

        files.forEach((file) => {
            const li = document.createElement('li');
            const ext = file.name.split('.').pop().toLowerCase();
            li.className = `${file.type} ${ext}`;
            li.dataset.path = file.path;
            li.dataset.type = file.type;
            
            if (selectedItems.has(file.path)) li.classList.add('selected');
            
            // Rich Icon Area
            const iconDiv = document.createElement('div');
            iconDiv.className = 'item-icon';
            if (file.type === 'image') {
                iconDiv.style.backgroundImage = `url("${file.url}")`;
                iconDiv.style.backgroundSize = 'cover';
                iconDiv.style.backgroundPosition = 'center';
                iconDiv.textContent = '';
            } else {
                const emojiMap = { 
                    'directory': '📂', 
                    'video': '📹', 
                    'image': '🖼️', 
                    'file': '📝' 
                };
                iconDiv.textContent = emojiMap[file.type] || '📝';
            }
            li.appendChild(iconDiv);

            // Info Area
            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'item-details';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'item-title';
            titleDiv.textContent = file.name;
            detailsDiv.appendChild(titleDiv);

            const metaDiv = document.createElement('div');
            metaDiv.className = 'item-meta';
            if (file.type === 'directory') {
                metaDiv.innerHTML = `<span>📂</span> ${file.itemCount || 0} items`;
            } else {
                metaDiv.innerHTML = `<span>💾</span> ${formatSize(file.size)} <span style="margin: 0 4px; opacity: 0.3;">|</span> <span>✨</span> ${ext.toUpperCase()}`;
            }
            detailsDiv.appendChild(metaDiv);
            li.appendChild(detailsDiv);

            li.addEventListener('click', (e) => {

                if (selectedItems.size > 0) {
                    const isSelected = !selectedItems.has(file.path);
                    toggleSelect(file.path, isSelected, li);
                } else {
                    if (file.type === 'directory') {
                        fetchFiles(file.path);
                        searchInput.value = ''; // Clear search on nav
                    } else if (file.type === 'video') {
                        playVideo(file, li);
                        closeSidebarOnMobile();
                    } else if (file.type === 'image') {
                        showImage(file, li);
                        closeSidebarOnMobile();
                    } else {
                        showFilePlaceholder(file, li);
                        closeSidebarOnMobile();
                    }
                }
            });

            // Context Menu
            li.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                showContextMenu(e.clientX, e.clientY, file);
            });
            
            // Touch Support
            let pressTimer;
            li.addEventListener('touchstart', (e) => {
                pressTimer = setTimeout(() => {
                    showContextMenu(e.touches[0].clientX, e.touches[0].clientY, file);
                    toggleSelect(file.path, true, li);
                }, 600);
            });
            li.addEventListener('touchend', () => clearTimeout(pressTimer));
            
            videoList.appendChild(li);
        });
    }

    // Search Logic (Global)
    let searchDebounce;
    searchInput.oninput = () => {
        const query = searchInput.value.trim();
        clearTimeout(searchDebounce);

        if (isEmbedMode) {
            renderHistory();
            return;
        }

        if (query.length === 0) {
            // Revert to current path browsing
            fetchFiles(currentPath);
            return;
        }

        searchDebounce = setTimeout(async () => {
            breadcrumb.textContent = `Searching: "${query}"`;
            videoList.innerHTML = '<div class="loader"></div>';
            
            try {
                const response = await fetch(`/api/search?query=${encodeURIComponent(query)}&root=${currentRoot}`, {
                    headers: getAuthHeaders()
                });
                if (!response.ok) throw new Error('Search failed');
                
                const files = await response.json();
                
                // Sort search results (optional default sort)
                files.sort((a, b) => a.name.localeCompare(b.name));
                
                // We don't update allFetchedFiles here because this is a special view
                currentFiles = files;
                renderFileList(files);
            } catch (err) {
                console.error(err);
                videoList.innerHTML = '<p style="padding: 20px; color: #ef4444;">Search failed.</p>';
            }
        }, 400); // 400ms delay
    };

    // Selection Logic
    function toggleSelect(path, isSelected, element) {
        if (isSelected) {
            selectedItems.add(path);
            element.classList.add('selected');
        } else {
            selectedItems.delete(path);
            element.classList.remove('selected');
        }
        updateSelectionUI();
    }

    function updateSelectionUI() {
        const toolbar = document.getElementById('selection-toolbar');
        const countSpan = document.getElementById('selected-count');
        
        if (selectedItems.size > 0) {
            toolbar.style.display = 'flex';
            countSpan.innerHTML = `
                <span class="count-number">(${selectedItems.size})</span>
                <span class="count-label">selected</span>
            `;
        } else {
            toolbar.style.display = 'none';
        }
    }

    const toolbarSelectAll = document.getElementById('toolbar-select-all');

    toolbarSelectAll.onclick = () => {
        const items = videoList.querySelectorAll('li');
        items.forEach(li => {
            const path = li.dataset.path;
            if (!selectedItems.has(path)) {
                selectedItems.add(path);
                li.classList.add('selected');
            }
        });
        updateSelectionUI();
    };

    // Click Background to Clear Selection
    videoList.onclick = (e) => {
        if (e.target === videoList) {
            selectedItems.clear();
            const items = videoList.querySelectorAll('li');
            items.forEach(li => li.classList.remove('selected'));
            updateSelectionUI();
        }
    };

    // Upload Logic with Progress
    const uploadModal = document.getElementById('upload-modal');
    const uploadProgressBar = document.getElementById('upload-progress-bar');
    const uploadStatusText = document.getElementById('upload-status-text');

    uploadBtn.onclick = () => fileUploadInput.click();

    fileUploadInput.onchange = () => {
        const files = fileUploadInput.files;
        if (files.length === 0) return;

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        formData.append('path', currentPath);
        formData.append('root', currentRoot);
        if (currentRoot === 'private') {
            formData.append('password', privatePassword);
        }

        // Show Progress Modal
        uploadModal.style.display = 'flex';
        uploadProgressBar.style.width = '0%';
        uploadStatusText.textContent = '0%';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/upload', true);

        // Progress Handler
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                uploadProgressBar.style.width = `${percentComplete}%`;
                uploadStatusText.textContent = `${percentComplete}%`;
            }
        };

        // Complete Handler
        xhr.onload = () => {
            uploadModal.style.display = 'none';
            fileUploadInput.value = ''; // Reset

            if (xhr.status === 200) {
                fetchFiles(currentPath);
                // Optional: success toast instead of alert blocking
            } else {
                if (xhr.status === 401) {
                    showDangerAlert();
                } else {
                    alert('Upload failed: ' + xhr.statusText);
                }
            }
        };

        xhr.onerror = () => {
            uploadModal.style.display = 'none';
            fileUploadInput.value = '';
            alert('Upload error (Network)');
        };

        xhr.send(formData);
    };

    // Batch CRUD
    document.getElementById('batch-delete').onclick = () => {
        if (selectedItems.size === 0) return;
        showConfirm('Delete Multiple', `Delete ${selectedItems.size} items?`, async () => {
            const res = await fetch('/api/delete', {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ paths: Array.from(selectedItems), root: currentRoot })
            });
            if (res.ok) fetchFiles(currentPath);
            else alert('Failed to delete items');
        });
    };

    // Folder Picker Logic
    const modal = document.getElementById('folder-picker-modal');
    const folderListModal = document.getElementById('modal-folder-list');
    const pickerBreadcrumb = document.getElementById('picker-breadcrumb');
    const moveHereBtn = document.getElementById('move-here-btn');
    const closeModal = document.getElementById('close-modal');

    let pickerPath = '';
    let moveTargetItems = []; // Array of { from: string }

    function openFolderPicker(items) {
        moveTargetItems = items;
        pickerPath = '';
        modal.style.display = 'flex';
        fetchPickerFolders('');
    }

    async function fetchPickerFolders(path) {
        pickerPath = path;
        pickerBreadcrumb.textContent = (currentRoot === 'local' ? 'local / ' : 'video / ') + path;
        folderListModal.innerHTML = '<div class="loader"></div>';

        try {
            const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}&root=${currentRoot}`);
            const files = await response.json();
            
            folderListModal.innerHTML = '';
            
            // Add ".." option to go back
            if (path !== '') {
                const li = document.createElement('li');
                li.textContent = '.. (Back)';
                li.onclick = () => {
                    const parts = path.split('/');
                    parts.pop();
                    fetchPickerFolders(parts.join('/'));
                };
                folderListModal.appendChild(li);
            }

            files.filter(f => f.type === 'directory').forEach(folder => {
                const li = document.createElement('li');
                li.textContent = folder.name;
                li.onclick = () => fetchPickerFolders(folder.path);
                folderListModal.appendChild(li);
            });

        } catch (error) {
            folderListModal.innerHTML = 'Error loading folders.';
        }
    }

    moveHereBtn.onclick = async () => {
        if (moveTargetItems.length === 0) return;

        // Show loading modal
        uploadModal.style.display = 'flex';
        uploadProgressBar.style.width = '0%';
        uploadStatusText.textContent = 'Moving files...';
        uploadProgressBar.style.width = '50%';

        const res = await fetch('/api/move', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ to: pickerPath, items: moveTargetItems, root: currentRoot })
        });

        uploadProgressBar.style.width = '100%';
        setTimeout(() => {
            uploadModal.style.display = 'none';
            
            if (res.ok) {
                modal.style.display = 'none';
                selectedItems.clear();
                updateSelectionUI();
                fetchFiles(currentPath);
            } else {
                alert('Failed to move items');
            }
        }, 300);
    };

    closeModal.onclick = () => modal.style.display = 'none';

    // Batch Move Action
    document.getElementById('batch-move').onclick = () => {
        if (selectedItems.size === 0) return;
        const items = Array.from(selectedItems).map(path => ({ from: path }));
        openFolderPicker(items);
    };


    // Context Menu Logic
    const contextMenu = document.getElementById('context-menu');
    const globalContextMenu = document.getElementById('global-context-menu');
    let rightClickedItem = null;

    const crossMoveBtn = document.getElementById('menu-cross-move');

    function showContextMenu(x, y, file) {
        rightClickedItem = file;
        contextMenu.style.display = 'block';
        contextMenu.style.visibility = 'hidden'; // Hide to calculate
        globalContextMenu.style.display = 'none';

        // Selection Toggle Text
        const selectBtn = document.getElementById('menu-select-toggle');
        selectBtn.textContent = selectedItems.has(file.path) ? 'Deselect' : 'Select';

        // Cross-Move logic
        crossMoveBtn.textContent = currentRoot === 'public' ? 'Make Private' : 'Make Public';

        // Smart Positioning
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let posX = x;
        let posY = y;

        if (x + menuWidth > winWidth) posX = x - menuWidth;
        if (y + menuHeight > winHeight) posY = y - menuHeight;

        // Final Bounds Check (just in case)
        posX = Math.max(10, Math.min(posX, winWidth - menuWidth - 10));
        posY = Math.max(10, Math.min(posY, winHeight - menuHeight - 10));

        contextMenu.style.left = `${posX}px`;
        contextMenu.style.top = `${posY}px`;
        contextMenu.style.visibility = 'visible';
    }

    function showGlobalContextMenu(x, y) {
        globalContextMenu.style.display = 'block';
        globalContextMenu.style.visibility = 'hidden';
        contextMenu.style.display = 'none';

        const menuWidth = globalContextMenu.offsetWidth;
        const menuHeight = globalContextMenu.offsetHeight;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let posX = x;
        let posY = y;

        if (x + menuWidth > winWidth) posX = x - menuWidth;
        if (y + menuHeight > winHeight) posY = y - menuHeight;

        posX = Math.max(10, Math.min(posX, winWidth - menuWidth - 10));
        posY = Math.max(10, Math.min(posY, winHeight - menuHeight - 10));

        globalContextMenu.style.left = `${posX}px`;
        globalContextMenu.style.top = `${posY}px`;
        globalContextMenu.style.visibility = 'visible';
    }

    document.addEventListener('click', (e) => {
        if (!contextMenu.contains(e.target)) contextMenu.style.display = 'none';
        if (!globalContextMenu.contains(e.target)) globalContextMenu.style.display = 'none';
    });

    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('li')) {
            e.preventDefault();
            showGlobalContextMenu(e.pageX, e.pageY);
        }
    });

    document.getElementById('menu-select-toggle').onclick = () => {
        if (!rightClickedItem) return;
        const li = videoList.querySelector(`li[data-path="${rightClickedItem.path}"]`);
        const isSelected = !selectedItems.has(rightClickedItem.path);
        toggleSelect(rightClickedItem.path, isSelected, li);
        contextMenu.style.display = 'none';
    };

    crossMoveBtn.onclick = async () => {
        if (!rightClickedItem) return;
        contextMenu.style.display = 'none';
        const targetRoot = currentRoot === 'public' ? 'private' : 'public';
        
        showPrompt(
            `Move to ${targetRoot.toUpperCase()}`,
            `Enter password to move "${rightClickedItem.name}":`,
            async (password) => {
                if (!password) return;
                
                // Show loading modal
                uploadModal.style.display = 'flex';
                uploadProgressBar.style.width = '0%';
                uploadStatusText.textContent = 'Processing...';
                
                // Animate progress bar (indeterminate style)
                uploadProgressBar.style.width = '50%';
                
                const res = await fetch('/api/cross-move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fromPath: rightClickedItem.path,
                        fromRoot: currentRoot,
                        toRoot: targetRoot,
                        password: password
                    })
                });

                uploadProgressBar.style.width = '100%';
                setTimeout(() => {
                    uploadModal.style.display = 'none';
                    
                    if (res.ok) {
                        fetchFiles(currentPath);
                    } else if (res.status === 401) {
                        showDangerAlert();
                    } else {
                        alert('Action failed: Invalid Password.');
                    }
                }, 300);
            },
            'password'
        );
    };

    document.getElementById('menu-info').onclick = () => {
        contextMenu.style.display = 'none'; // Auto-hide
        if (rightClickedItem) fetchDetailedInfo(rightClickedItem);
    };

    async function fetchDetailedInfo(file) {
        const modal = document.getElementById('info-modal');
        const body = document.getElementById('info-modal-body');
        body.innerHTML = '<div class="loader"></div>';
        modal.style.display = 'flex';

        try {
            const resp = await fetch(`/api/info?path=${encodeURIComponent(file.path)}&root=${currentRoot}`, {
                headers: getAuthHeaders()
            });
            const info = await resp.json();
            
            const formatDate = (d) => new Date(d).toLocaleString();
            const formatSize = (s) => (s / (1024 * 1024)).toFixed(2) + ' MB';

            body.innerHTML = `
                <table class="info-table">
                    <tr><td>Name</td><td>${info.name}</td></tr>
                    <tr><td>Size</td><td>${formatSize(info.size)}</td></tr>
                    <tr><td>Extension</td><td>${info.extension}</td></tr>
                    <tr><td>Created</td><td>${formatDate(info.created)}</td></tr>
                    <tr><td>Modified</td><td>${formatDate(info.modified)}</td></tr>
                    <tr><td>Accessed</td><td>${formatDate(info.accessed)}</td></tr>
                    <tr><td>Location</td><td>${info.fullPath}</td></tr>
                </table>
            `;
        } catch (err) {
            body.innerHTML = '<p style="color:#ef4444;">Error loading details.</p>';
        }
    }

    document.getElementById('close-info-modal').onclick = () => {
        document.getElementById('info-modal').style.display = 'none';
    };

    // Rename Modal Logic
    const renameModal = document.getElementById('rename-modal');
    const renameInput = document.getElementById('rename-input');
    const saveRenameBtn = document.getElementById('save-rename');
    const closeRenameModal = document.getElementById('close-rename-modal');

    document.getElementById('menu-rename').onclick = () => {
        contextMenu.style.display = 'none';
        if (!rightClickedItem) return;
        renameInput.value = rightClickedItem.name;
        renameModal.style.display = 'flex';
        renameInput.focus();
    };

    saveRenameBtn.onclick = async () => {
        const newName = renameInput.value;
        if (!newName || newName === rightClickedItem.name) {
            renameModal.style.display = 'none';
            return;
        }

        const oldPath = rightClickedItem.path;
        const dir = oldPath.split('/');
        dir.pop();
        const newPath = dir.length > 0 ? `${dir.join('/')}/${newName}` : newName;

        const res = await fetch('/api/move', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ from: oldPath, to: newPath, root: currentRoot })
        });

        if (res.ok) {
            renameModal.style.display = 'none';
            fetchFiles(currentPath);
        } else {
            alert('Failed to rename');
        }
    };

    closeRenameModal.onclick = () => renameModal.style.display = 'none';

    document.getElementById('menu-move-to').onclick = () => {
        contextMenu.style.display = 'none';
        if (rightClickedItem) {
            openFolderPicker([{ from: rightClickedItem.path }]);
        }
    };

    document.getElementById('menu-delete').onclick = () => {
        contextMenu.style.display = 'none';
        if (rightClickedItem) deleteItem(rightClickedItem.path);
    };


    function playVideo(file, element, startTime = 0) {
        currentIndex = currentFiles.findIndex(f => f.path === file.path);
        
        // If element is not provided, try to find it in the current list
        if (!element && file.path) {
            element = videoList.querySelector(`li[data-path="${file.path}"]`);
        }
        
        highlightItem(element);
        placeholder.style.display = 'none';
        mainImage.style.display = 'none';
        mainVideo.style.display = 'block';
        document.getElementById('video-controls').style.display = 'flex';
        
        mainVideo.src = file.url;
        mainVideo.load();

        if (startTime > 0) {
            mainVideo.onloadedmetadata = () => {
                mainVideo.currentTime = startTime;
                mainVideo.play();
                mainVideo.onloadedmetadata = null;
            };
        } else {
            mainVideo.play();
        }

        videoTitle.textContent = file.name;
        videoStatus.textContent = startTime > 0 ? `Resuming from ${formatTime(startTime)}...` : 'Playing video...';
        
        resetControls();
        recentPlayArea.style.display = 'none';
    }

    function saveVideoProgress() {
        // STRICT CHECK: Never save history for private files
        if (currentRoot === 'private') return;
        if (!mainVideo.src || mainVideo.paused) return;
        
        const data = {
            name: videoTitle.textContent,
            url: mainVideo.src,
            time: mainVideo.currentTime,
            duration: mainVideo.duration,
            path: currentFiles[currentIndex]?.path
        };
        localStorage.setItem('mplayer_recent', JSON.stringify(data));
    }

    function showImage(file, element) {
        currentIndex = currentFiles.findIndex(f => f.path === file.path);
        highlightItem(element);
        placeholder.style.display = 'none';
        mainVideo.style.display = 'none';
        mainVideo.pause();
        document.getElementById('video-controls').style.display = 'none';
        // Ensure loader is hidden
        document.getElementById('video-loader').style.display = 'none';
        
        mainImage.style.display = 'block';
        
        mainImage.src = file.url;
        videoTitle.textContent = file.name;
        videoStatus.textContent = 'Viewing image...';
    }



    function showFilePlaceholder(file, element) {
        currentIndex = currentFiles.findIndex(f => f.path === file.path);
        highlightItem(element);
        mainVideo.style.display = 'none';
        mainVideo.pause();
        mainImage.style.display = 'none';
        document.getElementById('video-controls').style.display = 'none';
        // Ensure loader is hidden
        document.getElementById('video-loader').style.display = 'none';
        placeholder.style.display = 'flex';
        
        placeholder.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 4rem; margin-bottom: 20px;">📄</div>
                <h3 style="margin-bottom: 10px;">${file.name}</h3>
                <p style="color: #94a3b8; margin-bottom: 20px;">This file type doesn't have a direct preview.</p>
            </div>
        `;
        
        videoTitle.textContent = file.name;
        videoStatus.textContent = 'File info';
    }

    // Custom Controls Logic
    const playPauseBtn = document.getElementById('play-pause');
    const progressBar = document.getElementById('progress-bar');
    const progressFilled = document.getElementById('progress-filled');
    const timeDisplay = document.getElementById('time-display');
    const volumeSlider = document.getElementById('volume-slider');
    const muteToggle = document.getElementById('mute-toggle');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const lockeyeBtn = document.getElementById('lockeye-btn');
    const mediaContainer = document.getElementById('media-container');
    const nextBtn = document.getElementById('next-btn');
    const prevBtn = document.getElementById('prev-btn');
    const infoNext = document.getElementById('info-next');
    const infoPrev = document.getElementById('info-prev');
    const videoControls = document.getElementById('video-controls');
    let controlsTimer;

    function showControls() {
        if (isLocked) {
            // Even when locked, ensure container is visible for the ghost-lock-btn
            videoControls.classList.add('visible');
            return;
        }
        videoControls.classList.add('visible');
        videoControls.style.opacity = '1';
        videoControls.style.transform = 'translateY(0)';
        mediaContainer.style.cursor = 'default';
        
        clearTimeout(controlsTimer);
        controlsTimer = setTimeout(() => {
            if (!mainVideo.paused && document.fullscreenElement) {
                hideControls();
            }
        }, 3000);
    }

    function hideControls() {
        if (isLocked) return; // Never hide the container when locked (CSS handles item hiding)
        
        videoControls.classList.remove('visible');
        videoControls.style.opacity = '0';
        videoControls.style.transform = 'translateY(10px)';
        if (document.fullscreenElement) {
            mediaContainer.style.cursor = 'none';
        }
    }

    mediaContainer.onmousemove = showControls;
    mediaContainer.onclick = showControls;

    lockeyeBtn.onclick = () => {
        if (!document.fullscreenElement) {
            showConfirm('Lockeye', 'Lockeye only works in Fullscreen mode. Enter Fullscreen?', () => {
                mediaContainer.requestFullscreen().catch(() => {});
            });
            return;
        }
        setLock(!isLocked);
    };

    async function setLock(locked) {
        isLocked = locked;
        mediaContainer.classList.toggle('locked-ui', locked);
        lockeyeBtn.textContent = locked ? '🔓' : '🔒';
        
        if (locked) {
            hideControls();
            
            // Try to lock keyboard (Desktop)
            if (navigator.keyboard && navigator.keyboard.lock && document.fullscreenElement) {
                navigator.keyboard.lock(['Escape']).catch(() => {});
            }

            // Screen Wake Lock (Mobile)
            if ('wakeLock' in navigator) {
                try {
                    wakeLock = await navigator.wakeLock.request('screen');
                } catch (err) {
                    console.error(`${err.name}, ${err.message}`);
                }
            }
        } else {
            showControls();
            
            // Unlock keyboard
            if (navigator.keyboard && navigator.keyboard.unlock) {
                navigator.keyboard.unlock();
            }

            // Release Wake Lock
            if (wakeLock !== null) {
                wakeLock.release().then(() => { wakeLock = null; });
            }
        }
    }

    // Auto-Rotate & Orientation Lock Logic
    function handleResize() {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);
        if (isMobile && !mainVideo.paused && !document.fullscreenElement) {
            if (window.innerWidth > window.innerHeight) {
                // Device rotated to landscape while playing
                mediaContainer.requestFullscreen().catch(() => {});
            }
        }
    }
    window.addEventListener('resize', handleResize);

    // Reset lock when exiting fullscreen
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            // Entered Fullscreen
            const isMobile = /Mobi|Android/i.test(navigator.userAgent);
            if (isMobile && screen.orientation && screen.orientation.lock) {
                screen.orientation.lock('landscape').catch(() => {});
            }
        } else {
            // Exited Fullscreen
            if (isLocked) setLock(false);
            if (navigator.keyboard && navigator.keyboard.unlock) {
                navigator.keyboard.unlock();
            }
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
        }
    });

    function resetControls() {
        playPauseBtn.textContent = '⏸';
        progressFilled.style.width = '0%';
    }

    playPauseBtn.onclick = () => {
        if (mainVideo.paused) {
            mainVideo.play();
            playPauseBtn.textContent = '⏸';
        } else {
            mainVideo.pause();
            playPauseBtn.textContent = '▶';
        }
    };

    function playNext() {
        if (currentFiles.length === 0) return;
        currentIndex = (currentIndex + 1) % currentFiles.length;
        console.log('Navigation: Next clicked. New Index:', currentIndex, 'File:', currentFiles[currentIndex]?.name);
        const file = currentFiles[currentIndex];
        const element = videoList.querySelector(`li[data-path="${file.path}"]`);
        if (file.type === 'video') playVideo(file, element);
        else if (file.type === 'image') showImage(file, element);
        else showFilePlaceholder(file, element);
    }

    function playPrev() {
        if (currentFiles.length === 0) return;
        currentIndex = (currentIndex - 1 + currentFiles.length) % currentFiles.length;
        const file = currentFiles[currentIndex];
        const element = videoList.querySelector(`li[data-path="${file.path}"]`);
        if (file.type === 'video') playVideo(file, element);
        else if (file.type === 'image') showImage(file, element);
        else showFilePlaceholder(file, element);
    }

    nextBtn.onclick = playNext;
    prevBtn.onclick = playPrev;
    infoNext.onclick = playNext;
    infoPrev.onclick = playPrev;

    // Redesigned Gesture Control
    const skipLeft = document.getElementById('skip-left-overlay');
    const skipRight = document.getElementById('skip-right-overlay');
    const speedPill = document.getElementById('speed-pill');
    let pressTimer;
    let speedPillTimer;

    function showSkipFeedback(side) {
        const el = side === 'left' ? skipLeft : skipRight;
        el.classList.remove('active');
        void el.offsetWidth; // Trigger reflow
        el.classList.add('active');
        setTimeout(() => el.classList.remove('active'), 700);
    }

    mainVideo.ondblclick = (e) => {
        if (!document.fullscreenElement || isLocked) return;
        
        const rect = mainVideo.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;

        if (x < width * 0.4) {
            mainVideo.currentTime -= 10;
            showSkipFeedback('left');
        } else if (x > width * 0.6) {
            mainVideo.currentTime += 10;
            showSkipFeedback('right');
        }
    };

    const startSpeed = () => {
        if (!document.fullscreenElement) return;
        pressTimer = setTimeout(() => {
            mainVideo.playbackRate = 2.0;
            speedPill.classList.add('active');
            
            // Auto-hide pill after 3 seconds
            clearTimeout(speedPillTimer);
            speedPillTimer = setTimeout(() => {
                speedPill.classList.remove('active');
            }, 3000);
        }, 500);
    };

    const stopSpeed = () => {
        clearTimeout(pressTimer);
        clearTimeout(speedPillTimer);
        mainVideo.playbackRate = 1.0;
        speedPill.classList.remove('active');
    };

    mainVideo.onmousedown = startSpeed;
    mainVideo.ontouchstart = startSpeed;
    mainVideo.onmouseup = stopSpeed;
    mainVideo.ontouchend = stopSpeed;
    mainVideo.ontouchcancel = stopSpeed;
    mainVideo.onmouseleave = stopSpeed;

    mainVideo.onended = playNext;

    let lastSave = 0;
    mainVideo.ontimeupdate = () => {
        const percent = (mainVideo.currentTime / mainVideo.duration) * 100;
        progressFilled.style.width = `${percent}%`;
        
        const current = formatTime(mainVideo.currentTime);
        const total = formatTime(mainVideo.duration);
        timeDisplay.textContent = `${current} / ${total}`;

        // Throttled save every 2 seconds
        const now = Date.now();
        if (now - lastSave > 2000) {
            saveVideoProgress();
            lastSave = now;
        }
    };

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return (h > 0 ? h + ":" : "") + (m < 10 && h > 0 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
    }

    progressBar.parentElement.onclick = (e) => {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.pageX - rect.left) / rect.width;
        mainVideo.currentTime = pos * mainVideo.duration;
    };

    volumeSlider.oninput = (e) => {
        mainVideo.volume = e.target.value;
        muteToggle.textContent = mainVideo.volume === 0 ? '🔇' : '🔊';
    };

    muteToggle.onclick = () => {
        if (mainVideo.muted) {
            mainVideo.muted = false;
            muteToggle.textContent = '🔊';
            volumeSlider.value = mainVideo.volume;
        } else {
            mainVideo.muted = true;
            muteToggle.textContent = '🔇';
            volumeSlider.value = 0;
        }
    };

    // Prevent swipe-back and interaction when locked
    mediaContainer.addEventListener('touchstart', (e) => {
        if (isLocked && e.target !== lockeyeBtn) {
            e.preventDefault();
        }
    }, { passive: false });

    mediaContainer.addEventListener('touchend', (e) => {
        if (isLocked && e.target !== lockeyeBtn) {
            e.preventDefault();
        }
    }, { passive: false });

    fullscreenBtn.onclick = () => {
        const container = document.getElementById('media-container');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            // navigationUI: 'hide' tries to hide sys bar on Android/Chrome
            if (container.requestFullscreen) container.requestFullscreen({ navigationUI: 'hide' });
            else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
            else if (container.msRequestFullscreen) container.msRequestFullscreen();
        }
    };

    // Loading / Buffering Logic
    const videoLoader = document.getElementById('video-loader');

    mainVideo.onwaiting = () => {
        if (mainVideo.currentSrc && mainVideo.src !== window.location.href) {
            videoLoader.style.display = 'flex';
        }
    };

    mainVideo.onplaying = () => {
        videoLoader.style.display = 'none';
    };

    mainVideo.onseeking = () => {
        if (mainVideo.currentSrc && mainVideo.src !== window.location.href) {
            videoLoader.style.display = 'flex';
        }
    };

    mainVideo.onseeked = () => {
        videoLoader.style.display = 'none';
    };

    mainVideo.oncanplay = () => {
        videoLoader.style.display = 'none';
    };

    mainVideo.onloadstart = () => {
        if (mainVideo.currentSrc && mainVideo.src !== window.location.href) {
            videoLoader.style.display = 'flex';
        }
    };

    mainVideo.onerror = () => {
        videoLoader.style.display = 'none';
        const error = mainVideo.error;
        let message = "Playback failed.";
        if (error) {
            switch (error.code) {
                case 1: message = "Loading aborted."; break;
                case 2: message = "Network error."; break;
                case 3: message = "Decoding failed."; break;
                case 4: message = "Format not supported or file too large."; break;
            }
        }
        videoStatus.textContent = `Error: ${message}`;
        videoTitle.textContent = "Cannot play media";
    };

    function highlightItem(element) {
        const allItems = videoList.querySelectorAll('li');
        allItems.forEach(item => item.classList.remove('active'));
        if (element && element.classList) {
            element.classList.add('active');
        }
    }

    // CRUD Operations
    async function deleteItem(path) {
        showConfirm('Delete File', `Are you sure you want to delete ${path}?`, async () => {
            const res = await fetch('/api/delete', {
                method: 'DELETE',
                headers: getAuthHeaders(),
                body: JSON.stringify({ path, root: currentRoot })
            });
            if (res.ok) fetchFiles(currentPath);
            else alert('Failed to delete');
        });
    }


    mkdirBtn.onclick = () => {
        showPrompt('New Folder', 'Enter folder name:', async (folderName) => {
            if (!folderName) return;
            const fullPath = currentPath ? `${currentPath}/${folderName}` : folderName;
            
            const res = await fetch('/api/mkdir', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ path: fullPath, root: currentRoot })
            });
            if (res.ok) fetchFiles(currentPath);
            else alert('Failed to create folder');
        });
    };

    backBtn.onclick = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        fetchFiles(parts.join('/'));
    };

    function loadRecentVideo() {
        const saved = localStorage.getItem('mplayer_recent');
        if (saved) {
            // STRICT CHECK: Do not show recent if in embed mode
            if (window.location.pathname === '/embed' || new URLSearchParams(window.location.search).get('url')) {
                return; 
            }

            try {
                const data = JSON.parse(saved);
                recentTitle.textContent = data.name;
                const percent = Math.floor((data.time / data.duration) * 100) || 0;
                recentProgress.textContent = `${formatTime(data.time)} • ${percent}% watched`;
                recentPlayArea.style.display = 'block';

                resumeBtn.onclick = async () => {
                    console.log('Resume: Button clicked. Data:', data);
                    currentRoot = 'public'; // Ensure we are in public for history
                    
                    // Fix: Restore context (fetch files in that folder) before playing
                    if (data.path && data.path.includes('/')) {
                        const dir = data.path.substring(0, data.path.lastIndexOf('/'));
                        console.log('Resume: Restoring context for dir:', dir);
                        await fetchFiles(dir);
                    } else {
                        console.log('Resume: Restoring root context');
                        await fetchFiles(''); // Root
                    }

                    // Explicitly find and set index after fetch is COMPLETE
                    const foundIndex = currentFiles.findIndex(f => f.path === data.path);
                    if (foundIndex !== -1) {
                        console.log('Resume: Context restored. Found at index:', foundIndex);
                        currentIndex = foundIndex;
                        playVideo(currentFiles[foundIndex], null, data.time);
                    } else {
                        console.warn('Resume: File not found in currentFiles list after fetch!', data.path);
                        playVideo({ url: data.url, name: data.name, path: data.path }, null, data.time);
                    }
                };
            } catch (e) {
                localStorage.removeItem('mplayer_recent');
            }
        }
    }

    closeRecent.onclick = () => {
        recentPlayArea.style.display = 'none';
        localStorage.removeItem('mplayer_recent');
    };

    loadRecentVideo();
    initEmbedMode();

    // Keyboard Shortcuts Logic
    let leftHoldTimer;
    let rightHoldTimer;
    let rewindInterval;

    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowRight') {
            clearTimeout(rightHoldTimer);
            mainVideo.playbackRate = 1.0;
            speedPill.classList.remove('active');
        }
        if (e.key === 'ArrowLeft') {
            clearTimeout(leftHoldTimer);
            clearInterval(rewindInterval);
            speedPill.classList.remove('active');
            speedPill.textContent = '🚀 2x Speed'; // Reset text
        }
    });

    document.addEventListener('keydown', (e) => {
        // Disable shortcuts if user is typing in an input or textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // Lockeye Logic for Escape and Shortcuts
        if (e.key === 'Escape' && isLocked) {
            e.preventDefault();
            // Trigger visual and haptic feedback
            const lockBtn = document.getElementById('lockeye-btn');
            lockBtn.classList.remove('shake-lock');
            void lockBtn.offsetWidth; // Trigger reflow
            lockBtn.classList.add('shake-lock');
            
            if (navigator.vibrate) navigator.vibrate(50);
            return;
        }

        // Standard shortcuts (blocked if locked, except 'l' for unlock)
        if (isLocked && e.key.toLowerCase() !== 'l') return;

        switch (e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                if (e.ctrlKey) {
                    playPrev();
                } else {
                    if (!e.repeat) {
                        mainVideo.currentTime -= 10;
                        showSkipFeedback('left');
                        
                        // Start hold timer
                        clearTimeout(leftHoldTimer);
                        leftHoldTimer = setTimeout(() => {
                            // Start simulated rewind
                            clearInterval(rewindInterval);
                            speedPill.textContent = '⏪ Rewind 2x';
                            speedPill.classList.add('active');
                            rewindInterval = setInterval(() => {
                                mainVideo.currentTime -= 0.2; // ~2x speed rewind
                            }, 50);
                        }, 500);
                    }
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.ctrlKey) {
                    playNext();
                } else {
                    if (!e.repeat) {
                        mainVideo.currentTime += 10;
                        showSkipFeedback('right');

                        // Start hold timer
                        clearTimeout(rightHoldTimer);
                        rightHoldTimer = setTimeout(() => {
                            mainVideo.playbackRate = 2.0;
                            speedPill.textContent = '🚀 2x Speed';
                            speedPill.classList.add('active');
                        }, 500);
                    }
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                mainVideo.volume = Math.min(1, mainVideo.volume + 0.1);
                volumeSlider.value = mainVideo.volume;
                mainVideo.muted = false;
                muteToggle.textContent = mainVideo.volume === 0 ? '🔇' : '🔊';
                break;
            case 'ArrowDown':
                e.preventDefault();
                mainVideo.volume = Math.max(0, mainVideo.volume - 0.1);
                volumeSlider.value = mainVideo.volume;
                muteToggle.textContent = mainVideo.volume === 0 ? '🔇' : '🔊';
                break;
            case ' ': // Spacebar
                e.preventDefault();
                playPauseBtn.click();
                break;
            case 'm':
            case 'M':
                muteToggle.click();
                break;
            case 'f':
            case 'F':
            case 'Enter':
                if (e.target.tagName !== 'BUTTON') { // Avoid double triggering if button is focused
                    fullscreenBtn.click();
                }
            case 'l':
            case 'L':
                lockeyeBtn.click();
                break;
            default:
                // 0-9 for percentage seeking
                if (e.key >= '0' && e.key <= '9') {
                    const percent = parseInt(e.key) * 10;
                    mainVideo.currentTime = (percent / 100) * mainVideo.duration;
                }
                break;
        }
    });
});
