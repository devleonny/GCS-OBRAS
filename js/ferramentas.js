const api = 'https://api.gcs.app.br'
const read = 'https://read.gcs.app.br'
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column;`
const logo = 'https://i.imgur.com/Nb8sPs0.png'

const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'INFORMÁTICA', 'LICENÇA', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS', 'FIBRA DE REDE', 'FERRAMENTAS', 'PEÇAS'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}

const tagsClientes = ['', 'FUNCIONÁRIO', 'CLIENTE', 'MOTORISTA', 'TÉCNICO', 'TÉCNICO PARCEIRO', 'FORNECEDOR', 'MATRIZ']
const parcelas = ["--", "15 dias", "20 dias", "21 dias", "30 dias", "35 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]
const empresas = ['IAC', 'AC', 'HNK', 'HNW']
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
let sOverlay = false
let ignorarMenus = false
let controlesCxOpcoes = {}
const styChek = 'style="width: 1.5rem; height: 1.5rem;"'
const usuariosPermitidosParaEditar = ['log', 'editor', 'adm', 'gerente', 'diretoria', 'coordenacao']
let LPUS = null

// Service work para apps no dispositivo;
const emArquivoLocal = location.protocol === 'file:'

if (!emArquivoLocal && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('SW registrado:', reg.scope))
        .catch(err => console.error('Erro ao registrar SW:', err))
}

document.addEventListener('click', verificarClique, true)

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
                    <img src="imagens/concluido.png" onclick="salvarDepartamento(this)" style="display: none;">
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
    limite = 80,
    tamanho = 220,
    espessura = 10,
    rotulo = 'Uso'
} = {}) {
    const valorSeguro = Math.max(0, Math.min(100, Number(valor) || 0));
    const limiteSeguro = Math.max(0, Math.min(100, Number(limite) || 0));

    let situacao = 'normal';

    if (valorSeguro >= limiteSeguro) {
        situacao = 'critico';
    } else if (valorSeguro >= limiteSeguro - 10) {
        situacao = 'alerta';
    }

    const raio = 50 - espessura / 2;
    const comprimentoSemicirculo = Math.PI * raio;
    const deslocamentoProgresso = comprimentoSemicirculo * (1 - valorSeguro / 100);

    return `
    <div
      class="velocimetro velocimetro--${situacao}"
      style="
        --velocimetro-tamanho: ${tamanho}px;
        --velocimetro-espessura: ${espessura};
        --velocimetro-deslocamento: ${deslocamentoProgresso};
        --velocimetro-comprimento: ${comprimentoSemicirculo};
      "
      data-valor="${valorSeguro}"
      data-limite="${limiteSeguro}"
    >
      <div class="velocimetro__area-svg">
        <svg
          class="velocimetro__svg"
          viewBox="0 0 100 60"
          aria-label="${rotulo}: ${valorSeguro}% de 100, limite ${limiteSeguro}%"
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
          <div class="velocimetro__valor">${valorSeguro}%</div>
          <div class="velocimetro__rotulo">${rotulo}</div>
          <div class="velocimetro__limite">Limite: ${limiteSeguro}%</div>
        </div>
      </div>
    </div>
  `;
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

    const formImg = ['jpg', 'jpeg', 'png']
    const regex = /\.([^.]+)$/
    const resultado = nome.match(regex)
    const formato = resultado ? resultado[1] : null

    // Formato imagem;
    if (formImg.includes(formato)) {

        const excluir = funcao
            ? `<img onclick="${funcao}" src="imagens/cancel.png" style="position: absolute; top: 2px; right: 2px; width: 1.5rem;">`
            : ''

        return `
            <div style="position: relative; width: max-content;">
                ${excluir}
                <img
                    class="foto-status"
                    id="${link}"
                    src="${api}/uploads/${link}"
                    onclick="ampliarImagem(this, '${link}')">
            </div>
        `

    } else {

        const nomeFormatado = nome.length > 15
            ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
            : nome;

        const excluir = funcao
            ? `<img src="imagens/cancel.png" style="width: 1.5rem;" onclick="${funcao}">`
            : ''

        return `
            <div class="contorno-anexos" name="${link}">
                <div onclick="abrirArquivo('${link}')" 
                class="contorno-iterno" 
                style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 2px;">
                    <img src="imagens/anexo2.png" style="width: 1.5rem;">
                    <label style="font-size: 0.7rem; cursor: pointer;" title="${nome}">${nomeFormatado}</label>
                    ${excluir}
                </div>
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
    if (valor === '') return 'R$ 0,00';

    valor = Number(valor);
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    mostrarMenus(false)

    acesso = null
    localStorage.removeItem('acesso')
    telaLogin()

}

function mostrarMenus(operacao) {

    if (document.title !== 'GCS')
        return

    if (ignorarMenus)
        return // Quando atualizações forem recebidas;

    const menu = document.querySelector('.side-menu').classList

    if (operacao == 'toggle')
        return menu.toggle('active')

    operacao
        ? menu.add('active')
        : menu.remove('active')
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
    const { colunas, base, retornar, filtros = {}, btnExtras = null } = controle

    const pag = 'cxOpcoes'
    const tabela = await modTab({
        colunas,
        btnExtras,
        pag,
        base,
        ordenar: {
            path: retornar[0],
            direcao: 'ASC'
        },
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

function normalizarPesquisa(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .toLowerCase()
        .trim()
}

function getByPath(obj, path) {
    if (!path) return obj
    return path.split('.').reduce((acc, key) => acc?.[key], obj)
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

    overlayAguarde()

    if (cod == 'null')
        return popup({ mensagem: 'O objeto "base" em controlesCx precisa contem o próprio "id" / "codigo" / "etc"' })

    const { funcaoAdicional, base, retornar } = controlesCxOpcoes[name]

    if (!retornar)
        return popup({ mensagem: `campo retornar: ['exemplo'] → undefined` })

    // Painel quando for forms; do contrário qualquer outro elemento;
    const painel = Array.from(document.querySelectorAll('.painel-padrao')).at(-1)
    const elemento = (painel || document).querySelector(`[name='${name}']`)
    const termos = []

    const dado = typeof base === 'string'
        ? await recuperarDado(base, cod)
        : base.find(item =>
            String(item.id ?? item.codigo ?? item.usuario) === String(cod)
        )

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
    if (!id || !htmlPdf) return

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
                    @page { size: 297mm 297mm }
                    html, body { margin: 0; padding: 0; }
                    body { font-family: 'Poppins', sans-serif; background: white; }
                    .topo-tabela * { visibility: hidden; }
                    .div-tabela { max-height: max-content; }
                    .tabela thead tr:nth-child(2) { display: none; }
                </style>
            </head>
            <body>${htmlPdf.outerHTML}</body>
        </html>`

    try {
        const response = await fetch(`${api}/pdf-vers2`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html })
        })

        if (!response.ok) {
            let msg = 'Falha ao baixar PDF'
            try {
                const text = await response.text()
                const j = JSON.parse(text)
                msg = j?.mensagem || j?.error || text || msg
            } catch { }
            popup({ mensagem: msg })
            removerOverlay()
            return
        }

        const blob = await response.blob()
        const url = URL.createObjectURL(blob)

        const a = document.createElement('a')
        a.href = url
        a.download = `${nome}.pdf`
        a.click()

        URL.revokeObjectURL(url)
        removerOverlay()

    } catch (err) {
        removerOverlay()
        popup({ mensagem: err?.message || 'Falha ao gerar PDF' })
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

async function buscarLPUs() {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${read}/lpus`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Erro ao contar por campo')
    }

    return await resposta.json()
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

    await recuperarLPUS()
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


async function emMassa() {


    const notas = [
        { cnpj: '11.137.051/0683-09', nota: '12399' },
        { cnpj: '11.137.051/0817-55', nota: '12400' },
        { cnpj: '11.137.051/0821-31', nota: '12401' },
        { cnpj: '11.137.051/0069-74', nota: '12420' },
        { cnpj: '11.137.051/0151-08', nota: '12408' },
        { cnpj: '11.137.051/0826-46', nota: '12402' },
        { cnpj: '11.137.051/0827-27', nota: '12403' },
        { cnpj: '11.137.051/0834-56', nota: '12404' },
        { cnpj: '11.137.051/0089-18', nota: '12421' },
        { cnpj: '11.137.051/0840-02', nota: '12405' },
        { cnpj: '11.137.051/0101-49', nota: '12422' },
        { cnpj: '11.137.051/0260-61', nota: '12423' },
        { cnpj: '11.137.051/0307-60', nota: '12424' },
        { cnpj: '11.137.051/0154-50', nota: '12409' },
        { cnpj: '11.137.051/0257-66', nota: '12410' },
        { cnpj: '11.137.051/0258-47', nota: '12411' },
        { cnpj: '11.137.051/0259-28', nota: '12412' },
        { cnpj: '11.137.051/0262-23', nota: '12413' },
        { cnpj: '11.137.051/0678-41', nota: '12425' },
        { cnpj: '11.137.051/0334-32', nota: '12414' },
        { cnpj: '11.137.051/0847-70', nota: '12406' },
        { cnpj: '11.137.051/0938-42', nota: '12407' },
        { cnpj: '11.137.051/0014-09', nota: '12365' },
        { cnpj: '11.137.051/0728-45', nota: '12426' },
        { cnpj: '11.137.051/0668-70', nota: '12441' },
        { cnpj: '11.137.051/0969-49', nota: '12415' },
        { cnpj: '11.137.051/0023-91', nota: '12366' },
        { cnpj: '11.137.051/0079-46', nota: '12373' },
        { cnpj: '11.137.051/0556-73', nota: '12389' },
        { cnpj: '11.137.051/0578-89', nota: '12390' },
        { cnpj: '11.137.051/0584-27', nota: '12391' },
        { cnpj: '11.137.051/0670-94', nota: '12442' },
        { cnpj: '11.137.051/0673-37', nota: '12443' },
        { cnpj: '11.137.051/0677-60', nota: '12444' },
        { cnpj: '11.137.051/0768-32', nota: '12445' },
        { cnpj: '11.137.051/0778-04', nota: '12446' },
        { cnpj: '11.137.051/0780-29', nota: '12447' },
        { cnpj: '11.137.051/0326-22', nota: '12448' },
        { cnpj: '11.137.051/0370-04', nota: '12449' },
        { cnpj: '11.137.051/0378-53', nota: '12450' },
        { cnpj: '11.137.051/0053-07', nota: '12416' },
        { cnpj: '11.137.051/0473-01', nota: '12417' },
        { cnpj: '11.137.051/0602-43', nota: '12392' },
        { cnpj: '11.137.051/0603-24', nota: '12393' },
        { cnpj: '11.137.051/0605-96', nota: '12394' },
        { cnpj: '11.137.051/0606-77', nota: '12395' },
        { cnpj: '11.137.051/0609-10', nota: '12396' },
        { cnpj: '11.137.051/0285-10', nota: '12372' },
        { cnpj: '11.137.051/0286-09', nota: '12374' },
        { cnpj: '11.137.051/0287-81', nota: '12375' },
        { cnpj: '11.137.051/0339-47', nota: '12376' },
        { cnpj: '11.137.051/0340-80', nota: '12333' },
        { cnpj: '11.137.051/0341-61', nota: '12378' },
        { cnpj: '11.137.051/0422-61', nota: '12451' },
        { cnpj: '11.137.051/0426-95', nota: '12452' },
        { cnpj: '11.137.051/0427-76', nota: '12453' },
        { cnpj: '11.137.051/0433-14', nota: '12454' },
        { cnpj: '11.137.051/0455-20', nota: '12455' },
        { cnpj: '11.137.051/0459-53', nota: '12466' },
        { cnpj: '11.137.051/0737-36', nota: '12427' },
        { cnpj: '11.137.051/0344-04', nota: '12384' },
        { cnpj: '11.137.051/0347-57', nota: '12385' },
        { cnpj: '11.137.051/0462-59', nota: '12456' },
        { cnpj: '11.137.051/0626-10', nota: '12457' },
        { cnpj: '11.137.051/0755-18', nota: '12428' },
        { cnpj: '11.137.051/0763-28', nota: '12429' },
        { cnpj: '93.866.739/0006-76', nota: '12430' },
        { cnpj: '93.866.739/0007-57', nota: '12431' },
        { cnpj: '11.137.051/0629-63', nota: '12458' },
        { cnpj: '11.137.051/0701-25', nota: '12459' },
        { cnpj: '11.137.051/0713-69', nota: '12460' },
        { cnpj: '11.137.051/0482-00', nota: '12418' },
        { cnpj: '11.137.051/0511-71', nota: '12386' },
        { cnpj: '11.137.051/0516-86', nota: '12387' },
        { cnpj: '11.137.051/0543-59', nota: '12388' },
        { cnpj: '11.137.051/0692-08', nota: '12397' },
        { cnpj: '11.137.051/0010-77', nota: '12364' },
        { cnpj: '11.137.051/0059-00', nota: '12367' },
        { cnpj: '11.137.051/0061-17', nota: '12370' },
        { cnpj: '11.137.051/0064-60', nota: '12371' },
        { cnpj: '11.137.051/0927-90', nota: '12398' },
        { cnpj: '11.137.051/0790-09', nota: '12419' },
        { cnpj: '11.137.051/1006-44', nota: '12461' },
        { cnpj: '11.137.051/1011-01', nota: '12462' },
        { cnpj: '11.137.051/1012-92', nota: '12463' },
        { cnpj: '11.137.051/1015-35', nota: '12464' },
        { cnpj: '11.137.051/1016-16', nota: '12465' },
        { cnpj: '93.866.739/0019-90', nota: '12432' },
        { cnpj: '93.866.739/0025-39', nota: '12433' },
        { cnpj: '11.137.051/0039-59', nota: '12434' },
        { cnpj: '11.137.051/0099-90', nota: '12435' }
    ]

    for (const { cnpj, nota } of notas) {

        const pesquisa = await pesquisarDB({
            base: 'dados_orcamentos',
            filtros: {
                'snapshots.tags.*.nome': { op: '=', value: '91 LOJAS' },
                'snapshots.cnpj': { op: '=', value: cnpj }
            }
        })

        if (!pesquisa.resultados.length) {
            console.log(`não localizado ${cnpj}`)
            continue
        }

        const { contrato } = pesquisa.resultados[0].dados_orcam

        const pesquisa2 = await pesquisarDB({
            base: 'notas',
            filtros: {
                'n_nota': { op: 'includes', value: nota }
            }
        })

        const id = pesquisa2.resultados[0].id

        await enviar(`notas/${id}/departamento`, [contrato])

    }

}