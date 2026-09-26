/**
 * Passenger Pickup & Dispatch Manager
 * Handles PDF parsing via PDF.js, LocalStorage persistence,
 * editable pickup locations, filtering, and direct tel: calling.
 */

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const STORAGE_KEY = 'passenger_manifest_records_v1';

// Exact sample data matching user's reference image
const SAMPLE_DATA = [
  { id: 'sm_1', pax: 3, name: 'DEEPAK P', contact: '8939385647', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_2', pax: 4, name: 'Aditya Ujjwal', contact: '9973652338', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_3', pax: 2, name: 'Mohit Dhaka', contact: '9126919213', pickupPoint: 'Bellandur', completed: false, called: false },
  { id: 'sm_4', pax: 9, name: 'Ananya', contact: '6362498876', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_5', pax: 6, name: 'Nidhi Chaubey', contact: '9108449210', pickupPoint: 'Silk Board', completed: false, called: false },
  { id: 'sm_6', pax: 2, name: 'Meghana Acharya', contact: '8296133642', pickupPoint: 'Bellandur', completed: false, called: false },
  { id: 'sm_7', pax: 10, name: 'Neha Kurian', contact: '7823861942', pickupPoint: 'BTM', completed: false, called: false },
  { id: 'sm_8', pax: 2, name: 'Saranya Pandiyan', contact: '9944518302', pickupPoint: 'Kalamandir', completed: false, called: false },
  { id: 'sm_9', pax: 4, name: 'Rajat Sharma', contact: '7018510617', pickupPoint: 'Kalamandir', completed: false, called: false },
  { id: 'sm_10', pax: 3, name: 'Komal Bansal', contact: '8209062218', pickupPoint: 'Kalamandir', completed: false, called: false },
  { id: 'sm_11', pax: 1, name: 'Shruthy', contact: '8606289404', pickupPoint: 'BTM', completed: false, called: false },
  { id: 'sm_12', pax: 1, name: 'Karthikeyan', contact: '9080400758', pickupPoint: 'Kalamandir', completed: false, called: false },
  { id: 'sm_13', pax: 4, name: 'Agnishuddho', contact: '6292281946', pickupPoint: 'Bellandur', completed: false, called: false },
  { id: 'sm_14', pax: 2, name: 'Anurag Sinha', contact: '9852256130', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_15', pax: 1, name: 'Veer', contact: '8210228101', pickupPoint: 'Silk Board', completed: false, called: false },
  { id: 'sm_16', pax: 2, name: 'Ashutosh', contact: '93001 39193', pickupPoint: 'Kalamandir', completed: false, called: false },
  { id: 'sm_17', pax: 2, name: 'Chetna sahu', contact: '9425599556', pickupPoint: 'BTM', completed: false, called: false },
  { id: 'sm_18', pax: 5, name: 'Raghav Agrawal', contact: '9910658003', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_19', pax: 3, name: 'Tejasri Pallati', contact: '8106829221', pickupPoint: 'Marathahalli', completed: false, called: false },
  { id: 'sm_20', pax: 5, name: 'Shaziya Kazi', contact: '7359439586', pickupPoint: 'marathalli', completed: false, called: false }
];

// App State
let manifestList = [];
let editingRowId = null;

// DOM Elements
const pdfFileInput = document.getElementById('pdfFileInput');
const dropzone = document.getElementById('dropzone');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const manifestTable = document.getElementById('manifestTable');

// Stats Elements
const statTotalPax = document.getElementById('statTotalPax');
const statTotalBookings = document.getElementById('statTotalBookings');
const statPickedUp = document.getElementById('statPickedUp');
const statPaxPicked = document.getElementById('statPaxPicked');
const statPending = document.getElementById('statPending');
const statPaxPending = document.getElementById('statPaxPending');
const visibleCountBadge = document.getElementById('visibleCountBadge');
const storageStatusText = document.getElementById('storageStatusText');

// Filters
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const pickupFilter = document.getElementById('pickupFilter');
const statusFilter = document.getElementById('statusFilter');
const batchCheckAllBtn = document.getElementById('batchCheckAllBtn');

// Modals & Action Buttons
const loadSampleBtn = document.getElementById('loadSampleBtn');
const emptyLoadSampleBtn = document.getElementById('emptyLoadSampleBtn');
const pasteTextBtn = document.getElementById('pasteTextBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const addManualBtn = document.getElementById('addManualBtn');

const addModal = document.getElementById('addModal');
const closeAddModal = document.getElementById('closeAddModal');
const cancelAddModal = document.getElementById('cancelAddModal');
const addPassengerForm = document.getElementById('addPassengerForm');

const pasteModal = document.getElementById('pasteModal');
const closePasteModal = document.getElementById('closePasteModal');
const cancelPasteModal = document.getElementById('cancelPasteModal');
const pasteTextarea = document.getElementById('pasteTextarea');
const importPastedBtn = document.getElementById('importPastedBtn');

const toastContainer = document.getElementById('toastContainer');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  setupEventListeners();
  renderManifest();
});

// Load state from browser LocalStorage
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      manifestList = JSON.parse(saved);
    } else {
      // Default to sample data so user immediately sees a working table
      manifestList = [...SAMPLE_DATA];
      saveToStorage(false);
    }
  } catch (err) {
    console.error('Error loading from localStorage', err);
    manifestList = [...SAMPLE_DATA];
  }
}

// Save state to browser LocalStorage
function saveToStorage(notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifestList));
    updateStorageIndicator();
    if (notify) {
      showToast('Changes saved to browser storage', 'success');
    }
  } catch (err) {
    console.error('Error saving to localStorage', err);
    showToast('Failed to save to browser storage: ' + err.message, 'error');
  }
}

function updateStorageIndicator() {
  if (storageStatusText) {
    storageStatusText.textContent = `Saved (${manifestList.length})`;
  }
}

// --- Setup Event Listeners ---
function setupEventListeners() {
  // File upload and drag-and-drop
  pdfFileInput.addEventListener('change', handleFileSelect);
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-active');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-active');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      processPdfFile(files[0]);
    } else {
      showToast('Please drop a valid PDF file.', 'error');
    }
  });

  // Search and filter listeners
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    renderManifest();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderManifest();
  });

  pickupFilter.addEventListener('change', renderManifest);
  statusFilter.addEventListener('change', renderManifest);

  // Quick Action Buttons
  loadSampleBtn.addEventListener('click', () => loadSampleManifest(true));
  emptyLoadSampleBtn.addEventListener('click', () => loadSampleManifest(true));

  clearAllBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all passengers? This cannot be undone.')) {
      manifestList = [];
      saveToStorage();
      renderManifest();
      showToast('Manifest cleared', 'info');
    }
  });

  batchCheckAllBtn.addEventListener('click', handleToggleAllVisible);

  // Manual Add Modal
  addManualBtn.addEventListener('click', () => {
    addPassengerForm.reset();
    document.getElementById('inputPax').value = '1';
    addModal.classList.add('active');
  });

  const closeAdd = () => addModal.classList.remove('active');
  closeAddModal.addEventListener('click', closeAdd);
  cancelAddModal.addEventListener('click', closeAdd);

  addPassengerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const paxVal = parseInt(document.getElementById('inputPax').value, 10) || 1;
    const nameVal = document.getElementById('inputName').value.trim();
    const contactVal = document.getElementById('inputContact').value.trim();
    const pickupVal = document.getElementById('inputPickup').value.trim();

    if (!nameVal || !contactVal || !pickupVal) {
      showToast('Please fill all required fields', 'error');
      return;
    }

    const newRecord = {
      id: 'pax_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      pax: paxVal,
      name: nameVal,
      contact: contactVal,
      pickupPoint: pickupVal,
      completed: false,
      called: false
    };

    manifestList.unshift(newRecord);
    saveToStorage();
    renderManifest();
    closeAdd();
    showToast(`Added ${nameVal} to manifest`, 'success');
  });

  // Paste Text Modal
  pasteTextBtn.addEventListener('click', () => {
    pasteTextarea.value = '';
    pasteModal.classList.add('active');
  });

  const closePaste = () => pasteModal.classList.remove('active');
  closePasteModal.addEventListener('click', closePaste);
  cancelPasteModal.addEventListener('click', closePaste);

  importPastedBtn.addEventListener('click', handlePastedTextImport);

  // Export CSV
  exportCsvBtn.addEventListener('click', exportToCsv);
}

// --- PDF Parsing Logic ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please upload a PDF file.', 'error');
      return;
    }
    processPdfFile(file);
  }
}

async function processPdfFile(file) {
  showToast(`Parsing "${file.name}"...`, 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;
    
    let extractedRows = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageRows = parseTextContentToRows(textContent.items);
      extractedRows = extractedRows.concat(pageRows);
    }

    if (extractedRows.length === 0) {
      showToast('Could not automatically find table data in PDF. Try "Paste Copied Text" if it is scanned.', 'error');
      return;
    }

    // Merge or replace
    const confirmOverwrite = manifestList.length > 0 
      ? confirm(`Found ${extractedRows.length} passenger entries in PDF. Do you want to REPLACE the current manifest? (Click Cancel to APPEND instead)`)
      : true;

    if (confirmOverwrite) {
      manifestList = extractedRows;
    } else {
      manifestList = manifestList.concat(extractedRows);
    }

    saveToStorage();
    renderManifest();
    showToast(`Successfully imported ${extractedRows.length} passengers from PDF!`, 'success');
  } catch (err) {
    console.error('PDF parsing error:', err);
    showToast('Failed to parse PDF: ' + err.message, 'error');
  } finally {
    pdfFileInput.value = '';
  }
}

/**
 * Intelligent parser that groups PDF text items by vertical row (Y coordinate)
 * and column positions (X coordinate), matching Pax, Name, Contact, Pickup Point.
 */
function parseTextContentToRows(items) {
  if (!items || items.length === 0) return [];

  // Group items by Y coordinate with a tolerance of 5px
  const rowsMap = [];

  items.forEach(item => {
    const text = item.str.trim();
    if (!text) return;

    const x = item.transform[4];
    const y = item.transform[5];

    // Find existing row with close Y coordinate
    let rowGroup = rowsMap.find(r => Math.abs(r.y - y) <= 6);
    if (!rowGroup) {
      rowGroup = { y, items: [] };
      rowsMap.push(rowGroup);
    }
    rowGroup.items.push({ x, text });
  });

  // Sort rows top-to-bottom (in PDF coordinate system, larger Y is near the top)
  rowsMap.sort((a, b) => b.y - a.y);

  const parsedList = [];

  for (const row of rowsMap) {
    // Sort items left-to-right
    row.items.sort((a, b) => a.x - b.x);

    // Filter out header row
    const combinedLine = row.items.map(it => it.text).join(' ');
    const lowerLine = combinedLine.toLowerCase();
    if (lowerLine.includes('pax') && (lowerLine.includes('name') || lowerLine.includes('contact') || lowerLine.includes('pickup'))) {
      continue; // Skip header
    }

    // Attempt 1: If 4 distinct columns detected
    if (row.items.length >= 4) {
      const firstNum = parseInt(row.items[0].text, 10);
      if (!isNaN(firstNum)) {
        // Find which item is phone number (matches 10 digits or pattern)
        let phoneIdx = -1;
        for (let i = 1; i < row.items.length; i++) {
          const cleanDigits = row.items[i].text.replace(/\D/g, '');
          if (cleanDigits.length >= 10) {
            phoneIdx = i;
            break;
          }
        }

        if (phoneIdx > 1) {
          const pax = firstNum;
          const name = row.items.slice(1, phoneIdx).map(it => it.text).join(' ').trim();
          const contact = row.items[phoneIdx].text.trim();
          const pickupPoint = row.items.slice(phoneIdx + 1).map(it => it.text).join(' ').trim();

          if (name && contact && pickupPoint) {
            parsedList.push({
              id: 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              pax,
              name,
              contact,
              pickupPoint,
              completed: false,
              called: false
            });
            continue;
          }
        }
      }
    }

    // Attempt 2: Heuristic regex on combined row string
    const match = parseRowString(combinedLine);
    if (match) {
      parsedList.push(match);
    }
  }

  return parsedList;
}

/**
 * Fallback regex parser for row text
 */
function parseRowString(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // Pattern: Pax (1-3 digits) -> Name -> Phone (10 digits) -> Pickup Point
  // Example: "3 DEEPAK P 8939385647 Marathahalli" or with tabs/commas
  // Handles phones like "8939385647", "+91 8939385647", "93001 39193"
  const regex = /^(\d{1,3})\s+([A-Za-z\s.'-]+?)\s+((?:\+?91[\s-]*)?[6-9]\d{4}\s*\d{5}|\d{10})\s+(.+)$/i;
  const match = trimmed.match(regex);

  if (match) {
    return {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      pax: parseInt(match[1], 10),
      name: match[2].trim(),
      contact: match[3].trim(),
      pickupPoint: match[4].trim(),
      completed: false,
      called: false
    };
  }

  // Also support tab-delimited or comma-delimited
  const tokens = trimmed.includes('\t') ? trimmed.split('\t') : trimmed.split(',');
  if (tokens.length >= 4) {
    const pax = parseInt(tokens[0].trim(), 10);
    const name = tokens[1].trim();
    const contact = tokens[2].trim();
    const pickupPoint = tokens.slice(3).join(',').trim();
    if (!isNaN(pax) && name && contact && pickupPoint) {
      return {
        id: 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        pax,
        name,
        contact,
        pickupPoint,
        completed: false,
        called: false
      };
    }
  }

  return null;
}

// --- Import from Paste Modal ---
function handlePastedTextImport() {
  const text = pasteTextarea.value.trim();
  if (!text) {
    showToast('Please paste some data first', 'error');
    return;
  }

  const lines = text.split(/\r?\n/);
  const imported = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    // Skip header line
    const lower = line.toLowerCase();
    if (lower.includes('pax') && (lower.includes('name') || lower.includes('contact'))) continue;

    const row = parseRowString(line);
    if (row) {
      imported.push(row);
    }
  }

  if (imported.length === 0) {
    showToast('Could not recognize any valid rows. Please check format: Pax Name Phone Pickup', 'error');
    return;
  }

  manifestList = manifestList.concat(imported);
  saveToStorage();
  renderManifest();
  pasteModal.classList.remove('active');
  showToast(`Successfully imported ${imported.length} passengers!`, 'success');
}

// --- Sample Data Loader ---
function loadSampleManifest(notify = false) {
  manifestList = JSON.parse(JSON.stringify(SAMPLE_DATA));
  saveToStorage(notify);
  renderManifest();
  if (notify) {
    showToast('Loaded 20 passengers from sample table', 'success');
  }
}

// --- Render Manifest & Stats ---
function renderManifest() {
  updateStats();
  updatePickupFilterDropdown();

  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedPickup = pickupFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = manifestList.filter(item => {
    // Search
    if (searchTerm) {
      const matchName = item.name.toLowerCase().includes(searchTerm);
      const matchContact = item.contact.replace(/\s+/g, '').includes(searchTerm.replace(/\s+/g, ''));
      const matchPickup = item.pickupPoint.toLowerCase().includes(searchTerm);
      if (!matchName && !matchContact && !matchPickup) return false;
    }

    // Pickup filter
    if (selectedPickup !== 'all' && item.pickupPoint.toLowerCase() !== selectedPickup.toLowerCase()) {
      return false;
    }

    // Status filter
    if (selectedStatus === 'pending' && item.completed) return false;
    if (selectedStatus === 'completed' && !item.completed) return false;

    return true;
  });

  visibleCountBadge.textContent = `${filtered.length} of ${manifestList.length} records`;

  if (filtered.length === 0) {
    tableBody.innerHTML = '';
    if (manifestList.length === 0) {
      emptyState.style.display = 'block';
      manifestTable.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      manifestTable.style.display = 'table';
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No passengers matching current filters.</td></tr>`;
    }
    return;
  }

  emptyState.style.display = 'none';
  manifestTable.style.display = 'table';

  tableBody.innerHTML = filtered.map(item => {
    const isCompleted = !!item.completed;
    const isCalled = !!item.called;
    const cleanPhone = item.contact.replace(/[^0-9+]/g, '');

    return `
      <tr class="${isCompleted ? 'row-completed' : ''}" data-id="${item.id}">
        <!-- Checkbox Column -->
        <td class="checkbox-cell">
          <input 
            type="checkbox" 
            class="custom-checkbox row-checkbox" 
            data-id="${item.id}" 
            ${isCompleted ? 'checked' : ''} 
            title="Mark as Picked Up"
          />
        </td>

        <!-- Pax Column -->
        <td>
          <span class="pax-badge">${escapeHtml(item.pax.toString())}</span>
        </td>

        <!-- Name Column -->
        <td>
          <span class="passenger-name">${escapeHtml(item.name)}</span>
        </td>

        <!-- Contact Column -->
        <td>
          <div class="contact-display">
            <span>${escapeHtml(item.contact)}</span>
            <button class="btn-copy-num" data-phone="${escapeHtml(item.contact)}" title="Copy Phone Number">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
          </div>
        </td>

        <!-- Editable Pickup Point Column -->
        <td class="editable-pickup-cell" data-id="${item.id}">
          <div class="pickup-display-box" title="Click to edit pickup point">
            <span class="pickup-text">${escapeHtml(item.pickupPoint)}</span>
            <svg class="edit-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </div>
        </td>

        <!-- Direct Call Button -->
        <td>
          <a 
            href="tel:${cleanPhone}" 
            class="btn-call ${isCalled ? 'called-already' : ''}" 
            data-id="${item.id}"
            title="Call ${escapeHtml(item.name)} directly (${cleanPhone})"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            ${isCalled ? 'Called' : 'Call'}
          </a>
        </td>

        <!-- Row Actions (Delete) -->
        <td style="text-align: right;">
          <button class="row-delete-btn" data-id="${item.id}" title="Remove entry">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachRowEventListeners();
}

// Attach listeners to dynamic elements inside the table
function attachRowEventListeners() {
  // Checkbox toggle (Picked up / done)
  document.querySelectorAll('.row-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item) {
        item.completed = e.target.checked;
        saveToStorage(false);
        renderManifest();
        const msg = item.completed ? `Marked ${item.name} as Picked Up` : `Unmarked ${item.name}`;
        showToast(msg, 'info');
      }
    });
  });

  // Call Button click listener (records call status and triggers tel:)
  document.querySelectorAll('.btn-call').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item) {
        item.called = true;
        saveToStorage(false);
        btn.classList.add('called-already');
        btn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg> Called`;
        showToast(`Initiating call to ${item.name} (${item.contact})...`, 'info');
      }
    });
  });

  // Copy phone number
  document.querySelectorAll('.btn-copy-num').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const phone = btn.getAttribute('data-phone');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(phone).then(() => {
          showToast(`Copied ${phone} to clipboard`, 'success');
        });
      } else {
        showToast(`Phone: ${phone}`, 'info');
      }
    });
  });

  // Delete row
  document.querySelectorAll('.row-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = btn.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item && confirm(`Remove ${item.name} from the list?`)) {
        manifestList = manifestList.filter(x => x.id !== id);
        saveToStorage();
        renderManifest();
      }
    });
  });

  // Inline Pickup Point Editing
  document.querySelectorAll('.editable-pickup-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      if (cell.querySelector('.pickup-inline-input')) return; // already editing

      const id = cell.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (!item) return;

      const currentVal = item.pickupPoint;
      const displayBox = cell.querySelector('.pickup-display-box');
      if (displayBox) displayBox.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pickup-inline-input';
      input.value = currentVal;
      cell.appendChild(input);
      input.focus();
      input.select();

      const finishEdit = (save) => {
        const newVal = input.value.trim();
        if (save && newVal && newVal !== currentVal) {
          item.pickupPoint = newVal;
          saveToStorage();
          showToast(`Updated pickup to "${newVal}"`, 'success');
        }
        renderManifest();
      };

      input.addEventListener('blur', () => finishEdit(true));
      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') {
          finishEdit(true);
        } else if (ke.key === 'Escape') {
          finishEdit(false);
        }
      });
    });
  });
}

// --- Toggle All Visible Checkboxes ---
function handleToggleAllVisible() {
  const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
  if (visibleCheckboxes.length === 0) return;

  const someUnchecked = Array.from(visibleCheckboxes).some(cb => !cb.checked);
  const targetState = someUnchecked; // if some unchecked, mark all checked, else uncheck all

  visibleCheckboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    const item = manifestList.find(x => x.id === id);
    if (item) {
      item.completed = targetState;
    }
  });

  saveToStorage();
  renderManifest();
  showToast(targetState ? 'Marked all filtered as Picked Up' : 'Unchecked all filtered', 'info');
}

// --- Metrics / Stats Calculation ---
function updateStats() {
  const totalBookings = manifestList.length;
  const totalPax = manifestList.reduce((acc, curr) => acc + (parseInt(curr.pax, 10) || 1), 0);
  
  const pickedList = manifestList.filter(x => x.completed);
  const pickedBookings = pickedList.length;
  const pickedPax = pickedList.reduce((acc, curr) => acc + (parseInt(curr.pax, 10) || 1), 0);

  const pendingBookings = totalBookings - pickedBookings;
  const pendingPax = totalPax - pickedPax;

  statTotalPax.textContent = totalPax;
  statTotalBookings.textContent = totalBookings;
  statPickedUp.textContent = pickedBookings;
  statPaxPicked.textContent = `${pickedPax} pax boarded`;
  statPending.textContent = pendingBookings;
  statPaxPending.textContent = `${pendingPax} pax waiting`;
}

// --- Update Pickup Point Filter Options ---
function updatePickupFilterDropdown() {
  const currentSelection = pickupFilter.value;
  const uniquePoints = Array.from(new Set(manifestList.map(item => item.pickupPoint.trim()).filter(Boolean))).sort();

  // Preserve existing options
  pickupFilter.innerHTML = '<option value="all">All Pickup Points</option>';
  uniquePoints.forEach(pt => {
    const opt = document.createElement('option');
    opt.value = pt;
    opt.textContent = pt;
    if (pt.toLowerCase() === currentSelection.toLowerCase()) {
      opt.selected = true;
    }
    pickupFilter.appendChild(opt);
  });
}

// --- Export to CSV ---
function exportToCsv() {
  if (manifestList.length === 0) {
    showToast('Manifest is empty.', 'error');
    return;
  }

  const headers = ['Pax', 'Name', 'Contact Number', 'Pickup Point', 'Status', 'Call Made'];
  const rows = manifestList.map(item => [
    `"${item.pax}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.contact}"`,
    `"${item.pickupPoint.replace(/"/g, '""')}"`,
    item.completed ? '"Picked Up"' : '"Pending"',
    item.called ? '"Yes"' : '"No"'
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `passenger_manifest_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Manifest exported to CSV', 'success');
}

// --- Toast Notifications ---
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else {
    iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
  }

  toast.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- Utilities ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
