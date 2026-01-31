let filtroRespost
let arquivado = 'N'
let auxiliarFaturamento = {}

const controles = {
    pagina: 1,
    base: null,
    totalPaginas: 1,
    criarLinha: null,
    body: null,
}

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

function mudarInterruptor(el) {
    const ativo = el.checked
    const label = el.parentElement

    const track = label.querySelector('.track')
    const thumb = label.querySelector('.thumb')

    if (track) track.style.backgroundColor = ativo ? '#4caf50' : '#ccc'
    if (thumb) thumb.style.transform = ativo ? 'translateX(26px)' : 'translateX(0)'
}

async function rstTelaOrcamentos() {
    tela.innerHTML = ''
    await telaOrcamentos()
}

async function confirmarPesquisa(e, coluna, el) {
    if (e?.key && e.key !== 'Enter') return

    if (e) e.preventDefault()

    const termo = el.textContent.replace(/\n/g, '').trim().toLowerCase()
    
    controles.pagina = 1
    if(!termo) return   
    controles.filtros = {
        [coluna]:{
            op: 'includes',
            value: termo
        }
    }

    await paginacao()
}

async function telaOrcamentos() {

    // Inicializar filtros;
    filtrosPesquisa.orcamentos ??= JSON.parse(localStorage.getItem('filtros')) || {}

    const pda = document.querySelector('.tela-gerenciamento')
    if (pda) return await telaInicial()

    atualizarToolbar(true) // GCS no título

    funcaoTela = 'telaOrcamentos'

    const fOn = ['status', 'tags', 'contrato', 'responsaveis', 'cidade', 'valor']
    const cabecs = ['data', 'status', 'pedido', 'notas', 'tags', 'contrato', 'cidade', 'responsaveis', 'indicadores', 'valor', 'ações']
    const filtrosOff = ['status', 'ações', 'indicadores']

    const ths = cabecs
        .map((th, i) => `
            <th>
                <div style="${horizontal}; width: 100%; justify-content: space-between; gap: 1rem;">
                    <span>${inicialMaiuscula(th)}</span>    
                    ${fOn.includes(th) ? `<img onclick="ordenarOrcamentos(${i})" src="imagens/filtro.png" style="width: 1rem;">` : ''}
                </div>
            </th>
            `
        )
        .join('')

    const pesquisa = cabecs
        .map(th => `<th 
                    style="background-color: white; text-align: left;"
                    name="${th}"
                    onkeydown="confirmarPesquisa(event, '${th}', this)"
                    onblur="confirmarPesquisa(null, '${th}', this)"
                    contentEditable="${!filtrosOff.includes(th)}"></th>`)
        .join('')


    const acumulado = `
        <div style="${horizontal}; width: 95vw;">
            <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
            <div id="toolbar"></div>
            <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
        </div>

        <div id="tabelaOrcamento" data-ordem="asc" style="${vertical}; width: 95vw;">
            <div class="topo-tabela" style="justify-content: space-between; width: 100%; background-color: #707070;">
                <div id="paginacao"></div>
                <span style="color: white; cursor: pointer; white-space: nowrap;" onclick="filtroOrcamentos()">Filtros ☰</span>
            </div>
            <div class="div-tabela" style="overflow-x: auto;">
                <table class="tabela">
                    <thead style="box-shadow: 0px 0px 2px #222;">
                        <tr>${ths}</tr>
                        <tr>${pesquisa}</tr>
                    </thead>
                    <tbody id="linhas"></tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>`

    const tabelaOrcamento = document.getElementById('tabelaOrcamento')
    if (!tabelaOrcamento) tela.innerHTML = acumulado

    //await auxDepartamentos()

    await carregarToolbar()
    criarMenus('orcamentos')
    mostrarMenus(false)

    controles.base = 'dados_orcamentos'
    controles.criarLinha = 'criarLinhaOrcamento'
    controles.body = 'linhas'

    await paginacao()

}

async function mudarPagina(valor) {

    if (valor < 0) controles.pagina--
    else controles.pagina++

    await paginacao()

}

async function paginacao() {

    const { pagina, base, body, criarLinha, filtros } = controles

    if (!base || !criarLinha) return console.log('Base/CriarLinha não informado(s)')

    const tbody = document.getElementById(body)
    const tabela = tbody.parentElement
    const cols = tabela.querySelectorAll('thead th').length
    tbody.innerHTML = `
    <tr> 
        <td colspan="${cols}">
            <div style="${horizontal};">
                <img src="gifs/loading.gif" style="width: 5rem;">
            </div>
        </td>
    <tr>`

    const dados = await pesquisarDB({ base, pagina, filtros })
    const p = document.getElementById('paginacao')
    const paginaAtual = document.getElementById('paginaAtual')
    const totalPaginas = document.getElementById('totalPaginas')

    if (!paginaAtual) {
        p.innerHTML = `
            <div style="display: flex; align-items:center; gap:10px; padding: 0.2rem;">
                <img src="imagens/esq.png" style="width: 2rem;" onclick="mudarPagina(-1)">
                <span style="color: white;">
                    Página 
                    <span id="paginaAtual">${pagina}</span> de 
                    <span id="totalPaginas">${dados.paginas}</span>
                </span>
                <img src="imagens/dir.png" style="width: 2rem;" onclick="mudarPagina(1)">
                <span style="color: white;">Dê um <b>ENTER</b> para pesquisar</span>
            </div>
        `
    } else {
        paginaAtual.textContent = pagina
        totalPaginas.textContent = dados.paginas
    }

    let linhas = ''
    for (const d of dados.resultados) {
        linhas += await await window[criarLinha](d)
    }

    tbody.innerHTML = linhas

}

function filtroOrcamentos() {

    const salvo = JSON.parse(localStorage.getItem('filtros')) || {}

    const filtros = {
        arquivado: salvo.arquivado || '',
        meus_orcamentos: salvo.meus_orcamentos || '',
        prioridade: salvo.prioridade || '',
        vinculado: salvo.vinculado || '',
        revisao: salvo.revisao || ''
    }

    const linhas = []

    const interruptor = (chave, ativo) => `
        <label style="position: relative; display: inline-block; width: 50px; height: 24px;">
            <input
                type="checkbox"
                ${ativo ? 'checked' : ''}
                name="filtros"
                onchange="mudarInterruptor(this)"
                data-chave="${chave}"
                style="opacity:0; width:0; height:0;">
                <span class="track" style="background-color:${ativo ? '#4caf50' : '#ccc'}"></span>
                <span class="thumb" style="transform:translateX(${ativo ? '26px' : '0'})"></span>
        </label>`

    for (const [chave, valor] of Object.entries(filtros)) {
        linhas.push({
            texto: inicialMaiuscula(chave),
            elemento: interruptor(chave, valor == 'S')
        })
    }

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: 'salvarFiltrosApp()' }
    ]

    popup({ linhas, botoes, titulo: 'Gerenciar Filtro', nra: false })

}

function salvarFiltrosApp() {

    const filtros = document.querySelectorAll('[name="filtros"]')

    for (const f of filtros) {
        const chave = f.dataset.chave
        const st = f.checked ? 'S' : 'N'
        filtrosPesquisa.orcamentos[chave] = st
    }

}

function scrollar(direcao) {

    direcao = direcao == 'next' ? 1 : -1
    const movimento = 1000 * direcao
    const toolbar = document.getElementById('toolbar')

    if (toolbar) toolbar.scrollBy({ left: movimento, behavior: 'smooth' })

}

async function criarLinhaOrcamento(orcamento, master, idMaster) {

    const { id, dados_orcam } = orcamento

    const cliente = await recuperarDado('dados_clientes', dados_orcam?.omie_cliente) || {}
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

    const totalCustos = Object.values(orcamento?.dados_custos || {}).reduce((acc, val) => acc + val, 0)
    const lucratividade = orcamento.total_geral - totalCustos
    const lucratividadePorcentagem = Number(((lucratividade / orcamento.total_geral) * 100).toFixed(0))

    const responsaveis = Object.entries(orcamento.usuarios || {})
        .map(([user,]) => user)
        .join(', ')

    const cel = (elementos) => `<td class="celula">${elementos}</td>`

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

    const finalElemento = `
        <div style="${vertical}; gap: 2px;">
            ${nomeVinculado}
            ${etiqRevAtual}
            <span>${cliente?.nome || ''}</span>
            ${contrato !== numOficial ? `<div style="${horizontal}; justify-content: end; width: 100%; color: #5f5f5f;"><small>${contrato}</small></div>` : ''}
        </div>
        `

    const data = new Date(orcamento.timestamp).toLocaleDateString()

    // Comentários nos status;
    const info = Object.values(orcamento?.status?.historicoStatus || {}).filter(s => (s.info && s.info !== ''))

    const opcoesPda = abas.map(aba => `<option ${orcamento.aba == aba ? 'selected' : ''}>${aba}</option>`).join('')

    const tags = renderAtivas({ id, recarregarPainel: false })

    const celulas = `
                ${cel(`
            <div style="${vertical}; gap: 2px;">
                <label style="text-align: left;"><b>${orcamento.lpu_ativa}</b></label>
                <span>${data}</span>
                <select name="aba" class="opcoesSelect" onchange="atualizarAba(this, '${id}')">
                    <option></option>
                    ${opcoesPda}
                </select>
            </div>
        `)}
                ${cel(`
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
        `)}
                ${cel(`<div class="bloco-etiquetas">${labels.PEDIDO}</div>`)}
                ${cel(`<div class="bloco-etiquetas">${labels.FATURADO}</div>`)}
                ${cel(`
            <div style="${vertical}; gap: 2px;">
                <img 
                    src="imagens/etiqueta.png" 
                    style="width: 1.2rem;" 
                    onclick="renderPainel('${id}')">
                <div name="tags" style="${vertical}; gap: 1px;">
                    ${tags}
                </div>
            </div>
            `)}
                ${cel(finalElemento)}
                ${cel(`${cliente?.cidade || ''}`)}
                ${cel(`
            <div style="${vertical}">
                <span>${orcamento?.usuario || '--'}</span>
                <span>${responsaveis}</span>
            </div>
        `)}
                ${cel(`
            <div style="${vertical}; width: 100%; gap: 2px;">
                ${orcamento?.checklist?.andamento
            ? `
                    <span>Checklist</span>
                    ${divPorcentagem(orcamento.checklist.andamento)}`
            : ''}
                ${orcamento.dados_custos
            ? `
                    <span>LC %</span>
                    ${divPorcentagem(lucratividadePorcentagem)}`
            : ''}
            </div>
            `)}
                ${cel(`
            <div style="${vertical}; width: 100%;">
                <input style="display: none;" type="number" value="${orcamento.total_geral}">
                <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(orcamento.total_geral)}</span>
            </div>
            `)}
                ${cel(`<img 
                    onclick="${idMaster ? `abrirAtalhos('${id}', '${idMaster}')` : `abrirAtalhos('${id}')`}"
                    src="imagens/pesquisar2.png" 
                    style="width: 1.5rem;">`)}
                `
    // Prioridade;
    const prioridade = verificarPrioridade(orcamento)

    const linha = `
        <tr class="linha-master" id="${id}" data-prioridade="${prioridade}">
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

    const contToolbar = await contarPorCampo({ base: 'dados_orcamentos', path: 'status.atual' })

    const toolbar = document.getElementById('toolbar')

    const fluxogramaCompleto = ['chamados', 'todos', ...fluxograma]

    for (const campo of fluxogramaCompleto) {

        const contagem = contToolbar[campo] || 0

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        const funcao = campo == 'chamados'
            ? `controles.filtros = {'chamado':{op:'=', value: 'S'}}; paginacao()`
            : `controles.filtros = {'status.atual':{op:'=', value: '${campo}'}}; paginacao()`

        const f = campo == 'VENDA DIRETA'
            ? { 1: 'style="background: linear-gradient(45deg, #222, #b12425);"' }
            : {}

        const novaTool = `
                        <div
                            style="opacity: 0.5; height: 3rem;"
                            class="aba-toolbar"
                            data-status="${campo}"
                            name="${campo}"
                            onclick="${funcao}">
                            <label>${campo.toUpperCase()}</label>
                            <span ${f[1]}>${contagem}</span>
                        </div>
                        `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}
