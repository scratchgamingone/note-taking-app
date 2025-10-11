// Serene Notes - script
(function(){
  // Utilities
  function uid(){
    return 'id-' + Math.random().toString(36).slice(2,10);
  }

  function getDeviceId(){
    const key = 'serene_device_id';
    let id = localStorage.getItem(key);
    if(!id){
      id = uid() + '-' + Date.now().toString(36);
      localStorage.setItem(key, id);
    }
    return id;
  }

  // Storage keys
  function notesKey(deviceId){ return `serene_notes::${deviceId}` }
  function mappingsKey(deviceId){ return `serene_maps::${deviceId}` }
  function foldersKey(deviceId){ return `serene_folders::${deviceId}` }
  function draftsKey(deviceId){ return `serene_drafts::${deviceId}` }

  // App state
  const state = {
    deviceId: getDeviceId(),
    currentNoteId: null,
    notes: {},
    mappings: {},
    folders: {},
    currentFolder: null
  };
  // draft state
  state.drafts = {};
  state.currentDraftId = null;

  // Brand (editable)
  const BRAND_KEY = 'serene_brand';
  function getBrand(){ return localStorage.getItem(BRAND_KEY) || 'Serene Notes' }


  // Elements
  const el = id => document.getElementById(id);
  // Ensure modal is hidden immediately (defensive)
  const earlyModal = el('folder-modal');
  if(earlyModal){ earlyModal.style.display='none'; earlyModal.classList.add('hidden'); earlyModal.setAttribute('aria-hidden','true'); }
  const earlyDownloadModal = el('download-modal');
  if(earlyDownloadModal){ earlyDownloadModal.style.display='none'; earlyDownloadModal.classList.add('hidden'); earlyDownloadModal.setAttribute('aria-hidden','true'); }
  const notesUl = el('notes-ul');
  const draftsUl = el('drafts-ul');
  const editor = el('editor');
  const preview = el('preview');
  const titleInput = el('note-title');
  const deviceInput = el('device-id');
  const setSerial = el('set-serial');
  const deviceSerialInput = el('device-serial-input');
  const copyIdBtn = el('copy-id');

  // Init
  // If device is passed via URL query (?device=...) or hash (#device=...), use it to set deviceId
  function getDeviceFromUrl(){
    try{
      const params = new URLSearchParams(window.location.search);
      if(params.has('device')) return params.get('device');
      // support hash like #device=SERIAL
      if(window.location.hash && window.location.hash.includes('device=')){
        const h = window.location.hash.replace('#','');
        const p = new URLSearchParams(h);
        if(p.has('device')) return p.get('device');
      }
    }catch(e){ /* ignore */ }
    return null;
  }

  const urlDevice = getDeviceFromUrl();
  if(urlDevice){
    state.deviceId = urlDevice;
    // also save generated device id key so subsequent loads use this id
    localStorage.setItem('serene_device_id', urlDevice);
  }
  deviceInput.value = state.deviceId;
  loadAll();
  renderNotesList();
  renderMappings();
  renderDrafts();
  // brand setup
  const brandText = el('brand-text');
  const brandInput = el('brand-input');
  const editBrandBtn = el('edit-brand');
  function applyBrand(){ const b = getBrand(); brandText.textContent = b; brandInput.value = b; }
  applyBrand();
  editBrandBtn.addEventListener('click', ()=>{
    brandText.classList.add('hidden'); brandInput.classList.remove('hidden'); brandInput.focus();
  });
  brandInput.addEventListener('blur', ()=>{ const v = brandInput.value.trim() || 'Serene Notes'; localStorage.setItem(BRAND_KEY, v); applyBrand(); brandInput.classList.add('hidden'); brandText.classList.remove('hidden'); });
  brandInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ brandInput.blur(); } });

  // File upload
  const fileInput = el('file-input');
  el('upload-btn').addEventListener('click', ()=>fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);

  // Track recent user interaction to avoid modal showing from automated flows
  window.__serene_last_interaction = Date.now();
  ['mousedown','keydown','touchstart'].forEach(ev => window.addEventListener(ev, ()=> window.__serene_last_interaction = Date.now()));

  function handleFileUpload(e){
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      createNoteFromText(f.name.replace(/\.[^.]+$/, '') || 'Imported', String(reader.result));
    };
    reader.readAsText(f);
    fileInput.value = '';
  }

  // Device serial override
  setSerial.addEventListener('click', ()=>{
    const v = deviceSerialInput.value.trim();
    if(!v){ alert('Enter a serial or leave blank to use generated ID'); return }
    state.deviceId = v;
    deviceInput.value = v;
    loadAll(); renderNotesList(); renderMappings();
  });

  copyIdBtn.addEventListener('click', ()=>{
    navigator.clipboard?.writeText(state.deviceId).then(()=> alert('Copied'))
  });

  // Notes management
  el('new-note').addEventListener('click', ()=>createNote());
  // Save now takes a parameter whether to prompt for folder
  el('save-note').addEventListener('click', ()=> saveCurrentNote(true));
  // Save draft
  const saveDraftBtn = el('save-draft');
  if(saveDraftBtn) saveDraftBtn.addEventListener('click', saveCurrentDraft);
  el('delete-note').addEventListener('click', deleteCurrentNote);
  el('download-note').addEventListener('click', downloadCurrentNote);

  // Download modal buttons
  const downloadModal = el('download-modal');
  const downloadTxtBtn = el('download-txt');
  const downloadDocBtn = el('download-doc');
  const downloadCancelBtn = el('download-cancel');
  const downloadDocxBtn = el('download-docx');
  const includeMetadataCb = el('include-metadata');
  if(downloadTxtBtn) downloadTxtBtn.addEventListener('click', ()=>{ performDownload('txt'); });
  if(downloadDocBtn) downloadDocBtn.addEventListener('click', ()=>{ performDownload('doc'); });
  if(downloadCancelBtn) downloadCancelBtn.addEventListener('click', ()=>{ if(downloadModal){ downloadModal.classList.add('hidden'); downloadModal.style.display='none'; downloadModal.setAttribute('aria-hidden','true'); } });
  if(downloadDocxBtn) downloadDocxBtn.addEventListener('click', ()=>{ performDownload('docx'); });

  function loadAll(){
    const n = localStorage.getItem(notesKey(state.deviceId)) || '{}';
    state.notes = JSON.parse(n);
    const m = localStorage.getItem(mappingsKey(state.deviceId)) || '{}';
    state.mappings = JSON.parse(m);
    const f = localStorage.getItem(foldersKey(state.deviceId)) || '{}';
    state.folders = JSON.parse(f);
    const d = localStorage.getItem(draftsKey(state.deviceId)) || '{}';
    state.drafts = JSON.parse(d);
  }

  function persist(){
    localStorage.setItem(notesKey(state.deviceId), JSON.stringify(state.notes));
    localStorage.setItem(mappingsKey(state.deviceId), JSON.stringify(state.mappings));
    localStorage.setItem(foldersKey(state.deviceId), JSON.stringify(state.folders));
    localStorage.setItem(draftsKey(state.deviceId), JSON.stringify(state.drafts));
  }

  function createNote(){
    const id = uid();
    const newNote = {id,title:'Untitled',content:'',updated:Date.now(), folder: state.currentFolder};
    state.notes[id] = newNote;
    state.currentNoteId = id;
    persist(); renderNotesList(); openNote(id);
  }

  function createNoteFromText(name, text){
    const id = uid();
    state.notes[id] = {id,title:name,content:text,updated:Date.now(), folder: state.currentFolder};
    state.currentNoteId = id;
    persist(); renderNotesList(); openNote(id);
  }

  // Draft functions
  function saveCurrentDraft(){
    // save current editor content as a draft
    const id = state.currentDraftId || uid();
    const draft = {id,title: titleInput.value || 'Draft', content: editor.value, updated: Date.now()};
    state.drafts[id] = draft;
    state.currentDraftId = id;
    persist(); renderDrafts(); alert('Draft saved');
  }

  function renderDrafts(){
    if(!draftsUl) return;
    draftsUl.innerHTML = '';
    const list = Object.values(state.drafts).sort((a,b)=>b.updated - a.updated);
    list.forEach(d=>{
      const li = document.createElement('li');
      li.textContent = d.title || 'Draft';
      li.title = new Date(d.updated).toLocaleString();
      li.addEventListener('click', ()=>{ state.currentDraftId = d.id; loadDraft(d.id); });
      const del = document.createElement('button'); del.textContent = 'Del'; del.className='btn ghost'; del.style.marginLeft='8px';
      del.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(!confirm('Delete draft?')) return; delete state.drafts[d.id]; if(state.currentDraftId===d.id) state.currentDraftId=null; persist(); renderDrafts(); });
      li.appendChild(del);
      draftsUl.appendChild(li);
    });
  }

  function loadDraft(id){
    const d = state.drafts[id]; if(!d) return;
    titleInput.value = d.title; editor.value = d.content; renderPreview();
  }

  function renderNotesList(filter){
    notesUl.innerHTML = '';
    const entries = Object.values(state.notes).sort((a,b)=>b.updated - a.updated);
    const bySearch = filter ? entries.filter(n=>n.title.includes(filter) || n.content.includes(filter)) : entries;
    const filtered = bySearch.filter(n => !state.currentFolder || (n.folder && n.folder === state.currentFolder));
    filtered.forEach(n=>{
      const li = document.createElement('li');
      li.textContent = n.title || '(untitled)';
      li.title = new Date(n.updated).toLocaleString();
      li.addEventListener('click', ()=>{ state.currentNoteId = n.id; openNote(n.id); });
      notesUl.appendChild(li);
    });
  }

  function openNote(id){
    const note = state.notes[id];
    if(!note) return;
    titleInput.value = note.title;
    editor.value = note.content;
    renderPreview();
  }

  function saveCurrentNote(promptForFolder){
    const id = state.currentNoteId;
    if(!id) return createNote();
    // prepare note data but don't persist yet until user chooses folder
    const updatedNote = Object.assign({}, state.notes[id]);
    updatedNote.title = titleInput.value || 'Untitled';
    updatedNote.content = editor.value;
    updatedNote.updated = Date.now();

    // If there are folders, prompt the user to pick one or save without folder
    const folderIds = Object.keys(state.folders);
    if(folderIds.length === 0){
      // no folders - save immediately
      state.notes[id] = updatedNote;
      // if this was a draft, remove it
      if(state.currentDraftId){ delete state.drafts[state.currentDraftId]; state.currentDraftId = null; }
      persist(); renderNotesList(); renderDrafts(); alert('Saved');
      return;
    }
    // If not explicitly prompted, just save without asking
    if(!promptForFolder){ state.notes[id] = updatedNote; persist(); renderNotesList(); alert('Saved'); return; }

    // Require a recent user interaction (click/keydown) to open the modal — prevents accidental modal on load
    const now = Date.now();
    if(!window.__serene_last_interaction || (now - window.__serene_last_interaction) > 3000){
      // no recent user interaction; save without prompting
      state.notes[id] = updatedNote; persist(); renderNotesList(); alert('Saved'); return;
    }
    const modal = el('folder-modal');
    const select = el('folder-select');
    const btnSaveFolder = el('modal-save-folder');
    const btnSaveNoFolder = el('modal-save-no-folder');
    const btnCancel = el('modal-cancel');
    select.innerHTML = '';
    const noneOpt = document.createElement('option'); noneOpt.value = '__none__'; noneOpt.textContent = '-- Select folder --'; select.appendChild(noneOpt);
    Object.values(state.folders).forEach(f=>{
      const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; select.appendChild(o);
    });
  modal.style.display = ''; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');

  function cleanup(){ modal.classList.add('hidden'); modal.style.display='none'; modal.setAttribute('aria-hidden','true'); btnSaveFolder.removeEventListener('click', onSaveFolder); btnSaveNoFolder.removeEventListener('click', onSaveNoFolder); btnCancel.removeEventListener('click', onCancel); }

    function onSaveFolder(){ const folderId = select.value; if(!folderId || folderId==='__none__'){ alert('Select a folder or choose Save without folder'); return; } updatedNote.folder = folderId; state.notes[id] = updatedNote; persist(); renderNotesList(); cleanup(); alert('Saved to folder'); }
    function onSaveNoFolder(){ updatedNote.folder = null; state.notes[id] = updatedNote; persist(); renderNotesList(); cleanup(); alert('Saved'); }
    function onCancel(){ cleanup(); }

    btnSaveFolder.addEventListener('click', onSaveFolder);
    btnSaveNoFolder.addEventListener('click', onSaveNoFolder);
    btnCancel.addEventListener('click', onCancel);
  }

  function deleteCurrentNote(){
    const id = state.currentNoteId;
    if(!id) return;
    if(!confirm('Delete this note?')) return;
    delete state.notes[id];
    state.currentNoteId = null; persist(); renderNotesList(); titleInput.value=''; editor.value=''; renderPreview();
  }

  function downloadCurrentNote(){
    const id = state.currentNoteId; if(!id) return alert('No note selected');
    // show modal to choose txt or doc
    const modal = downloadModal || el('download-modal');
    if(!modal){ // fallback to txt
      const n = state.notes[id]; const blob = new Blob([n.content], {type:'text/plain'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=(n.title||'note')+'.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); return;
    }
    modal.style.display=''; modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
  }

  // performDownload handles actual file generation for chosen format
  function performDownload(format){
    const id = state.currentNoteId; if(!id) return alert('No note selected');
    const n = state.notes[id];
    // hide modal
    if(downloadModal){ downloadModal.classList.add('hidden'); downloadModal.style.display='none'; downloadModal.setAttribute('aria-hidden','true'); }
    // show toast that download started
    showToast('Preparing download...');
    if(format === 'txt'){
      const blob = new Blob([n.content], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = (n.title || 'note') + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      return;
    }
    // doc: preserve preview HTML with inline colors
    // build a minimal HTML document wrapping the preview content
    const previewHtml = preview.innerHTML || escapeHtml(n.content).replace(/\n/g,'<br>');
    const brand = getBrand();
    // optionally include metadata
    let metaHtml = '';
    if(includeMetadataCb && includeMetadataCb.checked){
      const mappingsHtml = Object.keys(state.mappings).map(k=>`<li><code>${escapeHtml(k)}</code> → <span style="color:${state.mappings[k]}">${escapeHtml(state.mappings[k])}</span></li>`).join('');
      metaHtml = `<div class="meta" style="margin-top:12px;font-size:13px;color:#666"><strong>Metadata</strong><ul>${mappingsHtml}</ul><div>Device: ${escapeHtml(state.deviceId)}</div><div>Date: ${new Date().toLocaleString()}</div></div>`;
    }
    const docHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(n.title||'note')}</title><meta name="generator" content="Serene Notes"><style>body{font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; padding:20px; color:#111} .muted{color:#666}</style></head><body><h2>${escapeHtml(n.title||'Note')}</h2><div>${previewHtml}</div>${metaHtml}<hr><div style="font-size:12px;color:#666">${escapeHtml(brand)}</div></body></html>`;
    const blob = new Blob([docHtml], {type: 'application/msword'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = (n.title || 'note') + '.doc'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('Download started');
  }

  // Toast helper
  function showToast(msg, timeout=2500){
    const container = el('toast-container');
    if(!container) return; // nothing to show
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.background = 'rgba(0,0,0,0.85)';
    t.style.color = '#fff';
    t.style.padding = '8px 12px';
    t.style.borderRadius = '8px';
    t.style.marginTop = '8px';
    t.style.boxShadow = '0 6px 18px rgba(0,0,0,0.25)';
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(()=>{ t.style.transition = 'opacity 300ms'; t.style.opacity = '0'; setTimeout(()=> t.remove(), 350); }, timeout);
  }

  // DOCX handling: attempt to use `docx` library if available
  function generateDocxFromPreview(note){
    // If docx (https://docx.js.org/) is available as global `docx`, use it
    if(typeof window.docx !== 'undefined' && window.docx.Packer){
      const { Document, Packer, Paragraph, TextRun } = window.docx;
      const doc = new Document();
      const titlePara = new Paragraph({ children: [ new TextRun({ text: note.title || 'Note', bold: true, size: 32 }) ] });
      doc.addSection({ children: [ titlePara ] });
      // convert preview content by walking DOM nodes inside preview
      const container = document.createElement('div'); container.innerHTML = preview.innerHTML || escapeHtml(note.content).replace(/\n/g,'<br>');
      function walk(node){
        const paras = [];
        node.childNodes.forEach(n=>{
          if(n.nodeType === Node.TEXT_NODE){ paras.push(new Paragraph({ children:[ new TextRun(String(n.nodeValue)) ] })); }
          else if(n.nodeType === Node.ELEMENT_NODE){
            if(n.tagName === 'BR') { paras.push(new Paragraph('')); }
            else if(n.tagName === 'SPAN'){
              const styleColor = n.style.color || '';
              paras.push(new Paragraph({ children: [ new TextRun({ text: n.textContent, color: styleColor ? styleColor.replace('#','') : undefined }) ] }));
            } else if(n.tagName === 'DIV' || n.tagName === 'P'){
              paras.push(...walk(n));
            } else {
              paras.push(new Paragraph(n.textContent || ''));
            }
          }
        });
        return paras;
      }
      const contentParas = walk(container);
      doc.addSection({ children: contentParas });
      if(includeMetadataCb && includeMetadataCb.checked){
        const metaPara = new Paragraph({ children: [ new TextRun({ text: `Device: ${state.deviceId}    Date: ${new Date().toLocaleString()}`, italics: true, size: 18 }) ] });
        doc.addSection({ children: [metaPara] });
      }
      return Packer.toBlob(doc).then(blob => ({blob, filename: (note.title||'note') + '.docx'}));
    }
    return Promise.reject(new Error('docx library not present'));
  }

  // Update performDownload to attempt docx when requested
  const originalPerform = performDownload;
  function performDownloadWrapper(format){
    if(format !== 'docx') return originalPerform(format);
    const id = state.currentNoteId; if(!id) return alert('No note selected');
    const note = state.notes[id];
    showToast('Preparing .docx...');
    generateDocxFromPreview(note).then(({blob, filename})=>{
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); showToast('.docx download started');
    }).catch(err=>{
      showToast('Could not generate .docx — falling back to .doc');
      // fallback: create .doc with preview HTML (including metadata if requested)
      originalPerform('doc');
    });
  }
  // replace performDownload binding
  window.performDownload = performDownloadWrapper;

  // Search
  el('search').addEventListener('input', (e)=> renderNotesList(e.target.value));

  // Mappings (word -> color)
  el('add-mapping').addEventListener('click', ()=>{
    const w = el('map-word').value.trim();
    const c = el('map-color').value;
    if(!w) return alert('Enter a word');
    state.mappings[w] = c; persist(); renderMappings(); renderPreview();
  });

  // Folder UI & logic
  const foldersUl = el('folders-ul');
  const folderNameInput = el('folder-name-input');
  el('add-folder').addEventListener('click', ()=>{
    const name = folderNameInput.value.trim();
    if(!name) return alert('Enter a folder name');
    const id = uid();
    state.folders[id] = {id, name, created:Date.now()};
    folderNameInput.value = '';
    persist(); renderFolders();
  });

  el('delete-folder').addEventListener('click', ()=>{
    const selected = state.currentFolder ? state.folders[state.currentFolder] : null;
    if(!selected) return alert('Select a folder first');
    if(!confirm(`Delete folder "${selected.name}"? This will remove every note inside it.`)) return;
    Object.keys(state.notes).forEach(k=>{ if(state.notes[k].folder && state.notes[k].folder === selected.id) delete state.notes[k]; });
    delete state.folders[selected.id];
    state.currentFolder = null; persist(); renderFolders(); renderNotesList();
  });

  function renderFolders(){
    if(!foldersUl) return;
    foldersUl.innerHTML = '';
    const allLi = document.createElement('li');
    allLi.textContent = 'All Notes';
    allLi.style.fontWeight = state.currentFolder ? '400' : '700';
    allLi.addEventListener('click', ()=>{ state.currentFolder = null; renderFolders(); renderNotesList(); });
    foldersUl.appendChild(allLi);
    Object.values(state.folders).forEach(f=>{
      const li = document.createElement('li');
      li.textContent = f.name;
      li.title = new Date(f.created).toLocaleString();
      if(state.currentFolder === f.id){ li.classList.add('selected'); } else { li.classList.remove('selected'); }
      li.addEventListener('click', ()=>{ state.currentFolder = f.id; renderFolders(); renderNotesList(); });
      foldersUl.appendChild(li);
    });
  }

  function renderMappings(){
    const ul = el('mappings-ul'); ul.innerHTML = '';
    Object.keys(state.mappings).forEach(k=>{
      const li = document.createElement('li');
      const sw = document.createElement('span'); sw.textContent = k; sw.style.color = state.mappings[k];
      const del = document.createElement('button'); del.textContent = 'Remove'; del.className='btn ghost';
      del.addEventListener('click', ()=>{ delete state.mappings[k]; persist(); renderMappings(); renderPreview(); });
      li.appendChild(sw); li.appendChild(del); ul.appendChild(li);
    });
  }

  // Preview rendering with simple tokenization
  function escapeHtml(s){ return s.replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])) }
  function renderPreview(){
    const text = editor.value || '';
    if(!text){ preview.innerHTML = '<em class="muted">Nothing to preview</em>'; return }
    // break into words and wrap mapped words
    const parts = text.split(/(\s+)/);
    const html = parts.map(tok => {
      const key = tok.replace(/[^\w'-]/g,'');
      if(state.mappings[key]){
        return `<span style="color:${state.mappings[key]};font-weight:700">${escapeHtml(tok)}</span>`;
      }
      return escapeHtml(tok);
    }).join('');
    preview.innerHTML = html.replace(/\n/g,'<br>');
  }

  editor.addEventListener('input', renderPreview);

  // Export / Import
  el('export-json').addEventListener('click', ()=>{
    const payload = {notes: state.notes, mappings: state.mappings, folders: state.folders, drafts: state.drafts, deviceId: state.deviceId, brand: getBrand()};
    const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='serene-notes-export.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  el('import-json').addEventListener('click', ()=> el('import-file').click());
  el('import-file').addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = ()=>{
      try{
        const payload = JSON.parse(String(r.result));
      if(payload.notes) state.notes = payload.notes;
      if(payload.mappings) state.mappings = payload.mappings;
      if(payload.folders) state.folders = payload.folders;
      if(payload.drafts) state.drafts = payload.drafts;
      if(payload.brand) { localStorage.setItem(BRAND_KEY, payload.brand); applyBrand(); }
      persist(); renderNotesList(); renderMappings(); renderFolders(); renderDrafts(); alert('Imported');
        }catch(err){ alert('Invalid file'); }
    };
    r.readAsText(f); el('import-file').value='';
  });

  // Quick init: if empty add sample note
  if(Object.keys(state.notes).length===0){ createNoteFromText('Welcome','Welcome to  Note taken website!\n\nUpload a .txt, create notes, map words to colors and save locally.') }
  // open last
  const last = Object.keys(state.notes)[0]; if(last) { state.currentNoteId = last; openNote(last); }
  renderFolders();
})();