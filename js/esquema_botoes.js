let menusAbertos = {}

function criarMenus(chave) {

    const botoesMenu = document.querySelector('.botoesMenu')
    const { permissao } = JSON.parse(localStorage.getItem('acesso')) || {}
    const lista = esquemaBotoes[chave] || []

    const html = lista
        .map((item, i) => {

            const permitido = item.permitido || []
            const bloqueio = item.bloqueio || []

            if (permitido.length > 0 && !permitido.includes(permissao)) {
                return ''
            }

            if (permitido.length === 0 && bloqueio.includes(permissao)) {
                return ''
            }

            return renderMenuItem(item, `menu_${i}`, 0)
        })
        .join('')

    botoesMenu.innerHTML = html
}

function renderMenuItem(item, id, nivel) {
    const temFilhos = item.sub && item.sub.length

    return `
        <div class="menu-item">
            <div 
                class="menu-principal nivel-${nivel}" 
                onclick="acaoMenu('${id}', '${item.funcao || ''}', ${temFilhos})">
                ${criarAtalhoMenu(item, nivel)}
            </div>

            ${temFilhos ? `
                <div class="menu-secundario" id="${id}">
                    ${item.sub
                .map((sub, i) => renderMenuItem(sub, `${id}_${i}`, nivel + 1))
                .join('')
            }
                </div>
            ` : ''}
        </div>
    `
}

function iconeSilhuetaMenu(chave) {
    const icones = {
        home: '<path d="M2 11 12 2l10 9h-3v11h-5v-7h-4v7H5V11z"/>',
        projeto: '<path fill-rule="evenodd" d="M5 2h10l5 5v15H5V2zm9 2v5h5l-5-5zM8 12v2h9v-2H8zm0 5v2h7v-2H8z"/>',
        gerente: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-4a8 8 0 0 1 16 0v4H4z"/>',
        salvo: '<path fill-rule="evenodd" d="M3 3h15l3 3v15H3V3zm4 0v7h10V3H7zm0 12v6h10v-6H7z"/>',
        cancel: '<path d="M8 2h8l1 3h4v2H3V5h4l1-3zm-3 7h14l-1 13H6L5 9z"/>',
        excel: '<path fill-rule="evenodd" d="M4 2h16v20H4V2zm3 4 3 6-3 6h3l2-4 2 4h3l-3-6 3-6h-3l-2 4-2-4H7z"/>',
        alerta: '<path fill-rule="evenodd" d="m12 2 11 20H1L12 2zm-1 7v6h2V9h-2zm0 8v2h2v-2h-2z"/>',
        baixar: '<path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7V3z"/>',
        planilha: '<path fill-rule="evenodd" d="M3 3h18v18H3V3zm3 4v2h12V7H6zm0 5v2h2v-2H6zm4 0v2h8v-2h-8zm-4 5v2h2v-2H6zm4 0v2h8v-2h-8z"/>',
        prancheta: '<path fill-rule="evenodd" d="M9 2h6v2h5v18H4V4h5V2zm-1 5v2h8V7H8zm-1 6v2h10v-2H7zm0 4v2h8v-2H7z"/>',
        contratos: '<path fill-rule="evenodd" d="M4 2h11l5 5v15H4V2zm10 2v5h5l-5-5zM7 12v2h10v-2H7zm0 5v2h6v-2H7z"/>',
        tecnico: '<path d="M8 3a6 6 0 0 0-5 9l-1 2h20l-1-2a6 6 0 0 0-5-9v7h-2V2h-4v8H8V3zm-2 13a6 6 0 0 0 12 0H6z"/>',
        reagendar: '<path fill-rule="evenodd" d="M6 2h2v3h8V2h2v3h3v17H3V5h3V2zm-1 8v10h14V10H5zm3 2h3v3H8v-3zm5 0h3v3h-3v-3z"/>',
        veiculo: '<path fill-rule="evenodd" d="m6 3-3 8v10h3v-3h12v3h3V11l-3-8H6zm1 3h10l2 5H5l2-5zm-2 7v3h3v-3H5zm11 0v3h3v-3h-3z"/>',
        combustivel: '<path fill-rule="evenodd" d="M3 2h11v18h2v2H1v-2h2V2zm2 3v5h7V5H5z"/><path d="m17 3 5 5v10a3 3 0 0 1-6 0v-5h-2v-2h4v7a1 1 0 0 0 2 0v-7h-2V7l-3-3 2-1z"/>',
        reembolso: '<path fill-rule="evenodd" d="M5 2h14v20l-3-2-4 2-4-2-3 2V2zm3 4v2h8V6H8zm0 5v2h8v-2H8zm0 5v2h5v-2H8z"/>',
        dinheiro: '<path fill-rule="evenodd" d="M2 5h20v14H2V5zm10 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/><path d="M11 8h2v8h-2z"/>',
        kanban: '<path fill-rule="evenodd" d="M2 3h20v18H2V3zm3 3v10h3V6H5zm6 0v6h3V6h-3zm6 0v12h3V6h-3z"/>',
        composicoes: '<path d="m12 2 10 5-10 5L2 7l10-5zM2 11l10 5 10-5v4l-10 5-10-5v-4zm0 8 10 5 10-5v-2l-10 5-10-5v2z"/>',
        pesquisar5: '<path fill-rule="evenodd" d="M10 2a8 8 0 1 0 5 14l6 6 2-2-6-6a8 8 0 0 0-7-12zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
        sair: '<path d="M3 2h10v3H6v14h7v3H3V2zm12 5 7 5-7 5v-3H9v-4h6V7z"/>'
    }

    if (!icones[chave]) return ''
    return `<svg class="icone-menu" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${icones[chave]}</svg>`
}

function criarAtalhoMenu({ nome, img, gif }, nivel) {

    const imagem = gif
        ? `gifs/${gif}.gif`
        : `imagens/${img}.png`

    return `
    <div class="botao-lateral nivel-${nivel}" 
        style="margin-left:${nivel * 12}px">
        ${iconeSilhuetaMenu(img || gif) || `<img src="${imagem}" alt="">`}
            <div>${nome}</div>
    </div>
    `
}

async function acaoMenu(id, funcao, temFilhos) {

    if (canvasJogo)
        limparJogo()

    const el = document.getElementById(id)
    const partes = id.split('_')
    const nivel = partes.length - 1

    // pega o pai (ex: menu_1_0 -> menu_1)
    const pai = partes.slice(0, -1).join('_')

    // fecha filhos desse pai
    Object.entries(menusAbertos).forEach(([n, aberto]) => {
        if (!aberto) return

        const idAberto = aberto.id

        // mesmo pai + mais profundo
        if (
            idAberto.startsWith(pai) &&
            idAberto !== pai &&
            idAberto !== id
        ) {
            aberto.style.display = 'none'
            menusAbertos[n] = null
        }
    })

    if (temFilhos) {
        if (menusAbertos[nivel] && menusAbertos[nivel] !== el) {
            menusAbertos[nivel].style.display = 'none'
        }

        const aberto = el.style.display === 'flex'
        el.style.display = aberto ? 'none' : 'flex'

        menusAbertos[nivel] = aberto ? null : el
    }

    if (funcao && typeof window[funcao] === 'function') {
        await window[funcao]()
    }

    // Especial titulo dos orçamentos;
    const elemento = document.querySelector('.contorno-tela-criar-orcamento')
    if (!elemento)
        titulo.innerHTML = 'GCS'

}

const esquemaBotoes = {
    inicial: [
        {
            nome: 'Início',
            funcao: 'telaInicialGCS',
            img: 'home'
        },
        {
            nome: 'Orçamentos',
            img: 'projeto',
            bloqueio: ['cliente', 'técnico'],
            sub: [
                { nome: 'Ver Orçamentos', funcao: 'telaOrcamentos', img: 'projeto' },
                {
                    nome: 'Criar Orçamento',
                    img: 'projeto',
                    sub: [
                        { nome: 'Em edição', funcao: 'painelEdicao', img: 'projeto' },
                        { nome: 'Dados Cliente', funcao: 'painelClientes', img: 'gerente' },
                        { nome: 'Salvar Orçamento', funcao: 'enviarDadosPrincipal', img: 'salvo' },
                        { nome: 'Apagar Orçamento', funcao: 'apagarOrcamento', img: 'cancel' }
                    ]
                },
                { nome: 'Baixar em Excel', funcao: 'baixarExcelOrcamentos', img: 'excel' }
            ]
        },
        {
            nome: 'Ocorrências',
            img: 'alerta',
            sub: [
                { nome: 'Ver Ocorrências', funcao: 'telaOcorrencias', img: 'alerta' },
                { nome: 'Criar Ocorrência', funcao: 'formularioOcorrencia', img: 'baixar' },
                { nome: 'Relatório de Ocorrências', funcao: 'telaRelatorio', img: 'planilha' },
                { nome: 'Relatório de Correções', funcao: 'telaRelatorioCorrecoes', img: 'planilha' },
                { nome: 'Relatório de Peças', funcao: 'telaRelatorioPecas', img: 'planilha' }
            ]
        },
        {
            nome: 'Cadastros',
            bloqueio: ['cliente', 'técnico'],
            img: 'prancheta',
            sub: [
                { nome: 'Criar Cadastro', funcao: 'formularioCliente', img: 'baixar' },
                { nome: 'Categorias de Formulário', funcao: 'telaCadastros', img: 'prancheta' },
                { nome: 'Clientes, Usuários & Fornecedores', funcao: 'telaClientes', img: 'prancheta' }
            ]
        },
        {
            nome: 'Contratos',
            bloqueio: ['cliente', 'técnico'],
            img: 'contratos',
            sub: [
                { nome: 'Adicionar Contrato', funcao: 'gerenciarContrato', img: 'baixar' },
                { nome: 'Ver Contratos', funcao: 'telaContratos', img: 'contratos' }
            ]
        },
        {
            nome: 'Técnicos',
            bloqueio: ['cliente', 'técnico'],
            img: 'tecnico',
            sub: [
                { nome: 'Saldo Kit Peças', funcao: 'telaSaldoPecas', img: 'planilha' },
                { nome: 'Saldo Ferramentas', funcao: 'telaSaldoFerramentas', img: 'planilha' },
                { nome: 'Todos os movimentos', funcao: 'criarTabelaTecDetalhada', img: 'planilha' },
                { nome: 'Agenda', funcao: 'telaAgenda', img: 'reagendar' }
            ]
        },
        {
            nome: 'Veículos',
            bloqueio: ['cliente', 'técnico'],
            img: 'veiculo',
            sub: [
                { nome: 'Ver Combustíveis', funcao: 'telaVeiculos', img: 'veiculo' },
                { nome: 'Adicionar Combustível', funcao: 'painelValores', img: 'combustivel' },
                { nome: 'Veículos', funcao: 'auxVeiculos', img: 'veiculo' }
            ]
        },
        {
            nome: 'Reembolsos',
            bloqueio: ['cliente', 'técnico'],
            img: 'reembolso',
            sub: [
                { nome: 'Ver Pagamentos', funcao: 'telaPagamentos', img: 'reembolso' },
                { nome: 'Solicitar Pagamento', funcao: 'formularioPagamento', img: 'dinheiro' },
                { nome: 'Baixar Excel', funcao: 'baixarExcelRelatorioPagamentos', img: 'excel' }
            ]
        },
        {
            nome: 'Post-it',
            bloqueio: ['cliente', 'técnico'],
            img: 'kanban',
            sub: [
                { nome: 'Ver Post-its', funcao: 'telaPIT', img: 'kanban' },
                { nome: 'Criar Post-it', funcao: 'criarPIT', img: 'baixar' },
                { nome: 'Criar Quadro', funcao: 'criarQuadro', img: 'baixar' }
            ]
        },
        {
            nome: 'RH',
            bloqueio: ['cliente', 'técnico'],
            img: 'gerente',
            sub: [
                { nome: 'Ver Documentos', funcao: 'telaRH', img: 'gerente' },
                { nome: 'Incluir Documento', funcao: 'incluirDocumento', img: 'baixar' }
            ]
        },
        {
            nome: 'Composições',
            bloqueio: ['cliente', 'técnico'],
            img: 'composicoes',
            sub: [
                { nome: 'Ver Composições', funcao: 'telaComposicoes', img: 'composicoes' },
                { nome: 'Cadastrar Item', funcao: 'cadastrarItem', img: 'baixar' },
                { nome: 'Baixar em Excel', funcao: 'baixarExcelComposicoes', img: 'excel' }
            ]
        },
        {
            nome: 'Histórico de Uso GCS',
            img: 'pesquisar5',
            permitido: ['adm', 'diretoria'],
            sub: [
                { nome: 'Ver histórico', funcao: 'daily', img: 'pesquisar5' }
            ]
        },
        {
            nome: 'Desconectar',
            funcao: 'deslogarUsuario',
            img: 'sair'
        }
    ]
}
