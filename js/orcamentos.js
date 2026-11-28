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

// Passo a passo da primeira vez nesta tela (js/tour.js): aparece sozinho uma vez por usuário; o botão Tour reabre.
const primeiraLinhaOrc = seletor => () => document.querySelector(`#linhas > tr.fin-linha ${seletor}`)

const TOUR_ORCAMENTOS = [
    {
        titulo: 'Bem-vindo aos Orçamentos',
        texto: '<p>Aqui ficam todos os orçamentos, um por linha.</p><p>Em poucos passos mostramos as principais ferramentas da tela. Dá para pular a qualquer momento e rever depois pelo botão <b>Tour</b>.</p>'
    },
    {
        alvo: '.orc-tela .fin-barra',
        titulo: 'Ações da tela',
        texto: '<p><b>Em edição</b> abre os orçamentos que você está montando neste aparelho.</p><p><b>Baixar Excel</b> baixa os orçamentos marcados ou, sem marcação, todos os do filtro.</p>'
    },
    {
        alvo: '.orc-tela .orc-status-bloco',
        antes: () => { if (document.querySelector('[data-corpo-orc]')?.classList.contains('recolhido')) alternarPainelOrcamentos() },
        titulo: 'Status',
        texto: '<p>O status do orçamento é o status do chamado. Clique em um para ver só os orçamentos dele; <b>TODOS</b> volta a lista inteira.</p><p>A setinha ao lado recolhe esta bandeja e dá mais espaço para a tabela.</p>'
    },
    {
        alvo: '.orc-tela .tabela > thead',
        titulo: 'Filtros nas colunas',
        texto: '<p>Cada coluna tem o seu <b>funil</b> para pesquisar. Nas colunas de dinheiro dá para buscar o valor: <kbd>123,52</kbd>, <kbd>&gt;1000</kbd>, <kbd>&lt;0</kbd> ou <kbd>100 a 200</kbd>.</p><p>Clicando no título você ordena, arrasta para mudar a ordem ou esconde a coluna.</p>'
    },
    {
        alvo: primeiraLinhaOrc('td.tabela-coluna-detalhes'),
        titulo: 'Detalhes',
        texto: '<p>O <b>+</b> abre os detalhes do orçamento: custos, vínculos, pedidos, notas e parcelas.</p>'
    },
    {
        alvo: '.orc-tela th.orc-col-marcar',
        titulo: 'Marcar orçamentos',
        texto: '<p>Marque os orçamentos para somar só eles no rodapé ou baixar só eles no Excel.</p><p>A caixinha do título marca a página; depois aparece a opção de marcar <b>todos do filtro</b>.</p>'
    },
    {
        alvo: () => document.querySelector('#linhas > tr.fin-linha'),
        titulo: 'Atalhos do orçamento',
        texto: '<p>Um <b>clique na linha</b> abre os atalhos do orçamento: editar, duplicar, histórico, PDF, Excel do orçamento, painel de custos, vincular e o resto do que dá para fazer com ele.</p>'
    },
    {
        alvo: primeiraLinhaOrc('td.orc-col-empresa'),
        titulo: 'Cliente',
        texto: '<p>A empresa do cliente, com a foto, e logo depois o cliente, o CNPJ e a cidade.</p>'
    },
    {
        alvo: primeiraLinhaOrc('td.orc-col-tags'),
        titulo: 'Tags',
        texto: '<p>Clique nas tags para incluir, tirar ou criar. Quando não cabem, terminam em "..." e a lista inteira aparece ao passar o mouse.</p>'
    },
    {
        alvo: primeiraLinhaOrc('td.orc-col-dif-tipo'),
        titulo: 'Desconto ou acréscimo',
        texto: '<p>Mostra se o total ficou abaixo (<b>Desconto</b>) ou acima (<b>Acréscimo</b>) do valor original, com a porcentagem. A coluna <b>Diferença</b>, ao lado, traz o valor em R$.</p>'
    },
    {
        alvo: primeiraLinhaOrc('td.orc-col-custo'),
        titulo: 'Custo até agora',
        texto: '<p>Quanto já foi gasto no orçamento e a % do total. A barrinha fica <b>amarela</b> a partir de 30% e <b>vermelha</b> a partir de 40%.</p>'
    },
    {
        alvo: '.orc-tela .tabela > tfoot',
        titulo: 'Totais',
        texto: '<p>O rodapé soma as colunas de valor de <b>todos os orçamentos do filtro</b>, de todas as páginas. Com orçamentos marcados, fica azul e soma só os marcados.</p>'
    },
    {
        alvo: '[data-rodape-orc]',
        titulo: 'Páginas',
        texto: '<p>Aqui você vê quantos orçamentos o filtro trouxe e troca de página.</p>'
    },
    {
        alvo: '[data-tour-orc]',
        titulo: 'Pronto!',
        texto: '<p>Para ver este passo a passo de novo, é só clicar em <b>Tour</b>.</p>'
    }
]

async function telaOrcamentos() {

    const pag = 'orcamentos'
    selecaoOrcamentos.clear()
    assinaturaTotaisOrc = null
    // Menu lateral principal recolhido ao abrir: a tabela e a bandeja precisam da largura.
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()

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
                        ${podeExcel ? `<button type="button" onclick="baixarExcelOrcamentos()" title="Com orçamentos marcados, baixa só os marcados; sem marcação, todos os resultados dos filtros aplicados">${iconeFin('excel')} Baixar Excel</button>` : ''}
                        <button type="button" class="tour-destaque" data-tour-orc onclick="iniciarTour('orcamentos', TOUR_ORCAMENTOS)" title="Passo a passo das principais ferramentas desta tela">${iconeFin('ajuda')} Tour</button>
                    </div>
                </header>
                <div class="fin-corpo${aberto ? '' : ' recolhido'}" data-corpo-orc>
                    <div class="fin-tabela-area orc-area" data-tabela-orc></div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelOrcamentos()" aria-expanded="${aberto}"
                            title="${aberto ? 'Recolher' : 'Mostrar'} status">${iconeFin('seta')}</button>
                        <aside class="fin-painel orc-painel">
                            <div class="orc-recolhido-acoes">
                                <button type="button" class="fin-acao" title="Status" onclick="alternarPainelOrcamentos()">${iconeFin('filtro')}<span>Status</span></button>
                            </div>
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
        // Ordem: caixinha (o clique na linha abre os atalhos), dados do cliente (Empresa com a foto, Cliente, CNPJ, Cidade), dados do
        // orçamento e, no fim, os valores juntos. Empresa, CNPJ, foto e requisições vêm da mvw (gcs
        // migrations/orcamentos-dados-cliente.sql).
        colunas: {
            '': {},
            'Empresa': { chave: 'empresa' },
            'Cliente': { chave: 'cliente' },
            'CNPJ': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Contrato': { chave: 'contrato', principal: true },
            'Status': { chave: 'nomes_status' },
            'Tags': { chave: 'tags.*.nome' },
            'LPU': { chave: 'lpu_ativa' },
            'Alteração': {},
            'Usuário': { chave: 'usuario' },
            'Responsáveis': { chave: 'responsaveis' },
            'Valor original': { chave: 'total_bruto', tipoPesquisa: 'valor' },
            'Desc. / Acrés.': { chave: 'diferenca_pct', tipoPesquisa: 'valor' },
            'Diferença': { chave: 'diferenca', tipoPesquisa: 'valor' },
            'Total': { chave: 'total_geral', tipoPesquisa: 'valor' },
            'Pedidos': { chave: 'total_pedidos', tipoPesquisa: 'valor' },
            'Requisições': { chave: 'total_requisicoes', tipoPesquisa: 'valor' },
            'Custo até agora': { chave: 'total_pagamentos', tipoPesquisa: 'valor' }
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
    area.querySelector('.modtab')?.insertAdjacentHTML('afterbegin', '<div class="fin-aviso-selecao" data-aviso-orc hidden></div>')

    removerOverlay()
    await paginacao(pag)

    // Primeira vez do usuário nesta tela: passo a passo (js/tour.js); depois só pelo botão Tour.
    if (typeof tourPrimeiraVez === 'function') tourPrimeiraVez('orcamentos', TOUR_ORCAMENTOS)

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
    prepararTotaisOrcamentos(tabela)
    if (typeof cabecalhoAvancadoTabela === 'function')
        await cabecalhoAvancadoTabela('orcamentos', { prefKey: 'orcamentos' })
    if (typeof atualizarBotaoTodosDetalhes === 'function') atualizarBotaoTodosDetalhes(tbody)
    // Caixinha "marcar todos desta página" no título da coluna vazia (a 1ª depois do "+" dos detalhes).
    const thMarcar = tabela.querySelector(':scope > thead > tr:first-child > th:not(.tabela-coluna-detalhes)')
    if (thMarcar && !thMarcar.querySelector('[data-marcar-todos-orc]')) {
        thMarcar.classList.add('orc-col-marcar')
        thMarcar.innerHTML = '<input type="checkbox" class="fin-marcar" data-marcar-todos-orc title="Marcar todos desta página" aria-label="Marcar todos desta página" onclick="event.stopPropagation(); marcarTodosOrcamentos(this)">'
    }
    const filtroMarcar = tabela.querySelector(':scope > thead > tr:nth-child(2) > th:not(.tabela-coluna-detalhes)')
    if (filtroMarcar?.querySelector('img')) filtroMarcar.innerHTML = ''
    desenharSelecaoOrcamentos()
    desenharRodapeOrcamentos(ctrl)
    totaisOrcamentos(false)
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
    if (botao) botao.title = `${estadoTelaOrcamentos.painel ? 'Recolher' : 'Mostrar'} status`
}

// Linha inteira abre os atalhos do orçamento (fora os botões, o "+" dos detalhes, as tags e os links).
function abrirLinhaOrcamento(event, id) {
    if (event?.target?.closest('button, a, input, select, label, .tabela-coluna-detalhes, .orc-col-tags')) return
    abrirAtalhos(id)
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
    const classe = dif > 0 ? 'orc-acres' : 'orc-desc'
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
        empresa,
        empresa_id,
        cnpj,
        cliente_foto,
        total_requisicoes,
        qtde_requisicoes,
        total_pedidos,
        qtde_pedidos,
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
    // Soma dos pedidos: coluna nativa total_pedidos da mvw (gcs migrations/orcamentos-total-pedidos.sql), com funil de valor.
    const qtdePed = Number(qtde_pedidos) || 0
    const data = timestamp ? new Date(Number(timestamp)).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

    // Foto do cliente; sem foto própria, a da empresa (preencherFotosEmpresaCliente em js/clientes.js); senão as iniciais.
    const avatar = typeof avatarCliente === 'function'
        ? avatarCliente({ foto: cliente_foto, nome: cliente || empresa || '', empresa: empresa_id || empresa })
        : ''
    const documento = cnpj && typeof docFormatadoFis === 'function' ? docFormatadoFis(cnpj) : (cnpj || '')
    const qtdeReq = Number(qtde_requisicoes) || 0
    valoresOrcamentos.set(String(id), valoresTotaisOrc(orcamento))

    const tds = `
        <td class="fin-col-marcar orc-col-marcar">
            <input type="checkbox" class="fin-marcar" data-marcar-orc value="${esc(id)}" ${selecaoOrcamentos.has(String(id)) ? 'checked' : ''}
                onclick="event.stopPropagation(); marcarOrcamento(this)" aria-label="Marcar orçamento">
        </td>
        <td class="fin-obs orc-col-empresa" title="${esc(empresa || 'Sem empresa no cadastro do cliente')}">
            <span class="fin-uma-celula"><span class="orc-avatar">${avatar}</span><span class="fin-obs-txt">${esc(empresa)}</span></span>
        </td>
        ${texto(cliente)}
        <td class="fin-doc">${esc(documento)}</td>
        ${texto(cidade)}
        ${texto(contrato, etiquetas)}
        <td class="fin-obs orc-col-status" title="${esc(listaStatus.join(', ') || 'SEM STATUS')}"><div class="fin-tags-celula">${chipsStatus}</div></td>
        <td class="fin-obs orc-col-tags" title="${esc(tagsOrdenadas.map(t => t?.nome).join(', ') || 'Incluir tags')}"
            data-orcamento="${esc(id)}" onclick="event.stopPropagation(); renderPainel(this.dataset.orcamento)">
            <div class="fin-tags-celula" name="tags" data-chips-orc data-orcamento="${esc(id)}">${tagsOrdenadas.map(chipTagOrcamento).join('') || '<span class="orc-tag-incluir">+ Tag</span>'}</div>
        </td>
        ${texto(lpu_ativa)}
        <td class="orc-col-data">${esc(data)}</td>
        ${texto(usuario)}
        ${texto(responsaveis)}
        <td class="fin-valor">${total_bruto ? dinheiro(total_bruto) : ''}</td>
        <td class="orc-col-dif-tipo">${dif.tipo}</td>
        <td class="fin-valor">${dif.valor}</td>
        <td class="fin-valor orc-col-total">${dinheiro(total_geral)}</td>
        <td class="fin-valor" title="${qtdePed ? `${qtdePed} pedido${qtdePed === 1 ? '' : 's'}` : 'Sem pedidos'}">${qtdePed ? dinheiro(total_pedidos) : ''}</td>
        <td class="fin-valor" title="${qtdeReq ? `${qtdeReq} requisiç${qtdeReq === 1 ? 'ão' : 'ões'}` : 'Sem requisições'}">${qtdeReq ? dinheiro(total_requisicoes) : ''}</td>
        <td class="fin-valor orc-col-custo">${barraCustoOrcamento(total_pagamentos, total_geral)}</td>
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

// ---------------------------------------------------------------- totais embaixo das colunas de valor
// Como nas Faturas (js/financeiro.js totaisFaturasFin): sem marcação, somam TODO o filtro da tabela (todas as páginas,
// soma no servidor pelo contar-por-campo); com orçamentos marcados, somam só os marcados (de qualquer página).
// A soma do filtro só recalcula quando o filtro muda.
const COLUNAS_TOTAL_ORC = ['total_bruto', 'diferenca', 'total_geral', 'total_pedidos', 'total_requisicoes', 'total_pagamentos']
const valoresTotaisOrc = o => Object.fromEntries(COLUNAS_TOTAL_ORC.map(k => [k, o?.[k]]))
// id -> valores somados: preenchido ao desenhar as linhas e ao "selecionar todos do filtro".
const valoresOrcamentos = new Map()
let assinaturaTotaisOrc = null
let somasFiltroOrc = null

// Rodapé na ordem ORIGINAL das colunas (data-col = índice do modTab, com o "+" dos detalhes no 0): criado antes do
// cabecalhoAvancadoTabela, que reordena e esconde as células do tfoot junto com as colunas.
function prepararTotaisOrcamentos(tabela) {
    if (!tabela || tabela.tFoot) return
    const desloca = controles.orcamentos?.detalhes ? 1 : 0
    const chaves = [...Array(desloca).fill(''), ...Object.values(controles.orcamentos?.colunas || {}).map(c => c?.chave || '')]
    const linha = tabela.createTFoot().insertRow()
    linha.className = 'fin-totais'
    chaves.forEach((chave, i) => {
        const td = linha.insertCell()
        td.dataset.col = i
        if (COLUNAS_TOTAL_ORC.includes(chave)) {
            td.dataset.totalOrc = chave
            td.className = 'fin-valor'
        }
    })
}

function escreverTotaisOrcamentos() {
    const marcadas = selecaoOrcamentos.size
    COLUNAS_TOTAL_ORC.forEach((chave, i) => {
        const td = document.querySelector(`[data-total-orc="${chave}"]`)
        if (!td) return
        if (marcadas) {
            let soma = 0, faltam = 0
            selecaoOrcamentos.forEach(id => {
                const v = valoresOrcamentos.get(id)
                if (!v) return faltam++
                soma += Number(v[chave]) || 0
            })
            td.title = `Soma dos ${marcadas} orçamento(s) marcado(s)${faltam ? ` (${faltam} sem valor carregado)` : ''}. Desmarque todos para ver o total do filtro.`
            td.innerHTML = `${i === 0 ? `<small class="fin-total-rotulo">${marcadas} marcado${marcadas === 1 ? '' : 's'}</small> ` : ''}<span class="fin-sigma">Σ</span> ${dinheiro(Math.round(soma * 100) / 100)}`
            td.classList.add('fin-total-selecao')
        } else {
            td.title = 'Total de todos os orçamentos do filtro'
            td.innerHTML = `<span class="fin-sigma">Σ</span> ${somasFiltroOrc?.[i] == null ? '—' : dinheiro(somasFiltroOrc[i])}`
            td.classList.remove('fin-total-selecao')
        }
    })
}

async function totaisOrcamentos(forcar = true) {
    const ctrl = controles.orcamentos
    if (!ctrl || !document.querySelector('[data-total-orc]')) return
    const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
    const assinatura = JSON.stringify(filtros)
    if (!forcar && assinatura === assinaturaTotaisOrc) return escreverTotaisOrcamentos()
    assinaturaTotaisOrc = assinatura
    escreverTotaisOrcamentos()
    const somas = await Promise.all(COLUNAS_TOTAL_ORC.map(async path => {
        try { return Number((await contarPorCampo({ base: 'mvw_dados_orcamentos', path, modo: 'soma', filtros }))?.total || 0) } catch { return null }
    }))
    if (assinatura !== assinaturaTotaisOrc) return
    somasFiltroOrc = somas
    escreverTotaisOrcamentos()
}

// ---------------------------------------------------------------- Marcar orçamentos e baixar em Excel
// Seleção guardada entre páginas e filtros (como Clientes e Notas recebidas): marcar a página inteira mostra o aviso
// "selecionar todos os N deste filtro". O Excel baixa os marcados ou, sem marcação, tudo o que os filtros trazem.
// Base leve vw_orcamentos_excel (gcs migrations/orcamentos-excel-view.sql): a mvw da tela sem as composições.
const selecaoOrcamentos = new Set()

function marcarOrcamento(caixa) {
    if (caixa.checked) selecaoOrcamentos.add(String(caixa.value))
    else selecaoOrcamentos.delete(String(caixa.value))
    desenharSelecaoOrcamentos()
}

function marcarTodosOrcamentos(caixa) {
    document.querySelectorAll('#linhas [data-marcar-orc]').forEach(c => {
        c.checked = caixa.checked
        if (caixa.checked) selecaoOrcamentos.add(String(c.value))
        else selecaoOrcamentos.delete(String(c.value))
    })
    desenharSelecaoOrcamentos()
}

function limparSelecaoOrcamentos() {
    selecaoOrcamentos.clear()
    document.querySelectorAll('#linhas [data-marcar-orc]').forEach(c => { c.checked = false })
    desenharSelecaoOrcamentos()
}

// Busca paginada (2000 por vez) com os filtros dados.
async function buscarTodosOrcamentosFiltro(filtros, ordenar = null) {
    const linhas = []
    let pagina = 1, paginas = 1
    do {
        const r = await pesquisarDB({ base: 'vw_orcamentos_excel', filtros, ...(ordenar ? { ordenar } : {}), pagina, limite: 2000 })
        linhas.push(...(r?.resultados || []))
        paginas = Number(r?.paginas) || 1
        pagina++
    } while (pagina <= paginas && pagina <= 50)
    return linhas
}

const filtrosTabelaOrcamentos = (ctrl = controles.orcamentos) => combinarFiltros(ctrl?.filtros, ctrl?.filtrosFixos) || {}

async function selecionarTodosFiltroOrcamentos() {
    const ctrl = controles.orcamentos
    if (!ctrl) return
    overlayAguarde()
    try {
        const linhas = await buscarTodosOrcamentosFiltro(filtrosTabelaOrcamentos(ctrl))
        linhas.forEach(o => { selecaoOrcamentos.add(String(o.id)); valoresOrcamentos.set(String(o.id), valoresTotaisOrc(o)) })
        document.querySelectorAll('#linhas [data-marcar-orc]').forEach(c => { c.checked = selecaoOrcamentos.has(String(c.value)) })
        desenharSelecaoOrcamentos()
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao marcar os orçamentos do filtro: ${escaparAtributo(err.message || '')}` })
    } finally {
        removerOverlay()
    }
}

function desenharSelecaoOrcamentos() {
    const pagina = [...document.querySelectorAll('#linhas [data-marcar-orc]')]
    const marcadas = pagina.filter(c => c.checked).length
    const paginaToda = pagina.length > 0 && marcadas === pagina.length
    const todas = document.querySelector('[data-marcar-todos-orc]')
    if (todas) {
        todas.checked = paginaToda
        todas.indeterminate = marcadas > 0 && marcadas < pagina.length
    }
    escreverTotaisOrcamentos()
    const aviso = document.querySelector('[data-aviso-orc]')
    if (!aviso) return
    const n = selecaoOrcamentos.size
    const total = Number(document.getElementById('resultados_orcamentos')?.textContent) || 0
    const plural = q => `${q.toLocaleString('pt-BR')} ${q === 1 ? 'orçamento' : 'orçamentos'}`
    const limpar = '<a href="#" onclick="event.preventDefault(); limparSelecaoOrcamentos()">limpar a seleção</a>'
    aviso.hidden = !(n && paginaToda)
    aviso.innerHTML = aviso.hidden ? '' : n < total
        ? `Você selecionou ${plural(n)}. Você pode ${limpar} ou <a href="#" onclick="event.preventDefault(); selecionarTodosFiltroOrcamentos()">selecionar todos os ${plural(total)} deste filtro</a>`
        : `Você selecionou ${n === total ? 'todos os ' : ''}${plural(n)}${n === total ? ' deste filtro' : ''}. Você pode ${limpar}`
}

async function baixarExcelOrcamentos() {
    if (typeof pode === 'function' && !pode('orcamentos.excel'))
        return popup({ mensagem: 'Você não tem acesso para baixar os orçamentos em Excel.' })
    const ctrl = controles.orcamentos
    overlayAguarde()
    try {
        const marcados = [...selecaoOrcamentos]
        const ordenar = ctrl?.ordenar || null
        let linhas = []
        if (marcados.length) {
            // Marcados: em blocos de 500 ids (filtro OR).
            for (let i = 0; i < marcados.length; i += 500) {
                const bloco = marcados.slice(i, i + 500)
                linhas.push(...await buscarTodosOrcamentosFiltro({ id: { modo: 'OR', regras: bloco.map(id => ({ op: '=', value: id })) } }, ordenar))
            }
        } else {
            linhas = await buscarTodosOrcamentosFiltro(filtrosTabelaOrcamentos(ctrl), ordenar)
        }
        if (!ordenar) linhas.sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0))

        const filtros = ctrl && typeof descreverFiltrosFin === 'function'
            ? descreverFiltrosFin(ctrl).replace('nenhum (todas as faturas)', 'nenhum (todos os orçamentos)')
            : ''
        const num = v => (v === null || v === undefined || v === '') ? '' : Number(v) || 0
        const lista = v => (Array.isArray(v) ? v : [v]).filter(Boolean).join(', ')

        await baixarExcelRelatorioGCS({
            titulo: 'Orçamentos',
            tela: 'Orçamentos',
            resumo: `${linhas.length} orçamento(s)`,
            filtrosTexto: marcados.length ? `Orçamentos marcados na tela: ${marcados.length}` : `Filtros: ${filtros}`,
            linhas,
            colunas: [
                { titulo: 'Empresa', largura: 20, valor: o => o.empresa || '' },
                { titulo: 'Cliente', largura: 34, valor: o => o.cliente || '' },
                { titulo: 'CNPJ', largura: 19, valor: o => o.cnpj && typeof docFormatadoFis === 'function' ? docFormatadoFis(o.cnpj) : (o.cnpj || '') },
                { titulo: 'Cidade', largura: 20, valor: o => o.cidade || '' },
                { titulo: 'Contrato', largura: 14, valor: o => o.dados_orcam?.contrato || '' },
                { titulo: 'Revisão', largura: 9, centro: true, valor: o => o.revisoes?.atual || '' },
                { titulo: 'Venda direta', largura: 8, centro: true, valor: o => o.dados_orcam?.venda_direta ? 'Sim' : '' },
                { titulo: 'LPU', largura: 16, valor: o => o.lpu_ativa || '' },
                { titulo: 'Status', largura: 26, valor: o => lista(o.nomes_status) || 'SEM STATUS' },
                { titulo: 'Tags', largura: 26, valor: o => (o.tags || []).map(t => t?.nome).filter(Boolean).join(', ') },
                { titulo: 'Última alteração', largura: 13, tipo: 'data', valor: o => o.timestamp ? new Date(Number(o.timestamp)) : '' },
                { titulo: 'Usuário', largura: 16, valor: o => o.usuario || '' },
                { titulo: 'Responsáveis', largura: 26, valor: o => lista(o.dados_orcam?.executor) },
                { titulo: 'Vinculados', largura: 20, valor: o => lista(o.vinculados) },
                { titulo: 'Valor original', largura: 15, tipo: 'moeda', soma: true, valor: o => num(o.total_bruto) },
                { titulo: 'Desc. / Acrés.', largura: 12, centro: true, valor: o => Number(o.diferenca) < 0 ? 'Desconto' : Number(o.diferenca) > 0 ? 'Acréscimo' : '' },
                { titulo: 'Diferença %', largura: 11, valor: o => num(o.diferenca_pct) },
                { titulo: 'Diferença', largura: 14, tipo: 'moeda', soma: true, valor: o => num(o.diferenca) },
                { titulo: 'Total', largura: 15, tipo: 'moeda', soma: true, valor: o => Number(o.total_geral) || 0 },
                { titulo: 'Pedidos', largura: 15, tipo: 'moeda', soma: true, valor: o => Number(o.total_pedidos) || 0 },
                { titulo: 'Nº dos pedidos', largura: 22, valor: o => (o.pedidos || []).map(p => p?.pedido).filter(Boolean).join(', ') },
                { titulo: 'Requisições', largura: 15, tipo: 'moeda', soma: true, valor: o => Number(o.total_requisicoes) || 0 },
                { titulo: 'Qtde. de requisições', largura: 10, centro: true, valor: o => Number(o.qtde_requisicoes) || 0 },
                { titulo: 'Notas', largura: 22, valor: o => (o.notas || []).map(n => n?.n_nota).filter(Boolean).join(', ') },
                { titulo: 'Custo até agora', largura: 15, tipo: 'moeda', soma: true, valor: o => Number(o.total_pagamentos) || 0 },
                { titulo: 'Custo % do total', largura: 11, valor: o => Number(o.total_geral) ? Math.round(Number(o.total_pagamentos || 0) / Number(o.total_geral) * 1000) / 10 : '' }
            ]
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escaparAtributo(err.message || '')}` })
    } finally {
        removerOverlay()
    }
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

