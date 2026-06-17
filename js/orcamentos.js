const stLista = [
    'EM ANDAMENTO',
    'OBRA PARALISADA',
    'CONCLUÍDO',
    'POC EM ANDAMENTO'
]

function formatacaoPagina() {

    const pag = 'orcamentos'
    let status = ''

    if (controles?.[pag]?.filtros?.['preventiva']) {
        status = 'preventiva'

    } else {
        const pesq = controles?.[pag]?.filtros?.['status.atual']
        status = pesq?.op == 'IS_EMPTY'
            ? 'SEM STATUS'
            : pesq?.value || 'todos'
    }

    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => a.style.opacity = 0.5)

    const aba = document.querySelector(`[name="${status}"]`)
    if (aba) aba.style.opacity = 1

}

async function telaOrcamentos() {

    overlayAguarde()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const colunas = {
        'Última alteração': { chave: 'lpu_ativa' },
        'Status': { chave: 'status.atual' },
        'Pedido': { chave: 'snapshots.pedidos' },
        'Notas': { chave: 'snapshots.notas' },
        'Tags': { chave: 'snapshots.tags.*.nome' },
        'Contrato': { chave: 'snapshots.contrato' },
        'Cidade': { chave: 'snapshots.cidade' },
        'Status em Ocorrências': { chave: 'nomesStatus' },
        'Responsaveis': { chave: 'snapshots.responsavel' },
        'Resumo': {},
        'Total do Orçamento': { chave: 'snapshots.valor' },
        'Ações': {}
    }

    const btnExtras = `
        <img src="imagens/alerta.png">
        <div class="filtro-orcamentos" style="${horizontal}; gap: 5px;"></div>
        `

    const tabela = await modTab({
        btnExtras,
        funcaoAdicional: ['formatacaoPagina'],
        colunas,
        ordenar: {
            path: 'timestamp',
            direcao: 'desc'
        },
        base: 'dados_orcamentos',
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        pag: 'orcamentos',
        relacionados: [
            {
                path: 'id',
                tabela: 'vw_orcamentos_vinculados',
                destino: 'vinculados',
                tipo: 'objeto'
            }
        ],
        substituicoes: [
            {
                path: 'dados_orcam.contrato',
                tabela: 'departamentos',
                campoBusca: 'descricao',
                retorno: 'descricao',
                destino: 'departamentoExistente'
            },
            {
                path: 'dados_orcam.contrato',
                tabela: 'dados_ocorrencias',
                campoBusca: 'id',
                retorno: 'snapshots.nomesStatus',
                destino: 'nomesStatus'
            }
        ]
    })

    const acumulado = `
        <div style="${vertical}; width: 95vw;">
            <div style="${horizontal}; width: 95vw;">
                <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
                <div id="toolbar"></div>
                <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
            </div>

            ${tabela}
        </div>
        `

    tela.innerHTML = acumulado

    removerOverlay()
    await paginacao()
    await carregarToolbar()
    await carregarPesquisaOrcamento()

}

async function carregarPesquisaOrcamento() {

    const menuOrcamento = document.querySelector('.filtro-orcamentos')

    const listagens = await recuperarDado('vw_opcoes_filtros', 1) || {}

    const camposFechados = {
        'Status': {
            chave: 'status_orcamentos', // Chave na tabela ref de opções;
            path: 'status.atual'
        },
        'Empresa': {
            chave: 'empresas', 
            path: 'snapshots.empresa' 
        },
        'Tags': {
            chave: 'tags', 
            path: 'snapshots.tags.*.nome' 
        }
    }

    const filtros = Object.entries(camposFechados)
        .map(([titulo, conf]) => {

            return montarDropdownCheckbox({
                pag: 'orcamentos',
                titulo,
                path: conf.path,
                opcoes: listagens?.[conf?.chave] || []
            })

        })

    menuOrcamento.innerHTML = filtros.join('')

}

function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

async function criarLinhaOrcamento(orcamento) {

    const {
        id,
        dados_orcam,
        vinculados,
    } = orcamento || {}

    const master = vinculados?.master
    const idMaster = vinculados
        ? id
        : null

    // Vinculados > relacionados > vw_orcamentos_vinculados;
    const orcsVinculados = Object.values(vinculados?.orcamentos || {})
        .map(orc => linhaOrcamento(orc, dados_orcam?.contrato))
        .join('')

    return `
        ${linhaOrcamento(orcamento)}
        ${orcsVinculados}
    `

    function linhaOrcamento(orcamento = {}, masterAgrupado) {

        const {
            id,
            vinculados,
            usuario,
            dados_orcam,
            departamentoExistente,
            nomesStatus,
            timestamp,
            snapshots,
            total_geral,
            lpu_ativa
        } = orcamento || {}

        const { notas, pedidos, custos } = snapshots || {}
        const { pagamentos = 0, abastecimentos = 0 } = custos || {}

        // Velocímetro
        const totalCusto = pagamentos + abastecimentos
        const porcentagem = Number(((totalCusto / total_geral) * 100).toFixed(1))
        const resumo = criarVelocimetroHTML({ rotulo: 'Custos', limite: 40, valor: porcentagem })

        const labelTipoCorrecao = (nomesStatus || [])
            .map(st => formatacaoTipoCorrecao(st))
            .join('')

        const pedidosStatus = (pedidos || [])
            .map(({ tipo, pedido, valor, autorizado_por }) => {

                const label = `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${tipo || ''}</label>
                    <label>${pedido}</label>
                    ${autorizado_por ? `<label><b>${autorizado_por}</b></label>` : ''}
                    <label>${dinheiro(valor)}</label>
                </div>
                `
                return label
            })
            .join('')

        const notasStatus = (notas || [])
            .map(({ categoria, n_nota, total }) => `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${categoria || ''}</label>
                    <label>${n_nota || ''}</label>
                    <label>${dinheiro(total)}</label>
                </div>
            `)
            .join('')

        // Labels do campo Contrato [Revisão, chamado, cliente, etc]
        const { contrato, executor, venda_direta } = dados_orcam || {}

        const rAtual = orcamento?.revisoes?.atual
        const etiqRevAtual = rAtual
            ? `<span class="etiqueta-revisao">${rAtual}</span>`
            : ''

        const responsaveis = (executor || [])
            .join(', ')

        // idMaster existe e orçamento difrente do master; (Ou seja, slaves);
        const nomeVinculado = master || masterAgrupado
            ? `
            <div style="${horizontal}; gap: 5px;">
                <span>${contrato}</span>
                <div class="viculado">
                    <img src="imagens/link2.png">
                    <span>${master || masterAgrupado}</span>
                </div>
            </div>
            `
            : `<span name="contrato">${contrato}</span>`

        const etiqVendaDireta = venda_direta
            ? `<span class="etiqueta-revisao">Venda Direta</span>`
            : ''

        const finalContrato = `
        <div style="${vertical};text-align: left; gap: 2px;">
            ${nomeVinculado}
            ${etiqRevAtual}
            ${etiqVendaDireta}
            <span>${(snapshots?.cliente || '').toUpperCase()}</span>
            <span>${snapshots?.cnpj || ''}</span>
        </div>`

        // Tags;
        const listaTags = Object.values(snapshots?.tags || {})
            .map(tag => modeloTag(tag, id))
            .join('')

        const data = new Date(timestamp).toLocaleString()
        const celulas = `
        <td>
            <div style="${vertical}">
                <span><b>${lpu_ativa || ''}</b></span>
                <span>${data}</span>
            </div>
        </td>
            <td>
            <div style="${vertical}; gap: 5px;">
                ${seletorStatus(orcamento)}
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Dep</span>
                    <img src="imagens/${departamentoExistente ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        </td>
        <td>
            <div class="bloco-etiquetas">${pedidosStatus}</div>
        </td>
        <td>
            <div class="bloco-etiquetas">${notasStatus}</div>
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${id}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${listaTags}
                </div>
            </div>
        </td>
        <td>${finalContrato}</td>
        <td>${(snapshots?.cidade || '').toUpperCase()}</td>
        <td>
            <div style="${vertical}; gap: 2px;">
                ${labelTipoCorrecao}
            </div>
        </td>
        <td>
            <div style="${vertical}">
                <span>${usuario || ''}</span>
                <span>${responsaveis}</span>
            </div>
        </td>
        <td>
            ${resumo}
        </td>
        <td>
            <div style="${vertical}; width: 100%;">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(total_geral)}</span>
            </div>
        </td>
        <td>
            <img 
                onclick="${idMaster ? `abrirAtalhos('${id}', '${idMaster}')` : `abrirAtalhos('${id}')`}"
                src="imagens/pesquisar2.png"
                style="width: 1.5rem;">
        </td>`

        return `
            <tr class="linha-master">
                ${celulas}
            </tr>`

    }

}

function seletorStatus(orcamento) {

    const { id, status, dados_orcam } = orcamento || {}

    const st = status?.atual || ''

    const opcoes = ['', ...fluxograma]
        .sort((a, b) => a.localeCompare(b))
        .map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`)
        .join('')

    const funcao = dados_orcam?.contrato
        ? `alterarStatus('${id}', this, '${dados_orcam?.contrato}')`
        : `alterarStatus('${id}', this)`

    return `
        <select name="status" class="opcoesSelect" onchange="${funcao}">
            ${opcoes}
        </select>`

}

async function alterarStatus(id, select, numOrc) {

    await enviar(`dados_orcamentos/${id}/status/atual`, select.value)

    if (numOrc && select.value == 'ORC APROVADO')
        await criarDepartamento(numOrc)

}

async function editar(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}

    if (orcamento.aprovacao)
        delete orcamento.aprovacao

    const jaEmEdicao = Object.values(JSON.parse(localStorage.getItem('temporario')) || {})
        .some(orc => orc.id == id)

    if (jaEmEdicao)
        return painelEdicao()

    // Sem edições do mesmo orçamento existentes, continue;
    sessionStorage.setItem('idEdicao', crypto.randomUUID())
    baseOrcamento(orcamento)

    removerPopup()

    precosAntigos = null

    orcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    const {
        esquema_composicoes, 
        dados_composicoes, 
        lpu_ativa,
        tags,
        snapshots,
        dados_orcam 
    } = await recuperarDado('dados_orcamentos', orcam_) || {}

    const novoOrcamento = {
        snapshots: {
            tags: snapshots?.tags || {}
        },
        esquema_composicoes,
        tags,
        dados_composicoes,
        lpu_ativa: lpu_ativa || 'LPU HOPE',
        dados_orcam: {
            ...dados_orcam || {},
            contrato: '',
            analista: acesso.nome_completo,
            email_analista: acesso.email,
            telefone_analista: acesso.telefone
        }
    }

    baseOrcamento(novoOrcamento)

    removerPopup()

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function carregarToolbar() {

    const cont1 = await contarPorCampo({ base: 'dados_orcamentos', path: 'status.atual' })
    const cont4 = await contarPorCampo({ base: 'dados_orcamentos', path: 'preventiva' })

    const contToolbar = {
        ...cont1,
        'preventiva': cont4['S'],
        'SEM STATUS': cont1['EM BRANCO'] || 0
    }

    const toolbar = document.getElementById('toolbar')
    const fluxogramaCompleto = ['preventiva', 'todos', ...fluxograma]

    for (const campo of fluxogramaCompleto) {

        const contagem = contToolbar[campo] || 0

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        const f = campo == 'VENDA DIRETA'
            ? 'style="background: linear-gradient(45deg, #222, #b12425);"'
            : ''

        const novaTool = `
            <div
                style="opacity: 0.5; height: 3rem;"
                class="aba-toolbar"
                data-status="${campo}"
                name="${campo}"
                onclick="filtrarToolbar('${campo}')">
                <label>${campo.toUpperCase()}</label>
                <span ${f}>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}

async function filtrarToolbar(campo) {

    const filtros = {}

    if (campo == 'preventiva') {
        filtros['preventiva'] = { op: '=', value: 'S' }

    } else if (campo !== 'todos') { // Demais campos, exceto 'todos';
        filtros['status.atual'] = { op: '=', value: campo }

    }

    controles.orcamentos.filtros = filtros

    await paginacao()

}

async function baixarExcelOrcamentos() {

    overlayAguarde()

    const schema = {
        view: "vw_relatorio_orcamentos",
        titulo: "Relatorio_Orcamentos.xlsx",

        // Os filtros fixos que você já tinha no relatório
        filtros: [
            { custom: "dados_composicoes IS NOT NULL" }
        ],

        // Dizemos ao gerador quais colunas a View retorna que precisam de formatação visual
        formatacao: {
            datas: ['Última alteração'], // Transforma em DD/MM/AAAA
            moedas: ["Total Geral"]      // Transforma em R$
        }
    }

    await baixarRelatorioExcel(schema, `Orçamentos_${Date.now()}`)

    removerOverlay()

}