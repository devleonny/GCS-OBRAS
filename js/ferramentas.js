const api = `https://api.gcs.app.br`
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column;`
const logo = 'https://i.imgur.com/Nb8sPs0.png'
const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'INFORMÁTICA', 'LICENÇA', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS', 'FIBRA DE REDE'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}
const permComposicoes = ['adm', 'log', 'gerente', 'diretoria', 'editor']
let moduloComposicoes = null
const permCham = ['técnico', 'cliente', 'visitante']
const extensoes = ['jpg', 'jpeg', 'png']
let stream = null
let acesso = {}
let tela = null
let toolbar = null
let titulo = null
let menus = null
let nomeUsuario = null
let progressCircle = null
let percentageText = null
let telaInterna = null
let pExecucao = true
let telaAtiva = null
let funcaoAtiva = null
let funcaoTela = null
const paginasBloqueadas = ['PDF', 'OS']
let sOverlay = false
let ignorarMenus = false
let controlesCxOpcoes = {}
let app = null
const styChek = 'style="width: 1.5rem; height: 1.5rem;"'

const appBases = {
    'GCS': [
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
        'dados_setores',
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

document.addEventListener('click', verificarClique, true)

function conversorData(data) {

    if (!data) return ''

    let [ano, mes, dia] = data.split('-')
    let dataFormatada = `${dia}/${mes}/${ano}`

    return dataFormatada
}

function verificarClique(event) {
    const menu = document.querySelector('.side-menu')
    if (!menu) return

    if (
        menu.classList.contains('active') &&
        !menu.contains(event.target)
    ) {
        menu.classList.remove('active')
    }
}

const dtFormatada = (data) => {
    if (!data) return '-'
    const [ano, mes, dia] = data.split('-')
    return `${dia}/${mes}/${ano}`
}

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'imagens/png';
link.href = 'imagens/LG.png';
document.head.appendChild(link);

function atribuirVariaveis() {

    nomeUsuario = document.querySelector('.nomeUsuario')
    cUsuario = document.querySelector('.cabecalho-usuario')
    toolbar = document.querySelector('.toolbar-top')
    titulo = toolbar.querySelector(`[name="titulo"]`)
    menus = document.querySelector('.side-menu')
    tela = document.querySelector('.tela')

    toolbar.style.display = 'flex'
}

document.addEventListener('keydown', function (event) {
    if (event.key === 'F2') f2()
    if (event.key === 'F8') resetarBases()
    if (event.key === 'F5') location.reload()
})

async function resetarBases() {

    overlayAguarde()
    mostrarMenus(true)
    if (app == 'GCS')
        await atualizarGCS(true) // Resetar;
    else
        await atualizarOcorrencias(true) // Resetar;


    removerOverlay()

}

async function f2() {

    const scripts = ['clientes', 'categorias', 'departamentos', 'pagamentos', 'notas']

    const botoes = scripts
        .map(s => `<button onclick="respostaSincronizacao('${s}')">Sincronizar ${inicialMaiuscula(s)}</button>`)
        .join('')

    const elemento = `
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

            <button onclick="lembreteNotas()">Ver Notas Canceladas/Devolvidas</button>

            <hr>
            <label style="cursor: pointer;">${new Date().getTime()}</label>
        </div>`

    popup({ elemento, titulo: 'Ferramentas' })
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

    if (resposta.mensagem) return popup({ mensagem: resposta.mensagem })

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
                reject(err)
            })
    })
}

function deslogarUsuario() {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `sair()` }
    ]

    popup({ mensagem: 'Deseja Sair?', botoes })
}

async function sair() {
    await resetarTudo()
    removerPopup()

    toolbar.style.display = 'none'
    nomeUsuario.innerHTML = ''
    mostrarMenus(false)

    acesso = null
    localStorage.removeItem('acesso')
    telaLogin()
}

function mostrarMenus(operacao) {

    if (document.title !== 'GCS') return
    if (ignorarMenus) return // Quando atualizações forem recebidas;

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
        const elemento = `
            <div class="fundoImagens">
                <img src="${link}" style="width: 100%;">
            </div>
        `
        return popup({ elemento, titulo: nome })
    }

    window.open(link, '_blank');
}

async function cxOpcoes(name) {

    const controle = controlesCxOpcoes[name]
    if (!controle)
        return popup({ mensagem: `>>> cxOpcoes(null) <<<` })

    controlesCxOpcoes.ativo = name
    const { colunas, base, filtros = {} } = controle

    const pag = 'cxOpcoes'
    const tabela = modTab({
        colunas,
        pag,
        base,
        filtros,
        criarLinha: 'linCxOpcoes',
        body: 'cxOpcoes'
    })

    const elemento = `
        <div style="padding: 1rem;">

            ${tabela}

        </div>`

    popup({ elemento, titulo: 'Selecione o item' })

    await paginacao(pag)
}

function linCxOpcoes(dado) {

    const { ativo } = controlesCxOpcoes // Ativo é o mesmo que o [name]
    const { colunas } = controlesCxOpcoes[ativo]
    const cod = dado.id || dado.codigo || dado.usuario || null
    const tds = []

    for (const coluna of Object.values(colunas)) {

        const d = getByPath(dado, coluna?.chave)

        tds.push(`
            <td>
                ${Array.isArray(d) ? d.join('<br>') : d || ''}
            </td>`)
    }

    return `
        <tr class="opcoes-v2" 
            onclick="selecionar('${ativo}', '${cod}')">
            ${tds.join('')}
        </tr>`
}

async function selecionar(name, cod) {

    const { funcaoAdicional, base, retornar } = controlesCxOpcoes[name]
    const painel = document.querySelector('.painel-padrao')

    if (!retornar)
        return popup({ mensagem: `campo retornar: ['exemplo'] → undefined` })

    // Painel quando for forms; do contrário qualquer outro elemento;
    const elemento = (painel || document)?.querySelector(`[name='${name}']`)
    const termos = []
    const dado = await recuperarDado(base, cod)

    for (const chave of retornar) {
        const d = getByPath(dado, chave)

        if (d ?? false) {
            if (Array.isArray(d))
                termos.push(...d)
            else
                termos.push(d)
        }
    }

    elemento.innerHTML = termos.join('<br>')
    elemento.id = cod

    removerPopup()

    if (funcaoAdicional)
        await window[funcaoAdicional]()
}

async function pdf({ id, estilos = [], nome = 'documento', orientacao = '' }) {

    const htmlPdf = document.getElementById(id)
    if (!id || !htmlPdf) 
        return

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
                        size: A4 ${orientacao};
                        margin: 10mm;
                    }

                    html, body {
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        font-family: 'Poppins', sans-serif;
                        background: white;
                    }}
                          
                    .topo-tabela * {
                        visibility: hidden;
                    }

                    .div-tabela {
                        max-height: max-content;
                    }

                    .tabela thead tr:nth-child(2) {
                        display: none;
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
        popup({ mensagem: err?.message || 'Seu pdf não ficou bom, o GCS não gostou, tente de novo... (Falha no GCS)' })
    }

}

function base64ToBlob(base64) {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

async function importarAnexos({ input, foto }) {

    if (!foto && !input?.files?.length) return []

    const formData = new FormData()

    if (foto) {
        const blob = base64ToBlob(foto);
        formData.append('arquivos', blob);
    } else {
        for (const file of input.files) {
            formData.append('arquivos', file);
        }
    }

    try {
        const response = await fetch(`${api}/upload`, {
            method: 'POST',
            body: formData
        });
        return await response.json();
    } catch (err) {
        popup({ mensagem: `Erro na API: ${err}` })
        throw err;
    }
}

function sincronizarApp({ atual, total, remover } = {}) {

    const progresso = document.querySelector('.progresso')

    if (remover) {

        setTimeout(async () => {
            const loader = document.querySelector('.circular-loader')
            if (loader) loader.remove()
            return
        }, 1000)

        return removerOverlay()

    } else if (atual) {

        if (!progresso) return overlayAguarde()

        const circumference = 2 * Math.PI * 50;
        const percent = (atual / total) * 100;
        const offset = circumference - (circumference * percent / 100);
        progressCircle.style.strokeDasharray = circumference;
        progressCircle.style.strokeDashoffset = offset;
        percentageText.textContent = `${percent.toFixed(0)}%`;

        return

    } else {

        const carregamentoHTML = `
            <div class="circular-loader">
                <svg>
                    <circle class="bg" cx="60" cy="60" r="50"></circle>
                    <circle class="progress" cx="60" cy="60" r="50"></circle>
                </svg>
                <div class="percentage">0%</div>
            </div>
        `

        if (!progresso) return
        progresso.innerHTML = carregamentoHTML

        progressCircle = document.querySelector('.circular-loader .progress');
        percentageText = document.querySelector('.circular-loader .percentage');
    }

}