# GCS OBRAS - AI Coding Assistant Instructions

## Project Overview
This is a single-page web application for construction company management (Grupo Costa Silva Obras). It manages occurrences, budgets, clients, vehicles, inventory, and more using vanilla JavaScript, HTML, and CSS with no build system.

## Architecture
- **Frontend**: Pure HTML/CSS/JS single-page application
- **Data Storage**: IndexedDB for local offline storage with WebSocket synchronization
- **Backend**: Remote API at `https://api.gcs.app.br` with WebSocket on port 8443
- **Deployment**: GitHub Pages (static hosting)

## Key Components
- **Main App**: `index.html` loads all modules dynamically
- **Modules**: Separate JS files per feature (ocorrencias.js, orcamentos.js, clientes.js, etc.)
- **Core Files**:
  - `js/central_gcs.js`: Main app utilities and HTML templates
  - `js/inicial.js`: App initialization and screen management
  - `js/gdb.js`: IndexedDB database management
  - `js/websocket.js`: Real-time sync and authentication
  - `js/ferramentas.js`: Global constants, utilities, and event handlers

## Data Flow
1. User logs in via `js/login.js` with REST API call
2. WebSocket connection established for real-time sync
3. Data stored locally in IndexedDB object stores (dados_clientes, dados_ocorrencias, etc.)
4. UI updates dynamically by manipulating `.tela` div content

## Development Patterns
- **HTML Generation**: Use template literals for dynamic content (see `botaoRodape()`, `modelo()` in central_gcs.js)
- **Styling**: CSS classes with inline styles for dynamic properties
- **State Management**: Global variables and localStorage for app state
- **Permissions**: Role-based access using arrays like `autE = ['adm', 'gerente', 'diretoria']`
- **File Uploads**: Images stored at `${api}/uploads/` with camera integration
- **Versioning**: Cache-busting with `?v=2.94` parameters on CSS/JS includes

## External Dependencies
- Chart.js for data visualization
- ExcelJS/FileSaver for spreadsheet export
- JSZip/Pako for file compression
- Standard browser APIs (WebSocket, IndexedDB, Camera)

## Common Patterns
- **Screen Functions**: `telaInicialGCS()`, `telaLogin()` clear and populate `.tela` div
- **Data Sync**: `sincronizarDados()` pulls from server to IndexedDB
- **Popup System**: `popup()` function for modal dialogs
- **Menu System**: `mostrarMenus()` toggles sidebar navigation
- **Authentication**: Check `acesso` object for user permissions

## Development Workflow
- **Debug**: Use VS Code with Chrome debugger on `http://localhost:5500`
- **Testing**: Manual testing - no automated test suite
- **Deployment**: Push to GitHub main branch (auto-deploys to Pages)
- **Version Updates**: Increment `?v=X.XX` parameters when updating static files

## Key Directories
- `js/`: All JavaScript modules (one per feature)
- `css/`: Stylesheets (one per module + shared styles)
- `imagens/`: Static images and icons
- `gifs/`: Animated indicators

## Gotchas
- No build process - edit files directly
- WebSocket handles both data sync and user authentication
- Camera access requires HTTPS in production
- IndexedDB schema defined in `basesAuxiliares` object
- Portuguese language throughout codebase</content>
<parameter name="filePath">c:\Users\Grupo Costa Silva\Desktop\GCS OBRAS\.github\copilot-instructions.md