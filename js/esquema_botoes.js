let menusAbertos = {}

function criarMenus(chave) {

    const botoesMenu = document.querySelector('.botoesMenu')
    const lista = esquemaBotoes[chave] || []

    const html = lista
        .map((item, i) => renderMenuItem(item, `menu_${i}`, 0))
        .join('')

    botoesMenu.innerHTML = html
}

// Quem vê cada item: a chave "acesso" na Central de Acessos (js/acessos.js, gcs SCRIPTS/acessos_catalogo.js).
// Item sem chave aparece se algum filho aparecer (ou para todos, se não tiver filhos: Início, Sair...).
// soAdm: só o perfil adm (a própria Central de Acessos).
function renderMenuItem(item, id, nivel) {
    if (item.soAdm && acesso?.permissao !== 'adm') return ''
    if (item.acesso && !pode(item.acesso)) return ''

    const filhos = (item.sub || [])
        .map((sub, i) => renderMenuItem(sub, `${id}_${i}`, nivel + 1))
        .join('')
    const temFilhos = Boolean(filhos)

    if (item.sub?.length && !temFilhos && !item.funcao) return ''

    return `
        <div class="menu-item${item.especial ? ' menu-especial' : ''}">
            <div 
                class="menu-principal nivel-${nivel}" 
                onclick="acaoMenu('${id}', '${item.funcao || ''}', ${temFilhos})">
                ${criarAtalhoMenu(item, nivel)}
            </div>

            ${temFilhos ? `
                <div class="menu-secundario" id="${id}">
                    ${filhos}
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
        // Financeiro: a pagar = dinheiro saindo (seta para cima, saindo da bandeja); a receber = entrando (seta para baixo).
        pagar: '<path d="M12 1 6.5 6.5 8 8l3-3v9h2V5l3 3 1.5-1.5L12 1z"/><path d="M2 13h5l2 3h6l2-3h5v9H2v-9z"/>',
        receber: '<path d="M11 1h2v9l3-3 1.5 1.5L12 14 6.5 8.5 8 7l3 3V1z"/><path d="M2 13h5l2 3h6l2-3h5v9H2v-9z"/>',
        kanban: '<path fill-rule="evenodd" d="M2 3h20v18H2V3zm3 3v10h3V6H5zm6 0v6h3V6h-3zm6 0v12h3V6h-3z"/>',
        composicoes: '<path d="m12 2 10 5-10 5L2 7l10-5zM2 11l10 5 10-5v4l-10 5-10-5v-4zm0 8 10 5 10-5v-2l-10 5-10-5v2z"/>',
        pesquisar5: '<path fill-rule="evenodd" d="M10 2a8 8 0 1 0 5 14l6 6 2-2-6-6a8 8 0 0 0-7-12zm0 3a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"/>',
        sair: '<path d="M3 2h10v3H6v14h7v3H3V2zm12 5 7 5-7 5v-3H9v-4h6V7z"/>',
        celular: '<path fill-rule="evenodd" d="M7 1h10a2 2 0 0 1 2 2v18a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2zm0 3v14h10V4H7zm4 15v2h2v-2h-2z"/>',
        cadeado: '<path fill-rule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v12H5V10h2zm3 0h4V7a2 2 0 1 0-4 0v3zm1 4v4h2v-4h-2z"/>'
    }

    if (!icones[chave]) return ''
    return `<svg class="icone-menu" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${icones[chave]}</svg>`
}

function criarAtalhoMenu({ nome, img, gif, especial }, nivel) {

    const imagem = gif
        ? `gifs/${gif}.gif`
        : `imagens/${img}.png`

    return `
    <div class="botao-lateral nivel-${nivel}"
        style="margin-left:${nivel * 12}px">
        <img src="${imagem}" alt="">
            <div>${nome}</div>
            ${especial ? '<span class="menu-etiqueta-especial">especial</span>' : ''}
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
            nome: 'Checklist',
            acesso: 'checklist.ver',
            img: 'prancheta',
            especial: true,
            funcao: 'telaPlanosDiarios'
        },
        {
            nome: 'Início',
            funcao: 'telaInicialGCS',
            img: 'home'
        },
        {
            nome: 'Orçamentos',
            img: 'projeto',
            sub: [
                { nome: 'Ver Orçamentos', funcao: 'telaOrcamentos', acesso: 'orcamentos.ver', img: 'projeto' },
                { nome: 'Dashboard', funcao: 'telaDashboardOrcamentos', acesso: 'orcamentos.dashboard', img: 'dashboard' },
                {
                    nome: 'Criar Orçamento',
                    acesso: 'orcamentos.criar',
                    img: 'projeto',
                    sub: [
                        { nome: 'Em edição', funcao: 'painelEdicao', img: 'projeto' },
                        { nome: 'Dados Cliente', funcao: 'painelClientes', img: 'gerente' },
                        { nome: 'Salvar Orçamento', funcao: 'enviarDadosPrincipal', img: 'salvo' },
                        { nome: 'Apagar Orçamento', funcao: 'apagarOrcamento', img: 'cancel' }
                    ]
                },
                { nome: 'Baixar em Excel', funcao: 'baixarExcelOrcamentos', acesso: 'orcamentos.excel', img: 'excel' }
            ]
        },
        {
            nome: 'Ocorrências',
            img: 'alerta',
            sub: [
                { nome: 'Ver Ocorrências', funcao: 'telaOcorrencias', acesso: 'ocorrencias.ver', img: 'alerta' },
                { nome: 'Dashboard', funcao: 'telaDashboardChamados', acesso: 'ocorrencias.dashboard', img: 'dashboard' },
                { nome: 'Criar Ocorrência', funcao: 'formularioOcorrencia', acesso: 'ocorrencias.criar', img: 'baixar' },
                // O Excel de cada relatório fica na barra do topo da tela (js/relatorio.js), com o mesmo acesso
                // (ocorrencias.relatorio*.excel na Central de Acessos).
                { nome: 'Relatório de Ocorrências', funcao: 'telaRelatorio', acesso: 'ocorrencias.relatorio', img: 'planilha_notas' },
                { nome: 'Relatório de Correções', funcao: 'telaRelatorioCorrecoes', acesso: 'ocorrencias.relatorio_correcoes', img: 'planilha_notas' },
                { nome: 'Relatório de Peças', funcao: 'telaRelatorioPecas', acesso: 'ocorrencias.relatorio_pecas', img: 'planilha_notas' }
            ]
        },
        {
            nome: 'Cadastros',
            img: 'prancheta',
            sub: [
                { nome: 'Criar Cadastro', funcao: 'formularioCliente', acesso: 'cadastros.criar', img: 'baixar' },
                { nome: 'Link de Cadastro', funcao: 'formularioLinkCadastro', acesso: 'cadastros.link', img: 'link' },
                { nome: 'Categorias de Formulário', funcao: 'telaCadastros', acesso: 'cadastros.categorias', img: 'prancheta' },
                { nome: 'Clientes, Usuários & Fornecedores', funcao: 'telaClientes', acesso: 'cadastros.clientes', img: 'prancheta' }
            ]
        },
        {
            nome: 'Contratos',
            img: 'contratos',
            sub: [
                { nome: 'Adicionar Contrato', funcao: 'gerenciarContrato', acesso: 'contratos.adicionar', img: 'baixar' },
                { nome: 'Ver Contratos', funcao: 'telaContratos', acesso: 'contratos.ver', img: 'contratos' }
            ]
        },
        {
            nome: 'Logística',
            img: 'logistica',
            sub: [
                { nome: 'Controle Logístico', funcao: 'telaLogistica', acesso: 'logistica.controle', img: 'logistica' },
                { nome: 'Novo Envio', funcao: 'formularioEnvioLogistica', acesso: 'logistica.novo_envio', img: 'baixar' },
                { nome: 'NFs sem Envio', funcao: 'painelNotasSemEnvio', acesso: 'logistica.nfs_sem_envio', img: 'frete' },
                { nome: 'Requisições sem Envio', funcao: 'painelRequisicoesSemEnvio', acesso: 'logistica.requisicoes_sem_envio', img: 'frete' }
            ]
        },
        // Como as abas do Omie: Vendas e NF-e / Serviços e NFS-e / Compras e Estoque (antes: menu Fiscal).
        // Menu aparece para quem tem alguma das telas dele (Central de Acessos).
        {
            nome: 'Vendas e NF-e',
            img: 'vendas_nfe',
            sub: [
                // Quadro com arraste sobre fluxo_itens (desde 13/11/2026; o antigo, calculado por view, saiu do menu).
                { nome: 'Fluxo de Vendas', funcao: 'telaFluxoItensVendas', img: 'kanban', acesso: 'vendas.fluxo' },
                { nome: 'NF-e Emitidas', funcao: 'telaNotasNFe', img: 'planilha_notas', acesso: 'vendas.nfe_emitidas' },
                // Demonstração, conserto e comodato que precisam voltar (js/remessas_retorno.js, 18/11/2026).
                { nome: 'Remessas a retornar', funcao: 'telaRemessasRetorno', img: 'lista', acesso: 'vendas.remessas' },
                { nome: 'Emitir NF-e', funcao: 'formularioEmissaoNFe', img: 'baixar', acesso: 'vendas.emitir_nfe' },
                { nome: 'Configuração Fiscal', funcao: 'telaConfigFiscal', img: 'engrenagem', acesso: 'fiscal.config' }
            ]
        },
        {
            nome: 'Serviços e NFS-e',
            img: 'servicos_nfse',
            sub: [
                { nome: 'Fluxo de Serviços', funcao: 'telaFluxoServicos', img: 'kanban', acesso: 'servicos.fluxo' },
                { nome: 'NFS-e Emitidas', funcao: 'telaNotasNFSe', img: 'planilha_notas', acesso: 'servicos.nfse_emitidas' },
                { nome: 'Emitir NFS-e', funcao: 'formularioEmissaoNFSe', img: 'baixar', acesso: 'servicos.emitir_nfse' },
                { nome: 'Configuração Fiscal', funcao: 'telaConfigFiscal', img: 'engrenagem', acesso: 'fiscal.config' }
            ]
        },
        {
            nome: 'Compras e Estoque',
            img: 'estoque',
            sub: [
                { nome: 'Fluxo de Compras', funcao: 'telaFluxoCompras', img: 'kanban', acesso: 'compras.fluxo' },
                { nome: 'Notas Recebidas', funcao: 'telaNotasRecebidas', img: 'planilha_notas', acesso: 'compras.notas_recebidas' },
                { nome: 'Créditos IBS/CBS', funcao: 'telaCreditosIbsCbs', img: 'credito', acesso: 'compras.creditos_ibs_cbs' },
                { nome: 'Saldos', funcao: 'telaEstoque', acesso: 'compras.saldos', img: 'estoque' },
                { nome: 'Movimentações', funcao: 'telaMovimentosEstoque', acesso: 'compras.movimentacoes', img: 'movimentacoes_extrato' },
                { nome: 'Locais', funcao: 'telaLocaisEstoque', acesso: 'compras.locais', img: 'estoque' },
                { nome: 'Inventário', funcao: 'telaInventarios', acesso: 'compras.inventario', img: 'prancheta' },
                { nome: 'Uso e consumo', funcao: 'telaUsoConsumoEstoque', acesso: 'compras.uso_consumo', img: 'prancheta' }
            ]
        },
        {
            nome: 'Agenda',
            acesso: 'agenda.ver',
            img: 'reagendar',
            funcao: 'telaAgenda'
        },
        {
            nome: 'Ferramentas e Materiais',
            acesso: 'ferramentas.ver',
            img: 'furadeira',
            funcao: 'telaColaboradores'
        },
        {
            nome: 'Veículos',
            img: 'veiculo',
            sub: [
                { nome: 'Ver Combustíveis', funcao: 'telaVeiculos', acesso: 'veiculos.combustiveis', img: 'veiculo' },
                { nome: 'Adicionar Combustível', funcao: 'painelValores', acesso: 'veiculos.adicionar', img: 'combustivel' },
                { nome: 'Veículos', funcao: 'auxVeiculos', acesso: 'veiculos.cadastro', img: 'veiculo' },
                { nome: 'Rastreamento', funcao: 'telaRastreioFrota', acesso: 'veiculos.rastreio', img: 'mapa' },
                { nome: 'Divisão do combustível', funcao: 'telaDivisaoCombustivel', acesso: 'veiculos.divisao', img: 'divisao_combustivel' }
            ]
        },
        {
            nome: 'Reembolsos',
            img: 'reembolso',
            sub: [
                { nome: 'Ver Pagamentos', funcao: 'telaPagamentos', acesso: 'reembolsos.ver', img: 'reembolso' },
                { nome: 'Solicitar Pagamento', funcao: 'formularioPagamento', acesso: 'reembolsos.solicitar', img: 'dinheiro' },
                {
                    nome: 'Baixar Excel',
                    acesso: 'reembolsos.excel',
                    funcao: 'baixarExcelRelatorioPagamentos',
                    img: 'excel'
                }
            ]
        },
        // Financeiro próprio do GCS (js/financeiro.js, gcs migrations/financeiro.sql). O Dashboard veio de Reembolsos.
        {
            nome: 'Financeiro',
            img: 'dinheiro',
            sub: [
                { nome: 'Fluxo de Caixa', funcao: 'telaFluxoCaixa', acesso: 'financeiro.fluxo_caixa', img: 'dashboard' },
                { nome: 'Faturas a Pagar', funcao: 'telaFaturasPagar', acesso: 'financeiro.faturas_pagar', img: 'pagar' },
                { nome: 'Faturas a Receber', funcao: 'telaFaturasReceber', acesso: 'financeiro.faturas_receber', img: 'receber' },
                { nome: 'Lote de Salários', funcao: 'telaLotesSalarios', acesso: 'financeiro.lote_salarios', img: 'dinheiro' },
                { nome: 'Lote de Vale Refeição', funcao: 'telaLotesAlimentacao', acesso: 'financeiro.lote_alimentacao', img: 'alimentacao' },
                { nome: 'Lote de Transporte', funcao: 'telaLotesTransporte', acesso: 'financeiro.lote_transporte', img: 'transporte' },
                { nome: 'Faturas do Cartão', funcao: 'abrirFaturasCartaoFin', acesso: 'financeiro.cartoes', img: 'cartao' },
                { nome: 'Conciliação Bancária', funcao: 'telaConciliacaoFin', acesso: 'financeiro.conciliacao', img: 'conciliacao' },
                { nome: 'Contas Correntes', funcao: 'telaContasFin', acesso: 'financeiro.contas', img: 'banco' },
                { nome: 'Categorias', funcao: 'telaCategoriasFin', acesso: 'financeiro.categorias', img: 'prancheta' },
                { nome: 'Dashboard', funcao: 'telaDashboardReembolsos', acesso: 'financeiro.dashboard', img: 'dashboard' },
                // Relatórios (antes num menu próprio, com as mesmas permissões).
                { nome: 'Custos por Departamento', funcao: 'telaCustosDepartamentos', acesso: 'financeiro.custos_departamento', img: 'dashboard' },
                { nome: 'Custos de Pessoal', funcao: 'telaCustosPessoal', acesso: 'financeiro.custos_pessoal', img: 'dashboard' }
            ]
        },
        {
            nome: 'Post-it',
            img: 'kanban',
            sub: [
                { nome: 'Ver Post-its', funcao: 'telaPIT', acesso: 'postit.ver', img: 'kanban' },
                { nome: 'Criar Post-it', funcao: 'criarPIT', acesso: 'postit.criar', img: 'baixar' },
                { nome: 'Criar Quadro', funcao: 'criarQuadro', acesso: 'postit.quadro', img: 'baixar' }
            ]
        },
        {
            nome: 'RH',
            img: 'gerente',
            sub: [
                { nome: 'Ver Documentos', funcao: 'telaRH', acesso: 'rh.ver', img: 'gerente' },
                { nome: 'Incluir Documento', funcao: 'incluirDocumento', acesso: 'rh.incluir', img: 'baixar' }
            ]
        },
        {
            nome: 'Composições',
            img: 'composicoes',
            sub: [
                { nome: 'Ver Composições', funcao: 'telaComposicoes', acesso: 'composicoes.ver', img: 'composicoes' },
                { nome: 'Cadastrar Item', funcao: 'cadastrarItem', acesso: 'composicoes.cadastrar', img: 'baixar' },
                { nome: 'Baixar em Excel', funcao: 'baixarExcelComposicoes', acesso: 'composicoes.excel', img: 'excel' }
            ]
        },
        {
            nome: 'Histórico de Uso GCS',
            img: 'pesquisar5',
            acesso: 'sistema.historico',
            sub: [
                { nome: 'Alterações', funcao: 'daily', img: 'pesquisar5' },
                { nome: 'Uso do sistema', funcao: 'telaUsoSistema', img: 'dashboard' }
            ]
        },
        // Quem vê e faz o quê (js/acessos.js): só o adm.
        {
            nome: 'Central de Acessos',
            img: 'cadeado',
            soAdm: true,
            funcao: 'telaCentralAcessos'
        },
        {
            nome: 'GCS no celular',
            funcao: 'abrirGCSNoCelular',
            img: 'celular'
        },
        {
            nome: 'Desconectar',
            funcao: 'deslogarUsuario',
            img: 'sair'
        }
    ]
}
