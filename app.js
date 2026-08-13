/* ==========================================================================
   CLIENT PREVIEW VAULT - LOGIC
   ========================================================================== */

function startApp() {
    const isDashboard = document.getElementById('dashboard-app') !== null;
    const isViewer = document.getElementById('viewer-app') !== null;

    if (isDashboard) {
        initDashboard();
    } else if (isViewer) {
        initViewer();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApp);
} else {
    startApp();
}

/* ==========================================================================
   URL CONFIGURATION ENCODING / DECODING
   ========================================================================== */
function encodeConfig(config) {
    try {
        const jsonString = JSON.stringify(config);
        // Base64 with UTF-8 safety
        return btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g, (match, p1) => {
            return String.fromCharCode('0x' + p1);
        }));
    } catch (e) {
        console.error("Encoding failed", e);
        return "";
    }
}

function decodeConfig(base64) {
    try {
        const jsonString = decodeURIComponent(atob(base64).split('').map((c) => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonString);
    } catch (e) {
        console.error("Decoding failed", e);
        return null;
    }
}

/* ==========================================================================
   SAFE LOCALSTORAGE WRAPPER (Prevents SecurityError under file:/// protocol)
   ========================================================================== */
const memoryStorage = {};
const SafeStorage = {
    getItem(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("Local storage access blocked. Falling back to memory storage.", e);
            return memoryStorage[key] || null;
        }
    },
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn("Local storage write blocked. Falling back to memory storage.", e);
            memoryStorage[key] = value;
        }
    }
};

/* ==========================================================================
   TOAST SYSTEM
   ========================================================================== */
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    const toastText = toast.querySelector('.toast-text');
    const toastIcon = toast.querySelector('.toast-icon i');
    
    toastText.textContent = message;
    
    if (type === 'success') {
        toast.style.borderLeftColor = 'var(--primary)';
        toastIcon.className = 'fa-solid fa-circle-check';
        toastIcon.style.color = 'var(--primary)';
    } else {
        toast.style.borderLeftColor = 'var(--danger)';
        toastIcon.className = 'fa-solid fa-circle-exclamation';
        toastIcon.style.color = 'var(--danger)';
    }
    
    toast.classList.add('active');
    
    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

/* ==========================================================================
   ADMIN DASHBOARD CONTROLLER
   ========================================================================== */
function initDashboard() {
    // State management
    let projects = [];
    try {
        const stored = SafeStorage.getItem('preview_vault_projects');
        if (stored) {
            projects = JSON.parse(stored);
            if (!Array.isArray(projects)) projects = [];
        }
    } catch (e) {
        console.error("Local storage parse error", e);
        projects = [];
    }
    let activeProjectId = null;
    let timerId = null; // simulator timer tracker

    // DOM Elements
    const projectListContainer = document.getElementById('project-list');
    const newProjectBtn = document.getElementById('btn-new-project');
    const deleteProjectBtn = document.getElementById('btn-delete-project');
    const saveProjectBtn = document.getElementById('btn-save-project');
    const copyLinkBtn = document.getElementById('btn-copy-link');
    const downloadHtmlBtn = document.getElementById('btn-download-html');
    const configForm = document.getElementById('config-form');
    
    // Tabs
    const tabSourceUrl = document.getElementById('tab-src-url');
    const tabSourceCode = document.getElementById('tab-src-code');
    const sourceUrlGroup = document.getElementById('url-source-group');
    const sourceCodeGroup = document.getElementById('code-source-group');
    const sourceTypeInput = document.getElementById('source-type');

    // Controls
    const watermarkToggle = document.getElementById('watermark-toggle');
    const watermarkConfig = document.getElementById('watermark-config');
    const blurToggle = document.getElementById('blur-toggle');
    const blurConfig = document.getElementById('blur-config');
    const timerToggle = document.getElementById('timer-toggle');
    const timerConfig = document.getElementById('timer-config');
    const bannerToggle = document.getElementById('banner-toggle');
    const bannerConfig = document.getElementById('banner-config');
    
    // Sliders & Range displays
    const opacityRange = document.getElementById('watermark-opacity');
    const opacityVal = document.getElementById('watermark-opacity-val');
    opacityRange.addEventListener('input', () => { opacityVal.textContent = opacityRange.value; updateSimulator(); });

    const blurDelayRange = document.getElementById('blur-delay');
    const blurDelayVal = document.getElementById('blur-delay-val');
    blurDelayRange.addEventListener('input', () => { blurDelayVal.textContent = blurDelayRange.value + 's'; updateSimulator(); });

    const timerDurationRange = document.getElementById('timer-duration');
    const timerDurationVal = document.getElementById('timer-duration-val');
    timerDurationRange.addEventListener('input', () => { timerDurationVal.textContent = timerDurationRange.value + 's'; updateSimulator(); });

    // Modals
    const shareModal = document.getElementById('share-modal');
    const closeShareModal = document.getElementById('close-share-modal');
    const modalShareUrl = document.getElementById('modal-share-url');
    const modalCopyBtn = document.getElementById('modal-copy-btn');
    
    closeShareModal.addEventListener('click', () => shareModal.classList.remove('active'));
    
    // ----------------------------------------------------
    // INITIALIZATION & EVENT HANDLERS
    // ----------------------------------------------------
    
    // Tabs navigation
    tabSourceUrl.addEventListener('click', () => {
        tabSourceUrl.classList.add('active');
        tabSourceCode.classList.remove('active');
        sourceUrlGroup.classList.remove('hidden');
        sourceCodeGroup.classList.add('hidden');
        sourceTypeInput.value = 'url';
        updateSimulator();
    });

    tabSourceCode.addEventListener('click', () => {
        tabSourceCode.classList.add('active');
        tabSourceUrl.classList.remove('active');
        sourceCodeGroup.classList.remove('hidden');
        sourceUrlGroup.classList.add('hidden');
        sourceTypeInput.value = 'code';
        updateSimulator();
    });

    // Configuration sub-panel toggles
    watermarkToggle.addEventListener('change', () => {
        watermarkConfig.classList.toggle('hidden', !watermarkToggle.checked);
        updateSimulator();
    });

    blurToggle.addEventListener('change', () => {
        blurConfig.classList.toggle('hidden', !blurToggle.checked);
        updateSimulator();
    });

    timerToggle.addEventListener('change', () => {
        timerConfig.classList.toggle('hidden', !timerToggle.checked);
        updateSimulator();
    });

    bannerToggle.addEventListener('change', () => {
        bannerConfig.classList.toggle('hidden', !bannerToggle.checked);
        updateSimulator();
    });

    // Form value changes sync dynamically to simulator
    configForm.querySelectorAll('input, textarea, select').forEach(input => {
        input.addEventListener('input', updateSimulator);
        input.addEventListener('change', updateSimulator);
    });

    // Create New Project Button
    newProjectBtn.addEventListener('click', () => {
        resetForm();
        activeProjectId = null;
        updateSimulator();
        showToast("New draft workspace opened", 'success');
    });

    // Save Project Button
    saveProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        saveCurrentProject();
    });

    // Delete Project Button
    deleteProjectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!activeProjectId) return;
        
        if (confirm("Are you sure you want to delete this project?")) {
            projects = projects.filter(p => p.id !== activeProjectId);
            SafeStorage.setItem('preview_vault_projects', JSON.stringify(projects));
            activeProjectId = null;
            resetForm();
            renderProjectList();
            updateSimulator();
            showToast("Project deleted", 'success');
        }
    });

    // Generate Share Link Button
    copyLinkBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const project = getCurrentFormState();
        if (!project.name) {
            showToast("Please enter a project name first", 'error');
            return;
        }

        const encoded = encodeConfig(project);
        const viewerUrl = `${window.location.origin}${window.location.pathname.replace('index.html', '')}viewer.html?config=${encoded}`;
        
        modalShareUrl.value = viewerUrl;
        shareModal.classList.add('active');
    });

    modalCopyBtn.addEventListener('click', () => {
        modalShareUrl.select();
        document.execCommand('copy');
        showToast("Preview link copied to clipboard!", 'success');
    });

    // Download Protected HTML Button (Highly Portable Single File Preview)
    downloadHtmlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const project = getCurrentFormState();
        if (!project.name) {
            showToast("Please enter a project name first", 'error');
            return;
        }
        
        // Generate self-contained standalone HTML preview file
        const standaloneHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview Mode | ${escapeHtml(project.name)}</title>
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <!-- FontAwesome Icons -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        :root {
            --bg-dark: #0f172a;
            --bg-card: #1e293b;
            --border-color: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --primary: #10b981;
            --primary-hover: #059669;
            --primary-glow: rgba(16, 185, 129, 0.15);
            --accent: #f59e0b;
            --danger: #ef4444;
            --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
            --radius-sm: 6px;
            --radius-md: 12px;
            --radius-lg: 16px;
            --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body {
            width: 100%; height: 100%; overflow: hidden;
            background-color: var(--bg-dark); color: var(--text-primary);
            font-family: var(--font-sans); line-height: 1.5;
        }
        .viewer-container { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
        .viewer-banner {
            background-color: var(--bg-card); border-bottom: 1px solid var(--border-color);
            padding: 0.75rem 1.5rem; display: flex; justify-content: space-between; align-items: center;
            position: relative; z-index: 100010;
        }
        .viewer-banner-info { display: flex; align-items: center; gap: 1rem; }
        .brand { display: flex; align-items: center; gap: 0.5rem; }
        .brand-icon {
            font-size: 1.1rem; color: var(--primary); background: var(--primary-glow);
            padding: 4px 8px; border-radius: var(--radius-sm); border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .brand h1 { font-size: 1rem; font-weight: 700; }
        .brand h1 span { color: var(--primary); }
        .viewer-badge {
            background-color: rgba(245, 158, 11, 0.15); color: var(--accent);
            border: 1px solid rgba(245, 158, 11, 0.2); padding: 0.25rem 0.75rem;
            border-radius: 20px; font-size: 0.75rem; font-weight: 600;
        }
        .viewer-banner-title { font-size: 0.85rem; font-weight: 600; }
        .viewer-banner-cta { display: flex; align-items: center; gap: 0.75rem; }
        .viewer-timer {
            font-size: 0.85rem; font-weight: 700; color: var(--accent); background: rgba(245, 158, 11, 0.1);
            padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); border: 1px solid rgba(245, 158, 11, 0.2);
            display: flex; align-items: center; gap: 0.35rem;
        }
        .viewer-body { flex-grow: 1; position: relative; background-color: #f1f5f9; }
        .btn {
            display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
            font-family: var(--font-sans); font-size: 0.9rem; font-weight: 500;
            padding: 0.6rem 1.2rem; border-radius: var(--radius-md); border: 1px solid transparent;
            cursor: pointer; transition: var(--transition); text-decoration: none; white-space: nowrap;
        }
        .btn-primary { background-color: var(--primary); color: #fff; }
        .btn-primary:hover { background-color: var(--primary-hover); box-shadow: 0 0 12px rgba(16, 185, 129, 0.3); }
        .btn-sm { padding: 0.4rem 0.8rem; font-size: 0.8rem; border-radius: var(--radius-sm); }
        .btn-lg { padding: 0.8rem 1.6rem; font-size: 1rem; }
        .btn-full { width: 100%; }
        
        /* Watermarks */
        .watermark-grid {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            pointer-events: none; z-index: 99999; overflow: hidden;
            display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            grid-template-rows: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; padding: 20px;
            opacity: 0.15; mix-blend-mode: difference;
        }
        .watermark-item {
            display: flex; align-items: center; justify-content: center;
            font-size: 1.15rem; font-weight: 800; color: #ffffff;
            text-transform: uppercase; letter-spacing: 0.1em;
            transform: rotate(-30deg); white-space: nowrap; user-select: none;
        }
        .watermark-float {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-25deg);
            pointer-events: none; z-index: 99998; font-size: 3.5rem; font-weight: 900;
            color: rgba(255, 255, 255, 0.08); border: 6px solid rgba(255, 255, 255, 0.08);
            padding: 1rem 3rem; border-radius: var(--radius-md); text-transform: uppercase;
            letter-spacing: 0.2em; white-space: nowrap; user-select: none; mix-blend-mode: difference;
        }
        
        /* Blocker locks */
        .blocker-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 100000;
            background-color: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center; padding: 2rem;
            opacity: 0; pointer-events: none; transition: opacity 0.5s ease;
        }
        .blocker-overlay.active { opacity: 1; pointer-events: auto; }
        .blocker-card {
            background-color: var(--bg-card); border: 1px solid var(--border-color);
            box-shadow: var(--shadow-xl), 0 0 30px rgba(16, 185, 129, 0.1);
            border-radius: var(--radius-lg); max-width: 450px; width: 100%;
            padding: 2.5rem; text-align: center; display: flex; flex-direction: column;
            align-items: center; gap: 1.5rem; transform: translateY(20px);
            transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .blocker-overlay.active .blocker-card { transform: translateY(0); }
        .blocker-icon {
            font-size: 2.5rem; color: var(--primary); background: var(--primary-glow);
            width: 70px; height: 70px; display: flex; align-items: center; justify-content: center;
            border-radius: 50%; border: 1px solid rgba(16, 185, 129, 0.2); margin-bottom: 0.5rem;
            animation: pulseGlow 2s infinite;
        }
        .blocker-card h2 { font-size: 1.5rem; color: var(--text-primary); }
        .blocker-card p { color: var(--text-secondary); font-size: 0.95rem; }
        .pointer-blocker { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 99990; cursor: not-allowed; }
        @keyframes pulseGlow {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
            70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
    </style>
</head>
<body>
    <div class="viewer-container" id="viewer-container">
        <div class="viewer-body" id="viewer-viewport-container" style="width: 100%; height: 100%; position: relative;">
            <!-- Iframe will go here -->
        </div>
    </div>
    
    <script>
        const config = ${JSON.stringify(project)};
        
        function escapeHtml(str) {
            if (!str) return '';
            return str
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        document.addEventListener('DOMContentLoaded', () => {
            const viewerContainer = document.getElementById('viewer-container');
            const viewportContainer = document.getElementById('viewer-viewport-container');
            
            // Set title
            document.title = "Preview Mode | " + config.name;
            
            // Build banner
            if (config.bannerEnabled && viewerContainer) {
                const banner = document.createElement('div');
                banner.className = 'viewer-banner';
                const timerHtml = config.expirationEnabled 
                    ? '<div class="viewer-timer" id="header-timer"><i class="fa-regular fa-clock"></i> <span id="time-left">' + config.expirationTime + 's</span></div>' 
                    : '';
                banner.innerHTML = \`
                    <div class="viewer-banner-info">
                        <div class="brand" style="margin-right:1rem;">
                            <span class="brand-icon" style="font-size:1.1rem; padding: 4px 8px; border-radius:6px;"><i class="fa-solid fa-cube"></i></span>
                            <h1 style="font-size:1rem; font-family:sans-serif; color: #fff;">Preview<span>Vault</span></h1>
                        </div>
                        <span class="viewer-badge">Protected Preview</span>
                        <span class="viewer-banner-title" style="color: var(--text-secondary); font-size: 0.85rem;">Project: \\${escapeHtml(config.name)}</span>
                    </div>
                    <div class="viewer-banner-cta">
                        \\${timerHtml}
                        <a href="\\${escapeHtml(config.bannerButtonUrl || '#')}" target="_blank" class="btn btn-primary btn-sm">\\${escapeHtml(config.bannerButtonText)}</a>
                    </div>
                \`;
                viewerContainer.insertBefore(banner, viewportContainer);
            }
            
            // Render iframe
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            
            if (config.sourceType === 'code') {
                iframe.srcdoc = config.code;
            } else {
                iframe.src = config.url;
            }
            viewportContainer.appendChild(iframe);
            
            // Interactions
            if (config.interactionBlocked) {
                const blocker = document.createElement('div');
                blocker.className = 'pointer-blocker';
                viewportContainer.appendChild(blocker);
                
                document.addEventListener('contextmenu', e => e.preventDefault());
                document.addEventListener('keydown', e => {
                    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'U')) {
                        e.preventDefault();
                    }
                });
            }
            
            // Watermarks
            if (config.watermarkEnabled) {
                if (config.watermarkStyle === 'grid') {
                    const grid = document.createElement('div');
                    grid.className = 'watermark-grid';
                    grid.style.opacity = config.watermarkOpacity;
                    for(let i=0; i<48; i++) {
                        const item = document.createElement('div');
                        item.className = 'watermark-item';
                        item.textContent = config.watermarkText;
                        grid.appendChild(item);
                    }
                    viewportContainer.appendChild(grid);
                } else {
                    const float = document.createElement('div');
                    float.className = 'watermark-float';
                    float.style.opacity = config.watermarkOpacity;
                    float.textContent = config.watermarkText;
                    viewportContainer.appendChild(float);
                }
            }
            
            // Expire logic
            function lockScreen(title, body) {
                iframe.style.filter = 'blur(12px)';
                iframe.style.transition = 'filter 1s ease';
                
                let lock = document.getElementById('lockout-blocker');
                if (!lock) {
                    lock = document.createElement('div');
                    lock.className = 'blocker-overlay active';
                    lock.id = 'lockout-blocker';
                    const targetCtaUrl = config.blurOverlayUrl ? config.blurOverlayUrl : (config.bannerButtonUrl ? config.bannerButtonUrl : '#');
                    lock.innerHTML = \`
                        <div class="blocker-card">
                            <div class="blocker-icon"><i class="fa-solid fa-shield-halved"></i></div>
                            <h2>\\${escapeHtml(title)}</h2>
                            <p>\\${escapeHtml(body)}</p>
                            <a href="\\${escapeHtml(targetCtaUrl)}" class="btn btn-primary btn-full btn-lg">\\${escapeHtml(config.blurOverlayCta)}</a>
                        </div>
                    \`;
                    viewportContainer.appendChild(lock);
                }
            }
            
            if (config.expirationEnabled) {
                let timeLeft = config.expirationTime;
                const timerEl = document.getElementById('time-left');
                const headerTimer = document.getElementById('header-timer');
                
                const timer = setInterval(() => {
                    timeLeft--;
                    if (timerEl) timerEl.textContent = timeLeft + 's';
                    
                    if (timeLeft <= 10 && headerTimer) {
                        headerTimer.style.color = 'var(--danger)';
                        headerTimer.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    }
                    
                    if (timeLeft <= 0) {
                        clearInterval(timer);
                        lockScreen("PREVIEW EXPIRED", "The interactive preview window has expired. Please contact the administrator or request unlock to continue.");
                    }
                }, 1000);
            }
            
            if (config.blurEnabled) {
                setTimeout(() => {
                    lockScreen(config.blurOverlayText, "This preview environment limits interaction to protect creative IP. Contact developer to request access.");
                }, config.blurDelay * 1000);
            }
        });
    </script>
</body>
</html>`;

        const blob = new Blob([standaloneHTML], { type: 'text/html' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-preview.html';
        link.click();
        showToast("Standalone protected preview HTML downloaded!", 'success');
    });

    // Initialize list & template loading
    renderProjectList();
    resetForm();
    updateSimulator();

    // ----------------------------------------------------
    // PROJECT CRUD FUNCTIONS
    // ----------------------------------------------------
    
    function renderProjectList() {
        projectListContainer.innerHTML = '';
        
        if (projects.length === 0) {
            projectListContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fa-solid fa-folder-open"></i></div>
                    <p style="font-size: 0.8rem;">No previews created yet. Setup a project and save it.</p>
                </div>
            `;
            deleteProjectBtn.style.display = 'none';
            return;
        }

        deleteProjectBtn.style.display = 'inline-flex';
        
        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = `project-card ${project.id === activeProjectId ? 'active' : ''}`;
            
            const displayUrl = project.sourceType === 'url' ? project.url : 'Pasted Raw Code HTML';
            let displayDate = 'Unknown';
            if (project.createdAt) {
                const d = new Date(project.createdAt);
                if (!isNaN(d.getTime())) {
                    displayDate = d.toLocaleDateString(undefined, {month: 'short', day: 'numeric'});
                }
            }

            card.innerHTML = `
                <div class="project-meta">
                    <h4>${escapeHtml(project.name)}</h4>
                    <span class="status-pill ${project.watermarkEnabled || project.blurEnabled || project.interactionBlocked ? 'active' : 'inactive'}">
                        <i class="fa-solid ${project.watermarkEnabled || project.blurEnabled || project.interactionBlocked ? 'fa-lock' : 'fa-lock-open'}"></i>
                    </span>
                </div>
                <div class="project-url">${escapeHtml(displayUrl)}</div>
                <div class="project-date">Created ${displayDate}</div>
            `;

            card.addEventListener('click', (e) => {
                // Ignore if clicked on delete button (though we removed delete button from absolute position, just in case)
                loadProjectIntoForm(project);
            });

            projectListContainer.appendChild(card);
        });
    }

    function getCurrentFormState() {
        return {
            id: activeProjectId || Date.now().toString(),
            name: document.getElementById('project-name').value || 'Unnamed Project',
            sourceType: sourceTypeInput.value,
            url: document.getElementById('url-source').value,
            code: document.getElementById('code-source').value,
            
            watermarkEnabled: watermarkToggle.checked,
            watermarkText: document.getElementById('watermark-text').value || 'SAMPLE PREVIEW',
            watermarkStyle: document.getElementById('watermark-style').value,
            watermarkOpacity: parseFloat(opacityRange.value),
            
            blurEnabled: blurToggle.checked,
            blurDelay: parseInt(blurDelayRange.value),
            blurOverlayText: document.getElementById('blur-text').value || 'PREVIEW PERIOD EXPIRED',
            blurOverlayCta: document.getElementById('blur-cta').value || 'Unlock Site',
            blurOverlayUrl: document.getElementById('blur-cta-url').value,

            interactionBlocked: document.getElementById('click-block-toggle').checked,
            
            expirationEnabled: timerToggle.checked,
            expirationTime: parseInt(timerDurationRange.value),
            
            bannerEnabled: bannerToggle.checked,
            bannerText: document.getElementById('banner-text').value || 'You are viewing a limited preview of this website.',
            bannerButtonText: document.getElementById('banner-btn-text').value || 'Request Unlock',
            bannerButtonUrl: document.getElementById('banner-btn-url').value,
            createdAt: (activeProjectId && projects.find(p => p.id === activeProjectId)) 
                ? (projects.find(p => p.id === activeProjectId).createdAt || new Date().toISOString()) 
                : new Date().toISOString()
        };
    }

    function saveCurrentProject() {
        const state = getCurrentFormState();
        if (!state.name.trim()) {
            showToast("Project Name is required", 'error');
            return;
        }

        const index = projects.findIndex(p => p.id === state.id);
        if (index > -1) {
            projects[index] = state;
            showToast("Project updated successfully", 'success');
        } else {
            projects.unshift(state); // Add to beginning
            activeProjectId = state.id;
            showToast("New project saved successfully", 'success');
        }

        SafeStorage.setItem('preview_vault_projects', JSON.stringify(projects));
        renderProjectList();
        updateSimulator();
    }

    function loadProjectIntoForm(project) {
        activeProjectId = project.id;
        
        document.getElementById('project-name').value = project.name;
        sourceTypeInput.value = project.sourceType;
        document.getElementById('url-source').value = project.url;
        document.getElementById('code-source').value = project.code;

        // Sync tab visual state
        if (project.sourceType === 'code') {
            tabSourceCode.click();
        } else {
            tabSourceUrl.click();
        }

        // Sync Toggles
        watermarkToggle.checked = project.watermarkEnabled;
        watermarkConfig.classList.toggle('hidden', !project.watermarkEnabled);
        document.getElementById('watermark-text').value = project.watermarkText;
        document.getElementById('watermark-style').value = project.watermarkStyle;
        opacityRange.value = project.watermarkOpacity;
        opacityVal.textContent = project.watermarkOpacity;

        blurToggle.checked = project.blurEnabled;
        blurConfig.classList.toggle('hidden', !project.blurEnabled);
        blurDelayRange.value = project.blurDelay;
        blurDelayVal.textContent = project.blurDelay + 's';
        document.getElementById('blur-text').value = project.blurOverlayText;
        document.getElementById('blur-cta').value = project.blurOverlayCta;
        document.getElementById('blur-cta-url').value = project.blurOverlayUrl;

        document.getElementById('click-block-toggle').checked = project.interactionBlocked;

        timerToggle.checked = project.expirationEnabled;
        timerConfig.classList.toggle('hidden', !project.expirationEnabled);
        timerDurationRange.value = project.expirationTime;
        timerDurationVal.textContent = project.expirationTime + 's';

        bannerToggle.checked = project.bannerEnabled;
        bannerConfig.classList.toggle('hidden', !project.bannerEnabled);
        document.getElementById('banner-text').value = project.bannerText;
        document.getElementById('banner-btn-text').value = project.bannerButtonText;
        document.getElementById('banner-btn-url').value = project.bannerButtonUrl;

        // Highlight selected
        document.querySelectorAll('.project-card').forEach(card => card.classList.remove('active'));
        renderProjectList();
        updateSimulator();
    }

    function resetForm() {
        activeProjectId = null;
        configForm.reset();
        tabSourceUrl.click();
        
        watermarkToggle.checked = true;
        watermarkConfig.classList.remove('hidden');
        blurToggle.checked = true;
        blurConfig.classList.remove('hidden');
        timerToggle.checked = false;
        timerConfig.classList.add('hidden');
        bannerToggle.checked = true;
        bannerConfig.classList.remove('hidden');
        
        opacityRange.value = 0.15;
        opacityVal.textContent = "0.15";
        blurDelayRange.value = 10;
        blurDelayVal.textContent = "10s";
        timerDurationRange.value = 30;
        timerDurationVal.textContent = "30s";
        
        document.getElementById('watermark-text').value = 'SAMPLE PREVIEW';
        document.getElementById('blur-text').value = 'PREVIEW PERIOD EXPIRED';
        document.getElementById('blur-cta').value = 'Unlock Full Site';
        document.getElementById('click-block-toggle').checked = false;
        
        document.querySelectorAll('.project-card').forEach(card => card.classList.remove('active'));
    }

    // ----------------------------------------------------
    // LIVE SIMULATOR RENDERER (DASHBOARD)
    // ----------------------------------------------------
    function updateSimulator() {
        const state = getCurrentFormState();
        const container = document.getElementById('simulator-container');
        if (!container) return;

        // Clear timeouts
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }

        // Clean container
        container.innerHTML = '';

        // Determine target URL or source
        let srcUrl = '';
        let isPastedCode = false;

        if (state.sourceType === 'url') {
            srcUrl = state.url ? state.url : '';
        } else {
            isPastedCode = true;
        }

        if (!srcUrl && !isPastedCode) {
            container.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary); text-align: center; padding: 2rem;">
                    <i class="fa-solid fa-laptop-code" style="font-size: 3rem; margin-bottom: 1rem; color: var(--text-muted);"></i>
                    <p>Enter a target URL or paste HTML source code to launch the simulator preview.</p>
                </div>
            `;
            return;
        }

        // Construct Iframe Wrapper elements
        const iframe = document.createElement('iframe');
        iframe.className = 'simulator-viewport';
        iframe.id = 'sim-iframe';

        if (isPastedCode) {
            // Write to srcdoc
            iframe.srcdoc = state.code || '<html><body style="font-family:sans-serif; text-align:center; padding-top:4rem; background:#f8fafc; color:#1e293b;"><h3>Paste your HTML code to preview here</h3><p>Your code will render inside this sandboxed container in real time.</p></body></html>';
        } else {
            iframe.src = srcUrl;
        }

        container.appendChild(iframe);

        // Apply visual overlays on container top
        
        // 1. Banner Overlay
        if (state.bannerEnabled) {
            const banner = document.createElement('div');
            banner.style.position = 'absolute';
            banner.style.top = '0';
            banner.style.left = '0';
            banner.style.width = '100%';
            banner.style.backgroundColor = 'var(--bg-card)';
            banner.style.borderBottom = '1px solid var(--border-color)';
            banner.style.padding = '8px 16px';
            banner.style.zIndex = '99995';
            banner.style.display = 'flex';
            banner.style.justifyContent = 'space-between';
            banner.style.alignItems = 'center';
            banner.style.fontSize = '12px';

            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:rgba(245,158,11,0.2); color:var(--accent); padding:2px 6px; border-radius:10px; font-weight:bold;">PREVIEW</span>
                    <span style="color:var(--text-primary); font-weight:500;">${escapeHtml(state.bannerText)}</span>
                </div>
                <button class="btn btn-primary btn-sm" style="padding: 3px 8px; font-size:11px;" onclick="alert('CTA Clicked: ' + '${escapeHtml(state.bannerButtonUrl || '#')}')">${escapeHtml(state.bannerButtonText)}</button>
            `;
            container.appendChild(banner);
            // Push iframe down to avoid overlap
            iframe.style.height = 'calc(100% - 37px)';
            iframe.style.top = '37px';
            iframe.style.position = 'absolute';
        }

        // 2. Interaction Blocker
        if (state.interactionBlocked) {
            const pointerBlocker = document.createElement('div');
            pointerBlocker.className = 'pointer-blocker';
            // Position pointer blocker below header banner if banner is active
            if (state.bannerEnabled) {
                pointerBlocker.style.top = '37px';
                pointerBlocker.style.height = 'calc(100% - 37px)';
            }
            container.appendChild(pointerBlocker);
        }

        // 3. Watermarks
        if (state.watermarkEnabled) {
            if (state.watermarkStyle === 'grid') {
                const wGrid = document.createElement('div');
                wGrid.className = 'watermark-grid';
                wGrid.style.opacity = state.watermarkOpacity;
                if (state.bannerEnabled) {
                    wGrid.style.top = '37px';
                    wGrid.style.height = 'calc(100% - 37px)';
                }
                
                // Create tiled grid watermarks
                for (let i = 0; i < 16; i++) {
                    const item = document.createElement('div');
                    item.className = 'watermark-item';
                    item.textContent = state.watermarkText;
                    wGrid.appendChild(item);
                }
                container.appendChild(wGrid);
            } else {
                const wFloat = document.createElement('div');
                wFloat.className = 'watermark-float';
                wFloat.textContent = state.watermarkText;
                wFloat.style.opacity = state.watermarkOpacity;
                container.appendChild(wFloat);
            }
        }

        // 4. Time limit/expiration or blur delay trigger simulator
        // In the simulator, if blur is enabled, we'll schedule a blur visual preview
        if (state.blurEnabled) {
            const blocker = document.createElement('div');
            blocker.className = 'blocker-overlay';
            if (state.bannerEnabled) {
                blocker.style.top = '37px';
                blocker.style.height = 'calc(100% - 37px)';
            }

            blocker.innerHTML = `
                <div class="blocker-card" style="padding:1.5rem; max-width: 320px; gap: 0.75rem;">
                    <div class="blocker-icon" style="width: 48px; height: 48px; font-size:1.5rem;"><i class="fa-solid fa-hourglass-end"></i></div>
                    <h3 style="font-size:1.1rem;">${escapeHtml(state.blurOverlayText)}</h3>
                    <p style="font-size:0.8rem; margin:0 0 0.5rem 0;">This preview environment limits interaction to protect IP.</p>
                    <button class="btn btn-primary btn-sm btn-full" onclick="alert('CTAClicked!')">${escapeHtml(state.blurOverlayCta)}</button>
                </div>
            `;
            container.appendChild(blocker);

            // Schedule the trigger
            timerId = setTimeout(() => {
                iframe.style.filter = 'blur(10px)';
                blocker.classList.add('active');
            }, state.blurDelay * 1000);
        }
    }
}

/* ==========================================================================
   PROSPECT PREVIEW VIEWER CONTROLLER
   ========================================================================== */
function initViewer() {
    let config = null;

    // 1. Try to read standalone compile payload
    if (window.STANDALONE_PROJECT_DATA) {
        config = decodeConfig(window.STANDALONE_PROJECT_DATA);
    } else {
        // 2. Read query URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlConfig = urlParams.get('config');
        if (urlConfig) {
            config = decodeConfig(urlConfig);
        }
    }

    const appContainer = document.getElementById('viewer-app');
    const viewerContainer = document.getElementById('viewer-container');
    const viewportContainer = document.getElementById('viewer-viewport-container');

    if (!config) {
        appContainer.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#0f172a; text-align:center; padding:2rem; font-family:sans-serif;">
                <div style="background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); color:#ef4444; width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem; margin-bottom:1.5rem;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h2 style="color:#f8fafc; margin-bottom:0.5rem;">Invalid Preview Link</h2>
                <p style="color:#94a3b8; max-width:400px; font-size:0.95rem; margin-bottom:1.5rem;">The showcase URL is missing configuration parameters, has been corrupted, or has expired.</p>
                <div style="color:#64748b; font-size:0.8rem;">Powered by Preview Vault</div>
            </div>
        `;
        return;
    }

    // Set page title
    document.title = `Preview Mode | ${config.name}`;

    // Render Banner top header if enabled
    if (config.bannerEnabled && viewerContainer) {
        const banner = document.createElement('div');
        banner.className = 'viewer-banner';
        
        const expirationTimerHtml = config.expirationEnabled 
            ? `<div class="viewer-timer" id="header-timer"><i class="fa-regular fa-clock"></i> <span id="time-left">${config.expirationTime}s</span></div>` 
            : '';

        banner.innerHTML = `
            <div class="viewer-banner-info">
                <div class="brand" style="margin-right:1rem;">
                    <span class="brand-icon" style="font-size:1.1rem; padding: 4px 8px; border-radius:var(--radius-sm);"><i class="fa-solid fa-cube"></i></span>
                    <h1 style="font-size:1rem;">Preview</h1>
                </div>
                <span class="viewer-badge">Protected Preview</span>
                <span class="viewer-banner-title" style="color: var(--text-secondary); font-size: 0.85rem;">Project: ${escapeHtml(config.name)}</span>
            </div>
            <div class="viewer-banner-cta">
                ${expirationTimerHtml}
                <a href="${escapeHtml(config.bannerButtonUrl || '#')}" target="_blank" class="btn btn-primary btn-sm">${escapeHtml(config.bannerButtonText)}</a>
            </div>
        `;
        viewerContainer.insertBefore(banner, viewportContainer);
    }

    // Render target site iframe
    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.id = 'viewer-iframe';

    if (config.sourceType === 'code') {
        iframe.srcdoc = config.code;
    } else {
        iframe.src = config.url;
    }

    viewportContainer.appendChild(iframe);

    // Apply overlays onto view body
    const overlayTarget = viewportContainer;

    // Apply Click Interaction Blocker
    if (config.interactionBlocked) {
        const clickBlocker = document.createElement('div');
        clickBlocker.className = 'pointer-blocker';
        overlayTarget.appendChild(clickBlocker);
    }

    // Apply Watermarks
    if (config.watermarkEnabled) {
        if (config.watermarkStyle === 'grid') {
            const wGrid = document.createElement('div');
            wGrid.className = 'watermark-grid';
            wGrid.style.opacity = config.watermarkOpacity;
            
            // Create grid elements
            for (let i = 0; i < 48; i++) { // Larger count for full-screen viewer
                const item = document.createElement('div');
                item.className = 'watermark-item';
                item.textContent = config.watermarkText;
                wGrid.appendChild(item);
            }
            overlayTarget.appendChild(wGrid);
        } else {
            const wFloat = document.createElement('div');
            wFloat.className = 'watermark-float';
            wFloat.textContent = config.watermarkText;
            wFloat.style.opacity = config.watermarkOpacity;
            overlayTarget.appendChild(wFloat);
        }
    }

    // Prevent inspections and right-click as secondary deterrents
    if (config.interactionBlocked) {
        document.addEventListener('contextmenu', e => e.preventDefault());
        document.addEventListener('keydown', e => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.shiftKey && e.key === 'J') || (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
                showToast("Developer options are disabled in preview mode", 'error');
            }
        });
    }

    // Handle Time-Limit Expire (countdown timer in header + lockout screen)
    if (config.expirationEnabled) {
        let secondsRemaining = config.expirationTime;
        const timerDisplay = document.getElementById('time-left');
        const headerTimer = document.getElementById('header-timer');

        const countdownInterval = setInterval(() => {
            secondsRemaining--;
            if (timerDisplay) {
                timerDisplay.textContent = `${secondsRemaining}s`;
            }

            if (secondsRemaining <= 10 && headerTimer) {
                headerTimer.style.color = 'var(--danger)';
                headerTimer.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                headerTimer.style.background = 'rgba(239, 68, 68, 0.1)';
            }

            if (secondsRemaining <= 0) {
                clearInterval(countdownInterval);
                triggerLockoutOverlay("PREVIEW EXPIRED", "The interactive preview window has expired. Please contact the administrator or request unlock to continue.");
            }
        }, 1000);
    }

    // Handle Blur Blocker timer (if timer is separate or if blur timer is enabled)
    if (config.blurEnabled) {
        setTimeout(() => {
            triggerLockoutOverlay(config.blurOverlayText, "This preview environment limits interaction to protect creative IP. Contact developer to request access.");
        }, config.blurDelay * 1000);
    }

    function triggerLockoutOverlay(titleText, bodyText) {
        // Blur Iframe
        iframe.style.filter = 'blur(12px)';
        iframe.style.transition = 'filter 1s ease';

        // Check if blocker overlay already exists, otherwise create it
        let blocker = document.getElementById('lockout-blocker');
        if (!blocker) {
            blocker = document.createElement('div');
            blocker.className = 'blocker-overlay active';
            blocker.id = 'lockout-blocker';
            
            const btnUrl = config.blurOverlayUrl ? config.blurOverlayUrl : (config.bannerButtonUrl ? config.bannerButtonUrl : '#');
            
            blocker.innerHTML = `
                <div class="blocker-card">
                    <div class="blocker-icon"><i class="fa-solid fa-shield-halved"></i></div>
                    <h2>${escapeHtml(titleText)}</h2>
                    <p>${escapeHtml(bodyText)}</p>
                    <a href="${escapeHtml(btnUrl)}" class="btn btn-primary btn-full btn-lg">${escapeHtml(config.blurOverlayCta)}</a>
                </div>
            `;
            overlayTarget.appendChild(blocker);
        }
    }
}

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
