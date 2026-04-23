let menusAbertos = {}

function criarMenus(chave) {
    telaAtiva = chave
    const botoesMenu = document.querySelector('.botoesMenu')

    const lista = esquemaBotoes[chave] || []

    const html = lista
        .map((item, i) => renderMenuItem(item, `menu_${i}`, 0))
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

function criarAtalhoMenu({ nome, img }, nivel) {

    return `
    <div 
        class="botao-lateral nivel-${nivel}" 
        style="margin-left:${nivel * 12}px"
    >
        <img src="imagens/${img}.png">
        <div>${nome}</div>
    </div>
    `
}

function acaoMenu(id, funcao, temFilhos) {
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
        window[funcao]()
    }
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
            sub: [
                { nome: 'Ver Orçamentos', funcao: 'telaOrcamentos', img: 'projeto' },
                {
                    nome: 'Criar Orçamento',
                    funcao: 'painelEdicao',
                    img: 'projeto',
                    sub: [
                        { nome: 'Em edição', funcao: 'painelEdicao', img: 'pasta' },
                        { nome: 'Dados Cliente', funcao: 'painelClientes', img: 'gerente' },
                        { nome: 'Salvar Orçamento', funcao: 'enviarDadosOrcamento', img: 'salvo' },
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
            img: 'prancheta',
            sub: [
                { nome: 'Categorias de Formulário', funcao: 'telaCadastros', img: 'prancheta' },
                { nome: 'Clientes & Fornecedores', funcao: 'telaClientes', img: 'prancheta' }
            ]
        },
        {
            nome: 'Chamados',
            img: 'chamados',
            sub: [
                { nome: 'Ver Manutenções', funcao: 'telaChamados', img: 'chamados' },
                { nome: 'Criar Manutenção', funcao: 'criarManutencao', img: 'chamados' },
                { nome: 'Baixar em Excel', funcao: 'excelChamados', img: 'excel' }
            ]
        },
        {
            nome: 'Veículos',
            img: 'veiculo',
            sub: [
                { nome: 'Ver Combustíveis', funcao: 'telaVeiculos', img: 'veiculo' },
                { nome: 'Adicionar Combustível', funcao: 'painelValores', img: 'combustivel' },
                { nome: 'Veículos', funcao: 'auxVeiculos', img: 'veiculo' }
            ]
        },
        {
            nome: 'Reembolsos',
            img: 'reembolso',
            sub: [
                { nome: 'Ver Pagamentos', funcao: 'telaPagamentos', img: 'reembolso' },
                { nome: 'Solicitar Pagamento', funcao: 'formularioPagamento', img: 'dinheiro' },
                { nome: 'Baixar Excel', funcao: 'baixarExcelRelatorioPagamentos', img: 'excel' }
            ]
        },
        {
            nome: 'Estoque',
            img: 'estoque',
            sub: [
                { nome: 'Ver Estoque', funcao: 'telaEstoque', img: 'estoque' },
                { nome: 'Cadastrar Item', funcao: 'incluirItemEstoque', img: 'baixar' },
                { nome: 'Relatório de Movimentos', funcao: 'relatorioMovimento', img: 'projeto' },
                { nome: 'Baixar em Excel', funcao: 'exportarParaExcel', img: 'excel' }
            ]
        },
        {
            nome: 'Post-it',
            img: 'kanban',
            sub: [
                { nome: 'Ver Post-its', funcao: 'telaPIT', img: 'kanban' },
                { nome: 'Criar Post-it', funcao: 'criarPIT', img: 'baixar' },
                { nome: 'Criar Quadro', funcao: 'criarQuadro', img: 'baixar' }
            ]
        },
        {
            nome: 'RH',
            img: 'gerente',
            sub: [
                { nome: 'Ver Documentos', funcao: 'telaRH', img: 'gerente' },
                { nome: 'Baixar em Excel', funcao: 'rhExcel', img: 'excel' },
                { nome: 'Incluir Documento', funcao: 'incluirDocumento', img: 'baixar' }
            ]
        },
        {
            nome: 'Composições',
            img: 'composicoes',
            sub: [
                { nome: 'Ver Composições', funcao: 'telaComposicoes', img: 'composicoes' },
                { nome: 'Cadastrar Item', funcao: 'cadastrarItem', img: 'baixar' },
                { nome: 'Baixar em Excel', funcao: 'baixarExcelComposicoes', img: 'excel' }
            ]
        },
        {
            nome: 'Desconectar',
            funcao: 'deslogarUsuario',
            img: 'sair'
        }
    ]
}
