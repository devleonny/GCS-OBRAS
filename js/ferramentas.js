const api = `https://api.gcs.app.br`
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column;`
const logo = 'https://i.imgur.com/Nb8sPs0.png'
const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'INFORMÁTICA', 'LICENÇA', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS', 'FIBRA DE REDE'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}
const permCham = ['técnico', 'cliente', 'visitante']
const extensoes = ['jpg', 'jpeg', 'png']
let acesso = {}
let tela = null
let toolbar = null
let titulo = null
let menus = null
let progressCircle = null
let percentageText = null
let telaInterna = null
let filtrosPagina = {}
let pExecucao = true
let telaAtiva = null
let funcaoAtiva = null
let funcaoTela = null
const filtrosPesquisa = {}
const paginasBloqueadas = ['PDF', 'OS']
let overlayTimeout;
let sOverlay = false
let dados_clientes = {}
let empresas = {}
let correcoes = {}
let sistemas = {}
let prioridades = {}
let tipos = {}
let dados_orcamentos = {}
let dados_ocorrencias = {}
let dados_setores = {}
let hierarquia = {}
let depPorDesc = {}
let app = null
let paginaAtual = 1
const limitePorPagina = 100
const styChek = 'style="width: 1.5rem; height: 1.5rem;"'
const mensagem = (mensagem, imagem = 'gifs/alerta.gif') => `
    <div class="mensagem">
        <img src="${imagem}">
        <label>${mensagem}</label>
    </div>`
const appBases = {
    'GCS': [
        'hierarquia',
        'tags',
        'tags_orcamentos',
        'departamentos_AC',
        'dados_orcamentos',
        'custo_veiculos',
        'motoristas',
        'veiculos',
        'dados_composicoes',
        'dados_clientes',
        'lista_pagamentos',
        'dados_manutencao',
        'dados_categorias_AC',
        'dados_estoque',
        'pessoas'
    ],
    'OCORRÊNCIAS': [
        'dados_clientes',
        'prioridades',
        'tipos',
        'correcoes',
        'sistemas',
        'empresas',
        'dados_setores'
    ]
}

//Temporário 
indexedDB.deleteDatabase('GCSMob')

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'imagens/png';
link.href = 'imagens/LG.png';
document.head.appendChild(link);

function atribuirVariaveis() {
    toolbar = document.querySelector('.toolbar-top')
    titulo = toolbar.querySelector(`[name="titulo"]`)
    menus = document.querySelector('.side-menu')
    tela = document.querySelector('.tela')
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'F2') f2()
    if (event.key === 'F8') resetarBases()
    if (event.key === 'F5') location.reload()
})

async function resetarBases() {

    overlayAguarde()

    const divMensagem = document.querySelector('.div-mensagem')

    divMensagem.innerHTML = `
        <div style="${vertical}; gap: 1vh;">
            <label><b>GCS</b>: Por favor, aguarde...</label>
            <br>
            <div id="logs" style="${vertical}; gap: 1vh;"></div>
        </div>
    `

    const logs = document.getElementById('logs')

    await resetarTudo()
    logs.insertAdjacentHTML('beforeend', '<label>Apagando <b>Base existente</b>...</label>')
    logs.insertAdjacentHTML('beforeend', '<label>Criando uma nova Base, 0km, novíssima...</label>')

    if (!app) return

    for (const base of appBases[app]) {
        await sincronizarDados({ base, resetar: true })
        logs.insertAdjacentHTML('beforeend', `<label>Sincronizando: <small>${base}</small></label>`)
    }

    location.reload() // Recarregar a página;

    removerOverlay()

}

async function f2() {

    const scripts = ['clientes', 'categorias', 'departamentos', 'pagamentos']

    const botoes = scripts
        .map(s => `<button onclick="respostaSincronizacao('${s}')">Sincronizar ${inicialMaiuscula(s)}</button>`)
        .join('')

    const acumulado = `
        <div class="ferramentas">

            ${botoes}

            <div style="${vertical}; gap: 2px;">
                <span>Criar Departamento</span>
                <div style="${horizontal}; gap: 0.5rem;">
                    <input oninput="this.nextElementSibling.style.display = ''">
                    <img src="imagens/concluido.png" onclick="salvarDepartamento(this)" style="display: none;">
                </div>
            </div>

            <div id="localResposta"></div>

            <hr>
            <label style="cursor: pointer;">${new Date().getTime()}</label>
        </div>
    `
    popup(acumulado, 'Ferramentas', true)
}

function inicialMaiuscula(string) {
    if (string == undefined) {
        return ''
    }
    string.includes('_') ? string = string.split('_').join(' ') : ''

    if (string.includes('lpu')) return string.toUpperCase()
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

function overlayAguarde() {

    if (sOverlay) return

    const aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()

    const elemento = `
        <div class="aguarde">
            <div class="div-mensagem"></div>
            <img src="gifs/loading.gif">
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', elemento)

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    document.querySelector('.aguarde').style.height = `${pageHeight}px`;

}

function removerOverlay() {
    let aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()
}

setInterval(async function () {
    await reprocessarOffline()
}, 30 * 1000)

async function reprocessarOffline() {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {};

    for (let [operacao, operacoes] of Object.entries(dados_offline)) {
        const ids = Object.keys(operacoes);

        for (let idEvento of ids) {
            const evento = operacoes[idEvento];

            if (operacao === 'enviar') {
                await enviar(evento.caminho, evento.valor, idEvento);
            } else if (operacao === 'deletar', idEvento) {
                await deletar(evento.chave, idEvento);
            }

        }
    }
}

function popup(elementoHTML, titulo, nra = true) {

    const idPopup = ID5digitos()
    const p = `
    <div 
        id="${idPopup}"
        class="popup">

        <div class="janela-fora">
            
            <div class="popup-top">

                <label style="background-color: transparent; color: white; margin-left: 1rem;">${titulo || 'GCS'}</label>
                <span onclick="removerPopup({id:'${idPopup}', nra: ${nra}})">×</span>

            </div>
            
            <div class="janela">

                ${elementoHTML}

            </div>

        </div>

    </div>`

    const aguarde = document.querySelector('.aguarde')
    if (aguarde) aguarde.remove()

    document.body.insertAdjacentHTML('beforeend', p)

}
async function removerPopup({ id, nra = true } = {}) {
    const popups = document.querySelectorAll('.popup')

    if (id) {
        document.getElementById(id)?.remove()
    } else if (nra) {
        popups[popups.length - 1]?.remove()
    } else {
        for (const p of popups) p.remove()
    }

    document.querySelector('.aguarde')?.remove()
}

function verificarClique(event) {
    const menu = document.querySelector('.side-menu')
    if (menu && menu.classList.contains('active') && !menu.contains(event.target)) menu.classList.remove('active')
}

function criarAnexoVisual(nome, link, funcao) {

    let displayExcluir = 'flex'

    if (!funcao) displayExcluir = 'none'

    // Formata o nome para exibição curta
    const nomeFormatado = nome.length > 15
        ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
        : nome;

    return `
        <div class="contorno-anexos" name="${link}">
            <div onclick="abrirArquivo('${link}')" class="contorno_interno" style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 2px;">
                <img src="imagens/anexo2.png" style="width: 1.5rem;">
                <label style="font-size: 0.7rem; cursor: pointer;" title="${nome}">${nomeFormatado}</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir}; width: 1.5rem; cursor: pointer;" onclick="${funcao}">
        </div>`
}

function dicionario(item) {
    return typeof item === "object" && item !== null && item.constructor === Object;
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

function ID5digitos() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        const indiceAleatorio = Math.floor(Math.random() * caracteres.length);
        id += caracteres.charAt(indiceAleatorio);
    }
    return id;
}

async function configuracoes(usuario, campo, valor) {

    const resposta = comunicacaoServ({ usuario, campo, valor })

    if (resposta.mensagem) return popup(mensagem(resposta.mensagem), 'Alerta', true)

    const dadosUsuario = await recuperarDado('dados_setores', usuario)
    dadosUsuario[campo] = valor

    if (campo == 'permissao' && valor == 'desativado') {
        removerPopup()
        await deletarDB('dados_setores', usuario)
        const tr = document.getElementById(usuario)
        if (tr) tr.remove()
    } else {
        await inserirDados({ [usuario]: dadosUsuario }, 'dados_setores')
        if (app == 'OCORRÊNCIAS') await telaUsuarios()
    }
}

async function comunicacaoServ({ usuario, campo, valor }) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/configuracoes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, campo, valor })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)
                }
                return response.json()
            })
            .then(data => {
                resolve(data)
            })
            .catch(err => {
                reject({ mensagem: err })
            })
    })
}

function deslogarUsuario() {
    popup(`
        <div style="${horizontal}; min-width: 200px; background-color: #d2d2d2; gap: 10px; padding: 1rem;">
            <label>Deseja Sair?</label>
            <button onclick="sair()">Sim</button>
        </div>
        `, 'Tem certeza?')
}

function sair() {
    indexedDB.deleteDatabase(nomeBaseCentral)
    removerPopup()
    const toolbar = document.querySelector('.toolbar-top')
    if (toolbar) toolbar.remove()
    mostrarMenus(false)

    localStorage.removeItem('acesso')
    retornar()
}

function redirecionarChamados() {
    localStorage.setItem('app', '')
    window.location.href = 'chamados.html'
}

function retornar() {
    window.location.href = 'chamados.html'
}

function mostrarMenus(operacao) {
    if (document.title !== 'GCS') return
    const menu = document.querySelector('.side-menu').classList
    if (operacao == 'toggle') return menu.toggle('active')
    operacao ? menu.add('active') : menu.remove('active')
}

let shell = null;
if (typeof window !== 'undefined' && window.process && window.process.type) {
    const { shell: electronShell } = require('electron');
    shell = electronShell;
}

function abrirArquivo(link, nome) {
    link = `${api}/uploads/${link}`
    const imagens = ['png', 'jpg', 'jpeg']

    const extensao = !nome
        ? ''
        : nome.split('.').pop().toLowerCase() // pega sem o ponto

    if (imagens.includes(extensao)) {
        const acumulado = `
            <div class="fundoImagens">
                <img src="${link}" style="width: 100%;">
            </div>
        `
        return popup(acumulado, nome, true);
    }

    window.open(link, '_blank');
}

async function cxOpcoes(name, nomeBase, campos, funcaoAux) {

    function getValorPorCaminho(obj, caminho) {
        const partes = caminho.split('/')
        const ultima = partes[partes.length - 1]
        let func = null

        // Se o último pedaço tiver [funcao]
        if (/\[.*\]$/.test(ultima)) {
            const [chave, nomeFunc] = ultima.match(/^([^\[]+)\[(.+)\]$/).slice(1)
            partes[partes.length - 1] = chave
            func = nomeFunc
        }

        // percorre o caminho
        let valor = partes.reduce((acc, chave) => acc?.[chave], obj)

        // aplica a função se existir
        if (valor != null && func && typeof window[func] === 'function') {
            valor = window[func](valor)
        }

        return valor
    }

    const base = await recuperarDados(nomeBase)
    let opcoesDiv = ''

    for (const [cod, dado] of Object.entries(base)) {

        const labels = campos
            .map(campo => {
                const valor = getValorPorCaminho(dado, campo)
                return valor ? `<div>${valor}</div>` : ''
            })
            .join('')

        const descricao = campos
            .map(c => getValorPorCaminho(dado, c))
            .find(v => v !== undefined && v !== null && v !== '')

        opcoesDiv += `
        <div 
            name="camposOpcoes" 
            class="atalhos-opcoes" 
            onclick="selecionar('${name}', '${cod}', '${encodeURIComponent(descricao)}', ${funcaoAux ? `'${funcaoAux}'` : false})">
            <img src="${dado.imagem || 'imagens/LG.png'}" style="width: 3rem;">
            <div style="${vertical}; gap: 2px;">
                ${labels}
            </div>
        </div>`
    }

    const acumulado = `
        <div style="${vertical}; justify-content: left; background-color: #b1b1b1;">

            <div class="cx-pesquisa">
                <input oninput="pesquisarCX(this)" placeholder="Pesquisar itens" style="width: 100%;">
                <img src="imagens/pesquisar4.png" style="width: 2rem; padding: 0.5rem;"> 
            </div>

            <div class="cx-opcoes">
                ${opcoesDiv}
            </div>

        </div>
    `

    popup(acumulado, 'Selecione o item', true)
}

async function selecionar(name, id, termo, funcaoAux) {
    termo = decodeURIComponent(termo)
    const elemento = document.querySelector(`[name='${name}']`)
    elemento.textContent = termo || id
    elemento.id = id
    removerPopup()

    if (funcaoAux) await eval(funcaoAux)
}

function pesquisarCX(input) {
    const termoPesquisa = String(input.value)
        .toLowerCase()
        .replace(/[./-]/g, ''); // remove ponto, traço e barra

    const divs = document.querySelectorAll(`[name='camposOpcoes']`);

    for (const div of divs) {
        const termoDiv = String(div.textContent)
            .toLowerCase()
            .replace(/[./-]/g, ''); // mesma limpeza no conteúdo

        div.style.display = (termoDiv.includes(termoPesquisa) || termoPesquisa === '') ? '' : 'none';
    }
}

async function gerarPdfRequisicao(nome) {

    const id = 'pdf'
    const estilos = [
        'gcsobras',
        'status'
    ]

    await pdf({ id, estilos, nome })
}

async function pdf({ id, estilos = [], nome = 'documento' }) {

    const htmlPdf = document.getElementById(id)
    const bPdf = document.getElementById('bPdf')
    if (!id || !htmlPdf) return

    if (bPdf) bPdf.style.display = 'none'

    overlayAguarde()

    estilos = estilos
        .map(estilo => `<link rel="stylesheet" href="https://devleonny.github.io/GCS-OBRAS/css/${estilo}.css">`)
        .join('')

    const html = `
        <html>
            <head>
                <meta charset="UTF-8">
                ${estilos}
                <style>

                    @page {
                        size: A4;
                        margin: 10mm;
                    }

                    html, body {
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        font-family: 'Poppins', sans-serif;
                        background: white;
                    }

                </style>
            </head>
            <body>
                ${htmlPdf.outerHTML}
            </body>
        </html>`

    try {

        const response = await fetch(`${api}/pdf-vers2`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ html })
        })

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `${nome}.pdf`
        a.click()

        URL.revokeObjectURL(url)

        removerOverlay()
    } catch (err) {
        popup(mensagem(err?.message || 'Falhei... '), 'Alerta', true)
    }

    if (bPdf) bPdf.style.display = ''

}
