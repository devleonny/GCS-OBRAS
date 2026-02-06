const stLista = [
    'EM ANDAMENTO',
    'OBRA PARALISADA',
    'CONCLUÍDO',
    'POC EM ANDAMENTO'
]

const meses = {
    '01': 'Janeiro',
    '02': 'Fevereiro',
    '03': 'Março',
    '04': 'Abril',
    '05': 'Maio',
    '06': 'Junho',
    '07': 'Julho',
    '08': 'Agosto',
    '09': 'Setembro',
    '10': 'Outubro',
    '11': 'Novembro',
    '12': 'Dezembro'
}

async function rstTelaOrcamentos() {
    tela.innerHTML = ''
    await telaOrcamentos()
}

function formatacaoPagina() {

    const pag = 'orcamentos'
    let status = ''

    if (controles?.[pag]?.filtros?.['snapshots.prioridade']) {
        status = 'prioridades'

    } else if (controles?.[pag]?.filtros?.['chamado']) {
        status = 'chamados'

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

    const pda = document.querySelector('.tela-gerenciamento')
    if (pda) return await telaInicial()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const pag = 'orcamentos'
    const colunas = {
        'última alteração': { chave: 'lpu_ativa' },
        'status': { chave: 'status.atual' },
        'pedido': '',
        'notas': '',
        'tags': { chave: 'snapshots.tags' },
        'contrato': { chave: 'snapshots.contrato' },
        'cidade': { chave: 'snapshots.cidade' },
        'responsaveis': { chave: 'snapshots.responsavel' },
        'indicadores': '',
        'valor': { chave: 'snapshots.valor' },
        'ações': ''
    }

    const tabela = modTab({
        funcaoAdicional: ['formatacaoPagina'],
        filtros: { 'dados_orcam': { op: 'NOT_EMPTY' } },
        colunas,
        base: 'dados_orcamentos',
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        pag
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

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento) tela.innerHTML = acumulado

    await carregarToolbar()
    criarMenus('orcamentos')
    mostrarMenus(false)

    await paginacao(pag)

}

function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

async function criarLinhaOrcamento(orcamento, master, idMaster) {

    const { id, dados_orcam, snapshots = {} } = orcamento

    let labels = {
        PEDIDO: '',
        FATURADO: ''
    }

    for (const historico of Object.values(orcamento?.status?.historico || {})) {

        if (labels[historico.status] == undefined) continue
        if (historico.tipo == 'Remessa') continue

        const valor1 = historico.tipo
        const valor2 = historico.status == 'FATURADO' ? historico.nf : historico.pedido
        const valor3 = conversor(historico.valor)

        labels[historico.status] += `
                <div class="etiquetas" style="text-align: left; min-width: 100px;">
                    <label>${valor1}</label>
                    <label>${valor2}</label>
                    ${historico.valor ? `<label>${dinheiro(valor3)}</label>` : ''}
                </div>
                `
    }

    const st = orcamento?.status?.atual || ''
    const opcoes = ['', ...fluxograma].map(fluxo => `<option ${st == fluxo ? 'selected' : ''}>${fluxo}</option>`).join('')

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    // Labels do campo Contrato [Revisão, chamado, cliente, etc]
    const contrato = dados_orcam?.contrato
    const numOficial = String(dados_orcam?.chamado || contrato || '-').trim()
    const rAtual = orcamento?.revisoes?.atual
    const etiqRevAtual = rAtual ? `<span class="etiqueta-revisao">${rAtual}</span>` : ''

    const nomeVinculado = master
        ? `
        <div style="${horizontal}; gap: 5px;">
            <span>${numOficial}</span>
            <div class="viculado">
                <img src="imagens/link2.png">
                <span>${master}</span>
            </div>
        </div>
        `
        : `<span name="contrato">${numOficial}</span>`

    const finalContrato = `
        <div style="${vertical};text-align: left; gap: 2px;">
            ${nomeVinculado}
            ${etiqRevAtual}
            <span>${(snapshots?.cliente || '').toUpperCase()}</span>
            ${contrato !== numOficial ? `<div style="${horizontal}; justify-content: end; width: 100%; color: #5f5f5f;"><small>${contrato}</small></div>` : ''}
        </div>`

    const data = new Date(orcamento.timestamp).toLocaleString()

    // Comentários nos status;
    const info = Object
        .values(orcamento?.status?.historicoStatus || {})
        .filter(s => (s.info && s.info !== ''))

    const opcoesPda = abas
        .map(aba => `<option ${orcamento.aba == aba ? 'selected' : ''}>${aba}</option>`)
        .join('')

    const tags = await renderAtivas({ id, recarregarPainel: false, tags: orcamento.tags || {} })

    const celulas = `
         <td>
            <div style="text-align: left;${vertical}; gap: 2px;">
                <label><b>${orcamento.lpu_ativa}</b></label>
                <span>${data}</span>
                <select name="aba" class="opcoesSelect" onchange="atualizarAba(this, '${id}')">
                    <option></option>
                    ${opcoesPda}
                </select>
            </div>
        </td>
        <td>
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 2px;">
                    <img onclick="mostrarInfo('${id}')" src="imagens/observacao${info.length > 0 ? '' : '_off'}.png">
                    <select name="status" class="opcoesSelect" onchange="id_orcam = '${id}'; alterarStatus(this)">
                        ${opcoes}
                    </select>
                </div>
                <div style="${horizontal}; width: 100%; justify-content: end; gap: 5px;">
                    <span>Dep</span>
                    <img src="imagens/${depPorDesc[numOficial] ? 'concluido' : 'cancel'}.png" style="width: 1.5rem;">
                </div>
            </div>
        </td>
        <td>
            <div class="bloco-etiquetas">${labels.PEDIDO}</div>
        </td>
        <td>
            <div class="bloco-etiquetas">${labels.FATURADO}</div>
        </td>
        <td>
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${id}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${tags}
                </div>
            </div>
        </td>
        <td>${finalContrato}</td>
        <td>${(snapshots?.cidade || '').toUpperCase()}</td>
        <td>
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%; gap: 2px;">
                <span>Checklist</span>
                ${divPorcentagem(orcamento?.checklist?.andamento || 0)}
                <span>LC %</span>
                ${divPorcentagem(0)}
            </div>
        </td>
        <td>
            <div style="${vertical}; width: 100%;">
                <input style="display: none;" type="number" value="${orcamento.total_geral}">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(orcamento.total_geral)}</span>
            </div>
        </td>
        <td>
            <img 
                onclick="${idMaster ? `abrirAtalhos('${id}', '${idMaster}')` : `abrirAtalhos('${id}')`}"
                src="imagens/pesquisar2.png"
                style="width: 1.5rem;">
        </td>`

    const linha = `
        <tr class="linha-master" data-prioridade="${orcamento?.snapshots?.prioridade}">
            ${celulas}
        </tr>`

    return linha

}

function verificarPrioridade(orcamento) {

    const acoes = orcamento?.pda?.acoes || {}
    let prioridade = 3 // Baixa prioridade;

    const souResponsavel = Object
        .values(acoes)
        .some(a => a.responsavel == acesso.usuario && a.status == 'pendente')

    // Sou responsável e a ação está pendente; TRUE
    if (souResponsavel) return 0

    const stLiberado = Object
        .values(orcamento?.status?.historicoStatus || {})
        .some(h => stLista.includes(h.para))

    if (stLiberado) return prioridade

    const inicio = new Date(orcamento?.inicio)
    const hoje = new Date()
    const diffDias = Math.abs(hoje - inicio) / (1000 * 60 * 60 * 24)
    if (diffDias < 7) prioridade = 0
    else if (diffDias < 14) prioridade = 1
    else if (diffDias < 21) prioridade = 2

    return prioridade
}

async function editar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    if (orcamentoBase.aprovacao) delete orcamentoBase.aprovacao

    await baseOrcamento(orcamentoBase)

    removerPopup()

    precosAntigos = null

    orcamentoBase.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function duplicar(orcam_) {

    let orcamentoBase = await recuperarDado('dados_orcamentos', orcam_)
    let novoOrcamento = {}

    novoOrcamento.dados_orcam = orcamentoBase.dados_orcam
    novoOrcamento.esquema_composicoes = orcamentoBase.esquema_composicoes
    novoOrcamento.dados_composicoes = orcamentoBase.dados_composicoes
    novoOrcamento.lpu_ativa = orcamentoBase.lpu_ativa
    novoOrcamento.dados_orcam.contrato = ''
    novoOrcamento.dados_orcam.analista = acesso.nome_completo
    novoOrcamento.dados_orcam.email_analista = acesso.email
    novoOrcamento.dados_orcam.telefone_analista = acesso.telefone

    baseOrcamento(novoOrcamento)

    removerPopup()

    precosAntigos = null

    novoOrcamento.lpu_ativa == 'ALUGUEL'
        ? await telaCriarOrcamentoAluguel()
        : await telaCriarOrcamento()

}

async function excelOrcamentos() {

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Orçamentos')

    // Cabeçalho;
    worksheet.addRow([
        'Data',
        'Hora',
        'Status',
        'Tags',
        'Chamado',
        'Cliente',
        'Cidade',
        'Estado',
        'Usuário',
        'Valor'
    ])

    for (const orcamento of Object.values(db.dados_orcamentos)) {

        const codCliente = orcamento?.dados_orcam?.omie_cliente
        const cliente = db.dados_clientes[codCliente] || {}

        const dt = orcamento?.dados_orcam?.data
        const [data, hora] = dt ? dt.split(', ') : ['', '']

        const nomesTag = Object.keys(orcamento?.tags || {})
            .map(cod => {
                return db.tags_orcamentos[cod] ? db.tags_orcamentos[cod].nome : ''
            }).join(', ')
        const chamado = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato || ''

        const row = [
            data,
            hora,
            orcamento?.status?.atual || 'SEM STATUS',
            nomesTag,
            chamado,
            cliente?.nome || '',
            cliente?.cidade || '',
            cliente?.estado || '',
            orcamento?.usuario || '',
            orcamento?.total_geral || 0,
        ]

        worksheet.addRow(row)
    }

    // ====== ESTILOS ======
    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            cell.alignment = {
                vertical: 'middle',
                horizontal: 'center',
                wrapText: true
            }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }

            // Cabeçalho (primeira linha)
            if (rowNumber === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9D9D9' }
                }
                cell.font = { bold: true }
            }

            // Formatação para colunas numéricas
            if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0.00'
                if (rowNumber !== 1) {
                    cell.alignment.horizontal = 'right'
                }
            }
        })
    })

    // Filtro no cabeçalho
    worksheet.autoFilter = {
        from: 'A1',
        to: 'J1'
    }

    // Ajuste automático de largura das colunas
    worksheet.columns.forEach(col => {
        let maxLength = 10
        col.eachCell(cell => {
            const cellLength = String(cell.value || '').length
            if (cellLength > maxLength) {
                maxLength = cellLength
            }
        })
        col.width = Math.min(maxLength + 2, 50) // Limite máximo de 50
    })

    // Ajusta altura das linhas para conteúdo com quebra
    worksheet.eachRow(row => {
        row.height = 20
    })

    // ====== GERAR ARQUIVO ======
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `orcamentos-${new Date().getTime()}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

async function carregarToolbar() {

    const filtros = { 'dados_orcam': { op: 'NOT_EMPTY' } }
    const cont1 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'status.atual' })
    const cont2 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'chamado' })
    const cont3 = await contarPorCampo({ base: 'dados_orcamentos', filtros, path: 'snapshots.prioridade' })

    const contToolbar = {
        ...cont1,
        'SEM STATUS': cont1['EM BRANCO'] || 0,
        'chamados': cont2['S'],
        'prioridades': ((cont3[0] || 0) + (cont3[1] || 0) + (cont3[2] || 0))
    }

    const toolbar = document.getElementById('toolbar')
    const pag = 'orcamentos'
    const fluxogramaCompleto = ['prioridades', 'chamados', 'todos', ...fluxograma]

    for (const campo of fluxogramaCompleto) {

        const contagem = contToolbar[campo] || 0

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        let filtrosPesq = `'status.atual': {op:'=', value: '${campo}'}`

        if (campo == 'chamados') {
            filtrosPesq = `'chamado': {op:'=', value: 'S'}`

        } else if (campo == 'SEM STATUS') {
            filtrosPesq = `'status.atual': {op: 'IS_EMPTY'}`

        } else if (campo == 'prioridades') {
            filtrosPesq = `'snapshots.prioridade': {op: '<', value: 3}`

        } else if (campo == 'todos') {
            filtrosPesq = ''
        }

        const f = campo == 'VENDA DIRETA'
            ? { 1: 'style="background: linear-gradient(45deg, #222, #b12425);"' }
            : {}

        const novaTool = `
            <div
                style="opacity: 0.5; height: 3rem;"
                class="aba-toolbar"
                data-status="${campo}"
                name="${campo}"
                onclick="
                controles.${pag}.pagina = 1; 
                controles.${pag}.filtros = { 'dados_orcam': { op: 'NOT_EMPTY' }, ${filtrosPesq} };
                paginacao('${pag}')">
                <label>${campo.toUpperCase()}</label>
                <span ${f[1]}>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}
