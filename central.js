let acesso = JSON.parse(localStorage.getItem('acesso'))
let dados_setores = {}
let filtrosUsuarios = {}
let filtrosPendencias = {}
const metaforas = [
    "Um monitor sem imagens para exibir",
    "Um sistema de vigilância sem olhos",
    "Uma rede sem nós conectados",
    "Uma central de segurança em silêncio",
    "Uma câmera sem ângulos para vigiar",
    "Um gravador sem arquivos para armazenar",
    "Um mapa sem áreas para monitorar",
    "Uma sala de controle sem alertas",
    "Um software sem dados para processar",
    "Uma instalação sem cabos para ligar",
    "Um alarme sem disparo",
    "Um servidor sem logs de acesso",
    "Um banco de dados sem registros",
    "Uma cerca virtual sem perímetro",
    "Um sensor sem movimento detectado",
    "Um sistema de monitoramento sem eventos",
    "Uma interface sem transmissões ao vivo",
    "Uma tela de múltiplas câmeras em branco",
    "Um painel de controle sem notificações",
    "Uma infraestrutura sem dispositivos ativos"
]

const modelo = (valor1, valor2) => `
        <div style="display: flex; flex-direction: column; align-items: start; margin-bottom: 5px; width: 100%;">
            <label><strong>${valor1}</strong></label>
            <div style="width: 100%; text-align: left;">${valor2}</div>
        </div>
        `

const labelDestaque = (valor1, valor2) => `<label style="text-align: left;"><strong>${valor1}: </strong>${valor2}</label>`

const botao = (valor1, funcao, cor) => `
        <div class="contorno_botoes" style="background-color: ${cor};" onclick="${funcao}">
            <label>${valor1}</label>
        </div>
        `
const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `
const mensagem = (mensagem) => `
    <div style="display: flex; gap: 10px; padding: 2vw; align-items: center; justify-content: center;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${mensagem}</label>
    </div>
    `
const balaoPDF = (nf, info, codOmie, tipo, app) => {

    const bg = document.title == 'ORÇAMENTOS' ? 'white' : '#e8e8e8'

    return `
    <div class="balaoNF" onclick="abrirDANFE('${codOmie}', '${tipo}', '${app}')">
        <div class="balao1" style="background-color: ${bg};">
            <label style="font-size: auto;">${nf}</label>
            <label style="font-size: auto;"><strong>${info}</strong></label>
        </div>
        <div class="balao2">
            PDF
        </div>
    </div>
`}

const logo = 'https://i.imgur.com/Nb8sPs0.png'
const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}
const itensImportados = [
    'gcs-725', 'gcs-726', 'gcs-738', 'gcs-739', 'gcs-734', 'gcs-740', 'gcs-741', 'gcs-730', 'gcs-742', 'gcs-743', 'gcs-744', 'gcs-747', 'gcs-729', 'gcs-728', 'gcs-727', 'gcs-1135', 'gcs-1136', 'gcs-1137'
]

document.addEventListener('keydown', function (event) {
    if (event.key === 'F5') f5()
    if (event.key === 'F2') popup(new Date().getTime(), 'TIMESTAMP', true)
})

function f5() {
    location.reload();
}

identificacaoUser()

function ativarCloneGCS(ativar) {

    localStorage.setItem('modoClone', ativar)
    carregarIcones()
    corFundo()

}

function carregarIcones() {

    if (document.title != 'Página Inicial') return

    let autorizadosPainelNotas = ['adm', 'diretoria', 'gerente', 'fin']
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let painel_geral = document.getElementById('painel_geral')
    let atalho = (termo, img, funcao) => {
        return `
            <div class="block" style="flex-direction: column; justify-content: space-evenly;" onclick="${funcao}">
                <img src="imagens/${img}.png">
                <label>${termo}</label>
            </div>        
        `
    }

    let icones = `
        ${atalho('Orçamentos', 'projeto', `window.location.href='orcamentos.html'`)}
        ${atalho('Composições', 'composicoes', `window.location.href='composicoes.html'`)}
        ${atalho('Chamados', 'chamados', `window.location.href='chamados.html'`)}
        ${atalho('Estoque', 'estoque', `window.location.href='estoque.html'`)}
        ${atalho('Reembolsos', 'reembolso', `window.location.href='pagamentos.html'`)}
        ${atalho('Agenda', 'agenda', `window.location.href='agenda.html'`)}
        ${atalho('Veículos', 'veiculo', `window.location.href='controle_veiculos.html'`)}
        ${autorizadosPainelNotas.includes(acesso.permissao) ? atalho('Faturamento NFs', 'relatorio', `window.location.href='relatorio_omie.html'`) : ''}
    `

    if (modoClone) {
        icones = `
        ${atalho('Orçamentos', 'projeto', `window.location.href='orcamentos.html'`)}
        ${atalho('Composições', 'composicoes', `window.location.href='composicoes.html'`)}
        `
    }

    painel_geral.innerHTML = icones
}

function corFundo() {
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false

    if (document.title !== 'PDF') {
        document.body.style.background = modoClone ? 'linear-gradient(45deg, #249f41, #151749)' : 'linear-gradient(45deg, #B12425, #151749)'
    }
}

function offline(motivo) {

    const motivos = {
        1: 'Você está offline...',
        2: 'O servidor GCS caiu...'
    }

    let acumulado = `
    <div class="telaOffline">

        <div class="mensagemTela">
            <img src="gifs/offline.gif">
            <label>${motivos[motivo]}</label>
            ${botao('Reconectar', `window.location.href = 'inicial.html'`)}
        </div>
    </div>
    `

    document.body.innerHTML = acumulado
}

async function identificacaoUser() {
    corFundo()

    if (!navigator.onLine) return offline(1)

    if (document.title == 'Login') return
    if (!acesso) return window.location.href = 'login.html'

    await sincronizarSetores()
    acesso = dados_setores[acesso.usuario]

    if (acesso.permissao == 'novo') {
        localStorage.removeItem('acesso')
        return window.location.href = 'login.html'
    }

    localStorage.setItem('acesso', JSON.stringify(acesso))

    carregarIcones() // ícones da tela inicial;
    verificarPendencias() // Pendencias de aprovação;

    let modelo = (imagem, funcao, idElemento) => {
        return `
        <div style="position: relative; display: flex; align-items: center; justify-content: center;">
            <img src="imagens/${imagem}.png" style="width: 2vw; cursor: pointer;" onclick="${funcao}">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    let permitidosAprovacoes = ['adm', 'diretoria']

    if (document.title !== 'PDF' && acesso.usuario) {

        let texto = `
            <div class="cabecalhoUsuario">
                <div class="botaoUsuarios" onclick="painelUsuarios(this)">
                    <img src="imagens/online.png">
                    <label>Online</label>
                </div>

                ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
                ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}

                <label onclick="deseja_sair()"
                style="cursor: pointer; color: white;">${acesso.usuario} • ${acesso.permissao} • ${acesso.setor} • Sair</label>
            </div>

        `
        document.body.insertAdjacentHTML('beforebegin', texto)
    }

}

async function sincronizarSetores() {

    dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}
    let timestamps = []
    for ([usuario, objeto] of Object.entries(dados_setores)) {
        if (objeto.timestamp) {
            timestamps.push(objeto.timestamp)
        }
    }

    const maiorTimestamp = timestamps.length ? Math.max(...timestamps) : 0
    let nuvem = await lista_setores(maiorTimestamp)

    let dadosMesclados = {
        ...dados_setores,
        ...nuvem
    }

    dados_setores = dadosMesclados
    localStorage.setItem('dados_setores', JSON.stringify(dadosMesclados))

}

async function configs() {

    overlayAguarde()

    let status = await servicos('livre')

    await sincronizarSetores()

    let linhas = ''
    let listas = {
        permissoes: ['', 'adm', 'user', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo'],
        setores: ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE']
    }

    dados_setores = Object.keys(dados_setores)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .reduce((obj, chave) => {
            obj[chave] = dados_setores[chave];
            return obj;
        }, {});

    for ([usuario, dados] of Object.entries(dados_setores)) {

        let opcoes_permissao = ''
        let opcoes_setores = ''

        listas.permissoes.forEach(permissao => {
            opcoes_permissao += `
            <option ${dados?.permissao == permissao ? 'selected' : ''}>${permissao}</option>
            `
        })

        listas.setores.forEach(setor => {
            opcoes_setores += `
            <option ${dados?.setor == setor ? 'selected' : ''}>${setor}</option>
            `
        })

        linhas += `
        <tr>
            <td style="text-align: left;">${usuario}</td>
            <td>
                <select class="opcoesSelect" onchange="alterar_usuario('permissao', '${usuario}', this)" style="cursor: pointer;">${opcoes_permissao}</select>
            </td>
            <td>
                <select class="opcoesSelect" onchange="alterar_usuario('setor', '${usuario}', this)" style="cursor: pointer;">${opcoes_setores}</select>
            </td>
        </tr>
        `
    }

    let ths = ''
    let tbusca = ''
    let cabecalhos = ['Usuário', 'Permissão', 'Setores']
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`
        tbusca += `
        <th style="background-color: white;">
            <div style="display: flex; align-items: center; justify-content: center;">
                <input oninput="pesquisar_generico(${i}, this.value, filtrosUsuarios, 'tbodyUsuarios')">
                <img src="imagens/pesquisar2.png" style="width: 1vw;">
            </div>
        </th>
        `
    })

    let tabela = `
    <table class="tabela" style="width: 30vw;">
        <thead>
            <tr>${ths}</tr>
            <tr>${tbusca}</tr>
        </thead>
        <tbody id="tbodyUsuarios">${linhas}</tbody>
    </table>
    `

    let acumulado = `
    <div style="display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 10px; padding: 2vw;">
        ${botao('Registro de Logs do Sistema', `window.location.href='historicoRegistros.html'`)}
        <label>Gestão de Usuários</label>
        ${tabela}
    </div>
    `
    removerPopup()
    popup(acumulado, 'Configurações')

}

async function alterar_usuario(campo, usuario, select) {

    if (dados_setores[usuario]) {

        let alteracao = await configuracoes(usuario, campo, select.value) // Se alterar no servidor, altera localmente;
        if (alteracao.status) {
            dados_setores[usuario][campo] = select.value
        } else {
            select.value = dados_setores[usuario][campo] // Devolve a informação anterior pro elemento;
        }
    }
}

function verifTimestampNome(nome) {
    let regex = /^(\d{13})\.\w+$/;
    let match = nome.match(regex);

    if (match) {
        let timestamp = parseInt(match[1]);
        let data = new Date(timestamp);
        return !isNaN(data.getTime()) && data.getFullYear() > 2000;
    }

    return false;
}

let shell = null;
if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { shell: electronShell } = require('electron');
    shell = electronShell;
}

function abrirArquivo(link) {

    if (verifTimestampNome(link)) { // Se for um link composto por timestamp, então vem do servidor;
        link = `https://leonny.dev.br/uploads/${link}`
    } else { // Antigo Google;
        link = `https://drive.google.com/file/d/${link}/view?usp=drivesdk`
    }

    try {
        shell.openExternal(link);
    } catch {
        window.open(link, '_blank');
    }
}

function deseja_sair() {
    popup(`
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; margin: 2vw;">
            <label>Deseja Sair?</label>
            <button onclick="sair()" style="background-color: green">Sim</button>
        </div>
        `, 'Aviso')
}

function inicial_maiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''

    if (string.includes('lpu')) return string.toUpperCase()
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function removerOverlay() {
    let aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()
}

function overlayAguarde() {

    let aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()

    let elemento = `
    <div id="aguarde" style="
                display: flex; 
                align-items: start; 
                justify-content: start;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                z-index: 10005;
                font-size: 1.5em;
                border-radius: 3px;">
        <div id="divMensagem" style="position: fixed; top: 1vw; left: 1vw; display: flex; align-items: center; justify-content: center; gap: 10px;">
            <img src="gifs/loading.gif" style="width: 5vw;">
            <label>Por favor, aguarde...</label>
        </div>
    </div>
    `
    document.body.insertAdjacentHTML('beforeend', elemento)

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    document.getElementById('aguarde').style.height = `${pageHeight}px`;

    setTimeout(() => {
        let mensagem = document.getElementById('divMensagem')

        if (mensagem) mensagem.innerHTML = `
            <img src="gifs/atencao.gif" style="width: 3vw;">
            <label onclick="this.parentElement.parentElement.remove()" style="cursor: pointer; cursor: pointer;">Cancelar?</label>
        `

    }, 60 * 1000);

}

setInterval(async function () {
    await reprocessar_offline()
}, 60000)

async function reprocessar_offline() {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};

    for (let operacao in dados_offline) {
        let operacoes = dados_offline[operacao];

        for (let id in operacoes) {
            let evento = operacoes[id];

            if (operacao === 'enviar') {
                await enviar(evento.caminho, evento.valor);
            } else {
                await deletar(evento.chave);
            }

            dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};
            delete dados_offline[operacao][id];
            localStorage.setItem('dados_offline', JSON.stringify(dados_offline));

        }
    }
}

async function inserirDados(dados, nome_da_base) {
    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false;
    if (modoClone) nome_da_base = `${nome_da_base}_clone`;

    const db = await abrirBanco('Bases');

    if (!db.objectStoreNames.contains(nome_da_base)) {
        const novaVersao = db.version + 1;
        db.close();
        const upgradedDB = await atualizarVersaoBanco('Bases', novaVersao, nome_da_base);
        await executarTransacao(upgradedDB, nome_da_base, dados);
    } else {
        await executarTransacao(db, nome_da_base, dados);
    }
}

// Função para abrir banco
function abrirBanco(nome) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(nome);
        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

// Função para atualizar versão e criar objectStore
function atualizarVersaoBanco(nome, versao, nome_da_base) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(nome, versao);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            db.createObjectStore(nome_da_base, { keyPath: 'id' });
            console.log(`Store "${nome_da_base}" criada com sucesso.`);
        };

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error);
    });
}

function executarTransacao(db, nome_da_base, dados) {
    return new Promise((resolve, reject) => {
        if (!dados) return resolve();

        const transaction = db.transaction([nome_da_base], 'readwrite');
        const store = transaction.objectStore(nome_da_base);

        const clearRequest = store.clear();

        clearRequest.onsuccess = () => {
            try {
                if (Array.isArray(dados)) {
                    dados.forEach(item => {
                        item.id = 1;
                        const addRequest = store.put(item);
                        addRequest.onerror = event => console.error('Erro ao adicionar item:', event.target.error);
                    });
                } else {
                    dados.id = 1;
                    const addRequest = store.put(dados);
                    addRequest.onerror = event => console.error('Erro ao adicionar item:', event.target.error);
                }
            } catch (err) {
                reject(err);
            }
        };

        clearRequest.onerror = event => reject(event.target.error);
        transaction.onerror = event => reject(event.target.error);

        transaction.oncomplete = () => resolve();
    });
}

async function recuperarDados(nome_da_base, ambos) {
    const getDados = (nomeBase) => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('Bases')

            request.onsuccess = function (event) {
                const db = event.target.result

                if (!db.objectStoreNames.contains(nomeBase)) {
                    resolve(null)
                    return
                }

                const transaction = db.transaction([nomeBase], 'readonly')
                const store = transaction.objectStore(nomeBase)

                const getRequest = store.get(1)

                getRequest.onsuccess = function (event) {
                    let dados = event.target.result
                    if (dados && dados.id) delete dados.id
                    resolve(dados || null)
                }

                getRequest.onerror = function (event) {
                    reject(event.target.error)
                }
            }

            request.onerror = function (event) {
                reject(event.target.error)
            }
        })
    }

    if (ambos) {
        const [original, clone] = await Promise.all([
            getDados(nome_da_base),
            getDados(`${nome_da_base}_clone`)
        ])

        return { ...original, ...clone }
    }

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let baseFinal = modoClone ? `${nome_da_base}_clone` : nome_da_base
    return await getDados(baseFinal)
}

function popup(elementoHTML, titulo, nao_remover_anteriores) {

    let popup_v2 = `
    <div id="temp_pop" 
    style="
    position: fixed;
    z-index: 10001;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.7);">

        <div class="janela_fora">
            
            <div class="topo_popup">

                <label style="background-color: transparent; color: white; margin-left: 1vw;">${titulo || 'GCS'}</label>

                <div style="display: flex; align-items: center; justify-content: center;">

                    <div class="botao_popup" style="border-top-right-radius: 5px; background-color: #b12425;" onclick="removerPopup()">
                        <label>×</label>
                    </div>

                </div>

            </div>
            
            <div class="janela">

                ${elementoHTML}

            </div>

        </div>

    </div>`;

    removerPopup(nao_remover_anteriores)
    removerOverlay()
    document.body.insertAdjacentHTML('beforeend', popup_v2);

}

function criarAnexoVisual(nome, link_anexo, funcao_excluir) {

    let displayExcluir = 'flex'

    if (!funcao_excluir) displayExcluir = 'none'

    // Formata o nome para exibição curta
    const nomeFormatado = nome.length > 15
        ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
        : nome;

    return `
        <div class="contorno" style="display: flex; align-items: center; justify-content: center; gap: 2px; background-color: #222; color: white;">
            <div onclick="abrirArquivo('${link_anexo}')" class="contorno_interno" style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 2px;">
                <img src="imagens/anexo2.png" style="width: 1.5vw;">
                <label style="font-size: 0.7vw; cursor: pointer;" title="${nome}">${nomeFormatado}</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir}; width: 1.5vw; cursor: pointer;" onclick="${funcao_excluir}">
        </div>`;
}

function dicionario(item) {
    return typeof item === "object" && item !== null && item.constructor === Object;
}

async function carregarXLSX() {
    return new Promise((resolve, reject) => {
        if (typeof XLSX !== 'undefined') {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.async = true;

        script.onload = () => {
            const checkInitialization = () => {
                if (typeof XLSX !== 'undefined' && typeof XLSX.utils !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        };

        script.onerror = () => {
            reject(new Error("Falha ao carregar a biblioteca XLSX"));
        }

        document.head.appendChild(script);
    });
}


async function para_excel(tabela_id, nome_personalizado) {
    try {
        if (typeof XLSX === 'undefined') {
            await carregarXLSX();
        }

        const tabela = document.getElementById(tabela_id);
        if (!tabela) {
            throw new Error(`Tabela com ID '${tabela_id}' não encontrada`);
        }

        const tabelaClone = tabela.cloneNode(true);

        tabelaClone.querySelectorAll('input, textarea, select').forEach(elemento => {
            const celula = elemento.closest('td, th');
            if (celula) {
                if (elemento.type === 'checkbox') {
                    celula.textContent = elemento.checked ? 'Sim' : 'Não';
                } else if (elemento.tagName === 'SELECT') {
                    celula.textContent = elemento.options[elemento.selectedIndex]?.text || '';
                } else {
                    celula.textContent = elemento.value;
                }
            }
        });

        tabelaClone.querySelectorAll('[data-no-export], .no-export').forEach(el => el.remove());

        const worksheet = XLSX.utils.table_to_sheet(tabelaClone);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

        const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const nomeArquivo = nome_personalizado
            ? `${nome_personalizado}_${data}.xlsx`
            : `exportacao_${data}.xlsx`;

        XLSX.writeFile(workbook, nomeArquivo, {
            compression: true
        });

    } catch (erro) {
        console.error("Erro detalhado:", erro);

        let mensagem = erro.message;
        if (erro.message.includes('XLSX is not defined')) {
            mensagem = "Biblioteca de exportação não carregada. Recarregue a página e tente novamente.";
        }

        popup(`
            <div style="color: #b71c1c; padding: 20px; text-align: center;">
                <h3>⚠️ Erro na Exportação</h3>
                <p>${mensagem}</p>
                <div style="margin-top: 20px;">
                    <button onclick="removerPopup()" style="padding: 8px 16px; background: #b71c1c; color: white; border: none; border-radius: 4px;">
                        Fechar
                    </button>
                </div>
            </div>
        `, 'Erro na Exportação');
    }
}

function verificarXLSX() {
    if (typeof XLSX === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.async = true;
        document.head.appendChild(script);

        return new Promise((resolve, reject) => {
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Falha ao carregar XLSX'));
        });
    }
    return Promise.resolve();
}

async function loadXLSX() {
    if (typeof XLSX !== 'undefined') return;

    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.sheetjs.com/xlsx-0.19.3/package/dist/xlsx.full.min.js';
        script.onload = () => {
            const checkXLSX = () => {
                if (typeof XLSX === 'undefined') {
                    return setTimeout(checkXLSX, 100);
                }

                resolve();
            }

            checkXLSX();
        }
        script.onerror = () => reject(new Error('Falha ao carregar biblioteca XLSX'));

        document.head.appendChild(script);
    })
}

async function exportarParaExcel() {
    try {
        overlayAguarde();

        if (typeof ExcelJS === 'undefined') {
            throw new Error('Biblioteca ExcelJS não está carregada');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Estoque');

        const tabela = document.getElementById('tabela_estoque');
        if (!tabela) throw new Error('Tabela de estoque não encontrada');

        const headers = [];
        tabela.querySelectorAll('th').forEach((th, index) => {
            if (index > 0) {
                headers.push(th.textContent.trim());
            }
        });

        worksheet.addRow(headers);

        tabela.querySelectorAll('tbody tr').forEach(tr => {
            const rowData = [];
            tr.querySelectorAll('td').forEach((td, index) => {
                if (index > 0) {
                    const input = td.querySelector('input');
                    rowData.push(input ? input.value : td.textContent.trim());
                }
            });
            if (rowData.length > 0) {
                worksheet.addRow(rowData);
            }
        });

        worksheet.columns.forEach(column => {
            column.width = 15;
        });

        const data = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const buffer = await workbook.xlsx.writeBuffer();

        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `estoque_${data}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        removerOverlay();
    } catch (erro) {
        console.error("Erro ao exportar:", erro);
        removerOverlay();
        popup(`
            <div style="display: flex; gap: 10px; padding: 2vw; align-items: center; justify-content: center; flex-direction: column;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Erro ao exportar para Excel:</label>
                <label style="font-size: 0.8em;">${erro.message}</label>
                <button onclick="removerPopup()" style="background-color: #B12425;">Fechar</button>
            </div>`, 'ERRO');
    }
}

async function removerPopup(nao_remover_anteriores) {

    let pop_ups = document.querySelectorAll('#temp_pop')

    if (nao_remover_anteriores) {
        return
    }

    if (pop_ups.length > 1) {
        pop_ups[pop_ups.length - 1].remove()

    } else {
        pop_ups.forEach(pop => {
            pop.remove()
        })
    }

    let aguarde = document.getElementById('aguarde')
    if (aguarde) {
        aguarde.remove()
    }

}

function sair() {
    localStorage.removeItem('acesso')
    window.location.href = 'login.html'
}

function unicoID() {
    var d = new Date().getTime();
    if (window.performance && typeof window.performance.now === "function") {
        d += performance.now();
    }
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

function conversor(stringMonetario) {
    if (typeof stringMonetario === 'number') {
        return stringMonetario;
    } else if (!stringMonetario || stringMonetario.trim() === "") {
        return 0;
    } else {
        stringMonetario = stringMonetario.trim();
        stringMonetario = stringMonetario.replace(/[^\d,]/g, '');
        stringMonetario = stringMonetario.replace(',', '.');
        var valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {
            return 0;
        }

        return valorNumerico;
    }
}

function dinheiro(valor) {
    if (valor === '') return 'R$ 0,00';

    valor = Number(valor);
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ir_para(modulo) {

    localStorage.setItem('modulo_ativo', modulo)

    window.location.href = 'orcamentos.html'

}

function fecharPopup() {
    var popup = document.getElementById('popup');
    popup.classList.remove('aberto');
}

async function ir_pdf(orcam_) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    localStorage.setItem('pdf', JSON.stringify(dados_orcamentos[orcam_]));

    try {
        const { ipcRenderer } = require('electron');
        const pdfUrl = `pdf.html`;
        ipcRenderer.invoke('open-new-window', pdfUrl);

    } catch {
        window.location.href = `pdf.html`;
    }
}

function removerLinha(select) {
    var linha = select.closest('tr');
    linha.parentNode.removeChild(linha);
}

async function apagar(codigo_orcamento) {
    overlayAguarde()

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    if (dados_orcamentos[codigo_orcamento]) {
        delete dados_orcamentos[codigo_orcamento]
        await inserirDados(dados_orcamentos, 'dados_orcamentos')
        deletar(`dados_orcamentos/${codigo_orcamento}`)
    }

    await preencherOrcamentos()
    removerPopup()
}

function formatodata(data) {

    var partes = data.split('/');
    var dia = partes[0];
    var mes = partes[1];
    var ano = partes[2];
    return `${ano}-${mes}-${dia}`;
}

async function recuperarClientes() {

    await sincronizarDados('dados_clientes')

}

function formatartextoHtml(texto) {
    return texto.replace(/\n/g, '<br>');
}

function baixar_em_excel(nome_tabela, filename) {

    var table = document.getElementById(nome_tabela)

    var wb = XLSX.utils.table_to_book(table, { sheet: "GCS" });

    filename = filename ? filename + '.xlsx' : 'excel_data.xlsx';

    XLSX.writeFile(wb, filename);
}

function fecharTabela(nome_tabela) {
    document.getElementById(nome_tabela).style.display = 'none'
    document.getElementById('overlay').style.display = 'none'
}

function calcular() {
    var valor = Number(valor_liquido.value)

    var porcentagem = 0
    icms_toggle.checked == true ? porcentagem = 0.12 : porcentagem = 0.205

    var resultado = valor * 1 / (1 - porcentagem)

    valor_com_imposto.textContent = dinheiro(resultado)
}

function ID5digitos() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        id += caracteres.charAt(indiceAleatorio);
    }
    return id;
}

function pesquisar_generico(coluna, texto, filtro, id) {

    filtro[coluna] = String(texto).toLowerCase().replace('.', '')

    let tbody = document.getElementById(id);
    let trs = tbody.querySelectorAll('tr');
    let contador = 0

    trs.forEach(function (tr) {
        let tds = tr.querySelectorAll('td');
        let mostrarLinha = true;

        for (var col in filtro) {
            let filtroTexto = filtro[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].querySelector('select') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase().replace('.', '')

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        mostrarLinha ? contador++ : ''

        tr.style.display = mostrarLinha ? '' : 'none';
    });

    let contagem = document.getElementById('contagem')
    if (contagem) {
        contagem.textContent = contador
    }

}

function carregamento(local) {
    var local_elemento = document.getElementById(local)

    local_elemento.innerHTML = '';

    var elemento = `
    <div id="carregamento" style="display: flex; width: 100%; align-items: center; justify-content: center; gap: 10px;">
        <img src="gifs/loading.gif" style="width: 5vw">
        <label style="color: white; font-size: 1.5em;">Aguarde...</label>
    </div>
    `
    local_elemento.insertAdjacentHTML('beforeend', elemento)
}

async function salvar_levantamento(id_orcamento) {
    let elemento = document.getElementById("adicionar_levantamento");

    if (!elemento || !elemento.files || elemento.files.length === 0) {
        return;
    }

    try {
        let anexos = await importarAnexos(elemento); // Nova função de upload

        let anexo_dados = {};
        anexos.forEach(anexo => {
            let id_anexo = ID5digitos();
            anexo_dados[id_anexo] = anexo;
        });

        if (id_orcamento) {
            let dados_orcamentos = await recuperarDados("dados_orcamentos") || {};
            let orcamento_v2 = dados_orcamentos[id_orcamento] || {};

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            await inserirDados(dados_orcamentos, "dados_orcamentos");

            for (let id_anexo in anexo_dados) {
                await enviar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`, anexo_dados[id_anexo]);
            }

            abrirEsquema(id_orcamento);
        } else {

            let orcamento_v2 = baseOrcamento()

            if (!orcamento_v2.levantamentos) {
                orcamento_v2.levantamentos = {};
            }

            Object.assign(orcamento_v2.levantamentos, anexo_dados);

            baseOrcamento(orcamento_v2)
            painelClientes()
        }
    } catch (error) {
        popup(mensagem(`Erro ao fazer upload: ${error.message}`), 'ALERTA', true);
        console.error(error);
    }
}

async function excluir_levantamento(id_orcamento, id_anexo) {

    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let orcamento = dados_orcamentos[id_orcamento]
    delete orcamento.levantamentos[id_anexo]

    await deletar(`dados_orcamentos/${id_orcamento}/levantamentos/${id_anexo}`)
    await inserirDados(dados_orcamentos, 'dados_orcamentos')

    abrirEsquema(id_orcamento)

}

async function recuperar_estoque() {

    await sincronizarDados('dados_estoque')

}

function filtrar_tabela(coluna, id) {

    let tabela = document.getElementById(id)
    let linhas = Array.from(tabela.tBodies[0].rows)
    let ascendente = tabela.getAttribute("data-order") !== "asc";

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna])
        let valorB = capturarValorCelula(b.cells[coluna])

        if (!isNaN(valorA) && !isNaN(valorB)) {
            return ascendente ? valorA - valorB : valorB - valorA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    });

    let tbody = tabela.tBodies[0];
    linhas.forEach((linha) => tbody.appendChild(linha))

    tabela.setAttribute("data-order", ascendente ? "asc" : "desc")

}

function capturarValorCelula(celula) {
    let entrada = celula.querySelector('input') || celula.querySelector('textarea');
    if (entrada) {
        return entrada.value.toLowerCase();
    }

    let valor = celula.innerText.toLowerCase();

    if (/^r\$\s[\d.,]+$/.test(valor)) {
        valor = valor.replace("r$", "").trim().replace(/\./g, "").replace(",", ".");
        return parseFloat(valor);
    }

    return valor;
}

//--- SERVIÇO DE ARMAZENAMENTO ---\\
async function receber(chave) {

    let chavePartes = chave.split('/')
    let timestamps = []
    let dados = await recuperarDados(chavePartes[0]) || {}

    for ([id, objeto] of Object.entries(dados)) {
        if (objeto.timestamp) timestamps.push(objeto.timestamp)
    }

    const maiorTimestamp = timestamps.length ? Math.max(...timestamps) : 0
    const modoClone = JSON.parse(localStorage.getItem('modoClone')) || false;
    const body = {
        chave: chave,
        app: modoClone ? 'clone' : undefined,
        timestamp: maiorTimestamp
    };

    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body)
    };

    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/dados", obs)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                offline(2)
                resolve({})
            });
    })
}

async function deletar(chave) {
    const url = `https://leonny.dev.br/deletar`;

    let objeto = { chave }

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    if (modoClone) {
        objeto.app = 'clone'
    }

    return new Promise((resolve) => {
        fetch(url, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(() => {
                salvar_offline(objeto, 'deletar')
                resolve();
            });
    });
}

function enviar(caminho, info) {
    return new Promise((resolve) => {
        let objeto = {
            caminho: caminho,
            valor: info
        };

        let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
        if (modoClone) {
            objeto.app = 'clone'
        }

        fetch("https://leonny.dev.br/salvar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(objeto)
        })
            .then(data => resolve(data))
            .catch((erro) => {
                console.error(erro);
                salvar_offline(objeto, 'enviar');
                resolve();
            });
    });
}

function salvar_offline(objeto, operacao) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    let id = ID5digitos()

    if (!dados_offline[operacao]) {
        dados_offline[operacao] = {}
    }

    dados_offline[operacao][id] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

const WS_URL = "wss://leonny.dev.br:8443";
let socket;
let reconnectInterval = 30000;
connectWebSocket();

function connectWebSocket() {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
        if (acesso) socket.send(JSON.stringify({ tipo: 'autenticar', usuario: acesso.usuario }));
        console.log(`🟢🟢🟢 WS ${data_atual('completa')} 🟢🟢🟢`);
    };

    socket.onmessage = (event) => {
        let data = JSON.parse(event.data);

        if (data.tipo == 'usuarios_online') localStorage.setItem('usuariosOnline', JSON.stringify(data.usuarios))

        if (data.tipo == 'livre' && document.title == 'Criar Orçamento') f5()

    };

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${data_atual('completa')} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`);
        setTimeout(connectWebSocket, reconnectInterval);
    };

}

function painelUsuarios(elementoOrigial) {

    let divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios) return divUsuarios.remove()

    let usuariosOnline = JSON.parse(localStorage.getItem('usuariosOnline')) || []
    let dados_setores = JSON.parse(localStorage.getItem('dados_setores')) || {}

    let stringUsuarios = {
        online: { linhas: '', quantidade: 0 },
        offline: { linhas: '', quantidade: 0 },
    }

    dados_setores = Object.entries(dados_setores).sort((a, b) => a[0].localeCompare(b[0]))

    for ([usuario, objeto] of dados_setores) {

        let status = usuariosOnline.includes(usuario) ? 'online' : 'offline'

        stringUsuarios[status].quantidade++
        stringUsuarios[status].linhas += `
        <div style="display: flex; align-items: center; justify-content: start; gap: 5px;">
            <img src="imagens/${status}.png" style="width: 2vw;">
            <label style="font-size: 0.8vw;">${usuario}</label>
            <label style="font-size: 0.6vw;">${objeto.setor}</label>
        </div>
        `
    }

    let pos = elementoOrigial.getBoundingClientRect();

    let acumulado = `
    <div id="divUsuarios" class="divOnline" style="left: ${pos.left + window.scrollX}px; top: ${pos.bottom + window.scrollY}px;">
        <label style="font-size: 0.8vw;"><strong>ONLINE ${stringUsuarios.online.quantidade}</strong></label>
        ${stringUsuarios.online.linhas}
        <label style="font-size: 0.8vw;"><strong>OFFLINE ${stringUsuarios.offline.quantidade}</strong></label>
        ${stringUsuarios.offline.linhas}
    </div>
    `

    document.body.insertAdjacentHTML('beforeend', acumulado)

}

async function gerar_pdf_online(htmlString, nome) {
    return new Promise((resolve, reject) => {
        let encoded = new TextEncoder().encode(htmlString);
        let compressed = pako.gzip(encoded);

        fetch("https://leonny.dev.br/pdf", {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: compressed
        })
            .then(response => response.blob())
            .then(blob => {
                const link = document.createElement("a");
                link.href = URL.createObjectURL(blob);
                link.download = `${nome}.pdf`;
                link.click();
                resolve()
            })
            .catch(err => {
                console.error("Erro ao gerar PDF:", err)
                reject()
            });
    })

}

async function refazer_pagamento(id_pagamento) {

    overlayAguarde()

    let lista_pagamentos = await recuperarDados('lista_pagamentos') || {}

    if (!lista_pagamentos[id_pagamento]) return popup(mensagem('Algo deu ruim...'), 'AVISO', true)

    let pagamento = lista_pagamentos[id_pagamento]
    console.log(await lancar_pagamento(pagamento))
    pagamento.status = 'Processando...'
    await inserirDados(lista_pagamentos, 'lista_pagamentos')
    await abrirDetalhesPagamentos(id_pagamento)

}

async function lancar_pagamento(pagamento, call) {
    return new Promise((resolve, reject) => {

        fetch("https://leonny.dev.br/lancar_pagamento", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagamento, call })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                data = JSON.parse(data)

                if (data.faultstring) {
                    let comentario = `Erro na API ao enviar o pagamento para o Omie! ${data.faultstring}`
                    registrarAlteracao('lista_pagamentos', pagamento.id_pagamento, comentario)
                }

                resolve(data);
            })
            .catch(err => reject(err))
    })
}

function formatarData(dataISO) {
    if (!dataISO) return "--"; // Retorna um placeholder caso a data seja inválida ou vazia

    let partes = dataISO.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // Converte "YYYY-MM-DD" para "DD/MM/YYYY"
    }
    return dataISO; // Retorna a data original caso não esteja no formato esperado
}

async function importarAnexos(arquivoInput) {
    return new Promise((resolve, reject) => {
        const formData = new FormData();

        for (let i = 0; i < arquivoInput.files.length; i++) {
            formData.append('arquivos', arquivoInput.files[i]);
        }

        fetch('https://leonny.dev.br/upload', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                popup(mensagem('O Servidor caiu... solicite que um ADM reinicie o serviço'))
                reject();
            });
    });
}

function sincronizar(script) {

    fetch('https://leonny.dev.br/sincronizar', {
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script })
    })
        .then(response => response.text())
        .then(data => {
            console.log(JSON.parse(data));
        })
        .catch(error => console.error('Erro na requisição:', error));

}

function data_atual(estilo, nivel) {
    var dataAtual = new Date();

    if (nivel) {
        // var dataAtual = new Date(2024, 10, 10, 10, 0, 0, 0);
        var diaDeHoje = dataAtual.getDate();
        var ano = dataAtual.getFullYear();
        var mes = dataAtual.getMonth();

        if (nivel == 2 && diaDeHoje > 5) { // Pagamento de Parceiro no dia 10 do mês seguinte;
            diaDeHoje = 10;
            mes += 1;
        } else if (nivel == 2) { // Pagamento de Parceiro no dia 10;
            diaDeHoje = 10;
        } else if (nivel == 1) { // Adiantamento de Parceiro (8 dias prévios);
            diaDeHoje += 8;

            var diasNoMes = new Date(ano, mes + 1, 0).getDate();
            if (diaDeHoje > diasNoMes) {
                diaDeHoje -= diasNoMes;
                mes += 1;
            }
        }

        if (mes > 11) {
            mes = 0;
            ano += 1;
        }

        dataAtual = new Date(ano, mes, diaDeHoje);

        if (dataAtual.getDay() === 6) {
            dataAtual.setDate(dataAtual.getDate() + 2);
        } else if (dataAtual.getDay() === 0) {
            dataAtual.setDate(dataAtual.getDate() + 1);
        }

    }

    if (dataAtual.getDay() === 5 && dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 3);
    } else if (dataAtual.getDay() === 6) {
        dataAtual.setDate(dataAtual.getDate() + 2);
    } else if (dataAtual.getDay() === 0) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    } else if (dataAtual.getHours() >= 11) {
        dataAtual.setDate(dataAtual.getDate() + 1);
    }

    if (estilo === 'completa') {
        var dataFormatada = new Date().toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        return dataFormatada;
    } else if (estilo === 'curta') {
        return dataAtual.toLocaleDateString('pt-BR');
    }
}

async function verAprovacoes() {
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}

    let guia = {
        pendente: '#ff8c1b',
        todos: '#a9a5a5'
    }

    let cabecalhos = ['Chamado', 'Cliente', 'Total Original <br>[s/desc ou acres]', 'Total Geral', '%', 'Localização', 'Usuário', 'Aprovação', 'Comentário', 'Detalhes']
    let tabelas = {
        pendente: { linhas: '' },
        todos: { linhas: '' }
    }

    let ths = ''
    let tsh = ''
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`

        cabecalho == 'Detalhes'
            ? tsh += '<th style="background-color: white;"></th>'
            : tsh += `
            <th style="background-color: white; border-radius: 0px;">
                <div style="display: flex; align-items: center; justify-content: center;">
                    <input oninput="pesquisar_generico(${i}, this.value, filtrosPendencias, 'tbodyPendencias')">
                    <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                </div>
            </th>
        `
    })

    let desordenado = Object.entries(dados_orcamentos)
    desordenado.sort((a, b) => new Date(b[1]?.dados_orcam?.data || '') - new Date(a[1]?.dados_orcam?.data || ''))

    for (let [idOrcamento, orcamento] of desordenado) {

        if (!orcamento.aprovacao) continue

        let dados_orcam = orcamento.dados_orcam || {}
        let aprovacao = orcamento.aprovacao
        let status = aprovacao?.status || 'desconhecido'
        let porcentagemDiferenca = (((orcamento.total_geral - orcamento.total_bruto) / orcamento.total_bruto) * 100).toFixed(2)

        tabelas[status == 'pendente' ? 'pendente' : 'todos'].linhas += `
        <tr>
            <td>${dados_orcam?.contrato || '--'}</td>
            <td>${dados_orcam?.cliente_selecionado || '--'}</td>
            <td>${dinheiro(orcamento.total_bruto)}</td>
            <td>${dinheiro(orcamento.total_geral)}</td>
            <td><label class="labelAprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label></td>
            <td>${dados_orcam?.cidade || ''}</td>
            <td>${aprovacao?.usuario || '--'}</td>
            <td>
                <div style="display: flex; align-items: center; justify-content: start; gap: 1vw;">
                    <img src="imagens/${status}.png" style="width: 2vw;">
                    <label>${status}</label>
                </div>
            </td>
            <td>${aprovacao?.justificativa || '--'}</td>
            <td><img src="imagens/pesquisar2.png" style="width: 2vw; cursor: pointer;" onclick="verPedidoAprovacao('${idOrcamento}')"></td>
        </tr>
        `
    }

    let tabelasString = ''
    for (let [tabela, objeto] of Object.entries(tabelas)) {
        if (objeto.linhas == '') continue
        tabelasString += `
        <br>
        <hr style="width: 100%;">
        <br>
        <table class="tabela" style="width: 100%;">
            <thead style="background-color: ${guia[tabela]};">
                <tr>${ths}</tr>
                ${tabela == 'todos' ? `<tr>${tsh}</tr>` : ''}
            </thead>
            <tbody ${tabela == 'todos' ? 'id="tbodyPendencias"' : ''}>${objeto.linhas}</tbody>
        </table>`
    }

    acumulado = `
    <div style="background-color: #d2d2d2; padding: 5px;">

        <label style="font-size: 1.5vw;">Fila de Aprovação</label>

        ${tabelasString}
    </div>
    `
    popup(acumulado, 'Aprovações de Orçamento', true)
}

async function verificarPendencias() {
    await sincronizarDados('dados_orcamentos', true)
    let dados_orcamentos = await recuperarDados('dados_orcamentos')
    let contador = 0

    for ([idOrcamento, orcamento] of Object.entries(dados_orcamentos)) {
        if (orcamento.aprovacao && orcamento.aprovacao.status == 'pendente') contador++
    }

    let contadorPendencias = document.getElementById('contadorPendencias')
    if (contadorPendencias) {
        contadorPendencias.style.display = contador == 0 ? 'none' : 'flex'
        contadorPendencias.textContent = contador
    }

}

async function verPedidoAprovacao(idOrcamento) { //29

    let permissao = acesso.permissao
    let pessoasPermitidas = ['adm', 'diretoria']
    if (!pessoasPermitidas.includes(permissao)) return popup(mensagem('Você não tem acesso'), 'AVISO', true)

    let acumulado = ''
    let tabelas = {}
    let divTabelas = ''
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let orcamento = dados_orcamentos[idOrcamento]
    let cliente = dados_clientes?.[orcamento.dados_orcam.omie_cliente] || {}

    for ([codigo, composicao] of Object.entries(orcamento.dados_composicoes)) {

        let quantidade = composicao.qtde
        let custo = composicao.custo
        let custoOriginal = composicao?.custo_original || false;
        let tipo = composicao.tipo

        if (!tabelas[tipo]) tabelas[tipo] = { linhas: '' }

        let total = quantidade * custo;
        let desconto = 0

        if (composicao.tipo_desconto) {
            desconto = composicao.tipo_desconto === 'Dinheiro'
                ? composicao.desconto
                : total * (composicao.desconto / 100);
        }
        let totalOriginal = custoOriginal * quantidade
        let labelCusto = dinheiro(custoOriginal ? custoOriginal : custo)
        let labelTotal = dinheiro(custoOriginal ? totalOriginal : total)
        let labelTotalDesconto = dinheiro(total - desconto)

        let diferenca = '--', cor = '';
        if (custoOriginal && custo !== custoOriginal) {
            diferenca = dinheiro((custo - custoOriginal) * quantidade)
            cor = 'green'

        } else if (desconto > 0) {
            diferenca = dinheiro(desconto)
            cor = '#B12425'
        }

        tabelas[tipo].linhas += `
        <tr>
            <td>${composicao.descricao}</td>
            <td>${quantidade}</td>
            <td>${labelCusto}</td>
            <td>${labelTotal}</td>
            <td><label class="labelAprovacao" style="background-color: ${cor}">${diferenca}</label></td>
            <td>${labelTotalDesconto}</td>
        </tr>
    `;
    }

    for (let [tabela, objeto] of Object.entries(tabelas)) {

        divTabelas += `
            <div style="display: flex; align-items: start; justify-content: center; flex-direction: column;">
                <label style="font-size: 1.2vw;"><strong>${tabela}</strong></label>
                <table class="tabela" style="width: 100%;">
                    <thead style="background-color: #a9a5a5;">
                        <tr>
                            <th>Descrição</th>
                            <th>Quantidade</th>
                            <th>Unitário</th>
                            <th>Total</th>
                            <th>Diferença</th>
                            <th>Total Geral</th>
                        </tr>
                    </thead>
                    <tbody>${objeto.linhas}</tbody>
                </table>
            </div>
            `
    }

    let divOrganizada = (valor, termo) => {
        return `
                <div style="display: flex; justify-content: center; flex-direction: column; align-items: start; width: 100%; margin-bottom: 5px;">
                    <label style="font-size: 0.9vw;">${termo}</label>
                    <label style="font-size: 1.2vw;"><strong>${valor}</strong></label>
                </div>
            `
    }

    let totalBruto = orcamento?.total_bruto
    let totalGeral = conversor(orcamento.total_geral)
    let diferencaDinheiro = totalGeral - totalBruto
    let diferencaPorcentagem = `${(diferencaDinheiro / totalBruto * 100).toFixed(2)}%`

    acumulado += `
            <div class="painelAprovacoes">
                
                <div style="display: flex; align-items: center; justify-content: start; gap: 2vw;">
                    <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                        ${divOrganizada(orcamento.dados_orcam.analista, 'Solicitante')}
                        ${divOrganizada(cliente?.nome || '?', 'Cliente')}
                        ${divOrganizada(cliente?.cidade || '?', 'Localidade')}
                    </div>
                    <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                        ${divOrganizada(dinheiro(totalGeral), 'Total Geral')}
                        ${divOrganizada(dinheiro(totalBruto), 'Total Original (sem Acréscimo e/ou Desconto)')}
                        ${divOrganizada(`<label class="labelAprovacao" style="background-color: ${diferencaDinheiro > 0 ? 'green' : '#B12425'}">${dinheiro(diferencaDinheiro)}</label>`, 'Diferença em Dinheiro')}
                        ${divOrganizada(diferencaPorcentagem, 'Percentual')}
                    </div>
                </div>

                <hr style="width: 100%;">

                <div style="display: flex; align-items: center; justify-content: center; gap: 5px;" onclick="visibilidadeOrcamento(this)">
                    <img src="imagens/olhoFechado.png" style="width: 2vw;">
                    <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                    
                </div>

                <div style="display: none; align-items: start; justify-content: center; flex-direction: column; gap: 5px;">
                    ${divTabelas}
                </div>

                <hr style="width: 100%;">
                <div style="width: 100%; position: relative; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">
                    <label>Comentar</label>
                    <textarea rows="5" style="background-color: white; border: none; width: 90%; color: #222;"></textarea>

                    <div style="display: flex; justify-content: left; gap: 5px;">
                        <button style="background-color: green;" onclick="respostaAprovacao(this, '${idOrcamento}', 'aprovado')">Autorizar</button>
                        <button style="background-color: #B12425;" onclick="respostaAprovacao(this, '${idOrcamento}', 'reprovado')">Reprovar</button>
                    </div>
                </div>
            </div>
        `

    popup(acumulado, 'Detalhes', true)

}

function visibilidadeOrcamento(div) {
    let img = div.querySelector('img')
    let label = div.querySelector('label')
    let divTabelas = div.nextElementSibling
    let display = divTabelas.style.display

    if (display == 'none') {
        divTabelas.style.display = 'flex'
        img.src = 'imagens/olhoAberto.png'
        label.textContent = 'Ocultar itens'
    } else {
        divTabelas.style.display = 'none'
        img.src = 'imagens/olhoFechado.png'
        label.textContent = 'Ver itens do Orçamento'
    }
}

async function respostaAprovacao(botao, idOrcamento, status) {

    // Dois popups pra fechar;
    removerPopup()
    removerPopup()

    let justificativa = botao.parentElement.parentElement.querySelector('textarea').value
    let dados = {
        usuario: acesso.usuario,
        data: data_atual('completa'),
        status,
        justificativa
    }

    await sincronizarDados('dados_orcamentos')
    let dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_orcamentos[idOrcamento].aprovacao = {
        ...dados_orcamentos[idOrcamento].aprovacao,
        ...dados
    }

    await inserirDados(dados_orcamentos, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/aprovacao`, dados_orcamentos[idOrcamento].aprovacao)

    await verAprovacoes()
    verificarPendencias()

}

async function verificar_chamado_existente(chamado, id_atual, sequencial) {
    return new Promise((resolve, reject) => {

        let clone = JSON.parse(localStorage.getItem('modoClone')) || false

        fetch("https://leonny.dev.br/chamado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chamado, id_atual, sequencial, clone })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function configuracoes(usuario, campo, valor) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/configuracoes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, campo, valor })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function servicos(servico, alteracao) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/servicos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ servico, alteracao })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function lista_setores(timestamp) {
    try {
        const response = await fetch("https://leonny.dev.br/setores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamp })
        });

        if (!response.ok) {
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data;

    } catch {
        return {}
    }
}

function registrarAlteracao(base, id, comentario) {
    let novoRegistro = {
        usuario: acesso.usuario,
        data: data_atual('completa'),
        comentario: comentario,
        base,
        id
    }

    let idRegistro = ID5digitos()

    enviar(`registrosAlteracoes/${idRegistro}`, novoRegistro)
}

function baseOrcamento(orcamento, remover) {

    let modoClone = JSON.parse(localStorage.getItem('modoClone')) || false
    let app = modoClone ? 'clone' : 'antigos'
    let orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || {}

    let modalidade = document.title == 'Orçamento de Aluguel' ? 'aluguel' : 'orcamento'
    if (orcamento) {
        modalidade = orcamento.lpu_ativa == 'ALUGUEL' ? 'aluguel' : 'orcamento'
    }

    if (!orcamentos[app]) {
        orcamentos[app] = {}
    }

    if (!orcamentos[app][modalidade]) {
        orcamentos[app][modalidade] = {}
    }

    if (orcamento) {
        orcamentos[app][modalidade] = orcamento
        localStorage.setItem('orcamentos', JSON.stringify(orcamentos))

    } else if (remover) {
        delete orcamentos[app][modalidade]
        localStorage.setItem('orcamentos', JSON.stringify(orcamentos))

    } else {
        return orcamentos[app][modalidade]
    }
}

function removerExcluidos(base) {

    if (dicionario(base)) {
        for ([id, objeto] of Object.entries(base)) {
            if (objeto.excluido || !objeto.timestamp) delete base[id]
        }
    }

    return base
}

async function sincronizarDados(base, overlayOff) {

    if (!overlayOff) overlayAguarde()

    let nuvem = await receber(base) || {}
    let dados_local = await recuperarDados(base) || {}

    let dadosMesclados = {
        ...dados_local,
        ...nuvem
    }

    dadosMesclados = removerExcluidos(dadosMesclados)

    await inserirDados(dadosMesclados, base)

    if (!overlayOff) removerOverlay()
}

async function verificarNF(numero, tipo, app) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/notas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ numero, tipo, app })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

async function atualizarBaseClientes() {
    await sincronizarDados('dados_clientes')
    await painelClientes()
}

async function painelClientes() {
    let orcamento_v2 = baseOrcamento()
    let dados_orcam = orcamento_v2?.dados_orcam || {}
    let dados_clientes = await recuperarDados('dados_clientes') || {}
    let cliente = dados_clientes?.[dados_orcam?.omie_cliente] || {}
    let levantamentos = ''

    // Caso a base de clientes esteja desatualizada;
    if (dados_orcam.omie_cliente && Object.keys(cliente).length == 0) {
        await atualizarBaseClientes()
        return await painelClientes()
    }

    let dados_pagamentos = ["--", "15 dias", "30 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]
    let condicoes = ''
    dados_pagamentos.forEach(pag => {
        condicoes += `
            <option ${dados_orcam?.condicoes == pag ? 'selected' : ''}>${pag}</option>
        `
    })

    for (chave in orcamento_v2?.levantamentos || {}) {
        let levantamento = orcamento_v2.levantamentos[chave]
        levantamentos += criarAnexoVisual(levantamento.nome, levantamento.link, `excluir_levantamento('${chave}')`)
    }

    let modelo = (valor1, valor2, idElemento) => {
        return `
            <div class="linha">
                <label>${valor1}</label>
                <div style="display: flex; 
                align-items: center; 
                justify-content: end; 
                gap: 5px; 
                width: 65%; 
                margin-right: 10px;" 
                ${idElemento ? `id="${idElemento}"` : ''}>${valor2 ? valor2 : ''}</div>
            </div>
        `
    }

    let acumulado = `

    <div style="background-color: #d2d2d2; padding: 10px;">

        <div style="display: flex; justify-content: start; align-items: center;">
            <div style="display: flex; flex-direction: column; gap: 10px; align-items: left; margin: 5px;">
                <div id="acompanhamento_dados_clientes" class="btn" onclick="atualizarBaseClientes()">
                    <img src="imagens/omie.png">
                    <label style="cursor: pointer;">Atualizar OMIE Clientes</label>
                </div>
            </div>

            <div onclick="executarLimparCampos()" class="btn">
                <img src="imagens/limpar.png" style="width: 2vw;">
                <label style="cursor: pointer;">Limpar Campos</label>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 5px; justify-content: center; align-items: start; border-radius: 3px; margin: 5px;">

            <label style="font-size: 1.5vw;">Dados do Cliente</label>

            ${modelo('Chamado', `<input id="contrato" style="font-size: 1.0vw; display: ${dados_orcam?.contrato == 'sequencial' ? 'none' : ''};" placeholder="nº do Chamado" onchange="salvarDadosCliente()" value="${dados_orcam?.contrato || ''}">
                <input id="chamado_off" style="width: 2vw; height: 2vw; cursor: pointer;" type="checkbox"
                        onchange="salvarDadosCliente()" ${dados_orcam?.contrato == 'sequencial' ? 'checked' : ''}>
                <label style="white-space: nowrap;">Sem Chamado</label>`)}
            ${modelo('Cliente', `<textarea class="autocomplete-input" id="cliente_selecionado" style="font-size: 1.0vw; width: 100%;" oninput="carregarClientes(this)">${cliente?.nome || ''}</textarea>`)}
            ${modelo('CNPJ/CPF', cliente?.cnpj, 'cnpj')}
            ${modelo('Endereço', cliente?.bairro, 'bairro')}
            ${modelo('CEP', cliente?.cep, 'cep')}
            ${modelo('Cidade', cliente?.cidade, 'cidade')}
            ${modelo('Estado', cliente?.estado, 'estado')}
            ${modelo('Tipo de Frete', `<select id="tipo_de_frete" onchange="salvarDadosCliente()">
                    <option ${dados_orcam?.tipo_de_frete == '--' ? 'selected' : ''}>--</option>
                    <option ${dados_orcam?.tipo_de_frete == 'CIF' ? 'selected' : ''}>CIF</option>
                    <option ${dados_orcam?.tipo_de_frete == 'FOB' ? 'selected' : ''}>FOB</option>
                </select>`, 'estado')}
            ${modelo('Transportadora', `<input type="text" id="transportadora" oninput="salvarDadosCliente()" value="${dados_orcam?.transportadora || '--'}">`)}
            ${modelo('Considerações', `<div style="display: flex; flex-direction: column; align-items: start; justify-content: center; width: 100%;">
                    <textarea id="consideracoes" oninput="salvarDadosCliente()" rows="5" style="resize: none; width: 100%; font-size: 1.0vw;"
                    placeholder="Escopo do orçamento">${dados_orcam?.consideracoes || ''}</textarea>

                    <div class="contorno_botoes" style="background-color: #222;">
                        <img src="imagens/anexo2.png" style="width: 1.5vw;">
                        <label style="width: 100%;" for="adicionar_levantamento">Anexar levantamento
                            <input type="file" id="adicionar_levantamento" style="display: none;"
                                onchange="salvar_levantamento()">
                        </label>
                    </div>

                    ${levantamentos}
                </div>
                `)}
            ${modelo('Pagamento',
        `<select id="condicoes" oninput="salvarDadosCliente()">
                    ${condicoes}
                </select>`)}
            ${modelo('Garantia', `<input id="garantia" oninput="salvarDadosCliente()" value="${dados_orcam?.garantia || 'Conforme tratativa Comercial'}">`)}

            <label style="font-size: 1.5vw;">Dados do Analista</label>
            ${modelo('Analista', dados_orcam?.analista, 'analista')}
            ${modelo('E-mail', dados_orcam?.email_analista, 'email_analista')}
            ${modelo('Telefone', dados_orcam?.telefone_analista, 'telefone_analista')}

            <label style="font-size: 1.5vw;">Dados do Vendedor</label>
            ${modelo('Vendedor', `<select style="text-align: center; width: 100%;" id="vendedor" oninput="salvarDadosCliente()"></select>`)}
            ${modelo('E-mail', '', 'email_vendedor')}
            ${modelo('Telefone', '', 'telefone_vendedor')}

            <label style="font-size: 1.5vw;">Quem emite essa nota?</label>

            ${modelo('Empresa', `<select style="text-align: center; width: 100%;" id="emissor" oninput="salvarDadosCliente()">
                    <option ${dados_orcam?.emissor == 'AC SOLUÇÕES' ? 'selected' : ''}>AC SOLUÇÕES</option>
                    <option ${dados_orcam?.emissor == 'HNW' ? 'selected' : ''}>HNW</option>
                    <option ${dados_orcam?.emissor == 'HNK' ? 'selected' : ''}>HNK</option>
                </select>`)}
        </div>

        <div style="width: 100%; display: flex; gap: 10px; align-items: end; justify-content: right; margin-top: 5vh;">
            <label><strong>Data de criação</strong> ou <strong>Alteração</strong></label>
            <label id="data">${new Date(dados_orcam?.data || new Date()).toLocaleDateString('pt-BR')}</label>
        </div>
    </div>
    `

    popup(acumulado, 'Dados do Cliente')

    vendedores_analistas()
}

async function salvarDadosCliente() {
    let orcamento_v2 = baseOrcamento()

    let dados_analista = {
        email: document.getElementById('email_analista').textContent,
        nome: document.getElementById('analista').textContent,
        telefone: document.getElementById('telefone_analista').textContent
    };

    if (!orcamento_v2.dados_orcam) {
        orcamento_v2.dados_orcam = {}
    }

    if (orcamento_v2.id) {
        dados_analista.email = orcamento_v2.dados_orcam.email_analista;
        dados_analista.telefone = orcamento_v2.dados_orcam.telefone_analista;
        dados_analista.nome = orcamento_v2.dados_orcam.analista;
    }

    let contrato = document.getElementById('contrato')
    let checkbox = document.getElementById('chamado_off')

    if (checkbox.checked) {
        orcamento_v2.dados_orcam.contrato = 'sequencial'
        contrato.style.display = 'none'

    } else if (contrato.value == 'sequencial' || orcamento_v2.dados_orcam?.contrato == 'sequencial') {
        orcamento_v2.dados_orcam.contrato = ''
        contrato.value = ''
        contrato.style.display = 'block'

    } else {
        orcamento_v2.dados_orcam.contrato = contrato.value
        contrato.style.display = 'block'
    }

    orcamento_v2.dados_orcam = {
        ...orcamento_v2.dados_orcam,
        analista: dados_analista.nome,
        condicoes: document.getElementById('condicoes').value,
        consideracoes: document.getElementById('consideracoes').value,
        data: new Date(),
        email_analista: dados_analista.email,
        email_vendedor: document.getElementById('email_vendedor').textContent,
        garantia: document.getElementById('garantia').value,
        telefone_analista: dados_analista.telefone,
        transportadora: document.getElementById('transportadora').value,
        telefone_vendedor: document.getElementById('telefone_vendedor').textContent,
        tipo_de_frete: document.getElementById('tipo_de_frete').value,
        vendedor: document.getElementById('vendedor').value,
        emissor: document.getElementById('emissor').value
    };

    baseOrcamento(orcamento_v2)

    if (orcamento_v2.lpu_ativa === 'MODALIDADE LIVRE') {
        total_v2();
    } else {
        await total();
    }
}

async function carregarClientes(textarea) {
    let dados_clientes = await recuperarDados('dados_clientes') || {};
    let pesquisa = String(textarea.value).replace(/[./-]/g, '').toLowerCase()
    let opcoes = ''
    let div = document.getElementById('div_sugestoes')
    if (div) div.remove()

    if (pesquisa == '') return

    for ([omie, cliente] of Object.entries(dados_clientes)) {

        let nome = cliente.nome.toLowerCase()
        let cnpj_sem_format = cliente.cnpj.replace(/[./-]/g, '')

        if (nome.includes(pesquisa) || cnpj_sem_format.includes(pesquisa)) {
            opcoes += `
            <div onclick="selecionarCliente('${omie}', '${cliente.nome}')" class="autocomplete-item" style="text-align: left; padding: 0px; gap: 0px; display: flex; flex-direction: column; align-items: start; justify-content: start; padding: 2px; border-bottom: solid 1px #d2d2d2;">
                <label style="width: 90%; font-size: 0.8vw;">${cliente.nome}</label>
                <label style="width: 90%; font-size: 0.7vw;"><strong>${cliente.cnpj}</strong></label>
            </div>
        `}
    }

    if (document.title !== 'Veículos' && pesquisa == '') {
        document.getElementById('cnpj').textContent = '...'
        document.getElementById('cnpj').textContent = '...'
        document.getElementById('cep').textContent = '...'
        document.getElementById('bairro').textContent = '...'
        document.getElementById('cidade').textContent = '...'
        document.getElementById('estado').textContent = '...'
        return
    }

    let posicao = textarea.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    let div_sugestoes = `
        <div id="div_sugestoes" class="autocomplete-list" style="position: absolute; top: ${top}px; left: ${left}px; border: 1px solid #ccc; width: 15vw;">
            ${opcoes}
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', div_sugestoes)
}

async function selecionarCliente(omie, nome) {

    if (document.title == 'Veículos') {
        let omie_motorista = document.getElementById('motorista')
        omie_motorista.value = nome
        omie_motorista.nextElementSibling.value = omie

    } else {
        let dados_clientes = await recuperarDados('dados_clientes') || {};
        let cliente = dados_clientes[omie]

        let orcamento = baseOrcamento()
        if (!orcamento.dados_orcam) orcamento.dados_orcam = {}
        orcamento.dados_orcam.omie_cliente = omie
        baseOrcamento(orcamento)

        document.getElementById('cnpj').textContent = cliente.cnpj
        document.getElementById('cep').textContent = cliente.cep
        document.getElementById('bairro').textContent = cliente.bairro
        document.getElementById('cidade').textContent = cliente.cidade
        document.getElementById('estado').textContent = cliente.estado

        let textarea = document.getElementById('cliente_selecionado')
        textarea.value = nome
        salvarDadosCliente()
    }

    document.getElementById('div_sugestoes').remove()
}

function executarLimparCampos() {

    document.getElementById('consideracoes').value = ''
    document.getElementById('tipo_de_frete').value = ''
    document.getElementById('transportadora').value = ''

    let orcamento = baseOrcamento()
    if (orcamento.dados_orcam && orcamento.dados_orcam.omie_cliente) delete orcamento.dados_orcam.omie_cliente
    baseOrcamento(orcamento)

    salvarDadosCliente();
    painelClientes()
}

function vendedores_analistas() {
    let dados_vendedores = {
        'GRUPO COSTA SILVA': {
            email: 'comercial@acsolucoesintegradas.com.br',
            telefone: '(71) 3901-3655'
        },
        'Sérgio Bergamini': {
            email: 'sergio.bergamini@acsolucoesintegradas.com.br',
            telefone: '(11) 98938-2759'
        },
        'Fernando Queiroz': {
            email: 'fernando.queiroz@acsolucoesintegradas.com.br',
            telefone: '(11) 99442-8826'
        }
    }

    let vendedores = Object.keys(dados_vendedores)

    let select = document.getElementById('vendedor')

    select.addEventListener('change', function () {
        atualizar_dados_vendedores()
        salvarDadosCliente()
    })

    vendedores.forEach(function (vend_) {
        var option = document.createElement('option')
        option.textContent = vend_
        select.appendChild(option)
    })

    let dados_acesso = JSON.parse(localStorage.getItem('acesso'))

    document.getElementById('analista').textContent = dados_acesso.nome_completo
    document.getElementById('email_analista').textContent = dados_acesso.email
    document.getElementById('telefone_analista').textContent = dados_acesso.telefone

    atualizar_dados_vendedores()
}

function atualizar_dados_vendedores() {
    let dados_vendedores = JSON.parse(localStorage.getItem('vendedores'))
    let vendedor = document.getElementById('vendedor').value
    document.getElementById('email_vendedor').textContent = dados_vendedores[vendedor]['email']
    document.getElementById('telefone_vendedor').textContent = dados_vendedores[vendedor]['telefone']
}

async function abrirDANFE(codOmieNF, tipo, app) {

    overlayAguarde()

    const resposta = await buscarDANFE(codOmieNF, tipo, app)

    if (resposta.faultstring) return popup(mensagem('Não foi possível abrir a DANFE'), 'AVISO', true)

    removerOverlay()

    try {
        shell.openExternal(resposta);
    } catch {
        window.open(resposta, '_blank');
    }

}

async function buscarDANFE(codOmieNF, tipo, app) {
    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/danfe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codOmieNF, tipo, app })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(error => reject(error));

    })
}