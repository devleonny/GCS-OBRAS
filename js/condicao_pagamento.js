// Condição de pagamento (16/11/2026): a mesma peça no cadastro da empresa (padrão dos clientes dela),
// no pedido (pré-preenchido pela empresa) e na NF-e/NFS-e (vem do pedido; calcula os vencimentos
// das duplicatas, que viram as faturas a receber). O servidor calcula igual: gcs SCRIPTS/fiscal/motor.js.
//
// { forma: '15', modo: 'AVISTA' | 'MESES' | 'DIAS',
//   parcelas: 3, base: 'EMISSAO' | 'DIA', dia: 10,                               (MESES)
//   prazos: [30, 60, 90] }                                                            (DIAS)

const FORMAS_CONDICAO_PAG = [['15', 'Boleto'], ['17', 'PIX'], ['18', 'Transferência bancária'], ['16', 'Depósito bancário'],
    ['03', 'Cartão de crédito'], ['04', 'Cartão de débito'], ['01', 'Dinheiro'], ['14', 'Duplicata mercantil'], ['90', 'Sem pagamento (remessa, comodato, devolução…)']]

const MODOS_CONDICAO_PAG = [['AVISTA', 'À vista'], ['MESES', 'Parcelas mensais (1x, 2x, 3x…)'], ['DIAS', 'Prazos em dias (30/60/90…)']]

const BASES_CONDICAO_PAG = [['EMISSAO', '1 mês após a emissão'], ['DIA', 'Dia fixo do mês']]

const MAX_PARCELAS_PAG = 60

// Nossas empresas de faturamento: o mesmo código no pedido, na nota, no cadastro da empresa e no "Empresa"
// dos Dados do Cliente do orçamento (dados_orcam.emissor). Desde 16/11/2026 o orçamento grava "AC";
// os antigos têm "AC SOLUÇÕES" e continuam valendo (o banco compara com ILIKE 'AC%').
const EMPRESAS_FATURAMENTO = [['AC', 'AC'], ['IAC', 'IAC'], ['HNW', 'HNW'], ['HNK', 'HNK']]

// "AC SOLUÇÕES" / "ac" / "IAC" → código; vazio ou desconhecido → ''.
function codigoEmpresaFat(valor) {
    const t = String(valor || '').trim().toUpperCase()
    if (!t) return ''
    for (const [codigo] of EMPRESAS_FATURAMENTO) if (t === codigo) return codigo
    // Pelo começo do nome, como o banco (ILIKE 'IAC%' ... 'AC%'): "AC SOLUÇÕES" → AC.
    for (const codigo of ['IAC', 'HNK', 'HNW', 'AC']) if (t.startsWith(codigo)) return codigo
    return ''
}

// "Faturar até o dia 24 (limite: dia 25)": o dia do limite não entra.
function textoLimiteFaturamento(dia) {
    const d = Number(dia)
    if (!(Number.isInteger(d) && d >= 1 && d <= 31)) return ''
    return d === 1 ? 'Faturar até o último dia do mês anterior (limite: dia 1)' : `Faturar até o dia ${d - 1} de cada mês (limite: dia ${d})`
}

function escCondPag(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function dataBrCondPag(iso) {
    const [a, m, d] = String(iso || '').slice(0, 10).split('-')
    return a && m && d ? `${d}/${m}/${a}` : ''
}

function hojeCondPag() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// Dia "dia" do mês (ano/mês + deslocamento), limitado ao último dia do mês (31 em fevereiro → 28/29).
function diaDoMesCondPag(ano, mes0, dia) {
    const alvo = new Date(Date.UTC(ano, mes0, 1))
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
    alvo.setUTCDate(Math.min(dia, ultimo))
    return alvo.toISOString().slice(0, 10)
}

function somarMesesCondPag(iso, meses) {
    const [a, m, d] = iso.split('-').map(Number)
    return diaDoMesCondPag(a, m - 1 + meses, d)
}

function somarDiasCondPag(iso, dias) {
    const [a, m, d] = iso.split('-').map(Number)
    return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}


// Aceita a condição nova, a antiga da NF-e ({ forma, parcelas }) e o texto antigo do pedido
// ("3", "3x", "30 dias", "30/60/90 dias"). Sem nada reconhecível: null.
function normalizarCondicaoPag(c) {
    if (c == null || c === '') return null
    if (typeof c === 'number' || typeof c === 'string') {
        const t = String(c).trim().toLowerCase()
        let m = t.match(/^(\d+)\s*x?$/)
        if (m) return Number(m[1]) >= 1 ? { modo: 'MESES', parcelas: Math.min(Number(m[1]), MAX_PARCELAS_PAG), base: 'EMISSAO' } : { modo: 'AVISTA' }
        m = t.match(/^(\d+(?:\s*[\/,;]\s*\d+)*)\s*(?:dias?|dd|d)$/)
        if (m) return { modo: 'DIAS', prazos: m[1].split(/[\/,;]/).map(n => Number(n.trim())) }
        if (/^(à|a) vista$/.test(t)) return { modo: 'AVISTA' }
        return null
    }
    if (typeof c !== 'object') return null
    const forma = c.forma == null || c.forma === '' ? undefined : String(c.forma).padStart(2, '0')
    if (!c.modo) {
        // Formato antigo da NF-e: parcelas mensais a partir da emissão (0 = à vista).
        const n = Math.floor(Number(c.parcelas) || 0)
        return { forma, ...(n >= 1 ? { modo: 'MESES', parcelas: n, base: 'EMISSAO' } : { modo: 'AVISTA' }) }
    }
    const modo = String(c.modo).toUpperCase()
    if (modo === 'MESES') return {
        forma, modo, parcelas: Math.floor(Number(c.parcelas) || 0),
        base: c.base === 'DIA' ? 'DIA' : 'EMISSAO',
        ...(c.base === 'DIA' ? { dia: Math.floor(Number(c.dia) || 0) } : {})
    }
    if (modo === 'DIAS') return { forma, modo, prazos: (Array.isArray(c.prazos) ? c.prazos : []).map(Number) }
    return { forma, modo: 'AVISTA' }
}

// Problemas da condição (lista vazia = válida). "emissao" opcional: confere datas já passadas.
function errosCondicaoPag(c, emissaoISO) {
    const e = []
    if (!c) return ['Informe a condição de pagamento.']
    if (c.forma === '90') return e
    if (c.modo === 'MESES') {
        if (!(Number.isInteger(c.parcelas) && c.parcelas >= 1 && c.parcelas <= MAX_PARCELAS_PAG)) e.push(`Parcelas mensais: de 1 a ${MAX_PARCELAS_PAG}.`)
        if (c.base === 'DIA' && !(Number.isInteger(c.dia) && c.dia >= 1 && c.dia <= 31)) e.push('Dia fixo do mês: de 1 a 31.')
    }
    if (c.modo === 'DIAS') {
        if (!c.prazos.length) e.push('Informe os prazos em dias (ex.: 30/60/90).')
        else if (c.prazos.some(p => !(Number.isInteger(p) && p >= 0 && p <= 3650))) e.push('Prazos em dias: números inteiros de 0 a 3650 (ex.: 30/60/90).')
        else if (c.prazos.length > MAX_PARCELAS_PAG) e.push(`No máximo ${MAX_PARCELAS_PAG} prazos.`)
    }
    if (c.forma === '14' && c.modo === 'AVISTA') e.push('Duplicata mercantil é a prazo: escolha parcelas ou prazos.')
    if (!e.length && emissaoISO) {
        const passada = vencimentosCondicaoPag(c, emissaoISO).find(d => d < emissaoISO)
        if (passada) e.push(`Vencimento ${dataBrCondPag(passada)} antes da emissão.`)
    }
    return e
}

// Datas de vencimento para uma emissão (à vista / sem pagamento: nenhuma).
function vencimentosCondicaoPag(c, emissaoISO = hojeCondPag()) {
    if (!c || c.forma === '90' || c.modo === 'AVISTA') return []
    if (c.modo === 'DIAS') return [...c.prazos].sort((a, b) => a - b).map(p => somarDiasCondPag(emissaoISO, p))
    const n = Math.max(0, Math.min(Number(c.parcelas) || 0, MAX_PARCELAS_PAG))
    if (c.base === 'DIA') {
        const [a, m] = emissaoISO.split('-').map(Number)
        return Array.from({ length: n }, (_, i) => diaDoMesCondPag(a, m + i, c.dia))   // m (base 1) = mês seguinte
    }
    return Array.from({ length: n }, (_, i) => somarMesesCondPag(emissaoISO, i + 1))
}

// Texto curto: "3x mensais, todo dia 10", "30/60/90 dias", "À vista · Boleto".
function resumoCondicaoPag(c, { comForma = true } = {}) {
    if (!c) return ''
    const forma = comForma && c.forma ? (FORMAS_CONDICAO_PAG.find(f => f[0] === c.forma)?.[1] || '').replace(/\s*\(.*\)$/, '') : ''
    if (c.forma === '90') return 'Sem pagamento'
    let t = 'À vista'
    if (c.modo === 'MESES') t = `${c.parcelas}x mensais${c.base === 'DIA' ? `, todo dia ${c.dia}` : ''}`
    if (c.modo === 'DIAS') t = `${[...c.prazos].sort((a, b) => a - b).join('/')} dias`
    return [t, forma].filter(Boolean).join(' · ')
}

// Número de vezes (campo "pagamento" antigo do pedido, lido por telas e relatórios que só conhecem isso).
function vezesCondicaoPag(c) {
    if (!c || c.forma === '90' || c.modo === 'AVISTA') return 1
    if (c.modo === 'DIAS') return c.prazos.length || 1
    return c.parcelas || 1
}

// ---------------------------------------------------------------- formulário

function opcoesCondPag(lista, atual) {
    return lista.map(([v, t]) => `<option value="${escCondPag(v)}" ${String(atual ?? '') === v ? 'selected' : ''}>${escCondPag(t)}</option>`).join('')
}

// Bloco da condição. opcoes.forma = false esconde a forma; opcoes.aoMudar = nome de função global
// chamada a cada mudança (ex.: prévia da nota).
function htmlCondicaoPag(condicao, { forma = true, aoMudar = '' } = {}) {
    const c = normalizarCondicaoPag(condicao) || { modo: 'MESES', parcelas: 1, base: 'EMISSAO' }
    return `
        <div class="cond-pag" data-condicao-pag ${aoMudar ? `data-ao-mudar="${escCondPag(aoMudar)}"` : ''}>
            <div class="cond-pag-linha">
                ${forma ? `<label class="cond-pag-campo"><span>Forma</span>
                    <select name="cp_forma" onchange="atualizarCondicaoPag(this)"><option value="">Selecione</option>${opcoesCondPag(FORMAS_CONDICAO_PAG, c.forma ?? '')}</select></label>` : ''}
                <label class="cond-pag-campo" data-cp-mostrar="modo"><span>Condição</span>
                    <select name="cp_modo" onchange="atualizarCondicaoPag(this)">${opcoesCondPag(MODOS_CONDICAO_PAG, c.modo)}</select></label>
            </div>
            <div class="cond-pag-linha" data-cp-mostrar="MESES">
                <label class="cond-pag-campo cond-pag-curto"><span>Vezes</span>
                    <input type="number" name="cp_parcelas" min="1" max="${MAX_PARCELAS_PAG}" step="1" inputmode="numeric" value="${escCondPag(c.parcelas ?? 1)}" oninput="atualizarCondicaoPag(this)"></label>
                <label class="cond-pag-campo"><span>1º vencimento</span>
                    <select name="cp_base" onchange="atualizarCondicaoPag(this)">${opcoesCondPag(BASES_CONDICAO_PAG, c.base || 'EMISSAO')}</select></label>
                <label class="cond-pag-campo cond-pag-curto" data-cp-mostrar="DIA"><span>Dia</span>
                    <input type="number" name="cp_dia" min="1" max="31" step="1" inputmode="numeric" value="${escCondPag(c.dia ?? '')}" placeholder="10" oninput="atualizarCondicaoPag(this)"></label>
            </div>
            <div class="cond-pag-linha" data-cp-mostrar="DIAS">
                <label class="cond-pag-campo"><span>Prazos em dias <small>(separe com /)</small></span>
                    <input name="cp_prazos" placeholder="30/60/90" value="${escCondPag((c.prazos || []).join('/'))}" oninput="atualizarCondicaoPag(this)"></label>
            </div>
            <small class="cond-pag-previa" data-cp-previa></small>
        </div>`
}

function caixaCondicaoPag(el) {
    return el?.matches?.('[data-condicao-pag]') ? el : el?.closest?.('[data-condicao-pag]')
}

// Lê o bloco: { condicao, erros }. Sem forma no bloco (pedido sem forma): forma fica de fora.
function lerCondicaoPag(el) {
    const caixa = caixaCondicaoPag(el)
    if (!caixa) return { condicao: null, erros: [] }
    const v = n => caixa.querySelector(`[name="${n}"]`)?.value?.trim() ?? ''
    const temForma = !!caixa.querySelector('[name="cp_forma"]')
    const forma = v('cp_forma') || undefined
    const modo = forma === '90' ? 'AVISTA' : v('cp_modo') || 'AVISTA'
    let condicao = { ...(forma ? { forma } : {}), modo }
    if (modo === 'MESES') {
        const base = v('cp_base') || 'EMISSAO'
        condicao = { ...condicao, parcelas: Number(v('cp_parcelas')), base,
            ...(base === 'DIA' ? { dia: Number(v('cp_dia')) } : {}) }
    }
    if (modo === 'DIAS') condicao.prazos = v('cp_prazos').split(/[\/,;\s]+/).filter(Boolean).map(Number)
    const erros = errosCondicaoPag(condicao)
    if (temForma && !forma) erros.unshift('Escolha a forma de pagamento.')
    return { condicao, erros }
}

// Mostra só os campos do modo escolhido e a prévia das datas (se emitir hoje).
function atualizarCondicaoPag(el) {
    const caixa = caixaCondicaoPag(el)
    if (!caixa) return
    const forma = caixa.querySelector('[name="cp_forma"]')?.value
    const modo = caixa.querySelector('[name="cp_modo"]').value
    const base = caixa.querySelector('[name="cp_base"]').value
    const visivel = {
        modo: forma !== '90', MESES: forma !== '90' && modo === 'MESES', DIAS: forma !== '90' && modo === 'DIAS', DIA: base === 'DIA'
    }
    caixa.querySelectorAll('[data-cp-mostrar]').forEach(n => { n.hidden = !visivel[n.dataset.cpMostrar] })
    const alvo = caixa.querySelector('[data-cp-previa]')
    const { condicao, erros } = lerCondicaoPag(caixa)
    if (forma === '90') alvo.textContent = 'Sem cobrança: não gera conta a receber.'
    else if (erros.length) alvo.textContent = erros[0]
    else if (condicao.modo === 'AVISTA') alvo.textContent = 'À vista: uma conta a receber na data da emissão.'
    else {
        const datas = vencimentosCondicaoPag(condicao)
        alvo.textContent = `${datas.length}x. Se emitir hoje: ${datas.slice(0, 6).map(dataBrCondPag).join(', ')}${datas.length > 6 ? '…' : ''} (calculado no dia da emissão).`
    }
    alvo.classList.toggle('cond-pag-erro', forma !== '90' && erros.length > 0)
    const funcao = window[caixa.dataset.aoMudar]
    if (typeof funcao === 'function') funcao(caixa)
}

// Depois de pôr o bloco na tela: ajusta campos visíveis e a prévia.
function iniciarCondicoesPag(raiz = document) {
    raiz.querySelectorAll('[data-condicao-pag]').forEach(atualizarCondicaoPag)
}
