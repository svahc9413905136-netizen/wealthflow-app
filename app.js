document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 🔒 1. ADVANCED PIN LOCK & RECOVERY LOGIC
    // ==========================================
    const pinScreen = document.getElementById('pin-screen');
    const pinBox = document.getElementById('pin-box');
    const pinMainView = document.getElementById('pin-main-view');
    const recoveryView = document.getElementById('recovery-view');
    
    const pinTitle = document.getElementById('pin-title');
    const pinDesc = document.getElementById('pin-desc');
    const pinInput = document.getElementById('pin-input');
    const pinActionBtn = document.getElementById('pin-action-btn');
    const setupExtras = document.getElementById('setup-extras');
    
    // Recovery DOM
    const forgotPinBtn = document.getElementById('forgot-pin-btn');
    const backToPinBtn = document.getElementById('back-to-pin-btn');
    const hardResetBtn = document.getElementById('hard-reset-btn');
    const lockIcon = document.getElementById('lock-icon');
    const lockoutTimerText = document.getElementById('lockout-timer');

    // Storage Keys
    let savedData = JSON.parse(localStorage.getItem('wealthflow_security')) || null;
    let failedAttempts = parseInt(localStorage.getItem('wealthflow_fails')) || 0;
    let lockoutTime = parseInt(localStorage.getItem('wealthflow_lockout')) || 0;

    // Check Lockout Status First
    function checkLockout() {
        if (lockoutTime > Date.now()) {
            const timeLeft = Math.ceil((lockoutTime - Date.now()) / 60000); // in minutes
            pinInput.disabled = true;
            pinActionBtn.disabled = true;
            pinInput.classList.add('opacity-50', 'bg-red-900/50', 'border-red-500');
            lockIcon.classList.replace('text-emerald-400', 'text-red-500');
            lockoutTimerText.classList.remove('hidden');
            lockoutTimerText.innerText = `🔒 ऐप लॉक है! ${timeLeft} मिनट बाद कोशिश करें।`;
            pinDesc.innerText = "लगातार गलत पिन डालने के कारण सुरक्षा लॉक।";
            return true;
        } else if (lockoutTime !== 0) {
            // Timer expired, reset fails
            localStorage.setItem('wealthflow_fails', 0);
            localStorage.setItem('wealthflow_lockout', 0);
            failedAttempts = 0;
            pinInput.disabled = false;
            pinActionBtn.disabled = false;
            pinInput.classList.remove('opacity-50', 'bg-red-900/50', 'border-red-500');
            lockIcon.classList.replace('text-red-500', 'text-emerald-400');
            lockoutTimerText.classList.add('hidden');
            pinDesc.innerText = "अपना 4-अंकों का पिन डालें";
        }
        return false;
    }

    // App Initialization (Setup vs Login)
    if (savedData) {
        // LOGIN MODE
        pinTitle.innerText = "ऐप अनलॉक करें";
        pinDesc.innerText = "अपना 4-अंकों का पिन डालें";
        pinActionBtn.innerText = "अनलॉक (Unlock)";
        forgotPinBtn.classList.remove('hidden');
        checkLockout();
    } else {
        // SETUP MODE (First Time)
        setupExtras.classList.remove('hidden');
        pinTitle.innerText = "सुरक्षा सेटअप";
        pinDesc.innerText = "अपना नया पिन और एक गुप्त सवाल सेट करें";
    }

    // Master Key Generator
    function generateMasterKey() {
        return Math.random().toString(36).substring(2, 6).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    // Trigger PIN Action
    pinActionBtn.addEventListener('click', () => {
        if (checkLockout()) return;

        const val = pinInput.value;
        if (val.length !== 4 || isNaN(val)) return alert("कृपया केवल 4-अंकों का नंबर डालें!");

        if (!savedData) {
            // SAVE NEW SETTINGS
            const sq = document.getElementById('security-q').value.trim();
            const sa = document.getElementById('security-a').value.trim().toLowerCase();
            if(!sq || !sa) return alert("कृपया सुरक्षा सवाल और जवाब दोनों भरें। यह पिन भूलने पर काम आएगा!");

            const masterKey = generateMasterKey();
            
            const securityObj = {
                pin: val,
                question: sq,
                answer: sa,
                masterKey: masterKey
            };
            localStorage.setItem('wealthflow_security', JSON.stringify(securityObj));
            savedData = securityObj;
            
            alert(`✅ सेटअप पूरा हुआ!\n\n🔑 आपकी मास्टर रिकवरी की (Master Key) है:\n${masterKey}\n\nकृपया इसका स्क्रीनशॉट ले लें या इसे कहीं लिख लें।`);
            pinScreen.classList.add('hidden');
        } else {
            // VERIFY LOGIN
            if (val === savedData.pin) {
                // Success
                localStorage.setItem('wealthflow_fails', 0);
                pinScreen.classList.add('hidden');
            } else {
                // Failed Attempt
                failedAttempts++;
                localStorage.setItem('wealthflow_fails', failedAttempts);
                
                // Shake Animation
                pinBox.classList.add('shake', 'border-red-500');
                lockIcon.classList.replace('text-emerald-400', 'text-red-500');
                setTimeout(() => { 
                    pinBox.classList.remove('shake', 'border-red-500');
                    lockIcon.classList.replace('text-red-500', 'text-emerald-400');
                }, 500);

                if (failedAttempts >= 3) {
                    // Lock for 15 minutes (900000 ms)
                    const lockUntil = Date.now() + 900000;
                    localStorage.setItem('wealthflow_lockout', lockUntil);
                    lockoutTime = lockUntil;
                    checkLockout();
                } else {
                    alert(`❌ गलत पिन! आपके पास ${3 - failedAttempts} कोशिशें बची हैं।`);
                    pinInput.value = '';
                }
            }
        }
    });

    pinInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') pinActionBtn.click(); });

    // Switch to Recovery View
    forgotPinBtn.addEventListener('click', () => {
        pinMainView.classList.add('hidden');
        recoveryView.classList.remove('hidden');
        document.getElementById('recover-q-text').innerText = savedData.question;
    });

    backToPinBtn.addEventListener('click', () => {
        recoveryView.classList.add('hidden');
        pinMainView.classList.remove('hidden');
    });

    // Verify Recovery Logic (Unlock App without deleting data)
    document.getElementById('verify-recover-btn').addEventListener('click', () => {
        const inputKey = document.getElementById('recover-key').value.trim().toUpperCase();
        const inputAns = document.getElementById('recover-a').value.trim().toLowerCase();

        if (inputKey === savedData.masterKey || inputAns === savedData.answer) {
            // Recovery Success! App is unlocked, reset fail counters.
            alert(`✅ रिकवरी सफल! आपका ऐप अनलॉक हो गया है।\nआपका वर्तमान पिन है: ${savedData.pin}`);
            localStorage.setItem('wealthflow_fails', 0);
            localStorage.setItem('wealthflow_lockout', 0);
            pinScreen.classList.add('hidden');
        } else {
            alert("❌ गलत रिकवरी की (Key) या जवाब!");
        }
    });

    // Hard Reset (Nuke everything)
    hardResetBtn.addEventListener('click', () => {
        const step1 = confirm("🚨 चेतावनी: यह आपका सारा डेटा हमेशा के लिए डिलीट कर देगा और ऐप को बिल्कुल नया कर देगा!\n\nक्या आप पक्का सारा डेटा मिटाना चाहते हैं?");
        if(step1) {
            const step2 = prompt("कन्फर्म करने के लिए बड़े अक्षरों में 'DELETE' लिखें:");
            if(step2 && step2 === 'DELETE') {
                localStorage.clear(); // Clears PIN, Fails, Settings
                const req = indexedDB.open('WealthFlowDB', 4);
                req.onsuccess = (e) => {
                    const tempDb = e.target.result;
                    tempDb.transaction(['transactions'], 'readwrite').objectStore('transactions').clear().onsuccess = () => {
                        alert("✅ ऐप पूरी तरह से रीसेट हो गया है।");
                        location.reload();
                    };
                }
            }
        }
    });


    // ==========================================
    // 2. DOM Elements & Standard App Logic
    // ==========================================
    const fabBtn = document.getElementById('fab-btn');
    const modal = document.getElementById('add-modal');
    const modalContent = document.getElementById('modal-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const categoryButtons = document.querySelectorAll('.cat-btn');
    const selectedCategoryInput = document.getElementById('selected-category');
    const addForm = document.getElementById('add-form');
    
    const datetimeInput = document.getElementById('datetime-input');
    const walletInput = document.getElementById('wallet-input');
    const amountInput = document.getElementById('amount-input');
    const descInput = document.getElementById('desc-input');
    const recurringInput = document.getElementById('recurring-input');
    const searchInput = document.getElementById('search-input');
    const editIdInput = document.getElementById('edit-id');
    const transactionListEl = document.getElementById('transaction-list');

    const netWorthEl = document.getElementById('net-worth');
    const bankBalanceEl = document.getElementById('bank-balance');
    const cashBalanceEl = document.getElementById('cash-balance');
    const ccDueEl = document.getElementById('cc-due');
    const totalIncomeEl = document.getElementById('total-income');
    const totalLiabilitiesEl = document.getElementById('total-liabilities');
    const freedomBar = document.getElementById('freedom-bar');
    const freedomText = document.getElementById('freedom-text');

    const advisorBtn = document.getElementById('advisor-btn');
    const advisorModal = document.getElementById('advisor-modal');
    const closeAdvisorBtn = document.getElementById('close-advisor-btn');
    const runAdvisorBtn = document.getElementById('run-advisor-btn');
    const advisorResult = document.getElementById('advisor-result');
    
    const guideBtn = document.getElementById('guide-btn');
    const guideModal = document.getElementById('guide-modal');
    const closeGuideBtn = document.getElementById('close-guide-btn');

    const exportJsonBtn = document.getElementById('export-json-btn');
    const importFile = document.getElementById('import-file'); 
    const resetAppBtn = document.getElementById('reset-app-btn');

    let db;
    let allData = [];
    let state = { income: 0, passiveIncome: 0, liabilities: 0, wants: 0 };
    let manualCategoryOverride = false; 

    // Database
    const request = indexedDB.open('WealthFlowDB', 4);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = (e) => { db = e.target.result; updateDashboard(); };

    // Dictionary Engine
    const categoryKeywords = {
        'Need': ['bill', 'recharge', 'petrol', 'diesel', 'gas', 'grocery', 'ration', 'milk', 'dudh', 'food', 'sabji', 'kirana', 'rent', 'kiraya', 'fee', 'school', 'hospital', 'davai', 'medicine', 'exam', 'book', 'bijli', 'water'],
        'Want': ['movie', 'netflix', 'amazon', 'zomato', 'swiggy', 'party', 'trip', 'shopping', 'shoes', 'cloth', 'kapde', 'pizza', 'burger', 'tour', 'shauk'],
        'Liability': ['emi', 'loan', 'credit card', 'cc bill', 'kist', 'udhar', 'bajaj', 'bike emi', 'car emi'],
        'Asset': ['sip', 'mutual fund', 'fd', 'gold', 'sona', 'plot', 'share', 'stock', 'lic', 'policy', 'invest', 'chit fund', 'bc', 'udhar diya'],
        'Active Income': ['salary', 'business', 'dukan', 'pagaar', 'kamai', 'vetan'],
        'Passive Income': ['bayaaj', 'interest', 'dividend', 'rent', 'kiraya aageya'],
        'Capital Gain': ['property sold', 'zamin bechi', 'chit uthai', 'bc uthai', 'bonus', 'lumpsum', 'bada paisa']
    };

    if(descInput) {
        descInput.addEventListener('input', (e) => {
            if (manualCategoryOverride) return; 
            const text = e.target.value.toLowerCase();
            let foundCategory = null;
            for (const [cat, words] of Object.entries(categoryKeywords)) {
                if (words.some(word => text.includes(word.toLowerCase()))) { foundCategory = cat; break; }
            }
            if (foundCategory) {
                const targetBtn = Array.from(categoryButtons).find(btn => btn.getAttribute('data-category') === foundCategory);
                if (targetBtn) targetBtn.click(); 
            }
        });
    }

    // Modal Logic
    function openModal(isEdit = false) {
        manualCategoryOverride = false; 
        if(!isEdit) {
            addForm.reset(); editIdInput.value = ''; document.getElementById('modal-title').innerText = "नया हिसाब";
            const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            datetimeInput.value = now.toISOString().slice(0, 16); categoryButtons[0].click();
        }
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => modalContent.classList.remove('translate-y-full'), 10);
    }
    function closeModal() {
        modalContent.classList.add('translate-y-full');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
    
    if(fabBtn) fabBtn.addEventListener('click', () => openModal(false));
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    if(guideBtn) {
        guideBtn.addEventListener('click', () => { guideModal.classList.remove('hidden'); guideModal.classList.add('flex'); });
        closeGuideBtn.addEventListener('click', () => { guideModal.classList.add('hidden'); guideModal.classList.remove('flex'); });
    }

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.isTrusted) manualCategoryOverride = true; 
            categoryButtons.forEach(b => { b.classList.remove('bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-emerald-500', 'text-white'); b.classList.add('bg-gray-700', 'text-gray-300'); });
            const cat = btn.getAttribute('data-category'); selectedCategoryInput.value = cat; btn.classList.add('text-white');
            if(cat === 'Need') btn.classList.add('bg-blue-500'); if(cat === 'Want') btn.classList.add('bg-orange-500');
            if(cat === 'Liability') btn.classList.add('bg-red-500'); 
            if(cat.includes('Income') || cat === 'Asset' || cat === 'Capital Gain') btn.classList.add('bg-emerald-500');
        });
    });

    // Add, Edit, Delete
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(amountInput.value);
        if(selectedCategoryInput.value === 'Want' && state.income > 0 && (state.wants + amt) > (state.income * 0.30)) {
            if(!confirm(`⚠️ ध्यान दें: यह आपके 'शौक' का खर्च आपकी कमाई के 30% से ज़्यादा कर देगा।\nक्या फिर भी सेव करें?`)) return;
        }
        const tx = { amount: amt, desc: descInput.value, category: selectedCategoryInput.value, date: datetimeInput.value, wallet: walletInput.value, isRecurring: recurringInput.checked };
        const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
        if (editIdInput.value) { tx.id = parseInt(editIdInput.value); store.put(tx); } else { store.add(tx); }
        store.transaction.oncomplete = () => { closeModal(); updateDashboard(); };
    });

    window.deleteTx = function(id) { if(confirm("क्या आप सच में इसे मिटाना चाहते हैं?")) { db.transaction(['transactions'], 'readwrite').objectStore('transactions').delete(id).onsuccess = () => updateDashboard(); } };
    
    window.editTx = function(id) {
        const item = allData.find(tx => tx.id === id);
        if(item) {
            editIdInput.value = item.id; amountInput.value = item.amount; descInput.value = item.desc;
            datetimeInput.value = item.date; walletInput.value = item.wallet || 'Bank'; recurringInput.checked = item.isRecurring || false;
            const targetBtn = Array.from(categoryButtons).find(btn => btn.getAttribute('data-category') === item.category); if(targetBtn) targetBtn.click();
            openModal(true);
        }
    };

    // MANUAL APP RESET LOGIC
    if(resetAppBtn) {
        resetAppBtn.addEventListener('click', () => {
            const step1 = confirm("🚨 क्या आप पक्का ऐप का सारा डेटा और सेटिंग हमेशा के लिए डिलीट करना चाहते हैं?");
            if(step1) {
                const step2 = prompt("इसे कन्फर्म करने के लिए बड़े अक्षरों में 'RESET' लिखें:");
                if(step2 && step2 === 'RESET') {
                    localStorage.clear();
                    db.transaction(['transactions'], 'readwrite').objectStore('transactions').clear().onsuccess = () => {
                        alert("✅ ऐप पूरी तरह से नया (Reset) हो गया है!");
                        location.reload();
                    };
                } else {
                    alert("❌ कैंसल कर दिया गया।");
                }
            }
        });
    }

    // Backup & Restore
    if(exportJsonBtn && importFile) {
        exportJsonBtn.addEventListener('click', async () => {
            try {
                const dataStr = JSON.stringify(allData, null, 2);
                const dateStamp = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
                const fileName = `WealthFlow_Backup_${dateStamp}.json`;
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'JSON Backup', accept: { 'application/json': ['.json'] } }] });
                    const writable = await handle.createWritable();
                    await writable.write(dataStr); await writable.close();
                    alert("✅ बैकअप आपके चुने हुए फोल्डर में सुरक्षित है!");
                } else {
                    const blob = new Blob([dataStr], { type: "application/json" });
                    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = fileName;
                    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                    alert(`✅ बैकअप सेव हो गया है!\nअपने फोन के 'Downloads' फोल्डर में ${fileName} देखें।`);
                }
            } catch (error) { console.log("Backup Cancelled"); }
        });
        importFile.addEventListener('change', (e) => {
            if (!e.target.files[0]) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const partnerData = JSON.parse(event.target.result); let added = 0;
                    const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
                    partnerData.forEach(pItem => { if (!allData.some(mItem => mItem.date === pItem.date && mItem.amount === pItem.amount && mItem.desc === pItem.desc)) { delete pItem.id; store.add(pItem); added++; } });
                    store.transaction.oncomplete = () => { alert(`Success! ${added} पुराने रिकॉर्ड वापस आ गए।`); updateDashboard(); };
                } catch(err) { alert("फ़ाइल गलत है (Invalid Format)."); }
            };
            reader.readAsText(e.target.files[0]); importFile.value = '';
        });
    }

    // Engine Core
    function updateDashboard() {
        db.transaction(['transactions'], 'readonly').objectStore('transactions').getAll().onsuccess = (e) => {
            allData = e.target.result.sort((a, b) => new Date(b.date) - new Date(a.date));
            let tInc = 0, regularInc = 0, pInc = 0, needs = 0, wnts = 0, tLiab = 0, assets = 0;
            let bBank = 0, bCash = 0, bCC = 0;
            allData.forEach(item => {
                const a = item.amount; const w = item.wallet || 'Bank';
                if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                    tInc += a; if (item.category !== 'Capital Gain') regularInc += a; 
                    if(w==='Bank') bBank+=a; if(w==='Cash') bCash+=a;
                    if(item.category === 'Passive Income') pInc += a;
                } else {
                    if (item.category === 'Need') needs += a; if (item.category === 'Want') wnts += a;
                    if (item.category === 'Liability') tLiab += a; if (item.category === 'Asset') assets += a;
                    if(w==='Bank') bBank-=a; if(w==='Cash') bCash-=a; if(w==='Credit Card') bCC+=a;
                }
            });
            state = { income: regularInc, passiveIncome: pInc, liabilities: tLiab, wants: wnts };
            netWorthEl.innerText = `₹${(bBank + bCash + assets - bCC).toLocaleString('en-IN')}`;
            bankBalanceEl.innerText = `₹${bBank.toLocaleString('en-IN')}`; cashBalanceEl.innerText = `₹${bCash.toLocaleString('en-IN')}`; ccDueEl.innerText = `₹${bCC.toLocaleString('en-IN')}`;
            totalIncomeEl.innerText = `₹${tInc.toLocaleString('en-IN')}`; totalLiabilitiesEl.innerText = `₹${tLiab.toLocaleString('en-IN')}`;

            const tExpenses = needs + wnts + tLiab; let freedom = 0;
            if (tExpenses > 0) freedom = Math.min(100, Math.round((pInc / tExpenses) * 100));
            if(freedomText && freedomBar) {
                freedomText.innerText = `${freedom}%`; freedomBar.style.width = `${freedom}%`;
                if(freedom >= 100) { freedomBar.classList.replace('bg-emerald-500', 'bg-blue-400'); } else { freedomBar.classList.replace('bg-blue-400', 'bg-emerald-500'); }
            }
            renderList(allData);
        };
    }

    function renderList(data) {
        transactionListEl.innerHTML = data.length === 0 ? `<p class="text-gray-500 text-center">कोई हिसाब नहीं है (Empty).</p>` : '';
        data.forEach(item => {
            let col = 'text-gray-400', sign = '-'; let catText = item.category;
            if(item.category.includes('Income') || item.category === 'Capital Gain') { col = 'text-emerald-400'; sign = '+'; }
            if(item.category === 'Need') col = 'text-blue-400'; if(item.category === 'Want') col = 'text-orange-400';
            if(item.category === 'Liability') col = 'text-red-400'; if(item.category === 'Asset') { col = 'text-emerald-400'; sign = '-'; }
            const recurIcon = item.isRecurring ? '<i class="ph ph-arrows-clockwise text-emerald-500 ml-1"></i>' : '';
            const walletIcon = item.wallet === 'Cash' ? '💵' : item.wallet === 'Credit Card' ? '💳' : '🏦';
            const html = `
                <div class="flex justify-between items-center bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50 mb-3 group">
                    <div class="flex-1">
                        <p class="text-white font-semibold text-sm">${item.desc} ${recurIcon}</p>
                        <p class="text-gray-500 text-xs mt-0.5">${new Date(item.date).toLocaleDateString('en-IN')} • <span class="${col}">${catText}</span> • ${walletIcon} ${item.wallet || 'Bank'}</p>
                    </div>
                    <div class="text-right flex items-center space-x-3">
                        <p class="font-bold ${col}">${sign}₹${item.amount.toLocaleString('en-IN')}</p>
                        <div class="flex space-x-2 text-gray-500"><button onclick="editTx(${item.id})" class="hover:text-blue-400"><i class="ph ph-pencil-simple text-lg"></i></button><button onclick="deleteTx(${item.id})" class="hover:text-red-400"><i class="ph ph-trash text-lg"></i></button></div>
                    </div>
                </div>`;
            transactionListEl.insertAdjacentHTML('beforeend', html);
        });
    }

    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            renderList(allData.filter(item => item.desc.toLowerCase().includes(term) || item.category.toLowerCase().includes(term) || (item.wallet && item.wallet.toLowerCase().includes(term))));
        });
    }

    // AI Advisor
    if(advisorBtn) {
        advisorBtn.addEventListener('click', () => { advisorResult.classList.add('hidden'); advisorModal.classList.remove('hidden'); advisorModal.classList.add('flex'); });
        closeAdvisorBtn.addEventListener('click', () => { advisorModal.classList.add('hidden'); advisorModal.classList.remove('flex'); });
        runAdvisorBtn.addEventListener('click', () => {
            if(state.income === 0) return alert("भाई, पहले फिक्स कमाई (Active Income) तो डालो, तभी AI कैलकुलेट करेगा!");
            const type = document.getElementById('purchase-type').value; let maxEMI = 0, approxBudget = 0; let vTitle = "", vDesc = "", colorClass = "";
            if (type === 'Car') {
                maxEMI = (state.income * 0.10); approxBudget = maxEMI * 48;
                if (state.passiveIncome > maxEMI) { vTitle = "🌟 Rich Dad Approved!"; vDesc = "बिना काम वाली कमाई (Passive) गाड़ी की EMI भर रही है। ले लो!"; colorClass = "text-emerald-400"; } 
                else if ((state.liabilities + maxEMI) > (state.income * 0.40)) { vTitle = "🚨 DANGER: कर्ज़ का जाल!"; vDesc = "आपके पास पहले से EMI हैं। नयी गाड़ी ली तो कर्ज़ में डूब जाओगे।"; colorClass = "text-red-500"; approxBudget = 0; } 
                else { vTitle = "⚠️ Middle-Class Safe"; vDesc = "आप इसे सैलरी से भर सकते हैं, पर याद रहे गाड़ी एक 'Liability' है।"; colorClass = "text-orange-400"; }
            } else if (type === 'Home') {
                const availableForEMI = (state.income * 0.35) - state.liabilities; maxEMI = availableForEMI > 0 ? availableForEMI : 0; approxBudget = maxEMI * 100;
                if (maxEMI <= 0) { vTitle = "❌ Loan Denied"; vDesc = "आपकी पुरानी किस्तें इतनी ज़्यादा हैं कि नया घर नहीं ले सकते।"; colorClass = "text-red-500"; } 
                else if (state.passiveIncome > maxEMI) { vTitle = "🌟 Financial Masterpiece!"; vDesc = "बिना काम किये घर की EMI दे सकते हो। एकदम सही फैसला!"; colorClass = "text-emerald-400"; } 
                else { vTitle = "✅ Standard Safe Budget"; vDesc = "आप लोन ले सकते हैं। नीचे दी गई लिमिट से महंगा घर मत देखना।"; colorClass = "text-blue-400"; }
            } else if (type === 'Gadget') {
                approxBudget = state.income * 0.05;
                if(state.passiveIncome > approxBudget) { vTitle = "🌟 Free Luxury!"; vDesc = "शौक पूरे करो, पैसा Assets से आ रहा है।"; colorClass = "text-emerald-400"; } 
                else { vTitle = "⚠️ Rule of 5%"; vDesc = "फोन/गैजेट की वैल्यू जल्दी गिरती है। कैश में लेना है तो इस बजट से ऊपर मत जाना।"; colorClass = "text-orange-400"; }
            }
            document.getElementById('adv-title').className = `font-bold text-xl mb-2 ${colorClass}`;
            document.getElementById('adv-title').innerText = vTitle; document.getElementById('adv-desc').innerText = vDesc;
            document.getElementById('adv-budget').innerText = `Maximum Limit: ₹${approxBudget.toLocaleString('en-IN')}`;
            advisorResult.classList.remove('hidden');
        });
    }
});
