// Estoque (servidor: SCRIPTS/fiscal.js → rotasEstoque, SCRIPTS/fiscal/estoque.js).
// Um único local. O saldo é a soma dos movimentos (entrada de nota, saída de nota emitida,
// inventário, ajuste); nada é apagado, corrige-se com estorno. Itens = base de composições.
// - Saldos: vw_estoque_saldos (custo médio, valor em estoque, situação).
// - Movimentações: vw_estoque_movimentos.
// - Inventário: contagem física; ao fechar, a diferença vira movimento (marco zero do estoque).

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
    ESTORNO: { cor: '#64748b', texto: 'Estorno' }
}
const ORIGENS_MOVIMENTO = { NF_ENTRADA: 'Nota recebida', NF_SAIDA: 'Nota emitida', INVENTARIO: 'Inventário', MANUAL: 'Ajuste manual', ESTORNO: 'Estorno' }

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
        const { saldo: s, movimentos } = await apiEstoque('item', { item_id: itemId })
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
                <div class="fis-secao">
                    <div class="fis-secao-topo"><b>Movimentos</b> <small>últimos 200</small>
                        <button type="button" class="fis-botao" onclick="formularioAjusteEstoque('${escEst(itemId)}')">Ajustar saldo</button>
                    </div>
                    ${movimentos.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Data</th><th>Tipo</th><th>Qtd</th><th>Custo</th><th>Origem</th><th>Documento</th><th>Observação</th><th>Usuário</th><th></th></tr></thead>
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

function formularioAjusteEstoque(itemId) {
    popup({
        titulo: 'Ajustar saldo',
        linhas: [{
            elemento: `
                <div class="fis-form" data-ajuste-estoque>
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
        await apiEstoque('ajuste', { item_id: itemId, quantidade: valor('quantidade'), custo_unitario: valor('custo_unitario'), observacao: valor('observacao') })
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
    const motivo = prompt('Motivo do estorno:')
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
            btnExtras: `<div class="fis-acoes"><button type="button" onclick="telaEstoque()">Saldos</button></div>`,
            ordenar: [{ path: 'data', direcao: 'desc' }],
            colunas: {
                'Data': { chave: 'dia', tipoPesquisa: 'data' },
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
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
        const aberto = inventarios.find(i => i.status === 'ABERTO')
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina">
                <div class="cabecalho-pagina"><h2>Inventário</h2></div>
                <div class="fis-painel">
                    <div class="fis-explica">
                        A contagem física define o saldo de verdade. Ao <b>fechar</b>, a diferença entre o contado e o
                        sistema vira um movimento de inventário. O primeiro inventário é o <b>marco zero</b> do estoque do GCS
                        (os saldos do Omie não são importados).
                    </div>
                    <div class="fis-acoes-claras">
                        ${aberto
                            ? `<button type="button" class="fis-botao" onclick="abrirContagemInventario('${escEst(aberto.id)}')">Continuar contagem: ${escEst(aberto.descricao)}</button>`
                            : `<button type="button" class="fis-botao" onclick="novoInventario()">Abrir inventário</button>`}
                        <button type="button" class="fis-mini" onclick="telaEstoque()">Ver saldos</button>
                    </div>
                    <table class="fis-tabela">
                        <thead><tr><th>Inventário</th><th>Situação</th><th>Itens contados</th><th>Aberto em</th><th>Fechado em</th><th></th></tr></thead>
                        <tbody>${inventarios.map(i => `
                            <tr>
                                <td>${escEst(i.descricao)}</td>
                                <td>${etiquetaEst(i.status, { ABERTO: '#d97706', FECHADO: '#15803d', CANCELADO: '#64748b' }[i.status])}</td>
                                <td class="fis-num">${i.contados}</td>
                                <td>${new Date(i.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} <small>${escEst(i.criado_por || '')}</small></td>
                                <td>${i.fechado_em ? new Date(i.fechado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''} <small>${escEst(i.fechado_por || '')}</small></td>
                                <td><button type="button" class="fis-mini" onclick="abrirContagemInventario('${escEst(i.id)}')">${i.status === 'ABERTO' ? 'Contar' : 'Ver'}</button></td>
                            </tr>`).join('') || '<tr><td colspan="6" class="fis-vazio">Nenhum inventário ainda.</td></tr>'}
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
    const descricao = prompt('Nome do inventário:', `Inventário ${new Date().toLocaleDateString('pt-BR')}`)
    if (descricao === null) return
    try {
        const { id } = await apiEstoque('inventario/abrir', { descricao })
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
                <div class="cabecalho-pagina"><h2>${escEst(inventario.descricao)}</h2></div>
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
                            <thead><tr><th>Código</th><th>Descrição</th><th>Un.</th><th>Saldo no sistema</th><th>Contado</th><th>Diferença</th></tr></thead>
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
        mensagem: `${contados.length} itens contados, ${comDif.length} com diferença.<br>Cada diferença vira um movimento de inventário. Itens não contados ficam como estão.<br><b>Depois de fechado não dá para alterar a contagem.</b>`,
        textoConfirmar: 'Fechar e ajustar'
    })
    if (!ok) return
    try {
        overlayAguarde()
        const r = await apiEstoque('inventario/fechar', { id: estadoInventario.id })
        removerOverlay()
        popup({ mensagem: `Inventário fechado: ${r.ajustados} itens ajustados de ${r.contados} contados.`, imagem: 'imagens/concluido.png' })
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
