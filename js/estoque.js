// Estoque (servidor: SCRIPTS/fiscal.js → rotasEstoque, SCRIPTS/fiscal/estoque.js).
// Locais por empresa (Matriz, Galpão... e "Divergências"). O saldo é a soma dos movimentos (entrada de nota,
// saída de nota emitida, inventário, ajuste, transferência); nada é apagado, corrige-se com estorno.
// - Saldos: vw_estoque_saldos (total do item em todos os locais; o detalhe mostra por local).
// - Locais: vw_estoque_locais / vw_estoque_saldos_locais; transferência só entre locais da mesma empresa
//   (entre empresas é nota fiscal: saída numa, entrada na outra).
// - Movimentações: vw_estoque_movimentos.
// - Inventário: por local; ao fechar, falta vai para "Divergências" da empresa e sobra entra como ajuste.

const escEst = valor => escaparAtributo(valor ?? '')
const qtdEst = v => v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 4 })

async function apiEstoque(rota, corpo = {}) {
    return apiModuloFiscal(`estoque/${rota}`, corpo)
}

// Chamada às rotas /fiscal e /estoque (usada pelos dois módulos).
async function apiModuloFiscal(caminho, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/${caminho}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const retorno = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
        const erro = new Error(retorno.mensagem || retorno.erro || `Falha (${resposta.status})`)
        erro.erros = retorno.erros
        erro.status = resposta.status
        // Pendências do orçamento (fluxo-itens): SALDO_ABERTO / PROMESSA_PEDIDO e o saldo.
        erro.codigo = retorno.codigo
        erro.saldo = retorno.saldo
        throw erro
    }
    return retorno
}

function mensagemErroEst(err) {
    const lista = Array.isArray(err?.erros) && err.erros.length
        ? `<ul class="fis-lista-erros">${err.erros.map(e => `<li>${escEst(e)}</li>`).join('')}</ul>` : ''
    return `${escEst(err?.message || 'Falha')}${lista}`
}

const SITUACOES_ESTOQUE = {
    OK: '#15803d', 'ABAIXO DO MÍNIMO': '#d97706', ZERADO: '#64748b', NEGATIVO: '#b91c1c'
}
const TIPOS_MOVIMENTO = {
    ENTRADA: { cor: '#15803d', texto: 'Entrada' },
    SAIDA: { cor: '#b91c1c', texto: 'Saída' },
    AJUSTE: { cor: '#2563eb', texto: 'Ajuste' },
    INVENTARIO: { cor: '#7c3aed', texto: 'Inventário' },
    ESTORNO: { cor: '#64748b', texto: 'Estorno' },
    TRANSFERENCIA: { cor: '#0e7490', texto: 'Transferência' }
}
const ORIGENS_MOVIMENTO = { NF_ENTRADA: 'Nota recebida', NF_SAIDA: 'Nota emitida', INVENTARIO: 'Inventário', MANUAL: 'Ajuste manual', ESTORNO: 'Estorno', TRANSFERENCIA: 'Transferência', REQUISICAO: 'Requisição (uso e consumo)' }

// Locais ativos (cache da sessão; recarregado ao criar/editar).
let locaisEstoqueCache = null
async function locaisEstoque(recarregar = false) {
    if (!locaisEstoqueCache || recarregar) locaisEstoqueCache = (await apiEstoque('locais')).locais
    return locaisEstoqueCache
}
const nomeLocalEst = l => `${l.app} · ${l.nome}${l.tipo === 'DIVERGENCIA' ? ' (diferenças)' : ''}${l.tipo === 'USO_CONSUMO' ? ' (requisições)' : ''}`
const opcoesLocaisEst = (locais, atual, filtro = () => true) => locais.filter(l => l.ativo && filtro(l))
    .map(l => `<option value="${escEst(l.id)}" ${l.id === atual ? 'selected' : ''}>${escEst(nomeLocalEst(l))}${l.padrao ? ' — padrão' : ''}</option>`).join('')

function etiquetaEst(texto, cor) {
    return `<span class="fis-etiqueta" style="--cor: ${cor || '#64748b'}">${escEst(texto)}</span>`
}

// ---------------------------------------------------------------- saldos

async function telaEstoque() {
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Estoque</h2></div>
            <div class="fis-conteudo"></div>
        </div>`
    try {
        delete controles.estoque
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_estoque_saldos',
            pag: 'estoque',
            body: 'bodyEstoque',
            criarLinha: 'criarLinhaEstoque',
            topoEmLinha: true,
            btnExtras: `
                <div class="fis-barra">
                    <span class="fis-total">Valor em estoque: <b data-total-estoque>…</b></span>
                    <div class="fis-acoes">
                        <button type="button" onclick="telaLocaisEstoque()">Locais</button>
                        <button type="button" onclick="telaMovimentosEstoque()">Movimentações</button>
                        <button type="button" onclick="telaInventarios()">Inventário</button>
                    </div>
                </div>`,
            funcaoAdicional: ['totalValorEstoque'],
            ordenar: [{ path: 'descricao', direcao: 'asc' }],
            colunas: {
                '': {},
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Un.': { chave: 'unidade' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
                'Saldo': { chave: 'saldo', op: '>=', tipoOrdenacao: 'numero' },
                'Custo médio': { chave: 'custo_medio', tipoOrdenacao: 'numero' },
                'Valor': { chave: 'valor_estoque', tipoOrdenacao: 'numero' },
                'Situação': { chave: 'situacao', tipoPesquisa: 'select' },
                'Último movimento': { chave: 'ultimo_movimento' }
            }
        })
        await paginacao('estoque')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o estoque: ${escEst(err.message)}` })
    }
}

async function totalValorEstoque() {
    const alvo = document.querySelector('[data-total-estoque]')
    const ctrl = controles.estoque
    if (!alvo || !ctrl) return
    try {
        const { total } = await contarPorCampo({
            base: 'vw_estoque_saldos', path: 'valor_estoque', modo: 'soma',
            filtros: combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        })
        alvo.textContent = dinheiroTexto(total || 0)
    } catch {
        alvo.textContent = '—'
    }
}

function criarLinhaEstoque(d) {
    const saldo = Number(d.saldo || 0)
    return `
        <tr>
            <td class="fis-acoes-linha"><img src="imagens/pesquisar.svg" title="Movimentos e ajuste" onclick="detalheItemEstoque('${escEst(d.id)}')"></td>
            <td>${escEst(d.codigo)}</td>
            <td class="fis-descricao">${escEst(d.descricao)}${d.modelo ? `<small>${escEst(d.modelo)}</small>` : ''}</td>
            <td>${escEst(d.unidade)}</td>
            <td>${escEst(d.tipo)}</td>
            <td class="fis-num ${saldo < 0 ? 'fis-negativo' : ''}"><b>${qtdEst(saldo)}</b></td>
            <td class="fis-num">${d.custo_medio != null ? dinheiro(d.custo_medio) : ''}</td>
            <td class="fis-num">${d.valor_estoque ? dinheiro(d.valor_estoque) : ''}</td>
            <td>${etiquetaEst(d.situacao, SITUACOES_ESTOQUE[d.situacao])}</td>
            <td>${d.ultimo_movimento ? new Date(d.ultimo_movimento).toLocaleDateString('pt-BR') : ''}</td>
        </tr>`
}

function linhaMovimentoEst(m, { comItem = false, acoes = true } = {}) {
    const t = TIPOS_MOVIMENTO[m.tipo] || {}
    const q = Number(m.quantidade)
    const doc = m.documento_id
        ? `<span class="fis-link" onclick="abrirDocumentoFiscal('${escEst(m.documento_id)}')">NF ${escEst(m.documento_numero || '')}</span> <small>${escEst(m.participante_nome || '')}</small>`
        : m.inventario_id ? 'Inventário' : m.origem === 'REQUISICAO' ? 'Requisição' : ''
    const podeEstornar = acoes && !m.estornado && ['MANUAL', 'INVENTARIO'].includes(m.origem) && m.tipo !== 'ESTORNO'
    return `
        <tr class="${m.estornado ? 'fis-estornado' : ''}">
            <td>${new Date(m.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            ${comItem ? `<td>${escEst(m.codigo)}</td><td class="fis-descricao">${escEst(m.descricao)}</td>` : ''}
            <td>${etiquetaEst(t.texto || m.tipo, t.cor)}${m.estornado ? ' <small>(estornado)</small>' : ''}</td>
            <td><small>${escEst(m.app ? `${m.app} · ${m.local_nome || ''}` : m.local_nome || '')}</small></td>
            <td class="fis-num ${q < 0 ? 'fis-negativo' : 'fis-positivo'}"><b>${q > 0 ? '+' : ''}${qtdEst(q)}</b></td>
            <td class="fis-num">${m.custo_unitario != null ? dinheiro(m.custo_unitario) : ''}</td>
            <td class="fin-obs est-mov-origem" title="${escEst(ORIGENS_MOVIMENTO[m.origem] || m.origem)}"><span class="fin-obs-txt">${escEst(ORIGENS_MOVIMENTO[m.origem] || m.origem)}</span></td>
            <td class="fin-obs est-mov-doc" title="${escEst(docTexto)}"><span class="fin-obs-txt">${doc}</span></td>
            <td><small>${escEst(m.observacao || '')}</small></td>
            <td><small>${escEst(m.usuario || '')}</small></td>
            ${acoes ? `<td>${podeEstornar ? `<button type="button" class="fis-mini" onclick="estornarMovimentoEstoque('${escEst(m.id)}', '${escEst(m.item_id)}')">Estornar</button>` : ''}</td>` : ''}
        </tr>`
}

async function detalheItemEstoque(itemId) {
    overlayAguarde()
    try {
        const { saldo: s, movimentos, locais } = await apiEstoque('item', { item_id: itemId })
        removerOverlay()
        const elemento = `
            <div class="fis-painel" data-item-estoque="${escEst(itemId)}">
                <div class="fis-resumo">
                    <div><span>Item</span><b>${escEst(s.codigo)} · ${escEst(s.descricao)}</b></div>
                    <div><span>Saldo</span><b class="${Number(s.saldo) < 0 ? 'fis-negativo' : ''}">${qtdEst(s.saldo)} ${escEst(s.unidade || '')}</b></div>
                    <div><span>Custo médio</span><b>${s.custo_medio != null ? dinheiro(s.custo_medio) : '—'}</b></div>
                    <div><span>Valor em estoque</span><b>${dinheiro(s.valor_estoque || 0)}</b></div>
                    <div><span>Situação</span>${etiquetaEst(s.situacao, SITUACOES_ESTOQUE[s.situacao])}</div>
                </div>
                ${locais?.length ? `
                <div class="fis-secao">
                    <div class="fis-secao-topo"><b>Onde está</b></div>
                    <div class="est-locais-item">${locais.map(l => `
                        <span class="est-local-chip ${l.local_tipo === 'DIVERGENCIA' ? 'divergencia' : ''}">${escEst(l.app)} · ${escEst(l.local_nome)} <b>${qtdEst(l.saldo)}</b></span>`).join('')}
                    </div>
                </div>` : ''}
                <div class="fis-secao">
                    <div class="fis-secao-topo"><b>Movimentos</b> <small>últimos 200</small>
                        <button type="button" class="fis-botao" onclick="formularioAjusteEstoque('${escEst(itemId)}')">Ajustar saldo</button>
                    </div>
                    ${movimentos.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Data</th><th>Tipo</th><th>Local</th><th>Qtd</th><th>Custo</th><th>Origem</th><th>Documento</th><th>Observação</th><th>Usuário</th><th></th></tr></thead>
                            <tbody>${movimentos.map(m => linhaMovimentoEst(m)).join('')}</tbody>
                        </table>
                    </div>` : '<div class="fis-vazio">Nenhum movimento ainda. O saldo começa no inventário ou na primeira nota de entrada.</div>'}
                </div>
            </div>`
        popup({ titulo: 'Estoque do item', elemento })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function formularioAjusteEstoque(itemId) {
    let locais
    try { locais = await locaisEstoque() } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    popup({
        titulo: 'Ajustar saldo',
        linhas: [{
            elemento: `
                <div class="fis-form" data-ajuste-estoque>
                    <label class="fis-campo"><span>Local</span><select class="fis-input" name="local_id">${opcoesLocaisEst(locais, locais.find(l => l.padrao && l.app === 'AC')?.id)}</select></label>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Quantidade (+ entra, − sai)</span><input class="fis-input" name="quantidade" type="number" step="any" placeholder="ex.: -2"></label>
                        <label class="fis-campo"><span>Custo unitário (só entrada)</span><input class="fis-input" name="custo_unitario" type="number" step="0.0001" min="0" placeholder="custo médio"></label>
                    </div>
                    <label class="fis-campo"><span>Motivo</span><textarea class="fis-input" name="observacao" rows="2" placeholder="ex.: avaria no almoxarifado"></textarea></label>
                    <small class="fis-dica">Ajuste não deixa o saldo negativo. Para recontar tudo, use o inventário.</small>
                </div>`
        }],
        botoes: [{ texto: 'Lançar ajuste', img: 'concluido', funcao: `salvarAjusteEstoque('${escEst(itemId)}', this)` }]
    })
}

async function salvarAjusteEstoque(itemId, botao) {
    const form = document.querySelector('[data-ajuste-estoque]')
    const valor = n => form.querySelector(`[name="${n}"]`).value
    try {
        overlayAguarde()
        await apiEstoque('ajuste', { item_id: itemId, local_id: valor('local_id'), quantidade: valor('quantidade'), custo_unitario: valor('custo_unitario'), observacao: valor('observacao') })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        fecharPopupDoItemEst(itemId)
        detalheItemEstoque(itemId)
        if (controles.estoque) paginacao('estoque')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function fecharPopupDoItemEst(itemId) {
    const painel = document.querySelector(`[data-item-estoque="${CSS.escape(itemId)}"]`)
    const id = painel?.closest('.popup')?.id
    if (id) removerPopup(id)
}

async function estornarMovimentoEstoque(movimentoId, itemId) {
    const motivo = await pedirTextoPopup({ titulo: 'Estornar movimento', mensagem: 'Motivo do estorno:', textoConfirmar: 'Estornar' })
    if (motivo === null) return
    try {
        overlayAguarde()
        await apiEstoque('estornar', { movimento_id: movimentoId, observacao: motivo })
        removerOverlay()
        fecharPopupDoItemEst(itemId)
        detalheItemEstoque(itemId)
        if (controles.estoque) paginacao('estoque')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- movimentações

// Movimentações no layout das faturas a pagar (.fin-tela): topo só com título e botões, totais no pé das colunas,
// paginação no rodapé e indicadores no painel lateral retrátil (classes do painel dos Créditos IBS/CBS).
// vw_estoque_movimentos: valor = quantidade × custo (saída negativa), sentido = ENTRA/SAI (migrations/estoque-movimentos-valor.sql).
const POR_PAGINA_MOV_EST = 50
const COLUNAS_TOTAL_MOV_EST = ['quantidade', 'valor']
let somasMovEst = null, assinaturaMovEst = null
let painelMovEstAberto = true
// Marcados (valem entre páginas): id -> { quantidade, valor }. Com marcados, o pé soma só eles e o Excel baixa só eles.
const selecaoMovEst = new Map()

async function telaMovimentosEstoque(filtroExtra = null) {
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    tela.innerHTML = `
        <div class="fis-pagina fin-tela fis-emitidas est-mov">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Movimentações de estoque</h2>
                    <div class="fin-barra">
                        <button type="button" onclick="baixarExcelMovimentosEst()" title="Com movimentos marcados, baixa só os marcados; sem marcação, todos os resultados dos filtros aplicados">${iconeFin('excel')} Excel</button>
                        <button type="button" onclick="telaEstoque()">${iconeFin('ver')} Saldos</button>
                        <button type="button" onclick="telaLocaisEstoque()">${iconeFin('ver')} Locais</button>
                        ${filtroExtra ? `<button type="button" onclick="telaMovimentosEstoque()">${iconeFin('fechar')} Limpar filtro</button>` : ''}
                    </div>
                </header>
                <div class="fin-corpo${painelMovEstAberto ? '' : ' recolhido'}" data-corpo-mov-est>
                    <div class="fin-tabela-area" data-tabela-mov-est></div>
                    <div class="fin-lateral fis-cred-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelMovEst()" aria-expanded="${painelMovEstAberto}"
                            title="${painelMovEstAberto ? 'Recolher' : 'Mostrar'} os indicadores">${iconeFin('seta')}</button>
                        <aside class="fin-painel fis-cred-painel">
                            <div class="fin-painel-cabeca" title="Indicadores: seguem os filtros da tabela">
                                <span class="fin-avatar">Σ</span>
                                <div class="fin-painel-texto"><b>Indicadores</b><small>Seguem os filtros da tabela. Clique para filtrar.</small></div>
                            </div>
                            <div class="fis-cred-inds" data-indicadores-mov-est><small>Calculando…</small></div>
                        </aside>
                    </div>
                </div>
            </section>
        </div>`
    const area = document.querySelector('[data-tabela-mov-est]')
    try {
        delete controles.movimentosEstoque
        somasMovEst = null
        assinaturaMovEst = null
        selecaoMovEst.clear()
        area.innerHTML = await modTab({
            base: 'vw_estoque_movimentos',
            pag: 'movimentosEstoque',
            body: 'bodyMovimentosEstoque',
            criarLinha: 'criarLinhaMovimentoEstoque',
            caber: true,
            limite: POR_PAGINA_MOV_EST,
            funcaoAdicional: ['aposCarregarMovimentosEst'],
            filtrosFixos: { ...(filtroExtra || {}) },
            ordenar: [{ path: 'data', direcao: 'desc' }],
            colunas: {
                '': {},
                'Data': { chave: 'dia', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
                'Local': { chave: 'local_nome', tipoPesquisa: 'select' },
                'Qtd': { chave: 'quantidade', tipoOrdenacao: 'numero' },
                'Custo unit.': { chave: 'custo_unitario', tipoOrdenacao: 'numero' },
                'Valor': { chave: 'valor', tipoOrdenacao: 'numero' },
                'Origem': { chave: 'origem', tipoPesquisa: 'select' },
                'Documento': { chave: 'participante_nome' },
                'Observação': { chave: 'observacao' },
                'Usuário': { chave: 'usuario', tipoPesquisa: 'select' }
            }
        })
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-mov-est></div>')
        area.querySelector('.modtab')?.insertAdjacentHTML('afterbegin', '<div class="fin-aviso-selecao" data-aviso-mov-est hidden></div>')
        await paginacao('movimentosEstoque')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as movimentações: ${escEst(err.message)}` })
    }
}

function alternarPainelMovEst(abrir = null) {
    const corpo = document.querySelector('[data-corpo-mov-est]')
    if (!corpo) return
    const aberto = abrir ?? corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !aberto)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(aberto))
    if (botao) botao.title = `${aberto ? 'Recolher' : 'Mostrar'} os indicadores`
    painelMovEstAberto = aberto
}

function criarLinhaMovimentoEstoque(m) {
    const t = TIPOS_MOVIMENTO[m.tipo] || {}
    const q = Number(m.quantidade)
    const v = Number(m.valor)
    const id = escEst(m.id)
    const docTexto = m.documento_id ? `NF ${m.documento_numero || ''} ${m.participante_nome || ''}`.trim()
        : m.inventario_id ? 'Inventário' : m.origem === 'REQUISICAO' ? 'Requisição' : ''
    const doc = m.documento_id
        ? `<span class="fis-link" onclick="event.stopPropagation(); abrirDocumentoFiscal('${escEst(m.documento_id)}')">NF ${escEst(m.documento_numero || '')}</span> ${escEst(m.participante_nome || '')}`
        : escEst(docTexto)
    return `
        <tr class="fin-linha${m.estornado ? ' fis-estornado' : ''}" ondblclick="detalheItemEstoque('${escEst(m.item_id)}')" title="Duplo clique abre o item">
            <td class="fin-col-marcar">
                <input type="checkbox" class="fin-marcar" data-marcar-mov value="${id}" data-qtd="${Number(m.quantidade) || 0}" data-valor="${Number(m.valor) || 0}" ${selecaoMovEst.has(String(m.id)) ? 'checked' : ''}
                    onclick="event.stopPropagation(); marcarMovEst(this)" ondblclick="event.stopPropagation()" aria-label="Marcar movimento">
            </td>
            <td class="fin-centro">${new Date(m.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td class="fin-centro">${escEst(m.app || '')}</td>
            <td class="fin-centro fin-doc"><span class="fis-link" onclick="event.stopPropagation(); detalheItemEstoque('${escEst(m.item_id)}')" title="Abrir o item">${escEst(m.codigo)}</span></td>
            <td class="fin-obs fin-nome" title="${escEst(m.descricao || '')}"><span class="fin-obs-txt">${escEst(m.descricao || '')}</span></td>
            <td>${etiquetaEst(t.texto || m.tipo, t.cor)}${m.estornado ? ' <small>(estornado)</small>' : ''}</td>
            <td class="fin-obs est-mov-local" title="${escEst(m.local_nome || '')}"><span class="fin-obs-txt">${escEst(m.local_nome || '')}</span></td>
            <td class="fis-num ${q < 0 ? 'fis-negativo' : 'fis-positivo'}"><b>${q > 0 ? '+' : ''}${qtdEst(q)}</b></td>
            <td class="fis-num">${m.custo_unitario != null ? dinheiro(m.custo_unitario) : '<span class="fin-vazio">—</span>'}</td>
            <td class="fis-num ${v < 0 ? 'fis-negativo' : ''}">${m.valor != null ? dinheiro(v) : '<span class="fin-vazio">—</span>'}</td>
            <td>${escEst(ORIGENS_MOVIMENTO[m.origem] || m.origem)}</td>
            <td>${doc}</td>
            <td class="fin-obs" title="${escEst(m.observacao || '')}"><span class="fin-obs-txt">${escEst(m.observacao || '')}</span></td>
            <td>${escEst(m.usuario || '')}</td>
        </tr>`
}

async function aposCarregarMovimentosEst() {
    const tabela = document.getElementById('bodyMovimentosEstoque')?.closest('table')
    if (!tabela) return
    const th = tabela.querySelector('thead tr:first-child th:first-child')
    if (th && !th.querySelector('[data-marcar-todos-mov]'))
        th.innerHTML = '<input type="checkbox" class="fin-marcar" data-marcar-todos-mov title="Marcar todos desta página" onclick="event.stopPropagation(); marcarTodosMovEst(this)">'
    const filtro = tabela.querySelector('thead tr:nth-child(2) th:first-child')
    if (filtro?.querySelector('img')) filtro.innerHTML = ''
    if (!tabela.tFoot) {
        const chaves = Object.values(controles.movimentosEstoque?.colunas || {}).map(c => c.chave || '')
        const linha = tabela.createTFoot().insertRow()
        linha.className = 'fin-totais'
        chaves.forEach(chave => {
            const td = linha.insertCell()
            if (COLUNAS_TOTAL_MOV_EST.includes(chave)) { td.dataset.totalMovEst = chave; td.className = 'fis-num' }
        })
        const enchimento = document.createElement('tbody')
        enchimento.className = 'fin-enchimento'
        enchimento.innerHTML = `<tr><td colspan="${chaves.length}"></td></tr>`
        tabela.insertBefore(enchimento, tabela.tFoot)
    }
    if (typeof cabecalhoAvancadoTabela === 'function')
        await cabecalhoAvancadoTabela('movimentosEstoque', { prefKey: 'movimentos_estoque' })
    desenharRodapeMovEst()
    desenharSelecaoMovEst()
    await somarMovimentosEst()
}

async function somarMovimentosEst() {
    const ctrl = controles.movimentosEstoque
    if (!ctrl) return
    const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos)
    const assinatura = JSON.stringify(filtros)
    if (assinatura !== assinaturaMovEst) {
        assinaturaMovEst = assinatura
        indicadoresMovimentosEst(filtros || {})
        const somas = await Promise.all(COLUNAS_TOTAL_MOV_EST.map(async path => {
            try { return Number((await contarPorCampo({ base: 'vw_estoque_movimentos', path, modo: 'soma', filtros }))?.total || 0) } catch { return null }
        }))
        if (assinatura !== assinaturaMovEst) return
        somasMovEst = somas
    }
    escreverTotaisMovEst()
}

// Pé das colunas: com marcados, soma só eles; sem marcação, o filtro inteiro.
function escreverTotaisMovEst() {
    const n = selecaoMovEst.size
    COLUNAS_TOTAL_MOV_EST.forEach((path, i) => {
        const td = document.querySelector(`[data-total-mov-est="${path}"]`)
        if (!td) return
        const formatar = v => v == null ? '—' : path === 'valor' ? dinheiro(Math.round(v * 100) / 100) : qtdEst(v)
        if (n) {
            const soma = [...selecaoMovEst.values()].reduce((s, m) => s + (Number(path === 'valor' ? m.valor : m.quantidade) || 0), 0)
            td.title = `Soma dos ${n} movimento(s) marcado(s). Desmarque todos para ver o total do filtro.`
            td.innerHTML = `${i === 0 ? `<small class="fin-total-rotulo">${n} marcado${n === 1 ? '' : 's'}</small> ` : ''}<span class="fin-sigma">Σ</span> ${formatar(soma)}`
            td.classList.add('fin-total-selecao')
        } else {
            td.title = 'Total de todos os movimentos do filtro'
            td.innerHTML = `<span class="fin-sigma">Σ</span> ${formatar(somasMovEst?.[i])}`
            td.classList.remove('fin-total-selecao')
        }
    })
}

function marcarMovEst(caixa) {
    if (caixa.checked) selecaoMovEst.set(caixa.value, { quantidade: Number(caixa.dataset.qtd) || 0, valor: Number(caixa.dataset.valor) || 0 })
    else selecaoMovEst.delete(caixa.value)
    desenharSelecaoMovEst()
}

function marcarTodosMovEst(caixa) {
    document.querySelectorAll('#bodyMovimentosEstoque [data-marcar-mov]').forEach(c => {
        c.checked = caixa.checked
        if (caixa.checked) selecaoMovEst.set(c.value, { quantidade: Number(c.dataset.qtd) || 0, valor: Number(c.dataset.valor) || 0 })
        else selecaoMovEst.delete(c.value)
    })
    desenharSelecaoMovEst()
}

function limparSelecaoMovEst() {
    selecaoMovEst.clear()
    document.querySelectorAll('#bodyMovimentosEstoque [data-marcar-mov]').forEach(c => { c.checked = false })
    desenharSelecaoMovEst()
}

async function selecionarTodosFiltroMovEst() {
    const ctrl = controles.movimentosEstoque
    if (!ctrl) return
    overlayAguarde()
    try {
        const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_estoque_movimentos', filtros, pagina, limite: 2000 })
            ;(r?.resultados || []).forEach(m => selecaoMovEst.set(String(m.id), { quantidade: Number(m.quantidade) || 0, valor: Number(m.valor) || 0 }))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)
        document.querySelectorAll('#bodyMovimentosEstoque [data-marcar-mov]').forEach(c => { c.checked = selecaoMovEst.has(c.value) })
        desenharSelecaoMovEst()
    } catch (err) {
        popup({ mensagem: `Falha ao marcar os movimentos do filtro: ${escEst(err.message)}` })
    } finally {
        removerOverlay()
    }
}

function desenharSelecaoMovEst() {
    const pagina = [...document.querySelectorAll('#bodyMovimentosEstoque [data-marcar-mov]')]
    const marcadas = pagina.filter(c => c.checked).length
    const paginaToda = pagina.length > 0 && marcadas === pagina.length
    const todos = document.querySelector('[data-marcar-todos-mov]')
    if (todos) {
        todos.checked = paginaToda
        todos.indeterminate = marcadas > 0 && marcadas < pagina.length
    }
    const aviso = document.querySelector('[data-aviso-mov-est]')
    if (aviso) {
        const n = selecaoMovEst.size
        const total = Number(document.getElementById('resultados_movimentosEstoque')?.textContent) || 0
        const plural = q => `${q.toLocaleString('pt-BR')} ${q === 1 ? 'movimento' : 'movimentos'}`
        const limpar = '<a href="#" onclick="event.preventDefault(); limparSelecaoMovEst()">limpar a seleção</a>'
        aviso.hidden = !(n && paginaToda)
        aviso.innerHTML = aviso.hidden ? '' : n < total
            ? `Você selecionou ${plural(n)}. Você pode ${limpar} ou <a href="#" onclick="event.preventDefault(); selecionarTodosFiltroMovEst()">selecionar todos os ${plural(total)} deste filtro</a>`
            : `Você selecionou ${n === total ? 'todos os ' : ''}${plural(n)}${n === total ? ' deste filtro' : ''}. Você pode ${limpar}`
    }
    escreverTotaisMovEst()
}

// Indicadores do painel lateral: mesmos filtros da tabela.
async function indicadoresMovimentosEst(filtros = {}) {
    const alvo = document.querySelector('[data-indicadores-mov-est]')
    if (!alvo) return
    const base = 'vw_estoque_movimentos'
    const soma = async (path, extra = {}) => {
        try { return await contarPorCampo({ base, path, modo: 'soma', filtros: { ...filtros, ...extra } }) } catch { return null }
    }
    const contar = async path => {
        try { return await contarPorCampo({ base, path, filtros }) } catch { return null }
    }
    const [entra, sai, total, origens] = await Promise.all([
        soma('valor', { sentido: { op: '=', value: 'ENTRA' } }),
        soma('valor', { sentido: { op: '=', value: 'SAI' } }),
        soma('valor'),
        contar('origem')
    ])
    if (!document.querySelector('[data-indicadores-mov-est]')) return
    const qtd = n => Number(n || 0).toLocaleString('pt-BR')
    const din = r => r == null ? '—' : dinheiro(Math.abs(Number(r.total) || 0))
    const ind = (valor, texto, cor, acao, descricao) => acao
        ? `<button type="button" class="fis-cred-ind" style="--cor: ${cor}" onclick="${acao}" title="${escEst(descricao)}">
            <span>${texto}</span><b>${valor}</b><small>${escEst(descricao)}</small></button>`
        : `<div class="fis-cred-ind" style="--cor: ${cor}" title="${escEst(descricao)}">
            <span>${texto}</span><b>${valor}</b><small>${escEst(descricao)}</small></div>`
    const liquido = Number(total?.total) || 0
    const listaOrigens = Object.entries(origens || {})
        .filter(([k]) => k !== 'total' && k !== 'todos')
        .sort((a, b) => b[1] - a[1])
    alvo.innerHTML = `
        ${ind(qtd(total?.todos), 'Movimentos', '#334155', '', 'Lançamentos no filtro (entradas, saídas, ajustes e estornos).')}
        ${ind(din(entra), `Entraram (${qtd(entra?.todos)})`, '#15803d', `telaMovimentosEstoque({ sentido: { op: '=', value: 'ENTRA' } })`, 'Valor que entrou no estoque, pelo custo. Clique para ver só as entradas.')}
        ${ind(din(sai), `Saíram (${qtd(sai?.todos)})`, '#b91c1c', `telaMovimentosEstoque({ sentido: { op: '=', value: 'SAI' } })`, 'Valor que saiu do estoque, pelo custo. Clique para ver só as saídas.')}
        ${ind(`${liquido < 0 ? '−' : '+'} ${dinheiro(Math.abs(liquido))}`, 'Saldo do período', liquido < 0 ? '#b91c1c' : '#15803d', '', 'Entradas menos saídas no filtro: quanto o estoque cresceu ou diminuiu.')}
        ${listaOrigens.map(([origem, n]) => ind(qtd(n), ORIGENS_MOVIMENTO[origem] || origem, '#64748b',
            `telaMovimentosEstoque({ origem: { op: '=', value: '${escEst(origem)}' } })`, 'Movimentos desta origem. Clique para filtrar.')).join('')}`
}

function desenharRodapeMovEst() {
    const alvo = document.querySelector('[data-rodape-mov-est]')
    const ctrl = controles.movimentosEstoque
    if (!alvo || !ctrl) return
    const total = Number(document.getElementById('resultados_movimentosEstoque')?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * POR_PAGINA_MOV_EST + 1 : 0
    const fim = Math.min(total, pagina * POR_PAGINA_MOV_EST)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaMovEst(${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} movimento${total === 1 ? '' : 's'}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaMovEst(this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaMovEst(n) {
    const ctrl = controles.movimentosEstoque
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeMovEst()
    ctrl.pagina = pagina
    await paginacao('movimentosEstoque')
}

async function baixarExcelMovimentosEst() {
    const ctrl = controles.movimentosEstoque
    if (!ctrl) return
    overlayAguarde()
    try {
        const marcadas = [...selecaoMovEst.keys()]
        const filtros = marcadas.length
            ? { id: { modo: 'OR', regras: marcadas.map(id => ({ op: '=', value: id })) } }
            : combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_estoque_movimentos', filtros, ordenar: ctrl.ordenar || [{ path: 'data', direcao: 'desc' }], pagina, limite: 2000 })
            linhas.push(...(r?.resultados || []))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)
        await baixarExcelRelatorioGCS({
            titulo: 'Movimentações de estoque',
            resumo: `${linhas.length} movimento(s)`,
            filtrosTexto: marcadas.length ? `Movimentos marcados na tela: ${marcadas.length}` : `Filtros: ${typeof descreverFiltrosFin === 'function' ? descreverFiltrosFin(ctrl).replace('nenhum (todas as faturas)', 'nenhum (todos os movimentos)') : ''}`,
            linhas,
            colunas: [
                { titulo: 'Data', largura: 16, valor: d => new Date(d.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) },
                { titulo: 'Empresa', largura: 9, centro: true, valor: d => d.app || '' },
                { titulo: 'Código', largura: 10, centro: true, valor: d => d.codigo || '' },
                { titulo: 'Descrição', largura: 42, valor: d => d.descricao || '' },
                { titulo: 'Tipo', largura: 13, valor: d => TIPOS_MOVIMENTO[d.tipo]?.texto || d.tipo || '' },
                { titulo: 'Local', largura: 18, valor: d => d.local_nome || '' },
                { titulo: 'Qtd', largura: 9, soma: true, valor: d => Number(d.quantidade) || 0 },
                { titulo: 'Custo unit.', largura: 13, tipo: 'moeda', valor: d => Number(d.custo_unitario) || 0 },
                { titulo: 'Valor', largura: 14, tipo: 'moeda', soma: true, valor: d => Number(d.valor) || 0 },
                { titulo: 'Origem', largura: 20, valor: d => ORIGENS_MOVIMENTO[d.origem] || d.origem || '' },
                { titulo: 'Documento', largura: 30, valor: d => d.documento_id ? `NF ${d.documento_numero || ''} ${d.participante_nome || ''}`.trim() : '' },
                { titulo: 'Observação', largura: 30, valor: d => d.observacao || '' },
                { titulo: 'Usuário', largura: 14, valor: d => d.usuario || '' }
            ]
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escEst(err.message)}` })
    } finally {
        removerOverlay()
    }
}

// ---------------------------------------------------------------- inventário

async function telaInventarios() {
    overlayAguarde()
    try {
        const { inventarios } = await apiEstoque('inventarios')
        removerOverlay()
        const abertos = inventarios.filter(i => i.status === 'ABERTO')
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina">
                <div class="cabecalho-pagina"><h2>Inventário</h2></div>
                <div class="fis-painel">
                    <div class="fis-explica">
                        A contagem física de <b>um local</b> define o saldo de verdade dele. Ao <b>fechar</b>, o que faltou vai
                        para o local <b>Divergências</b> da empresa (fica rastreável até ser achado ou baixado) e o que sobrou
                        entra como ajuste de inventário. O primeiro inventário é o <b>marco zero</b> do estoque do GCS
                        (os saldos do Omie não são importados).
                    </div>
                    <div class="fis-acoes-claras">
                        ${abertos.map(a => `<button type="button" class="fis-botao" onclick="abrirContagemInventario('${escEst(a.id)}')">Continuar: ${escEst(a.descricao)}</button>`).join('')}
                        <button type="button" class="${abertos.length ? 'fis-mini' : 'fis-botao'}" onclick="novoInventario()">Abrir inventário</button>
                        <button type="button" class="fis-mini" onclick="telaEstoque()">Ver saldos</button>
                    </div>
                    <table class="fis-tabela">
                        <thead><tr><th>Inventário</th><th>Local</th><th>Situação</th><th>Itens contados</th><th>Aberto em</th><th>Fechado em</th><th></th></tr></thead>
                        <tbody>${inventarios.map(i => `
                            <tr>
                                <td>${escEst(i.descricao)}</td>
                                <td>${escEst(i.local_app ? `${i.local_app} · ${i.local_nome}` : '')}</td>
                                <td>${etiquetaEst(i.status, { ABERTO: '#d97706', FECHADO: '#15803d', CANCELADO: '#64748b' }[i.status])}</td>
                                <td class="fis-num">${i.contados}</td>
                                <td>${new Date(i.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} <small>${escEst(i.criado_por || '')}</small></td>
                                <td>${i.fechado_em ? new Date(i.fechado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''} <small>${escEst(i.fechado_por || '')}</small></td>
                                <td><button type="button" class="fis-mini" onclick="abrirContagemInventario('${escEst(i.id)}')">${i.status === 'ABERTO' ? 'Contar' : 'Ver'}</button></td>
                            </tr>`).join('') || '<tr><td colspan="7" class="fis-vazio">Nenhum inventário ainda.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function novoInventario() {
    let locais
    try { locais = await locaisEstoque(true) } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    popup({
        titulo: 'Abrir inventário',
        linhas: [{
            elemento: `
                <div class="fis-form" data-novo-inventario>
                    <label class="fis-campo"><span>Local a contar</span><select class="fis-input" name="local_id">${opcoesLocaisEst(locais, locais.find(l => l.padrao && l.app === 'AC')?.id)}</select></label>
                    <label class="fis-campo"><span>Nome <small>(opcional)</small></span><input class="fis-input" name="descricao" placeholder="ex.: Inventário de novembro"></label>
                </div>`
        }],
        botoes: [{ texto: 'Abrir', img: 'concluido', funcao: 'confirmarNovoInventario(this)' }]
    })
}

async function confirmarNovoInventario(botao) {
    const form = document.querySelector('[data-novo-inventario]')
    try {
        const { id } = await apiEstoque('inventario/abrir', {
            local_id: form.querySelector('[name="local_id"]').value, descricao: form.querySelector('[name="descricao"]').value
        })
        removerPopup(botao?.closest('.popup')?.id)
        abrirContagemInventario(id)
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

const estadoInventario = { id: null, itens: [], filtro: '', soContados: false }

async function abrirContagemInventario(id) {
    overlayAguarde()
    try {
        const { inventario, itens } = await apiEstoque('inventario', { id })
        removerOverlay()
        Object.assign(estadoInventario, { id, itens, inventario, filtro: '', soContados: inventario.status !== 'ABERTO' })
        const aberto = inventario.status === 'ABERTO'
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina">
                <div class="cabecalho-pagina"><h2>${escEst(inventario.descricao)}</h2><small class="est-sub">${escEst(inventario.local_app || '')} · ${escEst(inventario.local_nome || '')}</small></div>
                <div class="fis-painel">
                    <div class="fis-barra-clara">
                        <input class="fis-input fis-busca" placeholder="Buscar item (código, descrição)…" oninput="filtrarInventario(this.value)">
                        <label class="fis-check"><input type="checkbox" ${estadoInventario.soContados ? 'checked' : ''} onchange="estadoInventario.soContados = this.checked; desenharInventario()"> Só contados</label>
                        <span class="fis-resumo-inline" data-resumo-inventario></span>
                        ${aberto ? `
                            <button type="button" class="fis-botao" onclick="fecharInventarioTela()">Fechar inventário</button>
                            <button type="button" class="fis-mini" onclick="cancelarInventarioTela()">Cancelar</button>` : ''}
                        <button type="button" class="fis-mini" onclick="telaInventarios()">Voltar</button>
                    </div>
                    <div class="fis-tabela-rolagem fis-alta">
                        <table class="fis-tabela">
                            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Saldo no local</th><th>Contado</th><th>Diferença</th></tr></thead>
                            <tbody data-inventario></tbody>
                        </table>
                    </div>
                </div>
            </div>`
        desenharInventario()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function filtrarInventario(valor) {
    estadoInventario.filtro = String(valor || '').toLowerCase()
    desenharInventario()
}

function desenharInventario() {
    const corpo = document.querySelector('[data-inventario]')
    if (!corpo) return
    const { itens, filtro, soContados, inventario } = estadoInventario
    const aberto = inventario.status === 'ABERTO'
    const lista = itens.filter(i =>
        (!soContados || i.quantidade_contada != null)
        && (!filtro || `${i.codigo} ${i.descricao}`.toLowerCase().includes(filtro)))
    const limite = 300
    corpo.innerHTML = lista.slice(0, limite).map(i => {
        const base = aberto ? Number(i.saldo) : Number(i.saldo_no_fechamento ?? i.saldo)
        const dif = i.quantidade_contada == null ? null : Number(i.quantidade_contada) - base
        return `
            <tr data-item="${escEst(i.item_id)}">
                <td>${escEst(i.codigo)}</td>
                <td class="fis-descricao">${escEst(i.descricao)}</td>
                <td>${escEst(i.unidade)}</td>
                <td class="fis-num">${qtdEst(base)}</td>
                <td>${aberto
                    ? `<input class="fis-input fis-contagem" type="number" min="0" step="any" value="${i.quantidade_contada ?? ''}" onchange="salvarContagem('${escEst(i.item_id)}', this)">`
                    : qtdEst(i.quantidade_contada)}</td>
                <td class="fis-num ${dif < 0 ? 'fis-negativo' : dif > 0 ? 'fis-positivo' : ''}">${dif == null ? '' : `${dif > 0 ? '+' : ''}${qtdEst(dif)}`}</td>
            </tr>`
    }).join('') + (lista.length > limite ? `<tr><td colspan="6" class="fis-vazio">Mostrando ${limite} de ${lista.length}: use a busca.</td></tr>` : '')
    const contados = itens.filter(i => i.quantidade_contada != null)
    const comDif = contados.filter(i => Number(i.quantidade_contada) !== Number(aberto ? i.saldo : i.saldo_no_fechamento ?? i.saldo))
    const resumo = document.querySelector('[data-resumo-inventario]')
    if (resumo) resumo.textContent = `${contados.length} contados · ${comDif.length} com diferença`
}

async function salvarContagem(itemId, input) {
    const valor = input.value === '' ? null : input.value
    input.classList.remove('fis-salvo', 'fis-erro')
    try {
        await apiEstoque('inventario/contar', { id: estadoInventario.id, item_id: itemId, quantidade: valor })
        const item = estadoInventario.itens.find(i => i.item_id === itemId)
        if (item) item.quantidade_contada = valor == null ? null : Number(valor)
        input.classList.add('fis-salvo')
        const linha = input.closest('tr')
        const dif = valor == null ? null : Number(valor) - Number(item.saldo)
        linha.lastElementChild.className = `fis-num ${dif < 0 ? 'fis-negativo' : dif > 0 ? 'fis-positivo' : ''}`
        linha.lastElementChild.textContent = dif == null ? '' : `${dif > 0 ? '+' : ''}${qtdEst(dif)}`
        const contados = estadoInventario.itens.filter(i => i.quantidade_contada != null)
        const resumo = document.querySelector('[data-resumo-inventario]')
        if (resumo) resumo.textContent = `${contados.length} contados · ${contados.filter(i => Number(i.quantidade_contada) !== Number(i.saldo)).length} com diferença`
    } catch (err) {
        input.classList.add('fis-erro')
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function fecharInventarioTela() {
    const contados = estadoInventario.itens.filter(i => i.quantidade_contada != null)
    const comDif = contados.filter(i => Number(i.quantidade_contada) !== Number(i.saldo))
    const ok = await confirmarPopup({
        titulo: 'Fechar inventário',
        mensagem: `${contados.length} itens contados, ${comDif.length} com diferença.<br>O que faltou vai para o local <b>Divergências</b> da empresa; o que sobrou entra como ajuste. Itens não contados ficam como estão.<br><b>Depois de fechado não dá para alterar a contagem.</b>`,
        textoConfirmar: 'Fechar e ajustar'
    })
    if (!ok) return
    try {
        overlayAguarde()
        const r = await apiEstoque('inventario/fechar', { id: estadoInventario.id })
        removerOverlay()
        popup({ mensagem: `Inventário fechado: ${r.ajustados} itens ajustados de ${r.contados} contados${r.enviadosDivergencia ? ` (${r.enviadosDivergencia} com falta foram para Divergências)` : ''}.`, imagem: 'imagens/concluido.png' })
        telaInventarios()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function cancelarInventarioTela() {
    const ok = await confirmarPopup({ titulo: 'Cancelar inventário', mensagem: 'A contagem é descartada e nenhum saldo muda.', textoConfirmar: 'Cancelar inventário' })
    if (!ok) return
    try {
        await apiEstoque('inventario/cancelar', { id: estadoInventario.id })
        telaInventarios()
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- locais

async function telaLocaisEstoque() {
    overlayAguarde()
    try {
        const locais = await locaisEstoque(true)
        removerOverlay()
        const empresas = [...new Set(locais.map(l => l.app))]
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina">
                <div class="cabecalho-pagina"><h2>Locais de estoque</h2></div>
                <div class="fis-painel">
                    <div class="fis-explica">
                        Cada empresa tem os seus locais (Matriz, Galpão…). Transferências só entre locais da <b>mesma empresa</b>:
                        entre empresas a mercadoria passa por nota fiscal (saída numa, entrada na outra).
                        <b>Divergências</b> guarda as faltas encontradas nos inventários até serem achadas (transfira de volta) ou baixadas (ajuste).
                        <b>Uso e consumo</b> recebe os itens marcados assim na nota recebida e sai pelas requisições conferidas pela Logística.
                    </div>
                    <div class="fis-acoes-claras">
                        <button type="button" class="fis-botao" onclick="formularioLocalEstoque()">+ Local</button>
                        <button type="button" class="fis-mini" onclick="formularioTransferenciaEstoque()">Transferir itens</button>
                        <button type="button" class="fis-mini" onclick="telaEstoque()">Saldos</button>
                    </div>
                    ${empresas.map(app => `
                        <div class="est-empresa">
                            <h3>${escEst(app)}</h3>
                            <div class="est-locais">${locais.filter(l => l.app === app).map(l => `
                                <button type="button" class="est-local ${l.tipo === 'DIVERGENCIA' ? 'divergencia' : ''} ${l.tipo === 'USO_CONSUMO' ? 'uso-consumo' : ''} ${l.ativo ? '' : 'inativo'}" onclick="abrirLocalEstoque('${escEst(l.id)}')">
                                    <span class="est-local-nome">${escEst(l.nome)}${l.padrao ? ' <small>padrão</small>' : ''}${l.ativo ? '' : ' <small>desativado</small>'}</span>
                                    <b>${Number(l.itens || 0)}</b><span>item(ns) com saldo</span>
                                </button>`).join('')}
                            </div>
                        </div>`).join('')}
                </div>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function abrirLocalEstoque(localId) {
    overlayAguarde()
    try {
        const [locais, { saldos }] = await Promise.all([locaisEstoque(), apiEstoque('locais/saldos', { local_id: localId })])
        removerOverlay()
        const l = locais.find(x => x.id === localId) || {}
        // Resumo do local: itens, positivos/negativos, valor (saldo positivo × custo médio) e último movimento.
        const negativos = saldos.filter(s => Number(s.saldo) < 0)
        const positivos = saldos.filter(s => Number(s.saldo) > 0)
        const valor = positivos.reduce((t, s) => t + (s.custo_medio != null ? Number(s.saldo) * Number(s.custo_medio) : 0), 0)
        const semCusto = positivos.filter(s => s.custo_medio == null).length
        const ultimo = saldos.reduce((m, s) => s.ultimo_movimento && (!m || s.ultimo_movimento > m) ? s.ultimo_movimento : m, null)
        const data = v => v ? new Date(v).toLocaleDateString('pt-BR') : '—'
        const resumo = (rotulo, valorTexto, cor = '#334155', dica = '') =>
            `<div class="est-local-resumo-item" style="--cor: ${cor}" ${dica ? `title="${escEst(dica)}"` : ''}><span>${rotulo}</span><b>${valorTexto}</b></div>`
        popup({
            titulo: `${l.app} · ${l.nome}`,
            elemento: `
                <div class="fis-painel est-local" data-local-estoque="${escEst(localId)}">
                    <div class="est-local-resumo">
                            ${resumo('Itens', saldos.length.toLocaleString('pt-BR'))}
                            ${resumo('Com saldo', positivos.length.toLocaleString('pt-BR'), '#15803d')}
                            ${resumo('Negativos', negativos.length.toLocaleString('pt-BR'), negativos.length ? '#b91c1c' : '#64748b', 'Saiu mais do que entrou registrado neste local')}
                            ${resumo('Valor em estoque', dinheiro(valor), '#0f766e', semCusto ? `${semCusto} item(ns) com saldo ainda sem custo médio não entram na soma` : 'Saldo positivo × custo médio')}
                        ${resumo('Último movimento', data(ultimo))}
                    </div>
                    ${negativos.length ? `
                    <div class="est-local-aviso">
                        <svg class="est-local-aviso-icone" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="#b91c1c"/><rect x="7" y="3.5" width="2" height="6" rx="1" fill="#fff"/><circle cx="8" cy="12" r="1.2" fill="#fff"/></svg>
                        <span><strong>${negativos.length} item(ns) negativos:</strong> saíram (nota emitida, requisição) sem entrada registrada aqui,
                        normalmente porque o estoque ainda não teve o marco zero. Um <span class="fis-link" onclick="removerTodosPopups(); telaInventarios()">inventário deste local</span> acerta os saldos.</span>
                    </div>` : ''}
                    <div class="est-local-barra">
                        ${saldos.length ? `
                        <input class="fis-input est-local-busca" placeholder="Buscar código ou descrição…" oninput="filtrarItensLocalEst(this)">
                        <div class="fluxo-chave-empresa est-local-chips" role="group" aria-label="Filtrar itens">
                            <button type="button" class="ativo" data-filtro-local="todos" onclick="filtrarItensLocalEst(this)">Todos <small>${saldos.length}</small></button>
                            <button type="button" data-filtro-local="negativos" onclick="filtrarItensLocalEst(this)">Negativos <small>${negativos.length}</small></button>
                            <button type="button" data-filtro-local="positivos" onclick="filtrarItensLocalEst(this)">Com saldo <small>${positivos.length}</small></button>
                        </div>` : ''}
                        <div class="est-local-acoes">
                            ${saldos.length ? `<button type="button" class="fis-botao" onclick="formularioTransferenciaEstoque('${escEst(localId)}')">Transferir daqui</button>` : ''}
                            ${l.tipo === 'DIVERGENCIA' ? '' : `<button type="button" class="fis-mini" onclick="formularioLocalEstoque('${escEst(localId)}')">Editar local</button>`}
                            ${l.tipo === 'USO_CONSUMO' ? `<button type="button" class="fis-mini" onclick="telaUsoConsumoEstoque()">Requisições a conferir</button>` : ''}
                        </div>
                    </div>
                    ${saldos.length ? `
                    <div class="est-local-rolagem">
                        <table class="est-local-tabela">
                            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th class="fis-num">Saldo</th><th class="fis-num">Custo médio</th><th class="fis-num">Valor</th><th>Último mov.</th></tr></thead>
                            <tbody>${saldos.map(s => {
                                const q = Number(s.saldo)
                                const v = s.custo_medio != null ? q * Number(s.custo_medio) : null
                                return `
                                <tr data-sinal="${q < 0 ? 'negativos' : 'positivos'}" data-busca="${escEst(`${s.codigo} ${s.descricao}`.toLowerCase())}"
                                    onclick="detalheItemEstoque('${escEst(s.item_id)}')" title="Abrir o item">
                                    <td class="est-local-codigo">${escEst(s.codigo)}</td>
                                    <td class="est-local-desc" title="${escEst(s.descricao)}">${escEst(s.descricao)}</td>
                                    <td class="est-local-un">${escEst(s.unidade || '')}</td>
                                    <td class="fis-num"><span class="est-local-saldo ${q < 0 ? 'neg' : 'pos'}">${q > 0 ? '' : '−'}${qtdEst(Math.abs(q))}</span></td>
                                    <td class="fis-num">${s.custo_medio != null ? dinheiro(s.custo_medio) : '<span class="est-local-nada">—</span>'}</td>
                                    <td class="fis-num ${v != null && v < 0 ? 'fis-negativo' : ''}">${v != null ? dinheiro(v) : '<span class="est-local-nada">—</span>'}</td>
                                    <td>${data(s.ultimo_movimento)}</td>
                                </tr>`
                            }).join('')}
                            </tbody>
                        </table>
                        <div class="fis-vazio" data-local-vazio hidden>Nenhum item com esse filtro.</div>
                    </div>` : '<div class="fis-vazio">Nenhum item com saldo neste local.</div>'}
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Busca e filtros (Todos / Negativos / Com saldo) da janela do local, sem ir ao servidor.
function filtrarItensLocalEst(origem) {
    const painel = origem.closest('.est-local')
    if (!painel) return
    if (origem.dataset.filtroLocal)
        painel.querySelectorAll('[data-filtro-local]').forEach(b => b.classList.toggle('ativo', b === origem))
    const filtro = painel.querySelector('[data-filtro-local].ativo')?.dataset.filtroLocal || 'todos'
    const busca = (painel.querySelector('.est-local-busca')?.value || '').trim().toLowerCase()
    let visiveis = 0
    painel.querySelectorAll('.est-local-tabela tbody tr').forEach(tr => {
        const ok = (filtro === 'todos' || tr.dataset.sinal === filtro) && (!busca || tr.dataset.busca.includes(busca))
        tr.hidden = !ok
        if (ok) visiveis++
    })
    const vazio = painel.querySelector('[data-local-vazio]')
    if (vazio) vazio.hidden = visiveis > 0
}

async function formularioLocalEstoque(localId = null) {
    let locais
    try { locais = await locaisEstoque() } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    const l = localId ? locais.find(x => x.id === localId) : null
    const empresas = [...new Set(locais.map(x => x.app))]
    popup({
        titulo: l ? `Editar local · ${l.app}` : 'Novo local de estoque',
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-local data-id="${escEst(localId || '')}">
                    <div class="fis-grade">
                        ${l ? '' : `<label class="fis-campo"><span>Empresa</span><select class="fis-input" name="app">${empresas.map(a => `<option value="${escEst(a)}">${escEst(a)}</option>`).join('')}</select></label>`}
                        <label class="fis-campo fis-largo"><span>Nome</span><input class="fis-input" name="nome" maxlength="60" value="${escEst(l?.nome || '')}" placeholder="ex.: Galpão, Almoxarifado da obra X"></label>
                    </div>
                    ${l?.tipo === 'USO_CONSUMO' ? '' : `<label class="fis-check"><input type="checkbox" name="padrao" ${l?.padrao ? 'checked disabled' : ''}> Local padrão da empresa <small>(notas emitidas saem daqui; as recebidas sugerem este)</small></label>`}
                    ${l && !l.padrao ? `<label class="fis-check"><input type="checkbox" name="ativo" ${l.ativo ? 'checked' : ''}> Ativo</label>` : ''}
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="300" value="${escEst(l?.observacao || '')}"></label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarLocalEstoque(this)' }]
    })
}

async function salvarLocalEstoque(botao) {
    const form = document.querySelector('[data-form-local]')
    const v = n => form.querySelector(`[name="${n}"]`)
    try {
        overlayAguarde()
        await apiEstoque('locais/salvar', {
            id: form.dataset.id || undefined, app: v('app')?.value, nome: v('nome').value,
            padrao: Boolean(v('padrao')?.checked), ativo: v('ativo') ? v('ativo').checked : undefined, observacao: v('observacao').value
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        document.querySelectorAll('[data-local-estoque]').forEach(p => removerPopup(p.closest('.popup')?.id))
        telaLocaisEstoque()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Transferência: escolhe origem e destino (mesma empresa) e as quantidades dos itens que estão na origem.
async function formularioTransferenciaEstoque(de = null) {
    let locais
    try { locais = await locaisEstoque() } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    const origem = de || locais.find(l => l.padrao && l.app === 'AC')?.id
    popup({
        titulo: 'Transferir itens entre locais',
        linhas: [{
            elemento: `
                <div class="fis-form est-transferencia" data-form-transferencia>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>De</span><select class="fis-input" name="de" onchange="trocarOrigemTransferencia()">${opcoesLocaisEst(locais, origem)}</select></label>
                        <label class="fis-campo fis-largo"><span>Para</span><select class="fis-input" name="para"></select></label>
                    </div>
                    <small class="fis-dica">Só locais da mesma empresa. Entre empresas, emita a nota de saída e dê entrada na nota recebida da outra.</small>
                    <input class="fis-input fis-busca" placeholder="Filtrar itens…" oninput="filtrarTransferencia(this.value)">
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Item</th><th class="fis-num">Saldo</th><th>Transferir</th></tr></thead>
                            <tbody data-itens-transferencia><tr><td colspan="3" class="fis-vazio">Carregando…</td></tr></tbody>
                        </table>
                    </div>
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="300" placeholder="ex.: material para a obra X"></label>
                </div>`
        }],
        botoes: [{ texto: 'Transferir', img: 'concluido', funcao: 'salvarTransferenciaEstoque(this)' }]
    })
    trocarOrigemTransferencia()
}

async function trocarOrigemTransferencia() {
    const form = document.querySelector('[data-form-transferencia]')
    if (!form) return
    const locais = await locaisEstoque()
    const de = form.querySelector('[name="de"]').value
    const app = locais.find(l => l.id === de)?.app
    const para = form.querySelector('[name="para"]')
    para.innerHTML = opcoesLocaisEst(locais, null, l => l.app === app && l.id !== de)
    const corpo = form.querySelector('[data-itens-transferencia]')
    try {
        const { saldos } = await apiEstoque('locais/saldos', { local_id: de })
        corpo.innerHTML = saldos.filter(s => Number(s.saldo) > 0).map(s => `
            <tr data-busca="${escEst(`${s.codigo} ${s.descricao}`.toLowerCase())}">
                <td class="fis-descricao">${escEst(s.descricao)}<small>${escEst(s.codigo)}</small></td>
                <td class="fis-num">${qtdEst(s.saldo)} ${escEst(s.unidade || '')}</td>
                <td><input class="fis-input fis-contagem" type="number" min="0" max="${Number(s.saldo)}" step="any" data-item="${escEst(s.item_id)}" placeholder="0"></td>
            </tr>`).join('') || '<tr><td colspan="3" class="fis-vazio">Nada com saldo neste local.</td></tr>'
    } catch (err) {
        corpo.innerHTML = `<tr><td colspan="3" class="fis-vazio">${mensagemErroEst(err)}</td></tr>`
    }
}

function filtrarTransferencia(valor) {
    const termo = String(valor || '').toLowerCase()
    document.querySelectorAll('[data-itens-transferencia] tr[data-busca]').forEach(tr => { tr.hidden = termo && !tr.dataset.busca.includes(termo) })
}

async function salvarTransferenciaEstoque(botao) {
    const form = document.querySelector('[data-form-transferencia]')
    const itens = [...form.querySelectorAll('[data-item]')].map(i => ({ item_id: i.dataset.item, quantidade: Number(i.value) || 0 })).filter(i => i.quantidade > 0)
    if (!itens.length) return popup({ mensagem: 'Informe a quantidade de ao menos um item.' })
    try {
        overlayAguarde()
        const r = await apiEstoque('transferir', {
            de: form.querySelector('[name="de"]').value, para: form.querySelector('[name="para"]').value,
            itens, observacao: form.querySelector('[name="observacao"]').value
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        document.querySelectorAll('[data-local-estoque]').forEach(p => removerPopup(p.closest('.popup')?.id))
        popup({ mensagem: `Transferência feita: ${r.itens} item(ns).`, imagem: 'imagens/concluido.png' })
        if (document.querySelector('.est-locais')) telaLocaisEstoque()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- uso e consumo (requisições)
// A Logística confere cada requisição: os itens USO E CONSUMO dela e o que foi escrito no comentário (o sistema
// lê as linhas com quantidade e sugere o item do cadastro; quem confere decide). Confirmar dá a baixa no local
// "Uso e consumo" da empresa; "Sem material" tira da fila sem mexer no estoque; desfazer estorna e devolve à fila.
// Servidor: SCRIPTS/fiscal.js → rotasUsoConsumo (migrations/estoque-uso-consumo.sql).

const estadoUsoConsumo = { aba: 'pendentes', conferencia: null }
const dataCurtaEst = v => v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''

async function telaUsoConsumoEstoque(aba = estadoUsoConsumo.aba) {
    estadoUsoConsumo.aba = aba
    overlayAguarde()
    try {
        const { pendentes, conferidas } = await apiEstoque('uso-consumo/requisicoes')
        removerOverlay()
        const linhasPendentes = pendentes.map(r => `
            <tr>
                <td>${dataCurtaEst(r.criada_em)}</td>
                <td>${escEst(r.app || '')}</td>
                <td>${escEst(r.departamento || r.orcamento_id || '')}${r.baixa_status === 'DESFEITA' ? ' <small>(conferência desfeita)</small>' : ''}</td>
                <td>${escEst(r.executor || '')}</td>
                <td class="fis-num">${Number(r.itens) || ''}</td>
                <td class="est-comentario-curto">${escEst(r.comentario || '')}</td>
                <td><button type="button" class="fis-botao" onclick="conferirRequisicaoUso('${escEst(r.requisicao_id)}')">Conferir</button></td>
            </tr>`).join('') || '<tr><td colspan="7" class="fis-vazio">Nenhuma requisição esperando conferência.</td></tr>'
        const linhasConferidas = conferidas.map(r => `
            <tr>
                <td>${dataCurtaEst(r.confirmado_em)}</td>
                <td>${escEst(r.departamento || r.orcamento_id || '')} <small>${dataCurtaEst(r.criada_em)}</small></td>
                <td>${r.baixa_status === 'CONFIRMADA' ? etiquetaEst('Baixada', '#15803d') : etiquetaEst('Sem material', '#64748b')}</td>
                <td>${escEst(r.local_app ? `${r.local_app} · ${r.local_nome}` : '')}</td>
                <td class="fis-num">${Number(r.itens) || ''}</td>
                <td><small>${escEst(r.confirmado_por || '')}</small></td>
                <td><button type="button" class="fis-mini" onclick="desfazerConferenciaUso('${escEst(r.requisicao_id)}')">Desfazer</button></td>
            </tr>`).join('') || '<tr><td colspan="7" class="fis-vazio">Nada conferido ainda.</td></tr>'
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina">
                <div class="cabecalho-pagina"><h2>Uso e consumo · requisições</h2></div>
                <div class="fis-painel">
                    <div class="fis-explica">
                        Cada requisição traz os itens de <b>uso e consumo</b> dela e o que o pessoal escreveu no comentário.
                        Confira, ajuste os itens e as quantidades e <b>confirme</b>: a baixa sai do local <b>Uso e consumo</b> da empresa.
                        Se não saiu nada de uso e consumo, marque <b>Sem material</b>.
                    </div>
                    <div class="fis-acoes-claras">
                        <button type="button" class="${aba === 'pendentes' ? 'fis-botao' : 'fis-mini'}" onclick="telaUsoConsumoEstoque('pendentes')">A conferir <b>${pendentes.length}</b></button>
                        <button type="button" class="${aba === 'conferidas' ? 'fis-botao' : 'fis-mini'}" onclick="telaUsoConsumoEstoque('conferidas')">Conferidas</button>
                        <button type="button" class="fis-mini" onclick="telaLocaisEstoque()">Locais</button>
                    </div>
                    <div class="fis-tabela-rolagem">
                        ${aba === 'pendentes' ? `
                        <table class="fis-tabela">
                            <thead><tr><th>Feita em</th><th>Empresa</th><th>Departamento</th><th>Por</th><th class="fis-num">Itens U&amp;C</th><th>Comentário</th><th></th></tr></thead>
                            <tbody>${linhasPendentes}</tbody>
                        </table>` : `
                        <table class="fis-tabela">
                            <thead><tr><th>Conferida em</th><th>Requisição</th><th>Situação</th><th>Local</th><th class="fis-num">Itens</th><th>Por</th><th></th></tr></thead>
                            <tbody>${linhasConferidas}</tbody>
                        </table>`}
                    </div>
                </div>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function saldoUsoEst(itemId, localId) {
    const s = estadoUsoConsumo.conferencia?.saldos.get(`${localId}:${itemId}`)
    return s == null ? 0 : Number(s)
}

function opcaoItemUso(i, selecionado) {
    estadoUsoConsumo.conferencia?.itens.set(String(i.id), i)
    return `<option value="${escEst(i.id)}" ${selecionado ? 'selected' : ''}>${escEst(i.codigo || i.id)} · ${escEst(i.descricao)}${i.unidade ? ` (${escEst(i.unidade)})` : ''}</option>`
}

// linha: { origem: 'REQUISICAO' | 'COMENTARIO' | 'MANUAL', texto, quantidade, item?, sugestoes? }
function linhaConferenciaUso(l) {
    const opcoes = l.item ? [l.item] : (l.sugestoes || [])
    const rotulo = { REQUISICAO: 'Item da requisição', COMENTARIO: 'Comentário', MANUAL: 'Incluído na conferência' }[l.origem]
    return `
        <tr data-linha-uso data-origem="${escEst(l.origem)}">
            <td><input type="checkbox" data-incluir ${opcoes.length ? 'checked' : ''}></td>
            <td class="fis-descricao"><small>${escEst(rotulo)}</small>${l.texto ? `<div class="est-texto-original">${escEst(l.texto)}</div>` : ''}</td>
            <td class="est-item-uso">
                <select class="fis-input" data-item onchange="atualizarSaldoLinhaUso(this.closest('tr'))">
                    ${opcoes.length ? '' : '<option value="">— escolha o item —</option>'}
                    ${opcoes.map((i, n) => opcaoItemUso(i, n === 0)).join('')}
                </select>
                ${l.origem === 'REQUISICAO' ? '' : `<input class="fis-input est-busca-uso" placeholder="buscar outro item…" onchange="buscarItemUso(this)">`}
            </td>
            <td><input class="fis-input fis-contagem" type="number" min="0" step="any" data-qtd value="${escEst(l.quantidade ?? '')}"></td>
            <td class="fis-num" data-saldo></td>
        </tr>`
}

function atualizarSaldoLinhaUso(tr) {
    const caixa = tr.closest('[data-conferencia-uso]')
    const localId = caixa?.querySelector('[name="local_id"]')?.value
    const itemId = tr.querySelector('[data-item]')?.value
    const alvo = tr.querySelector('[data-saldo]')
    if (!alvo) return
    if (!itemId) { alvo.textContent = ''; return }
    const saldo = saldoUsoEst(itemId, localId)
    const item = estadoUsoConsumo.conferencia?.itens.get(String(itemId))
    alvo.innerHTML = `<span class="${saldo <= 0 ? 'fis-negativo' : ''}">${qtdEst(saldo)}</span> <small>${escEst(item?.unidade || '')}</small>`
    if (itemId) tr.querySelector('[data-incluir]').checked = true
}

function atualizarSaldosConferenciaUso() {
    document.querySelectorAll('[data-conferencia-uso] [data-linha-uso]').forEach(atualizarSaldoLinhaUso)
}

async function buscarItemUso(input) {
    const termo = input.value.trim()
    if (termo.length < 2) return
    try {
        const { itens, saldos } = await apiEstoque('uso-consumo/buscar', { texto: termo })
        for (const s of saldos) estadoUsoConsumo.conferencia?.saldos.set(`${s.local_id}:${s.item_id}`, s.saldo)
        const select = input.closest('td').querySelector('[data-item]')
        if (!itens.length) return popup({ mensagem: `Nada encontrado no cadastro para "${escEst(termo)}".` })
        select.innerHTML = itens.map((i, n) => opcaoItemUso(i, n === 0)).join('')
        atualizarSaldoLinhaUso(input.closest('tr'))
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function adicionarLinhaUso() {
    const corpo = document.querySelector('[data-conferencia-uso] [data-linhas-uso]')
    if (!corpo) return
    corpo.insertAdjacentHTML('beforeend', linhaConferenciaUso({ origem: 'MANUAL', quantidade: '' }))
    corpo.lastElementChild.querySelector('.est-busca-uso')?.focus()
}

async function conferirRequisicaoUso(requisicaoId) {
    overlayAguarde()
    try {
        const { requisicao: r, linhas, locais, local_id, saldos } = await apiEstoque('uso-consumo/requisicao', { requisicao_id: requisicaoId })
        removerOverlay()
        estadoUsoConsumo.conferencia = {
            id: requisicaoId,
            saldos: new Map(saldos.map(s => [`${s.local_id}:${s.item_id}`, s.saldo])),
            itens: new Map()
        }
        const todas = [
            ...r.itens_uso_consumo.map(i => ({ origem: 'REQUISICAO', quantidade: i.quantidade, item: { id: i.item_id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade } })),
            ...linhas.map(l => ({ origem: 'COMENTARIO', texto: l.texto, quantidade: l.quantidade, sugestoes: l.sugestoes }))
        ]
        popup({
            titulo: 'Conferir requisição · uso e consumo',
            elemento: `
                <div class="fis-painel est-conferencia-uso" data-conferencia-uso="${escEst(requisicaoId)}">
                    <div class="fis-resumo">
                        <div><span>Departamento</span><b>${escEst(r.departamento || r.orcamento_id || '—')}</b></div>
                        <div><span>Empresa</span><b>${escEst(r.app || '—')}</b></div>
                        <div><span>Feita em</span><b>${dataCurtaEst(r.criada_em)}</b></div>
                        <div><span>Por</span><b>${escEst(r.executor || '—')}</b></div>
                    </div>
                    ${r.comentario ? `<div class="est-comentario"><small>Comentário da requisição</small><div>${escEst(r.comentario)}</div></div>` : ''}
                    <label class="fis-campo"><span>Sai do local</span>
                        <select class="fis-input" name="local_id" onchange="atualizarSaldosConferenciaUso()">
                            ${locais.map(l => `<option value="${escEst(l.id)}" ${l.id === local_id ? 'selected' : ''}>${escEst(l.app)} · ${escEst(l.nome)}</option>`).join('')}
                        </select>
                    </label>
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th></th><th>De onde veio</th><th>Item do cadastro</th><th>Qtd</th><th class="fis-num">Saldo no local</th></tr></thead>
                            <tbody data-linhas-uso>${todas.map(linhaConferenciaUso).join('')}</tbody>
                        </table>
                    </div>
                    ${todas.length ? '' : '<div class="fis-vazio">Não achei itens nem linhas com quantidade no comentário: inclua os itens que saíram, ou marque "Sem material".</div>'}
                    <div class="fis-acoes-claras"><button type="button" class="fis-mini" onclick="adicionarLinhaUso()">+ Item</button></div>
                    <small class="fis-dica">Só as linhas marcadas e com quantidade dão baixa. Saldo zerado não impede a baixa (o material já saiu), mas fica negativo no local até a nota de entrada chegar.</small>
                    <label class="fis-campo"><span>Observação <small>(opcional)</small></span><input class="fis-input" name="observacao" maxlength="300"></label>
                </div>`,
            botoes: [
                { texto: 'Sem material de uso e consumo', img: 'cancel', funcao: `semMaterialRequisicaoUso('${escEst(requisicaoId)}', this)` },
                { texto: 'Confirmar baixa', img: 'concluido', funcao: `confirmarConferenciaUso('${escEst(requisicaoId)}', this)` }
            ]
        })
        atualizarSaldosConferenciaUso()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function confirmarConferenciaUso(requisicaoId, botao) {
    const caixa = document.querySelector(`[data-conferencia-uso="${CSS.escape(requisicaoId)}"]`)
    if (!caixa) return
    const itens = [], faltas = []
    caixa.querySelectorAll('[data-linha-uso]').forEach((tr, n) => {
        if (!tr.querySelector('[data-incluir]').checked) return
        const item_id = tr.querySelector('[data-item]').value
        const quantidade = Number(tr.querySelector('[data-qtd]').value)
        if (!item_id) return faltas.push(`Linha ${n + 1}: escolha o item (ou desmarque a linha).`)
        if (!(quantidade > 0)) return faltas.push(`Linha ${n + 1}: informe a quantidade (ou desmarque a linha).`)
        itens.push({ item_id, quantidade, origem: tr.dataset.origem, texto: tr.querySelector('.est-texto-original')?.textContent || null })
    })
    if (faltas.length) return popup({ mensagem: `<ul class="fis-lista-erros">${faltas.map(f => `<li>${escEst(f)}</li>`).join('')}</ul>` })
    if (!itens.length) return popup({ mensagem: 'Nenhuma linha marcada. Se não saiu nada de uso e consumo, use "Sem material de uso e consumo".' })
    try {
        overlayAguarde()
        const r = await apiEstoque('uso-consumo/confirmar', {
            requisicao_id: requisicaoId, local_id: caixa.querySelector('[name="local_id"]').value,
            itens, observacao: caixa.querySelector('[name="observacao"]').value
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        popup({ mensagem: `Baixa feita: ${r.itens} item(ns).${r.avisos?.length ? `<br><small>${r.avisos.map(escEst).join('<br>')}</small>` : ''}`, imagem: 'imagens/concluido.png', tempo: r.avisos?.length ? 8 : 4 })
        telaUsoConsumoEstoque('pendentes')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function semMaterialRequisicaoUso(requisicaoId, botao) {
    const ok = await confirmarPopup({ titulo: 'Sem material de uso e consumo', mensagem: 'A requisição sai da fila sem mexer no estoque. Dá para desfazer depois em "Conferidas".', textoConfirmar: 'Confirmar' })
    if (!ok) return
    try {
        const caixa = document.querySelector(`[data-conferencia-uso="${CSS.escape(requisicaoId)}"]`)
        await apiEstoque('uso-consumo/sem-material', { requisicao_id: requisicaoId, observacao: caixa?.querySelector('[name="observacao"]')?.value || '' })
        removerPopup(botao?.closest('.popup')?.id)
        telaUsoConsumoEstoque('pendentes')
    } catch (err) {
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function desfazerConferenciaUso(requisicaoId) {
    const motivo = await pedirTextoPopup({ titulo: 'Desfazer conferência', mensagem: 'Por que desfazer? (a baixa é estornada e a requisição volta para "A conferir")', textoConfirmar: 'Desfazer', minimo: 5 })
    if (motivo === null) return
    try {
        overlayAguarde()
        await apiEstoque('uso-consumo/desfazer', { requisicao_id: requisicaoId, motivo })
        removerOverlay()
        telaUsoConsumoEstoque('conferidas')
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}
