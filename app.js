document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. DOM ELEMENTS
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
    const recurringInput = document.getElementById('recurring-input');
    const searchInput = document.getElementById('search-input');
    const editIdInput = document.getElementById('edit-id');
    const modalTitle = document.getElementById('modal-title');
    const transactionListEl = document.getElementById('transaction-list');

    const netWorthEl = document.getElementById('net-worth');
    const bankBalanceEl = document.getElementById('bank-balance');
    const cashBalanceEl = document.getElementById('cash-balance');
    const ccDueEl = document.getElementById('cc-due');
    const totalIncomeEl = document.getElementById('total-income');
    const totalLiabilitiesEl = document.getElementById('total-liabilities');

    // AI Advisor DOM
    const advisorBtn = document.getElementById('advisor-btn');
    const advisorModal = document.getElementById('advisor-modal');
    const closeAdvisorBtn = document.getElementById('close-advisor-btn');
    const runAdvisorBtn = document.getElementById('run-advisor-btn');
    const purchaseType = document.getElementById('purchase-type');
    const advisorResult = document.getElementById('advisor-result');

    // Sync & Export DOM
    const exportJsonBtn = document.getElementById('export-json-btn');
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');

    // ==========================================
    // 2. STATE & CHART SETUP
    // ==========================================
    let db;
    let allData = [];
    let state = { income: 0, passiveIncome: 0, liabilities: 0, wants: 0 };

    // Initialize Chart.js (Agar HTML me canvas nahi mila toh error na aaye isliye optional check)
    let expenseChart = null;
    const canvas = document.getElementById('expenseChart');
    if (canvas) {
        expenseChart = new Chart(canvas.getContext('2d'), {
            type: 'doughnut',
            data: { labels: ['Needs', 'Wants', 'Liabilities'], datasets: [{ data: [0, 0, 0], backgroundColor: ['#3b82f6', '#f97316', '#ef4444'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } } }
        });
    }

    // ==========================================
    // 3. DATABASE SETUP (IndexedDB v4)
    // ==========================================
    const request = indexedDB.open('WealthFlowDB', 4);
    request.onupgradeneeded = (e) => {
        db = e.target.result;
        if (!db.objectStoreNames.contains('transactions')) {
            db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        }
    };
    request.onsuccess = (e) => { db = e.target.result; updateDashboard(); };

    // ==========================================
    // 4. MODAL LOGIC (Open/Close/Categories)
    // ==========================================
    function openModal(isEdit = false) {
        if(!isEdit) {
            addForm.reset();
            editIdInput.value = '';
            modalTitle.innerText = "New Record";
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            datetimeInput.value = now.toISOString().slice(0, 16);
            categoryButtons[0].click();
        }
        modal.classList.remove('hidden'); modal.classList.add('flex');
        setTimeout(() => modalContent.classList.remove('translate-y-full'), 10);
    }
    
    function closeModal() {
        modalContent.classList.add('translate-y-full');
        setTimeout(() => { modal.classList.add('hidden'); modal.classList.remove('flex'); }, 300);
    }
    
    fabBtn.addEventListener('click', () => openModal(false));
    closeModalBtn.addEventListener('click', closeModal);

    categoryButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryButtons.forEach(b => {
                b.classList.remove('bg-blue-500', 'bg-orange-500', 'bg-red-500', 'bg-emerald-500', 'text-white');
                b.classList.add('bg-gray-700', 'text-gray-300');
            });
            const cat = btn.getAttribute('data-category');
            selectedCategoryInput.value = cat;
            btn.classList.add('text-white');
            if(cat === 'Need') btn.classList.add('bg-blue-500');
            if(cat === 'Want') btn.classList.add('bg-orange-500');
            if(cat === 'Liability') btn.classList.add('bg-red-500');
            if(cat.includes('Income') || cat === 'Asset') btn.classList.add('bg-emerald-500');
        });
    });

    // ==========================================
    // 5. FORM SUBMIT & EDIT/DELETE LOGIC
    // ==========================================
    addForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amt = parseFloat(document.getElementById('amount-input').value);
        
        // Smart 50/30/20 Alert
        if(selectedCategoryInput.value === 'Want' && state.income > 0) {
            if((state.wants + amt) > (state.income * 0.30)) {
                if(!confirm(`⚠️ WARNING: This pushes your 'Wants' over the 30% limit of your income.\nDo you still want to proceed?`)) return;
            }
        }

        const transaction = { 
            amount: amt, desc: document.getElementById('desc-input').value, 
            category: selectedCategoryInput.value, date: datetimeInput.value, 
            wallet: walletInput.value, isRecurring: recurringInput.checked 
        };
        
        const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
        if (editIdInput.value) { transaction.id = parseInt(editIdInput.value); store.put(transaction); } 
        else { store.add(transaction); }
        store.transaction.oncomplete = () => { closeModal(); updateDashboard(); };
    });

    window.deleteTx = function(id) {
        if(confirm("Are you sure you want to delete this record?")) {
            db.transaction(['transactions'], 'readwrite').objectStore('transactions').delete(id).onsuccess = () => updateDashboard();
        }
    };

    window.editTx = function(id) {
        const item = allData.find(tx => tx.id === id);
        if(item) {
            editIdInput.value = item.id;
            document.getElementById('amount-input').value = item.amount;
            document.getElementById('desc-input').value = item.desc;
            datetimeInput.value = item.date;
            walletInput.value = item.wallet || 'Bank';
            recurringInput.checked = item.isRecurring || false;
            
            const targetBtn = Array.from(categoryButtons).find(btn => btn.getAttribute('data-category') === item.category);
            if(targetBtn) targetBtn.click();
            openModal(true);
        }
    };

    // ==========================================
    // 6. FAMILY SYNC & BACKUP LOGIC
    // ==========================================
    if(exportJsonBtn && importBtn && importFile) {
        exportJsonBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(allData);
            const link = document.createElement('a');
            link.setAttribute('href', 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr));
            link.setAttribute('download', 'WealthFlow_Family_Sync.json');
            document.body.appendChild(link); link.click(); document.body.removeChild(link);
        });

        importBtn.addEventListener('click', () => importFile.click());
        importFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const partnerData = JSON.parse(event.target.result);
                    let addedCount = 0;
                    const store = db.transaction(['transactions'], 'readwrite').objectStore('transactions');
                    partnerData.forEach(pItem => {
                        const isDup = allData.some(mItem => mItem.date === pItem.date && mItem.amount === pItem.amount && mItem.desc === pItem.desc);
                        if (!isDup) { delete pItem.id; store.add(pItem); addedCount++; }
                    });
                    store.transaction.oncomplete = () => { alert(`Sync Complete! ${addedCount} new records added.`); updateDashboard(); };
                } catch(err) { alert("Invalid File format."); }
            };
            reader.readAsText(file);
            importFile.value = ''; // Reset
        });
    }

    // ==========================================
    // 7. MATH ENGINE & DASHBOARD RENDER
    // ==========================================
    function updateDashboard() {
        db.transaction(['transactions'], 'readonly').objectStore('transactions').getAll().onsuccess = (e) => {
            allData = e.target.result.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            let tInc = 0, pInc = 0, needs = 0, wnts = 0, tLiab = 0, assets = 0;
            let bBank = 0, bCash = 0, bCC = 0;

            allData.forEach(item => {
                const a = item.amount; const w = item.wallet || 'Bank';
                if (item.category.includes('Income')) { 
                    tInc += a; if(w==='Bank') bBank+=a; if(w==='Cash') bCash+=a;
                    if(item.category === 'Passive Income') pInc += a;
                } else {
                    if (item.category === 'Need') needs += a;
                    if (item.category === 'Want') wnts += a;
                    if (item.category === 'Liability') tLiab += a;
                    if (item.category === 'Asset') assets += a;
                    if(w==='Bank') bBank-=a; if(w==='Cash') bCash-=a; if(w==='Credit Card') bCC+=a;
                }
            });

            state = { income: tInc, passiveIncome: pInc, liabilities: tLiab, wants: wnts };

            netWorthEl.innerText = `₹${(bBank + bCash + assets - bCC).toLocaleString('en-IN')}`;
            bankBalanceEl.innerText = `₹${bBank.toLocaleString('en-IN')}`;
            cashBalanceEl.innerText = `₹${bCash.toLocaleString('en-IN')}`;
            ccDueEl.innerText = `₹${bCC.toLocaleString('en-IN')}`;
            totalIncomeEl.innerText = `₹${tInc.toLocaleString('en-IN')}`;
            totalLiabilitiesEl.innerText = `₹${tLiab.toLocaleString('en-IN')}`;

            if(expenseChart) {
                expenseChart.data.datasets[0].data = [needs, wnts, tLiab];
                expenseChart.update();
            }

            renderList(allData);
        };
    }

    function renderList(data) {
        transactionListEl.innerHTML = data.length === 0 ? `<p class="text-gray-500 text-center">No records.</p>` : '';
        data.forEach(item => {
            let col = 'text-gray-400', sign = '-';
            if(item.category.includes('Income')) { col = 'text-emerald-400'; sign = '+'; }
            if(item.category === 'Need') col = 'text-blue-400';
            if(item.category === 'Want') col = 'text-orange-400';
            if(item.category === 'Liability') col = 'text-red-400';
            if(item.category === 'Asset') { col = 'text-emerald-400'; sign = '-'; }

            const recurIcon = item.isRecurring ? '<i class="ph ph-arrows-clockwise text-emerald-500 ml-1"></i>' : '';
            const walletIcon = item.wallet === 'Cash' ? '💵' : item.wallet === 'Credit Card' ? '💳' : '🏦';

            const html = `
                <div class="flex justify-between items-center bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50 mb-3 group">
                    <div class="flex-1">
                        <p class="text-white font-semibold text-sm">${item.desc} ${recurIcon}</p>
                        <p class="text-gray-500 text-xs mt-0.5">${new Date(item.date).toLocaleDateString('en-IN')} • <span class="${col}">${item.category}</span> • ${walletIcon} ${item.wallet || 'Bank'}</p>
                    </div>
                    <div class="text-right flex items-center space-x-3">
                        <p class="font-bold ${col}">${sign}₹${item.amount.toLocaleString('en-IN')}</p>
                        <div class="flex space-x-2 text-gray-500">
                            <button onclick="editTx(${item.id})" class="hover:text-blue-400"><i class="ph ph-pencil-simple text-lg"></i></button>
                            <button onclick="deleteTx(${item.id})" class="hover:text-red-400"><i class="ph ph-trash text-lg"></i></button>
                        </div>
                    </div>
                </div>`;
            transactionListEl.insertAdjacentHTML('beforeend', html);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        renderList(allData.filter(item => item.desc.toLowerCase().includes(term) || item.category.toLowerCase().includes(term) || (item.wallet && item.wallet.toLowerCase().includes(term))));
    });

    // ==========================================
    // 8. AI ADVISOR ENGINE (Kiyosaki Rules)
    // ==========================================
    if(advisorBtn) {
        advisorBtn.addEventListener('click', () => {
            advisorResult.classList.add('hidden'); 
            advisorModal.classList.remove('hidden'); advisorModal.classList.add('flex');
        });
        closeAdvisorBtn.addEventListener('click', () => {
            advisorModal.classList.add('hidden'); advisorModal.classList.remove('flex');
        });

        runAdvisorBtn.addEventListener('click', () => {
            if(state.income === 0) {
                alert("Bhai, pehle Income toh add karo ledger mein tabhi AI calculate karega!");
                return;
            }

            const type = purchaseType.value;
            let maxEMI = 0, approxBudget = 0;
            let vTitle = "", vDesc = "", colorClass = "";

            if (type === 'Car') {
                maxEMI = (state.income * 0.10); 
                approxBudget = maxEMI * 48; // 4 yr loan
                if (state.passiveIncome > maxEMI) {
                    vTitle = "🌟 Rich Dad Approved!"; vDesc = "Aapki Passive Income is car ki EMI cover kar rahi hai. Go ahead!"; colorClass = "text-emerald-400";
                } else if ((state.liabilities + maxEMI) > (state.income * 0.40)) {
                    vTitle = "🚨 DANGER: Debt Trap!"; vDesc = "Aapke paas pehle se hi EMIs hain. Nayi gaadi EMI par lene se Rat Race me fas jayenge."; colorClass = "text-red-500"; approxBudget = 0;
                } else {
                    vTitle = "⚠️ Middle-Class Safe"; vDesc = "Aap salary se afford kar sakte hain, par yaad rakhein gaadi ek 'Liability' hai."; colorClass = "text-orange-400";
                }
            } else if (type === 'Home') {
                const availableForEMI = (state.income * 0.35) - state.liabilities;
                maxEMI = availableForEMI > 0 ? availableForEMI : 0;
                approxBudget = maxEMI * 100; // Rough 15 yr estimate
                if (maxEMI <= 0) {
                    vTitle = "❌ Loan Denied"; vDesc = "Aapki purani EMIs itni zyada hain ki naya ghar nahi le sakte."; colorClass = "text-red-500";
                } else if (state.passiveIncome > maxEMI) {
                    vTitle = "🌟 Financial Masterpiece!"; vDesc = "Bina kaam kiye ghar ki EMI de sakte hain. Best decision!"; colorClass = "text-emerald-400";
                } else {
                    vTitle = "✅ Standard Safe Budget"; vDesc = "Aap loan ke layak hain. Niche diye gaye limit se mehenga ghar mat dekhna."; colorClass = "text-blue-400";
                }
            } else if (type === 'Gadget') {
                approxBudget = state.income * 0.05;
                if(state.passiveIncome > approxBudget) {
                    vTitle = "🌟 Free Luxury!"; vDesc = "Aapka udhaar assets utha rahe hain. Jo pasand hai lijiye."; colorClass = "text-emerald-400";
                } else {
                    vTitle = "⚠️ Rule of 5%"; vDesc = "Gadgets ki value jaldi girti hai. Cash me lena hai toh is budget se upar mat jana."; colorClass = "text-orange-400";
                }
            }

            document.getElementById('adv-title').className = `font-bold text-xl mb-2 ${colorClass}`;
            document.getElementById('adv-title').innerText = vTitle;
            document.getElementById('adv-desc').innerText = vDesc;
            document.getElementById('adv-budget').innerText = `Max Limit: ₹${approxBudget.toLocaleString('en-IN')}`;
            advisorResult.classList.remove('hidden');
        });
    }
});