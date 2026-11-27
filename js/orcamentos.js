// Tela de orçamentos no layout financeiro (27/11/2026): ações na barra do topo, tabela de uma linha por orçamento
// (fin-uma-linha) com o "+" dos detalhes, funil nas colunas e paginação no rodapé; os status (antes a faixa de
// abas do topo), Empresa e Tags ficam na bandeja da direita.
const estadoTelaOrcamentos = { painel: true }
const POR_PAGINA_ORCAMENTOS = 50

function formatacaoPagina() {

    const pag = 'orcamentos'

    const pesq = controles?.[pag]?.filtros?.['nomes_status']
    const status = pesq?.op == 'IS_EMPTY'
        ? 'SEM STATUS'
        : pesq?.value || 'TODOS'

    document.querySelectorAll('.orc-status-item').forEach(a => {
        const ativo = a.dataset.status === status
        a.classList.toggle('selecionada', ativo)
        a.setAttribute('aria-pressed', String(ativo))
    })

}

async function telaOrcamentos() {

    const pag = 'orcamentos'

    // No celular a bandeja é uma gaveta por cima da tabela: começa fechada.
    if (window.matchMedia?.('(max-width: 800px)').matches) estadoTelaOrcamentos.painel = false
    const aberto = estadoTelaOrcamentos.painel

    const podeCriar = typeof pode !== 'function' || pode('orcamentos.criar')
    const podeExcel = typeof pode !== 'function' || pode('orcamentos.excel')

    tela.innerHTML = `
        <div class="fis-pagina fin-tela fin-uma-linha orc-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Orçamentos</h2>
                    <div class="fin-barra">
                        ${podeCriar ? `<button type="button" onclick="painelEdicao()" title="Orçamentos em edição neste aparelho">${iconeFin('editar')} Em edição</button>` : ''}
                        ${podeExcel ? `<button type="button" onclick="baixarExcelOrcamentos()" title="Baixar os orçamentos em Excel">${iconeFin('excel')} Excel</button>` : ''}
                    </div>
                </header>
                <div class="fin-corpo${aberto ? '' : ' recolhido'}" data-corpo-orc>
                    <div class="fin-tabela-area orc-area" data-tabela-orc></div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelOrcamentos()" aria-expanded="${aberto}"
                            title="${aberto ? 'Recolher' : 'Mostrar'} status e filtros">${iconeFin('seta')}</button>
                        <aside class="fin-painel orc-painel">
                            <div class="orc-recolhido-acoes">
                                <button type="button" class="fin-acao" title="Status e filtros" onclick="alternarPainelOrcamentos()">${iconeFin('filtro')}<span>Status</span></button>
                            </div>
                            <div class="orc-filtros filtro-orcamentos"></div>
                            <div class="orc-status-bloco">
                                <span class="orc-status-titulo">Status</span>
                                <div class="orc-status-lista" id="orc-status"></div>
                            </div>
                        </aside>
                    </div>
                </div>
            </section>
        </div>`

    const area = tela.querySelector('[data-tabela-orc]')
    area.innerHTML = await modTab({
        pag,
        base: 'mvw_dados_orcamentos',
        // Status do orçamento = status do chamado (22/11/2026): os das abas do chamado; sem chamado, SEM STATUS.
        colunas: {
            'Alteração': {},
            'LPU': { chave: 'lpu_ativa' },
            'Status': { chave: 'nomes_status' },
            'Tags': { chave: 'tags.*.nome' },
            'Contrato': { chave: 'contrato', principal: true },
            'Cliente': { chave: 'cliente' },
            'Cidade': { chave: 'cidade' },
            'Usuário': { chave: 'usuario' },
            'Responsáveis': { chave: 'responsaveis' },
            'Valor original': { chave: 'total_bruto', tipoPesquisa: 'valor' },
            'Desc. / Acrés.': { chave: 'diferenca_pct', tipoPesquisa: 'valor' },
            'Diferença': { chave: 'diferenca', tipoPesquisa: 'valor' },
            'Total': { chave: 'total_geral', tipoPesquisa: 'valor' },
            'Pedidos': {},
            'Custo até agora': { chave: 'total_pagamentos', tipoPesquisa: 'valor' },
            'Ações': {}
        },
        funcaoAdicional: ['aposCarregarOrcamentos'],
        body: 'linhas',
        caber: true,
        limite: POR_PAGINA_ORCAMENTOS,
        detalhes: true,
        criarLinha: 'criarLinhaOrcamento'
    })
    // Paginação no rodapé da janela (a do modTab fica escondida neste layout).
    area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-orc></div>')

    removerOverlay()
    await paginacao(pag)
    await carregarPesquisaOrcamento()

}

async function aposCarregarOrcamentos() {
    const ctrl = controles.orcamentos
    const tbody = document.getElementById('linhas')
    const tabela = tbody?.closest('table')
    if (!tabela) return
    // Linha de enchimento: a tabela ocupa a altura da tela mesmo com poucas linhas.
    if (!tabela.querySelector(':scope > tbody.fin-enchimento')) {
        const n = tabela.querySelector(':scope > thead > tr')?.children.length || 1
        const enchimento = document.createElement('tbody')
        enchimento.className = 'fin-enchimento'
        enchimento.innerHTML = `<tr><td colspan="${n}"></td></tr>`
        tabela.appendChild(enchimento)
    }
    // "+" de expandir todos: do topo do modTab (escondido neste layout) para o título da coluna dos detalhes.
    const expandir = tabela.closest('.modtab')?.querySelector('.topo-tabela [data-expandir-todos]')
    const thDetalhes = tabela.querySelector(':scope > thead > tr:first-child > th.tabela-coluna-detalhes')
    if (expandir && thDetalhes) thDetalhes.appendChild(expandir)
    if (typeof cabecalhoAvancadoTabela === 'function')
        await cabecalhoAvancadoTabela('orcamentos', { prefKey: 'orcamentos' })
    if (typeof atualizarBotaoTodosDetalhes === 'function') atualizarBotaoTodosDetalhes(tbody)
    desenharRodapeOrcamentos(ctrl)
    formatacaoPagina()
    await carregarToolbar()
}

function desenharRodapeOrcamentos(ctrl = controles.orcamentos) {
    const alvo = document.querySelector('[data-rodape-orc]')
    if (!alvo || !ctrl) return
    const total = Number(document.getElementById('resultados_orcamentos')?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const porPagina = Number(ctrl.limite) || POR_PAGINA_ORCAMENTOS
    const inicio = total ? (pagina - 1) * porPagina + 1 : 0
    const fim = Math.min(total, pagina * porPagina)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaOrcamentos(${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span class="fin-rodape-info"><span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} orçamento${total === 1 ? '' : 's'}</span>${typeof filtrosAtivosRodapeCab === 'function' ? filtrosAtivosRodapeCab(ctrl.pag) : ''}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaOrcamentos(this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaOrcamentos(n) {
    const ctrl = controles.orcamentos
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeOrcamentos(ctrl)
    ctrl.pagina = pagina
    await paginacao('orcamentos')
}

function alternarPainelOrcamentos() {
    const corpo = document.querySelector('[data-corpo-orc]')
    if (!corpo) return
    estadoTelaOrcamentos.painel = corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !estadoTelaOrcamentos.painel)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(estadoTelaOrcamentos.painel))
    if (botao) botao.title = `${estadoTelaOrcamentos.painel ? 'Recolher' : 'Mostrar'} status e filtros`
}

// Linha inteira abre os atalhos do orçamento (fora os botões, o "+" dos detalhes, as tags e os links).
function abrirLinhaOrcamento(event, id) {
    if (event?.target?.closest('button, a, input, select, label, .tabela-coluna-detalhes, .orc-col-tags')) return
    abrirAtalhos(id)
}

async function carregarPesquisaOrcamento() {

    const menuOrcamento = document.querySelector('.filtro-orcamentos')
    if (!menuOrcamento) return

    const listagens = await recuperarDado('mvw_opcoes_filtros', 1) || {}

    // Status: pela lista da bandeja (status dos chamados).
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

    menuOrcamento.innerHTML = Object.entries(camposFechados)
        .map(([titulo, conf]) => montarDropdownCheckbox({
            pag: 'orcamentos',
            titulo,
            path: conf.path,
            opcoes: listagens?.[conf?.chave] || []
        }))
        .join('')

}

// Andamento do custo: mesmas faixas do velocímetro dos detalhes (limite 40%: a partir de 30% atenção, 40% crítico).
function barraCustoOrcamento(custo, total) {
    const valor = Number(custo) || 0
    const base = Number(total) || 0
    if (!valor) return '<span class="orc-custo vazio">—</span>'
    const pct = base > 0 ? (valor / base) * 100 : null
    const situacao = pct == null ? 'critico' : pct >= 40 ? 'critico' : pct >= 30 ? 'atencao' : 'normal'
    const largura = pct == null ? 100 : Math.max(2, Math.min(100, pct))
    const textoPct = pct == null ? '—' : `${pct.toLocaleString('pt-BR', { maximumFractionDigits: pct < 10 ? 1 : 0 })}%`
    return `<span class="orc-custo ${situacao}" title="${escaparAtributo(dinheiroTexto(valor))} de custo${pct == null ? '' : ` = ${textoPct} do total`}">
        <span class="orc-custo-valor">${dinheiro(valor)}</span>
        <span class="orc-custo-barra"><i style="width: ${largura}%"></i></span>
        <span class="orc-custo-pct">${textoPct}</span>
    </span>`
}

// Diferença entre o Total e o Valor original: colunas nativas da mvw_dados_orcamentos (gcs
// migrations/orcamentos-diferenca.sql), diferenca = total_geral − total_bruto em R$ e diferenca_pct = % sobre o
// original; negativo = desconto, positivo = acréscimo, nulo sem valor original. Funil: "<0" só descontos, ">0" acréscimos.
function diferencaOrcamento(diferenca, diferencaPct, bruto) {
    if (diferenca === null || diferenca === undefined || diferenca === '') return { tipo: '', valor: '' }
    const dif = Number(diferenca) || 0
    if (!dif) return { tipo: '<span class="orc-dif zero">Sem diferença</span>', valor: '<span class="orc-dif zero">—</span>' }
    const pct = Math.abs(Number(diferencaPct) || 0)
    const nome = dif > 0 ? 'Acréscimo' : 'Desconto'
    const classe = dif > 0 ? 'acrescimo' : 'desconto'
    const textoPct = pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    const titulo = `${nome} de ${escaparAtributo(dinheiroTexto(Math.abs(dif)))} (${textoPct}%)${bruto ? ` sobre ${escaparAtributo(dinheiroTexto(bruto))}` : ''}`
    return {
        tipo: `<span class="orc-dif-tipo ${classe}" title="${titulo}"><span aria-hidden="true">${dif > 0 ? '▲' : '▼'}</span>${nome}<small>${textoPct}%</small></span>`,
        valor: `<span class="orc-dif ${classe}" title="${titulo}">${dif > 0 ? '+' : '−'} ${dinheiro(Math.abs(dif))}</span>`
    }
}

// Chip da tag do orçamento na linha (mesmo chip das tags de pagamento: cheio na cor, encolhe com reticências).
// O clique na célula abre o painel das tags (vincular, tirar, editar).
const chipTagOrcamento = tag => typeof chipTagPag === 'function'
    ? chipTagPag({ nome: tag?.nome, cor: tag?.cor })
    : `<span class="tag-pag"><span class="tag-pag-nome">${escaparAtributo(tag?.nome || '--')}</span></span>`

async function criarLinhaOrcamento(orcamento) {

    const {
        id,
        usuario,
        dados_orcam,
        vinculados,
        nomes_status,
        timestamp,
        total_geral,
        total_bruto,
        diferenca,
        diferenca_pct,
        lpu_ativa,
        tags,
        cliente,
        cidade,
        total_pagamentos,
        notas,
        pedidos,
        parcelas
    } = orcamento || {}

    const { contrato, executor, venda_direta } = dados_orcam || {}
    const esc = v => escaparAtributo(v ?? '')

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

    const pedidosStatus = (pedidos || [])
        .map(({ tipo, pedido, valor, autorizado_por }) => `
                <div class="orcamento-documento">
                    <div class="orcamento-documento-topo"><strong>${pedido}</strong><span class="orcamento-documento-valor">${dinheiro(valor)}</span></div>
                    <span class="orcamento-documento-info">${tipo || ''}</span>
                    ${autorizado_por ? `<span class="orcamento-documento-info">Autorizado por <b>${autorizado_por}</b></span>` : ''}
                </div>
                `)
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

    // Uma linha por orçamento: o que não cabe termina em "..." e o texto inteiro fica no title.
    const texto = (valor, extra = '') => `<td class="fin-obs" title="${esc(valor)}"><span class="fin-uma-celula"><span class="fin-obs-txt">${esc(valor)}</span>${extra}</span></td>`

    const listaStatus = (nomes_status || []).filter(Boolean)
    const chipsStatus = listaStatus.length
        ? listaStatus.map(st => formatacaoTipoCorrecao(esc(st))).join('')
        : '<span class="orc-sem-status">SEM STATUS</span>'

    const tagsOrdenadas = [...(tags || [])]
        .sort((a, b) => String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR'))

    const rAtual = orcamento?.revisoes?.atual
    const etiquetas = [
        rAtual ? `<span class="etiqueta-revisao">${esc(rAtual)}</span>` : '',
        venda_direta ? '<span class="etiqueta-revisao">Venda Direta</span>' : ''
    ].join('')

    const responsaveis = (Array.isArray(executor) ? executor : [executor]).filter(Boolean).join(', ')
    const dif = diferencaOrcamento(diferenca, diferenca_pct, total_bruto)
    const totalPedidos = (pedidos || []).reduce((s, p) => s + (Number(p?.valor) || 0), 0)
    const data = timestamp ? new Date(Number(timestamp)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

    const tds = `
        <td class="orc-col-data">${esc(data)}</td>
        ${texto(lpu_ativa)}
        <td class="fin-obs orc-col-status" title="${esc(listaStatus.join(', ') || 'SEM STATUS')}"><div class="fin-tags-celula">${chipsStatus}</div></td>
        <td class="fin-obs orc-col-tags" title="${esc(tagsOrdenadas.map(t => t?.nome).join(', ') || 'Incluir tags')}"
            data-orcamento="${esc(id)}" onclick="event.stopPropagation(); renderPainel(this.dataset.orcamento)">
            <div class="fin-tags-celula" name="tags" data-chips-orc data-orcamento="${esc(id)}">${tagsOrdenadas.map(chipTagOrcamento).join('') || '<span class="orc-tag-incluir">+ Tag</span>'}</div>
        </td>
        ${texto(contrato, etiquetas)}
        ${texto(cliente)}
        ${texto(cidade)}
        ${texto(usuario)}
        ${texto(responsaveis)}
        <td class="fin-valor">${total_bruto ? dinheiro(total_bruto) : ''}</td>
        <td class="orc-col-dif-tipo">${dif.tipo}</td>
        <td class="fin-valor">${dif.valor}</td>
        <td class="fin-valor orc-col-total">${dinheiro(total_geral)}</td>
        <td class="fin-valor">${totalPedidos ? dinheiro(totalPedidos) : ''}</td>
        <td class="fin-valor orc-col-custo">${barraCustoOrcamento(total_pagamentos, total_geral)}</td>
        <td class="orc-col-acoes">
            <button type="button" class="orc-atalhos" title="Atalhos do orçamento" aria-label="Atalhos do orçamento"
                data-orcamento="${esc(id)}" onclick="abrirAtalhos(this.dataset.orcamento)">
                <img src="imagens/pesquisar.svg" alt="">
            </button>
        </td>
    `

    const envelopar = (titulo, lista, quantidade = 0) => `
            <div class="envelope-etiquetas">
                <div class="orcamento-bloco-titulo"><label class="titulo">${titulo}</label><span class="orcamento-bloco-contagem">${quantidade}</span></div>
                <div class="bloco-etiquetas">${lista}</div>
            </div>
        `

    const detalhes = `
        <div class="detalhes-orcamento">
            ${resumo}
            ${envelopar('Vinculados', baloesVinculos || 'Sem vínculos', (vinculados || []).length)}
            ${envelopar('Pedidos', pedidosStatus || 'Sem pedidos', (pedidos || []).length)}
            ${envelopar('Notas', notasStatus || 'Sem notas', (notas || []).length)}
            ${envelopar('Parcelas', listaParcelas || 'Sem parcelas', (parcelas || []).length)}
        </div>
    `

    return {
        linha: `<tr class="fin-linha linha-master" data-orc-linha="${esc(id)}" onclick="abrirLinhaOrcamento(event, this.dataset.orcLinha)">${tds}</tr>`,
        detalhes
    }

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

// Status dos chamados na bandeja da direita (antes a faixa de abas no topo da tela).
async function carregarToolbar() {

    const lista = document.getElementById('orc-status')
    if (!lista) return

    try {

        const { resultado } = await contagemStatus()

        // Status dos chamados (gcs mw_qtde_status_orcamentos): TODOS e SEM STATUS primeiro, o resto pela quantidade.
        const fixos = ['TODOS', 'SEM STATUS']
        const ordenados = [...(resultado || [])]
            .sort((a, b) => (fixos.includes(b.status) - fixos.includes(a.status))
                || (fixos.indexOf(a.status) - fixos.indexOf(b.status))
                || (Number(b.quantidade) - Number(a.quantidade)))

        lista.innerHTML = ordenados
            .map(({ status, quantidade }) => `
            <button type="button"
                class="orc-status-item"
                data-status="${escaparAtributo(status)}"
                title="${escaparAtributo(status)}"
                onclick="filtrarToolbar(this.dataset.status)">
                <span class="orc-status-nome">${escaparAtributo(status)}</span>
                <span class="orc-status-qtde">${Number(quantidade || 0).toLocaleString('pt-BR')}</span>
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

