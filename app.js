document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 🧠 GLOBAL STATE & CONFIGURATION
    // ==========================================
    let db = null;
    let allData = [];
    let displayLimit = 50;
    let chartInstance = null;
    let manualCategoryOverride = false;
    
    // State object for AI Calculation
    let appState = {
        activeIncome: 0,
        passiveIncome: 0,
        totalLiabilities: 0
    };

    // Date/Month Management
    let targetDate = new Date();
    let currentDisplayMonth = targetDate.getMonth(); // 0-11
    let currentDisplayYear = targetDate.getFullYear();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];


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

    // A. Check if the app should be locked out
    function evaluateLockoutState() {
        if (!pinInput || !pinActionBtn) return false;
        
        const now = Date.now();
        if (lockoutExpiration > now) {
            const minutesLeft = Math.ceil((lockoutExpiration - now) / 60000);
            pinInput.disabled = true;
            pinActionBtn.disabled = true;
            
            if (lockoutTimerText) {
                lockoutTimerText.classList.remove('hidden');
                lockoutTimerText.innerText = `🔒 ऐप सुरक्षा के लिए लॉक है! कृपया ${minutesLeft} मिनट बाद कोशिश करें।`;
            }
            return true;
        } else if (lockoutExpiration !== 0) {
            // Lockout expired, reset counters
            localStorage.setItem('wealthflow_fails', 0);
            localStorage.setItem('wealthflow_lockout', 0);
            failedAttempts = 0;
            lockoutExpiration = 0;
            
            pinInput.disabled = false;
            pinActionBtn.disabled = false;
            if (lockoutTimerText) lockoutTimerText.classList.add('hidden');
        }
        return false;
    }

    // B. Initialize PIN Screen UI
    if (pinScreen) {
        if (securityData) {
            // Login Mode
            const pinTitle = document.getElementById('pin-title');
            const forgotPinBtn = document.getElementById('forgot-pin-btn');
            if(pinTitle) pinTitle.innerText = "ऐप अनलॉक करें";
            if(pinActionBtn) pinActionBtn.innerText = "अनलॉक (Unlock)";
            if(forgotPinBtn) forgotPinBtn.classList.remove('hidden');
            evaluateLockoutState();
        } else {
            // First Time Setup Mode
            const setupExtras = document.getElementById('setup-extras');
            if(setupExtras) setupExtras.classList.remove('hidden');
        }
    }

    // C. Handle PIN Submission (Setup or Verify)
    if (pinActionBtn) {
        pinActionBtn.addEventListener('click', () => {
            if (evaluateLockoutState()) return;
            
            const pinValue = pinInput.value;
            if (pinValue.length !== 4 || isNaN(pinValue)) {
                alert("कृपया केवल 4-अंकों (Digits) का नंबर डालें!");
                return;
            }

            if (!securityData) {
                // Perform First Time Setup
                const secQ = document.getElementById('security-q')?.value.trim(); 
                const secA = document.getElementById('security-a')?.value.trim().toLowerCase();
                
                if(!secQ || !secA) {
                    alert("सुरक्षा सवाल और जवाब भरना अनिवार्य है। यह पिन भूलने पर आपका डेटा बचाएगा!");
                    return;
                }
                
                // Generate a Random Master Key
                const generatedKey = Math.random().toString(36).substring(2,6).toUpperCase() + "-" + Math.random().toString(36).substring(2,6).toUpperCase();
                
                securityData = {
                    pin: pinValue,
                    question: secQ,
                    answer: secA,
                    masterKey: generatedKey
                };
                
                localStorage.setItem('wealthflow_security', JSON.stringify(securityData));
                alert(`✅ सुरक्षा सेटअप सफलतापूर्वक पूरा हुआ!\n\n🔑 आपकी मास्टर रिकवरी की (Master Key) है:\n${generatedKey}\n\nकृपया इसका स्क्रीनशॉट लेकर सुरक्षित रख लें।`);
                pinScreen.classList.add('hidden');
                
            } else {
                // Verify Login PIN
                if (pinValue === securityData.pin) {
                    // Success
                    localStorage.setItem('wealthflow_fails', 0); 
                    failedAttempts = 0;
                    pinScreen.classList.add('hidden');
                } else {
                    // Failure
                    failedAttempts++; 
                    localStorage.setItem('wealthflow_fails', failedAttempts);
                    
                    // Trigger visual shake
                    if(pinBox) {
                        pinBox.classList.add('shake', 'border-red-500');
                        setTimeout(() => pinBox.classList.remove('shake', 'border-red-500'), 500);
                    }
                    
                    if (failedAttempts >= 3) {
                        // Lock for 15 minutes
                        lockoutExpiration = Date.now() + 900000; 
                        localStorage.setItem('wealthflow_lockout', lockoutExpiration); 
                        evaluateLockoutState();
                    } else { 
                        alert(`❌ गलत पिन! आपके पास ${3 - failedAttempts} कोशिशें बची हैं।`); 
                        pinInput.value = ''; 
                    }
                }
            }
        });
    }

    // Auto-click on 'Enter'
    if (pinInput) {
        pinInput.addEventListener('keypress', (e) => {
            if(e.key === 'Enter') pinActionBtn.click();
        });
    }

    // D. Recovery System Logic
    const forgotPinBtn = document.getElementById('forgot-pin-btn');
    const backToPinBtn = document.getElementById('back-to-pin-btn');
    const verifyRecoverBtn = document.getElementById('verify-recover-btn');
    
    if (forgotPinBtn) {
        forgotPinBtn.addEventListener('click', () => {
            document.getElementById('pin-main-view')?.classList.add('hidden');
            document.getElementById('recovery-view')?.classList.remove('hidden');
            
            const qText = document.getElementById('recover-q-text');
            if(qText && securityData) qText.innerText = securityData.question;
        });
    }

    if (backToPinBtn) {
        backToPinBtn.addEventListener('click', () => {
            document.getElementById('recovery-view')?.classList.add('hidden');
            document.getElementById('pin-main-view')?.classList.remove('hidden');
        });
    }

    if (verifyRecoverBtn) {
        verifyRecoverBtn.addEventListener('click', () => {
            const inputKey = document.getElementById('recover-key')?.value.trim().toUpperCase();
            const inputAns = document.getElementById('recover-a')?.value.trim().toLowerCase();
            
            if (securityData && (inputKey === securityData.masterKey || inputAns === securityData.answer)) {
                alert(`✅ रिकवरी सफल! आपका ऐप अनलॉक हो गया है।\n\nआपका वर्तमान पिन है: ${securityData.pin}`);
                localStorage.setItem('wealthflow_fails', 0); 
                localStorage.setItem('wealthflow_lockout', 0);
                failedAttempts = 0;
                lockoutExpiration = 0;
                pinScreen?.classList.add('hidden');
            } else {
                alert("❌ गलत रिकवरी की (Key) या जवाब!");
            }
        });
    }

    // E. In-App Security Management Buttons
    const changePinBtn = document.getElementById('change-pin-btn');
    if (changePinBtn) {
        changePinBtn.addEventListener('click', () => {
            if(!securityData) {
                alert("❌ ऐप में अभी कोई पिन सेट नहीं है!");
                return;
            }
            const oldPin = prompt("🔒 सुरक्षा जाँच: अपना पुराना (Current) 4-अंकों का पिन डालें:");
            if (oldPin === null) return; // Cancelled
            
            if (oldPin === securityData.pin || oldPin === securityData.masterKey) {
                const newPin = prompt("✨ नया 4-अंकों का पिन डालें:");
                if (newPin && newPin.length === 4 && !isNaN(newPin)) {
                    securityData.pin = newPin; 
                    localStorage.setItem('wealthflow_security', JSON.stringify(securityData));
                    alert(`✅ आपका पिन सफलतापूर्वक बदल दिया गया है!\nनया पिन: ${newPin}`);
                } else {
                    alert("❌ अमान्य पिन! कृपया केवल 4 नंबर डालें।");
                }
            } else {
                alert("❌ गलत पिन!");
            }
        });
    }

    const resetAppBtn = document.getElementById('reset-app-btn');
    if (resetAppBtn) {
        resetAppBtn.addEventListener('click', () => {
            const confirm1 = confirm("🚨 चेतावनी: क्या आप पक्का ऐप का सारा डेटा और सेटिंग हमेशा के लिए डिलीट करना चाहते हैं?");
            if (confirm1) {
                const confirm2 = prompt("इसे कन्फर्म करने के लिए बड़े अक्षरों में 'RESET' लिखें:");
                if (confirm2 === 'RESET') {
                    localStorage.clear();
                    if (db) {
                        const req = db.transaction(['transactions'], 'readwrite').objectStore('transactions').clear();
                        req.onsuccess = () => {
                            alert("✅ ऐप पूरी तरह से रीसेट हो गया है!");
                            window.location.reload();
                        };
                    } else {
                        window.location.reload();
                    }
                } else {
                    alert("❌ प्रक्रिया रद्द कर दी गई। ('RESET' सही से नहीं लिखा गया)");
                }
            }
        });
    }

    const hardResetBtn = document.getElementById('hard-reset-btn');
    if (hardResetBtn) {
        hardResetBtn.addEventListener('click', () => {
            const confirmVal = prompt("🚨 सारा डेटा और पिन मिटाने के लिए बड़े अक्षरों में 'DELETE' लिखें:");
            if (confirmVal === 'DELETE') {
                localStorage.clear(); 
                indexedDB.deleteDatabase('WealthFlowDB'); 
                alert("✅ डेटा डिलीट कर दिया गया है। ऐप रीस्टार्ट हो रहा है...");
                window.location.reload();
            }
        });
    }


    // ==========================================
    // 📅 2. MONTH & YEAR FILTER NAVIGATION
    // ==========================================
    const currentMonthDisplay = document.getElementById('current-month-display');
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    function updateMonthDisplayUI() {
        if (currentMonthDisplay) {
            currentMonthDisplay.innerText = `${monthNames[currentDisplayMonth]} ${currentDisplayYear}`;
        }
        if (db) {
            renderDashboard(); // Re-calculate everything for the new month
        }
    }

    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => { 
            currentDisplayMonth--; 
            if (currentDisplayMonth < 0) { 
                currentDisplayMonth = 11; 
                currentDisplayYear--; 
            } 
            updateMonthDisplayUI(); 
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => { 
            currentDisplayMonth++; 
            if (currentDisplayMonth > 11) { 
                currentDisplayMonth = 0; 
                currentDisplayYear++; 
            } 
            updateMonthDisplayUI(); 
        });
    }


    // ==========================================
    // 💾 3. DATABASE (IndexedDB) INITIALIZATION
    // ==========================================
    const dbRequest = indexedDB.open('WealthFlowDB', 4);
    
    dbRequest.onupgradeneeded = (event) => { 
        const database = event.target.result;
        if (!database.objectStoreNames.contains('transactions')) {
            database.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true }); 
        }
    };
    
    dbRequest.onsuccess = (event) => { 
        db = event.target.result; 
        updateMonthDisplayUI(); // Start the engine once DB is ready
    };
    
    dbRequest.onerror = (event) => { 
        console.error("Database initialization failed", event); 
        alert("डेटाबेस लोड करने में समस्या आ रही है। कृपया ब्राउज़र अपडेट करें।");
    };


    // ==========================================
    // 🧠 4. AUTO-CATEGORY DICTIONARY ENGINE
    // ==========================================
    const categoryDictionary = {
        'Need': ['bill', 'recharge', 'petrol', 'diesel', 'gas', 'grocery', 'ration', 'milk', 'dudh', 'food', 'sabji', 'kirana', 'rent', 'kiraya', 'fee', 'school', 'hospital', 'davai', 'medicine', 'exam', 'book', 'bijli', 'water'],
        'Want': ['movie', 'netflix', 'amazon', 'zomato', 'swiggy', 'party', 'trip', 'shopping', 'shoes', 'cloth', 'kapde', 'pizza', 'burger', 'tour', 'shauk'],
        'Liability': ['emi', 'loan', 'credit card', 'cc bill', 'kist', 'udhar', 'bajaj', 'bike emi', 'car emi'],
        'Asset': ['sip', 'mutual fund', 'fd', 'gold', 'sona', 'plot', 'share', 'stock', 'lic', 'policy', 'invest', 'chit fund', 'bc', 'udhar diya'],
        'Active Income': ['salary', 'business', 'dukan', 'pagaar', 'kamai', 'vetan'],
        'Passive Income': ['bayaaj', 'interest', 'dividend', 'rent received', 'kiraya aageya'],
        'Capital Gain': ['property sold', 'zamin bechi', 'chit uthai', 'bc uthai', 'bonus', 'lumpsum', 'bada paisa']
    };
    
    const descInput = document.getElementById('desc-input');
    const categoryButtons = document.querySelectorAll('.cat-btn');
    const selectedCategoryInput = document.getElementById('selected-category');

    if (descInput) {
        descInput.addEventListener('input', (event) => {
            if (manualCategoryOverride) return; // Respect human choice
            
            const typedText = event.target.value.toLowerCase();
            let matchedCategory = null;
            
            for (const [categoryName, keywords] of Object.entries(categoryDictionary)) {
                if (keywords.some(keyword => typedText.includes(keyword.toLowerCase()))) {
                    matchedCategory = categoryName;
                    break;
                }
            }
            
            if (matchedCategory) {
                const targetBtn = Array.from(categoryButtons).find(b => b.getAttribute('data-category') === matchedCategory);
                if (targetBtn) targetBtn.click(); 
            }
        });
    }

    // Handle Category Button Clicks (Visuals & State)
    categoryButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            if (event.isTrusted) manualCategoryOverride = true; 
            
            // Reset all buttons
            categoryButtons.forEach(b => { 
                b.classList.remove('bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-emerald-500', 'text-white'); 
                b.classList.add('bg-gray-700', 'text-gray-300'); 
            });
            
            // Highlight selected button
            const selectedCat = btn.getAttribute('data-category'); 
            if(selectedCategoryInput) selectedCategoryInput.value = selectedCat; 
            btn.classList.add('text-white');
            
            if (selectedCat === 'Need') btn.classList.add('bg-blue-500'); 
            if (selectedCat === 'Want') btn.classList.add('bg-orange-500');
            if (selectedCat === 'Liability') btn.classList.add('bg-red-500'); 
            if (selectedCat.includes('Income') || selectedCat === 'Asset' || selectedCat === 'Capital Gain') {
                btn.classList.add('bg-emerald-500');
            }
        });
    });


    // ==========================================
    // 📝 5. MODAL MANAGEMENT & FORM SUBMISSION
    // ==========================================
    const addModal = document.getElementById('add-modal');
    const modalContent = document.getElementById('modal-content');
    const fabBtn = document.getElementById('fab-btn');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const addForm = document.getElementById('add-form');

    // Open Add Record Modal
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            manualCategoryOverride = false; 
            if(addForm) addForm.reset(); 
            
            const editIdInput = document.getElementById('edit-id');
            const modalTitle = document.getElementById('modal-title');
            if(editIdInput) editIdInput.value = '';
            if(modalTitle) modalTitle.innerText = "नया हिसाब";
            
            // Set current time
            const now = new Date(); 
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const dateTimeInput = document.getElementById('datetime-input');
            if(dateTimeInput) dateTimeInput.value = now.toISOString().slice(0, 16);
            
            // Default Category
            if(categoryButtons.length > 0) categoryButtons[0].click();
            
            // Animate In
            if(addModal && modalContent) {
                addModal.classList.remove('hidden'); 
                addModal.classList.add('flex'); 
                setTimeout(() => modalContent.classList.remove('translate-y-full'), 10);
            }
        });
    }

    // Close Add Record Modal
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => { 
            if(modalContent && addModal) {
                modalContent.classList.add('translate-y-full'); 
                setTimeout(() => { 
                    addModal.classList.add('hidden'); 
                    addModal.classList.remove('flex'); 
                }, 300); 
            }
        });
    }

    // Guide Modal Handlers
    const guideBtn = document.getElementById('guide-btn');
    const guideModal = document.getElementById('guide-modal');
    const closeGuideBtn = document.getElementById('close-guide-btn');
    
    if (guideBtn && guideModal) {
        guideBtn.addEventListener('click', () => { 
            guideModal.classList.remove('hidden'); 
            guideModal.classList.add('flex'); 
        });
    }
    if (closeGuideBtn && guideModal) {
        closeGuideBtn.addEventListener('click', () => { 
            guideModal.classList.add('hidden'); 
            guideModal.classList.remove('flex'); 
        });
    }

    // Handle Form Save (Add/Edit)
    if (addForm) {
        addForm.addEventListener('submit', (event) => {
            event.preventDefault();
            
            const amountInput = document.getElementById('amount-input');
            const walletInput = document.getElementById('wallet-input');
            const datetimeInput = document.getElementById('datetime-input');
            const recurringInput = document.getElementById('recurring-input');
            const editIdInput = document.getElementById('edit-id');
            
            if(!amountInput || !selectedCategoryInput || !descInput || !datetimeInput) return;

            const amountValue = parseFloat(amountInput.value);
            const categoryValue = selectedCategoryInput.value;
            
            // Warning logic for 'Wants'
            if (categoryValue === 'Want' && appState.activeIncome > 0 && (appState.wants + amountValue) > (appState.activeIncome * 0.30)) {
                const confirmSave = confirm(`⚠️ ध्यान दें: यह खर्च आपकी कमाई के 30% से ज़्यादा हो जाएगा।\nक्या फिर भी सेव करें?`);
                if(!confirmSave) return;
            }

            const transactionObject = { 
                amount: amountValue, 
                desc: descInput.value, 
                category: categoryValue, 
                date: datetimeInput.value, 
                wallet: walletInput ? walletInput.value : 'Bank', 
                isRecurring: recurringInput ? recurringInput.checked : false 
            };
            
            const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
            const editId = editIdInput ? editIdInput.value : '';
            
            if (editId) { 
                transactionObject.id = parseInt(editId); 
                store.put(transactionObject); 
            } else { 
                store.add(transactionObject); 
            }
            
            store.transaction.oncomplete = () => { 
                if(closeModalBtn) closeModalBtn.click(); 
                renderDashboard(); 
            };
        });
    }

    // Global Functions for Edit/Delete Buttons in List
    window.deleteTx = function(id) { 
        if (confirm("क्या आप पक्का इस एंट्री को डिलीट करना चाहते हैं?")) { 
            const request = db.transaction(['transactions'], 'readwrite').objectStore('transactions').delete(id);
            request.onsuccess = () => renderDashboard(); 
        } 
    };
    
    window.editTx = function(id) {
        const item = allData.find(t => t.id === id);
        if (item) {
            const editIdInput = document.getElementById('edit-id');
            const amountInput = document.getElementById('amount-input');
            const datetimeInput = document.getElementById('datetime-input');
            const walletInput = document.getElementById('wallet-input');
            const recurringInput = document.getElementById('recurring-input');
            const modalTitle = document.getElementById('modal-title');
            
            if(editIdInput) editIdInput.value = item.id; 
            if(amountInput) amountInput.value = item.amount; 
            if(descInput) descInput.value = item.desc;
            if(datetimeInput) datetimeInput.value = item.date; 
            if(walletInput) walletInput.value = item.wallet || 'Bank';
            if(recurringInput) recurringInput.checked = item.isRecurring || false;
            if(modalTitle) modalTitle.innerText = "हिसाब एडिट करें";
            
            const targetBtn = Array.from(categoryButtons).find(b => b.getAttribute('data-category') === item.category);
            if (targetBtn) targetBtn.click();
            
            if(fabBtn) fabBtn.click(); // Opens the modal
        }
    };


    // ==========================================
    // 🛡️ 6. SECURE BACKUP & RESTORE
    // ==========================================
    const exportJsonBtn = document.getElementById('export-json-btn');
    const importFile = document.getElementById('import-file'); 

    if (exportJsonBtn) {
        exportJsonBtn.addEventListener('click', async () => {
            if (allData.length === 0) {
                alert("बैकअप लेने के लिए कोई डेटा नहीं है!");
                return;
            }
            try {
                // Base64 Encoding for Obfuscation
                const rawJsonData = JSON.stringify(allData);
                const encodedDataStr = btoa(unescape(encodeURIComponent(rawJsonData))); 
                
                const dateStamp = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
                const fileName = `WealthFlow_Backup_${dateStamp}.txt`;
                
                // Try modern File System Access API
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({ 
                        suggestedName: fileName, 
                        types: [{ description: 'Secure Backup File', accept: { 'text/plain': ['.txt'] } }] 
                    });
                    const writable = await handle.createWritable();
                    await writable.write(encodedDataStr); 
                    await writable.close();
                    alert("✅ बैकअप आपके चुने हुए फोल्डर में सुरक्षित है!");
                } else {
                    // Fallback for Mobile / Older Browsers
                    const blob = new Blob([encodedDataStr], { type: "text/plain" });
                    const url = URL.createObjectURL(blob); 
                    const link = document.createElement('a'); 
                    link.href = url; 
                    link.download = fileName;
                    document.body.appendChild(link); 
                    link.click(); 
                    document.body.removeChild(link); 
                    URL.revokeObjectURL(url);
                    alert(`✅ बैकअप सेव हो गया है!\nकृपया अपने 'Downloads' फोल्डर में देखें।`);
                }
            } catch (error) { 
                console.log("Backup Cancelled or Failed", error); 
            }
        });
    }

    if (importFile) {
        importFile.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    // Try to decode Base64
                    let decodedData = "";
                    try {
                        decodedData = decodeURIComponent(escape(atob(ev.target.result)));
                    } catch(e) {
                        // Fallback in case they uploaded an old plain JSON file
                        decodedData = ev.target.result; 
                    }
                    
                    const parsedData = JSON.parse(decodedData); 
                    if(!Array.isArray(parsedData)) throw new Error("Not an array");

                    let addedCount = 0;
                    const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
                    
                    parsedData.forEach(pItem => { 
                        // Prevent exact duplicates
                        const isDuplicate = allData.some(mItem => mItem.date === pItem.date && mItem.amount === pItem.amount && mItem.desc === pItem.desc);
                        if (!isDuplicate) { 
                            delete pItem.id; // Let IndexedDB assign a new ID
                            store.add(pItem); 
                            addedCount++; 
                        } 
                    });
                    
                    store.transaction.oncomplete = () => { 
                        alert(`✅ रिस्टोर सफल! ${addedCount} नए रिकॉर्ड जोड़े गए।`); 
                        renderDashboard(); 
                    };
                } catch(error) { 
                    alert("❌ फ़ाइल गलत है या कर्रप्ट है (Invalid Backup File)."); 
                    console.error("Restore Error:", error);
                }
            };
            reader.readAsText(file); 
            importFile.value = ''; // Reset input
        });
    }


    // ==========================================
    // ⚙️ 7. CORE CALCULATION & RENDERING ENGINE
    // ==========================================
    function renderDashboard() {
        if (!db) return;
        
        const request = db.transaction(['transactions'], 'readonly').objectStore('transactions').getAll();
        
        request.onsuccess = (event) => {
            // Sort Descending by Date
            allData = event.target.result.sort((a, b) => new Date(b.date) - new Date(a.date)); 
            displayLimit = 50; // Reset pagination logic
            
            // ----------------------------------------------------
            // PART A: LIFETIME CALCULATIONS (For Net Worth)
            // ----------------------------------------------------
            let lifetimeBank = 0, lifetimeCash = 0, lifetimeCCDue = 0, lifetimeAssets = 0;
            
            allData.forEach(item => {
                const amt = item.amount; 
                const wallet = item.wallet || 'Bank';
                
                if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                    if (wallet === 'Bank') lifetimeBank += amt; 
                    if (wallet === 'Cash') lifetimeCash += amt; 
                } else { 
                    if (item.category === 'Asset') lifetimeAssets += amt; 
                    
                    if (wallet === 'Bank') lifetimeBank -= amt; 
                    if (wallet === 'Cash') lifetimeCash -= amt; 
                    if (wallet === 'Credit Card') lifetimeCCDue += amt; 
                }
            });
            
            const netWorthTotal = (lifetimeBank + lifetimeCash + lifetimeAssets) - lifetimeCCDue;
            
            const elNetWorth = document.getElementById('net-worth');
            const elBank = document.getElementById('bank-balance');
            const elCash = document.getElementById('cash-balance');
            const elCCDue = document.getElementById('cc-due');

            if(elNetWorth) elNetWorth.innerText = `₹${netWorthTotal.toLocaleString('en-IN')}`;
            if(elBank) elBank.innerText = `₹${lifetimeBank.toLocaleString('en-IN')}`;
            if(elCash) elCash.innerText = `₹${lifetimeCash.toLocaleString('en-IN')}`;
            if(elCCDue) elCCDue.innerText = `₹${lifetimeCCDue.toLocaleString('en-IN')}`;

            // ----------------------------------------------------
            // PART B: MONTHLY CALCULATIONS (For Dashboard & AI)
            // ----------------------------------------------------
            const monthlyData = allData.filter(item => { 
                const d = new Date(item.date); 
                return d.getMonth() === currentDisplayMonth && d.getFullYear() === currentDisplayYear; 
            });
            
            let monthTotalIncome = 0, monthActiveIncome = 0, monthPassiveIncome = 0;
            let monthNeeds = 0, monthWants = 0, monthLiabilities = 0;
            
            monthlyData.forEach(item => {
                const amt = item.amount;
                if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                    monthTotalIncome += amt; 
                    if (item.category !== 'Capital Gain') monthActiveIncome += amt; 
                    if (item.category === 'Passive Income') monthPassiveIncome += amt; 
                } else { 
                    if (item.category === 'Need') monthNeeds += amt; 
                    if (item.category === 'Want') monthWants += amt; 
                    if (item.category === 'Liability') monthLiabilities += amt; 
                }
            });

            // Update Global State for AI Advisor
            appState.activeIncome = monthActiveIncome;
            appState.passiveIncome = monthPassiveIncome;
            appState.totalLiabilities = monthLiabilities;

            const elTotalInc = document.getElementById('total-income');
            const elTotalLiab = document.getElementById('total-liabilities');
            
            if(elTotalInc) elTotalInc.innerText = `₹${monthTotalIncome.toLocaleString('en-IN')}`;
            if(elTotalLiab) elTotalLiab.innerText = `₹${monthLiabilities.toLocaleString('en-IN')}`;

            // Calculate Freedom Meter
            const totalMonthlyExpenses = monthNeeds + monthWants + monthLiabilities;
            let freedomPercentage = 0;
            if (totalMonthlyExpenses > 0) {
                freedomPercentage = Math.min(100, Math.round((monthPassiveIncome / totalMonthlyExpenses) * 100));
            }
            
            const elFreedomText = document.getElementById('freedom-text');
            const elFreedomBar = document.getElementById('freedom-bar');
            
            if(elFreedomText && elFreedomBar) {
                elFreedomText.innerText = `${freedomPercentage}%`; 
                elFreedomBar.style.width = `${freedomPercentage}%`;
                
                if (freedomPercentage >= 100) { 
                    elFreedomBar.classList.replace('bg-emerald-500', 'bg-blue-400'); 
                    elFreedomText.classList.replace('text-emerald-400', 'text-blue-400');
                } else { 
                    elFreedomBar.classList.replace('bg-blue-400', 'bg-emerald-500'); 
                    elFreedomText.classList.replace('text-blue-400', 'text-emerald-400');
                }
            }
            
            // ----------------------------------------------------
            // PART C: RENDER CHART.JS SAFELY
            // ----------------------------------------------------
            try {
                if (chartInstance) {
                    chartInstance.destroy(); // Remove old chart before drawing new one
                }
                const canvasEl = document.getElementById('expense-chart');
                if (canvasEl) {
                    const ctx = canvasEl.getContext('2d');
                    
                    if (monthNeeds === 0 && monthWants === 0 && monthLiabilities === 0) {
                        // Empty State Chart
                        chartInstance = new Chart(ctx, { 
                            type: 'doughnut', 
                            data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#374151'], borderWidth: 0 }] }, 
                            options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } } } 
                        });
                    } else {
                        // Active Data Chart
                        chartInstance = new Chart(ctx, { 
                            type: 'doughnut', 
                            data: { 
                                labels: ['Need', 'Want', 'EMI (Liability)'], 
                                datasets: [{ 
                                    data: [monthNeeds, monthWants, monthLiabilities], 
                                    backgroundColor: ['#3B82F6', '#F97316', '#EF4444'], // Blue, Orange, Red
                                    borderWidth: 2, 
                                    borderColor: '#1F2937' // Matches background
                                }] 
                            }, 
                            options: { 
                                responsive: true, 
                                cutout: '70%', 
                                plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } } 
                            } 
                        });
                    }
                }
            } catch (error) {
                console.warn("Chart.js failed to load. Operating in basic mode.", error);
            }

            // ----------------------------------------------------
            // PART D: RENDER TRANSACTION LIST (With Pagination)
            // ----------------------------------------------------
            renderTransactionList(monthlyData);
        };
    }

    // Render HTML List
    function renderTransactionList(dataArray) {
        const listContainer = document.getElementById('transaction-list'); 
        const loadMoreBtn = document.getElementById('load-more-btn');
        if (!listContainer) return;

        if (dataArray.length === 0) {
            listContainer.innerHTML = '<p class="text-gray-500 text-center py-4">इस महीने कोई हिसाब नहीं है।</p>';
            if(loadMoreBtn) loadMoreBtn.classList.add('hidden');
            return;
        }

        listContainer.innerHTML = ''; // Clear current
        
        // Paginate slice
        const visibleData = dataArray.slice(0, displayLimit);
        
        visibleData.forEach(item => {
            let colorClass = 'text-gray-400';
            let sign = '-'; 
            
            if (item.category.includes('Income') || item.category === 'Capital Gain') { 
                colorClass = 'text-emerald-400'; 
                sign = '+'; 
            } else if (item.category === 'Need') { colorClass = 'text-blue-400'; } 
              else if (item.category === 'Want') { colorClass = 'text-orange-400'; } 
              else if (item.category === 'Liability') { colorClass = 'text-red-400'; } 
              else if (item.category === 'Asset') { colorClass = 'text-emerald-400'; sign = '-'; }
            
            const recurIcon = item.isRecurring ? '<i class="ph ph-arrows-clockwise text-emerald-500 ml-1"></i>' : '';
            
            let walletIcon = '🏦';
            if(item.wallet === 'Cash') walletIcon = '💵';
            if(item.wallet === 'Credit Card') walletIcon = '💳';

            const htmlString = `
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
                </div>`;
            
            listContainer.insertAdjacentHTML('beforeend', htmlString);
        });
        
        // Handle Load More Button visibility
        if (loadMoreBtn) {
            if (dataArray.length > displayLimit) {
                loadMoreBtn.classList.remove('hidden');
            } else {
                loadMoreBtn.classList.add('hidden');
            }
        }
    }

    // Pagination Click
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => { 
            displayLimit += 50; 
            renderDashboard(); 
        });
    }

    // Search Logic (Searches within currently displayed month)
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            
            const monthlyData = allData.filter(item => { 
                const d = new Date(item.date); 
                return d.getMonth() === currentDisplayMonth && d.getFullYear() === currentDisplayYear; 
            });
            
            const filteredData = monthlyData.filter(item => {
                return item.desc.toLowerCase().includes(searchTerm) || item.category.toLowerCase().includes(searchTerm);
            });
            
            renderTransactionList(filteredData);
        });
    }


    // ==========================================
    // 🤖 8. AI ADVISOR ENGINE
    // ==========================================
    const advisorBtn = document.getElementById('advisor-btn');
    const advisorModal = document.getElementById('advisor-modal');
    const closeAdvisorBtn = document.getElementById('close-advisor-btn');
    const runAdvisorBtn = document.getElementById('run-advisor-btn');
    
    if (advisorBtn && advisorModal) {
        advisorBtn.addEventListener('click', () => { 
            document.getElementById('advisor-result')?.classList.add('hidden'); 
            advisorModal.classList.remove('hidden'); 
            advisorModal.classList.add('flex'); 
        });
    }

    if (closeAdvisorBtn && advisorModal) {
        closeAdvisorBtn.addEventListener('click', () => { 
            advisorModal.classList.add('hidden'); 
            advisorModal.classList.remove('flex'); 
        });
    }

    if (runAdvisorBtn) {
        runAdvisorBtn.addEventListener('click', () => {
            if (appState.activeIncome === 0) {
                alert("भाई, पहले इस महीने की फिक्स कमाई (Active Income) डालें! उसी के आधार पर AI काम करता है।");
                return;
            }
            
            const typeInput = document.getElementById('purchase-type');
            if(!typeInput) return;
            const purchaseType = typeInput.value; 
            
            let maxEMI = 0, safeBudget = 0;
            let resultTitle = "", resultDesc = "", colorClass = "";
            
            if (purchaseType === 'Car') { 
                // Car Rule: EMI should be max 10% of Income, duration 4 years (48 months)
                maxEMI = appState.activeIncome * 0.10; 
                safeBudget = maxEMI * 48; 
                
                if (appState.passiveIncome > maxEMI) { 
                    resultTitle = "🌟 Rich Dad Approved!"; 
                    resultDesc = "बिना काम वाली कमाई (Passive) गाड़ी की EMI भर रही है। बेझिझक लें!"; 
                    colorClass = "text-emerald-400"; 
                } else if ((appState.totalLiabilities + maxEMI) > (appState.activeIncome * 0.40)) { 
                    resultTitle = "🚨 DANGER: कर्ज़ का जाल!"; 
                    resultDesc = "आपके पास पहले से पुरानी EMI हैं। नयी गाड़ी ली तो कर्ज़ में डूब जाओगे।"; 
                    colorClass = "text-red-500"; 
                    safeBudget = 0; 
                } else { 
                    resultTitle = "⚠️ Middle-Class Safe"; 
                    resultDesc = "आप इसे सैलरी से भर सकते हैं, पर याद रहे गाड़ी एक 'Liability' है।"; 
                    colorClass = "text-orange-400"; 
                } 
            }
            else if (purchaseType === 'Home') { 
                // Home Rule: Total EMI shouldn't exceed 35% of Income. Assume 100 months for budget estimation.
                const availableForEMI = (appState.activeIncome * 0.35) - appState.totalLiabilities; 
                maxEMI = availableForEMI > 0 ? availableForEMI : 0; 
                safeBudget = maxEMI * 100; 
                
                if (maxEMI <= 0) { 
                    resultTitle = "❌ Loan Denied"; 
                    resultDesc = "आपकी पुरानी किस्तें इतनी ज़्यादा हैं कि नया घर नहीं ले सकते।"; 
                    colorClass = "text-red-500"; 
                } else if (appState.passiveIncome > maxEMI) { 
                    resultTitle = "🌟 Financial Masterpiece!"; 
                    resultDesc = "बिना काम किये घर की EMI दे सकते हो। एकदम सही फैसला!"; 
                    colorClass = "text-emerald-400"; 
                } else { 
                    resultTitle = "✅ Standard Safe Budget"; 
                    resultDesc = "आप सुरक्षित रूप से लोन ले सकते हैं। नीचे दी गई लिमिट में ही घर देखें।"; 
                    colorClass = "text-blue-400"; 
                } 
            }
            else if (purchaseType === 'Gadget') { 
                // Gadget Rule: Max 5% of monthly income. Cash buy.
                safeBudget = appState.activeIncome * 0.05; 
                if (appState.passiveIncome > safeBudget) { 
                    resultTitle = "🌟 Free Luxury!"; 
                    resultDesc = "शौक पूरे करें, क्योंकि पैसा आपके Assets से आ रहा है।"; 
                    colorClass = "text-emerald-400"; 
                } else { 
                    resultTitle = "⚠️ The 5% Rule"; 
                    resultDesc = "फोन/गैजेट की वैल्यू तेज़ी से गिरती है। कैश में लेना है तो इस बजट से ऊपर मत जाना।"; 
                    colorClass = "text-orange-400"; 
                } 
            }
            
            const titleEl = document.getElementById('adv-title');
            const descEl = document.getElementById('adv-desc');
            const budgetEl = document.getElementById('adv-budget');
            const resultBox = document.getElementById('advisor-result');
            
            if(titleEl) {
                titleEl.className = `font-bold text-xl mb-2 ${colorClass}`; 
                titleEl.innerText = resultTitle; 
            }
            if(descEl) descEl.innerText = resultDesc; 
            if(budgetEl) budgetEl.innerText = `Maximum Limit: ₹${safeBudget.toLocaleString('en-IN')}`; 
            if(resultBox) resultBox.classList.remove('hidden');
        });
    }
});
