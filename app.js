// ==========================================
// 🚨 PASTE YOUR CLIENT ID HERE 🚨
// ==========================================
const GOOGLE_CLIENT_ID = '970398106521-cqfo748nkti2167eoal8kkketan9sodg.apps.googleusercontent.com';

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // ☁️ GOOGLE DRIVE SYNC SYSTEM
    // ==========================================
    let driveTokenClient;
    let driveAccessToken = null;
    const SYNC_FILE_NAME = 'WealthFlow_Sync_Data.json';

    // Initialize Google Identity Services
    if (typeof google !== 'undefined') {
        driveTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/drive.file',
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    driveAccessToken = tokenResponse.access_token;
                    document.getElementById('google-login-btn').classList.add('hidden');
                    document.getElementById('sync-status').classList.remove('hidden');
                    document.getElementById('drive-backup-btn').classList.remove('hidden');
                    document.getElementById('drive-restore-btn').classList.remove('hidden');
                    alert("✅ Google Drive से कनेक्ट हो गया!");
                }
            },
        });
    }

    document.getElementById('google-login-btn').addEventListener('click', () => {
        if(GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
            alert("❌ Developer Error: कृपया app.js की पहली लाइन में अपनी Google Client ID डालें!"); return;
        }
        driveTokenClient.requestAccessToken({prompt: 'consent'});
    });

    function showLoader(text) {
        document.getElementById('loading-text').innerText = text;
        document.getElementById('loading-overlay').classList.replace('hidden', 'flex');
    }
    function hideLoader() { document.getElementById('loading-overlay').classList.replace('flex', 'hidden'); }

    // Find File in Drive
    async function getDriveFileId() {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='${SYNC_FILE_NAME}' and trashed=false&spaces=drive`, {
            headers: { Authorization: `Bearer ${driveAccessToken}` }
        });
        const data = await response.json();
        if (data.files && data.files.length > 0) return data.files[0].id;
        return null;
    }

    // Save/Update to Drive
    document.getElementById('drive-backup-btn').addEventListener('click', async () => {
        if (!driveAccessToken) return alert("पहले Drive Sync बटन से लॉगिन करें!");
        if (allData.length === 0) return alert("बैकअप के लिए कोई डेटा नहीं है!");
        
        showLoader("SAVING TO DRIVE...");
        try {
            const fileId = await getDriveFileId();
            const fileContent = JSON.stringify(allData);
            const metadata = { name: SYNC_FILE_NAME, mimeType: 'application/json' };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', new Blob([fileContent], { type: 'application/json' }));

            let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
            let method = 'POST';

            // If file exists, update it (PATCH) instead of creating a new one
            if (fileId) {
                url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
                method = 'PATCH';
            }

            const response = await fetch(url, {
                method: method,
                headers: { Authorization: `Bearer ${driveAccessToken}` },
                body: form
            });

            if (response.ok) {
                alert("✅ डेटा सुरक्षित रूप से Google Drive पर सेव (Update) हो गया है!");
            } else { throw new Error("Upload failed"); }
        } catch (error) {
            console.error(error); alert("❌ ड्राइव पर सेव करने में समस्या आई।");
        }
        hideLoader();
    });

    // Restore from Drive
    document.getElementById('drive-restore-btn').addEventListener('click', async () => {
        if (!driveAccessToken) return alert("पहले Drive Sync बटन से लॉगिन करें!");
        if(!confirm("चेतावनी: ड्राइव का डेटा ऐप में आ जाएगा। क्या आप तैयार हैं?")) return;

        showLoader("DOWNLOADING FROM DRIVE...");
        try {
            const fileId = await getDriveFileId();
            if (!fileId) { hideLoader(); return alert("❌ ड्राइव पर कोई बैकअप फाइल नहीं मिली!"); }

            const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
                headers: { Authorization: `Bearer ${driveAccessToken}` }
            });
            
            const parsedData = await response.json();
            const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
            let added = 0;
            
            parsedData.forEach(p => { 
                if(!allData.some(m => m.date===p.date && m.amount===p.amount && m.desc===p.desc)) { 
                    delete p.id; store.add(p); added++; 
                } 
            });
            
            store.transaction.oncomplete = () => { alert(`✅ रिस्टोर सफल! ${added} नए रिकॉर्ड मिले।`); renderDashboard(); };
        } catch (error) {
            console.error(error); alert("❌ रिस्टोर करने में समस्या आई।");
        }
        hideLoader();
    });

    // ==========================================
    // 🧠 CORE ENGINE & PERSISTENCE
    // ==========================================
    let db = null;
    let allData = [];
    let displayLimit = 50;
    let chartInstance = null;
    let manualCategoryOverride = false;
    let appState = { activeIncome: 0, passiveIncome: 0, totalLiabilities: 0, wants: 0 };

    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

    let targetDate = new Date();
    let currentDisplayMonth = targetDate.getMonth(); 
    let currentDisplayYear = targetDate.getFullYear();
    const monthNames = ["Jan", "Feb", "March", "April", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];
    let isCustomRangeActive = false; let customStartDate = null; let customEndDate = null;

    // ==========================================
    // 🔒 SECURITY (Password)
    // ==========================================
    const pinScreen = document.getElementById('pin-screen'); const pinBox = document.getElementById('pin-box');
    const pinInput = document.getElementById('pin-input'); const pinActionBtn = document.getElementById('pin-action-btn');
    let securityData = JSON.parse(localStorage.getItem('wealthflow_security')) || null;
    let failedAttempts = parseInt(localStorage.getItem('wealthflow_fails')) || 0;
    let lockoutExpiration = parseInt(localStorage.getItem('wealthflow_lockout')) || 0;

    function checkLockout() {
        const now = Date.now();
        if (lockoutExpiration > now) {
            pinInput.disabled = true; pinActionBtn.disabled = true;
            document.getElementById('lockout-timer').classList.remove('hidden'); 
            document.getElementById('lockout-timer').innerText = `⚠️ लॉक है! ${Math.ceil((lockoutExpiration - now)/60000)} मिनट रुकें।`;
            return true;
        } else if (lockoutExpiration !== 0) {
            localStorage.setItem('wealthflow_fails', 0); localStorage.setItem('wealthflow_lockout', 0);
            failedAttempts = 0; lockoutExpiration = 0; pinInput.disabled = false; pinActionBtn.disabled = false;
            document.getElementById('lockout-timer').classList.add('hidden');
        } return false;
    }

    if (pinScreen) {
        if (securityData) { document.getElementById('pin-title').innerText="लॉगिन"; document.getElementById('forgot-pin-btn').classList.remove('hidden'); checkLockout(); } 
        else { document.getElementById('pin-title').innerText="सेटअप"; document.getElementById('setup-extras').classList.remove('hidden'); }
    }

    pinActionBtn.addEventListener('click', () => {
        if (checkLockout()) return; const pVal = pinInput.value.trim();
        if (pVal.length < 4) return alert("कम से कम 4 अक्षर!");
        if (!securityData) {
            const q = document.getElementById('security-q').value.trim(); const a = document.getElementById('security-a').value.trim().toLowerCase();
            if(!q || !a) return alert("रिकवरी ज़रूरी है!");
            securityData = { pin: pVal, question: q, answer: a }; localStorage.setItem('wealthflow_security', JSON.stringify(securityData));
            alert("✅ सेटअप पूरा!"); pinScreen.classList.add('hidden');
        } else {
            if (pVal === securityData.pin) { localStorage.setItem('wealthflow_fails', 0); pinScreen.classList.add('hidden'); } 
            else {
                failedAttempts++; localStorage.setItem('wealthflow_fails', failedAttempts); pinBox.classList.add('shake', 'border-red-500'); 
                setTimeout(() => pinBox.classList.remove('shake', 'border-red-500'), 500);
                if (failedAttempts >= 4) { lockoutExpiration = Date.now() + 900000; localStorage.setItem('wealthflow_lockout', lockoutExpiration); checkLockout(); } 
                else { alert(`गलत! ${4 - failedAttempts} बार और कोशिश कर सकते हैं।`); }
            }
        }
    });

    document.getElementById('forgot-pin-btn').addEventListener('click', () => { document.getElementById('pin-main-view').classList.add('hidden'); document.getElementById('recovery-view').classList.remove('hidden'); document.getElementById('recover-q-text').innerText = securityData.question; });
    document.getElementById('back-to-pin-btn').addEventListener('click', () => { document.getElementById('recovery-view').classList.add('hidden'); document.getElementById('pin-main-view').classList.remove('hidden'); });
    document.getElementById('verify-recover-btn').addEventListener('click', () => { if (document.getElementById('recover-a').value.trim().toLowerCase() === securityData.answer) { alert(`अनलॉक सफल! पासवर्ड: ${securityData.pin}`); pinScreen.classList.add('hidden'); } else alert("❌ जवाब गलत है!"); });

    // ==========================================
    // 💾 DATABASE
    // ==========================================
    const dbReq = indexedDB.open('WealthFlowDB', 4);
    dbReq.onupgradeneeded = e => { e.target.result.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true }); };
    dbReq.onsuccess = e => { db = e.target.result; updateMonthDisplayUI(); };

    // ==========================================
    // 📝 MODALS & FORMS (CONVERT UI)
    // ==========================================
    const addModal = document.getElementById('add-modal'); const addForm = document.getElementById('add-form'); const catBtns = document.querySelectorAll('.cat-btn');

    document.getElementById('fab-btn').addEventListener('click', () => openEntryModal());

    function openEntryModal(forceCat = null) {
        manualCategoryOverride = false; addForm.reset(); document.getElementById('edit-id').value = '';
        const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        document.getElementById('datetime-input').value = now.toISOString().slice(0, 16);
        addModal.classList.remove('hidden'); addModal.classList.add('flex'); setTimeout(() => document.getElementById('modal-content').classList.remove('translate-y-full'), 10);
        if(forceCat) { const btn = Array.from(catBtns).find(b => b.getAttribute('data-category') === forceCat); if(btn) btn.click(); } 
        else { catBtns[0].click(); }
    }

    document.getElementById('close-modal-btn').addEventListener('click', () => { document.getElementById('modal-content').classList.add('translate-y-full'); setTimeout(() => { addModal.classList.add('hidden'); addModal.classList.remove('flex'); }, 300); });

    catBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.isTrusted) manualCategoryOverride = true;
            catBtns.forEach(b => { b.classList.remove('bg-blue-500','bg-orange-500','bg-red-500','bg-emerald-500','text-white', 'text-blue-400'); b.classList.add('bg-gray-700','text-gray-400'); if(b.getAttribute('data-category') === 'Convert') b.classList.add('text-blue-400'); });
            const cat = btn.getAttribute('data-category'); document.getElementById('selected-category').value = cat; 
            btn.classList.replace('text-gray-400', 'text-white'); btn.classList.replace('text-blue-400', 'text-white');
            const wC = document.getElementById('wallet-container'), cC = document.getElementById('convert-container'), rC = document.getElementById('recurring-container');

            if(cat === 'Convert') { btn.classList.add('bg-blue-500'); wC.classList.add('hidden'); cC.classList.remove('hidden'); rC.classList.add('hidden'); } 
            else {
                if(cat==='Need') btn.classList.add('bg-blue-500'); else if(cat==='Want') btn.classList.add('bg-orange-500'); else if(cat==='Liability') btn.classList.add('bg-red-500'); else btn.classList.add('bg-emerald-500');
                wC.classList.remove('hidden'); cC.classList.add('hidden'); rC.classList.remove('hidden'); 
            }
        });
    });

    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('amount-input').value); const cat = document.getElementById('selected-category').value;
        let dsc = document.getElementById('desc-input').value; let wall = null, toW = null, isRecur = false;

        if (cat === 'Convert') {
            const type = document.getElementById('convert-type-input').value;
            if (type === 'BankToCash') { wall = 'Bank'; toW = 'Cash'; if (!dsc.startsWith("🔄")) dsc = "🔄 ATM: " + dsc; } 
            else if (type === 'CashToBank') { wall = 'Cash'; toW = 'Bank'; if (!dsc.startsWith("🔄")) dsc = "🔄 Deposit: " + dsc; }
        } else { wall = document.getElementById('wallet-input').value; isRecur = document.getElementById('recurring-input').checked; }

        const tx = { amount: amt, desc: dsc, category: cat, date: document.getElementById('datetime-input').value, wallet: wall, toWallet: toW, isRecurring: isRecur };
        const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions'); const editId = document.getElementById('edit-id').value;
        if (editId) { tx.id = parseInt(editId); store.put(tx); } else { store.add(tx); }
        store.transaction.oncomplete = () => { document.getElementById('close-modal-btn').click(); renderDashboard(); 
            // Auto-sync attempt if connected
            if(driveAccessToken) document.getElementById('drive-backup-btn').click();
        };
    });

    // ==========================================
    // 📊 RENDER ENGINE
    // ==========================================
    function renderDashboard() {
        if (!db) return;
        db.transaction(['transactions']).objectStore('transactions').getAll().onsuccess = (e) => {
            allData = e.target.result.sort((a, b) => new Date(b.date) - new Date(a.date));
            let bB=0, bW=0, bC=0, bWa=0, bCC=0, bAs=0;
            allData.forEach(i => {
                const a = i.amount; const w = i.wallet;
                if(i.category === 'Convert') {
                    if(w==='Bank') bB-=a; else if(w==='Cash') bC-=a;
                    const tw = i.toWallet; if(tw==='Bank') bB+=a; else if(tw==='Cash') bC+=a;
                } else if(i.category.includes('Income') || i.category==='Capital Gain') {
                    if(w==='Bank') bB+=a; else if(w==='Wife') bW+=a; else if(w==='Cash') bC+=a; else if(w==='Wallet') bWa+=a;
                } else {
                    if(i.category==='Asset') bAs+=a;
                    if(w==='Bank') bB-=a; else if(w==='Wife') bW-=a; else if(w==='Cash') bC-=a; else if(w==='Wallet') bWa-=a; else if(w==='Credit Card') bCC+=a;
                }
            });
            document.getElementById('net-worth').innerText = `₹${(bB+bW+bC+bWa+bAs-bCC).toLocaleString('en-IN')}`;
            document.getElementById('bank-balance').innerText = `₹${bB.toLocaleString('en-IN')}`; document.getElementById('wife-balance').innerText = `₹${bW.toLocaleString('en-IN')}`;
            document.getElementById('cash-balance').innerText = `₹${bC.toLocaleString('en-IN')}`; document.getElementById('wallet-balance').innerText = `₹${bWa.toLocaleString('en-IN')}`; document.getElementById('cc-due').innerText = `₹${bCC.toLocaleString('en-IN')}`;

            const rangeData = allData.filter(i => {
                if(isCustomRangeActive) { const ds = i.date.split('T')[0]; return ds >= customStartDate && ds <= customEndDate; }
                const d = new Date(i.date); return d.getMonth() === currentDisplayMonth && d.getFullYear() === currentDisplayYear;
            });

            let tInc=0, rActInc=0, rPasInc=0, rNeed=0, rWant=0, rLiab=0;
            rangeData.forEach(i => {
                if(i.category === 'Convert') return; const a = i.amount;
                if(i.category.includes('Income') || i.category==='Capital Gain') { tInc+=a; if(i.category!=='Capital Gain') rActInc+=a; if(i.category==='Passive Income') rPasInc+=a; } 
                else { if(i.category==='Need') rNeed+=a; else if(i.category==='Want') rWant+=a; else if(i.category==='Liability') rLiab+=a; }
            });
            appState = { activeIncome: rActInc, passiveIncome: rPasInc, totalLiabilities: rLiab, wants: rWant };
            document.getElementById('total-income').innerText = `₹${tInc.toLocaleString('en-IN')}`; document.getElementById('total-liabilities').innerText = `₹${rLiab.toLocaleString('en-IN')}`;

            if(chartInstance) chartInstance.destroy();
            document.getElementById('chart-need-val').innerText = `₹${rNeed.toLocaleString('en-IN')}`; document.getElementById('chart-want-val').innerText = `₹${rWant.toLocaleString('en-IN')}`; document.getElementById('chart-emi-val').innerText = `₹${rLiab.toLocaleString('en-IN')}`;
            chartInstance = new Chart(document.getElementById('expense-chart').getContext('2d'), { type:'doughnut', data:{ datasets:[{data:[rNeed||1, rWant, rLiab], backgroundColor:['#3B82F6','#F97316','#EF4444'], borderWidth:0}]}, options:{cutout:'80%', plugins:{legend:{display:false}}} });
            renderList(rangeData);
        };
    }

    function renderList(data) {
        const list = document.getElementById('transaction-list'); list.innerHTML = data.length === 0 ? '<p class="text-center text-gray-600 py-10 text-xs">कोई डेटा नहीं मिला।</p>' : '';
        data.slice(0, displayLimit).forEach(i => {
            let col = 'text-gray-400', sign = '-';
            if(i.category === 'Convert') { col = 'text-blue-400'; sign = '🔄'; } else if(i.category.includes('Income') || i.category==='Capital Gain') { col = 'text-emerald-400'; sign = '+'; }
            else if(i.category==='Need') col = 'text-blue-400'; else if(i.category==='Want') col = 'text-orange-400'; else if(i.category==='Liability') col = 'text-red-400'; else if(i.category==='Asset') { col = 'text-emerald-400'; sign = '-'; }
            
            let wD = ''; if (i.category === 'Convert') { wD = (i.wallet === 'Bank') ? '🏦 Bank ➡️ 💵 Cash' : '💵 Cash ➡️ 🏦 Bank'; } else { wD = i.wallet; if(wD === 'Cash') wD = '💵 Cash'; else if(wD === 'Credit Card') wD = '💳 CC'; else wD = '🏦 ' + wD; }

            list.insertAdjacentHTML('beforeend', `<div class="flex justify-between items-center bg-gray-900/40 p-4 rounded-2xl border border-gray-700/30"><div class="flex-1"><p class="text-white text-sm font-bold">${i.desc}</p><p class="text-[10px] text-gray-500 uppercase">${new Date(i.date).toLocaleDateString('en-IN')} • <span class="${col}">${i.category}</span> • ${wD}</p></div><div class="text-right ml-4"><p class="font-bold ${col}">${sign}₹${i.amount.toLocaleString('en-IN')}</p><div class="flex space-x-3 justify-end mt-1 text-gray-600"><button onclick="editTx(${i.id})"><i class="ph ph-pencil-simple text-sm"></i></button><button onclick="deleteTx(${i.id})"><i class="ph ph-trash text-sm"></i></button></div></div></div>`);
        });
        document.getElementById('load-more-btn').classList.toggle('hidden', data.length <= displayLimit);
    }

    document.getElementById('search-input').addEventListener('input', e => {
        const term = e.target.value.toLowerCase().trim(); const activeDataRange = allData.filter(i => { if(isCustomRangeActive) { const ds = i.date.split('T')[0]; return ds >= customStartDate && ds <= customEndDate; } const d = new Date(i.date); return d.getMonth() === currentDisplayMonth && d.getFullYear() === currentDisplayYear; });
        if (!term) { document.getElementById('search-summary').classList.add('hidden'); renderList(activeDataRange); return; }
        const filtered = activeDataRange.filter(i => i.desc.toLowerCase().includes(term) || i.category.toLowerCase().includes(term));
        let total = 0; filtered.forEach(i => { if(i.category !== 'Convert') total += (i.category.includes('Income') || i.category==='Capital Gain' ? i.amount : -i.amount); });
        document.getElementById('search-summary').classList.remove('hidden'); document.getElementById('search-grand').innerText = `नेट टोटल: ₹${total.toLocaleString('en-IN')}`; renderList(filtered);
    });

    window.deleteTx = id => { if(confirm("डिलीट करें?")) { db.transaction(['transactions'],'readwrite').objectStore('transactions').delete(id).onsuccess = () => { renderDashboard(); if(driveAccessToken) document.getElementById('drive-backup-btn').click(); }; } };
    window.editTx = id => {
        const item = allData.find(t => t.id === id);
        if(item) {
            document.getElementById('edit-id').value = item.id; document.getElementById('amount-input').value = item.amount;
            let dscClean = item.desc;
            if(item.category === 'Convert') { dscClean = dscClean.replace("🔄 ATM: ", "").replace("🔄 Deposit: ", ""); if (item.wallet === 'Bank' && item.toWallet === 'Cash') document.getElementById('convert-type-input').value = 'BankToCash'; else document.getElementById('convert-type-input').value = 'CashToBank'; }
            document.getElementById('desc-input').value = dscClean; document.getElementById('datetime-input').value = item.date;
            if(item.category !== 'Convert') document.getElementById('wallet-input').value = item.wallet || 'Bank';
            document.getElementById('recurring-input').checked = item.isRecurring || false;
            Array.from(categoryButtons).find(b => b.getAttribute('data-category') === item.category)?.click(); document.getElementById('fab-btn').click();
        }
    };

    function updateMonthDisplayUI() {
        const d = document.getElementById('current-month-display');
        if(isCustomRangeActive) { const sd = new Date(customStartDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'2-digit'}); const ed = new Date(customEndDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'2-digit'}); d.innerText = `${sd} - ${ed}`; } 
        else d.innerText = `${monthNames[currentDisplayMonth]} ${currentDisplayYear}`; renderDashboard();
    }
    document.getElementById('prev-month-btn').addEventListener('click', () => { if(isCustomRangeActive) return; currentDisplayMonth--; if(currentDisplayMonth < 0){currentDisplayMonth=11; currentDisplayYear--;} updateMonthDisplayUI(); });
    document.getElementById('next-month-btn').addEventListener('click', () => { if(isCustomRangeActive) return; currentDisplayMonth++; if(currentDisplayMonth > 11){currentDisplayMonth=0; currentDisplayYear++;} updateMonthDisplayUI(); });
    document.getElementById('custom-range-open-btn').addEventListener('click', () => document.getElementById('custom-range-modal').classList.replace('hidden','flex'));
    document.getElementById('apply-range-btn').addEventListener('click', () => { customStartDate = document.getElementById('range-start').value; customEndDate = document.getElementById('range-end').value; if(!customStartDate || !customEndDate) return alert("दोनों तारीखें चुनें!"); isCustomRangeActive = true; document.getElementById('custom-range-modal').classList.replace('flex','hidden'); updateMonthDisplayUI(); });
    document.getElementById('reset-range-btn').addEventListener('click', () => { isCustomRangeActive = false; document.getElementById('custom-range-modal').classList.replace('flex','hidden'); updateMonthDisplayUI(); });

    document.getElementById('reset-app-btn').addEventListener('click', () => { if(confirm("पूरा ऐप रिसेट?")) { if(prompt("RESET लिखें")==='RESET'){ localStorage.clear(); indexedDB.deleteDatabase('WealthFlowDB'); location.reload(); } } });

    document.getElementById('advisor-btn').addEventListener('click', () => {
        const res = document.getElementById('advisor-result'); res.classList.remove('hidden'); const type = document.getElementById('purchase-type').value; let t = "", d = "", c = "text-emerald-400", b = 0;
        if(appState.activeIncome === 0) { t = "कमाई शून्य?"; d = "पहले कमाई की एंट्री करें तभी सलाह दूंगा।"; c="text-orange-400"; }
        else {
            if(type === 'Car') { b = appState.activeIncome * 40; if(appState.passiveIncome > (appState.activeIncome * 0.1)) { t="🌟 परफेक्ट!"; d="बिना काम की कमाई से EMI निकल जाएगी।"; } else { t="⚠️ सावधानी"; d="सैलरी से EMI भरना रिस्की है।"; c="text-orange-400"; } }
            else if(type === 'Home') { b = appState.activeIncome * 80; t="✅ घर का सपना"; d="कमाई का 30% EMI में जा सकता है।"; }
            else { b = appState.activeIncome * 0.2; t="📱 शौक पूरे करें"; d="यह बजट सुरक्षित है।"; }
        }
        document.getElementById('adv-title').innerText = t; document.getElementById('adv-title').className = `font-bold ${c}`; document.getElementById('adv-desc').innerText = d; document.getElementById('adv-budget').innerText = `₹${Math.round(b).toLocaleString('en-IN')}`; document.getElementById('advisor-modal').classList.replace('hidden','flex');
    });
    document.getElementById('close-advisor-btn').addEventListener('click', () => document.getElementById('advisor-modal').classList.replace('flex','hidden'));
});