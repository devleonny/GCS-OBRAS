const api = `https://api.gcs.app.br`
const tela = document.querySelector('.tela')
const menus = document.querySelector('.side-menu')
let origem = 'novos'
let telaAtiva = null
let funcaoAtiva = null
let funcaoTela = null
let acesso = null
let dados_setores = {}
let filtrosUsuarios = {}
let filtrosPendencias = {}
const paginasBloqueadas = ['PDF', 'OS']
const horizontal = `display: flex; align-items: center; justify-content: center;`
const vertical = `display: flex; align-items: start; justify-content: start; flex-direction: column;`
let overlayTimeout;
let semOverlay = false
let dados_clientes = {}
let dados_orcamentos = {}

const styChek = 'style="width: 1.5rem; height: 1.5rem;"'
const botaoRodape = (funcao, texto, img) => `
        <div class="botoesRodape" onclick="${funcao}">
            <img src="imagens/${img}.png">
            <span>${texto}</span>
        </div>
    `
const modelo = (valor1, valor2) => `
        <div class="modelo">
            <label>${valor1}</label>
            <div style="width: 100%; text-align: left;">${valor2}</div>
        </div>
        `

const labelDestaque = (valor1, valor2) => `
    <div style="${vertical}">
        <div><strong>${valor1}:</strong></div>
        <div style="text-align: left;">${valor2}</div>
    </div>
`

const botao = (valor1, funcao, cor) => `
        <div class="contorno-botoes" style="background-color: ${cor}e3; border: solid 1px ${cor};" onclick="${funcao}">
            <label style="white-space: nowrap;">${valor1}</label>
        </div>
        `
const avisoHTML = (termo) => `
    <div style="display: flex; gap: 10px; align-items: center; justify-content: center; padding: 2vw;">
        <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
        <label>${termo}</label>
    </div>
    `
const mensagem = (mensagem, img) => `
    <div style="background-color: #d2d2d2; display: flex; gap: 10px; padding: 2vw; align-items: center; justify-content: center;">
        <img src="${img ? img : `gifs/alerta.gif`}" style="width: 3rem;">
        <label>${mensagem}</label>
    </div>
    `
const balaoPDF = (nf, info, codOmie, tipo, app) => {
    return `
    <div class="balaoNF" onclick="abrirDANFE('${codOmie}', '${tipo}', '${app}')">
        <div class="balao1">
            <label>${nf}</label>
            <label><b>${info}</b></label>
        </div>
        <div class="balao2">
            PDF
        </div>
    </div>
    `
}

const modeloBotoes = (imagem, nome, funcao) => {
    return `
        <div class="atalhos" style="width: 100%;" onclick="${funcao}">
            <img src="imagens/${imagem}.png">
            <label style="cursor: pointer;">${nome}</label>
        </div>
    `
}

const layoutBotao = (nome, funcao, img) => `
    <div onclick="${funcao}" class="botoesRodape">
        <img src="imagens/${img}.png" style="cursor: pointer; width: 2vw;">
        <label>${nome}</label>
    </div>
`

const nomeBaseCentral = 'GCS'
const nomeStore = 'Bases'

const logo = 'https://i.imgur.com/Nb8sPs0.png'
const esquemas = {
    'sistema': ['', 'ALARME', 'CFTV', 'EAS', 'INFORMÁTICA', 'LICENÇA', 'CONTROLE DE ACESSO', 'INFRAESTRUTURA E CABEAMENTO', 'CUSTOS INDIRETOS', 'FIBRA DE REDE'],
    'categoria de equipamento': ['', 'IP', 'ANALÓGICO', 'ALARME', 'CONTROLE DE ACESSO'],
    'tipo': ['VENDA', 'SERVIÇO', 'USO E CONSUMO']
}

function mostrarMenus(operacao) {
    if (document.title !== 'GCS') return
    const menu = document.querySelector('.side-menu').classList
    if (operacao == 'toggle') return menu.toggle('active')
    operacao ? menu.add('active') : menu.remove('active')
}

function verificarClique(event) {
    const menu = document.querySelector('.side-menu');
    if (menu && menu.classList.contains('active') && !menu.contains(event.target)) menu.classList.remove('active')
}

function criarAtalhoMenu({ nome, img, funcao }) {
    const atalho = `
    <div class="btnLateral" onclick="executar('${funcao}')">
        <img src="imagens/${img}.png">
        <div>${nome}</div>
    </div>
    `
    return atalho
}

async function executar(nomeFuncao) {

    if (!nomeFuncao) return

    // É a função que carrega a tela atual;
    if (nomeFuncao.includes('tela')) funcaoTela = nomeFuncao

    funcaoAtiva = nomeFuncao

    if (typeof window[nomeFuncao] === "function") {
        return await window[nomeFuncao]()
    } else {
        popup(mensagem(`<b>Função não encontrada:</b> ${nomeFuncao}`), 'Alerta', true)
    }
}

function criarMenus(chave) {
    telaAtiva = chave
    const chaves = ['orcamentos', 'composicoes', 'pda', 'telaCriarOrcamento', 'telaCriarOrcamentosAluguel']
    interruptorCliente(chaves.includes(chave), true)

    const atalhos = esquemaBotoes[chave]
    let atalhosString = `
        <div class="nomeUsuario">
            <span><strong>${inicialMaiuscula(acesso.permissao)}</strong> ${acesso.usuario}</span>
        </div>
    `

    for (const atalho of atalhos) atalhosString += criarAtalhoMenu(atalho)

    menus.innerHTML = atalhosString
}

const esquemaBotoes = {
    inicial: [
        { nome: 'Orçamentos', funcao: `telaOrcamentos`, img: 'projeto' },
        { nome: 'Composições', funcao: `telaComposicoes`, img: 'composicoes' },
        { nome: 'Chamados', funcao: `telaChamados`, img: 'chamados' },
        { nome: 'Veículos', funcao: `telaVeiculos`, img: 'veiculo' },
        { nome: 'Reembolsos', funcao: `telaPagamentos`, img: 'reembolso' },
        { nome: 'Estoque', funcao: `telaEstoque`, img: 'estoque' },
        { nome: 'Faturamento NFs', funcao: `telaRelatorio`, img: 'relatorio' },
        { nome: 'RH', funcao: `telaRH`, img: 'gerente' },
        { nome: 'Ocorrências', funcao: `redirecionarChamados`, img: 'LG' },
        { nome: 'Desconectar', funcao: `deslogarUsuario`, img: 'sair' }
    ],
    pda: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarOrcamentos', img: 'atualizar3' },
        { nome: 'Layout Tradicional', funcao: 'telaOrcamentos', img: 'trocar' },
        { nome: 'Criar Orçamento', funcao: 'telaCriarOrcamento', img: 'projeto' },
        { nome: 'Orçamento de Aluguel', funcao: 'telaCriarOrcamentoAluguel', img: 'projeto' },
    ],
    criarOrcamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosOrcamento`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamento`, img: 'remover' },
        { nome: 'Voltar', funcao: `telaOrcamentos`, img: 'voltar_2' }
    ],
    criarOrcamentosAluguel: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Dados Cliente', funcao: `painelClientes`, img: 'gerente' },
        { nome: 'Salvar Orçamento', funcao: `enviarDadosAluguel`, img: 'salvo' },
        { nome: 'Apagar Orçamento', funcao: `apagarOrcamentoAluguel`, img: 'remover' },
        { nome: 'Voltar', funcao: `telaOrcamentos`, img: 'voltar_2' }
    ],
    orcamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarOrcamentos', img: 'atualizar3' },
        { nome: 'Baixar em Excel', funcao: 'excelOrcamentos', img: 'excel' },
        { nome: 'Criar Orçamento', funcao: 'telaCriarOrcamento', img: 'projeto' },
        { nome: 'Orçamento de Aluguel', funcao: 'telaCriarOrcamentoAluguel', img: 'projeto' },
        { nome: 'Orçamentos Aquivados', funcao: 'filtrarArquivados', img: 'desarquivar' },
        { nome: 'Meus Orçamentos', funcao: 'filtrarMeus', img: 'painelcustos' },
        { nome: 'Layout PDA', funcao: `telaPDA`, img: 'planilha' }
    ],
    composicoes: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarComposicoes', img: 'atualizar3' },
        { nome: 'Cadastrar Item', funcao: 'cadastrarItem', img: 'baixar' },
        { nome: 'Baixar em Excel', funcao: 'exportarParaExcel', img: 'excel' },
        { nome: 'Filtrar Campos', funcao: 'abrirFiltros', img: 'pesquisar2' }
    ],
    chamados: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarManutencoes', img: 'atualizar3' },
        { nome: 'Criar Manutenção', funcao: 'criarManutencao', img: 'chamados' }
    ],
    veiculos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarDadosVeiculos', img: 'atualizar3' },
        { nome: 'Adicionar Combustível', funcao: 'painelValores', img: 'combustivel' },
        { nome: 'Novo Motorista', funcao: 'novoMotorista', img: 'motorista' },
        { nome: 'Novo Veículo', funcao: 'novoVeiculo', img: 'veiculo' },
    ],
    pagamentos: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'recuperarPagamentos', img: 'atualizar3' },
        { nome: 'Solicitar Pagamento', funcao: 'criarPagamento', img: 'pagamento' }
    ],
    estoque: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarEstoque', img: 'atualizar3' },
        { nome: 'Cadastrar Item', funcao: 'incluirItemEstoque', img: 'baixar' },
        { nome: 'Relatório de Movimentos', funcao: 'relatorioMovimento', img: 'projeto' },
        { nome: 'Baixar em Excel', funcao: `exportarParaExcel`, img: 'excel' },
    ],
    relatorio: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarRelatorio', img: 'atualizar3' },
        { nome: 'Baixar em Excel', funcao: 'excelRecebimento', img: 'excel' },
        { nome: 'Limpar Filtros', funcao: 'limparFiltros', img: 'limpar' },
    ],
    rh: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'telaRH', img: 'atualizar3' },
        { nome: 'Tabela', funcao: 'telaRHTabela', img: 'todos' },
        { nome: 'Baixar em Excel', funcao: 'rhExcel', img: 'excel' },
        { nome: 'Adicionar Local', funcao: 'adicionarPessoa', img: 'baixar' }
    ],
    agenda: [
        { nome: 'Menu Inicial', funcao: 'telaInicial', img: 'LG' },
        { nome: 'Atualizar', funcao: 'atualizarAgenda', img: 'atualizar3' },
        { nome: 'Distribuição por Funcionário', funcao: 'distribuicaoFuncionario', img: 'gerente' },
        { nome: 'Novo Funcionário', funcao: 'abrirOpcoes', img: 'baixar' },
    ]
}

const link = document.createElement('link');
link.rel = 'icon';
link.type = 'imagens/png';
link.href = 'imagens/LG.png';
document.head.appendChild(link);

identificacaoUser()

async function despoluicaoGCS() {

    overlayAguarde(true)

    const divMensagem = document.querySelector('.div-mensagem')

    divMensagem.innerHTML = `
        <div style="${vertical}; gap: 1vh;">
            <label>GCS: Por favor, aguarde...</label>
            <br>
            
            <div id="logs" style="${vertical}; gap: 1vh;"></div>
        </div>
    `

    const logs = document.getElementById('logs')

    logs.insertAdjacentHTML('beforeend', '<label>Criando uma nova Base, 0km, novíssima...</label>')

    const bases = [
        'tags',
        'tags_orcamentos',
        'departamentos_fixos',
        'dados_orcamentos',
        'custo_veiculos',
        'motoristas',
        'veiculos',
        'dados_composicoes',
        'dados_clientes',
        'lista_pagamentos',
        'dados_manutencao',
        'dados_categorias',
        'dados_estoque',
        'pessoas'
    ]

    for (const base of bases) {
        await sincronizarDados(base, true, true) // Nome base, overlay off e resetar bases;
        logs.insertAdjacentHTML('beforeend', `<label>Sincronizando: ${base}</label>`)
    }

    await criarBaseCC()

    localStorage.setItem('atualizado', true)
    telaInicial()
    removerOverlay()

}

document.addEventListener('keydown', function (event) {
    if (event.key === 'F2') f2()
    if (event.key === 'F8') despoluicaoGCS()
    if (event.key === 'F5') location.reload()
})

async function f2() {

    const acumulado = `
        <div style="padding: 2vw; background-color: #d2d2d2; display: flex; flex-direction: column; justify-content: start; align-items: start; gap: 5px;">

            ${botao('Sincronizar Clientes', `respostaSincronizacao('clientes')`)}

            ${botao('Sincronizar Categorias', `respostaSincronizacao('categorias')`)}

            ${botao('Sincronizar Departamentos', `respostaSincronizacao('departamentos')`)}

            ${botao('Sincronizar Pagamentos', `respostaSincronizacao('pagamentos')`)}

            <div id="localResposta"></div>

            <hr style="width: 100%;">
            <label style="cursor: pointer;">${new Date().getTime()}</label>
        </div>
    `
    popup(acumulado, 'Ferramentas', true)
}

async function respostaSincronizacao(script) {

    let localResposta = document.getElementById('localResposta')

    localResposta.innerHTML = `<img src="gifs/loading.gif" style="width: 3vw;">`

    const resposta = await sincronizar(script)

    localResposta.innerHTML = resposta.status

}

function redirecionarChamados() {
    localStorage.setItem('app', '')
    window.location.href = 'chamados/index.html'
}

function retornar() {
    window.location.href = 'chamados/index.html'
}

async function identificacaoUser() {

    if (document.title !== 'GCS') return

    acesso = JSON.parse(localStorage.getItem('acesso'))

    if (document.title == 'Política de Privacidade') return
    if (!acesso) return retornar()

    const toolbar = `
        <div class="toolbar-top">
            <div style="${horizontal}; gap: 0.5rem;">
                <span class="menu" onclick="mostrarMenus('toggle')">☰</span>
                <span name="titulo"></span>
            </div>
            <div class="interruptor"></div>
            <div class="baloes-top"></div>
        </div>
    `

    document.body.insertAdjacentHTML('beforeend', toolbar)

    await sincronizarDados('dados_setores', null, true)
    dados_setores = await recuperarDados('dados_setores')
    acesso = dados_setores[acesso.usuario]

    if (!acesso || !acesso.permissao || acesso.permissao == 'novo') {
        localStorage.removeItem('acesso')
        return retornar()
    }

    if (acesso.permissao == 'visitante') return redirecionarChamados()

    telaInicial()

    localStorage.setItem('acesso', JSON.stringify(acesso))

    verificarPendencias() // Pendencias de aprovação;

    const modelo = (imagem, funcao, idElemento) => {
        return `
        <div onclick="${funcao}" style="${vertical};">
            <img src="imagens/${imagem}.png">
            <div id="${idElemento}" style="display: none;" class="labelQuantidade"></div>
        </div>
        `
    }

    const permitidosAprovacoes = ['adm', 'diretoria']
    const permitidosProdutos = ['adm', 'log', 'diretoria']
    const toolbarTop = document.querySelector('.toolbar-top')

    if (!paginasBloqueadas.includes(document.title) && acesso.usuario) {

        const barraStatus = `
            <div class="cabecalhoUsuario">
                <div id="divUsuarios"></div>

                ${modelo('projeto', 'verAprovacoes()', 'contadorPendencias')}
                ${permitidosAprovacoes.includes(acesso.permissao) ? modelo('construcao', 'configs()', '') : ''}
                ${permitidosProdutos.includes(acesso.permissao) ? modelo('preco', 'precosDesatualizados()', 'contadorProdutos') : ''}

                <img title="Abrir mais 1 aba" src="imagens/aba.png" onclick="maisAba()">

            </div>
        `
        const cabecalhoUsuario = document.querySelector('.cabecalhoUsuario')
        if (cabecalhoUsuario) return cabecalhoUsuario.innerHTML = barraStatus
        toolbarTop.insertAdjacentHTML('beforeend', barraStatus)
    }

    usuariosToolbar()
    precosDesatualizados(true) //Atualiza apenas a quantidade;

}

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function mudarStatus(select) {

    const st = select.value

    const img = document.querySelector('[name="imgStatus"]')

    img.src = `imagens/${st}.png`

    alterarUsuario({ campo: 'status', valor: st, usuario: acesso.usuario })

}

function balaoUsuario(st, texto) {

    if (document.title == 'PDF') return

    let msg = document.querySelector('.popup-mensagem')
    if (msg) msg.remove()

    const mensagemPop = `
        <div class="popup-mensagem">
            <img src="imagens/${st}.png">
            <span>${st}</span>
            <span>${texto}</span>
        </div>
    `
    document.body.insertAdjacentHTML('beforeend', mensagemPop)

    msg = document.querySelector('.popup-mensagem')

    requestAnimationFrame(() => {
        msg.style.opacity = '1'
        msg.style.transform = 'translateY(0)'
    })

    setTimeout(() => {
        msg.style.opacity = '0'
        msg.style.transform = 'translateY(20px)'
        setTimeout(() => msg.remove(), 400)
    }, 5000)
}

async function usuariosToolbar() {

    const user = await recuperarDado('dados_setores', acesso.usuario)
    const dadosSetores = await recuperarDados('dados_setores') || {}

    // Conta quantos usuários estão online (status !== 'offline')
    const usuariosOnline = Object.values(dadosSetores)
        .filter(u => u.status && u.status !== 'offline')
        .length

    const indicadorStatus = user?.status || 'offline'
    const statusOpcoes = ['online', 'Em almoço', 'Não perturbe', 'Em reunião', 'Apenas Whatsapp']
    if (user?.permissao == 'adm') statusOpcoes.push('Invisível')

    const usuariosToolbarString = `
        <div class="botaoUsuarios">
            <img name="imgStatus" onclick="painelUsuarios()" src="imagens/${indicadorStatus}.png">
            <select onchange="mudarStatus(this)">
                ${statusOpcoes.map(op => `<option ${indicadorStatus == op ? 'selected' : ''}>${op}</option>`).join('')}
            </select>
            <label style="font-size: 1.2rem;">${usuariosOnline}</label>
        </div>
    `

    const divUsuarios = document.getElementById('divUsuarios')
    if (divUsuarios) divUsuarios.innerHTML = usuariosToolbarString

    const divOnline = document.querySelector('.divOnline')
    if (divOnline) painelUsuarios()
}

async function configs() {

    overlayAguarde()

    await sincronizarDados('dados_setores')
    dados_setores = await recuperarDados('dados_setores')

    let linhas = ''
    const listas = {
        permissoes: ['', 'adm', 'user', 'visitante', 'analista', 'gerente', 'coordenacao', 'diretoria', 'editor', 'log', 'qualidade', 'novo'],
        setores: ['', 'INFRA', 'LOGÍSTICA', 'FINANCEIRO', 'RH', 'CHAMADOS', 'SUPORTE']
    }

    dados_setores = Object.keys(dados_setores)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .reduce((obj, chave) => {
            obj[chave] = dados_setores[chave];
            return obj;
        }, {});

    const tdPreenchida = (coluna, opcoes, usuario) => `
        <td>
            <select class="opcoesSelect" onchange="alterarUsuario({campo: '${coluna}', usuario: '${usuario}', select: this})" style="cursor: pointer;">${opcoes}</select>
        </td>
    `

    for (const [usuario, dados] of Object.entries(dados_setores)) {

        const opcoesPermissao = listas.permissoes
            .map(permissao => `<option value="${permissao}" ${dados?.permissao == permissao ? 'selected' : ''}>${permissao}</option>`).join('')

        const opcoesSetores = listas.setores
            .map(setor => `<option value="${setor}" ${dados?.setor == setor ? 'selected' : ''}>${setor}</option>`).join('')

        linhas += `
        <tr>
            <td style="text-align: left;">${usuario}</td>
            ${tdPreenchida('permissao', opcoesPermissao, usuario)}
            ${tdPreenchida('setor', opcoesSetores, usuario)}
            <td><input onchange="alterarUsuario({campo: 'vendedor', usuario: '${usuario}', valor: this.checked})" type="checkbox" ${dados?.vendedor ? 'checked' : ''}></td>
        </tr>
        `
    }

    let ths = ''
    let tbusca = ''
    let cabecalhos = ['Usuário', 'Permissão', 'Setores', 'Vendedor']
    cabecalhos.forEach((cabecalho, i) => {
        ths += `<th>${cabecalho}</th>`
        tbusca += `<th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, filtrosUsuarios, 'tbodyUsuarios')"></th>`
    })

    const tabela = `
        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <tr>${ths}</tr>
                        <tr>${tbusca}</tr>
                    </thead>
                    <tbody id="tbodyUsuarios">${linhas}</tbody>
                </table>
                </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 0.5rem;">
            <label style="font-size: 1.2rem;">Gestão de Usuários</label>
            <hr style="width: 100%;">
            ${tabela}
        </div>
    `
    removerPopup()
    popup(acumulado, 'Configurações')

}

async function alterarUsuario({ campo, usuario, select, valor }) {

    valor = select ? select.value : valor

    const alteracao = await configuracoes(usuario, campo, valor) // Se alterar no servidor, altera localmente;

    if (alteracao?.status) {
        dados_setores[usuario][campo] = select ? select.value : valor
    } else {
        popup(mensagem(`Não foi possível alterar: ${alteracao?.erro || 'Tente novamente mais tarde'}`), 'ALERTA', true)
        if (select) select.value = dados_setores[usuario][campo] // Devolve a informação anterior pro elemento;
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
        link = `${api}/uploads/GCS/${link}`
    } else { // Antigo Google;
        link = `https://drive.google.com/file/d/${link}/view?usp=drivesdk`
    }

    try {
        shell.openExternal(link);
    } catch {
        window.open(link, '_blank');
    }
}

function deslogarUsuario() {
    popup(`
        <div style="background-color: #d2d2d2; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 2vw;">
            <label>Deseja Sair?</label>
            <button onclick="sair()">Sim</button>
        </div>
        `, 'Tem certeza?')
}

function sair() {
    removerPopup()
    const toolbar = document.querySelector('.toolbar-top')
    if (toolbar) toolbar.remove()
    mostrarMenus(false)

    localStorage.removeItem('acesso')
    retornar()
}

function inicialMaiuscula(string) {
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

function overlayAguarde(semMSG) {

    if (semOverlay) return

    mostrarMenus(false)

    const aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()

    const elemento = `
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
                    z-index: 10005;">
                <div class="div-mensagem">
                    <img src="gifs/loading.gif" style="width: 4rem;">
                    ${semMSG ? '' : `<label>Por favor, aguarde...</label>`}
                </div>
        </div>`

    document.body.insertAdjacentHTML('beforeend', elemento)

    let pageHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
    );

    document.getElementById('aguarde').style.height = `${pageHeight}px`;

    if (semMSG) return

    if (overlayTimeout) clearTimeout(overlayTimeout);

    overlayTimeout = setTimeout(() => {
        const mensagem = document.querySelector('.div-mensagem');
        if (mensagem) {
            mensagem.innerHTML = `
                <img src="gifs/atencao.gif" style="width: 2vw;">
                <label onclick="this.parentElement.parentElement.remove()">Cancelar?</label>
            `
        }
    }, 60 * 1000);
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

async function deletarDB(base, idInterno) {

    const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(nomeBaseCentral);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });

    if (!db.objectStoreNames.contains(nomeStore)) {
        db.close();
        return;
    }

    const tx = db.transaction(nomeStore, 'readwrite');
    const store = tx.objectStore(nomeStore);

    // Pega o objeto inteiro da base
    const registro = await new Promise((resolve, reject) => {
        const req = store.get(base);
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });

    if (registro && registro.dados && registro.dados[idInterno]) {
        delete registro.dados[idInterno]; // remove o item interno

        // Salva de volta com o mesmo id
        await new Promise((resolve, reject) => {
            const putReq = store.put(registro);
            putReq.onsuccess = resolve;
            putReq.onerror = (e) => reject(e.target.error);
        });
    }

    await new Promise((resolve) => {
        tx.oncomplete = resolve;
    });

    db.close();
}

async function inserirDados(dados, nomeBase, resetar) {

    const versao = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral);
        req.onsuccess = () => {
            const db = req.result;
            const precisaCriar = !db.objectStoreNames.contains(nomeStore);
            const versaoAtual = db.version;
            db.close();
            resolve(precisaCriar ? versaoAtual + 1 : versaoAtual);
        };
        req.onerror = (e) => reject(e.target.error);
    });

    const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(nomeBaseCentral, versao);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(nomeStore)) {
                db.createObjectStore(nomeStore, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = (e) => reject(e.target.error);
    });

    const tx = db.transaction(nomeStore, 'readwrite');
    const store = tx.objectStore(nomeStore);

    let dadosMesclados = {}

    if (!resetar) {

        const antigo = await new Promise((resolve, reject) => {
            const req = store.get(nomeBase);
            req.onsuccess = () => resolve(req.result?.dados || {});
            req.onerror = (e) => reject(e.target.error);
        });

        dadosMesclados = { ...antigo, ...dados };

    } else {
        dadosMesclados = dados
    }

    for (let [id, objeto] of Object.entries(dadosMesclados)) {
        if (objeto.excluido) {
            const trExistente = document.getElementById(id)
            if (trExistente) trExistente.remove()
            delete dadosMesclados[id]
        }
    }

    await store.put({ id: nomeBase, dados: dadosMesclados });

    await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
    });

    db.close();
}

async function recuperarDados(nomeBase) {

    const getDadosPorBase = async (base) => {
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(nomeBaseCentral);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });

        if (!db.objectStoreNames.contains(nomeStore)) {
            return {};
        }

        const tx = db.transaction(nomeStore, 'readonly');
        const store = tx.objectStore(nomeStore);

        const item = await new Promise((resolve, reject) => {
            const req = store.get(base);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        db.close();

        return item?.dados || {};
    };

    return await getDadosPorBase(nomeBase);
}

async function recuperarDado(nomeBase, id) {
    const abrirDB = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(nomeBaseCentral);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    };

    const buscar = async (db, base, id) => {
        if (!db.objectStoreNames.contains(nomeStore)) return null;

        const tx = db.transaction(nomeStore, 'readonly');
        const store = tx.objectStore(nomeStore);

        const registro = await new Promise((resolve, reject) => {
            const req = store.get(base);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });

        return registro?.dados?.[id] || null;
    };

    const db = await abrirDB();
    let resultado = await buscar(db, nomeBase, id);

    db.close();
    return resultado;
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

    </div>`

    removerPopup(nao_remover_anteriores)
    removerOverlay()
    document.body.insertAdjacentHTML('beforeend', popup_v2);

}

function criarAnexoVisual(nome, link, funcao) {

    let displayExcluir = 'flex'

    if (!funcao) displayExcluir = 'none'

    // Formata o nome para exibição curta
    const nomeFormatado = nome.length > 15
        ? `${nome.slice(0, 6)}...${nome.slice(-6)}`
        : nome;

    return `
        <div class="contornoAnexos" name="${link}">
            <div onclick="abrirArquivo('${link}')" class="contorno_interno" style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 2px;">
                <img src="imagens/anexo2.png">
                <label style="font-size: 0.7rem; cursor: pointer;" title="${nome}">${nomeFormatado}</label>
            </div>
            <img src="imagens/cancel.png" style="display: ${displayExcluir}; width: 1.5vw; cursor: pointer;" onclick="${funcao}">
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

async function exportarParaExcel() {
    try {
        overlayAguarde();

        const idTabela = telaAtiva == 'estoque' ? 'tabela_estoque' : 'tabela_composicoes'

        if (typeof ExcelJS === 'undefined') {
            throw new Error('Biblioteca ExcelJS não está carregada');
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dados');

        const tabela = document.getElementById(idTabela);
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
                    const select = td.querySelector('select');

                    if (input) {
                        rowData.push(input.value);
                    } else if (select) {
                        rowData.push(select.value);
                    } else {
                        rowData.push(td.textContent.trim());
                    }
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
        link.download = `${telaAtiva}_${data}.xlsx`;
        link.click();
        window.URL.revokeObjectURL(url);

        removerOverlay();
    } catch (erro) {
        console.error("Erro ao exportar:", erro);
        removerOverlay();
        popup(mensagem(erro), 'Alerta', true);
    }
}

async function removerPopup(naoRemoverAnteriores) {

    const popUps = document.querySelectorAll('#temp_pop')

    if (naoRemoverAnteriores) return

    if (popUps.length > 1) {
        popUps[popUps.length - 1].remove()

    } else {
        popUps.forEach(pop => {
            pop.remove()
        })
    }

    const aguarde = document.getElementById('aguarde')
    if (aguarde) aguarde.remove()

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

function maisAba() {
    window.open(window.location.href, '_blank', 'toolbar=no, menubar=no');
}

async function ir_pdf(orcam_) {

    dados_orcamentos = await recuperarDados('dados_orcamentos') || {};
    localStorage.setItem('pdf', JSON.stringify(dados_orcamentos[orcam_]));

    window.open('pdf.html', '_blank')

}

async function recuperarClientes() {

    await sincronizarDados('dados_clientes')

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

async function continuar() {
    if (telaAtiva == 'composicoes') {
        await telaComposicoes()

    } else if (telaAtiva == 'telaCriarOrcamentos') {
        await tabelaProdutosOrcamentos()
        await totalOrcamento()

    } else if (telaAtiva == 'telaCriarOrcamentoAluguel') {
        await criarOrcamentoAluguel()

    }
}

function pesquisarGenerico(coluna, texto, filtro, id) {
    filtro[coluna] = String(texto).toLowerCase().replace('.', '').trim();

    let tbody = document.getElementById(id);
    let trs = tbody.querySelectorAll('tr');
    let contador = 0;

    trs.forEach(function (tr) {
        let tds = tr.querySelectorAll('td');
        let mostrarLinha = true;

        for (var col in filtro) {
            let filtroTexto = filtro[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input')
                    || tds[col].querySelector('textarea')
                    || tds[col].querySelector('select')
                    || tds[col].textContent;

                let conteudoCelula = element.value ? element.value : element;
                let texto_campo = String(conteudoCelula).toLowerCase().replace('.', '').trim();

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        if (mostrarLinha) contador++;
        tr.style.display = mostrarLinha ? '' : 'none';
    });

    const contagem = document.getElementById('contagem');
    if (contagem) contagem.textContent = contador;
}

async function salvarLevantamento(idOrcamento, idElemento) {

    overlayAguarde()

    const elemento = document.getElementById(idElemento || 'adicionar_levantamento')
    const marcador = elemento?.dataset?.finalizado == 'S' 

    if (!elemento || !elemento.files || elemento.files.length === 0) return

    try {
        const anexos = await importarAnexos(elemento) // Nova função de upload

        const anexoDados = {}
        anexos.forEach(anexo => {
            if (marcador) anexo.finalizado = 'S'
            const idAnexo = ID5digitos()
            anexoDados[idAnexo] = anexo
        })

        if (idOrcamento) {

            const orcamentoBase = await recuperarDado('dados_orcamentos', idOrcamento) || {}

            orcamentoBase.levantamentos ??= {}

            Object.assign(orcamentoBase.levantamentos, anexoDados)

            await inserirDados({ [idOrcamento]: orcamentoBase }, 'dados_orcamentos')

            for (const [idAnexo, anexo] of Object.entries(anexoDados)) {
                await enviar(`dados_orcamentos/${idOrcamento}/levantamentos/${idAnexo}`, anexo)
            }

        } else {

            const orcamentoBase = baseOrcamento()

            orcamentoBase.levantamentos ??= {}

            Object.assign(orcamentoBase.levantamentos, anexoDados)
            baseOrcamento(orcamentoBase)
        }

        // Retornar as telas específicas;
        const painelC = document.querySelector('.painel-clientes')
        if (painelC) return await painelClientes(idOrcamento)

        const painelH = document.querySelector('.painel-historico')
        if (painelH) return await abrirEsquema(idOrcamento)

        if (idOrcamento) return await abrirEsquema(idOrcamento)

    } catch (error) {
        popup(mensagem(`Erro ao fazer upload: ${error.message}`), 'ALERTA', true)
    }
}

async function excluirLevantamentoStatus(idAnexo, idOrcamento) {

    overlayAguarde()

    const orcamento = idOrcamento ? await recuperarDado('dados_orcamentos', id_orcam) : baseOrcamento()

    delete orcamento.levantamentos[idAnexo]

    if (idOrcamento) {
        deletar(`dados_orcamentos/${id_orcam}/levantamentos/${idAnexo}`)
        await inserirDados({ [id_orcam]: orcamento }, 'dados_orcamentos')
    } else {
        baseOrcamento(orcamento)
    }

    // Retornar as telas específicas;
    const painelC = document.querySelector('.painel-clientes')
    if (painelC) return await painelClientes(idOrcamento)

    const painelH = document.querySelector('.painel-historico')
    if (painelH) return await abrirEsquema(idOrcamento)

    if (idOrcamento) return await abrirEsquema(idOrcamento)

}

function filtrarAAZ(coluna, id) {

    let el = document.getElementById(id)
    let tbody = el.tagName === "TBODY" ? el : el.tBodies[0]
    if (!tbody) return

    let linhas = Array.from(tbody.rows)
    let ascendente = (el.dataset.order ?? "desc") !== "asc"

    linhas.sort((a, b) => {
        let valorA = capturarValorCelula(a.cells[coluna])
        let valorB = capturarValorCelula(b.cells[coluna])

        // Normaliza números com "R$", vírgula etc.
        const parseValor = v => {
            if (typeof v !== 'string') return v
            return parseFloat(
                v.replace(/[^\d,-]/g, '')
                    .replace(',', '.')
            )
        }

        const numA = parseValor(valorA)
        const numB = parseValor(valorB)

        if (!isNaN(numA) && !isNaN(numB)) {
            return ascendente ? numA - numB : numB - numA
        }

        return ascendente
            ? valorA.localeCompare(valorB)
            : valorB.localeCompare(valorA)
    })

    linhas.forEach(linha => tbody.appendChild(linha))
    el.dataset.order = ascendente ? "asc" : "desc"
}

function capturarValorCelula(celula) {
    let entrada = celula.querySelector('input') || celula.querySelector('textarea') || celula.querySelector('select')
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

// SERVIÇO DE ARMAZENAMENTO 
async function receber(chave) {

    let chavePartes = chave.split('/')
    let dados = await recuperarDados(chavePartes[0]) || {}

    let timestamp = 0
    for (const [id, objeto] of Object.entries(dados)) {
        if (objeto.timestamp && objeto.timestamp > timestamp) timestamp = objeto.timestamp
    }

    const objeto = {
        chave: chave,
        timestamp: timestamp
    };

    const obs = {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(objeto)
    };

    return new Promise((resolve, reject) => {
        fetch(`${api}/dados`, obs)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.mensagem) {
                    console.log(data.mensagem)
                    reject({})
                }
                resolve(data);
            })
            .catch(err => {
                resolve({})
            });
    })
}

async function deletar(caminho, idEvento) {

    const url = `${api}/deletar`

    const objeto = {
        caminho,
        usuario: acesso.usuario
    }

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        })

        if (!response.ok) {
            console.error(`Falha ao deletar: ${response.status} ${response.statusText}`)
            const erroServidor = await response.text()
            console.error(`Resposta do servidor:`, erroServidor)
            throw new Error(`Erro HTTP ${response.status}`)
        }

        const data = await response.json()

        if (idEvento) removerOffline('deletar', idEvento)

        return data
    } catch (erro) {
        console.error(`Erro ao tentar deletar '${caminho}':`, erro.message || erro)
        salvarOffline(objeto, 'deletar', idEvento)
        removerOverlay()
        return null
    }
}

function removerOffline(operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline'))
    delete dados_offline?.[operacao]?.[idEvento]
    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

async function enviar(caminho, info, idEvento) {
    const url = `${api}/salvar`
    const objeto = { caminho, valor: info };

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(objeto)
        });

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            // Erro ao tentar interpretar como JSON;
            console.error("Resposta não é JSON válido:", parseError);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (!response.ok) {
            // Se a API respondeu erro (ex: 400, 500);
            console.error("Erro HTTP:", response.status, data);
            salvarOffline(objeto, 'enviar', idEvento);
            return null;
        }

        if (idEvento) removerOffline('enviar', idEvento);

        return data;
    } catch (erro) {
        console.error("Erro na requisição:", erro);
        salvarOffline(objeto, 'enviar', idEvento);
        return null;
    }
}

function salvarOffline(objeto, operacao, idEvento) {
    let dados_offline = JSON.parse(localStorage.getItem('dados_offline')) || {}
    idEvento = idEvento || ID5digitos()

    if (!dados_offline[operacao]) dados_offline[operacao] = {}
    dados_offline[operacao][idEvento] = objeto

    localStorage.setItem('dados_offline', JSON.stringify(dados_offline))
}

let socket;
let reconnectInterval = 30000;
connectWebSocket();

function connectWebSocket() {
    socket = new WebSocket(`${api}:8443`)

    socket.onopen = () => {
        if (acesso) socket.send(JSON.stringify({ tipo: 'autenticar', usuario: acesso.usuario }))
        console.log(`🟢🟢🟢 WS ${obterDatas('completa')} 🟢🟢🟢`)
    }

    socket.onmessage = async (event) => {

        const data = JSON.parse(event.data)

        if (data.tabela == 'dados_orcamentos') {
            verificarPendencias()
        }

        if (data.tipo == 'exclusao') { // Só se for no nível
            await deletarDB(data.tabela, data.id)
            await refletir()
        } else if (data.tipo == 'atualizacao') {
            await inserirDados({ [data.id]: data.dados }, data.tabela)
            await refletir()
        }

        if (data.tipo == 'status') {
            const user = await recuperarDado('dados_setores', data.usuario)
            if (user) {
                user.status = data.status
                await inserirDados({ [data.usuario]: user }, 'dados_setores')
            }

            usuariosToolbar()
            balaoUsuario(data.status, data.usuario)
        }

    }

    socket.onclose = () => {
        console.log(`🔴🔴🔴 WS ${obterDatas('completa')} 🔴🔴🔴`);
        console.log(`Tentando reconectar em ${reconnectInterval / 1000} segundos...`)
        setTimeout(connectWebSocket, reconnectInterval);
    }

    async function refletir() {
        semOverlay = true
        await executar(funcaoTela)
        semOverlay = false
    }

}

async function painelUsuarios() {

    const stringUsuarios = {}

    let dadosSetores = await recuperarDados('dados_setores') || {}
    dadosSetores = Object.entries(dadosSetores).sort((a, b) => a[0].localeCompare(b[0]))

    for (const [usuario, objeto] of dadosSetores) {

        if (objeto.permissao == 'novo') continue

        const status = objeto?.status || 'offline'
        if (!stringUsuarios[status]) stringUsuarios[status] = { quantidade: 0, linhas: '' }

        stringUsuarios[status].quantidade++
        stringUsuarios[status].linhas += `
            <div class="usuarioOnline">
                <img src="imagens/${status}.png" style="width: 1.5rem;">
                <label>${usuario}</label>
                <label style="font-size: 0.6rem;"><b>${objeto?.setor || '??'}</b></label>
            </div>
        `
    }

    let info = ''

    // ordena as chaves colocando "offline" no final
    const chavesOrdenadas = Object.keys(stringUsuarios).sort((a, b) => {
        if (a === 'offline') return 1
        if (b === 'offline') return -1
        return a.localeCompare(b)
    })

    for (const st of chavesOrdenadas) {
        const dados = stringUsuarios[st]
        info += `
            <label><strong>${st}</strong> ${dados.quantidade}</label>
            ${dados.linhas}
        `
    }

    const divOnline = document.querySelector('.divOnline')
    if (divOnline) return divOnline.innerHTML = info

    const acumulado = `
        <div class="conteinerOnline">
            <div class="divOnline">
                ${info}
            </div>
        </div>
    `

    popup(acumulado, 'Usuários', true)
}

async function gerarPdfOnline(htmlString, nome) {
    return new Promise((resolve, reject) => {
        let encoded = new TextEncoder().encode(htmlString);
        let compressed = pako.gzip(encoded);

        fetch(`${api}/pdf`, {
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

async function relancarPagamento(idPagamento) {

    const acumulado = `
        <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
                <span>Qual APP deve ser relançado?</span>
                <select class="opcoesSelect" id="app">
                    ${['AC', 'IAC'].map(op => `<option>${op}</option>`).join('')}
                </select>
            </div>
            <hr style="width: 100%;">
            <button onclick="confirmarRelancamento('${idPagamento}')">Confirmar</button>
        </div>
    `
    popup(acumulado, 'Escolha o APP', true)
}

async function confirmarRelancamento(idPagamento) {

    const app = document.getElementById('app').value

    removerPopup()
    overlayAguarde()

    let pagamento = await recuperarDado('lista_pagamentos', idPagamento)

    pagamento.app = app

    await enviar(`lista_pagamentos/${idPagamento}/app`, app)

    const resposta = await lancarPagamento({ pagamento, dataFixa: true })

    pagamento.status = 'Processando...'

    await inserirDados({ [idPagamento]: pagamento }, 'lista_pagamentos')
    await abrirDetalhesPagamentos(idPagamento)

    const textoPrincipal = resposta?.mensagem?.descricao_status || JSON.stringify(resposta)
    const infoAdicional = resposta?.mensagem?.exclusaoPagamento || ''
    const texto = `
        <div style="${vertical}; gap: 5px; text-align: left;">
            <span>${textoPrincipal}</span>
            <span>${infoAdicional}</span>
        </div>
    `
    popup(mensagem(texto, 'imagens/atualizar3.png'), 'Resposta', true)

    telaPagamentos()

}

async function reprocessarAnexos(idPagamento) {
    overlayAguarde()
    return new Promise((resolve, reject) => {

        fetch(`${api}/reprocessar_anexos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idPagamento })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                console.log(JSON.parse(data))
                popup(mensagem('Finalizado', 'imagens/concluido.png'), 'alerta', true)
                resolve(data);
            })
            .catch(err => {
                console.log(err)
                popup(mensagem('Finalizado'), 'Alerta', true)
                reject(err)
            })
    })
}

async function lancarPagamento({ pagamento, call, dataFixa }) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/lancar_pagamento`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pagamento, call, dataFixa })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(data => {
                data = JSON.parse(data)
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

        fetch(`${api}/upload`, {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                resolve(data);
            })
            .catch(error => {
                popup(mensagem('O Servidor caiu... solicite que um ADM reinicie o serviço'), 'Alerta', true)
                reject();
            });
    });
}

function sincronizar(script) {
    return new Promise((resolve, reject) => {

        fetch(`${api}/sincronizar`, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script })
        })
            .then(response => response.text())
            .then(data => {
                resolve(JSON.parse(data))
            })
            .catch(error => {
                reject(error)
            });

    })
}

function obterDatas(estilo) {
    let dataAtual = new Date();

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
        const dataFormatada = new Date().toLocaleString('pt-BR', {
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
    dados_orcamentos = await recuperarDados('dados_orcamentos') || {}
    dados_clientes = await recuperarDados('dados_clientes') || {}

    let guia = {
        pendente: '#ff8c1b',
        todos: '#bfbfbfff'
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
            <th contentEditable="true" style="background-color: white; text-align: left;" oninput="pesquisarGenerico(${i}, this.textContent, filtrosPendencias, 'tbodyPendencias')"></th>
        `
    })

    for (let [idOrcamento, orcamento] of Object.entries(dados_orcamentos).reverse()) {

        if (!orcamento.aprovacao) continue
        if (!orcamento.dados_orcam) continue

        const dados_orcam = orcamento.dados_orcam || {}
        const aprovacao = orcamento.aprovacao
        const status = aprovacao?.status || 'desconhecido'
        const porcentagemDiferenca = (((orcamento.total_geral - orcamento.total_bruto) / orcamento.total_bruto) * 100).toFixed(2)
        const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
        const cliente = dados_clientes?.[omie_cliente] || {}

        tabelas[status == 'pendente' ? 'pendente' : 'todos'].linhas += `
        <tr>
            <td style="text-align: left;">${dados_orcam?.contrato || '--'}</td>
            <td style="text-align: left;">${cliente?.nome || '--'}</td>
            <td>${dinheiro(orcamento.total_bruto)}</td>
            <td>${dinheiro(orcamento.total_geral)}</td>
            <td><label class="labelAprovacao" style="background-color: ${porcentagemDiferenca > 0 ? 'green' : '#B12425'}">${porcentagemDiferenca}%</label></td>
            <td>${cliente?.cidade || ''}</td>
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
        <div class="borda-tabela">
            <div class="topo-tabela"></div>
            <div class="div-tabela">
                <table class="tabela" style="width: 100%;">
                    <thead style="background-color: ${guia[tabela]};">
                        <tr>${ths}</tr>
                        ${tabela == 'todos' ? `<tr>${tsh}</tr>` : ''}
                    </thead>
                    <tbody ${tabela == 'todos' ? 'id="tbodyPendencias"' : ''}>${objeto.linhas}</tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
        `
    }

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 5px;">

            <label style="font-size: 1.2rem;">Fila de Aprovação</label>

            ${tabelasString}

        </div>
    `
    popup(acumulado, 'Aprovações de Orçamento', true)
}

async function verificarPendencias() {

    if (!navigator.onLine) return

    await sincronizarDados('dados_orcamentos', true)
    dados_orcamentos = await recuperarDados('dados_orcamentos')
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

async function verPedidoAprovacao(idOrcamento) {

    const permissao = acesso.permissao
    const pessoasPermitidas = ['adm', 'diretoria']
    if (!pessoasPermitidas.includes(permissao)) return popup(mensagem('Você não tem acesso'), 'AVISO', true)

    let tabelas = {}
    let divTabelas = ''

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const omieCliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omieCliente)
    const lpu = orcamento.lpu_ativa ? String(orcamento.lpu_ativa).toLowerCase() : null

    for (const [codigo, composicao] of Object.entries(orcamento?.dados_composicoes || {})) {

        const quantidade = composicao.qtde
        const custo = composicao.custo
        const custoOriginal = composicao?.custo_original || false
        const tipo = composicao.tipo

        if (!tabelas[tipo]) tabelas[tipo] = { linhas: '' }

        const total = quantidade * custo;
        let desconto = 0

        if (composicao.tipo_desconto) {
            desconto = composicao.tipo_desconto != 'Porcentagem'
                ? composicao.desconto
                : total * (composicao.desconto / 100);
        }

        const totalOriginal = custoOriginal * quantidade
        const labelCusto = dinheiro(custoOriginal ? custoOriginal : custo)
        const labelTotal = dinheiro(custoOriginal ? totalOriginal : total)
        const labelTotalDesconto = dinheiro(total - desconto)

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
                <td>
                    <div style="${horizontal}; gap: 2rem;">
                        <span>${labelCusto}</span>
                        <img src="imagens/preco.png" onclick="abrirHistoricoPrecos('${codigo}', '${lpu}')" style="width: 2rem; cursor: pointer;">
                    </div>
                </td>
                <td>${labelTotal}</td>
                <td>
                    <div style="${vertical}; gap: 2px;">
                        ${composicao?.tipo_desconto == 'Venda Direta' ? '<label>Venda Direta</label>' : ''}
                        <label class="labelAprovacao" style="background-color: ${cor}">${diferenca}</label>
                    </div>
                </td>
                <td>${labelTotalDesconto}</td>
            </tr>
        `
    }

    for (const [tabela, objeto] of Object.entries(tabelas)) {

        divTabelas += `
            <div class="borda-tabela">
                <div class="topo-tabela">
                    <label style="font-size: 1rem; padding: 0.5rem;"><b>${tabela}</b></label>
                </div>
                <div class="div-tabela">
                    <table class="tabela" style="width: 100%;">
                        <thead>
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
                <div class="rodapeTabela"></div>
            </div>
            `
    }

    const divOrganizada = (valor, termo) => {
        return `
            <div style="${vertical}; width: 100%; margin-bottom: 5px;">
                <label>${termo}</label>
                <label style="font-size: 1rem;"><b>${valor}</b></label>
            </div>
        `
    }

    let totalBruto = orcamento?.total_bruto
    let totalGeral = conversor(orcamento.total_geral)
    let diferencaDinheiro = totalGeral - totalBruto
    let diferencaPorcentagem = `${(diferencaDinheiro / totalBruto * 100).toFixed(2)}%`

    const acumulado = `
        <div class="painelAprovacoes">
            
            <div style="display: flex; align-items: center; justify-content: start; gap: 2vw;">
                <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
                    ${divOrganizada(orcamento?.dados_orcam?.analista || '--', 'Solicitante')}
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
                <img src="imagens/olhoFechado.png" style="width: 1.2rem;">
                <label style="text-decoration: underline; cursor: pointer;">Ver itens do Orçamento</label>
                
            </div>

            <div style="display: none; align-items: start; justify-content: center; flex-direction: column; gap: 5px;">
                ${divTabelas}
            </div>

            <hr style="width: 100%;">

            <div style="width: 80%; position: relative; color: #222; border-radius: 3px; padding: 5px; display: flex; justify-content: center; align-items: start; flex-direction: column;">
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
        data: obterDatas('completa'),
        status,
        justificativa
    }

    await sincronizarDados('dados_orcamentos')
    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento) || {}
    orcamento.aprovacao = {
        ...dados_orcamentos[idOrcamento].aprovacao,
        ...dados
    }

    await inserirDados({ [idOrcamento]: orcamento }, 'dados_orcamentos')
    enviar(`dados_orcamentos/${idOrcamento}/aprovacao`, orcamento.aprovacao)

    await verAprovacoes()
    verificarPendencias()

}

async function configuracoes(usuario, campo, valor) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/configuracoes`, {
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

function baseOrcamento(orcamento, remover) {
    let orcamentos = JSON.parse(localStorage.getItem('orcamentos')) || {};
    if (!orcamentos) return {};

    if (!orcamentos[origem]) orcamentos[origem] = {};

    const getModalidade = (orc) => {
        if (orc?.lpu_ativa) {
            return orc.lpu_ativa === 'ALUGUEL' ? 'aluguel' : 'orcamento';
        }
        return String(telaAtiva).includes('Aluguel') ? 'aluguel' : 'orcamento';
    };

    let modalidade = orcamento ? getModalidade(orcamento) : getModalidade();

    if (orcamento) {
        if (!orcamentos[origem][modalidade]) orcamentos[origem][modalidade] = {};
        orcamentos[origem][modalidade] = orcamento;
        localStorage.setItem('orcamentos', JSON.stringify(orcamentos));
    }
    else if (remover) {
        if (orcamentos[origem][modalidade]) {
            delete orcamentos[origem][modalidade];
            localStorage.setItem('orcamentos', JSON.stringify(orcamentos));
        }
    }
    else {
        return orcamentos[origem][modalidade] || null;
    }
}

async function sincronizarDados(base, overlayOff, resetar) {

    if (!overlayOff) overlayAguarde()

    if (resetar) await inserirDados({}, base, resetar)

    let nuvem = await receber(base) || {}
    await inserirDados(nuvem, base)

    if (!overlayOff) removerOverlay()
}

async function verificarNF(numero, tipo, app) {
    return new Promise((resolve, reject) => {
        fetch(`${api}/notas`, {
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
}

async function painelClientes(idOrcamento) {

    overlayAguarde()

    const orcamento = await recuperarDado('dados_orcamentos', idOrcamento)
    const orcamentoBase = orcamento || baseOrcamento()

    const dados_orcam = orcamentoBase?.dados_orcam || {}
    const idCliente = dados_orcam?.omie_cliente
    const overlayBloqueio = orcamentoBase.hierarquia ? true : false

    const cliente = await recuperarDado('dados_clientes', idCliente)
    const parcelas = ["--", "15 dias", "20 dias", "30 dias", "35 dias", "45 dias", "60 dias", "75 dias", "90 dias", "120 dias", "1x", "2x", "3x", "4x", "5x", "6x", "7x", "8x", "9x", "10x"]

    const levantamentos = Object.entries(orcamentoBase?.levantamentos || {})
        .map(([idAnexo, anexo]) =>
            criarAnexoVisual(
                anexo.nome,
                anexo.link,
                idOrcamento
                    ? `excluirLevantamentoStatus('${idAnexo}', '${idOrcamento}')`
                    : `excluirLevantamentoStatus('${idAnexo}')`))
        .join('')

    const modelo = (valor1, elemento) => `
            <div class="linha-clientes">
                ${valor1 ? `<label><b>${valor1}</b></label>` : ''}
                <div style="${horizontal}; gap: 2px;">${elemento}</div>
            </div>
        `

    const acumulado = `
        ${idOrcamento ? `<span id="edicaoClienteOrcamento" style="display: none;">${idOrcamento}</span>` : ''}

        <div class="painel-clientes">

            ${modelo('Chamado', `
                <input id="contrato" style="display: ${dados_orcam?.contrato == 'sequencial' ? 'none' : ''};" placeholder="nº do Chamado" value="${dados_orcam?.contrato || ''}">
                <input ${styChek} id="chamado_off" onchange="chamadoSequencial(this)" type="checkbox" ${dados_orcam?.contrato == 'sequencial' ? 'checked' : ''}>
                <label>Sem Chamado</label>`)}

            ${modelo(null, `<span>Classificar orçamento na aba de <b>CHAMADO</b></span><input id="filtroChamado" ${orcamentoBase?.chamado ? 'checked' : ''} ${styChek} type="checkbox">`)}

            <div style="${vertical}; gap: 5px; width: 100%; position: relative;">
                ${modelo('Cliente', `<span ${dados_orcam.omie_cliente ? `id="${dados_orcam.omie_cliente}"` : ''} class="opcoes" name="cliente" onclick="cxOpcoes('cliente', 'dados_clientes', ['nome', 'bairro', 'cnpj'], 'buscarDadosCliente()')">${cliente?.nome || 'Selecione'}</span>`)}
                ${modelo('CNPJ/CPF', `<span id="cnpj">${cliente?.cnpj || ''}</span>`)}
                ${modelo('Endereço', `<span id="bairro">${cliente?.bairro || ''}</span>`)}
                ${modelo('CEP', `<span id="cep">${cliente?.cep || ''}</span>`)}
                ${modelo('Cidade', `<span id="cidade">${cliente?.cidade || ''}</span>`)}
                ${modelo('Estado', `<span id="estado">${cliente?.estado || ''}</span>`)}
                ${overlayBloqueio ? `<div class="overlay-clientes"></div>` : ''}
            </div>

            ${modelo('Tipo de Frete', `<select id="tipo_de_frete">
                    ${['--', 'CIF', 'FOB'].map(op => `<option ${dados_orcam?.tipo_de_frete == op ? 'selected' : ''}>${op}</option>`).join('')}</select>`)}
                    
            ${modelo('Transportadora', `<input type="text" id="transportadora" value="${dados_orcam?.transportadora || '--'}">`)}
            
            <div class="linha-clientes" style="${vertical}; gap: 5px;">
                <span><b>Escopo / Considerações</b></span>
                <div class="escopo" 
                    id="consideracoes" 
                    contentEditable="true"
                    style="resize: vertical; overflow: auto; text-align: left; text-transform: uppercase;">
                    ${dados_orcam?.consideracoes || 'ESCOPO: '}
                </div>

                <div class="contorno-botoes" style="background-color: #222;">
                    <img src="imagens/anexo.png" style="width: 1.2rem;">
                    <label style="width: 100%;" for="adicionar_levantamento">Anexar levantamento
                        <input type="file" id="adicionar_levantamento" style="display: none;"
                            onchange="${idOrcamento ? `salvarLevantamento('${idOrcamento}')` : 'salvarLevantamento()'}">
                    </label>
                </div>
    
                ${levantamentos}
            </div>           

            ${modelo('Pagamento', `<select id="condicoes">
                ${parcelas.map(op => `<option ${dados_orcam?.condicoes == op ? 'selected' : ''}>${op}</option>`).join('')}</select>`)}

            ${modelo('Garantia', `<input id="garantia" value="${dados_orcam?.garantia || 'Conforme tratativa Comercial'}">`)}

            <label class="info">Dados do Analista</label>

            ${modelo('Analista', `<span id="analista" oninput="salvarContatos(this)" contentEditable="true">${dados_orcam?.analista || acesso.nome_completo}</span>`)}
            ${modelo('E-mail', `<span id="email_analista" oninput="salvarContatos(this)" contentEditable="true">${dados_orcam?.email_analista || acesso.email}</span>`)}
            ${modelo('Telefone', `<span id="telefone_analista" oninput="salvarContatos(this)" contentEditable="true">${dados_orcam?.telefone_analista || acesso.telefone}</span>`)}

            <label class="info">Quem emite essa nota?</label>

            ${modelo('Empresa', `<select id="emissor">
                ${['AC SOLUÇÕES', 'IAC', 'HNW', 'HNK'].map(op => `<option ${dados_orcam?.emissor == op ? 'selected' : ''}>${op}</option>`).join('')}</select>`)}
        </div>
                
        <div class="rodape-painel-clientes">
            ${botaoRodape('salvarDadosCliente()', 'Salvar Dados', 'concluido')}
            ${botaoRodape('atualizarBaseClientes()', 'Atualizar Clientes', 'atualizar3')}
            ${idOrcamento ? '' : botaoRodape('executarLimparCampos()', 'Limpar Campos', 'limpar')}
        </div>
    `

    removerOverlay()
    const painel = document.querySelector('.cadastro-cliente')
    if (painel) return painel.innerHTML = acumulado

    popup(`<div class="cadastro-cliente">${acumulado}</div>`, 'Dados do Cliente', true)
}

function salvarContatos(span) {

    let orcamento = baseOrcamento()
    if (!orcamento.dados_orcam) orcamento.dados_orcam = {}
    orcamento.dados_orcam[span.id] = span.textContent
    baseOrcamento(orcamento)

}

function chamadoSequencial(input) {

    const contrato = document.getElementById('contrato')
    if (contrato) contrato.style.display = input.checked ? 'none' : 'flex'
    if (contrato) contrato.value = input.checked ? 'sequencial' : ''

}

async function buscarDadosCliente() {

    const clienteName = document.querySelector('[name="cliente"]')
    if (!clienteName) return

    const omie_cliente = clienteName.id

    const cliente = await recuperarDado('dados_clientes', omie_cliente)
    const campos = ['cnpj', 'bairro', 'cidade', 'estado', 'cep']
    for (const campo of campos) {
        const el = document.getElementById(campo)
        if (el) el.textContent = cliente?.[campo] || ''
    }

}

async function salvarDadosCliente() {

    overlayAguarde()

    const edicaoClienteOrcamento = document.getElementById('edicaoClienteOrcamento')
    const idOrcamento = edicaoClienteOrcamento?.textContent || null
    let orcamento = await recuperarDado('dados_orcamentos', idOrcamento)

    let orcamentoBase = orcamento || baseOrcamento()

    const el = (id) => {
        const elemento = document.getElementById(id)
        return elemento || null
    }

    orcamentoBase.dados_orcam ??= {}

    const omie_cliente = Number(document.querySelector('[name="cliente"]').id)

    orcamentoBase.dados_orcam = {
        ...orcamentoBase.dados_orcam,
        omie_cliente,
        contrato: el('contrato').value,
        condicoes: el('condicoes').value,
        consideracoes: String(el('consideracoes').textContent).toUpperCase(),
        data: new Date().toLocaleString('pt-BR'),
        garantia: el('garantia').value,
        transportadora: el('transportadora').value,
        tipo_de_frete: el('tipo_de_frete').value,
        emissor: el('emissor').value,
        email_analista: el('email_analista').textContent,
        analista: el('analista').textContent,
        telefone_analista: el('telefone_analista').textContent
    }

    const filtroChamado = el('filtroChamado')
    orcamentoBase.chamado = filtroChamado.checked

    if (idOrcamento) {
        enviar(`dados_orcamentos/${idOrcamento}/dados_orcam`, orcamentoBase.dados_orcam)
        enviar(`dados_orcamentos/${idOrcamento}/chamado`, filtroChamado.checked)
        await inserirDados({ [idOrcamento]: orcamentoBase }, 'dados_orcamentos')
        await telaOrcamentos()
        removerPopup()
        abrirAtalhos(idOrcamento)
        return
    }

    baseOrcamento(orcamentoBase)
    removerPopup()

    if (orcamentoBase.lpu_ativa === 'MODALIDADE LIVRE') {
        total_v2()
    } else {
        if (String(telaAtiva).includes('Aluguel')) {
            await total()
        } else {
            await totalOrcamento()
        }
    }

}

function executarLimparCampos() {

    let orcamento = baseOrcamento()
    if (orcamento.dados_orcam) delete orcamento.dados_orcam
    baseOrcamento(orcamento)
    painelClientes()
}

async function abrirDANFE(codOmieNF, tipo, app) {

    overlayAguarde()

    const resposta = await buscarDANFE(codOmieNF, tipo, app)

    if (resposta.err) return popup(mensagem(`Provavelmente esta nota foi importada via XML e por enquanto não está disponível`), 'Alerta', true)

    removerOverlay()

    try {
        shell.openExternal(resposta);
    } catch {
        window.open(resposta, '_blank');
    }
}

async function buscarDANFE(codOmieNF, tipo, app) {
    try {
        const resposta = await fetch(`${api}/danfe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codOmieNF, tipo, app })
        });

        if (!resposta.ok) return { err: `Falha na busca do PDF no Omie` };

        const texto = await resposta.text();
        if (!texto) return { err: `Falha na busca do PDF no Omie` };

        try {
            return JSON.parse(texto);
        } catch {
            return texto;
        }

    } catch (err) {
        return { err };
    }
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

    let base = await recuperarDados(nomeBase)
    let opcoesDiv = ''

    for (const [cod, dado] of Object.entries(base)) {

        if (dado.origem && origem !== dado?.origem) continue

        const labels = campos
            .map(campo => {
                const valor = getValorPorCaminho(dado, campo)
                return valor ? `<label>${valor}</label>` : ''
            })
            .join('')

        const descricao = String(getValorPorCaminho(dado, campos[0]))
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9 ]/g, '')

        opcoesDiv += `
        <div 
            name="camposOpcoes" 
            class="atalhos-opcoes" 
            onclick="selecionar('${name}', '${cod}', '${descricao}', ${funcaoAux ? `'${funcaoAux}'` : false})">
            <img src="${dado.imagem || 'imagens/LG.png'}" style="width: 3rem;">
            <div style="${vertical}; gap: 2px;">
                ${labels}
            </div>
        </div>`
    }

    const acumulado = `
        <div style="${vertical}; justify-content: left; background-color: #b1b1b1;">

            <div style="${horizontal}; padding-left: 0.5rem; padding-right: 0.5rem; margin: 5px; background-color: white; border-radius: 10px;">
                <input oninput="pesquisarCX(this)" placeholder="Pesquisar itens" style="width: 100%;">
                <img src="imagens/pesquisar4.png" style="width: 2rem; padding: 0.5rem;"> 
            </div>

            <div style="padding: 1rem; gap: 5px; ${vertical}; background-color: #d2d2d2; width: 30vw; max-height: 40vh; height: max-content; overflow-y: auto; overflow-x: hidden;">
                ${opcoesDiv}
            </div>

        </div>
    `

    popup(acumulado, 'Selecione o item', true)
}

async function selecionar(name, id, termo, funcaoAux) {
    const elemento = document.querySelector(`[name='${name}']`)
    elemento.textContent = termo
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

async function cadastrarCliente() {

    const acumulado = `
        <div style="padding: 1rem; ${vertical}; align-items: start; background-color: #d2d2d2; min-width: max-content;">

            <div style="${horizontal}; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Nome', `<textarea id="nome_fantasia" rows="5"></textarea>`)}
                </div>

                <div style="${vertical}">
                    ${modelo('CNPJ ou CPF', `<input id="cnpj_cpf">`)}
                    ${modelo('Nº do endereço', `<input id="endereco_numero">`)}
                    ${modelo('CEP', `<input id="cep">`)}
                </div>
            </div>

            <hr style="width: 100%;">

            <button onclick="salvarCliente()">Salvar</button>
        </div>`

    popup(acumulado, 'Cadastro de Cliente e Empresa', true)

}

async function salvarCliente() {

    overlayAguarde()

    const campos = ['nome_fantasia', 'cnpj_cpf', 'endereco_numero', 'cep'];
    let param = {
        codigo_cliente_integracao: unicoID()
    };

    for (const campo of campos) {
        const el = document.getElementById(campo);
        if (el && el.value !== '') param[campo] = el.value;
    }

    if (!param.nome_fantasia) return popup(mensagem('Escreva o nome do Cliente'), 'Alerta', true)

    param.nome_fantasia = param.nome_fantasia.toUpperCase()
    if (param.cep) param.pesquisar_cep = 'S'
    param.razao_social = param.nome_fantasia

    try {
        const opcoes = {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ param })
        };

        const resposta = await fetch(`${api}/cadastrar-cliente`, opcoes);
        const dados = await resposta.json();

        if (!resposta.ok) {

            if (dados.mensagem && dados.mensagem.includes('Cliente já cadastrado')) {

                const regex = /\[([^\]]+)\]/g;
                const matches = [...dados.mensagem.matchAll(regex)].map(m => m[1]);
                const idOmie = matches[1];

                await sincronizarDados('dados_clientes')

                const cliente = await recuperarDado('dados_clientes', idOmie);
                const acumulado = `
                    <div style="${vertical}; background-color: #d2d2d2; padding: 1rem;">
                        <span>Cliente já cadastrado:</span>
                        <hr style="width: 100%">
                        <span>${cliente?.nome || ''}</span>
                        <span>${cliente?.bairro || ''}</span>
                        <span>${cliente?.cpf_cnpj || ''}</span>
                        <span>${cliente?.cep || ''}</span>
                        <span>${cliente?.cidade || ''}</span>
                    </div>`

                return popup(acumulado, 'Cliente existente', true)
            }

            return popup(mensagem(dados?.mensagem || 'Falha no cadastro, tente novamente'), 'Alerta', true);

        }

        removerPopup()
        return popup(mensagem(dados.mensagem, 'imagens/concluido.png'), 'Cadastrado com sucesso', true);

    } catch (err) {

        return popup(mensagem(err.message || String(err)), 'Alerta', true);

    }

}

async function vincularAPI({ idMaster, idSlave }) {
    try {
        const response = await fetch(`${api}/vincular`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idMaster, idSlave })
        })

        if (!response.ok)
            throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`)

        return await response.json()
    } catch (error) {
        return { mensagem: error.messagem || error.mensage || error }
    }
}
