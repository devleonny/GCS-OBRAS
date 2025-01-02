const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { google } = require('googleapis');
const puppeteer = require('puppeteer');
const fs = require('fs');
const { Readable } = require('stream');
const fetch = require('node-fetch');
const { exec } = require('child_process');
const https = require('https');
const sudo = require('sudo-prompt');
const os = require('os');
const { format } = require('date-fns');
const { autoUpdater } = require('electron-updater');

const PORT = process.env.PORT || 3000;
let mainWindow;
let otherWindows = [];

function createWindow() {

    mainWindow = new BrowserWindow({

        width: 1300,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        }

    });

    mainWindow.loadFile(path.join(__dirname, '/htmls/login.html'));

    mainWindow.on('closed', () => {

        mainWindow = null;

    });


    (async () => {
        const { default: isDevModule } = await import('electron-is-dev');
        const isDev = isDevModule;

        if (!isDev) {

            autoUpdater.checkForUpdatesAndNotify();

        }

    })();

}

function closeAllWindows() {

    if (mainWindow) {

        mainWindow.close();

    }

    otherWindows.forEach(window => window.close());
    otherWindows = [];

}

const appExpress = express();

appExpress.use(bodyParser.json({ limit: '50mb' }));
appExpress.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
appExpress.use(express.static(__dirname));

appExpress.get('/', (req, res) => {

    res.sendFile(path.join(__dirname, '/htmls/inicial.html'));

});

const credentials = {"type": "service_account",
    "project_id": "gcs-obras",
    "private_key_id": "4d98f44dcfcc18d50380bca3af5e3bd6f4566743",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCpTWzJx50stWB7\nezOiGU6RZ0ZKN37lUFQghKnpi03mO6OJ9wRCObsKyRZvcSDiIkDRM0aDRFuaj/9S\nGONgnUH69meVeTTOKHxmfhvfmRggjUVpiQWTAA20SEOEIPBeuzAmjRHV5qzq3OCy\nc9YvOHLb2xn4nqceXr5P8liBySwc1TmwTm9nq/2oMjK/3rzl6idJ5uHQqNV69OdG\njRxGbiHmGBV/kV6Biio9TknE6OJmFffrSfxMvrE6PtRgJ2HcfDw8QLX/j3T73yRb\nQi4oIiLbRNljl4P5Edox9WfWPna/VVpEL9PhScvdCK9q+0KpU97eCik7iuEB6qWp\nupV9ffJhAgMBAAECggEAHk6x7t1BEcPWZcSEVbxaCEWIm7ibisl6hee50wkRBOog\nOI5zwLc8+I1O6txBmrmvCMQ5Fz6hd2XXuwahjaYZLaf2mxd7kHxG6MIik0CAxTME\n/gN9b/dOfLuC+qA653pzADO4waXtxo2L2+ZIrWNZjGoImC0ulY04XG9x0KoGr5Jh\ng4GDK9LeYYDnUk4udDnv56juEEiE6NWuj7O3adHWFMzBZbz2Dek6/7FILqCIFizv\nuLtFDPVfGsiCl7x19t5hxFnzYHSVWq1/v9C2+9zzNyViPGfsFVu6yqFx1r9yPuXd\nO3HYZRURijtHtTp0A7yCkW78lJUkNE3GUP1wF5zyUQKBgQDa95pZmfN/wjGKE/Gs\ngsPpZiij8/1/FLdY3L1nAW6tf+LM58PvumzfYanoWsNaVwOdffYyGI8JPdAUhxqV\n1Ef9/MDpGRVonM92Ng2M3sXT7vlSRm72HiNpbG0y+Nybp+UcRDV6vaFY9be8XzyM\n/Rdfrc1COnaDYUxLpozTP2mvDwKBgQDF74nILh+cnSMeFYFXNVFE7LcL/0Oeo84y\nYyDQHnqc10O5e3ivkO1xEVCXiCgA4uJkxv0UTUVNCL90sS62fOS2/NJJ1ifgOPGa\nIQGCM4qWlHnB50IHrIBJWwrFZpABtOTZVZ9Q3u9D354Qn6RSu9k0x/0OB2nis7C2\nCQg0H5hHjwKBgGGAK0yGjrRuxhxTsSM9vvqosKQAuvnhQZrh/7xkGOJMtbLD6K1Q\nd7YoCL4b3CzX3hY8xmmcIeTdj0/0sNPSiJQB/exNbQj9+isK+pGliLVMDdyi3Dnf\nRallzGIMCj+NTSl+/ck/sx6nmz7XsWCeOdAy1dkNq0PpCU4ORVqzO93lAoGABQEm\ncapA4FvUvHj8uTC+6kg15JbCpessVnfNJ5XtsbN7od/uUDoQ1tACQqKNqGAUK0og\nsfe2LdlvxcqJDNIhkkLYKkfA4FlwOl5lRF57PY1peq6XK8x/vdsQbadHMtPZCWmx\nyoCoegXYYEE5DWJ0fnIkAsvLMJEsgZ2+2FqIJh8CgYAWS9+7Nr5iYSLW9/t8MFzH\n/6oozi1n3BOVS3kM7Iwgfq/1bcPXpWAiwHz0gZM6/PhflXsuP1dhLDiilbMSPDLw\ntT90hRnLwM4hskD2Aa7GFvnLPZLFG7Cx22tZKVHzFmHYIYGlrNkZ/uV6ujsa20ry\nXyqRgH6MUroO9PzOYtqCDQ==\n-----END PRIVATE KEY-----\n",
    "client_email": "upload-arquivos@gcs-obras.iam.gserviceaccount.com",
    "client_id": "105239666829813301347",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/upload-arquivos%40gcs-obras.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"};

const auth = new google.auth.GoogleAuth({

    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file']

});

async function authenticate() {

    const auth = new google.auth.GoogleAuth({

        keyFile: credentials, 
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],

    });

    return auth;

}

const drive = google.drive({ version: 'v3', auth });

appExpress.post('/upload', async (req, res) => {

    try {

        const { name, mimeType, base64 } = req.body;
        const buffer = Buffer.from(base64, 'base64');
        const fileStream = new Readable();
        fileStream.push(buffer);
        fileStream.push(null);

        const fileMetadata = {

            name: name,
            parents: ['1fBNan_Gu5eM6pE2ddZU5llEk7bdqUxzi']

        };

        const media = {

            mimeType: mimeType,
            body: fileStream

        };

        const response = await drive.files.create({

            resource: fileMetadata,
            media: media,
            fields: 'id, webViewLink'

        });

        res.status(200).send({

            fileId: response.data.id,
            webViewLink: response.data.webViewLink

        });

    } catch (error) {

        res.status(500).send('Erro ao fazer upload: ' + error.message);

    }

});

app.whenReady().then(() => {

    appExpress.listen(PORT, () => {

        createWindow();

    });

});

app.on('window-all-closed', () => {

    if (process.platform !== 'darwin') {

        app.quit();

    }

});

app.on('activate', () => {

    if (mainWindow === null) {

        createWindow();

    }

});

ipcMain.on('save-dialog', async (event, { htmlContent, nomeArquivo }) => {

    const { filePath } = await dialog.showSaveDialog(mainWindow, {

        title: 'Salvar PDF',
        defaultPath: path.join(app.getPath('desktop'), `${nomeArquivo}_${Date.now()}.pdf`),
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]

    });

    if (filePath) {

        await generatePDF(htmlContent, filePath);
        event.reply('save-dialog-reply', 'PDF salvo com sucesso.');
        shell.showItemInFolder(filePath);

    } else {

        event.reply('save-dialog-reply', 'Salvamento cancelado.');

    }

});

ipcMain.handle('open-new-window', (event, url) => {

    createNewWindow(url);

});

function createNewWindow(url) {

    const newWindow = new BrowserWindow({

        width: 1200,
        height: 600,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,

        }

    });

    if (url) {

        const fullUrl = path.join('file://', __dirname, url);
        newWindow.loadURL(fullUrl).catch(err => console.error('Erro ao carregar a URL:', err));

    } else {

        console.error('URL inválido para carregar');

    }

}

appExpress.post('/generate-pdf', async (req, res) => {

    const { htmlContent, nomeArquivo } = req.body;

    if (mainWindow && !mainWindow.isDestroyed()) {

        mainWindow.webContents.send('open-save-dialog', { htmlContent, nomeArquivo });
        res.status(200).send('A janela de diálogo de salvamento foi aberta.');

    } else {

        res.status(500).send('Erro: Janela principal não está disponível.');
        
    }
});

async function generatePDF(htmlContent, outputFile) {

    //const chromePath = path.join(__dirname, 'chrome-win64', 'chrome.exe');
    const chromePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'chrome-win64', 'chrome.exe');

    const browser = await puppeteer.launch({

        headless: true,
        executablePath: chromePath,
        args: ['--no-sandbox']

    });

    const page = await browser.newPage();

    try {

        await page.setContent(htmlContent);
        await page.pdf({

            path: outputFile,
            printBackground: true,
            width: '300mm',
            height: '400mm'

        });

    } catch (error) {

        console.error('Erro ao gerar PDF:', error);

    } finally {

        await browser.close();

    }

}

autoUpdater.on('update-downloaded', () => {

    console.log('Atualização baixada. Pronto para instalar.');
    closeAllWindows();
    autoUpdater.quitAndInstall();

});

autoUpdater.on('download-progress', (progressInfo) => {

    const percent = Math.round(progressInfo.percent);
    mainWindow.webContents.send('download-progress', percent);

});

autoUpdater.on('update-available', () => {

    mainWindow.webContents.send('update-available');

});
