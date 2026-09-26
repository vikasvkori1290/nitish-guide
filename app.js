/**
 * Passenger Manifest & Dispatch Manager
 * Pure HTML / CSS / JS Application
 *
 * Automatically parses PDF table manifests (pax | Name | Contact number | Pickup point),
 * stores all data in browser localStorage, enables direct mobile calling (tel:),
 * and provides inline-editable pickup points.
 */

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const STORAGE_KEY = 'passenger_manifest_records_v2';

// Active App State - NO HARDCODED NAMES OR DETAILS
let manifestList = [];

// DOM Elements
const pdfFileInput = document.getElementById('pdfFileInput');
const dropzone = document.getElementById('dropzone');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const manifestTable = document.getElementById('manifestTable');

// Stats
const statTotalPax = document.getElementById('statTotalPax');
const statTotalBookings = document.getElementById('statTotalBookings');
const statPickedUp = document.getElementById('statPickedUp');
const statPaxPicked = document.getElementById('statPaxPicked');
const statPending = document.getElementById('statPending');
const statPaxPending = document.getElementById('statPaxPending');
const visibleCountBadge = document.getElementById('visibleCountBadge');
const storageStatusText = document.getElementById('storageStatusText');

// Location Summary Elements (Bottom Breakdown)
const locationSummarySection = document.getElementById('locationSummarySection');
const locationCountBadge = document.getElementById('locationCountBadge');
const summaryTableBody = document.getElementById('summaryTableBody');
const summaryTableFoot = document.getElementById('summaryTableFoot');

// Filters
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const pickupFilter = document.getElementById('pickupFilter');
const statusFilter = document.getElementById('statusFilter');
const batchCheckAllBtn = document.getElementById('batchCheckAllBtn');

// Actions & Modals
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

// Load records from browser LocalStorage (starts empty if user hasn't uploaded yet)
function loadFromStorage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      manifestList = JSON.parse(saved);
    } else {
      manifestList = [];
    }
  } catch (err) {
    console.error('Error reading localStorage', err);
    manifestList = [];
  }
}

// Save records to browser LocalStorage
function saveToStorage(notify = true) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifestList));
    updateStorageBadge();
    if (notify) {
      showToast('Saved to browser storage', 'success');
    }
  } catch (err) {
    console.error('Error saving to localStorage', err);
    showToast('Failed to save data: ' + err.message, 'error');
  }
}

function updateStorageBadge() {
  if (storageStatusText) {
    storageStatusText.textContent = manifestList.length > 0 
      ? `Saved (${manifestList.length})` 
      : 'Ready';
  }
}

// --- Setup User Events ---
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
    if (files.length > 0) {
      const file = files[0];
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        processPdfFile(file);
      } else {
        showToast('Please drop a valid PDF file.', 'error');
      }
    }
  });

  // Search input
  searchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
    renderManifest();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    renderManifest();
  });

  // Filters
  pickupFilter.addEventListener('change', renderManifest);
  statusFilter.addEventListener('change', renderManifest);

  // Clear / Reset All
  clearAllBtn.addEventListener('click', () => {
    if (manifestList.length === 0) {
      showToast('Manifest is already empty', 'info');
      return;
    }
    if (confirm('Clear all passenger data from browser storage?')) {
      manifestList = [];
      saveToStorage(false);
      renderManifest();
      showToast('All passenger records cleared', 'info');
    }
  });

  batchCheckAllBtn.addEventListener('click', handleToggleAllVisible);

  // Manual Add Passenger Modal
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
      id: 'pax_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
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
    showToast(`Added ${nameVal}`, 'success');
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

// --- PDF Parsing Engine ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      showToast('Please select a PDF file.', 'error');
      return;
    }
    processPdfFile(file);
  }
}

async function processPdfFile(file) {
  showToast(`Reading PDF: ${file.name}...`, 'info');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    let allExtracted = [];

    // Loop through all pages in the PDF
    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      const pageRows = parsePageTextContent(textContent.items);
      allExtracted = allExtracted.concat(pageRows);
    }

    if (allExtracted.length === 0) {
      showToast('No table rows detected in the PDF. Please check if the file format matches: pax, Name, Contact, Pickup point.', 'error');
      return;
    }

    // Set manifest from PDF
    manifestList = allExtracted;
    saveToStorage();
    renderManifest();
    showToast(`Loaded ${allExtracted.length} passengers from PDF!`, 'success');
  } catch (err) {
    console.error('PDF parsing error:', err);
    showToast('Failed to read PDF: ' + err.message, 'error');
  } finally {
    pdfFileInput.value = '';
  }
}

/**
 * Robust Table Extractor:
 * Handles coordinates, variable spacing, and token stream fallbacks.
 * Table format:
 *   Column 1: pax (number)
 *   Column 2: Name (text)
 *   Column 3: Contact number (10 digits or formatted phone)
 *   Column 4: Pickup point (text)
 */
function parsePageTextContent(items) {
  if (!items || items.length === 0) return [];

  // Group items by vertical line (Y coordinate, tolerance ~6px)
  const rowsMap = [];

  items.forEach(item => {
    const text = item.str ? item.str.trim() : '';
    if (!text) return;

    const x = item.transform[4];
    const y = item.transform[5];

    let rowGroup = rowsMap.find(r => Math.abs(r.y - y) <= 6);
    if (!rowGroup) {
      rowGroup = { y, items: [] };
      rowsMap.push(rowGroup);
    }
    rowGroup.items.push({ x, text });
  });

  // Sort rows top-to-bottom (PDF Y coordinate is bottom-up, so highest Y is first)
  rowsMap.sort((a, b) => b.y - a.y);

  const parsedRows = [];

  // Find column header coordinates if present
  let headerCoords = null;
  for (const row of rowsMap) {
    row.items.sort((a, b) => a.x - b.x);
    const lineText = row.items.map(i => i.text).join(' ').toLowerCase();
    if (lineText.includes('pax') && (lineText.includes('name') || lineText.includes('contact') || lineText.includes('pickup'))) {
      headerCoords = row.items;
      break;
    }
  }

  // Parse each row
  for (const row of rowsMap) {
    row.items.sort((a, b) => a.x - b.x);

    // Skip header row
    const lineCombined = row.items.map(i => i.text).join(' ');
    const lowerLine = lineCombined.toLowerCase();
    if (lowerLine.includes('pax') && (lowerLine.includes('contact') || lowerLine.includes('pickup') || lowerLine.includes('name'))) {
      continue;
    }

    // Attempt 1: Contact Number Anchor Detection
    // Look for a phone number in the items
    let phoneIndex = -1;
    for (let i = 0; i < row.items.length; i++) {
      const cleanDigits = row.items[i].text.replace(/\D/g, '');
      // Match 10-digit Indian numbers or standard phone numbers
      if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
        phoneIndex = i;
        break;
      }
    }

    if (phoneIndex !== -1) {
      // Tokens before phone: first token should be pax number
      const beforeTokens = row.items.slice(0, phoneIndex);
      const afterTokens = row.items.slice(phoneIndex + 1);

      if (beforeTokens.length >= 2 && afterTokens.length >= 1) {
        const firstToken = beforeTokens[0].text;
        const paxNum = parseInt(firstToken, 10);
        
        if (!isNaN(paxNum)) {
          const name = beforeTokens.slice(1).map(t => t.text).join(' ').trim();
          const contact = row.items[phoneIndex].text.trim();
          const pickupPoint = afterTokens.map(t => t.text).join(' ').trim();

          if (name && contact && pickupPoint) {
            parsedRows.push({
              id: 'pdf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
              pax: paxNum,
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

    // Attempt 2: Line Regex Parser
    const regexParsed = parseRowString(lineCombined);
    if (regexParsed) {
      parsedRows.push(regexParsed);
    }
  }

  // Attempt 3: If coordinate grouping found nothing (e.g. stream printed), try token stream sequence
  if (parsedRows.length === 0) {
    const streamRows = parseTokenStream(items.map(i => i.str.trim()).filter(Boolean));
    if (streamRows.length > 0) {
      return streamRows;
    }
  }

  return parsedRows;
}

/**
 * Fallback regex parser for row string
 * Format: [pax] [Name] [10-digit Phone] [Pickup Point]
 */
function parseRowString(line) {
  if (!line || !line.trim()) return null;
  const trimmed = line.trim();

  // Skip header lines
  const lower = trimmed.toLowerCase();
  if (lower.includes('pax') && (lower.includes('contact') || lower.includes('pickup'))) return null;

  // Regex matches: Pax Number (1-3 digits) -> Name -> Phone (10-12 digits) -> Pickup Point
  const regex = /^(\d{1,3})\s+([A-Za-z\s.'-]+?)\s+((?:\+?91[\s-]*)?[6-9]\d{4}\s*\d{5}|[6-9]\d{9}|\b\d{10}\b)\s+(.+)$/i;
  const match = trimmed.match(regex);

  if (match) {
    return {
      id: 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      pax: parseInt(match[1], 10),
      name: match[2].trim(),
      contact: match[3].trim(),
      pickupPoint: match[4].trim(),
      completed: false,
      called: false
    };
  }

  // Delimited fallback (Tab or Comma)
  const delimiter = trimmed.includes('\t') ? '\t' : (trimmed.includes(',') ? ',' : null);
  if (delimiter) {
    const parts = trimmed.split(delimiter).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 4) {
      const pax = parseInt(parts[0], 10);
      if (!isNaN(pax)) {
        return {
          id: 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          pax,
          name: parts[1],
          contact: parts[2],
          pickupPoint: parts.slice(3).join(' '),
          completed: false,
          called: false
        };
      }
    }
  }

  return null;
}

/**
 * Sequential token stream fallback:
 * Useful when PDF text is outputted linearly cell by cell:
 * [Pax, Name, Phone, Pickup, Pax, Name, Phone, Pickup...]
 */
function parseTokenStream(tokens) {
  const results = [];
  let i = 0;

  // Find start after header
  while (i < tokens.length) {
    const tok = tokens[i].toLowerCase();
    if (tok.includes('pax') || tok.includes('pickup') || tok.includes('contact')) {
      i++;
    } else {
      break;
    }
  }

  while (i < tokens.length - 3) {
    const paxCandidate = parseInt(tokens[i], 10);
    // Pax is typically a small number (1-50)
    if (!isNaN(paxCandidate) && paxCandidate >= 1 && paxCandidate <= 99) {
      const name = tokens[i + 1];
      const phone = tokens[i + 2];
      const pickup = tokens[i + 3];

      const cleanDigits = phone.replace(/\D/g, '');
      if (cleanDigits.length >= 10 && cleanDigits.length <= 13) {
        results.push({
          id: 'tok_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          pax: paxCandidate,
          name,
          contact: phone,
          pickupPoint: pickup,
          completed: false,
          called: false
        });
        i += 4;
        continue;
      }
    }
    i++;
  }

  return results;
}

// --- Import from Paste Modal ---
function handlePastedTextImport() {
  const text = pasteTextarea.value.trim();
  if (!text) {
    showToast('Please paste table data first', 'error');
    return;
  }

  const lines = text.split(/\r?\n/);
  const imported = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    const row = parseRowString(line);
    if (row) {
      imported.push(row);
    }
  }

  if (imported.length === 0) {
    showToast('Could not parse rows. Ensure format is: Pax Name Phone Pickup', 'error');
    return;
  }

  manifestList = manifestList.concat(imported);
  saveToStorage();
  renderManifest();
  pasteModal.classList.remove('active');
  showToast(`Imported ${imported.length} passengers!`, 'success');
}

// --- Render Manifest & Stats ---
function renderManifest() {
  updateStats();
  updatePickupFilterDropdown();

  const searchTerm = searchInput.value.toLowerCase().trim();
  const selectedPickup = pickupFilter.value;
  const selectedStatus = statusFilter.value;

  const filtered = manifestList.filter(item => {
    if (searchTerm) {
      const matchName = item.name.toLowerCase().includes(searchTerm);
      const matchContact = item.contact.replace(/\s+/g, '').includes(searchTerm.replace(/\s+/g, ''));
      const matchPickup = item.pickupPoint.toLowerCase().includes(searchTerm);
      if (!matchName && !matchContact && !matchPickup) return false;
    }

    if (selectedPickup !== 'all' && getNormalizedKey(item.pickupPoint) !== selectedPickup) {
      return false;
    }

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
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted); font-weight: 600;">No passengers match the current filters.</td></tr>`;
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
            <button class="btn-copy-num" data-phone="${escapeHtml(item.contact)}" title="Copy Number">
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

        <!-- Direct Call & Checkbox Column -->
        <td>
          <div class="call-cell-wrapper">
            <input 
              type="checkbox" 
              class="custom-checkbox call-checkbox" 
              data-id="${item.id}" 
              ${isCalled ? 'checked' : ''} 
              title="Mark if called"
            />
            <a 
              href="tel:${cleanPhone}" 
              class="btn-call" 
              data-id="${item.id}"
              title="Call ${escapeHtml(item.name)} (${cleanPhone})"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
              Call
            </a>
          </div>
        </td>

        <!-- Row Delete Action -->
        <td style="text-align: right;">
          <button class="row-delete-btn" data-id="${item.id}" title="Remove entry">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  attachRowEventListeners();
  renderLocationSummary();
}

function attachRowEventListeners() {
  // Checkbox toggle (Picked up / boarded)
  document.querySelectorAll('.row-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item) {
        item.completed = e.target.checked;
        saveToStorage(false);
        renderManifest();
        showToast(item.completed ? `Checked ${item.name}` : `Unchecked ${item.name}`, 'info');
      }
    });
  });

  // Call Checkbox toggle (User manually marks/unmarks)
  document.querySelectorAll('.call-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item) {
        item.called = e.target.checked;
        saveToStorage(false);
        showToast(item.called ? `Marked ${item.name} as Called` : `Unmarked ${item.name}`, 'info');
      }
    });
  });

  // Direct Call Button (dial without changing button label)
  document.querySelectorAll('.btn-call').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item) {
        showToast(`Calling ${item.name}...`, 'info');
      }
    });
  });

  // Copy number
  document.querySelectorAll('.btn-copy-num').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const phone = btn.getAttribute('data-phone');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(phone).then(() => {
          showToast(`Copied ${phone}`, 'success');
        });
      } else {
        showToast(`Phone: ${phone}`, 'info');
      }
    });
  });

  // Delete passenger row
  document.querySelectorAll('.row-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const item = manifestList.find(x => x.id === id);
      if (item && confirm(`Remove ${item.name}?`)) {
        manifestList = manifestList.filter(x => x.id !== id);
        saveToStorage();
        renderManifest();
      }
    });
  });

  // Editable Pickup Point (click / tap to edit)
  document.querySelectorAll('.editable-pickup-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      if (cell.querySelector('.pickup-inline-input')) return;

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

// Toggle all currently visible checkboxes
function handleToggleAllVisible() {
  const visibleCheckboxes = document.querySelectorAll('.row-checkbox');
  if (visibleCheckboxes.length === 0) return;

  const someUnchecked = Array.from(visibleCheckboxes).some(cb => !cb.checked);
  const targetState = someUnchecked;

  visibleCheckboxes.forEach(cb => {
    const id = cb.getAttribute('data-id');
    const item = manifestList.find(x => x.id === id);
    if (item) {
      item.completed = targetState;
    }
  });

  saveToStorage();
  renderManifest();
  showToast(targetState ? 'Marked all visible as Picked Up' : 'Unchecked all visible', 'info');
}

// Update stats
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

// Update Pickup Point filter options dynamically from current list (case-insensitive)
function updatePickupFilterDropdown() {
  const currentSelection = (pickupFilter.value || 'all').toLowerCase().trim();
  const uniqueMap = new Map();

  manifestList.forEach(item => {
    const raw = (item.pickupPoint || '').trim();
    if (!raw) return;
    const key = getNormalizedKey(raw);
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, cleanPickupPointName(raw));
    }
  });

  const sortedKeys = Array.from(uniqueMap.keys()).sort();

  pickupFilter.innerHTML = '<option value="all">All Pickup Points</option>';
  sortedKeys.forEach(k => {
    const opt = document.createElement('option');
    opt.value = k;
    opt.textContent = uniqueMap.get(k);
    if (k === currentSelection) {
      opt.selected = true;
    }
    pickupFilter.appendChild(opt);
  });
}

// Export Manifest to CSV
function exportToCsv() {
  if (manifestList.length === 0) {
    showToast('Manifest is empty. Upload a PDF first.', 'error');
    return;
  }

  const headers = ['Pax', 'Name', 'Contact Number', 'Pickup Point', 'Status', 'Called'];
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
  link.setAttribute('download', `manifest_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Exported to CSV', 'success');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  } else {
    iconSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }

  toast.innerHTML = `${iconSvg} <span>${escapeHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes pickup point names so that uppercase, lowercase,
 * and minor spelling variations (e.g. 'Marathahalli' vs 'marathalli')
 * are cleanly treated as the SAME location.
 */
function cleanPickupPointName(str) {
  if (!str) return 'Unspecified';
  const trimmed = str.trim();
  const lower = trimmed.toLowerCase().replace(/[\s\-_]+/g, '');

  if (lower === 'marathalli' || lower === 'marathahalli') {
    return 'Marathahalli';
  }
  if (lower === 'silkboard') {
    return 'Silk Board';
  }
  if (lower === 'btm' || lower === 'btmlayout') {
    return 'BTM';
  }
  if (lower === 'bellandur') {
    return 'Bellandur';
  }
  if (lower === 'kalamandir' || lower === 'kalamandira') {
    return 'Kalamandir';
  }

  // General Title Case for any other place name
  return trimmed
    .split(/\s+/)
    .map(word => {
      // Keep short acronyms (e.g. BTM, HSR) uppercase
      if (word.length <= 4 && word === word.toUpperCase() && /^[A-Z]+$/.test(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function getNormalizedKey(str) {
  const cleaned = cleanPickupPointName(str);
  return cleaned.toLowerCase().replace(/[\s\-_]+/g, '');
}

// --- Dynamic Location Summary (Groups & Pax Boarding per Place) ---
function renderLocationSummary() {
  if (!locationSummarySection || !summaryTableBody || !summaryTableFoot) return;

  if (manifestList.length === 0) {
    locationSummarySection.style.display = 'none';
    return;
  }

  locationSummarySection.style.display = 'block';

  // Group by case-insensitive normalized pickup point key
  const locationMap = new Map();

  manifestList.forEach(item => {
    const rawPlace = (item.pickupPoint || 'Unspecified').trim();
    const key = getNormalizedKey(rawPlace);
    const standardName = cleanPickupPointName(rawPlace);
    const paxCount = parseInt(item.pax, 10) || 1;
    const isCompleted = !!item.completed;

    if (!locationMap.has(key)) {
      locationMap.set(key, {
        displayName: standardName,
        groups: 0,
        totalPax: 0,
        boardedPax: 0,
        waitingPax: 0
      });
    }

    const loc = locationMap.get(key);
    loc.groups += 1;
    loc.totalPax += paxCount;
    if (isCompleted) {
      loc.boardedPax += paxCount;
    } else {
      loc.waitingPax += paxCount;
    }
  });

  const locations = Array.from(locationMap.values()).sort((a, b) => b.totalPax - a.totalPax);

  if (locationCountBadge) {
    locationCountBadge.textContent = `${locations.length} Places`;
  }

  let grandTotalGroups = 0;
  let grandTotalPax = 0;
  let grandBoardedPax = 0;

  summaryTableBody.innerHTML = locations.map(loc => {
    grandTotalGroups += loc.groups;
    grandTotalPax += loc.totalPax;
    grandBoardedPax += loc.boardedPax;

    const pct = loc.totalPax > 0 ? Math.round((loc.boardedPax / loc.totalPax) * 100) : 0;
    const isAllBoarded = loc.boardedPax >= loc.totalPax;

    return `
      <tr>
        <td>
          <span class="place-name">📍 ${escapeHtml(loc.displayName)}</span>
        </td>
        <td style="text-align: center;">
          <span class="groups-pill">${loc.groups} ${loc.groups === 1 ? 'group' : 'groups'}</span>
        </td>
        <td style="text-align: center;">
          <span class="pax-pill">${loc.totalPax} pax</span>
        </td>
        <td>
          <div class="progress-label">
            <span>${loc.boardedPax} / ${loc.totalPax} boarded</span>
            <span>${pct}%</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td style="text-align: center;">
          <span class="status-badge ${isAllBoarded ? 'status-ready' : 'status-waiting'}">
            ${isAllBoarded ? '✓ Boarded' : `${loc.waitingPax} waiting`}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const grandPct = grandTotalPax > 0 ? Math.round((grandBoardedPax / grandTotalPax) * 100) : 0;
  const grandWaiting = grandTotalPax - grandBoardedPax;

  summaryTableFoot.innerHTML = `
    <tr>
      <td><strong>Total: ${locations.length} Locations</strong></td>
      <td style="text-align: center;"><strong>${grandTotalGroups} Groups</strong></td>
      <td style="text-align: center;"><strong>${grandTotalPax} Pax</strong></td>
      <td>
        <div class="progress-label">
          <span><strong>${grandBoardedPax} / ${grandTotalPax} boarded</strong></span>
          <span><strong>${grandPct}%</strong></span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${grandPct}%;"></div>
        </div>
      </td>
      <td style="text-align: center;">
        <span class="status-badge ${grandWaiting === 0 ? 'status-ready' : 'status-waiting'}">
          ${grandWaiting === 0 ? '✓ Complete' : `${grandWaiting} waiting`}
        </span>
      </td>
    </tr>
  `;
}
