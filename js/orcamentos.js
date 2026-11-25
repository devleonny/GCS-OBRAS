function formatacaoPagina() {

    const pag = 'orcamentos'
    let status = ''

    const pesq = controles?.[pag]?.filtros?.['nomes_status']
    status = pesq?.op == 'IS_EMPTY'
        ? 'SEM STATUS'
        : pesq?.value || 'TODOS'

    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => {
        a.classList.toggle('selecionada', a.dataset.status === status)
        a.setAttribute('aria-pressed', String(a.dataset.status === status))
    })

    const aba = document.querySelector(`[name="${status}"]`)
    if (aba) aba.classList.add('selecionada')

}

async function telaOrcamentos() {

    const tabela = await modTab({
        btnExtras: `<div class="filtro-orcamentos" style="display: flex; flex-wrap: wrap; gap: 5px;"></div>`,
        funcaoAdicional: ['formatacaoPagina', 'carregarToolbar'],
        colunas: {
            'Última alteração': { chave: 'lpu_ativa' },
            // Status do orçamento = status do chamado (22/11/2026): os das abas do chamado; sem chamado, SEM STATUS.
            'Status': { chave: 'nomes_status' },
            //'Pedido': { chave: 'pedidos.*.pedido' },
            //'Notas': { chave: 'notas.*.n_nota' },
            //'Parcelas': {},
            'Tags': { chave: 'tags.*.nome' },
            'Contrato': { chave: 'contrato' },
            //'Vinculações': { chave: 'vinculados' },
            'Responsaveis': { chave: 'responsaveis' },
            //'Custos': {},
            'Total do Orçamento': { chave: 'total_geral' },
            'Ações': {}
        },
        base: 'mvw_dados_orcamentos',
        detalhes: true,
        criarLinha: 'criarLinhaOrcamento',
        body: 'linhas',
        pag: 'orcamentos'
    })

    const acumulado = `
        <div style="${vertical};">
            <div class="orcamentos-toolbar">
                <button type="button" class="orcamentos-toolbar-nav" aria-label="Ver status anteriores" onclick="scrollar('prev')">‹</button>
                <div id="toolbar"></div>
                <button type="button" class="orcamentos-toolbar-nav" aria-label="Ver próximos status" onclick="scrollar('next')">›</button>
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

    const listagens = await recuperarDado('mvw_opcoes_filtros', 1) || {}

    // Status: pela barra de cima (status dos chamados).
    const camposFechados = {
        'Empresa': {
            chave: 'empresas',
            path: 'empresa'
        },
        'Tags': {
            chave: 'tags',
            path: 'tags.*.nome'
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
        usuario,
        dados_orcam,
        vinculados,
        nomes_status,
        timestamp,
        total_geral,
        lpu_ativa,
        tags,
        contrato: colunaContrato,
        total_pagamentos,
        notas,
        pedidos,
        parcelas
    } = orcamento || {}

    const { contrato, executor, venda_direta } = dados_orcam || {}

    // Velocímetro
    const porcentagem = total_pagamentos
        ? Number(((total_pagamentos / total_geral) * 100).toFixed(1))
        : 0

    const resumo = `
        <div style="${vertical}; align-items: center; gap: 2px;">
            ${criarVelocimetroHTML({ rotulo: 'Custos', limite: 40, valor: porcentagem })}
            <div class="label-botao-custos" onclick="painelCustos('${contrato}')">
                <img src="imagens/painelcustos.png">
                <span>Painel de Custos</span>
            </div>
        </div>
    `

    const labelTipoCorrecao = (nomes_status || [])
        .map(st => formatacaoTipoCorrecao(st))
        .join('')

    const pedidosStatus = (pedidos || [])
        .map(({ tipo, pedido, valor, autorizado_por }) => {

            const label = `
                <div class="orcamento-documento">
                    <div class="orcamento-documento-topo"><strong>${pedido}</strong><span class="orcamento-documento-valor">${dinheiro(valor)}</span></div>
                    <span class="orcamento-documento-info">${tipo || ''}</span>
                    ${autorizado_por ? `<span class="orcamento-documento-info">Autorizado por <b>${autorizado_por}</b></span>` : ''}
                </div>
                `
            return label
        })
        .join('')

    const notasStatus = (notas || [])
        .map(({ id, categoria, n_nota, total, d_emi_inicial, origem }) =>
            pdfDanfe({ categoria, n_nota, id, total, d_emi_inicial, origem })
        )
        .join('')

    const listaParcelas = (parcelas || [])
        .map(({ data_vencimento, valor_documento, app, status_titulo }) =>
            `<div class="orcamento-documento">
                    <div class="orcamento-documento-topo"><span>${data_vencimento || 'Sem vencimento'}</span><span class="orcamento-documento-valor">${dinheiro(valor_documento)}</span></div>
                    <div class="orcamento-parcela-status">
                        <img src="${iconePagamento(status_titulo)}">
                        <span>${status_titulo}</span>
                        <span><b>${app}</b></span>
                    </div>
                </div>
                `
        )
        .join('')

    const baloesVinculos = (vinculados || [])
        .map(contratoItem => {

            const master = contrato == contratoItem

            return `
            <div class="tag-vinculado ${master ? 'master' : 'slave'}">
                <img src="imagens/${master ? 'chave' : 'link2'}.png">
                <span>${contratoItem}</span>
            </div>
        `})
        .join('')

    const rAtual = orcamento?.revisoes?.atual
    const etiqRevAtual = rAtual
        ? `<span class="etiqueta-revisao">${rAtual}</span>`
        : ''

    const responsaveis = (executor || [])
        .join(', ')

    const etiqVendaDireta = venda_direta
        ? `<span class="etiqueta-revisao">Venda Direta</span>`
        : ''

    const finalContrato = `
        <div style="${vertical}; min-width: 150px; text-align: left; gap: 2px;">
            ${etiqRevAtual}
            ${etiqVendaDireta}
            ${colunaContrato.filter(Boolean).map(c => `<span>${c}</span>`).join('')}
        </div>
    `

    // Tags;
    const listaTags = tags
        .map(tag => modeloTag(tag, id))
        .join('')

    const data = new Date(timestamp).toLocaleString()

    const linha = `
        <tr class="linha-master">
            <td>
                <div style="${vertical}">
                    <span><b>${lpu_ativa || ''}</b></span>
                    <span>${data}</span>
                </div>
            </td>

            <td>
                <div style="${vertical}; gap: 5px;">
                    <div style="${vertical}; gap: 2px;">
                        ${labelTipoCorrecao || '<span>SEM STATUS</span>'}
                    </div>
                </div>
            </td>

            <td>
                <div style="${vertical}; gap: 2px;">
                    <div name="tags" data-orcamento="${escaparAtributo(String(id))}" style="${vertical}; gap: 1px; width: 100%;">
                        ${listaTags}
                    </div>
                    <!-- Fora do [name="tags"]: atualizarTagsNaTela troca só a lista, o botão fica. -->
                    <button type="button" class="tag-adicionar" title="Incluir ou remover tags" onclick="renderPainel('${id}')">
                        <img src="imagens/etiqueta.png" alt="">
                        <span>Tag</span>
                    </button>
                </div>
            </td>

            <td>${finalContrato}</td>

            <td>
                <div style="${vertical}">
                    <span>${usuario || ''}</span>
                    <span>${responsaveis}</span>
                </div>
            </td>
            
            <td>
                <div style="${vertical}; width: 100%;">
                    <span style="font-size: 0.8rem; white-space: nowrap;">${dinheiro(total_geral)}</span>
                </div>
            </td>

            <td>
                <img 
                    onclick="abrirAtalhos('${id}')"
                    src="imagens/pesquisar.svg"
                    style="width: 1.5rem;">
            </td>
        </tr>
    `

    const envelopar = (titulo, lista, quantidade = 0) => {

        return `
            <div class="envelope-etiquetas">
                <div class="orcamento-bloco-titulo"><label class="titulo">${titulo}</label><span class="orcamento-bloco-contagem">${quantidade}</span></div>
                <div class="bloco-etiquetas">${lista}</div>
            </div>
        `
    }

    const detalhes = `
        <div class="detalhes-orcamento">
            ${resumo}
            ${envelopar('Vinculados', baloesVinculos || 'Sem vínculos', (vinculados || []).length)}
            ${envelopar('Pedidos', pedidosStatus || 'Sem pedidos', (pedidos || []).length)}
            ${envelopar('Notas', notasStatus || 'Sem notas', (notas || []).length)}
            ${envelopar('Parcelas', listaParcelas || 'Sem parcelas', (parcelas || []).length)}
        </div>
    `

    return { linha, detalhes }

}

async function editar(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}

    if (orcamento.aprovacao)
        delete orcamento.aprovacao

    if (ehOrcamentoLocacao(orcamento.lpu_ativa) && bloquearLocacao())
        return

    const jaEmEdicao = Object.values(JSON.parse(localStorage.getItem('temporario')) || {})
        .some(orc => orc.id == id)

    if (jaEmEdicao)
        return painelEdicao()

    // Sem edições do mesmo orçamento existentes, continue;
    sessionStorage.setItem('idEdicao', crypto.randomUUID())
    baseOrcamento(orcamento)

    removerPopup()

    precosAntigos = null

    ehOrcamentoLocacao(orcamento.lpu_ativa)
        ? await telaCriarOrcamentoLocacao()
        : await telaCriarOrcamento()

}

async function confirmarDuplicarOrcamento(id) {


    popup({
        botoes: [
            {
                texto: 'Confirmar',
                img: 'concluido',
                funcao: `duplicar('${id}')`
            }
        ],
        mensagem: `Deseja duplicar este orçamento? <br>Tudo ficará igual, <b>apenas os dados do cliente</b> que serão removidos.`,
        modal: true
    })

}

async function duplicar(id) {

    overlayAguarde()

    const {
        esquema_composicoes,
        dados_composicoes,
        lpu_ativa,
        tags,
        dados_orcam
    } = await recuperarDado('dados_orcamentos', id) || {}

    if (ehOrcamentoLocacao(lpu_ativa) && bloquearLocacao())
        return

    const novoOrcamento = {
        esquema_composicoes,
        tags,
        dados_composicoes,
        lpu_ativa: lpu_ativa || 'LPU HOPE',
        dados_orcam: {
            ...dados_orcam || {},
            contrato: 'sequencial',
            omie_cliente: null, // Sem os dados do cliente;
            analista: acesso.nome_completo,
            email_analista: acesso.email,
            telefone_analista: acesso.telefone
        }
    }

    // Rascunho próprio: sem isso a cópia ocupava o rascunho que estava aberto nesta aba.
    sessionStorage.setItem('idEdicao', crypto.randomUUID())
    baseOrcamento(novoOrcamento)

    removerTodosPopups()

    ehOrcamentoLocacao(novoOrcamento.lpu_ativa)
        ? await telaCriarOrcamentoLocacao()
        : await telaCriarOrcamento()

}

async function carregarToolbar() {

    try {

        const { resultado } = await contagemStatus()

        // Status dos chamados (gcs mw_qtde_status_orcamentos): TODOS e SEM STATUS primeiro, o resto pela quantidade.
        const fixos = ['TODOS', 'SEM STATUS']
        const lista = [...(resultado || [])]
            .sort((a, b) => (fixos.includes(b.status) - fixos.includes(a.status))
                || (fixos.indexOf(a.status) - fixos.indexOf(b.status))
                || (Number(b.quantidade) - Number(a.quantidade)))

        const toolbar = document.getElementById('toolbar')
        toolbar.innerHTML = lista
            .map(({ status, quantidade }) => `
            <button type="button"
                class="aba-toolbar"
                data-status="${escaparAtributo(status)}"
                name="${escaparAtributo(status)}"
                onclick="filtrarToolbar(this.dataset.status)">
                <label>${escaparAtributo(status)}</label>
                <span>${quantidade}</span>
            </button>
            `)
            .join('')
        formatacaoPagina()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao carregar as quantidades em Status: Tente novamente.' })
    }

}

async function filtrarToolbar(campo) {

    // Status do chamado: item exato da lista (gcs pesquisa-db op "contem"); sem chamado = lista vazia.
    const chave = 'nomes_status'
    controles.orcamentos ??= {}
    controles.orcamentos.filtros ??= {}
    delete controles.orcamentos.filtros.status_atual

    controles.orcamentos.filtros[chave] = campo == 'SEM STATUS'
        ? { op: 'IS_EMPTY' }
        : { op: 'contem', value: campo }

    if (campo == 'TODOS')
        delete controles.orcamentos.filtros[chave]

    await paginacao()

}

async function baixarExcelOrcamentos() {

    overlayAguarde()

    const dados = {
        base: "vw_relatorio_orcamentos",
        titulo: `Orçamentos_${agoraServidor()}`,
        formatacao: {
            datas: ['Última alteração'], // Transforma em DD/MM/AAAA
            moedas: ["Total Geral"]      // Transforma em R$
        }
    }

    await baixarRelatorioExcel(dados)

    removerOverlay()

}

// Status do orçamento = status do chamado (22/11/2026, a pedido): o orçamento mostra os status das abas do
// chamado (o dele ou o do mestre do vínculo); sem chamado, SEM STATUS. Quem muda o andamento lança a correção
// no chamado. REPROVADO PELO FINANCEIRO: atalho daqui para a correção no chamado (só fin, adm e diretoria).
// O historico_status do orçamento fica só como registro do que era marcado à mão antes.
const PERFIS_REPROVADO_FIN = ['fin', 'adm', 'diretoria']

async function verHistoricoStatus(id, contrato) {

    try {

        overlayAguarde()

        const [{ historico_status } = {}, { nomes_status, vinculados } = {}] = await Promise.all([
            recuperarDado('dados_orcamentos', id).then(r => r || {}),
            recuperarDado('mvw_dados_orcamentos', id).then(r => r || {})
        ])

        // Chamado: o do próprio contrato; senão o do mestre do vínculo.
        let chamado = null
        for (const candidato of [contrato, ...(vinculados || []).filter(v => v !== contrato)]) {
            if (!candidato || candidato === 'sequencial') continue
            let existente = null
            try { existente = await consultarChamadoOrcamento(candidato) } catch { }
            if (existente && existente.excluido == null) { chamado = candidato; break }
        }

        const statusChamado = (nomes_status || []).map(st => formatacaoTipoCorrecao(st)).join('')

        const linhas = [
            {
                elemento: `
                    <div style="${horizontal}; gap: 1rem;">
                        <img src="imagens/alerta.png">
                        <span>${chamado
                        ? `O status é o do chamado <b>${escaparAtributo(chamado)}</b>. Para mudar o andamento, lance a correção no chamado.`
                        : 'Sem chamado, o orçamento fica SEM STATUS. O chamado é aberto sozinho alguns minutos depois do orçamento salvo.'}</span>
                    </div>
                    `
            },
            ...(chamado ? [{ texto: 'Status do chamado', elemento: `<div style="${vertical}; gap: 2px;">${statusChamado || 'NÃO ANALISADA'}</div>` }] : []),
            {
                texto: 'Marcado no orçamento (antes do status pelo chamado)',
                elemento: `<div id="historico" style="${vertical}; gap: 0.5rem; width: 100%;"></div>`
            }
        ]

        const ativo = Boolean(chamado)

        const botoes = ativo
            ? [
                { texto: 'Abrir chamado', img: 'alerta', funcao: `abrirChamadoDoStatus('${escaparAtributo(chamado)}')` },
                ...(PERFIS_REPROVADO_FIN.includes(acesso.permissao)
                    ? [{ texto: 'Reprovado pelo financeiro', img: 'cancel', funcao: `reprovarPeloFinanceiro('${escaparAtributo(chamado)}', '${escaparAtributo(id)}')` }]
                    : [])
            ]
            : []

        popup({ linhas, botoes, titulo: 'Histórico de Status' })

        carregarHistoricoStatus(id, historico_status)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao buscar o histórico: Fale com o suporte.' })
    }

}

async function carregarHistoricoStatus(id, historico = null) {

    const local = document.getElementById('historico')

    if (!local)
        return

    local.innerHTML = `<img src="gifs/loading-gcs.png" style="width: 5rem;">`

    const historico_status = historico || (await recuperarDado('dados_orcamentos', id) || {}).historico_status

    const listagem = Object.values(historico_status || {})
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(({ status, usuario, observacao, timestamp }) => `
                    <div class="balao-status">
                        <span class="and">${status}</span>
                        <div style="display: flex; flex-wrap: wrap;">${observacao || ''}</div>
                        <span style="font-style: italic;"><small><b>${usuario}</b>, ${new Date(timestamp).toLocaleString()}</small></span>
                    </div>
                `)
        .join('')

    local.innerHTML = listagem || `
        <div style="${horizontal}; width: stretch;">
            <span>Nada marcado.</span>
        </div>
        `

}

async function abrirChamadoDoStatus(chamado) {
    removerPopup()
    controles.ocorrencias ??= {}
    controles.ocorrencias.filtros = { 'chamados': { op: 'includes', value: chamado } }
    await telaOcorrencias()
}

// Abre a correção do chamado já com REPROVADO PELO FINANCEIRO, na aba do orçamento: lá entram os detalhes,
// os executores e a permissão de quem tem que resolver.
async function reprovarPeloFinanceiro(chamado, idOrcamento) {
    await formularioCorrecao(chamado, null, idOrcamento, { tipoCorrecao: 'stFinRep', nome: 'REPROVADO PELO FINANCEIRO' })
}

