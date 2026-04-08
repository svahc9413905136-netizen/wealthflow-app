document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 🧠 GLOBAL STATE & CONFIGURATION
    // ==========================================
    let db = null;
    let allData = [];
    let displayLimit = 50;
    let chartInstance = null;
    let manualCategoryOverride = false;
    
    let appState = {
        activeIncome: 0,
        passiveIncome: 0,
        totalLiabilities: 0
    };

    // Monthly State
    let targetDate = new Date();
    let currentDisplayMonth = targetDate.getMonth(); 
    let currentDisplayYear = targetDate.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Custom Date Range State
    let isCustomRangeActive = false;
    let customStartDate = null;
    let customEndDate = null;

    // ==========================================
    // 🔒 1. SECURITY & PIN MANAGEMENT
    // ==========================================
    const pinScreen = document.getElementById('pin-screen');
    const pinBox = document.getElementById('pin-box');
    const pinInput = document.getElementById('pin-input');
    const pinActionBtn = document.getElementById('pin-action-btn');
    const lockoutTimerText = document.getElementById('lockout-timer');
    
    let securityData = JSON.parse(localStorage.getItem('wealthflow_security')) || null;
    let failedAttempts = parseInt(localStorage.getItem('wealthflow_fails')) || 0;
    let lockoutExpiration = parseInt(localStorage.getItem('wealthflow_lockout')) || 0;

    function evaluateLockoutState() {
        if (!pinInput || !pinActionBtn) return false;
        const now = Date.now();
        if (lockoutExpiration > now) {
            const minutesLeft = Math.ceil((lockoutExpiration - now) / 60000);
            pinInput.disabled = true; pinActionBtn.disabled = true;
            if (lockoutTimerText) {
                lockoutTimerText.classList.remove('hidden');
                lockoutTimerText.innerText = `🔒 ऐप सुरक्षा के लिए लॉक है! कृपया ${minutesLeft} मिनट बाद कोशिश करें।`;
            }
            return true;
        } else if (lockoutExpiration !== 0) {
            localStorage.setItem('wealthflow_fails', 0); localStorage.setItem('wealthflow_lockout', 0);
            failedAttempts = 0; lockoutExpiration = 0;
            pinInput.disabled = false; pinActionBtn.disabled = false;
            if (lockoutTimerText) lockoutTimerText.classList.add('hidden');
        }
        return false;
    }

    if (pinScreen) {
        if (securityData) {
            const pinTitle = document.getElementById('pin-title');
            const forgotPinBtn = document.getElementById('forgot-pin-btn');
            if(pinTitle) pinTitle.innerText = "ऐप अनलॉक करें";
            if(pinActionBtn) pinActionBtn.innerText = "अनलॉक (Unlock)";
            if(forgotPinBtn) forgotPinBtn.classList.remove('hidden');
            evaluateLockoutState();
        } else {
            const setupExtras = document.getElementById('setup-extras');
            if(setupExtras) setupExtras.classList.remove('hidden');
        }
    }

    if (pinActionBtn) {
        pinActionBtn.addEventListener('click', () => {
            if (evaluateLockoutState()) return;
            const pinValue = pinInput.value;
            if (pinValue.length !== 4 || isNaN(pinValue)) { alert("कृपया केवल 4-अंकों का नंबर डालें!"); return; }

            if (!securityData) {
                const secQ = document.getElementById('security-q')?.value.trim(); 
                const secA = document.getElementById('security-a')?.value.trim().toLowerCase();
                if(!secQ || !secA) { alert("सुरक्षा सवाल और जवाब भरना अनिवार्य है।"); return; }
                const generatedKey = Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,6).toUpperCase();
                
                securityData = { pin: pinValue, question: secQ, answer: secA, masterKey: generatedKey };
                localStorage.setItem('wealthflow_security', JSON.stringify(securityData));
                alert(`✅ सुरक्षा सेटअप पूरा हुआ!\n\n🔑 मास्टर रिकवरी की:\n${generatedKey}\n(कृपया स्क्रीनशॉट ले लें)`);
                pinScreen.classList.add('hidden');
            } else {
                if (pinValue === securityData.pin) {
                    localStorage.setItem('wealthflow_fails', 0); failedAttempts = 0; pinScreen.classList.add('hidden');
                } else {
                    failedAttempts++; localStorage.setItem('wealthflow_fails', failedAttempts);
                    if(pinBox) { pinBox.classList.add('shake', 'border-red-500'); setTimeout(() => pinBox.classList.remove('shake', 'border-red-500'), 500); }
                    if (failedAttempts >= 3) {
                        lockoutExpiration = Date.now() + 900000; localStorage.setItem('wealthflow_lockout', lockoutExpiration); evaluateLockoutState();
                    } else { alert(`❌ गलत पिन! ${3 - failedAttempts} कोशिशें बची हैं।`); pinInput.value = ''; }
                }
            }
        });
    }

    if (pinInput) pinInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') pinActionBtn.click(); });

    const forgotPinBtn = document.getElementById('forgot-pin-btn');
    const verifyRecoverBtn = document.getElementById('verify-recover-btn');
    if (forgotPinBtn) {
        forgotPinBtn.addEventListener('click', () => {
            document.getElementById('pin-main-view')?.classList.add('hidden');
            document.getElementById('recovery-view')?.classList.remove('hidden');
            const qText = document.getElementById('recover-q-text');
            if(qText && securityData) qText.innerText = securityData.question;
        });
    }

    document.getElementById('back-to-pin-btn')?.addEventListener('click', () => {
        document.getElementById('recovery-view')?.classList.add('hidden'); document.getElementById('pin-main-view')?.classList.remove('hidden');
    });

    if (verifyRecoverBtn) {
        verifyRecoverBtn.addEventListener('click', () => {
            const inputKey = document.getElementById('recover-key')?.value.trim().toUpperCase();
            const inputAns = document.getElementById('recover-a')?.value.trim().toLowerCase();
            if (securityData && (inputKey === securityData.masterKey || inputAns === securityData.answer)) {
                alert(`✅ रिकवरी सफल! अनलॉक हो गया है।\nवर्तमान पिन: ${securityData.pin}`);
                localStorage.setItem('wealthflow_fails', 0); localStorage.setItem('wealthflow_lockout', 0);
                failedAttempts = 0; lockoutExpiration = 0; pinScreen?.classList.add('hidden');
            } else { alert("❌ गलत रिकवरी की (Key) या जवाब!"); }
        });
    }

    document.getElementById('change-pin-btn')?.addEventListener('click', () => {
        if(!securityData) return;
        const oldPin = prompt("🔒 सुरक्षा जाँच: पुराना 4-अंकों का पिन डालें:");
        if (oldPin === null) return; 
        if (oldPin === securityData.pin || oldPin === securityData.masterKey) {
            const newPin = prompt("✨ नया 4-अंकों का पिन डालें:");
            if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                securityData.pin = newPin; localStorage.setItem('wealthflow_security', JSON.stringify(securityData));
                alert(`✅ पिन बदल गया है! नया पिन: ${newPin}`);
            } else { alert("❌ अमान्य पिन! केवल 4 नंबर डालें।"); }
        } else { alert("❌ गलत पिन!"); }
    });

    document.getElementById('reset-app-btn')?.addEventListener('click', () => {
        if (confirm("🚨 क्या आप पक्का ऐप का सारा डेटा हमेशा के लिए डिलीट करना चाहते हैं?")) {
            if (prompt("इसे कन्फर्म करने के लिए 'RESET' लिखें:") === 'RESET') {
                localStorage.clear();
                if (db) { db.transaction(['transactions'], 'readwrite').objectStore('transactions').clear().onsuccess = () => { window.location.reload(); }; } 
                else { window.location.reload(); }
            }
        }
    });

    document.getElementById('hard-reset-btn')?.addEventListener('click', () => {
        if (prompt("🚨 सारा डेटा मिटाने के लिए 'DELETE' लिखें:") === 'DELETE') {
            localStorage.clear(); indexedDB.deleteDatabase('WealthFlowDB'); window.location.reload();
        }
    });

    // ==========================================
    // 📅 2. MONTH & CUSTOM RANGE FILTER
    // ==========================================
    const currentMonthDisplay = document.getElementById('current-month-display');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');
    const customRangeModal = document.getElementById('custom-range-modal');

    function updateMonthDisplayUI() {
        if (currentMonthDisplay) {
            if (isCustomRangeActive) {
                const formatOpts = { day: '2-digit', month: 'short', year: '2-digit' };
                const sd = new Date(customStartDate).toLocaleDateString('en-IN', formatOpts);
                const ed = new Date(customEndDate).toLocaleDateString('en-IN', formatOpts);
                currentMonthDisplay.innerText = `${sd}  to  ${ed}`;
            } else {
                currentMonthDisplay.innerText = `${monthNames[currentDisplayMonth]} ${currentDisplayYear}`;
            }
        }
        if (db) renderDashboard(); 
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => { 
            if(isCustomRangeActive) return alert("कस्टम रेंज एक्टिव है। पहले इसे हटाएँ।");
            currentDisplayMonth--; if (currentDisplayMonth < 0) { currentDisplayMonth = 11; currentDisplayYear--; } 
            updateMonthDisplayUI(); 
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => { 
            if(isCustomRangeActive) return alert("कस्टम रेंज एक्टिव है। पहले इसे हटाएँ।");
            currentDisplayMonth++; if (currentDisplayMonth > 11) { currentDisplayMonth = 0; currentDisplayYear++; } 
            updateMonthDisplayUI(); 
        });
    }

    // Custom Range Listeners
    document.getElementById('custom-range-open-btn')?.addEventListener('click', () => {
        customRangeModal?.classList.remove('hidden'); customRangeModal?.classList.add('flex');
    });
    
    document.getElementById('close-range-btn')?.addEventListener('click', () => {
        customRangeModal?.classList.add('hidden'); customRangeModal?.classList.remove('flex');
    });

    document.getElementById('apply-range-btn')?.addEventListener('click', () => {
        const sd = document.getElementById('range-start').value;
        const ed = document.getElementById('range-end').value;
        
        if(!sd || !ed) return alert("कृपया Start Date और End Date दोनों चुनें।");
        if(sd > ed) return alert("Start Date, End Date से पहले की होनी चाहिए।");

        isCustomRangeActive = true; customStartDate = sd; customEndDate = ed;
        customRangeModal?.classList.add('hidden'); customRangeModal?.classList.remove('flex');
        updateMonthDisplayUI();
    });

    document.getElementById('reset-range-btn')?.addEventListener('click', () => {
        isCustomRangeActive = false; customStartDate = null; customEndDate = null;
        document.getElementById('range-start').value = ""; document.getElementById('range-end').value = "";
        customRangeModal?.classList.add('hidden'); customRangeModal?.classList.remove('flex');
        updateMonthDisplayUI();
    });

    // ==========================================
    // 💾 3. DATABASE INITIALIZATION
    // ==========================================
    const dbRequest = indexedDB.open('WealthFlowDB', 4);
    dbRequest.onupgradeneeded = (event) => { 
        const database = event.target.result;
        if (!database.objectStoreNames.contains('transactions')) database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true }); 
    };
    dbRequest.onsuccess = (event) => { db = event.target.result; updateMonthDisplayUI(); };


    // ==========================================
    // 🧠 4. DICTIONARY & MODAL SUBMISSION
    // ==========================================
    const categoryDictionary = {
        'Need': ['bill','recharge','petrol','diesel','gas','grocery','ration','milk','food','rent','fee','school','hospital','medicine','bijli'],
        'Want': ['movie','zomato','party','shopping','cloth','pizza','tour','shauk'],
        'Liability': ['emi','loan','credit card','cc bill','kist','udhar'],
        'Asset': ['sip','mutual fund','fd','gold','plot','stock','lic','invest','bc'],
        'Active Income': ['salary','business','dukan','kamai'],
        'Passive Income': ['bayaaj','interest','dividend','rent received'],
        'Capital Gain': ['property sold','chit uthai','bonus','lumpsum']
    };
    
    const descInput = document.getElementById('desc-input');
    const categoryButtons = document.querySelectorAll('.cat-btn');
    const selectedCategoryInput = document.getElementById('selected-category');

    if (descInput) {
        descInput.addEventListener('input', (event) => {
            if (manualCategoryOverride) return; 
            const typedText = event.target.value.toLowerCase(); let matchedCategory = null;
            for (const [categoryName, keywords] of Object.entries(categoryDictionary)) {
                if (keywords.some(keyword => typedText.includes(keyword.toLowerCase()))) { matchedCategory = categoryName; break; }
            }
            if (matchedCategory) Array.from(categoryButtons).find(b => b.getAttribute('data-category') === matchedCategory)?.click(); 
        });
    }

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            if (event.isTrusted) manualCategoryOverride = true; 
            categoryButtons.forEach(b => { b.classList.remove('bg-blue-500','bg-orange-500','bg-red-500','bg-emerald-500','text-white'); b.classList.add('bg-gray-700','text-gray-300'); });
            const selectedCat = btn.getAttribute('data-category'); 
            if(selectedCategoryInput) selectedCategoryInput.value = selectedCat; 
            btn.classList.add('text-white');
            if (selectedCat === 'Need') btn.classList.add('bg-blue-500'); 
            if (selectedCat === 'Want') btn.classList.add('bg-orange-500');
            if (selectedCat === 'Liability') btn.classList.add('bg-red-500'); 
            if (selectedCat.includes('Income') || selectedCat === 'Asset' || selectedCat === 'Capital Gain') btn.classList.add('bg-emerald-500');
        });
    });

    const addModal = document.getElementById('add-modal');
    const modalContent = document.getElementById('modal-content');
    const fabBtn = document.getElementById('fab-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addForm = document.getElementById('add-form');

    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            manualCategoryOverride = false; if(addForm) addForm.reset(); 
            const editIdInput = document.getElementById('edit-id'); const modalTitle = document.getElementById('modal-title');
            if(editIdInput) editIdInput.value = ''; if(modalTitle) modalTitle.innerText = "नया हिसाब";
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const dateTimeInput = document.getElementById('datetime-input'); if(dateTimeInput) dateTimeInput.value = now.toISOString().slice(0, 16);
            if(categoryButtons.length > 0) categoryButtons[0].click();
            if(addModal && modalContent) { addModal.classList.remove('hidden'); addModal.classList.add('flex'); setTimeout(() => modalContent.classList.remove('translate-y-full'), 10); }
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => { 
            if(modalContent && addModal) { modalContent.classList.add('translate-y-full'); setTimeout(() => { addModal.classList.add('hidden'); addModal.classList.remove('flex'); }, 300); }
        });
    }

    document.getElementById('guide-btn')?.addEventListener('click', () => { document.getElementById('guide-modal')?.classList.remove('hidden'); document.getElementById('guide-modal')?.classList.add('flex'); });
    document.getElementById('close-guide-btn')?.addEventListener('click', () => { document.getElementById('guide-modal')?.classList.add('hidden'); document.getElementById('guide-modal')?.classList.remove('flex'); });

    if (addForm) {
        addForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const amountInput = document.getElementById('amount-input'); const walletInput = document.getElementById('wallet-input');
            const datetimeInput = document.getElementById('datetime-input'); const recurringInput = document.getElementById('recurring-input');
            const editIdInput = document.getElementById('edit-id');
            if(!amountInput || !selectedCategoryInput || !descInput || !datetimeInput) return;

            const amountValue = parseFloat(amountInput.value); const categoryValue = selectedCategoryInput.value;
            if (categoryValue === 'Want' && appState.activeIncome > 0 && (appState.wants + amountValue) > (appState.activeIncome * 0.30)) {
                if(!confirm(`⚠️ ध्यान दें: यह खर्च आपकी कमाई के 30% से ज़्यादा हो जाएगा।\nक्या फिर भी सेव करें?`)) return;
            }

            const tx = { amount: amountValue, desc: descInput.value, category: categoryValue, date: datetimeInput.value, wallet: walletInput ? walletInput.value : 'Bank', isRecurring: recurringInput ? recurringInput.checked : false };
            const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
            const editId = editIdInput ? editIdInput.value : '';
            if (editId) { tx.id = parseInt(editId); store.put(tx); } else { store.add(tx); }
            store.transaction.oncomplete = () => { if(closeModalBtn) closeModalBtn.click(); renderDashboard(); };
        });
    }

    window.deleteTx = function(id) { if (confirm("डिलीट करें?")) { db.transaction(['transactions'], 'readwrite').objectStore('transactions').delete(id).onsuccess = () => renderDashboard(); } };
    
    window.editTx = function(id) {
        const item = allData.find(t => t.id === id);
        if (item) {
            document.getElementById('edit-id').value = item.id; document.getElementById('amount-input').value = item.amount; 
            document.getElementById('desc-input').value = item.desc; document.getElementById('datetime-input').value = item.date; 
            document.getElementById('wallet-input').value = item.wallet || 'Bank'; document.getElementById('recurring-input').checked = item.isRecurring || false;
            document.getElementById('modal-title').innerText = "हिसाब एडिट करें";
            Array.from(categoryButtons).find(b => b.getAttribute('data-category') === item.category)?.click();
            if(fabBtn) fabBtn.click(); 
        }
    };


    // ==========================================
    // 🛡️ 6. BACKUP & RESTORE
    // ==========================================
    document.getElementById('export-json-btn')?.addEventListener('click', async () => {
        if (allData.length === 0) return alert("बैकअप लेने के लिए कोई डेटा नहीं है!");
        try {
            const encData = btoa(unescape(encodeURIComponent(JSON.stringify(allData)))); 
            const fileName = `WealthFlow_Backup_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.txt`;
            if (window.showSaveFilePicker) {
                const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'Secure Backup File', accept: { 'text/plain': ['.txt'] } }] });
                const writable = await handle.createWritable(); await writable.write(encData); await writable.close(); alert("✅ बैकअप सुरक्षित है!");
            } else {
                const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([encData], { type: "text/plain" })); link.download = fileName;
                document.body.appendChild(link); link.click(); document.body.removeChild(link); alert(`✅ बैकअप सेव हो गया है!`);
            }
        } catch (error) { console.log("Backup Cancelled"); }
    });

    document.getElementById('import-file')?.addEventListener('change', (event) => {
        if (!event.target.files[0]) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                let decodedData = "";
                try { decodedData = decodeURIComponent(escape(atob(ev.target.result))); } catch(e) { decodedData = ev.target.result; } 
                const parsedData = JSON.parse(decodedData); 
                let addedCount = 0;
                const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
                parsedData.forEach(pItem => { 
                    if (!allData.some(mItem => mItem.date === pItem.date && mItem.amount === pItem.amount && mItem.desc === pItem.desc)) { delete pItem.id; store.add(pItem); addedCount++; } 
                });
                store.transaction.oncomplete = () => { alert(`✅ रिस्टोर सफल! ${addedCount} नए रिकॉर्ड जोड़े गए।`); renderDashboard(); };
            } catch(error) { alert("❌ फ़ाइल गलत है!"); }
        };
        reader.readAsText(event.target.files[0]); event.target.value = ''; 
    });


    // ==========================================
    // ⚙️ 7. CORE CALCULATION ENGINE (WITH RANGE)
    // ==========================================
    function renderDashboard() {
        if (!db) return;
        db.transaction(['transactions'], 'readonly').objectStore('transactions').getAll().onsuccess = (event) => {
            allData = event.target.result.sort((a, b) => new Date(b.date) - new Date(a.date)); displayLimit = 50; 
            
            // --- LIFETIME MATH ---
            let lifetimeBank = 0, lifetimeCash = 0, lifetimeCCDue = 0, lifetimeAssets = 0;
            allData.forEach(item => {
                const amt = item.amount; const wallet = item.wallet || 'Bank';
                if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                    if (wallet === 'Bank') lifetimeBank += amt; if (wallet === 'Cash') lifetimeCash += amt; 
                } else { 
                    if (item.category === 'Asset') lifetimeAssets += amt; 
                    if (wallet === 'Bank') lifetimeBank -= amt; if (wallet === 'Cash') lifetimeCash -= amt; if (wallet === 'Credit Card') lifetimeCCDue += amt; 
                }
            });
            
            if(document.getElementById('net-worth')) document.getElementById('net-worth').innerText = `₹${((lifetimeBank + lifetimeCash + lifetimeAssets) - lifetimeCCDue).toLocaleString('en-IN')}`;
            if(document.getElementById('bank-balance')) document.getElementById('bank-balance').innerText = `₹${lifetimeBank.toLocaleString('en-IN')}`;
            if(document.getElementById('cash-balance')) document.getElementById('cash-balance').innerText = `₹${lifetimeCash.toLocaleString('en-IN')}`;
            if(document.getElementById('cc-due')) document.getElementById('cc-due').innerText = `₹${lifetimeCCDue.toLocaleString('en-IN')}`;

            // --- FILTERED RANGE MATH ---
            const activeDataRange = allData.filter(item => { 
                const dObj = new Date(item.date); 
                if (isCustomRangeActive) {
                    const itemDateOnly = item.date.split('T')[0];
                    return itemDateOnly >= customStartDate && itemDateOnly <= customEndDate;
                } else {
                    return dObj.getMonth() === currentDisplayMonth && dObj.getFullYear() === currentDisplayYear; 
                }
            });
            
            let rangeTotalIncome = 0, rangeActiveIncome = 0, rangePassiveIncome = 0;
            let rangeNeeds = 0, rangeWants = 0, rangeLiabilities = 0;
            
            activeDataRange.forEach(item => {
                const amt = item.amount;
                if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                    rangeTotalIncome += amt; if (item.category !== 'Capital Gain') rangeActiveIncome += amt; if (item.category === 'Passive Income') rangePassiveIncome += amt; 
                } else { 
                    if (item.category === 'Need') rangeNeeds += amt; if (item.category === 'Want') rangeWants += amt; if (item.category === 'Liability') rangeLiabilities += amt; 
                }
            });

            appState.activeIncome = rangeActiveIncome; appState.passiveIncome = rangePassiveIncome; appState.totalLiabilities = rangeLiabilities;
            if(document.getElementById('total-income')) document.getElementById('total-income').innerText = `₹${rangeTotalIncome.toLocaleString('en-IN')}`;
            if(document.getElementById('total-liabilities')) document.getElementById('total-liabilities').innerText = `₹${rangeLiabilities.toLocaleString('en-IN')}`;

            const totalExpenses = rangeNeeds + rangeWants + rangeLiabilities;
            let freedomPercentage = totalExpenses > 0 ? Math.min(100, Math.round((rangePassiveIncome / totalExpenses) * 100)) : 0;
            const elFreedomText = document.getElementById('freedom-text'); const elFreedomBar = document.getElementById('freedom-bar');
            if(elFreedomText && elFreedomBar) {
                elFreedomText.innerText = `${freedomPercentage}%`; elFreedomBar.style.width = `${freedomPercentage}%`;
                if (freedomPercentage >= 100) { elFreedomBar.classList.replace('bg-emerald-500', 'bg-blue-400'); elFreedomText.classList.replace('text-emerald-400', 'text-blue-400');} 
                else { elFreedomBar.classList.replace('bg-blue-400', 'bg-emerald-500'); elFreedomText.classList.replace('text-blue-400', 'text-emerald-400');}
            }
            
            if(document.getElementById('chart-need-val')) document.getElementById('chart-need-val').innerText = `₹${rangeNeeds.toLocaleString('en-IN')}`;
            if(document.getElementById('chart-want-val')) document.getElementById('chart-want-val').innerText = `₹${rangeWants.toLocaleString('en-IN')}`;
            if(document.getElementById('chart-emi-val')) document.getElementById('chart-emi-val').innerText = `₹${rangeLiabilities.toLocaleString('en-IN')}`;

            let spentPercentRaw = rangeTotalIncome > 0 ? Math.round((totalExpenses / rangeTotalIncome) * 100) : (totalExpenses > 0 ? 100 : 0);
            let spentPercentCapped = Math.min(100, spentPercentRaw);
            const elSpentPercent = document.getElementById('income-spent-percent'); const elSpentBar = document.getElementById('income-spent-bar');
            
            if(elSpentPercent && elSpentBar) {
                elSpentPercent.innerText = `${spentPercentRaw}%`; elSpentBar.style.width = `${spentPercentCapped}%`;
                let barColor = spentPercentRaw > 80 ? 'bg-red-500' : (spentPercentRaw > 50 ? 'bg-orange-500' : 'bg-emerald-500');
                let textColor = spentPercentRaw > 80 ? 'text-red-400' : (spentPercentRaw > 50 ? 'text-orange-400' : 'text-emerald-400');
                elSpentBar.className = `h-1.5 rounded-full transition-all duration-500 ${barColor}`; elSpentPercent.className = `font-bold ${textColor}`;
            }

            try {
                if (chartInstance) chartInstance.destroy();
                const ctx = document.getElementById('expense-chart')?.getContext('2d');
                if (ctx) {
                    if (rangeNeeds === 0 && rangeWants === 0 && rangeLiabilities === 0) {
                        chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#374151'], borderWidth: 0 }] }, options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
                    } else {
                        chartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Need', 'Want', 'EMI'], datasets: [{ data: [rangeNeeds, rangeWants, rangeLiabilities], backgroundColor: ['#3B82F6', '#F97316', '#EF4444'], borderWidth: 2, borderColor: '#1F2937' }] }, options: { responsive: true, cutout: '70%', plugins: { legend: { display: false } } } });
                    }
                }
            } catch (error) { console.warn("Chart offline."); }

            document.getElementById('search-summary')?.classList.add('hidden');
            renderTransactionList(activeDataRange);
        };
    }

    // --- 🔍 LIVE SEARCH TOTAL CALCULATOR ---
    document.getElementById('search-input')?.addEventListener('input', (event) => {
        const searchTerm = event.target.value.toLowerCase().trim();
        
        // Filter based on active range (Monthly or Custom)
        const activeDataRange = allData.filter(item => { 
            if (isCustomRangeActive) {
                const itemDateOnly = item.date.split('T')[0];
                return itemDateOnly >= customStartDate && itemDateOnly <= customEndDate;
            } else {
                const dObj = new Date(item.date); 
                return dObj.getMonth() === currentDisplayMonth && dObj.getFullYear() === currentDisplayYear; 
            }
        });
        
        if (searchTerm === "") {
            document.getElementById('search-summary')?.classList.add('hidden');
            renderTransactionList(activeDataRange); return;
        }

        const filteredData = activeDataRange.filter(item => {
            return item.desc.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm);
        });
        
        let fBank = 0, fCash = 0, fNet = 0;
        filteredData.forEach(item => {
            const multiplier = (item.category.includes('Income') || item.category === 'Capital Gain') ? 1 : -1;
            if (item.wallet === 'Bank') fBank += (item.amount * multiplier);
            else if (item.wallet === 'Cash') fCash += (item.amount * multiplier);
            fNet += (item.amount * multiplier);
        });

        const searchSummary = document.getElementById('search-summary');
        if (searchSummary) {
            searchSummary.classList.remove('hidden');
            document.getElementById('search-bank').innerText = (fBank > 0 ? '+' : '') + `₹${fBank.toLocaleString('en-IN')}`;
            document.getElementById('search-cash').innerText = (fCash > 0 ? '+' : '') + `₹${fCash.toLocaleString('en-IN')}`;
            const sg = document.getElementById('search-grand');
            if(sg) { sg.innerText = (fNet > 0 ? '+' : '') + `₹${fNet.toLocaleString('en-IN')}`; sg.className = `text-lg font-bold ${fNet > 0 ? 'text-emerald-400' : 'text-red-400'}`; }
        }
        renderTransactionList(filteredData);
    });

    function renderTransactionList(dataArray) {
        const listContainer = document.getElementById('transaction-list'); 
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (!listContainer) return;

        if (dataArray.length === 0) { listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">इस रेंज में कोई हिसाब नहीं है।</p>'; if(loadMoreBtn) loadMoreBtn.classList.add('hidden'); return; }

        listContainer.innerHTML = ''; 
        const visibleData = dataArray.slice(0, displayLimit);
        
        visibleData.forEach(item => {
            let colorClass = 'text-gray-400'; let sign = '-'; 
            if (item.category.includes('Income') || item.category === 'Capital Gain') { colorClass = 'text-emerald-400'; sign = '+'; } 
            else if (item.category === 'Need') { colorClass = 'text-blue-400'; } else if (item.category === 'Want') { colorClass = 'text-orange-400'; } 
            else if (item.category === 'Liability') { colorClass = 'text-red-400'; } else if (item.category === 'Asset') { colorClass = 'text-emerald-400'; sign = '-'; }
            
            const recurIcon = item.isRecurring ? '<i class="ph ph-arrows-clockwise text-emerald-500 ml-1"></i>' : '';
            let walletIcon = '🏦'; if(item.wallet === 'Cash') walletIcon = '💵'; if(item.wallet === 'Credit Card') walletIcon = '💳';

            listContainer.insertAdjacentHTML('beforeend', `
                <div class="flex justify-between items-center bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50 mb-3 hover:border-gray-600 transition-colors">
                    <div class="flex-1">
                        <p class="text-white text-sm font-semibold">${item.desc} ${recurIcon}</p>
                        <p class="text-gray-500 text-xs mt-0.5">${new Date(item.date).toLocaleDateString('en-IN')} • <span class="${colorClass}">${item.category}</span> • ${walletIcon}</p>
                    </div>
                    <div class="text-right flex items-center space-x-3">
                        <p class="font-bold ${colorClass}">${sign}₹${item.amount.toLocaleString('en-IN')}</p>
                        <div class="flex space-x-2 text-gray-500">
                            <button onclick="editTx(${item.id})" class="hover:text-blue-400 transition-colors"><i class="ph ph-pencil-simple text-lg"></i></button>
                            <button onclick="deleteTx(${item.id})" class="hover:text-red-400 transition-colors"><i class="ph ph-trash text-lg"></i></button>
                        </div>
                    </div>
                </div>`);
        });
        
        if (loadMoreBtn) { if (dataArray.length > displayLimit) loadMoreBtn.classList.remove('hidden'); else loadMoreBtn.classList.add('hidden'); }
    }

    document.getElementById('load-more-btn')?.addEventListener('click', () => { displayLimit += 50; renderDashboard(); });

    // ==========================================
    // 🤖 8. AI ADVISOR ENGINE
    // ==========================================
    document.getElementById('advisor-btn')?.addEventListener('click', () => { document.getElementById('advisor-result')?.classList.add('hidden'); document.getElementById('advisor-modal')?.classList.remove('hidden'); document.getElementById('advisor-modal')?.classList.add('flex'); });
    document.getElementById('close-advisor-btn')?.addEventListener('click', () => { document.getElementById('advisor-modal')?.classList.add('hidden'); document.getElementById('advisor-modal')?.classList.remove('flex'); });

    document.getElementById('run-advisor-btn')?.addEventListener('click', () => {
        if (appState.activeIncome === 0) return alert("पहले इस रेंज की फिक्स कमाई (Active Income) डालें!");
        const purchaseType = document.getElementById('purchase-type')?.value; 
        if(!purchaseType) return;
        
        let maxEMI = 0, safeBudget = 0; let resultTitle = "", resultDesc = "", colorClass = "";
        
        if (purchaseType === 'Car') { 
            maxEMI = appState.activeIncome * 0.10; safeBudget = maxEMI * 48; 
            if (appState.passiveIncome > maxEMI) { resultTitle = "🌟 Rich Dad Approved!"; resultDesc = "बिना काम वाली कमाई गाड़ी की EMI भर रही है!"; colorClass = "text-emerald-400"; } 
            else if ((appState.totalLiabilities + maxEMI) > (appState.activeIncome * 0.40)) { resultTitle = "🚨 DANGER!"; resultDesc = "आपके पास पहले से पुरानी EMI हैं। कर्ज़ में डूब जाओगे।"; colorClass = "text-red-500"; safeBudget = 0; } 
            else { resultTitle = "⚠️ Middle-Class Safe"; resultDesc = "सैलरी से भर सकते हैं, पर याद रहे गाड़ी एक 'Liability' है।"; colorClass = "text-orange-400"; } 
        }
        else if (purchaseType === 'Home') { 
            const availableForEMI = (appState.activeIncome * 0.35) - appState.totalLiabilities; maxEMI = availableForEMI > 0 ? availableForEMI : 0; safeBudget = maxEMI * 100; 
            if (maxEMI <= 0) { resultTitle = "❌ Loan Denied"; resultDesc = "पुरानी किस्तें इतनी ज़्यादा हैं कि नया घर नहीं ले सकते।"; colorClass = "text-red-500"; } 
            else if (appState.passiveIncome > maxEMI) { resultTitle = "🌟 Financial Masterpiece!"; resultDesc = "बिना काम किये घर की EMI दे सकते हो!"; colorClass = "text-emerald-400"; } 
            else { resultTitle = "✅ Standard Safe Budget"; resultDesc = "सुरक्षित रूप से लोन ले सकते हैं।"; colorClass = "text-blue-400"; } 
        }
        else if (purchaseType === 'Gadget') { 
            safeBudget = appState.activeIncome * 0.05; 
            if (appState.passiveIncome > safeBudget) { resultTitle = "🌟 Free Luxury!"; resultDesc = "शौक पूरे करें, पैसा Assets से आ रहा है।"; colorClass = "text-emerald-400"; } 
            else { resultTitle = "⚠️ The 5% Rule"; resultDesc = "कैश में लेना है तो इस बजट से ऊपर मत जाना।"; colorClass = "text-orange-400"; } 
        }
        
        const titleEl = document.getElementById('adv-title'); if(titleEl) { titleEl.className = `font-bold text-xl mb-2 ${colorClass}`; titleEl.innerText = resultTitle; }
        const descEl = document.getElementById('adv-desc'); if(descEl) descEl.innerText = resultDesc; 
        const budgetEl = document.getElementById('adv-budget'); if(budgetEl) budgetEl.innerText = `Max Limit: ₹${safeBudget.toLocaleString('en-IN')}`; 
        document.getElementById('advisor-result')?.classList.remove('hidden');
    });
});
