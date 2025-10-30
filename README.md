# Serene Notes — Local Note-taking App

This project is a simple, client-side note-taking app that stores notes in your browser's localStorage and keys them to a device ID (or a manual serial you enter).

Features
- Upload any .txt file to create a new note from its content
- Create, save, delete notes stored locally per device
- Device ID displayed (copyable) — optionally enter a serial to bind notes to a custom ID
- Map specific words to colors (e.g., make "urgent" orange, "todo" blue) and see a live preview
- Export/import all notes and mappings as JSON
- Download individual notes as .txt

Files
- `index.html` — main single-page app
- `style.css` — app styles
- `script.js` — app logic (storage, file handling, preview)

How to run
1. Open `index.html` in a browser (double-click it) or serve the folder with a static server.

Serving via Python (example):
```powershell
cd 'C:\Website Projects\note-taking-app'
python -m http.server 8000
# Then open http://localhost:8000 in your browser
```

Notes on storage and privacy
- Notes are stored locally in localStorage on your device. They are not sent anywhere.
- Device ID is generated and saved in localStorage; enter a custom serial if you want notes to be shared between devices that use the same serial.

Next steps (optional)
- Add persistent server-side sync
- Improve rich-text editing, tagging, and search
- Add image attachments and markdown support

Auto-detect and open by device serial
------------------------------------
There's a helper batch `detect-and-open.bat` that tries to detect your machine's BIOS serial number and opens the app with that serial as the device identifier. It will start a local server (python/py/npx) if available and open the app at `http://localhost:8000/?device=SERIAL`, otherwise it will open `index.html#device=SERIAL`.

Usage:
```powershell
cd 'C:\Website Projects\note-taking-app'
.\detect-and-open.bat

```


