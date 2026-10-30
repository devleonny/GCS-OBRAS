const api = 'https://api.gcs.app.br'
const read = 'https://read.gcs.app.br'
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column;`
// Local: o Imgur responde 403 quando a página roda em localhost. URL absoluta para comparar com img.src.
// logo-centralizada.png: recorte quadrado do LG.png com o "S" no centro, para molduras redondas.
const logo = new URL('imagens/logo-centralizada.png', location.href).href

const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'INFORMÁTICA', 'LICENÇA', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS', 'FIBRA DE REDE', 'FERRAMENTAS', 'PEÇAS'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}

const permissoes = ['', 'adm', 'técnico', 'cliente', 'user', 'visitante', 'analista', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo']
const setores = ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE', 'POC', 'GCS', 'CNR']
const tagsClientes = ['', 'FUNCIONÁRIO', 'CLIENTE', 'MOTORISTA', 'TÉCNICO', 'TÉCNICO PARCEIRO', 'FORNECEDOR', 'MATRIZ', 'CFTV', 'CATRACAS', 'INFRA', 'ALARME']
const parcelas = ["--", "15 dias", "20 dias", "21 dias", "30 dias", "35 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]
const empresas = ['AC', 'IAC', 'HNK', 'HNW']
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
let sOverlay = false
let ignorarMenus = false
let controlesCxOpcoes = {}
const styChek = 'style="width: 1.5rem; height: 1.5rem;"'
const usuariosPermitidosParaEditar = ['log', 'editor', 'adm', 'gerente', 'diretoria', 'coordenacao']
let LPUS = null
let overlayTimeout = null;

// Service work para apps no dispositivo;
const emArquivoLocal = location.protocol === 'file:'

if (!emArquivoLocal && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registrado:', reg.scope))
        .catch(err => console.error('Erro ao registrar SW:', err))
}

function mostrarBtn(input) {
    const img = input.nextElementSibling
    img.style.display = ''
}

function conversorDt(dt, formato = 'br') {

    if (!dt || '')
        return ''

    if (formato == 'br') {

        const [ano, mes, dia] = dt.split('-')
        return `${dia}/${mes}/${ano}`

    } else if (formato == 'input') {

        const [dia, mes, ano] = dt.split('/')
        return `${ano}-${mes}-${dia}`

    } else {
        return popup({ mensagem: 'Na função conversorDt o formato não foi reconhecido' })
    }

}

const pdfDanfe = ({ id, n_nota, categoria, total = null, d_emi_inicial }) => {

    const labelTotal = total 
        ? `<label>${dinheiro(total)}</label>`
        : ''

    return `
        <div class="balao-nf" onclick="abrirDANFE('${id}')">
            <div class="balao1">
                <label>${n_nota}</label>
                <label><b>${categoria}</b></label>
                ${labelTotal}
                ${d_emi_inicial || ''}
            </div>
            <div class="balao2">PDF</div>
        </div>
    `
}

function conversorData(data) {

    if (!data) return ''

    let [ano, mes, dia] = data.split('-')
    let dataFormatada = `${dia}/${mes}/${ano}`

    return dataFormatada
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

    acesso = JSON.parse(localStorage.getItem('acesso'))
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
    if (event.key === 'F5') location.reload()
})

async function f2() {

    const linhas = [
        {
            texto: 'Criar Departamento',
            elemento: `
                <div style="${horizontal}; gap: 0.5rem;">
                    <input oninput="this.nextElementSibling.style.display = ''">
                    <img src="imagens/concluido.png" onclick="salvarDepartamento({img: this})" style="display: none;">
                </div>
                <div id="localResposta"></div>
            `
        },
        {
            texto: 'Sincronizar notas',
            elemento: `<button onclick="sincronizarNotas()">Sincronizar</button>`
        },
        {
            texto: 'Criar uma LPU',
            elemento: `<button onclick="formularioLPU()">Criar</button>`
        }
    ]

    popup({ linhas, titulo: 'Ferramentas' })
}

function criarVelocimetroHTML({
    valor = 0,
    limite,
    tamanho = 220,
    espessura = 10,
    rotulo = 'Uso'
} = {}) {
    const valorNumero = Number(valor);
    const valorBruto = Number.isFinite(valorNumero) ? valorNumero : 0;

    // valor para stroke: limitar só para cálculo geométrico (0–100),
    // mas deixar o texto mostrar o valor real (pode ser 120, 150 etc.).
    const valorStroke = Math.max(0, Math.min(100, valorBruto));

    const limiteNumero = Number(limite);
    const temLimite =
        limite !== null &&
        limite !== undefined &&
        limite !== '' &&
        Number.isFinite(limiteNumero);

    const limiteSeguro = temLimite
        ? Math.max(0, Math.min(100, limiteNumero))
        : null;

    let situacao = 'normal';

    if (temLimite) {
        if (valorBruto >= limiteSeguro) {
            situacao = 'critico';
        } else if (valorBruto >= limiteSeguro - 10) {
            situacao = 'alerta';
        }
    }

    // se passar de 100, força uma classe específica pra ficar azul
    if (valorBruto > 100) {
        situacao = 'ultrapassado'; // css vai pintar azul
    }

    const raio = 50 - espessura / 2;
    const comprimentoSemicirculo = Math.PI * raio;
    const deslocamentoProgresso =
        comprimentoSemicirculo * (1 - valorStroke / 100);

    const textoLimite = temLimite
        ? `Limite: ${limiteSeguro}%`
        : '';

    const textoValor = `${valorBruto.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

    // A fonte do número acompanha a largura do velocímetro (cqi) e diminui com a quantidade
    // de caracteres, para "101,9%" caber no arco tanto quanto "42%".
    const fonteValor = { 1: 16, 2: 16, 3: 16, 4: 14, 5: 12.5 }[textoValor.length] || 11;

    const ariaLabel = temLimite
        ? `${rotulo}: ${textoValor} de 100%, limite ${limiteSeguro}%`
        : `${rotulo}: ${textoValor} de 100%, sem limite`;

    return `
    <div
      class="velocimetro velocimetro--${situacao}"
      style="
        --velocimetro-tamanho: ${tamanho}px;
        --velocimetro-espessura: ${espessura};
        --velocimetro-deslocamento: ${deslocamentoProgresso};
        --velocimetro-comprimento: ${comprimentoSemicirculo};
        --velocimetro-fonte-valor: ${fonteValor};
      "
      data-valor="${valorBruto}"
      data-limite="${temLimite ? limiteSeguro : ''}"
    >
      <div class="velocimetro__area-svg">
        <svg
          class="velocimetro__svg"
          viewBox="0 0 100 60"
          aria-label="${ariaLabel}"
        >
          <path
            class="velocimetro__trilha"
            d="M 10 50 A 40 40 0 0 1 90 50"
          ></path>

          <path
            class="velocimetro__progresso"
            d="M 10 50 A 40 40 0 0 1 90 50"
          ></path>
        </svg>

        <div class="velocimetro__conteudo">
          <div class="velocimetro__valor">${textoValor}</div>
          <div class="velocimetro__rotulo">${rotulo}</div>
          <div class="velocimetro__limite">${textoLimite}</div>
        </div>
      </div>
    </div>
  `;
}

function inicialMaiuscula(string) {
    if (string == undefined) return ''

    if (string.includes('lpu')) return string.toUpperCase()

    return string
        .replaceAll('_', ' ')
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
        .join(' ')
}

function overlayAguarde() {

    if (sOverlay)
        return

    const aguardeAntigo = document.querySelector('.aguarde')

    if (aguardeAntigo)
        aguardeAntigo.remove()

    const elemento = `
        <div class="aguarde">

            <div class="loading-container">
                <img src="gifs/loading-gcs.gif" alt="Carregando">
            </div>
            
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', elemento)

    const aguarde = document.querySelector('.aguarde')

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    )

    aguarde.style.height = `${pageHeight}px`

    clearTimeout(overlayTimeout)

    overlayTimeout = setTimeout(() => {

        const loadingContainer = aguarde.querySelector('.loading-container')

        if (!loadingContainer)
            return

        loadingContainer.innerHTML = `
            <div class="popup-fechar">
                <span>O processo demorou muito, verifique se sua ação foi realizada ou fale com o suporte.</span>
                <button onclick="removerOverlay()">Fechar</button>
            </div>
            `

    }, 30000)
}

function removerOverlay() {
    let aguarde = document.querySelector('.aguarde')
    if (aguarde)
        aguarde.remove()
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

// Cor do selo de tipo no cartão de anexo.
function corTipoAnexo(extensao) {
    const cores = {
        pdf: '#d1453b',
        xls: '#1f8a4c', xlsx: '#1f8a4c', csv: '#1f8a4c',
        doc: '#2b6cb0', docx: '#2b6cb0', txt: '#2b6cb0',
        ppt: '#d9822b', pptx: '#d9822b',
        zip: '#7b4fb0', rar: '#7b4fb0', '7z': '#7b4fb0',
        dwg: '#0f8a8a', dxf: '#0f8a8a'
    }
    return cores[extensao] || '#6b7a72'
}

// Cartão de anexo (imagem ou arquivo). O botão de remover é filho direto do cartão:
// quem remove usa this.parentElement (ex.: removerAnexo) e assim tira o cartão inteiro.
function criarAnexoVisual(nome, link, funcao) {

    const formImg = ['jpg', 'jpeg', 'png']
    const regex = /\.([^.]+)$/
    const resultado = nome.match(regex)
    const formato = resultado ? resultado[1] : null

    // Fora da área clicável e sem propagar: remover não abre o anexo junto.
    const excluir = funcao
        ? `<button type="button" class="anexo-remover" title="Remover anexo" aria-label="Remover anexo"
            onclick="event.stopPropagation(); ${funcao}">&times;</button>`
        : ''

    // Formato imagem;
    if (formImg.includes(formato)) {

        return `
            <div class="anexo-imagem" title="${nome}">
                ${excluir}
                <img
                    class="foto-status"
                    id="${link}"
                    src="${api}/uploads/${link}"
                    alt="${nome}"
                    onclick="ampliarImagem(this, '${link}')">
            </div>
        `

    } else {

        // A extensão vai no selo colorido; o nome aparece sem ela (cortado com … pelo CSS).
        const extensao = (formato || 'arq').toLowerCase()
        const nomeSemExtensao = formato ? nome.slice(0, -(formato.length + 1)) : nome

        return `
            <div class="contorno-anexos" name="${link}" title="${nome}" style="--anexo-cor: ${corTipoAnexo(extensao)}">
                <div class="contorno-iterno" onclick="abrirArquivo('${link}')">
                    <span class="anexo-tipo">${extensao.slice(0, 4)}</span>
                    <span class="anexo-textos">
                        <span class="anexo-nome">${nomeSemExtensao || nome}</span>
                        <small>Clique para abrir</small>
                    </span>
                </div>
                ${excluir}
            </div>
        `
    }

}

function dicionario(item) {
    return typeof item === "object" && item !== null && item.constructor === Object;
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
        let valorNumerico = parseFloat(stringMonetario);

        if (isNaN(valorNumerico)) {
            return 0;
        }

        return valorNumerico;
    }
}

function dinheiro(valor) {
    if (valor === '') return 'R$ 0,00'

    valor = Number(valor)
    const valorString = 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `<span style="white-space: nowrap;">${valorString}</span>`
}

// Mesma regra do servidor (validarNovaSenha), só para avisar antes de enviar.
const REGRA_SENHA = 'Mínimo de 8 caracteres, sem conter o seu usuário e sem senhas óbvias (ex.: 12345678).'

function formularioTrocarSenha() {

    const campo = (nome, placeholder) =>
        `<input name="${nome}" type="password" autocomplete="${nome === 'senhaAtual' ? 'current-password' : 'new-password'}" placeholder="${placeholder}">`

    const linhas = [
        { texto: 'Senha atual', elemento: campo('senhaAtual', 'Senha atual') },
        { texto: 'Nova senha', elemento: campo('novaSenha', 'Nova senha') },
        { texto: 'Repita a nova senha', elemento: campo('confirmarSenha', 'Repita a nova senha') },
        { elemento: `<small style="color: #65756b; text-align: left;">${REGRA_SENHA}</small>` }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarTrocaSenha()' }
    ]

    popup({ linhas, botoes, titulo: 'Trocar senha' })
}

async function salvarTrocaSenha() {

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const valor = nome => painel?.querySelector(`[name="${nome}"]`)?.value || ''

    const senhaAtual = valor('senhaAtual')
    const novaSenha = valor('novaSenha')

    if (!senhaAtual || !novaSenha)
        return popup({ mensagem: 'Preencha a senha atual e a nova senha.' })

    if (novaSenha !== valor('confirmarSenha'))
        return popup({ mensagem: 'A confirmação não confere com a nova senha.' })

    if (novaSenha.length < 8)
        return popup({ mensagem: REGRA_SENHA })

    overlayAguarde()

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/trocar-senha`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ senhaAtual, novaSenha })
        })
        const dados = await resposta.json().catch(() => ({}))

        // Erro de validação: mantém o formulário aberto para corrigir.
        if (!resposta.ok || !dados.success) {
            removerOverlay()
            return popup({ mensagem: dados.mensagem || 'Falha ao trocar a senha.' })
        }

        removerTodosPopups()
        popup({ mensagem: dados.mensagem, imagem: 'imagens/concluido.png' })
    } catch {
        removerOverlay()
        popup({ mensagem: 'Sem conexão com o servidor. Tente novamente.' })
    }
}

function deslogarUsuario() {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `sair()` }
    ]

    popup({ mensagem: 'Deseja Sair?', botoes })
}

async function sair() {

    removerPopup()

    toolbar.style.display = 'none'
    nomeUsuario.innerHTML = ''
    if (typeof ocultarTecnicosLivres === 'function') ocultarTecnicosLivres()
    if (typeof ocultarAvisoAniversario === 'function') ocultarAvisoAniversario()
    mostrarMenus()

    // Encerra a sessão no servidor: o token de renovação deixa de valer neste aparelho.
    await encerrarSessaoServidor()

    acesso = null
    localStorage.removeItem('acesso')
    telaLogin()

}

function mostrarMenus(operacao) {

    const menu = document.querySelector('.side-menu').classList
    const tela = document.querySelector('.tela').classList

    menu.toggle('active')
    tela.toggle('active')

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
    const {
        colunas,
        base,
        retornar,
        ordenar = {
            path: retornar[0],
            direcao: 'ASC'
        },
        filtros = {},
        substituicoes,
        btnExtras = null
    } = controle

    const pag = 'cxOpcoes'
    const tabela = await modTab({
        colunas,
        btnExtras,
        pag,
        base,
        ordenar,
        // Os filtros do controle restringem a lista; a pesquisa nas colunas começa vazia e só soma condições.
        filtros: {},
        filtrosFixos: filtros,
        substituicoes,
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

function getByPath(obj, path) {
    if (!path) return obj
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
}

async function linCxOpcoes(dado) {

    const { ativo } = controlesCxOpcoes // Ativo é o mesmo que o [name]
    const { colunas, prepararDado } = controlesCxOpcoes[ativo]
    if (prepararDado)
        dado = await prepararDado(dado)
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
        <tr onclick="selecionar('${ativo}', '${cod}')">
            ${tds.join('')}
        </tr>`
}

async function selecionar(name, cod) {

    overlayAguarde()

    if (cod == 'null')
        return popup({ mensagem: 'O objeto "base" em controlesCx precisa contem o próprio "id" / "codigo" / "etc"' })

    const { funcaoAdicional, base, retornar, filtros, prepararDado, filtroPesquisa = null } = controlesCxOpcoes[name]

    if (!retornar)
        return popup({ mensagem: `campo retornar: ['exemplo'] → undefined` })

    // Painel quando for forms; do contrário qualquer outro elemento;
    const painel = Array.from(document.querySelectorAll('.painel-padrao')).at(-1)
    const elemento = (painel || document).querySelector(`[name='${name}']`)
    const termos = []

    let dado = {}

    if (filtroPesquisa) {

        const params = {
            base,
            filtros: {
                ...filtros,
                id: { op: '=', value: cod }
            }
        }

        const pesquisa = await pesquisarDB(params)

        dado = pesquisa?.resultados?.[0] || {}

    } else if (typeof base === 'string') {
        dado = await recuperarDado(base, cod)

    } else {
        dado = base.find(item =>
            String(item.id ?? item.codigo ?? item.usuario) === String(cod)
        )
    }

    if (prepararDado)
        dado = await prepararDado(dado)

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

function mostrarPreviaPdf(blob, nome) {
    const url = URL.createObjectURL(blob)
    const idBotao = `baixar-pdf-${crypto.randomUUID()}`
    const idPopup = popup({
        titulo: escaparAtributo(nome),
        elemento: `<iframe src="${url}" title="Prévia do PDF" style="display:block;width:min(1100px,86vw);height:72vh;border:0;background:white;"></iframe>`,
        botoes: [{ id: idBotao, texto: 'Baixar PDF', img: 'pdf' }]
    })
    document.getElementById(idBotao).addEventListener('click', () => {
        const link = document.createElement('a')
        link.href = url
        link.download = `${nome}.pdf`
        link.click()
    })
    const observador = new MutationObserver(() => {
        if (!document.getElementById(idPopup)) {
            URL.revokeObjectURL(url)
            observador.disconnect()
        }
    })
    observador.observe(document.body, { childList: true })
}

// Documento completo enviado ao /pdf. O servidor guarda o PDF pelo hash deste texto: quem quiser
// reaproveitar o cache (ex.: preaquecerPdfOrcamento) precisa montar por aqui, igual.
function htmlFinalPdf(htmlPdf, estilos = []) {
    const links = estilos
        // Versão vinda de js/versoes_css.js (gerado no commit), para o servidor não usar CSS em cache.
        .map(estilo => {
            const versao = typeof VERSOES_CSS !== 'undefined' ? VERSOES_CSS[estilo] : null
            return `<link rel="stylesheet" href="https://devleonny.github.io/GCS-OBRAS/css/${estilo}.css${versao ? `?v=${versao}` : ''}">`
        })
        .join('')

    return `
            <html>
                <head>
                    <meta charset="UTF-8">
                    ${links}
                    <style>

                        body {
                            width: 100%;
                            display: flex;
                            align-items: start;
                            justify-content: center;
                            font-family: 'Poppins', sans-serif;
                            background: white;
                        }

                    </style>
                </head>
                <body>${htmlPdf}</body>
            </html>`
}

async function pdf({ id, html = null, orientacao = 'portrait', estilos = [], nome = 'documento', visualizar = false }) {

    try {
        overlayAguarde()

        if (!id && !html)
            return popup({ mensagem: 'ID do elemento ou html não localizado: Fale com o suporte.' })

        const htmlFinal = htmlFinalPdf(html || document.getElementById(id).outerHTML, estilos)

        const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

        const response = await fetch(`${api}/pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ html: htmlFinal, orientacao })
        })

        // Sem o return a resposta de erro era baixada como se fosse o PDF.
        if (!response.ok) {
            const text = await response.text()
            let j = null
            try { j = JSON.parse(text) } catch { }
            const msg = response.status === 401 || response.status === 403
                ? 'Sessão expirada: entre novamente no sistema para gerar o PDF.'
                : j?.mensagem || j?.erro || j?.error || text || 'Falha ao baixar PDF'

            return popup({ mensagem: msg })
        }

        const blob = await response.blob()
        if (visualizar) {
            mostrarPreviaPdf(blob, nome)
            removerOverlay()
            return
        }
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `${nome}.pdf`
        a.click()

        URL.revokeObjectURL(url)
        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao gerar PDF: Fale com o suporte.' })
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

    if (!foto && !input?.files?.length)
        return []

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

        // /upload exige login: o token vai no cabeçalho (sem Content-Type: o FormData define).
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const response = await fetch(`${api}/upload`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        })

        if (!response.ok)
            throw new Error(response.status === 401 ? 'sessão expirada: entre no sistema de novo.' : `falha no envio (${response.status}).`)

        return await response.json()
    } catch (err) {
        return popup({ mensagem: `Erro na API: ${err}` })
    }
}

async function criarLPU(nomeLPU) {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/criar-lpu`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nomeLPU })
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
}

async function sincronizarNotas() {

    overlayAguarde()

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${api}/sincronizar-notas`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    const { mensagem = 'Falha ao sincronizar notas' } = await resposta.json()
    return popup({ mensagem })

}

async function formularioLPU() {

    const linhas = [
        {
            texto: 'Nome da LPU',
            elemento: '<textarea id="nomeLPU"></textarea>'
        }
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarLPU()' }
    ]

    popup({ linhas, botoes })

}

async function salvarLPU() {

    const nomeLPU = document.getElementById('nomeLPU').value.toLowerCase()
    removerPopup()

    if (!nomeLPU)
        return

    const resposta = await criarLPU(`lpu ${nomeLPU}`)

    if (resposta.mensagem)
        return popup({ mensagem: resposta.mensagem })


    popup({ mensagem: 'Criado com sucesso' })

    const { lpus } = await recuperarDado('mvw_lpus', 1) || {}
    LPUS = lpus

}

function validarCpfCnpj(val) {
    if (!val) return false

    // Remove tudo que não for número
    const str = val.replace(/[^\d]/g, '')

    if (str.length === 11) {
        // Validação de CPF
        if (/^(\d)\1{10}$/.test(str)) return false // Bloqueia 000.000.000-00, 111.111...

        let soma = 0
        let resto

        for (let i = 1; i <= 9; i++) soma += parseInt(str.substring(i - 1, i)) * (11 - i)
        resto = (soma * 10) % 11
        if (resto === 10 || resto === 11) resto = 0
        if (resto !== parseInt(str.substring(9, 10))) return false

        soma = 0
        for (let i = 1; i <= 10; i++) soma += parseInt(str.substring(i - 1, i)) * (12 - i)
        resto = (soma * 10) % 11
        if (resto === 10 || resto === 11) resto = 0
        if (resto !== parseInt(str.substring(10, 11))) return false

        return true
    }

    if (str.length === 14) {
        // Validação de CNPJ Numérico (Antigo)
        if (/^(\d)\1{13}$/.test(str)) return false

        let tamanho = str.length - 2
        let numeros = str.substring(0, tamanho)
        let digitos = str.substring(tamanho)
        let soma = 0
        let pos = tamanho - 7

        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--
            if (pos < 2) pos = 9
        }

        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11
        if (resultado !== parseInt(digitos.charAt(0))) return false

        tamanho = tamanho + 1
        numeros = str.substring(0, tamanho)
        soma = 0
        pos = tamanho - 7
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--
            if (pos < 2) pos = 9
        }

        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11
        if (resultado !== parseInt(digitos.charAt(1))) return false

        return true
    }

    return false // Se não tem 11 nem 14 números
}
