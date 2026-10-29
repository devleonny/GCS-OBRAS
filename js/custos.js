// Painel de Custos: os números vêm de /painel-custos, a mesma fonte do relatório de custos
// (pagamentos válidos + PESSOAL). Todos veem o pessoal como valor geral; adm/diretoria/fin
// veem também o detalhe mensal e o atalho para a tela Custos de Pessoal.
const dadosPainelCustos = new Map()

async function buscarPainelCustos(contrato) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
    const resposta = await fetch(`${api}/painel-custos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contrato })
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok)
        throw new Error(dados.mensagem || `Falha ao abrir custos (${resposta.status})`)
    dadosPainelCustos.set(contrato, dados)
    return dados
}

function mesCurtoPainel(mes) {
    const [ano, numero] = String(mes).split('-').map(Number)
    return new Date(ano, numero - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')
}

function abrirCustosPessoalDoPainel() {
    removerTodosPopups()
    telaCustosPessoal()
}

// Acima de 40% do orçamento o custo fica em alerta; acima de 100%, estourado.
const LIMITE_ALERTA_CUSTO = 40

async function painelCustos(contrato) {

    try {

        overlayAguarde()

        const {
            existe,
            total_geral,
            custo_total,
            custo_realizado,
            custo_previsto,
            custo_pessoal,
            pessoal_por_mes,
            cidade,
            cliente
        } = await buscarPainelCustos(contrato)

        if (!existe)
            return popup({ mensagem: 'Não existe centro de custo criado para este orçamento. <br><small>Mude o orçamento para aprovado primeiro!</small>' })

        const orcamento = Number(total_geral || 0)
        const percentual = orcamento ? Math.round(custo_total / orcamento * 1000) / 10 : null
        // Mesmas faixas do velocímetro: atenção 10 pontos antes do limite, crítico no limite.
        const faixa = percentual === null ? ''
            : percentual > 100 ? 'estourado'
                : percentual >= LIMITE_ALERTA_CUSTO ? 'critico'
                    : percentual >= LIMITE_ALERTA_CUSTO - 10 ? 'alerta' : 'ok'
        const situacao = {
            ok: 'Dentro do esperado',
            alerta: 'Atenção: perto do limite',
            critico: 'Acima do limite de custo',
            estourado: 'Custo acima do orçamento'
        }[faixa] || 'Sem orçamento vinculado'
        const saldo = orcamento - custo_total
        const percentualTexto = percentual === null ? '—' : `${String(percentual).replace('.', ',')}%`

        // Detalhe do pessoal só chega do servidor para adm/diretoria/fin.
        const detalhePessoal = Array.isArray(pessoal_por_mes)
            ? `
                ${pessoal_por_mes.length ? `<div class="pc-meses">${pessoal_por_mes.map(p => `<span>${mesCurtoPainel(p.mes)} <b>${dinheiro(p.valor)}</b></span>`).join('')}</div>` : ''}
                <button type="button" class="pc-link" onclick="abrirCustosPessoalDoPainel()">Ver Custos de Pessoal →</button>`
            : ''

        const local = [cliente, cidade].filter(Boolean).map(v => escaparAtributo(v)).join(' · ')

        const elemento = `
            <div class="painel-custos-erp pc-painel">

                <header class="pc-topo">
                    <div class="pc-identificacao">
                        <span class="pc-contrato">${escaparAtributo(contrato)}</span>
                        ${local ? `<span class="pc-local">${local}</span>` : ''}
                    </div>
                    <nav class="pc-abas" role="tablist">
                        <button type="button" class="ativa" onclick="abaPainelCustos(this, 'resumo', '${escaparAtributo(contrato)}')">Resumo</button>
                        <button type="button" onclick="abaPainelCustos(this, 'pagamentos', '${escaparAtributo(contrato)}')">Pagamentos</button>
                    </nav>
                </header>

                <div class="pc-resumo">

                <section class="pc-card pc-medidor pc-${faixa}">
                    <span class="pc-rotulo">Custo sobre o orçamento</span>
                    ${percentual !== null
                        // O próprio velocímetro já escreve o percentual e o limite.
                        ? criarVelocimetroHTML({ rotulo: 'do orçamento', limite: LIMITE_ALERTA_CUSTO, valor: percentual, tamanho: 220 })
                        : `<b class="pc-percentual">${percentualTexto}</b>`}
                    <span class="pc-situacao">${situacao}</span>
                </section>

                <section class="pc-indicadores">
                    <div class="pc-card">
                        <span class="pc-rotulo">Orçamento</span>
                        <b class="pc-valor">${orcamento ? dinheiro(orcamento) : '—'}</b>
                    </div>

                    <div class="pc-card pc-${faixa}">
                        <span class="pc-rotulo">Custo total</span>
                        <b class="pc-valor">${dinheiro(custo_total)}</b>
                        ${percentual !== null ? `
                            <div class="pc-barra" title="${percentualTexto} do orçamento (limite ${LIMITE_ALERTA_CUSTO}%)">
                                <div style="width: ${Math.min(percentual, 100)}%"></div>
                                <i style="left: ${LIMITE_ALERTA_CUSTO}%"></i>
                            </div>
                            <span class="pc-chip-percentual">${percentualTexto} do orçamento</span>` : ''}
                        <small class="pc-sub">Realizado ${dinheiro(custo_realizado)} · Previsto ${dinheiro(custo_previsto)}</small>
                    </div>

                    <div class="pc-card">
                        <span class="pc-rotulo">Custo de pessoal</span>
                        <b class="pc-valor">${dinheiro(custo_pessoal)}</b>
                        ${custo_total ? `<small>${String(Math.round(custo_pessoal / custo_total * 1000) / 10).replace('.', ',')}% do custo</small>` : ''}
                        ${detalhePessoal}
                    </div>

                    <div class="pc-card ${orcamento && saldo < 0 ? 'pc-estourado' : ''}">
                        <span class="pc-rotulo">Saldo do orçamento</span>
                        <b class="pc-valor">${orcamento ? dinheiro(saldo) : '—'}</b>
                        ${orcamento ? `<small>${saldo < 0 ? 'Custo acima do orçamento' : 'Disponível'}</small>` : '<small>Sem orçamento vinculado</small>'}
                    </div>
                </section>

                </div>

                <div class="painel-custos-tabelas"></div>

            </div>
        `

        popup({ elemento })

        removerOverlay()

        await inicioCustos(contrato)

    } catch (err) {
        console.error(err)
        popup({ mensagem: err.message || 'Falha ao abrir custos: Fale com o suporte.' })
    }

}

function abaPainelCustos(botao, aba, contrato) {
    for (const item of botao.closest('.pc-abas').querySelectorAll('button'))
        item.classList.toggle('ativa', item === botao)
    return aba === 'pagamentos' ? tabPagamentosCusto(contrato) : inicioCustos(contrato)
}

function tituloChecklist(texto) {

  return `
    <div class="titulo-relatorio">
      <span>${texto}</span>
    </div>
  `
}

function toggleAbas(span) {

    const toolMaisProxima = [...span.closest('.toolbar-padrao').querySelectorAll('span')]
    toolMaisProxima.map(span => span.style.opacity = 0.5)

    if (span)
        span.style.opacity = 1

}

async function inicioCustos(contrato) {

    const painel = document.querySelector('.painel-custos-tabelas')

    painel.innerHTML = `
        <div class="pc-corpo">
            <section class="pc-bloco pc-categorias">
                <h3>Custos por categoria</h3>
                <div class="pc-lista-categorias"><img src="gifs/loading.gif" style="width: 4rem;" alt=""></div>
            </section>
            <div class="pc-graficos">
                <section class="pc-bloco">
                    <h3>Distribuição</h3>
                    <div class="grafico-box pc-rosca"><canvas id="grafico-categorias"></canvas></div>
                    <div class="pc-legenda" id="legenda-categorias"></div>
                </section>
                <section class="pc-bloco">
                    <h3>Custo por mês</h3>
                    <div class="grafico-box"><canvas id="grafico-linha-tempo"></canvas></div>
                </section>
            </div>
        </div>
    `

    await somaPorCategoria(contrato)

}

async function somaPorCategoria(contrato) {

    // Mesmos números do resumo (já trazem a categoria PESSOAL).
    const dadosPainel = dadosPainelCustos.get(contrato) || await buscarPainelCustos(contrato).catch(() => ({}))
    const categorias = [...(dadosPainel.categorias || [])].sort((a, b) => b.total - a.total)
    const total = categorias.reduce((s, c) => s + Number(c.total || 0), 0)
    const maior = Math.max(...categorias.map(c => Number(c.total || 0)), 0)

    // Linha do tempo mensal, como o relatório de custos.
    const valores_por_data = (dadosPainel.por_mes || []).map(({ mes, total }) => {
        const [ano, numero] = mes.split('-')
        return { data_vencimento: `01/${numero}/${ano}`, rotulo: mesCurtoPainel(mes), total }
    })

    const lista = document.querySelector('.pc-lista-categorias')
    if (lista)
        lista.innerHTML = categorias.length
            ? categorias.map(({ categoria, total: valor }) => `
                <div class="pc-categoria ${categoria === 'PESSOAL' ? 'pessoal' : ''}">
                    <div class="pc-categoria-topo">
                        <span>${escaparAtributo(categoria)}</span>
                        <b>${dinheiro(valor)}</b>
                    </div>
                    <div class="pc-categoria-barra"><div style="width: ${maior ? valor / maior * 100 : 0}%"></div></div>
                    <small>${total ? String(Math.round(valor / total * 1000) / 10).replace('.', ',') : 0}% do custo</small>
                </div>`).join('')
            : '<small>Nenhum custo lançado neste centro de custo.</small>'

    graficoRosca({
        dados: categorias,
        elemento: '#grafico-categorias',
        legenda: '#legenda-categorias'
    })

    criarGraficoLinhaTempo({
        elemento: '#grafico-linha-tempo',
        dados: valores_por_data,
        rotulo: 'Custo do mês'
    })

}

async function tabPagamentosCusto(contrato) {

    try {

        overlayAguarde()

        selecaoPagamentosCusto.contrato = contrato
        selecaoPagamentosCusto.ids = new Set()
        const podeMover = PERFIS_MOVER_DEPARTAMENTO.includes(acesso?.permissao)

        const pag = 'custosPagamentos'
        const tabela = await modTab({
            pag,
            alturaMinima: '60dvh',
            body: 'bodyCustosPagamentos',
            criarLinha: 'criarLinhaCustoPagamento',
            base: 'vw_pagamentos_categorias',
            filtros: {
                'departamento': { op: '=', value: contrato },
                'param.*.codigo_tipo_documento': { op: '!=', value: 'CTE' },
            },
            btnExtras: podeMover ? `
                <div class="pc-mover-barra">
                    <button type="button" class="secundario" onclick="selecionarPaginaPagamentosCusto()">Selecionar a página</button>
                    <button type="button" class="pc-mover-botao" onclick="formularioMoverDepartamento()" disabled>Mudar departamento</button>
                </div>` : null,
            colunas: {
                ...(podeMover ? { '': {} } : {}),
                'Data': { chave: 'param.*.data_previsao', tipoPesquisa: 'data' },
                'Valor': { chave: 'valor' },
                'Categoria': { chave: 'categoria' },
                'Status': { chave: 'status' },
                'Solicitante': { chave: 'criado' },
                'Recebedor': { chave: 'snapshots.cliente' },
                'Observação': { chave: 'param.*.observacao' },
                'Ações': {}
            }
        })

        const painel = document.querySelector('.painel-custos-tabelas')

        painel.innerHTML = tabela

        await paginacao(pag)

        removerOverlay()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir detalhamento: Fale com o suporte.' })
    }

}

async function criarLinhaCustoPagamento(pagamento) {

    const { criado, param, status, snapshots, valor, categoria } = pagamento || {}
    const { data_previsao, observacao } = param?.[0] || {}

    const cliente = snapshots?.cliente || ''

    const imagem = iconePagamento(status)

    const idPagamento = escaparAtributo(String(pagamento.pagamento_id))
    const selecao = PERFIS_MOVER_DEPARTAMENTO.includes(acesso?.permissao)
        ? `<td><input type="checkbox" class="pc-mover-check" data-pagamento="${idPagamento}" aria-label="Selecionar pagamento"
            ${selecaoPagamentosCusto.ids.has(String(pagamento.pagamento_id)) ? 'checked' : ''} onchange="marcarPagamentoCusto(this)"></td>`
        : ''

    const tds = `
        ${selecao}
        <td>${data_previsao || ''}</td>
        <td style="white-space: nowrap;">${dinheiro(valor)}</td>
        <td>
            <span class="etiquetas">${categoria}</span>
        </td>
        <td>
            <div style="${horizontal}; justify-content: start; gap: 1rem;">
                <img src="${imagem}">
                <span>${status || ''}</span>
            </div>
        </td>
        <td>${criado || ''}</td>
        <td>${cliente || ''}</td>
        <td>
            <div style="white-space: pre-wrap;">${observacao || ''}</div>
        </td>
        <td>
            <img src="imagens/pesquisar.svg" onclick="abrirDetalhesPagamentos('${pagamento.pagamento_id}')">
        </td>
        `

    return `<tr>${tds}</tr>`

}

// ---------------------------------------------------------------------------
// Mudar departamento: move os pagamentos selecionados do centro de custo aberto para outro
// departamento, no Omie (/pagamentos/trocar-departamento). Só a parte do rateio deste
// departamento muda; valores e as outras partes ficam como estão.
// ---------------------------------------------------------------------------

const PERFIS_MOVER_DEPARTAMENTO = ['adm', 'diretoria', 'fin']
// Linhas são pagamento x categoria: a seleção guarda o pagamento, e marcar uma linha marca todas dele.
const selecaoPagamentosCusto = { contrato: null, ids: new Set() }

function atualizarBotaoMoverDepartamento() {
    const botao = document.querySelector('.pc-mover-botao')
    if (!botao) return
    const quantidade = selecaoPagamentosCusto.ids.size
    botao.disabled = !quantidade
    botao.textContent = quantidade ? `Mudar departamento (${quantidade})` : 'Mudar departamento'
}

function marcarPagamentoCusto(caixa) {
    const id = caixa.dataset.pagamento
    caixa.checked ? selecaoPagamentosCusto.ids.add(id) : selecaoPagamentosCusto.ids.delete(id)
    for (const outra of document.querySelectorAll('.pc-mover-check'))
        if (outra.dataset.pagamento === id) outra.checked = caixa.checked
    atualizarBotaoMoverDepartamento()
}

function selecionarPaginaPagamentosCusto() {
    const caixas = [...document.querySelectorAll('.pc-mover-check')]
    const marcar = caixas.some(c => !c.checked)
    for (const caixa of caixas) {
        caixa.checked = marcar
        marcar ? selecaoPagamentosCusto.ids.add(caixa.dataset.pagamento) : selecaoPagamentosCusto.ids.delete(caixa.dataset.pagamento)
    }
    atualizarBotaoMoverDepartamento()
}

async function formularioMoverDepartamento() {

    const { contrato, ids } = selecaoPagamentosCusto
    if (!ids.size) return

    overlayAguarde()
    const { resultados } = await pesquisarDB({ base: 'mesc_departamentos', limite: 20000 }) || {}
    // Departamentos de mês ("OUTUBRO - 2026") são só agrupadores do Omie.
    const mes = /^(JANEIRO|FEVEREIRO|MAR[CÇ]O|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)\s*-\s*\d{4}$/i
    const nomes = (resultados || []).map(d => d.id).filter(nome => nome && nome !== contrato && !mes.test(String(nome).trim()))
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'))

    const linhas = [
        { elemento: `<span style="text-align: left;"><b>${ids.size}</b> pagamento(s) saem de <b>${escaparAtributo(contrato)}</b>. Só a parte do rateio deste departamento muda; os valores ficam iguais.</span>` },
        {
            texto: 'Para o departamento',
            elemento: `
                <input name="departamentoDestino" list="listaDepartamentosDestino" placeholder="Digite para buscar" autocomplete="off" style="min-width: 320px;">
                <datalist id="listaDepartamentosDestino">${nomes.map(n => `<option value="${escaparAtributo(n)}"></option>`).join('')}</datalist>`
        },
        { elemento: '<small style="text-align: left; color: #65756b;">A alteração é feita direto no Omie, um pagamento por vez.</small>' }
    ]

    popup({
        linhas,
        botoes: [{ texto: 'Mudar no Omie', img: 'concluido', funcao: 'confirmarMoverDepartamento()' }],
        titulo: 'Mudar departamento'
    })
    removerOverlay()
}

async function confirmarMoverDepartamento() {

    const painel = [...document.querySelectorAll('.painel-padrao')].at(-1)
    const para = painel?.querySelector('[name="departamentoDestino"]')?.value.trim() || ''
    const { contrato, ids } = selecaoPagamentosCusto

    // Só nomes da lista: o servidor também recusa, mas aqui o aviso é imediato.
    const opcoes = [...(painel?.querySelectorAll('#listaDepartamentosDestino option') || [])].map(o => o.value)
    if (!opcoes.includes(para))
        return popup({ mensagem: 'Escolha um departamento da lista.' })

    overlayAguarde()

    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || 'null') || {}
        const resposta = await fetch(`${api}/pagamentos/trocar-departamento`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ids: [...ids], de: contrato, para })
        })
        const dados = await resposta.json().catch(() => ({}))

        if (!resposta.ok || !dados.success) {
            removerOverlay()
            return popup({ mensagem: dados.mensagem || 'Falha ao mudar o departamento.' })
        }

        const resultados = dados.resultados || []
        const certos = resultados.filter(r => r.ok)
        const falhas = resultados.filter(r => !r.ok)

        // Os que mudaram saem da seleção; os que falharam continuam marcados para tentar de novo.
        for (const r of certos) ids.delete(String(r.id))

        removerTodosPopups()
        popup({
            titulo: 'Mudar departamento',
            elemento: `
                <div class="pc-mover-resultado">
                    <p><b>${certos.length}</b> de ${resultados.length} pagamento(s) movido(s) para <b>${escaparAtributo(para)}</b>.</p>
                    ${falhas.length ? `
                        <p>Não foram alterados:</p>
                        <ul>${falhas.map(f => `<li><b>${escaparAtributo(f.id)}</b>: ${escaparAtributo(f.mensagem)}</li>`).join('')}</ul>` : ''}
                </div>`
        })

        await paginacao('custosPagamentos')
        atualizarBotaoMoverDepartamento()
    } catch {
        removerOverlay()
        popup({ mensagem: 'Sem conexão com o servidor. Tente novamente.' })
    }
}

// Com "legenda" (elemento ou seletor), a legenda é HTML fora do canvas: a rosca usa
// a caixa inteira e a lista não a espreme. Sem ela, mantém a legenda do Chart.js.
function graficoRosca({ dados = [], elemento, legenda = null }) {
    const canvas = typeof elemento === 'string'
        ? document.querySelector(elemento)
        : elemento

    if (!canvas) return

    Chart.getChart(canvas)?.destroy()

    const destinoLegenda = typeof legenda === 'string' ? document.querySelector(legenda) : legenda
    if (destinoLegenda)
        return graficoRoscaComLegendaHtml({ dados, canvas, destinoLegenda })

    const labels = (dados || []).map(item => String(item.categoria ?? ''))
    const valores = (dados || []).map(item => Number(item.total) || 0)

    const contexto = canvas.getContext('2d')
    const fonte = Chart.defaults.font.family

    contexto.font = `12px ${fonte}`

    const maiorTexto = Math.max(
        0,
        ...labels.map(texto => contexto.measureText(texto).width)
    )

    const larguraLegenda = Math.ceil(maiorTexto + 70)
    const largura = Math.max(700, 360 + larguraLegenda, larguraLegenda * 2)
    const altura = Math.max(360, labels.length * 26 + 40)

    const ladoALado = !!canvas.closest('.custos-graficos')
    Object.assign(canvas.parentElement.style, {
        position: 'relative',
        width: ladoALado ? '100%' : `${largura}px`,
        minWidth: ladoALado ? '0' : `${largura}px`,
        maxWidth: ladoALado ? '100%' : 'none',
        height: `${ladoALado ? Math.max(360, 220 + Math.ceil(labels.length / 2) * 26) : altura}px`,
        maxHeight: 'none',
        flexShrink: '0'
    })

    return new Chart(canvas, {
        type: 'doughnut',
        plugins: [porcentagensRosca],
        data: {
            labels,
            datasets: [{
                data: valores
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: ladoALado ? 'bottom' : 'right',
                    labels: {
                        boxWidth: 14,
                        boxHeight: 14,
                        padding: 14,
                        font: {
                            size: 12,
                            family: fonte
                        }
                    }
                }
            }
        }
    })
}

function graficoRoscaComLegendaHtml({ dados, canvas, destinoLegenda }) {
    const labels = (dados || []).map(item => String(item.categoria ?? ''))
    const valores = (dados || []).map(item => Number(item.total) || 0)
    const total = valores.reduce((s, v) => s + v, 0)

    const grafico = new Chart(canvas, {
        type: 'doughnut',
        plugins: [porcentagensRosca],
        data: { labels, datasets: [{ data: valores }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '58%',
            layout: { padding: 8 },
            plugins: { legend: { display: false } }
        }
    })

    // Cores reais de cada fatia (paleta automática do Chart.js). A geração por fatia
    // fica nos ajustes da rosca; o padrão geral gera um item por conjunto de dados.
    const gerarItens = Chart.overrides?.doughnut?.plugins?.legend?.labels?.generateLabels
        || Chart.defaults.plugins.legend.labels.generateLabels
    const itens = gerarItens(grafico)

    destinoLegenda.innerHTML = itens.map((item, indice) => `
        <button type="button" class="pc-legenda-item" data-indice="${indice}" title="Mostrar/ocultar no gráfico">
            <i style="background: ${item.fillStyle}"></i>
            <span>${escaparAtributo(labels[indice])}</span>
            <b>${total ? String(Math.round(valores[indice] / total * 1000) / 10).replace('.', ',') : 0}%</b>
        </button>`).join('')

    for (const botao of destinoLegenda.querySelectorAll('.pc-legenda-item')) {
        botao.addEventListener('click', () => {
            grafico.toggleDataVisibility(Number(botao.dataset.indice))
            grafico.update()
            botao.classList.toggle('oculto')
        })
    }

    return grafico
}

function criarGraficoLinhaTempo({
    elemento,
    dados = {},
    rotulo = 'Valores',
    corLinha = '#2563eb',
    corFundo = 'rgba(37, 99, 235, 0.15)',
    mostrarArea = true,
    tensaoLinha = 0.25,
} = {}) {

    const entradasOrdenadas = (dados || [])
        .map(({ data_vencimento, total, rotulo }) => {
            const [dia, mes, ano] = data_vencimento.split('/')

            return {
                dataTexto: rotulo || data_vencimento,
                valor: Number(total) || 0,
                ordem: new Date(`${ano}-${mes}-${dia}T00:00:00`).getTime()
            }
        })
        .filter(item => !Number.isNaN(item.ordem))
        .sort((a, b) => a.ordem - b.ordem)

    const labels = entradasOrdenadas.map(item => item.dataTexto)
    const valores = entradasOrdenadas.map(item => item.valor)

    const ctx = typeof elemento === 'string'
        ? document.querySelector(elemento)
        : elemento

    const graficoAnterior = Chart.getChart(ctx)
    if (graficoAnterior) {
        graficoAnterior.destroy()
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: rotulo,
                data: valores,
                borderColor: corLinha,
                backgroundColor: corFundo,
                fill: mostrarArea,
                tension: tensaoLinha,
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Data'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Valor'
                    }
                }
            }
        }
    })
}

const porcentagensRosca = {
    id: 'porcentagensRosca',

    afterDatasetsDraw(chart) {
        const { ctx } = chart
        const dataset = chart.data.datasets[0]
        const meta = chart.getDatasetMeta(0)

        if (!dataset || !chart.isDatasetVisible(0)) return

        const total = dataset.data.reduce((soma, valor, indice) => {
            return chart.getDataVisibility(indice)
                ? soma + Math.abs(Number(valor) || 0)
                : soma
        }, 0)

        if (!total) return

        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `bold 16px ${Chart.defaults.font.family}`
        ctx.fillStyle = '#fff'
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.65)'
        ctx.lineWidth = 4
        ctx.lineJoin = 'round'

        meta.data.forEach((arco, indice) => {
            if (!chart.getDataVisibility(indice)) return

            const valor = Math.abs(Number(dataset.data[indice]) || 0)
            const porcentagem = valor / total * 100

            if (porcentagem < 4) return

            const texto = `${porcentagem.toLocaleString('pt-BR', {
                maximumFractionDigits: 1
            })}%`

            const { x, y } = arco.tooltipPosition()

            ctx.strokeText(texto, x, y)
            ctx.fillText(texto, x, y)
        })

        ctx.restore()
    }
}
