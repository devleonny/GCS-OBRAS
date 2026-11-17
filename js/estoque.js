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
const ORIGENS_MOVIMENTO = { NF_ENTRADA: 'Nota recebida', NF_SAIDA: 'Nota emitida', INVENTARIO: 'Inventário', MANUAL: 'Ajuste manual', ESTORNO: 'Estorno', TRANSFERENCIA: 'Transferência' }

// Locais ativos (cache da sessão; recarregado ao criar/editar).
let locaisEstoqueCache = null
async function locaisEstoque(recarregar = false) {
    if (!locaisEstoqueCache || recarregar) locaisEstoqueCache = (await apiEstoque('locais')).locais
    return locaisEstoqueCache
}
const nomeLocalEst = l => `${l.app} · ${l.nome}${l.tipo === 'DIVERGENCIA' ? ' (diferenças)' : ''}`
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
        : m.inventario_id ? 'Inventário' : ''
    const podeEstornar = acoes && !m.estornado && ['MANUAL', 'INVENTARIO'].includes(m.origem) && m.tipo !== 'ESTORNO'
    return `
        <tr class="${m.estornado ? 'fis-estornado' : ''}">
            <td>${new Date(m.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
            ${comItem ? `<td>${escEst(m.codigo)}</td><td class="fis-descricao">${escEst(m.descricao)}</td>` : ''}
            <td>${etiquetaEst(t.texto || m.tipo, t.cor)}${m.estornado ? ' <small>(estornado)</small>' : ''}</td>
            <td><small>${escEst(m.app ? `${m.app} · ${m.local_nome || ''}` : m.local_nome || '')}</small></td>
            <td class="fis-num ${q < 0 ? 'fis-negativo' : 'fis-positivo'}"><b>${q > 0 ? '+' : ''}${qtdEst(q)}</b></td>
            <td class="fis-num">${m.custo_unitario != null ? dinheiro(m.custo_unitario) : ''}</td>
            <td>${escEst(ORIGENS_MOVIMENTO[m.origem] || m.origem)}</td>
            <td>${doc}</td>
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

async function telaMovimentosEstoque() {
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina">
            <div class="cabecalho-pagina"><h2>Movimentações de estoque</h2></div>
            <div class="fis-conteudo"></div>
        </div>`
    try {
        delete controles.movimentosEstoque
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_estoque_movimentos',
            pag: 'movimentosEstoque',
            body: 'bodyMovimentosEstoque',
            criarLinha: 'criarLinhaMovimentoEstoque',
            topoEmLinha: true,
            btnExtras: `<div class="fis-acoes"><button type="button" onclick="telaEstoque()">Saldos</button><button type="button" onclick="telaLocaisEstoque()">Locais</button></div>`,
            caber: true,
            ordenar: [{ path: 'data', direcao: 'desc' }],
            colunas: {
                'Data': { chave: 'dia', tipoPesquisa: 'data' },
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
                'Local': { chave: 'local_nome', tipoPesquisa: 'select' },
                'Qtd': { chave: 'quantidade', tipoOrdenacao: 'numero' },
                'Custo': { chave: 'custo_unitario', tipoOrdenacao: 'numero' },
                'Origem': { chave: 'origem', tipoPesquisa: 'select' },
                'Documento': { chave: 'participante_nome' },
                'Observação': { chave: 'observacao' },
                'Usuário': { chave: 'usuario' }
            }
        })
        await paginacao('movimentosEstoque')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as movimentações: ${escEst(err.message)}` })
    }
}

function criarLinhaMovimentoEstoque(m) {
    return linhaMovimentoEst(m, { comItem: true, acoes: false })
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
                                <button type="button" class="est-local ${l.tipo === 'DIVERGENCIA' ? 'divergencia' : ''} ${l.ativo ? '' : 'inativo'}" onclick="abrirLocalEstoque('${escEst(l.id)}')">
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
        popup({
            titulo: `${l.app} · ${l.nome}`,
            elemento: `
                <div class="fis-painel" data-local-estoque="${escEst(localId)}">
                    <div class="fis-acoes-claras">
                        ${saldos.length ? `<button type="button" class="fis-botao" onclick="formularioTransferenciaEstoque('${escEst(localId)}')">Transferir daqui</button>` : ''}
                        ${l.tipo === 'DIVERGENCIA' ? '' : `<button type="button" class="fis-mini" onclick="formularioLocalEstoque('${escEst(localId)}')">Editar local</button>`}
                    </div>
                    ${saldos.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th class="fis-num">Saldo</th><th class="fis-num">Custo médio</th><th>Último movimento</th></tr></thead>
                            <tbody>${saldos.map(s => `
                                <tr>
                                    <td>${escEst(s.codigo)}</td>
                                    <td class="fis-descricao"><span class="fis-link" onclick="detalheItemEstoque('${escEst(s.item_id)}')">${escEst(s.descricao)}</span></td>
                                    <td>${escEst(s.unidade || '')}</td>
                                    <td class="fis-num ${Number(s.saldo) < 0 ? 'fis-negativo' : ''}"><b>${qtdEst(s.saldo)}</b></td>
                                    <td class="fis-num">${s.custo_medio != null ? dinheiro(s.custo_medio) : ''}</td>
                                    <td>${s.ultimo_movimento ? new Date(s.ultimo_movimento).toLocaleDateString('pt-BR') : ''}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : '<div class="fis-vazio">Nenhum item com saldo neste local.</div>'}
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
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
                    <label class="fis-check"><input type="checkbox" name="padrao" ${l?.padrao ? 'checked disabled' : ''}> Local padrão da empresa <small>(notas emitidas saem daqui; as recebidas sugerem este)</small></label>
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
            padrao: v('padrao').checked, ativo: v('ativo') ? v('ativo').checked : undefined, observacao: v('observacao').value
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
