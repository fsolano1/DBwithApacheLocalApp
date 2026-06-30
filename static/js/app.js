// Initialize session click states
let profileClickCount = parseInt(localStorage.getItem('api_engine_profile_clicks') || 0);
let apiCallCount = parseInt(localStorage.getItem('api_engine_api_calls') || 0);

// Project management states
let projectsList = JSON.parse(localStorage.getItem('api_engine_projects') || '[]');
if (projectsList.length === 0) {
    projectsList.push({
        id: 'proj_default',
        name: 'Twitter Validation Project',
        description: 'Verify DistilBERT model performance against ground truth validation dataset.',
        model: 'distilbert-local',
        created: new Date().toLocaleDateString()
    });
    localStorage.setItem('api_engine_projects', JSON.stringify(projectsList));
}

function updateProjectsCountBadge() {
    const badges = document.querySelectorAll('.sidebar-projects-count');
    badges.forEach(b => {
        if (b) b.innerText = projectsList.length;
    });
    // In metadata session stats if needed
    const metaProjCount = document.getElementById('metaProjCount');
    if (metaProjCount) metaProjCount.innerText = projectsList.length;
}

// Decoded JWT utility
function decodeJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT Decode error: ", e);
        return {};
    }
}

// Log display console helper
const logConsole = document.getElementById('logConsole');
function addLog(message, type = 'info') {
    const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let colorClass = 'text-on-surface-variant';
    if (type === 'success') colorClass = 'text-primary';
    if (type === 'error') colorClass = 'text-error';
    if (type === 'warn') colorClass = 'text-secondary';
    
    const logLine = document.createElement('div');
    logLine.className = `flex gap-2 ${colorClass}`;
    logLine.innerHTML = `<span class="text-on-surface-variant/40 select-none">[${timeStr}]</span> <span>${escapeHtml(message)}</span>`;
    
    if (logConsole) {
        logConsole.appendChild(logLine);
        logConsole.scrollTop = logConsole.scrollHeight;
        
        // Cap at 100 logs
        if (logConsole.childElementCount > 100) {
            logConsole.removeChild(logConsole.firstChild);
        }
    }
}

function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// Show toast alerts
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `p-3 rounded-lg border flex items-center gap-3 text-xs font-semibold shadow-2xl pointer-events-auto transition-all duration-300 transform translate-y-2 opacity-0 bg-surface-container border-outline-variant`;
    
    let icon = 'info';
    let iconColor = 'text-secondary';
    if (type === 'success') { icon = 'check_circle'; iconColor = 'text-primary'; }
    if (type === 'error') { icon = 'warning'; iconColor = 'text-error'; }
    
    toast.innerHTML = `
        <span class="material-symbols-outlined ${iconColor}">${icon}</span>
        <span class="text-on-surface">${message}</span>
    `;
    
    const container = document.getElementById('toastContainer');
    if (container) {
        container.appendChild(toast);
        
        // Trigger animation frame
        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 50);
        
        // Remove after 3.5s
        setTimeout(() => {
            toast.classList.add('translate-y-2', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }
}

// Global Navigation setup
const sections = {
    dashboard: document.getElementById('section-dashboard'),
    sentiment: document.getElementById('section-sentiment'),
    keys: document.getElementById('section-keys'),
    docs: document.getElementById('section-docs'),
    logs: document.getElementById('section-logs'),
    metadata: document.getElementById('section-metadata'),
    settings: document.getElementById('section-settings'),
    support: document.getElementById('section-support')
};

function switchTab(tabName) {
    Object.values(sections).forEach(sec => {
        if (sec) {
            sec.classList.add('hidden');
            sec.classList.remove('block');
        }
    });
    
    if (sections[tabName]) {
        sections[tabName].classList.remove('hidden');
        sections[tabName].classList.add('block');
    }
    
    // Update active classes on both mobile and desktop navs
    document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('border-l-2', 'border-primary', 'bg-primary/10', 'text-primary', 'font-bold');
            btn.classList.remove('text-on-surface-variant');
        } else {
            btn.classList.remove('border-l-2', 'border-primary', 'bg-primary/10', 'text-primary', 'font-bold');
            btn.classList.add('text-on-surface-variant');
        }
    });
    
    // Redraw SVG chart if switching to dashboard
    if (tabName === 'dashboard') {
        const currentRange = document.getElementById('chartTimeRange').value;
        drawSVGChart(currentRange);
    }
    
    // Load validation results if switching to sentiment validation
    if (tabName === 'sentiment') {
        loadValidationResults();
    }
    
    // Scroll logs console to bottom
    if (tabName === 'logs' && logConsole) {
        logConsole.scrollTop = logConsole.scrollHeight;
    }
    
    addLog(`Navigation: Switched view tab to '${tabName}'.`);
}

// Listen to sidebar button clicks
document.querySelectorAll('.sidebar-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
        closeMobileSidebar();
    });
});

// Mobile Drawer Handlers
const mobileSidebar = document.getElementById('mobileSidebar');
const mobileOverlay = document.getElementById('mobileDrawerOverlay');

function openMobileSidebar() {
    if (mobileSidebar && mobileOverlay) {
        mobileSidebar.classList.remove('-translate-x-full');
        mobileOverlay.classList.remove('hidden');
    }
}
function closeMobileSidebar() {
    if (mobileSidebar && mobileOverlay) {
        mobileSidebar.classList.add('-translate-x-full');
        mobileOverlay.classList.add('hidden');
    }
}

document.getElementById('openMobileSidebarBtn').addEventListener('click', openMobileSidebar);
document.getElementById('closeMobileSidebarBtn').addEventListener('click', closeMobileSidebar);
mobileOverlay.addEventListener('click', closeMobileSidebar);

// Update Click counters display UI
function updateClickDisplays() {
    document.querySelectorAll('.auth-click-count-display').forEach(el => {
        el.innerText = profileClickCount;
    });
    document.querySelectorAll('.api-call-count-display').forEach(el => {
        el.innerText = apiCallCount;
    });
    
    // In dropdown menu
    const dropLoginCount = document.getElementById('loginClickCount');
    if (dropLoginCount) dropLoginCount.innerText = profileClickCount;
    
    const dropApiCount = document.getElementById('apiClickCount');
    if (dropApiCount) dropApiCount.innerText = apiCallCount;
    
    // In metadata session stats
    const metaLogCount = document.getElementById('metaLoginCount');
    if (metaLogCount) metaLogCount.innerText = localStorage.getItem('api_engine_login_count') || 0;
}

// Click count increment triggers
function registerAuthBtnClick() {
    profileClickCount++;
    localStorage.setItem('api_engine_profile_clicks', profileClickCount);
    updateClickDisplays();
}

// Login Modal Handlers
const loginModal = document.getElementById('loginModal');
const headerLoginBtn = document.getElementById('headerLoginBtn');
const closeLoginModalBtn = document.getElementById('closeLoginModalBtn');
const simulateLoginBtn = document.getElementById('simulateLoginBtn');

function openLoginModal() {
    registerAuthBtnClick();
    if (loginModal) loginModal.classList.remove('hidden');
    addLog("UI Action: Open Login Modal triggered.");
}
function closeLoginModal() {
    if (loginModal) loginModal.classList.add('hidden');
}

if (headerLoginBtn) headerLoginBtn.addEventListener('click', openLoginModal);
if (closeLoginModalBtn) closeLoginModalBtn.addEventListener('click', closeLoginModal);
document.getElementById('metaLoginTrigger').addEventListener('click', openLoginModal);

// Header Profile Dropdown toggles
const profileAvatarBtn = document.getElementById('profileAvatarBtn');
const profileDropdown = document.getElementById('profileDropdown');

if (profileAvatarBtn && profileDropdown) {
    profileAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        registerAuthBtnClick();
        profileDropdown.classList.toggle('hidden');
        addLog("UI Action: Profile Dropdown menu toggled.");
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        profileDropdown.classList.add('hidden');
    });
    profileDropdown.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent closing when clicking inside
    });
}

// Google OAuth Credential Handler (success callback)
window.handleCredentialResponse = function(response) {
    const jwt = response.credential;
    const payload = decodeJwt(jwt);
    
    localStorage.setItem('google_token', jwt);
    localStorage.setItem('user_profile', JSON.stringify(payload));
    
    // Increment login counter
    let logins = parseInt(localStorage.getItem('api_engine_login_count') || 0) + 1;
    localStorage.setItem('api_engine_login_count', logins);
    
    // Log to terminal
    addLog(`Auth: User ${payload.email} successfully logged in using Google Identity Services.`, 'success');
    
    renderAuthenticatedUI(payload);
    closeLoginModal();
    showToast("Logged in with Google!", "success");
};

// Simulated Local Login for quick testing
function handleSimulateLogin() {
    const mockClaims = {
        iss: "apiengine.simulation",
        sub: "simulated_guest_dev_1001",
        aud: "apiengine.local.origin",
        exp: Math.floor(Date.now() / 1000) + 7200,
        iat: Math.floor(Date.now() / 1000),
        name: "Developer Guest",
        email: "developer@apiengine.io",
        email_verified: true,
        picture: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=150&h=150&q=80",
        locale: "es",
        hd: "apiengine.io"
    };
    
    const mockJwt = "simulatedHeader." + btoa(JSON.stringify(mockClaims)) + ".simulatedSignature";
    
    localStorage.setItem('google_token', mockJwt);
    localStorage.setItem('user_profile', JSON.stringify(mockClaims));
    
    let logins = parseInt(localStorage.getItem('api_engine_login_count') || 0) + 1;
    localStorage.setItem('api_engine_login_count', logins);
    
    addLog("Auth: Simulated local developer guest login authenticated.", "success");
    
    renderAuthenticatedUI(mockClaims);
    closeLoginModal();
    showToast("Developer Simulation Active!", "success");
}

if (simulateLoginBtn) simulateLoginBtn.addEventListener('click', handleSimulateLogin);

// Logout Handler
function logout() {
    localStorage.removeItem('google_token');
    localStorage.removeItem('user_profile');
    
    addLog("Auth: User logged out. Clearing active credentials.", "warn");
    showToast("Signed out successfully.");
    
    renderUnauthenticatedUI();
}

document.getElementById('dropdownLogoutBtn').addEventListener('click', logout);

// UI authentication rendering state
function renderAuthenticatedUI(user) {
    // Toggle session gate and app layout
    const appGate = document.getElementById('appLoginSessionGate');
    const appLayout = document.getElementById('appLayoutContainer');
    if (appGate) appGate.classList.add('hidden');
    if (appLayout) appLayout.classList.remove('hidden');

    // Toggle header auth elements
    if (headerLoginBtn) headerLoginBtn.classList.add('hidden');
    const headerProfile = document.getElementById('headerProfileContainer');
    if (headerProfile) headerProfile.classList.remove('hidden');
    
    // Update Model Validation lock screen
    const lockedView = document.getElementById('sentimentLockedView');
    const dashboardView = document.getElementById('sentimentDashboardView');
    if (lockedView) lockedView.classList.add('hidden');
    if (dashboardView) dashboardView.classList.remove('hidden');
    
    // Auto load results if we are on the Model Validation tab
    const activeBtn = document.querySelector('.sidebar-tab-btn.text-primary');
    if (activeBtn && activeBtn.getAttribute('data-tab') === 'sentiment') {
        loadValidationResults();
    }
    
    // Header avatars
    const avatarImg = document.getElementById('userHeaderAvatar');
    if (avatarImg) avatarImg.src = user.picture;
    
    // Dropdown elements
    const dropAvatar = document.getElementById('dropdownAvatar');
    const dropName = document.getElementById('dropdownName');
    const dropEmail = document.getElementById('dropdownEmail');
    if (dropAvatar) dropAvatar.src = user.picture;
    if (dropName) dropName.innerText = user.name;
    if (dropEmail) dropEmail.innerText = user.email;
    
    // Update documentation console token input
    const apiTokenInput = document.getElementById('apiConsoleToken');
    const token = localStorage.getItem('google_token');
    if (apiTokenInput) apiTokenInput.value = token;
    
    // Update Session Metadata View
    const unauthMeta = document.getElementById('metadataUnauthView');
    const authMeta = document.getElementById('metadataAuthView');
    if (unauthMeta) unauthMeta.classList.add('hidden');
    if (authMeta) authMeta.classList.remove('hidden');
    
    // Set values inside session metadata card
    const metaAvatar = document.getElementById('metaUserAvatar');
    const metaName = document.getElementById('metaUserName');
    const metaEmail = document.getElementById('metaUserEmail');
    const metaClaimIss = document.getElementById('metaClaimIss');
    const metaClaimSub = document.getElementById('metaClaimSub');
    const metaClaimExp = document.getElementById('metaClaimExp');
    const metaAuthMethod = document.getElementById('metaAuthMethod');
    
    if (metaAvatar) metaAvatar.src = user.picture;
    if (metaName) metaName.innerText = user.name;
    if (metaEmail) metaEmail.innerText = user.email;
    if (metaClaimIss) metaClaimIss.innerText = user.iss || "N/A";
    if (metaClaimSub) metaClaimSub.innerText = user.sub || "N/A";
    
    if (metaClaimExp && user.exp) {
        const expDate = new Date(user.exp * 1000);
        metaClaimExp.innerText = expDate.toLocaleTimeString();
    }
    
    if (metaAuthMethod) {
        metaAuthMethod.innerText = (user.iss && user.iss.includes("google")) ? "Google OAuth 2.0" : "Dev Simulation";
    }
    
    // Pretty JSON viewer
    const jsonViewer = document.getElementById('metaJsonViewer');
    if (jsonViewer) {
        jsonViewer.innerText = JSON.stringify(user, null, 2);
    }
    
    updateClickDisplays();
}

function renderUnauthenticatedUI() {
    // Toggle session gate and app layout
    const appGate = document.getElementById('appLoginSessionGate');
    const appLayout = document.getElementById('appLayoutContainer');
    if (appGate) appGate.classList.remove('hidden');
    if (appLayout) appLayout.classList.add('hidden');

    if (headerLoginBtn) headerLoginBtn.classList.remove('hidden');
    const headerProfile = document.getElementById('headerProfileContainer');
    if (headerProfile) headerProfile.classList.add('hidden');
    
    // Clear token input in console docs
    const apiTokenInput = document.getElementById('apiConsoleToken');
    if (apiTokenInput) apiTokenInput.value = "";
    
    // Reset metadata cards to unauthenticated states
    const unauthMeta = document.getElementById('metadataUnauthView');
    const authMeta = document.getElementById('metadataAuthView');
    if (unauthMeta) unauthMeta.classList.remove('hidden');
    if (authMeta) authMeta.classList.add('hidden');
    
    // Lock Model Validation
    const lockedView = document.getElementById('sentimentLockedView');
    const dashboardView = document.getElementById('sentimentDashboardView');
    if (lockedView) lockedView.classList.remove('hidden');
    if (dashboardView) dashboardView.classList.add('hidden');
    validationData = null; // Clear cached state
    
    updateClickDisplays();
}

// View Metadata from Dropdown button
document.getElementById('dropdownViewMetaBtn').addEventListener('click', () => {
    switchTab('metadata');
});

// Copy JSON claims button
document.getElementById('copyMetadataJsonBtn').addEventListener('click', () => {
    const jsonViewer = document.getElementById('metaJsonViewer');
    if (jsonViewer) {
        navigator.clipboard.writeText(jsonViewer.innerText)
            .then(() => {
                addLog("System: Copied claims JSON metadata to clipboard.");
                showToast("JSON copied to clipboard!", "success");
            })
            .catch(err => {
                console.error("Failed to copy claims", err);
                showToast("Failed to copy metadata", "error");
            });
    }
});

// Check local storage session on page load
window.onload = function() {
    // Init theme
    initThemeOnLoad();
    
    const savedProfile = localStorage.getItem('user_profile');
    if (savedProfile) {
        try {
            const user = JSON.parse(savedProfile);
            renderAuthenticatedUI(user);
            addLog(`Auth: Restored session from cache for ${user.email}.`, 'success');
        } catch (err) {
            console.error("Failed to load saved session", err);
            renderUnauthenticatedUI();
        }
    } else {
        renderUnauthenticatedUI();
        addLog("System: Starting anonymous session.");
    }
    
    // Load API Keys
    renderApiKeysTable();
    
    // Update sidebar projects count
    updateProjectsCountBadge();
    
    // Load SVG Chart
    drawSVGChart("10");
    
    // Print welcome logs
    addLog("System: Gateway Engine initialized. Local NLP Model preloaded.");
};

// Theme Management functions
function initThemeOnLoad() {
    const theme = localStorage.getItem('api_engine_theme') || 'dark';
    applyThemeClass(theme);
}

window.setTheme = function(theme) {
    localStorage.setItem('api_engine_theme', theme);
    applyThemeClass(theme);
    addLog(`System: Theme preferences updated to '${theme}'.`);
    showToast(`Theme changed to ${theme}!`);
}

function applyThemeClass(theme) {
    const html = document.documentElement;
    
    // Remove active outline styles
    document.getElementById('themeDarkBtn').className = 'py-3 bg-surface-container-low border border-outline-variant rounded flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-surface transition-all';
    document.getElementById('themeLightBtn').className = 'py-3 bg-surface-container-low border border-outline-variant rounded flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-surface transition-all';
    document.getElementById('themeSystemBtn').className = 'py-3 bg-surface-container-low border border-outline-variant rounded flex flex-col items-center gap-2 text-on-surface-variant hover:text-on-surface transition-all';
    
    let appliedTheme = theme;
    if (theme === 'system') {
        const systemPref = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        appliedTheme = systemPref;
        document.getElementById('themeSystemBtn').className = 'py-3 bg-surface-container-low border-2 border-primary rounded flex flex-col items-center gap-2 text-on-surface transition-all';
    } else if (theme === 'dark') {
        document.getElementById('themeDarkBtn').className = 'py-3 bg-surface-container-low border-2 border-primary rounded flex flex-col items-center gap-2 text-on-surface transition-all';
    } else {
        document.getElementById('themeLightBtn').className = 'py-3 bg-surface-container-low border-2 border-primary rounded flex flex-col items-center gap-2 text-on-surface transition-all';
    }
    
    if (appliedTheme === 'dark') {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
}

// Reset Data callback
window.resetAllSessionData = function() {
    localStorage.clear();
    addLog("System: Local cache cleared.", "error");
    showToast("Database reset successful. Reloading...", "success");
    setTimeout(() => {
        window.location.reload();
    }, 1500);
};

// API Keys Management
let keysDatabase = JSON.parse(localStorage.getItem('api_engine_keys') || '[]');

function renderApiKeysTable() {
    const tbody = document.getElementById('apiKeysTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (keysDatabase.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="py-6 text-center text-on-surface-variant italic">
                    No custom credentials generated yet. Create one on the left.
                </td>
            </tr>
        `;
        return;
    }
    
    keysDatabase.forEach(key => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-outline-variant/30 hover:bg-surface-variant/20 transition-colors";
        
        const badgeClass = key.status === 'Active' ? 'text-primary bg-primary/10 border-primary/20' : 'text-error bg-error/10 border-error/20';
        
        // Mask the token key: show prefix, mask body, show suffix
        const maskedToken = key.token.length > 15 
            ? `${key.token.substring(0, 10)}...${key.token.substring(key.token.length - 4)}`
            : key.token;
            
        tr.innerHTML = `
            <td class="py-3 px-4 text-on-surface font-semibold">${escapeHtml(key.name)}</td>
            <td class="py-3 px-4 text-on-surface-variant font-mono flex items-center gap-1.5">
                <span>${maskedToken}</span>
                ${key.status === 'Active' ? `
                    <button onclick="copyToClipboard('${key.token}')" class="text-primary hover:text-primary-fixed p-1 rounded hover:bg-surface-variant/30 transition-all" title="Copy Key">
                        <span class="material-symbols-outlined text-[14px] align-middle">content_copy</span>
                    </button>
                ` : ''}
            </td>
            <td class="py-3 px-4 text-on-surface-variant">${key.created}</td>
            <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-xs border ${badgeClass}">${key.status}</span>
            </td>
            <td class="py-3 px-4 text-right">
                ${key.status === 'Active' ? `
                    <button onclick="revokeKey('${key.id}')" class="text-xs text-error hover:underline active:scale-95 transition-all">
                        Revoke
                    </button>
                ` : `
                    <span class="text-xs text-on-surface-variant select-none">Revoked</span>
                `}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Generate Key form handler
document.getElementById('generateKeyForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('keyNameInput');
    const name = input.value.trim();
    if (!name) return;
    
    // Generate random string
    const randStr = Array.from({length: 24}, () => Math.random().toString(36)[2]).join('');
    const newKey = {
        id: 'id_' + Date.now(),
        name: name,
        token: 'ak_live_' + randStr.substring(0, 16),
        created: new Date().toLocaleDateString(),
        status: 'Active'
    };
    
    keysDatabase.unshift(newKey);
    localStorage.setItem('api_engine_keys', JSON.stringify(keysDatabase));
    
    input.value = '';
    renderApiKeysTable();
    
    const maskedLogToken = newKey.token.length > 15 
        ? `${newKey.token.substring(0, 10)}...${newKey.token.substring(newKey.token.length - 4)}`
        : newKey.token;
        
    addLog(`System Credentials: Generated new key '${newKey.name}' (${maskedLogToken}).`, "success");
    showToast("API Key successfully generated!", "success");
});

// Revoke key handler
window.revokeKey = function(keyId) {
    keysDatabase = keysDatabase.map(key => {
        if (key.id === keyId) {
            key.status = 'Revoked';
            addLog(`System Credentials: Revoked access for key '${key.name}'.`, "warn");
        }
        return key;
    });
    localStorage.setItem('api_engine_keys', JSON.stringify(keysDatabase));
    renderApiKeysTable();
    showToast("API Key status changed.", "warn");
};

// Try it out API Console Executor
const apiConsoleTestBtn = document.getElementById('apiConsoleTestBtn');
const apiConsoleResponseBox = document.getElementById('apiConsoleResponseBox');
const apiConsoleResponseStatus = document.getElementById('apiConsoleResponseStatus');
const apiConsoleToken = document.getElementById('apiConsoleToken');

if (apiConsoleTestBtn) {
    apiConsoleTestBtn.addEventListener('click', async () => {
        // Track call count
        apiCallCount++;
        localStorage.setItem('api_engine_api_calls', apiCallCount);
        updateClickDisplays();
        
        // Check simulator configurations
        const simLatency = document.getElementById('toggleLatencySimulation').checked;
        const simError = document.getElementById('toggleErrorSimulation').checked;
        const customToken = apiConsoleToken.value.trim();
        
        apiConsoleResponseBox.innerText = "Connecting with Gateway REST Endpoint...";
        apiConsoleResponseStatus.innerText = "PENDING";
        apiConsoleResponseStatus.className = "font-bold text-secondary-container animate-pulse";
        
        // Delay simulation
        if (simLatency) {
            const msDelay = 300 + Math.floor(Math.random() * 500);
            addLog(`API Gateway: Adding artificial simulated delay (${msDelay}ms)...`, 'warn');
            await new Promise(resolve => setTimeout(resolve, msDelay));
        }
        
        const start = performance.now();
        
        // If forcing error simulation
        if (simError) {
            const end = performance.now();
            const latency = (end - start).toFixed(1);
            
            apiConsoleResponseStatus.innerText = "500 Internal Server Error";
            apiConsoleResponseStatus.className = "font-bold text-error";
            
            const errData = {
                error: "InternalServerException",
                message: "Simulated gateway error active. Disable this option in Settings.",
                timestamp: new Date().toISOString(),
                latency: `${latency}ms`,
                status: 500
            };
            apiConsoleResponseBox.innerHTML = `<span class="text-error">${JSON.stringify(errData, null, 2)}</span>`;
            
            addLog(`GET /api/saludo - 500 Internal Server Error (${latency}ms) - Forced simulation`, 'error');
            
            // Increment Error Rate statistics slightly on dashboard for realism
            let errVal = parseFloat(document.getElementById('statErrorRate').innerText) + 0.02;
            document.getElementById('statErrorRate').innerText = `${errVal.toFixed(2)}%`;
            
            return;
        }
        
        // Real fetch call to backend Flask application
        try {
            const headers = {};
            if (customToken) {
                headers['Authorization'] = `Bearer ${customToken}`;
            }
            
            const response = await fetch('/api/saludo', { headers });
            const end = performance.now();
            const latency = (end - start).toFixed(1);
            
            const data = await response.json();
            
            if (response.ok) {
                apiConsoleResponseStatus.innerText = `${response.status} OK`;
                apiConsoleResponseStatus.className = "font-bold text-primary";
                
                // Add latency to JSON payload output
                data.response_latency = `${latency}ms`;
                apiConsoleResponseBox.innerText = JSON.stringify(data, null, 2);
                
                addLog(`GET /api/saludo - 200 OK (${latency}ms) token=${customToken ? 'active' : 'anonymous'}`, 'success');
                
                // Increment Total request metrics on dashboard
                incrementDashboardRequests();
            } else {
                apiConsoleResponseStatus.innerText = `${response.status} Error`;
                apiConsoleResponseStatus.className = "font-bold text-error";
                apiConsoleResponseBox.innerText = JSON.stringify(data, null, 2);
                
                addLog(`GET /api/saludo - ${response.status} Error (${latency}ms)`, 'error');
            }
        } catch (err) {
            const end = performance.now();
            const latency = (end - start).toFixed(1);
            
            apiConsoleResponseStatus.innerText = "Network Error";
            apiConsoleResponseStatus.className = "font-bold text-error";
            apiConsoleResponseBox.innerText = `Network Connection Error: ${err.message}`;
            
            addLog(`GET /api/saludo - Failed to fetch (${latency}ms) error=${err.message}`, 'error');
        }
    });
}

// Incrementor for dashboard stats
function incrementDashboardRequests() {
    const reqEl = document.getElementById('statTotalRequests');
    if (reqEl) {
        let curr = parseInt(reqEl.innerText.replace(/,/g, ''));
        reqEl.innerText = (curr + 1).toLocaleString();
    }
}

// Global search filtering on Cluster environment table
const globalSearchInput = document.getElementById('globalSearchInput');
if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        const tableRows = document.querySelectorAll('#clusterTable tbody tr');
        
        tableRows.forEach(row => {
            const envCell = row.cells[0].innerText.toLowerCase();
            const regionCell = row.cells[1].innerText.toLowerCase();
            const statusCell = row.cells[2].innerText.toLowerCase();
            
            if (envCell.includes(query) || regionCell.includes(query) || statusCell.includes(query)) {
                row.classList.remove('hidden');
            } else {
                row.classList.add('hidden');
            }
        });
    });
}

// Dynamic premium SVG chart rendering
function drawSVGChart(period) {
    const container = document.getElementById('chartContainer');
    if (!container) return;
    
    container.innerHTML = ''; // Clear contents
    
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 240;
    const padding = 35;
    
    // If validation data is not loaded yet, show a nice loader/placeholder
    if (!validationData || !validationData.records || validationData.records.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-on-surface-variant italic text-xs">
                Waiting for authentication and database synchronization...
            </div>
        `;
        return;
    }
    
    // Slice data based on selected period/records count
    let dataSlice = [...validationData.records];
    if (period === '10') {
        dataSlice = dataSlice.slice(-10);
    } else if (period === '20') {
        dataSlice = dataSlice.slice(-20);
    }
    
    const numPoints = dataSlice.length;
    if (numPoints === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-on-surface-variant italic text-xs">
                No validation data matching the slice scope.
            </div>
        `;
        return;
    }
    
    const latencies = dataSlice.map(r => r.latency_ms);
    const confidences = dataSlice.map(r => r.confidence * 100);
    
    const maxLat = Math.max(...latencies, 10);
    const minLat = 0;
    
    // Coordinate generation
    const points = dataSlice.map((r, index) => {
        const x = padding + (index / (numPoints - 1 || 1)) * (width - 2 * padding);
        const yLat = height - padding - (r.latency_ms / maxLat) * (height - 2 * padding);
        const yConf = height - padding - (r.confidence) * (height - 2 * padding); // confidence is 0.0 to 1.0
        return { x, yLat, yConf, record: r };
    });
    
    // Draw paths
    const getPathString = (fieldY) => {
        if (points.length === 0) return "";
        let path = `M ${points[0].x} ${points[0][fieldY]}`;
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i];
            const p1 = points[i+1];
            // Simple curve
            const cpX1 = p0.x + (p1.x - p0.x) / 3;
            const cpY1 = p0[fieldY];
            const cpX2 = p0.x + 2 * (p1.x - p0.x) / 3;
            const cpY2 = p1[fieldY];
            path += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1[fieldY]}`;
        }
        return path;
    };
    
    const latencyPath = getPathString('yLat');
    const confidencePath = getPathString('yConf');
    const latFillPath = `${latencyPath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("class", "overflow-visible select-none");
    
    svg.innerHTML = `
        <defs>
            <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#4edea3" stop-opacity="0.2"/>
                <stop offset="100%" stop-color="#4edea3" stop-opacity="0.0"/>
            </linearGradient>
        </defs>
        
        <!-- Y Grid lines -->
        <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" stroke="rgba(60, 74, 66, 0.15)" stroke-dasharray="3"/>
        <line x1="${padding}" y1="${(height) / 2}" x2="${width - padding}" y2="${(height) / 2}" stroke="rgba(60, 74, 66, 0.15)" stroke-dasharray="3"/>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="rgba(60, 74, 66, 0.4)"/>
        
        <!-- X Axis -->
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="rgba(60, 74, 66, 0.4)"/>
        
        <!-- Paths -->
        <path d="${latFillPath}" fill="url(#latencyGrad)" />
        <path d="${latencyPath}" fill="none" stroke="#4edea3" stroke-width="2.5" stroke-linecap="round" />
        <path d="${confidencePath}" fill="none" stroke="#adc6ff" stroke-width="2" stroke-dasharray="4" stroke-linecap="round" />
        
        <!-- Hover tracker guide -->
        <line id="trackerLine" x1="0" y1="${padding}" x2="0" y2="${height - padding}" stroke="rgba(173, 198, 255, 0.2)" stroke-width="1.5" class="hidden pointer-events-none"/>
        <circle id="latAnchor" r="5" fill="#4edea3" stroke="#0b1326" stroke-width="2" class="hidden pointer-events-none"/>
        <circle id="confAnchor" r="4.5" fill="#adc6ff" stroke="#0b1326" stroke-width="1.5" class="hidden pointer-events-none"/>
    `;
    
    container.appendChild(svg);
    
    // Tooltip overlay
    const tooltip = document.createElement('div');
    tooltip.className = 'absolute bg-surface-container-high border border-outline-variant p-3 rounded text-[11px] text-on-surface shadow-2xl pointer-events-none hidden z-20 flex flex-col gap-1.5 min-w-[150px]';
    container.appendChild(tooltip);
    
    const trackerLine = svg.getElementById('trackerLine');
    const latAnchor = svg.getElementById('latAnchor');
    const confAnchor = svg.getElementById('confAnchor');
    
    container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        
        if (mouseX < padding || mouseX > width - padding) {
            hideHoverTracker();
            return;
        }
        
        let closestPt = points[0];
        let closestIndex = 0;
        let minDist = Math.abs(points[0].x - mouseX);
        
        for (let i = 1; i < points.length; i++) {
            const dist = Math.abs(points[i].x - mouseX);
            if (dist < minDist) {
                minDist = dist;
                closestPt = points[i];
                closestIndex = i;
            }
        }
        
        if (trackerLine && latAnchor && confAnchor) {
            trackerLine.setAttribute('x1', closestPt.x);
            trackerLine.setAttribute('x2', closestPt.x);
            trackerLine.classList.remove('hidden');
            
            latAnchor.setAttribute('cx', closestPt.x);
            latAnchor.setAttribute('cy', closestPt.yLat);
            latAnchor.classList.remove('hidden');
            
            confAnchor.setAttribute('cx', closestPt.x);
            confAnchor.setAttribute('cy', closestPt.yConf);
            confAnchor.classList.remove('hidden');
        }
        
        const rec = closestPt.record;
        const matchBadge = rec.correct 
            ? '<span class="text-primary font-semibold font-mono bg-primary/10 px-1 border border-primary/20 rounded">Correct</span>'
            : '<span class="text-error font-semibold font-mono bg-error/10 px-1 border border-error/20 rounded">Mismatch</span>';
            
        tooltip.innerHTML = `
            <div class="font-bold border-b border-outline-variant/30 pb-1 mb-1 text-on-surface">Record ID: ${rec.id}</div>
            <div class="text-[10px] text-on-surface-variant truncate max-w-[150px] mb-1">Entity: ${escapeHtml(rec.entity)}</div>
            <div class="flex justify-between">
                <span>Latency:</span>
                <span class="font-bold font-mono text-primary">${rec.latency_ms.toFixed(1)} ms</span>
            </div>
            <div class="flex justify-between">
                <span>Confidence:</span>
                <span class="font-bold font-mono text-secondary">${(rec.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="flex justify-between mt-1 pt-1 border-t border-outline-variant/10">
                <span>Match:</span>
                <span>${matchBadge}</span>
            </div>
        `;
        
        tooltip.classList.remove('hidden');
        
        let tooltipX = closestPt.x + 15;
        if (tooltipX + 160 > width) {
            tooltipX = closestPt.x - 165;
        }
        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${Math.min(closestPt.yLat, closestPt.yConf) - 10}px`;
    });
    
    container.addEventListener('mouseleave', hideHoverTracker);
    
    function hideHoverTracker() {
        if (tooltip) tooltip.classList.add('hidden');
        if (trackerLine) trackerLine.classList.add('hidden');
        if (latAnchor) latAnchor.classList.add('hidden');
        if (confAnchor) confAnchor.classList.add('hidden');
    }
}

// Add event listener to redraw on resize
window.addEventListener('resize', () => {
    const currentRange = document.getElementById('chartTimeRange').value;
    drawSVGChart(currentRange);
});

// Chart select listener
document.getElementById('chartTimeRange').addEventListener('change', (e) => {
    drawSVGChart(e.target.value);
    addLog(`System: Redrawing charts for range filters '${e.target.value}'.`);
});

// // New Project Modal functions
window.handleNewProjectClick = function() {
    let clicks = parseInt(localStorage.getItem('new_project_clicks') || 0);
    clicks++;
    localStorage.setItem('new_project_clicks', clicks);
    
    addLog(`UI Action: New Project button clicked. Total clicks: ${clicks}.`);
    
    const clicksDisplay = document.getElementById('newProjectClicksDisplay');
    if (clicksDisplay) clicksDisplay.innerText = clicks;
    
    const modal = document.getElementById('newProjectModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeNewProjectModal = function() {
    const modal = document.getElementById('newProjectModal');
    if (modal) modal.classList.add('hidden');
};

window.handleNewProjectSubmit = function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('newProjectName');
    const descInput = document.getElementById('newProjectDescription');
    const modelInput = document.getElementById('newProjectModel');
    
    const newProject = {
        id: 'proj_' + Date.now(),
        name: nameInput.value.trim(),
        description: descInput.value.trim(),
        model: modelInput.value,
        created: new Date().toLocaleDateString()
    };
    
    projectsList.push(newProject);
    localStorage.setItem('api_engine_projects', JSON.stringify(projectsList));
    
    document.getElementById('newProjectForm').reset();
    closeNewProjectModal();
    
    addLog(`System: Created new validation project '${newProject.name}' with model '${newProject.model}'.`, 'success');
    showToast(`Project '${newProject.name}' created!`, 'success');
    
    updateProjectsCountBadge();
};
window.handleConsoleBtnClick = function(btnType) {
    addLog(`UI Action: Clicked terminal/console toggle for '${btnType}'.`);
    showToast(`Opened ${btnType} console.`);
};
window.handleViewMapClick = function() {
    addLog("UI Action: Redirecting to cluster map overlay...");
    showToast("Fetching coordinates map...");
};

// Support ticket submit
document.getElementById('supportForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = document.getElementById('supportSubject').value;
    const severity = document.getElementById('supportSeverity').value;
    const desc = document.getElementById('supportDescription').value;
    
    addLog(`Support Desk: Ticket submitted - '${subject}' Severity=[${severity.toUpperCase()}]`, 'success');
    showToast("Support ticket successfully submitted!", "success");
    
    document.getElementById('supportForm').reset();
});

// Global copy utility helper
window.copyToClipboard = function(text) {
    navigator.clipboard.writeText(text)
        .then(() => {
            addLog("System: Copied sensitive API credential/token to clipboard.");
            showToast("Copied to clipboard!", "success");
        })
        .catch(err => {
            console.error("Clipboard copy failed:", err);
            showToast("Failed to copy credential", "error");
        });
};

// Console token field visibility toggle with secure non-autofill text security masking
const toggleTokenBtn = document.getElementById('toggleConsoleTokenVisibilityBtn');
const tokenInputField = document.getElementById('apiConsoleToken');

if (toggleTokenBtn && tokenInputField) {
    // Start masked by default using standard text security styling
    tokenInputField.style.webkitTextSecurity = 'disc';
    
    toggleTokenBtn.addEventListener('click', () => {
        const iconSpan = toggleTokenBtn.querySelector('.material-symbols-outlined');
        if (tokenInputField.style.webkitTextSecurity === 'disc') {
            tokenInputField.style.webkitTextSecurity = 'none';
            if (iconSpan) iconSpan.innerText = 'visibility_off';
            addLog("UI Action: Revealed API Console Token.");
        } else {
            tokenInputField.style.webkitTextSecurity = 'disc';
            if (iconSpan) iconSpan.innerText = 'visibility';
            addLog("UI Action: Masked API Console Token.");
        }
    });
}

// ==========================================
// MODEL VALIDATION SYSTEM CODES
// ==========================================
let validationData = null;
let currentDistObjectUrl = null;
let currentHeatmapObjectUrl = null;
let currentCorrelationObjectUrl = null;

// Tab switcher for sub-sections in Model Validation
window.switchValTab = function(subTabName) {
    // Hide all validation content panels
    document.querySelectorAll('.val-tab-content').forEach(el => {
        el.classList.add('hidden');
    });
    
    // Show selected panel
    const targetPanel = document.getElementById(`val-content-${subTabName}`);
    if (targetPanel) {
        targetPanel.classList.remove('hidden');
    }
    
    // Toggle active style on sub-tab buttons
    document.querySelectorAll('.val-tab-btn').forEach(btn => {
        if (btn.id === `val-tab-btn-${subTabName}`) {
            btn.classList.add('bg-primary/20', 'text-primary');
            btn.classList.remove('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-variant/30');
        } else {
            btn.classList.remove('bg-primary/20', 'text-primary');
            btn.classList.add('text-on-surface-variant', 'hover:text-on-surface', 'hover:bg-surface-variant/30');
        }
    });
    
    addLog(`Model Validation: Switched sub-tab to '${subTabName}'.`);

    // Redraw/Render charts when tab is visible
    if (subTabName === 'charts' && validationData) {
        runChartsFilterAndRender();
        renderValidationLatencyChart(validationData.records, validationData.metrics.avg_latency_ms);
        reloadMatplotlibCharts();
    }
};

// Loader function for backend-generated Matplotlib analytics
window.reloadMatplotlibCharts = async function() {
    addLog("Matplotlib: Fetching advanced analytical reports...");
    
    const token = localStorage.getItem('google_token');
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    async function loadChart(endpoint, imgId, loadingId, urlStore) {
        const imgEl = document.getElementById(imgId);
        const loadEl = document.getElementById(loadingId);
        if (!imgEl || !loadEl) return;
        
        loadEl.innerHTML = "Generating plot in backend...";
        loadEl.classList.remove('hidden');
        imgEl.classList.add('hidden');
        
        try {
            const res = await fetch(endpoint, { headers });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const blob = await res.blob();
            
            // Revoke old object URL if it exists
            if (urlStore === 'currentDistObjectUrl' && currentDistObjectUrl) {
                URL.revokeObjectURL(currentDistObjectUrl);
                currentDistObjectUrl = null;
            } else if (urlStore === 'currentHeatmapObjectUrl' && currentHeatmapObjectUrl) {
                URL.revokeObjectURL(currentHeatmapObjectUrl);
                currentHeatmapObjectUrl = null;
            } else if (urlStore === 'currentCorrelationObjectUrl' && currentCorrelationObjectUrl) {
                URL.revokeObjectURL(currentCorrelationObjectUrl);
                currentCorrelationObjectUrl = null;
            }
            
            const url = URL.createObjectURL(blob);
            
            if (urlStore === 'currentDistObjectUrl') currentDistObjectUrl = url;
            else if (urlStore === 'currentHeatmapObjectUrl') currentHeatmapObjectUrl = url;
            else if (urlStore === 'currentCorrelationObjectUrl') currentCorrelationObjectUrl = url;
            
            imgEl.src = url;
            imgEl.onload = () => {
                loadEl.classList.add('hidden');
                imgEl.classList.remove('hidden');
            };
        } catch (err) {
            console.error(`Error loading chart ${endpoint}:`, err);
            loadEl.innerHTML = `<span class="text-error font-semibold">Failed to load chart: ${err.message}</span>`;
            addLog(`Matplotlib Error: Failed to load chart from ${endpoint}. ${err.message}`, "error");
        }
    }
    
    await Promise.all([
        loadChart('/api/charts/distribution', 'mplDistImg', 'mplDistLoading', 'currentDistObjectUrl'),
        loadChart('/api/charts/confusion-matrix', 'mplHeatmapImg', 'mplHeatmapLoading', 'currentHeatmapObjectUrl'),
        loadChart('/api/charts/correlation', 'mplCorrelationImg', 'mplCorrelationLoading', 'currentCorrelationObjectUrl')
    ]);
    
    addLog("Matplotlib: Advanced analytical reports refreshed successfully.", "success");
};

// Fetch validation results from backend API
window.loadValidationResults = async function(force = false) {
    if (validationData && !force) return; // Load only once per session or reload on demand

    const limitSelect = document.getElementById('validationLimitSelect');
    const limit = limitSelect ? limitSelect.value : '20';
    if (limitSelect) limitSelect.disabled = true;

    addLog(`Model Validation: Requesting dataset evaluation (${limit} records) from FastAPI backend...`);
    
    try {
        const token = localStorage.getItem('google_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/validation-results?limit=${limit}`, { headers });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        validationData = await response.json();
        renderValidationMetrics(validationData.metrics);
        renderValidationTable(validationData.records);
        renderValidationCharts(validationData.distributions);
        
        // Always redraw Overview SVG chart if the container exists
        const chartTimeRangeEl = document.getElementById('chartTimeRange');
        const chartRange = chartTimeRangeEl ? chartTimeRangeEl.value : '10';
        drawSVGChart(chartRange);

        // Always render validation latency chart and reload Matplotlib charts
        renderValidationLatencyChart(validationData.records, validationData.metrics.avg_latency_ms);
        reloadMatplotlibCharts();
        
        addLog(`Model Validation: Successfully loaded ${validationData.records.length} samples. Alignment Accuracy: ${(validationData.metrics.accuracy * 100).toFixed(1)}%.`, "success");
    } catch (err) {
        console.error("Error loading validation results:", err);
        addLog(`Model Validation Error: Failed to fetch results. ${err.message}`, "error");
        showToast("Error loading model validation data", "error");
    } finally {
        if (limitSelect) limitSelect.disabled = false;
    }
};

function renderValidationMetrics(metrics) {
    document.getElementById('valAccuracy').innerText = `${(metrics.accuracy * 100).toFixed(1)}%`;
    document.getElementById('valTotalSamples').innerText = metrics.total_samples;
    document.getElementById('valAvgConfidence').innerText = `${(metrics.avg_confidence * 100).toFixed(1)}%`;
    document.getElementById('valAvgLatency').innerText = metrics.avg_latency_ms;
    
    // Update main dashboard Overview metrics
    const totalRequestsEl = document.getElementById('statTotalRequests');
    if (totalRequestsEl) {
        totalRequestsEl.innerText = (metrics.total_samples + apiCallCount).toLocaleString();
    }
    const avgLatencyEl = document.getElementById('statAvgLatency');
    if (avgLatencyEl) {
        avgLatencyEl.innerText = metrics.avg_latency_ms;
    }
    const statAccuracyEl = document.getElementById('statModelAccuracy');
    if (statAccuracyEl) {
        statAccuracyEl.innerText = `${(metrics.accuracy * 100).toFixed(1)}%`;
    }
}

function renderValidationTable(records) {
    const tbody = document.getElementById('valTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (records.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-6 text-center text-on-surface-variant italic">No data records found.</td>
            </tr>
        `;
        return;
    }
    
    records.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-outline-variant/20 hover:bg-surface-variant/20 transition-colors";
        
        // Format Status badge
        let statusBadge = '';
        if (row.correct) {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold border border-primary/20 bg-primary/10 text-primary">Correct Match</span>';
        } else {
            statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold border border-error/20 bg-error/10 text-error">Mismatch</span>';
        }
        
        // Color predicted label
        const predClass = row.prediction === 'POSITIVE' ? 'text-primary font-semibold' : 'text-error font-semibold';
        
        // Color dataset label
        let origClass = 'text-on-surface-variant';
        if (row.sentiment.toLowerCase() === 'positive') origClass = 'text-primary';
        if (row.sentiment.toLowerCase() === 'negative') origClass = 'text-error';
        if (row.sentiment.toLowerCase() === 'neutral') origClass = 'text-secondary';
        
        tr.innerHTML = `
            <td class="py-3 px-4 text-on-surface-variant font-mono font-bold">${row.id}</td>
            <td class="py-3 px-4 font-semibold text-on-surface">${escapeHtml(row.entity)}</td>
            <td class="py-3 px-4 text-on-surface-variant max-w-[280px] truncate" title="${escapeHtml(row.tweet)}">${escapeHtml(row.tweet)}</td>
            <td class="py-3 px-4 ${origClass}">${row.sentiment}</td>
            <td class="py-3 px-4 ${predClass}">${row.prediction}</td>
            <td class="py-3 px-4 font-semibold text-on-surface">${(row.confidence * 100).toFixed(1)}%</td>
            <td class="py-3 px-4">${statusBadge}</td>
            <td class="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                <button onclick="openEditSampleModal(${row.id})" class="text-primary hover:text-primary-fixed p-1 rounded hover:bg-surface-variant/30 transition-all" title="Edit Tweet">
                    <span class="material-symbols-outlined text-[16px] align-middle">edit</span>
                </button>
                <button onclick="deleteValidationSample(${row.id})" class="text-error hover:text-error-container p-1 rounded hover:bg-surface-variant/30 transition-all" title="Delete Tweet">
                    <span class="material-symbols-outlined text-[16px] align-middle">delete</span>
                </button>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

let filtersInitialized = false;
function setupValidationChartFilters() {
    if (filtersInitialized) return;
    filtersInitialized = true;
    
    const chartTypeSelect = document.getElementById('valChartTypeSelect');
    const entitySelect = document.getElementById('valChartEntitySelect');
    const correctnessSelect = document.getElementById('valChartCorrectnessSelect');
    const confidenceSelect = document.getElementById('valChartConfidenceSelect');
    
    if (chartTypeSelect) chartTypeSelect.addEventListener('change', runChartsFilterAndRender);
    if (entitySelect) entitySelect.addEventListener('change', runChartsFilterAndRender);
    if (correctnessSelect) correctnessSelect.addEventListener('change', runChartsFilterAndRender);
    if (confidenceSelect) confidenceSelect.addEventListener('change', runChartsFilterAndRender);
}

function populateEntityFilter(records) {
    const select = document.getElementById('valChartEntitySelect');
    if (!select) return;
    
    const currentValue = select.value;
    const entities = [...new Set(records.map(r => r.entity))].sort();
    
    select.innerHTML = '<option value="all">All Entities</option>';
    entities.forEach(ent => {
        const opt = document.createElement('option');
        opt.value = ent;
        opt.innerText = ent;
        select.appendChild(opt);
    });
    
    if (entities.includes(currentValue)) {
        select.value = currentValue;
    } else {
        select.value = 'all';
    }
}

function runChartsFilterAndRender() {
    if (!validationData || !validationData.records) return;
    
    const chartType = document.getElementById('valChartTypeSelect').value;
    const selectedEntity = document.getElementById('valChartEntitySelect').value;
    const selectedCorrectness = document.getElementById('valChartCorrectnessSelect').value;
    const selectedConfidence = document.getElementById('valChartConfidenceSelect').value;
    
    let filtered = [...validationData.records];
    
    if (selectedEntity !== 'all') {
        filtered = filtered.filter(r => r.entity === selectedEntity);
    }
    
    if (selectedCorrectness === 'correct') {
        filtered = filtered.filter(r => r.correct === true);
    } else if (selectedCorrectness === 'incorrect') {
        filtered = filtered.filter(r => r.correct === false);
    }
    
    if (selectedConfidence === 'high') {
        filtered = filtered.filter(r => r.confidence >= 0.9);
    } else if (selectedConfidence === 'medium') {
        filtered = filtered.filter(r => r.confidence >= 0.7 && r.confidence < 0.9);
    } else if (selectedConfidence === 'low') {
        filtered = filtered.filter(r => r.confidence < 0.7);
    }
    
    const originalDist = {};
    const predictedDist = { 'POSITIVE': 0, 'NEGATIVE': 0 };
    
    filtered.forEach(r => {
        originalDist[r.sentiment] = (originalDist[r.sentiment] || 0) + 1;
        predictedDist[r.prediction] = (predictedDist[r.prediction] || 0) + 1;
    });
    
    const origContainer = document.getElementById('chartDistOriginal');
    const predContainer = document.getElementById('chartDistPredicted');
    
    if (!origContainer || !predContainer) return;
    
    if (filtered.length === 0) {
        origContainer.innerHTML = '<div class="text-xs text-on-surface-variant italic py-6 text-center w-full">No records match filters.</div>';
        predContainer.innerHTML = '<div class="text-xs text-on-surface-variant italic py-6 text-center w-full">No records match filters.</div>';
        return;
    }
    
    if (chartType === 'bar') {
        renderHorizontalBars(origContainer, originalDist);
        renderHorizontalBars(predContainer, predictedDist);
    } else if (chartType === 'histogram') {
        renderVerticalHistogram(origContainer, originalDist);
        renderVerticalHistogram(predContainer, predictedDist);
    } else if (chartType === 'pie') {
        renderSvgPieChart(origContainer, originalDist, false);
        renderSvgPieChart(predContainer, predictedDist, false);
    } else if (chartType === 'donut') {
        renderSvgPieChart(origContainer, originalDist, true);
        renderSvgPieChart(predContainer, predictedDist, true);
    }
}

function renderHorizontalBars(container, data) {
    container.innerHTML = '';
    container.className = 'space-y-3 min-h-[220px] flex flex-col justify-center w-full';
    const maxVal = Math.max(...Object.values(data), 1);
    const colors = {
        'positive': 'bg-primary',
        'negative': 'bg-error',
        'neutral': 'bg-secondary',
        'irrelevant': 'bg-surface-variant',
        'POSITIVE': 'bg-primary',
        'NEGATIVE': 'bg-error'
    };
    
    Object.keys(data).forEach(key => {
        const val = data[key];
        const pct = (val / maxVal) * 100;
        const barColor = colors[key] || colors[key.toLowerCase()] || 'bg-surface-variant';
        
        const row = document.createElement('div');
        row.className = "space-y-1 w-full";
        row.innerHTML = `
            <div class="flex justify-between text-xs">
                <span class="text-on-surface-variant font-semibold">${key}</span>
                <span class="text-on-surface font-mono font-semibold">${val} tweets</span>
            </div>
            <div class="w-full bg-surface-container-high rounded-full h-3 overflow-hidden">
                <div class="h-full rounded-full ${barColor} transition-all duration-700" style="width: ${pct}%"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

function renderVerticalHistogram(container, data) {
    container.innerHTML = '';
    container.className = 'min-h-[220px] flex flex-col justify-end w-full';
    const maxVal = Math.max(...Object.values(data), 1);
    const maxBarHeight = 160; // pixels
    const colors = {
        'positive': '#4edea3',
        'negative': '#ffb4ab',
        'neutral': '#adc6ff',
        'irrelevant': '#47536d',
        'POSITIVE': '#4edea3',
        'NEGATIVE': '#ffb4ab'
    };
    
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `display:flex; align-items:flex-end; justify-content:space-around; width:100%; height:${maxBarHeight + 30}px; border-bottom:1px solid rgba(60,74,66,0.3); padding-bottom:4px; padding-top:8px;`;
    
    Object.keys(data).forEach(key => {
        const val = data[key];
        const barHeight = maxVal > 0 ? Math.max((val / maxVal) * maxBarHeight, val > 0 ? 8 : 0) : 0;
        const barColor = colors[key] || colors[key.toLowerCase()] || '#47536d';
        
        const barCol = document.createElement('div');
        barCol.style.cssText = 'display:flex; flex-direction:column; align-items:center; gap:6px; flex:1; position:relative; cursor:pointer;';
        barCol.innerHTML = `
            <div style="font-size:10px; font-weight:700; color:#c1cad4; margin-bottom:2px; font-family:monospace;">${val}</div>
            <div style="width:32px; height:${barHeight}px; background:${barColor}; border-radius:4px 4px 0 0; transition:height 0.7s ease, opacity 0.3s; min-height:${val > 0 ? '4px' : '0px'};"></div>
            <span style="font-size:10px; color:#86948a; font-weight:700; max-width:70px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${key}">${key}</span>
        `;
        wrapper.appendChild(barCol);
    });
    
    container.appendChild(wrapper);
}

function renderSvgPieChart(container, data, isDonut = false) {
    container.innerHTML = '';
    container.className = 'min-h-[220px] flex flex-col justify-center items-center w-full';
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) {
        container.innerHTML = '<div class="text-xs text-on-surface-variant italic">No data matching filters.</div>';
        return;
    }

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "130");
    svg.setAttribute("height", "130");
    svg.setAttribute("viewBox", "0 0 200 200");
    svg.setAttribute("class", "mx-auto");

    let startAngle = -Math.PI / 2;
    const colors = {
        'positive': '#4edea3',
        'negative': '#ffb4ab',
        'neutral': '#adc6ff',
        'irrelevant': '#47536d',
        'POSITIVE': '#4edea3',
        'NEGATIVE': '#ffb4ab'
    };

    const keys = Object.keys(data);

    keys.forEach(key => {
        const val = data[key];
        if (val === 0) return;
        const percent = val / total;
        
        const x1 = 100 + 80 * Math.cos(startAngle);
        const y1 = 100 + 80 * Math.sin(startAngle);
        
        const endAngle = startAngle + (percent * 2 * Math.PI);
        const x2 = 100 + 80 * Math.cos(endAngle);
        const y2 = 100 + 80 * Math.sin(endAngle);
        
        const largeArcFlag = percent > 0.5 ? 1 : 0;
        
        let pathData = '';
        if (percent >= 0.999) {
            pathData = `M 100 20 A 80 80 0 1 1 99.9 20 Z`;
        } else {
            pathData = [
                `M 100 100`,
                `L ${x1} ${y1}`,
                `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                `Z`
            ].join(' ');
        }
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        const color = colors[key] || colors[key.toLowerCase()] || '#86948a';
        path.setAttribute("fill", color);
        path.setAttribute("class", "transition-all duration-300 hover:opacity-85 cursor-pointer");
        
        const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
        title.textContent = `${key}: ${val} (${(percent * 100).toFixed(1)}%)`;
        path.appendChild(title);
        
        svg.appendChild(path);
        
        startAngle = endAngle;
    });

    if (isDonut) {
        const innerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        innerCircle.setAttribute("cx", "100");
        innerCircle.setAttribute("cy", "100");
        innerCircle.setAttribute("r", "45");
        innerCircle.setAttribute("fill", "#171f33");
        innerCircle.setAttribute("class", "dark:fill-surface-container fill-surface");
        svg.appendChild(innerCircle);
    }

    container.appendChild(svg);
    
    const legend = document.createElement('div');
    legend.className = "grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-[10px] w-full border-t border-outline-variant/10 pt-2";
    keys.forEach(key => {
        const val = data[key];
        const percent = val / total;
        const color = colors[key] || colors[key.toLowerCase()] || '#86948a';
        legend.innerHTML += `
            <div class="flex items-center gap-1">
                <span class="w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${color}"></span>
                <span class="text-on-surface-variant font-semibold truncate max-w-[50px]" title="${key}">${key}</span>
                <span class="text-on-surface font-mono ml-auto font-semibold">${val} (${(percent * 100).toFixed(0)}%)</span>
            </div>
        `;
    });
    container.appendChild(legend);
}

function renderValidationCharts(distributions) {
    populateEntityFilter(validationData.records);
    setupValidationChartFilters();
    runChartsFilterAndRender();
}

// Render Interactive SVG Latency Chart
function renderValidationLatencyChart(records, avgLatency) {
    const container = document.getElementById('valLatencyChartContainer');
    if (!container) return;
    
    container.innerHTML = ''; // Clear container
    
    // Set text statistics element
    const statsEl = document.getElementById('latencyChartStats');
    if (statsEl) {
        statsEl.innerText = `Avg: ${avgLatency ? avgLatency.toFixed(2) : '--'} ms`;
    }
    
    if (!records || records.length === 0) {
        container.innerHTML = `
            <div class="flex items-center justify-center h-full text-on-surface-variant italic text-xs">
                No latency data available.
            </div>
        `;
        return;
    }
    
    // Set SVG dimensions
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 240;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 40;
    
    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;
    
    // Find scale limits
    const latencies = records.map(r => r.latency_ms);
    const maxLat = Math.max(...latencies, 10);
    const minLat = 0;
    
    const numBars = records.length;
    const gap = 4;
    const totalGapWidth = gap * (numBars - 1);
    const barWidth = Math.max((plotWidth - totalGapWidth) / numBars, 2);
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("class", "overflow-visible select-none");
    
    // Draw Y-axis grid lines & labels
    let gridLinesHTML = '';
    const numGridLines = 4;
    for (let i = 0; i <= numGridLines; i++) {
        const val = minLat + (maxLat - minLat) * (i / numGridLines);
        const y = paddingTop + plotHeight - (i / numGridLines) * plotHeight;
        gridLinesHTML += `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(60, 74, 66, 0.2)" stroke-dasharray="3"/>
            <text x="${paddingLeft - 8}" y="${y + 4}" fill="rgba(187, 202, 191, 0.6)" font-size="9" text-anchor="end" font-family="JetBrains Mono">${Math.round(val)}ms</text>
        `;
    }
    
    svg.innerHTML = `
        <!-- Y-Axis Grid Lines & Labels -->
        ${gridLinesHTML}
        
        <!-- Axes -->
        <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + plotHeight}" stroke="rgba(60, 74, 66, 0.5)" />
        <line x1="${paddingLeft}" y1="${paddingTop + plotHeight}" x2="${width - paddingRight}" y2="${paddingTop + plotHeight}" stroke="rgba(60, 74, 66, 0.5)" />
        
        <!-- Y-Axis Title -->
        <text x="${paddingLeft - 35}" y="${paddingTop - 6}" fill="rgba(187, 202, 191, 0.8)" font-size="8" font-weight="600" letter-spacing="0.05em">LATENCY (MS)</text>
        <!-- X-Axis Title -->
        <text x="${width - paddingRight}" y="${paddingTop + plotHeight + 32}" fill="rgba(187, 202, 191, 0.8)" font-size="8" font-weight="600" letter-spacing="0.05em" text-anchor="end">SAMPLE ID</text>
    `;
    
    records.forEach((r, idx) => {
        const x = paddingLeft + idx * (barWidth + gap);
        const ratio = r.latency_ms / maxLat;
        const barHeight = Math.max(ratio * plotHeight, 2);
        const y = paddingTop + plotHeight - barHeight;
        
        // #4edea3 for correct (primary), #ffb4ab for mismatch (error)
        const fillColor = r.correct ? '#4edea3' : '#ffb4ab';
        const fillOpacity = '0.75';
        const hoverOpacity = '1';
        
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", barWidth);
        rect.setAttribute("height", barHeight);
        rect.setAttribute("fill", fillColor);
        rect.setAttribute("fill-opacity", fillOpacity);
        rect.setAttribute("rx", "1");
        rect.setAttribute("class", "transition-all duration-150 cursor-pointer");
        rect.style.transformOrigin = `${x}px ${paddingTop + plotHeight}px`;
        
        rect.addEventListener('mouseenter', (e) => {
            rect.setAttribute("fill-opacity", hoverOpacity);
            showLatencyTooltip(e, r);
        });
        
        rect.addEventListener('mouseleave', () => {
            rect.setAttribute("fill-opacity", fillOpacity);
            hideLatencyTooltip();
        });
        
        svg.appendChild(rect);
        
        // Label on X-axis below the bar
        const textLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        textLabel.setAttribute("x", x + barWidth / 2);
        textLabel.setAttribute("y", paddingTop + plotHeight + 14);
        textLabel.setAttribute("fill", "rgba(187, 202, 191, 0.7)");
        textLabel.setAttribute("font-size", "9");
        textLabel.setAttribute("text-anchor", "middle");
        textLabel.setAttribute("font-family", "JetBrains Mono");
        textLabel.innerText = r.id;
        svg.appendChild(textLabel);
    });
    
    container.appendChild(svg);
    
    // Tooltip overlay element
    const tooltip = document.createElement('div');
    tooltip.id = 'valLatencyTooltip';
    tooltip.className = 'absolute bg-surface-container-high border border-outline-variant p-3 rounded-lg text-xs text-on-surface shadow-2xl pointer-events-none hidden z-30 flex flex-col gap-1.5 min-w-[220px] backdrop-blur-md';
    container.appendChild(tooltip);
}

function showLatencyTooltip(e, record) {
    const tooltip = document.getElementById('valLatencyTooltip');
    const container = document.getElementById('valLatencyChartContainer');
    if (!tooltip || !container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const statusText = record.correct ? 'Correct Match' : 'Mismatch';
    const statusColor = record.correct ? 'text-primary' : 'text-error';
    
    tooltip.innerHTML = `
        <div class="font-bold border-b border-outline-variant/30 pb-1 mb-1 flex justify-between gap-4">
            <span class="text-on-surface-variant font-mono">Sample ID: ${record.id}</span>
            <span class="font-bold ${statusColor}">${statusText}</span>
        </div>
        <div class="flex flex-col gap-0.5">
            <div class="truncate max-w-[220px] italic text-on-surface-variant">"${escapeHtml(record.tweet)}"</div>
            <div class="flex justify-between mt-1 text-[11px]">
                <span>Entity:</span>
                <span class="font-semibold">${escapeHtml(record.entity)}</span>
            </div>
            <div class="flex justify-between text-[11px]">
                <span>Ground Truth:</span>
                <span class="font-semibold text-secondary">${record.sentiment}</span>
            </div>
            <div class="flex justify-between text-[11px]">
                <span>Prediction:</span>
                <span class="font-semibold ${record.correct ? 'text-primary' : 'text-error'}">${record.prediction}</span>
            </div>
            <div class="flex justify-between text-[11px]">
                <span>Confidence:</span>
                <span class="font-semibold font-mono">${(record.confidence * 100).toFixed(1)}%</span>
            </div>
            <div class="flex justify-between text-[11px] border-t border-outline-variant/20 pt-1 mt-1 font-semibold text-secondary">
                <span>Latency:</span>
                <span class="font-mono">${record.latency_ms.toFixed(2)} ms</span>
            </div>
        </div>
    `;
    
    tooltip.classList.remove('hidden');
    
    let tooltipX = x + 15;
    if (tooltipX + 240 > container.clientWidth) {
        tooltipX = x - 250;
    }
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${y - 20}px`;
}

function hideLatencyTooltip() {
    const tooltip = document.getElementById('valLatencyTooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

// Modal management controls
window.openAddSampleModal = function() {
    document.getElementById('addSampleForm').reset();
    document.getElementById('addSampleModal').classList.remove('hidden');
    addLog("UI Action: Open Add Sample Modal.");
};

window.closeAddSampleModal = function() {
    document.getElementById('addSampleModal').classList.add('hidden');
};

window.openEditSampleModal = function(id) {
    if (!validationData || !validationData.records) return;
    const record = validationData.records.find(r => r.id === id);
    if (!record) {
        showToast("Record not found", "error");
        return;
    }
    
    document.getElementById('editSampleId').value = record.id;
    document.getElementById('editSampleIdDisplay').innerText = record.id;
    document.getElementById('editSampleTweetText').value = record.tweet;
    document.getElementById('editSampleSentiment').value = record.sentiment;
    
    document.getElementById('editSampleModal').classList.remove('hidden');
    addLog(`UI Action: Open Edit Modal for Sample ID: ${record.id}.`);
};

window.closeEditSampleModal = function() {
    document.getElementById('editSampleModal').classList.add('hidden');
};

// CRUD Submits
window.handleAddSampleSubmit = async function(event) {
    event.preventDefault();
    const tweet = document.getElementById('addSampleTweetText').value.trim();
    const sentiment = document.getElementById('addSampleSentiment').value;
    const entity = document.getElementById('addSampleEntity').value.trim();
    
    if (!tweet || !entity) {
        showToast("Please fill in all fields", "warn");
        return;
    }
    
    addLog(`Model Validation: Inserting new validation tweet under context '${entity}'...`);
    
    try {
        const token = localStorage.getItem('google_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/validation-results', {
            method: 'POST',
            headers,
            body: JSON.stringify({ tweet, sentiment, entity })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        showToast("Sample added successfully!", "success");
        addLog(`Model Validation: Added new sample (ID: ${data.record.id}) - Confidence: ${(data.record.confidence*100).toFixed(1)}%`, "success");
        
        closeAddSampleModal();
        await loadValidationResults(true); // force reload
    } catch (err) {
        console.error("Add sample error:", err);
        showToast("Failed to add validation sample", "error");
        addLog(`Model Validation Error: Failed to add sample. ${err.message}`, "error");
    }
};

window.handleEditSampleSubmit = async function(event) {
    event.preventDefault();
    const id = parseInt(document.getElementById('editSampleId').value);
    const tweet = document.getElementById('editSampleTweetText').value.trim();
    const sentiment = document.getElementById('editSampleSentiment').value;
    
    if (!tweet) {
        showToast("Please fill in all fields", "warn");
        return;
    }
    
    addLog(`Model Validation: Updating sample ID: ${id}...`);
    
    try {
        const token = localStorage.getItem('google_token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/validation-results/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ tweet, sentiment })
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        showToast("Sample updated successfully!", "success");
        addLog(`Model Validation: Successfully updated sample ID: ${id}.`, "success");
        
        closeEditSampleModal();
        await loadValidationResults(true); // force reload
    } catch (err) {
        console.error("Edit sample error:", err);
        showToast("Failed to update validation sample", "error");
        addLog(`Model Validation Error: Failed to edit sample. ${err.message}`, "error");
    }
};

window.deleteValidationSample = async function(id) {
    if (!confirm(`Are you sure you want to delete Sample ID: ${id}?`)) {
        return;
    }
    
    addLog(`Model Validation: Deleting sample ID: ${id}...`);
    
    try {
        const token = localStorage.getItem('google_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch(`/api/validation-results/${id}`, {
            method: 'DELETE',
            headers
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        showToast("Sample deleted successfully!", "success");
        addLog(`Model Validation: Deleted sample ID: ${id}.`, "success");
        
        await loadValidationResults(true); // force reload
    } catch (err) {
        console.error("Delete sample error:", err);
        showToast("Failed to delete validation sample", "error");
        addLog(`Model Validation Error: Failed to delete sample. ${err.message}`, "error");
    }
};

window.triggerReRunInference = async function() {
    addLog("Model Validation: Re-running global inference pipeline on all dataset records...");
    showToast("Re-evaluating sentiment database...");
    
    try {
        const token = localStorage.getItem('google_token');
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const response = await fetch('/api/validation-results/re-run', {
            method: 'POST',
            headers
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        validationData = await response.json();
        renderValidationMetrics(validationData.metrics);
        renderValidationTable(validationData.records);
        renderValidationCharts(validationData.distributions);
        
        // Render Latency SVG chart if visible
        const valChartsPanel = document.getElementById('val-content-charts');
        if (valChartsPanel && !valChartsPanel.classList.contains('hidden')) {
            renderValidationLatencyChart(validationData.records, validationData.metrics.avg_latency_ms);
        }
        
        showToast("Re-evaluation complete!", "success");
        addLog(`Model Validation: Global inference pipeline complete. Updated Alignment Accuracy: ${(validationData.metrics.accuracy * 100).toFixed(1)}%.`, "success");
    } catch (err) {
        console.error("Re-run error:", err);
        showToast("Failed to re-run inference pipeline", "error");
        addLog(`Model Validation Error: Inference pipeline failed. ${err.message}`, "error");
    }
};

// Interactive Predictor Form Handler
const interactivePredictBtn = document.getElementById('interactivePredictBtn');
if (interactivePredictBtn) {
    interactivePredictBtn.addEventListener('click', async () => {
        const text = document.getElementById('interactiveTweetInput').value.trim();
        if (!text) {
            showToast("Please enter some text to classify", "warn");
            return;
        }
        
        const placeholder = document.getElementById('interactivePlaceholder');
        const card = document.getElementById('interactiveResultCard');
        
        // UI states
        placeholder.classList.add('hidden');
        card.classList.remove('hidden');
        
        const pill = document.getElementById('interactiveResultPill');
        const scoreVal = document.getElementById('interactiveResultScore');
        const scoreBar = document.getElementById('interactiveResultBar');
        const latencyVal = document.getElementById('interactiveResultLatency');
        
        pill.innerText = "CLASSIFYING...";
        pill.className = "px-2.5 py-1 rounded text-xs font-bold border border-secondary/20 bg-secondary/10 text-secondary animate-pulse";
        scoreVal.innerText = "--%";
        scoreBar.style.width = '0%';
        latencyVal.innerText = "-- ms";
        
        addLog(`Sentiment Predictor: Running inference on: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`);
        
        try {
            const token = localStorage.getItem('google_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const res = await fetch('/api/predict', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ text })
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const data = await res.json();
            
            // Render results
            pill.innerText = data.sentiment;
            if (data.sentiment === 'POSITIVE') {
                pill.className = "px-2.5 py-1 rounded text-xs font-bold border border-primary/20 bg-primary/10 text-primary";
                scoreBar.className = "h-full rounded-full bg-primary";
            } else {
                pill.className = "px-2.5 py-1 rounded text-xs font-bold border border-error/20 bg-error/10 text-error";
                scoreBar.className = "h-full rounded-full bg-error";
            }
            
            scoreVal.innerText = `${(data.confidence * 100).toFixed(1)}%`;
            scoreBar.style.width = `${data.confidence * 100}%`;
            latencyVal.innerText = `${data.latency_ms} ms`;
            
            addLog(`Sentiment Predictor: Predict Result = ${data.sentiment} (conf = ${(data.confidence * 100).toFixed(1)}%) in ${data.latency_ms}ms`, 'success');
        } catch (err) {
            console.error("Predict error:", err);
            pill.innerText = "ERROR";
            pill.className = "px-2.5 py-1 rounded text-xs font-bold border border-error/20 bg-error/10 text-error";
            addLog(`Sentiment Predictor Error: ${err.message}`, 'error');
            showToast("Failed to run prediction", "error");
        }
    });
}

// Local Search and Filter event bindings
function applyValidationTableFilters() {
    if (!validationData) return;
    
    const query = document.getElementById('valTableSearch').value.toLowerCase().trim();
    const filter = document.getElementById('valTableFilter').value;
    
    const filteredRecords = validationData.records.filter(row => {
        // Query search match
        const matchesQuery = row.tweet.toLowerCase().includes(query) || row.entity.toLowerCase().includes(query) || row.id.toString().includes(query);
        
        // Dropdown select filter match
        let matchesFilter = true;
        if (filter === 'correct') matchesFilter = row.correct === true;
        else if (filter === 'incorrect') matchesFilter = row.correct === false;
        else if (filter !== 'all') matchesFilter = row.sentiment === filter;
        
        return matchesQuery && matchesFilter;
    });
    
    renderValidationTable(filteredRecords);
}

const tableSearch = document.getElementById('valTableSearch');
const tableFilter = document.getElementById('valTableFilter');
const validationLimitSelect = document.getElementById('validationLimitSelect');

if (tableSearch) tableSearch.addEventListener('input', applyValidationTableFilters);
if (tableFilter) tableFilter.addEventListener('change', applyValidationTableFilters);
if (validationLimitSelect) {
    validationLimitSelect.addEventListener('change', () => {
        loadValidationResults(true); // force reload
    });
}

// Redraw validation latency chart on window resize
window.addEventListener('resize', () => {
    const valChartsPanel = document.getElementById('val-content-charts');
    if (valChartsPanel && !valChartsPanel.classList.contains('hidden') && validationData) {
        renderValidationLatencyChart(validationData.records, validationData.metrics.avg_latency_ms);
    }
});

