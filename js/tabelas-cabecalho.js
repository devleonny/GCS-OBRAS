// Cabeçalho avançado do modTab (18/11/2026, por enquanto só nas faturas a pagar/receber):
// - filtro de cada coluna com um funil: o funil abre as opções (Contém, Igual a, Entre, Hoje, Esse mês...)
//   e o campo ao lado recebe o valor; filtro ativo fica destacado. Os períodos viram intervalos de data
//   no front (>=d / <=d), então o servidor (pesquisa-db) não muda.
// - « no título recolhe a coluna; no lugar fica um marcador listrado que, clicado, abre um balão com as
//   recolhidas para mostrar de novo.
// - segurar e arrastar o título reorganiza as colunas.
// Ordem e colunas recolhidas ficam salvas no perfil do usuário (preferências, chave "tabela_<prefKey>").
//
// Uso: no funcaoAdicional da tabela, `await cabecalhoAvancadoTabela('pag', { prefKey: 'faturas_fin' })`.
// Colunas: tipo do filtro pela config do modTab (tipoPesquisa 'data' | 'select', tipoOrdenacao 'numero')
// ou por { filtro: 'texto' | 'numero' | 'data' | 'lista' }.

const OPCOES_FILTRO_CAB = {
    texto: [['includes', 'Contém'], ['not_includes', 'Não contém'], ['=', 'Igual a'], ['!=', 'Diferente de'], ['vazio', 'Em branco'], ['preenchido', 'Preenchido']],
    numero: [['=', 'Igual a'], ['!=', 'Diferente de'], ['>=', 'Maior ou igual a'], ['<=', 'Menor ou igual a'], ['entre', 'Entre']],
    data: [['=', 'Igual a'], ['!=', 'Diferente de'], ['>', 'Depois'], ['<', 'Antes'], ['entre', 'Entre'],
        ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['esse_mes', 'Esse mês'], ['ultimo_mes', 'Último mês'], ['proximo_mes', 'Próximo mês'],
        ['esse_ano', 'Esse ano'], ['ano_passado', 'Ano passado'], ['proximo_ano', 'Próximo ano'], ['vazio', 'Em branco'], ['preenchido', 'Preenchido']],
    lista: [['=', 'Igual a'], ['!=', 'Diferente de']]
}
const OP_PADRAO_CAB = { texto: 'includes', numero: '=', data: '=', lista: '=' }
// Opções que não pedem valor (o campo mostra só o nome da opção).
const SEM_VALOR_CAB = new Set(['vazio', 'preenchido', 'hoje', 'ontem', 'esse_mes', 'ultimo_mes', 'proximo_mes', 'esse_ano', 'ano_passado', 'proximo_ano'])

const ICONE_FUNIL_CAB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/></svg>'

const escCab = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const isoCab = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dataBrCab = iso => iso ? String(iso).slice(0, 10).split('-').reverse().join('/') : ''

// Com detalhes (modTab detalhes: true) a 1ª célula de cada linha é a do "+": entra aqui como coluna fixa sem
// chave, para o índice de cada coluna continuar batendo com a posição da célula.
function colunasCab(pag) {
    const desloc = controles[pag]?.detalhes ? 1 : 0
    const cols = Object.entries(controles[pag]?.colunas || {}).map(([titulo, c], i) => ({
        idx: i + desloc, titulo, chave: c.chave || '',
        tipo: c.filtro || (c.tipoPesquisa === 'data' ? 'data' : c.tipoPesquisa === 'select' ? 'lista' : c.tipoOrdenacao === 'numero' ? 'numero' : 'texto'),
        rotulos: c.rotulos || {}
    }))
    return desloc ? [{ idx: 0, titulo: '', chave: '', tipo: 'texto', rotulos: {} }, ...cols] : cols
}

// Intervalo [início, fim] (YYYY-MM-DD) das opções de período.
function periodoCab(op) {
    const h = new Date()
    const y = h.getFullYear(), m = h.getMonth(), d = h.getDate()
    const par = (a, b) => [isoCab(a), isoCab(b)]
    switch (op) {
        case 'hoje': return par(h, h)
        case 'ontem': return par(new Date(y, m, d - 1), new Date(y, m, d - 1))
        case 'esse_mes': return par(new Date(y, m, 1), new Date(y, m + 1, 0))
        case 'ultimo_mes': return par(new Date(y, m - 1, 1), new Date(y, m, 0))
        case 'proximo_mes': return par(new Date(y, m + 1, 1), new Date(y, m + 2, 0))
        case 'esse_ano': return par(new Date(y, 0, 1), new Date(y, 11, 31))
        case 'ano_passado': return par(new Date(y - 1, 0, 1), new Date(y - 1, 11, 31))
        case 'proximo_ano': return par(new Date(y + 1, 0, 1), new Date(y + 1, 11, 31))
    }
    return null
}

const numeroCab = v => {
    const s = String(v ?? '').trim().replace(/[^\d,.-]/g, '')
    if (!s) return null
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
    return Number.isFinite(n) ? n : null
}

// Filtro do usuário (op + valores) -> regras do servidor. null = sem filtro.
function regrasFiltroCab(tipo, { op, v1 = '', v2 = '' }) {
    if (op === 'vazio') return { op: 'IS_EMPTY', value: 'S' }
    if (op === 'preenchido') return { op: 'NOT_EMPTY', value: 'S' }
    const periodo = periodoCab(op)
    if (periodo) return [{ op: '>=d', value: periodo[0] }, { op: '<=d', value: periodo[1] }]

    if (tipo === 'data') {
        if (op === 'entre') {
            const r = [v1 && { op: '>=d', value: v1 }, v2 && { op: '<=d', value: v2 }].filter(Boolean)
            return r.length ? r : null
        }
        if (!v1) return null
        return { op: `${op}d`, value: v1 }
    }
    if (tipo === 'numero') {
        const a = numeroCab(v1), b = numeroCab(v2)
        if (op === 'entre') {
            const r = [a != null && { op: '>=', value: a }, b != null && { op: '<=', value: b }].filter(Boolean)
            return r.length ? r : null
        }
        return a == null ? null : { op, value: a }
    }
    const termo = String(v1 || '').trim()
    return termo ? { op, value: termo.toLowerCase(), original: termo } : null
}

// Texto do filtro (Excel, título do campo): "Entre 01/11/2026 e 30/11/2026", "Contém sefaz"...
function textoFiltroCab(pag, chave) {
    const meta = controles[pag]?.filtrosMeta?.[chave]
    if (!meta) return ''
    const col = colunasCab(pag).find(c => c.chave === chave)
    const nomeOp = (OPCOES_FILTRO_CAB[col?.tipo] || []).find(([v]) => v === meta.op)?.[1] || meta.op
    const fmt = v => col?.tipo === 'data' ? dataBrCab(v) : col?.tipo === 'lista' ? (col.rotulos[String(v).toUpperCase()] || meta.textoValor || v) : v
    const periodo = periodoCab(meta.op)
    if (periodo) return `${nomeOp} (${dataBrCab(periodo[0])} a ${dataBrCab(periodo[1])})`
    if (SEM_VALOR_CAB.has(meta.op)) return nomeOp
    if (meta.op === 'entre') return [meta.v1 && `a partir de ${fmt(meta.v1)}`, meta.v2 && `até ${fmt(meta.v2)}`].filter(Boolean).join(' e ')
    return `${nomeOp.toLowerCase()} ${fmt(meta.v1)}`
}

async function aplicarFiltroCab(pag, chave, meta) {
    const ctrl = controles[pag]
    if (!ctrl) return
    const col = colunasCab(pag).find(c => c.chave === chave)
    ctrl.filtrosMeta ??= {}
    ctrl.filtros ??= {}
    const regras = meta ? regrasFiltroCab(col?.tipo || 'texto', meta) : null
    if (regras) {
        ctrl.filtros[chave] = regras
        ctrl.filtrosMeta[chave] = meta
    } else {
        delete ctrl.filtros[chave]
        // Opção escolhida sem valor ainda: guarda a opção (o campo já aparece no formato dela), sem filtrar.
        if (meta && !SEM_VALOR_CAB.has(meta.op)) ctrl.filtrosMeta[chave] = { op: meta.op }
        else delete ctrl.filtrosMeta[chave]
    }
    if (!Object.keys(ctrl.filtros).length) delete ctrl.filtros
    desenharFiltroCab(pag, chave)
    ctrl.pagina = 1
    await paginacao(pag)
}

// Rodapé das tabelas (layout financeiro): "N filtros ativos · limpar os filtros e exibir todos os registros".
// Conta só os filtros que a pessoa pôs (ctrl.filtros); os fixos da tela ficam.
function filtrosAtivosRodapeCab(pag) {
    const n = Object.keys(controles[pag]?.filtros || {}).length
    if (!pag || !n) return ''
    return `
        <span class="rodape-filtros-ativos">${ICONE_FUNIL_CAB} ${n} filtro${n === 1 ? '' : 's'} ativo${n === 1 ? '' : 's'}</span>
        <a href="#" class="rodape-limpar-filtros" onclick="event.preventDefault(); limparTodosFiltrosCab('${escCab(pag)}')">limpar os filtros e exibir todos os registros</a>`
}

async function limparTodosFiltrosCab(pag) {
    const ctrl = controles[pag]
    if (!ctrl) return
    delete ctrl.filtros
    delete ctrl.filtrosMeta
    const tabela = document.getElementById(ctrl.body)?.closest('table')
    // Cabeçalho avançado: redesenha cada campo vazio; cabeçalho simples: esvazia os campos da linha de pesquisa.
    tabela?.querySelectorAll('thead th.cab-filtro-th[data-cab-chave]').forEach(th => {
        delete th.dataset.cabOp
        desenharFiltroCab(pag, th.dataset.cabChave)
    })
    tabela?.querySelectorAll('thead tr:nth-child(2) [data-chave]').forEach(el => {
        if (el.matches('input, select')) el.value = ''
        else if (el.isContentEditable) el.textContent = ''
    })
    ctrl.pagina = 1
    await paginacao(pag)
}

// ---------------------------------------------------------------- campo do filtro
function desenharFiltroCab(pag, chave) {
    const tabela = document.getElementById(controles[pag]?.body)?.closest('table')
    const th = tabela?.querySelector(`thead tr:nth-child(2) th[data-cab-chave="${CSS.escape(chave)}"]`)
    const col = colunasCab(pag).find(c => c.chave === chave)
    if (!th || !col) return
    const meta = controles[pag].filtrosMeta?.[chave] || { op: OP_PADRAO_CAB[col.tipo] }
    const ativo = !!controles[pag].filtros?.[chave]
    const p = escCab(pag), k = escCab(chave)
    const aplicar = `lerCampoFiltroCab('${p}', '${k}')`
    // Mesma opção de antes: os campos já têm o que a pessoa digitou; só atualiza o destaque.
    const caixa = th.querySelector('.cab-filtro')
    if (caixa && th.dataset.cabOp === meta.op) {
        caixa.classList.toggle('ativo', ativo)
        caixa.title = ativo ? textoFiltroCab(pag, chave) : ''
        if (!ativo && !controles[pag].filtrosMeta?.[chave]) caixa.querySelectorAll('input, select').forEach(c => { c.value = '' })
        return
    }
    th.dataset.cabOp = meta.op
    let campos
    if (SEM_VALOR_CAB.has(meta.op)) {
        const nome = (OPCOES_FILTRO_CAB[col.tipo] || []).find(([v]) => v === meta.op)?.[1] || ''
        campos = `<span class="cab-filtro-rotulo" title="${escCab(textoFiltroCab(pag, chave))}">${escCab(nome)}</span>`
    } else if (col.tipo === 'lista') {
        const opcoes = (th._opcoesCab || []).map(([v, t]) => `<option value="${escCab(v)}" ${String(meta.v1 ?? '') === v ? 'selected' : ''}>${escCab(t)}</option>`).join('')
        campos = `<select class="cab-filtro-campo" data-v1 onchange="${aplicar}"><option value=""></option>${opcoes}</select>`
    } else {
        const tipoInput = col.tipo === 'data' ? 'date' : 'text'
        // Data: o "change" vem a cada pedaço digitado do ano; espera a pessoa parar (ou Enter / sair do campo).
        const evento = col.tipo === 'data'
            ? `onchange="agendarCampoFiltroCab('${p}', '${k}')" onkeydown="if (event.key === 'Enter') { event.preventDefault(); ${aplicar} }" onblur="${aplicar}"`
            : `onkeydown="if (event.key === 'Enter') { event.preventDefault(); ${aplicar} }" onchange="${aplicar}"`
        const campo = (attr, valor, dica) => `<input class="cab-filtro-campo" ${attr} type="${tipoInput}" value="${escCab(valor ?? '')}" ${dica ? `placeholder="${dica}"` : ''} ${col.tipo === 'numero' ? 'inputmode="decimal"' : ''} ${evento}>`
        campos = meta.op === 'entre'
            ? `<div class="cab-filtro-entre">${campo('data-v1', meta.v1, col.tipo === 'numero' ? 'de' : '')}${campo('data-v2', meta.v2, col.tipo === 'numero' ? 'até' : '')}</div>`
            : campo('data-v1', meta.v1)
    }
    // Redesenhar troca os campos: devolve o foco ao que estava sendo usado.
    const focado = th.contains(document.activeElement) ? (document.activeElement.hasAttribute('data-v2') ? 'data-v2' : 'data-v1') : null
    th.innerHTML = `
        <div class="cab-filtro${ativo ? ' ativo' : ''}" title="${escCab(ativo ? textoFiltroCab(pag, chave) : '')}">
            <button type="button" class="cab-funil" title="Opções do filtro" onclick="abrirMenuFiltroCab(event, '${p}', '${k}')">${ICONE_FUNIL_CAB}</button>
            ${campos}
        </div>`
    if (focado) {
        const campo = th.querySelector(`[${focado}]`)
        campo?.focus()
        if (campo?.type === 'text') campo.setSelectionRange(campo.value.length, campo.value.length)
    }
}

const temporizadoresCab = {}
function agendarCampoFiltroCab(pag, chave) {
    clearTimeout(temporizadoresCab[`${pag}|${chave}`])
    temporizadoresCab[`${pag}|${chave}`] = setTimeout(() => lerCampoFiltroCab(pag, chave), 700)
}

function lerCampoFiltroCab(pag, chave) {
    clearTimeout(temporizadoresCab[`${pag}|${chave}`])
    const th = document.getElementById(controles[pag]?.body)?.closest('table')
        ?.querySelector(`thead tr:nth-child(2) th[data-cab-chave="${CSS.escape(chave)}"]`)
    if (!th) return
    const col = colunasCab(pag).find(c => c.chave === chave)
    const atual = controles[pag].filtrosMeta?.[chave] || { op: OP_PADRAO_CAB[col?.tipo || 'texto'] }
    // Data com ano pela metade (digitando "0202"...): espera completar.
    const valor = el => {
        const v = el?.value ?? ''
        return col?.tipo === 'data' && v && !/^(19|20)\d\d-/.test(v) ? null : v
    }
    const v1 = valor(th.querySelector('[data-v1]'))
    const v2 = valor(th.querySelector('[data-v2]'))
    if (v1 === null || v2 === null) return
    const sel = th.querySelector('select[data-v1]')
    const meta = { op: atual.op, v1, v2, ...(sel ? { textoValor: sel.selectedOptions[0]?.textContent || '' } : {}) }
    // Mesmo filtro de antes (o "change"/"blur" do campo depois do Enter): não pesquisa de novo.
    if ((atual.v1 || '') === v1 && (atual.v2 || '') === (v2 || '') && !!controles[pag].filtros?.[chave] === !!regrasFiltroCab(col?.tipo, meta)) return
    aplicarFiltroCab(pag, chave, meta)
}

// ---------------------------------------------------------------- menu do funil e balões
function fecharBalaoCab() {
    document.querySelectorAll('.cab-balao').forEach(b => b.remove())
    document.removeEventListener('mousedown', fecharBalaoForaCab, true)
    document.removeEventListener('keydown', fecharBalaoEscCab, true)
    window.removeEventListener('scroll', fecharBalaoCab, true)
    window.removeEventListener('resize', fecharBalaoCab)
}
function fecharBalaoForaCab(e) { if (!e.target.closest('.cab-balao')) fecharBalaoCab() }
function fecharBalaoEscCab(e) { if (e.key === 'Escape') fecharBalaoCab() }

function abrirBalaoCab(ancora, html) {
    fecharBalaoCab()
    const balao = document.createElement('div')
    balao.className = 'cab-balao'
    balao.innerHTML = html
    document.body.appendChild(balao)
    const r = ancora.getBoundingClientRect()
    const largura = balao.offsetWidth, altura = balao.offsetHeight
    balao.style.left = `${Math.max(4, Math.min(r.left, window.innerWidth - largura - 4))}px`
    balao.style.top = `${r.bottom + 4 + altura > window.innerHeight ? Math.max(4, r.top - altura - 4) : r.bottom + 4}px`
    setTimeout(() => {
        document.addEventListener('mousedown', fecharBalaoForaCab, true)
        document.addEventListener('keydown', fecharBalaoEscCab, true)
        window.addEventListener('scroll', fecharBalaoCab, true)
        window.addEventListener('resize', fecharBalaoCab)
    })
    return balao
}

function abrirMenuFiltroCab(event, pag, chave) {
    event.stopPropagation()
    const col = colunasCab(pag).find(c => c.chave === chave)
    if (!col) return
    const atual = controles[pag].filtrosMeta?.[chave]?.op || OP_PADRAO_CAB[col.tipo]
    const ativo = !!controles[pag].filtros?.[chave]
    const p = escCab(pag), k = escCab(chave)
    const itens = OPCOES_FILTRO_CAB[col.tipo].map(([op, nome]) => `
        <button type="button" class="cab-balao-item${op === atual ? ' atual' : ''}" onclick="escolherOpFiltroCab('${p}', '${k}', '${op}')">
            <span class="cab-balao-marca">${op === atual ? '✓' : ''}</span>${escCab(nome)}${periodoCab(op) ? `<small>${dataBrCab(periodoCab(op)[0])} a ${dataBrCab(periodoCab(op)[1])}</small>` : ''}
        </button>`).join('')
    abrirBalaoCab(event.currentTarget, `
        <button type="button" class="cab-balao-item limpar" ${ativo || controles[pag].filtrosMeta?.[chave] ? '' : 'disabled'} onclick="escolherOpFiltroCab('${p}', '${k}', null)">
            <span class="cab-balao-marca">${ICONE_FUNIL_CAB}</span>Limpar filtro</button>
        <hr>${itens}`)
}

function escolherOpFiltroCab(pag, chave, op) {
    fecharBalaoCab()
    if (!op) return aplicarFiltroCab(pag, chave, null)
    const col = colunasCab(pag).find(c => c.chave === chave)
    const anterior = controles[pag].filtrosMeta?.[chave] || {}
    // Troca de opção mantém o valor digitado quando faz sentido (Igual a -> Diferente de, Depois -> Entre...).
    const meta = SEM_VALOR_CAB.has(op) ? { op } : { op, v1: SEM_VALOR_CAB.has(anterior.op) ? '' : anterior.v1 || '', v2: op === 'entre' ? anterior.v2 || '' : '', textoValor: anterior.textoValor }
    if (!SEM_VALOR_CAB.has(op) && !regrasFiltroCab(col?.tipo, meta)) {
        // Sem valor ainda: só troca o campo e põe o cursor nele.
        controles[pag].filtrosMeta ??= {}
        controles[pag].filtrosMeta[chave] = meta
        const tinhaFiltro = !!controles[pag].filtros?.[chave]
        if (tinhaFiltro) return aplicarFiltroCab(pag, chave, meta)
        desenharFiltroCab(pag, chave)
        document.getElementById(controles[pag].body)?.closest('table')
            ?.querySelector(`thead tr:nth-child(2) th[data-cab-chave="${CSS.escape(chave)}"] .cab-filtro-campo`)?.focus()
        return
    }
    aplicarFiltroCab(pag, chave, meta)
}

// ---------------------------------------------------------------- ordem, colunas recolhidas e arrastar
const chavePrefCab = pag => `tabela_${controles[pag]?.cabPrefKey || pag}`.toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 60)

function salvarPrefsCab(pag) {
    const ctrl = controles[pag]
    if (!ctrl?.cabPrefs) return
    salvarPreferenciaUsuario(chavePrefCab(pag), { ordem: ctrl.cabPrefs.ordem || [], ocultas: ctrl.cabPrefs.ocultas || [], larguras: ctrl.cabPrefs.larguras || {} })
}

// ---------------------------------------------------------------- largura das colunas (alça na divisória do título)
// Largura fixa em todas as células da coluna (título, filtro, linhas e rodapé); o texto que não cabe vira "…".
function larguraColunaCab(pag, chave, px) {
    const ctrl = controles[pag]
    const tabela = document.getElementById(ctrl?.body)?.closest('table')
    const col = colunasCab(pag).find(c => c.chave === chave)
    if (!tabela || !col) return
    const valor = px ? `${px}px` : ''
    const celulas = [
        ...tabela.querySelectorAll(`:scope > thead > tr > [data-col="${col.idx}"], :scope > tfoot > tr > [data-col="${col.idx}"]`),
        ...(document.getElementById(ctrl.body)?.querySelectorAll(`:scope > tr > [data-col="${col.idx}"]`) || [])
    ]
    celulas.forEach(c => {
        c.style.width = valor
        c.style.minWidth = valor
        c.style.maxWidth = valor
        c.classList.toggle('cab-largura-fixa', !!px)
    })
}

let larguraEmAndamentoCab = null

function iniciarLarguraCab(event, pag, chave) {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const th = event.currentTarget.closest('th')
    th.draggable = false
    larguraEmAndamentoCab = { pag, chave, th, x: event.clientX, inicial: th.getBoundingClientRect().width, largura: null }
    document.body.classList.add('cab-redimensionando')
    document.addEventListener('mousemove', moverLarguraCab)
    document.addEventListener('mouseup', soltarLarguraCab)
}

function moverLarguraCab(event) {
    const r = larguraEmAndamentoCab
    if (!r) return
    r.largura = Math.max(40, Math.round(r.inicial + event.clientX - r.x))
    larguraColunaCab(r.pag, r.chave, r.largura)
}

function soltarLarguraCab() {
    const r = larguraEmAndamentoCab
    larguraEmAndamentoCab = null
    document.body.classList.remove('cab-redimensionando')
    document.removeEventListener('mousemove', moverLarguraCab)
    document.removeEventListener('mouseup', soltarLarguraCab)
    if (!r) return
    r.th.draggable = true
    // O clique que vem depois do mouseup ordenaria a coluna: engole só esse.
    const engolir = e => { e.stopPropagation(); e.preventDefault() }
    window.addEventListener('click', engolir, { capture: true, once: true })
    setTimeout(() => window.removeEventListener('click', engolir, { capture: true }), 0)
    if (r.largura == null) return
    const ctrl = controles[r.pag]
    ctrl.cabPrefs.larguras = { ...(ctrl.cabPrefs.larguras || {}), [r.chave]: r.largura }
    salvarPrefsCab(r.pag)
}

// Duplo clique na alça: volta à largura automática.
function larguraAutomaticaCab(event, pag, chave) {
    event.preventDefault()
    event.stopPropagation()
    const ctrl = controles[pag]
    if (!ctrl.cabPrefs?.larguras?.[chave]) return
    delete ctrl.cabPrefs.larguras[chave]
    larguraColunaCab(pag, chave, null)
    salvarPrefsCab(pag)
}

// Índices originais (ordem do modTab) na ordem que o usuário escolheu. Colunas sem chave (a da caixinha) ficam no começo.
function ordemFinalCab(pag) {
    const cols = colunasCab(pag)
    const ordem = controles[pag].cabPrefs?.ordem || []
    const fixas = cols.filter(c => !c.chave)
    const moveis = cols.filter(c => c.chave)
    const pos = c => { const i = ordem.indexOf(c.chave); return i < 0 ? ordem.length + c.idx : i }
    return [...fixas, ...moveis.sort((a, b) => pos(a) - pos(b) || a.idx - b.idx)]
}

function reordenarLinhaCab(tr, sequencia, n) {
    const celulas = [...tr.children]
    if (celulas.length !== n) return
    celulas.forEach((c, i) => { if (c.dataset.col == null) c.dataset.col = i })
    const atual = celulas.map(c => c.dataset.col).join(',')
    const desejada = sequencia.join(',')
    if (atual === desejada) return
    const porCol = new Map(celulas.map(c => [c.dataset.col, c]))
    sequencia.forEach(i => { const c = porCol.get(String(i)); if (c) tr.appendChild(c) })
}

function aplicarLayoutCab(pag) {
    const ctrl = controles[pag]
    const tabela = document.getElementById(ctrl?.body)?.closest('table')
    if (!tabela) return
    const cols = colunasCab(pag)
    const n = cols.length
    const sequencia = ordemFinalCab(pag).map(c => c.idx)
    tabela.querySelectorAll(':scope > thead > tr, :scope > tfoot > tr').forEach(tr => reordenarLinhaCab(tr, sequencia, n))
    document.getElementById(ctrl.body)?.querySelectorAll(':scope > tr').forEach(tr => reordenarLinhaCab(tr, sequencia, n))

    // Recolhidas: o modTab esconde pelo título (ctrl.ocultar); o rodapé (totais) é por conta daqui.
    const ocultas = new Set((ctrl.cabPrefs?.ocultas || []).filter(k => cols.some(c => c.chave === k)))
    ctrl.ocultar = cols.filter(c => ocultas.has(c.chave)).map(c => c.titulo)
    tabela.querySelectorAll(':scope > tfoot > tr > *').forEach(td => {
        const c = cols[Number(td.dataset.col)]
        td.style.display = c && ocultas.has(c.chave) ? 'none' : ''
    })

    // Marcadores: na coluna visível seguinte a cada grupo de recolhidas (ou na anterior, no fim da tabela).
    tabela.querySelectorAll('.cab-marcador').forEach(m => m.remove())
    const ordem = ordemFinalCab(pag)
    const titulos = new Map([...tabela.querySelectorAll(':scope > thead > tr:first-child > th')].map(th => [th.dataset.col, th]))
    let grupo = []
    const marcar = (alvoCol, lado) => {
        const th = titulos.get(String(alvoCol.idx))
        if (!th || !grupo.length) return
        const chaves = grupo.map(c => c.chave)
        th.insertAdjacentHTML('beforeend', `<button type="button" class="cab-marcador ${lado}" title="Colunas recolhidas: ${escCab(grupo.map(c => c.titulo).join(', '))}"
            onclick="event.stopPropagation(); abrirRecolhidasCab(event, '${escCab(pag)}', '${escCab(chaves.join('|'))}')" draggable="false"></button>`)
        grupo = []
    }
    let ultimaVisivel = null
    ordem.forEach(c => {
        if (c.chave && ocultas.has(c.chave)) { grupo.push(c); return }
        if (grupo.length) marcar(c, 'esquerda')
        ultimaVisivel = c
    })
    if (grupo.length && ultimaVisivel) marcar(ultimaVisivel, 'direita')
    Object.entries(ctrl.cabPrefs?.larguras || {}).forEach(([chave, px]) => {
        if (cols.some(c => c.chave === chave) && Number(px) > 0) larguraColunaCab(pag, chave, Number(px))
    })
    aplicarColunasOcultas(pag)
}

function abrirRecolhidasCab(event, pag, chavesTexto) {
    const chaves = chavesTexto.split('|')
    const cols = colunasCab(pag).filter(c => chaves.includes(c.chave))
    const p = escCab(pag)
    abrirBalaoCab(event.currentTarget, `
        <div class="cab-balao-titulo">Colunas recolhidas</div>
        ${cols.map(c => `<button type="button" class="cab-balao-item" onclick="mostrarColunaCab('${p}', '${escCab(c.chave)}')"><span class="cab-balao-marca">»</span>${escCab(c.titulo)}</button>`).join('')}
        ${cols.length > 1 ? `<hr><button type="button" class="cab-balao-item" onclick="mostrarColunaCab('${p}', '${escCab(chavesTexto)}')"><span class="cab-balao-marca"></span>Mostrar todas</button>` : ''}`)
}

function recolherColunaCab(pag, chave) {
    const ctrl = controles[pag]
    ctrl.cabPrefs ??= { ordem: [], ocultas: [] }
    const visiveis = colunasCab(pag).filter(c => c.chave && !ctrl.cabPrefs.ocultas.includes(c.chave))
    if (visiveis.length <= 1) return
    ctrl.cabPrefs.ocultas = [...new Set([...ctrl.cabPrefs.ocultas, chave])]
    fecharBalaoCab()
    aplicarLayoutCab(pag)
    salvarPrefsCab(pag)
}

function mostrarColunaCab(pag, chavesTexto) {
    const ctrl = controles[pag]
    const chaves = chavesTexto.split('|')
    ctrl.cabPrefs.ocultas = (ctrl.cabPrefs.ocultas || []).filter(k => !chaves.includes(k))
    fecharBalaoCab()
    aplicarLayoutCab(pag)
    salvarPrefsCab(pag)
}

let arrasteCab = null

function iniciarArrasteCab(event, pag, chave) {
    arrasteCab = { pag, chave }
    event.dataTransfer.effectAllowed = 'move'
    try { event.dataTransfer.setData('text/plain', chave) } catch { }
    event.currentTarget.classList.add('cab-arrastando')
}

function sobreArrasteCab(event, pag, chave) {
    if (!arrasteCab || arrasteCab.pag !== pag || arrasteCab.chave === chave) return
    event.preventDefault()
    const th = event.currentTarget
    const r = th.getBoundingClientRect()
    const depois = event.clientX > r.left + r.width / 2
    th.classList.toggle('cab-soltar-antes', !depois)
    th.classList.toggle('cab-soltar-depois', depois)
}

function sairArrasteCab(event) {
    event.currentTarget.classList.remove('cab-soltar-antes', 'cab-soltar-depois')
}

function fimArrasteCab() {
    document.querySelectorAll('.cab-arrastando, .cab-soltar-antes, .cab-soltar-depois')
        .forEach(th => th.classList.remove('cab-arrastando', 'cab-soltar-antes', 'cab-soltar-depois'))
    arrasteCab = null
}

function soltarArrasteCab(event, pag, chave) {
    if (!arrasteCab || arrasteCab.pag !== pag || arrasteCab.chave === chave) return fimArrasteCab()
    event.preventDefault()
    const depois = event.currentTarget.classList.contains('cab-soltar-depois')
    const ctrl = controles[pag]
    ctrl.cabPrefs ??= { ordem: [], ocultas: [] }
    const ordem = ordemFinalCab(pag).filter(c => c.chave).map(c => c.chave).filter(k => k !== arrasteCab.chave)
    const alvo = ordem.indexOf(chave)
    ordem.splice(depois ? alvo + 1 : alvo, 0, arrasteCab.chave)
    ctrl.cabPrefs.ordem = ordem
    fimArrasteCab()
    aplicarLayoutCab(pag)
    salvarPrefsCab(pag)
}

// ---------------------------------------------------------------- montagem (uma vez por tabela) + a cada carga
async function cabecalhoAvancadoTabela(pag, { prefKey = pag } = {}) {
    const ctrl = controles[pag]
    const tabela = document.getElementById(ctrl?.body)?.closest('table')
    if (!tabela) return
    ctrl.cabPrefKey = prefKey
    if (!ctrl.cabPrefs) {
        const salvo = await preferenciaUsuario(chavePrefCab(pag), null).catch(() => null)
        ctrl.cabPrefs = {
            ordem: Array.isArray(salvo?.ordem) ? salvo.ordem : [],
            ocultas: Array.isArray(salvo?.ocultas) ? salvo.ocultas : [],
            larguras: salvo?.larguras && typeof salvo.larguras === 'object' ? salvo.larguras : {}
        }
    }

    if (!tabela.dataset.cabPronto) {
        tabela.dataset.cabPronto = 'S'
        tabela.classList.add('cab-avancado')
        const cols = colunasCab(pag)
        const [linhaTitulos, linhaFiltros] = tabela.querySelectorAll(':scope > thead > tr')
        ;[...(linhaTitulos?.children || [])].forEach((th, i) => {
            th.dataset.col = i
            const c = cols[i]
            if (!c?.chave) return
            const p = escCab(pag), k = escCab(c.chave)
            th.dataset.cabChave = c.chave
            th.draggable = true
            th.title = 'Clique para ordenar · segure e arraste para mudar a coluna de lugar'
            th.setAttribute('ondragstart', `iniciarArrasteCab(event, '${p}', '${k}')`)
            th.setAttribute('ondragover', `sobreArrasteCab(event, '${p}', '${k}')`)
            th.setAttribute('ondragleave', 'sairArrasteCab(event)')
            th.setAttribute('ondrop', `soltarArrasteCab(event, '${p}', '${k}')`)
            th.setAttribute('ondragend', 'fimArrasteCab()')
            th.firstElementChild?.insertAdjacentHTML('beforeend',
                `<button type="button" class="cab-recolher" title="Recolher a coluna" draggable="false" onclick="event.stopPropagation(); recolherColunaCab('${p}', '${k}')">«</button>`)
            th.insertAdjacentHTML('beforeend',
                `<span class="cab-alca-largura" title="Arraste para mudar a largura · duplo clique volta ao automático" draggable="false"
                    onmousedown="iniciarLarguraCab(event, '${p}', '${k}')" onclick="event.stopPropagation()" ondblclick="larguraAutomaticaCab(event, '${p}', '${k}')"></span>`)
        })
        ;[...(linhaFiltros?.children || [])].forEach((thVelho, i) => {
            thVelho.dataset.col = i
            const c = cols[i]
            if (!c?.chave) return
            // Troca o filtro do modTab (contentEditable / select / 2 datas) pelo funil + campo.
            const th = document.createElement('th')
            th.className = 'cab-filtro-th'
            th.dataset.col = i
            th.dataset.cabChave = c.chave
            th.style.cssText = thVelho.style.cssText
            if (c.tipo === 'lista')
                th._opcoesCab = [...thVelho.querySelectorAll('option')].filter(o => o.value !== '').map(o => [o.value, o.textContent])
            thVelho.replaceWith(th)
            desenharFiltroCab(pag, c.chave)
        })
    }
    aplicarLayoutCab(pag)
}
