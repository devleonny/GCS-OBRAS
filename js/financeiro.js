// ---------------- Financeiro próprio do GCS (servidor: SCRIPTS/financeiro.js, migrations/financeiro.sql) ----------------
// Menu Financeiro (adm, diretoria, fin): Faturas a pagar, Faturas a receber, Contas correntes, Categorias, Dashboard.
// Faturas (vw_fin_titulos): uma linha por parcela; origem MANUAL, NF_ENTRADA (nota recebida com "Gerar faturas
// a pagar? Sim"), NF_SAIDA (nota emitida autorizada) e REEMBOLSO (reembolso aprovado). Situação calculada pelas
// baixas: ABERTO, PARCIAL, PAGO, ATRASADO, CANCELADO. Fatura com pagamento não se cancela (desfaz-se o pagamento).
// Componentes usados também pela nota recebida (js/fiscal.js): Sim/Não obrigatório, editor de parcelas, categorias.

const apiFin = (rota, corpo = {}) => apiModuloFiscal(`financeiro/${rota}`, corpo)
const escFin = valor => escaparAtributo(valor ?? '')
const r2Fin = v => Math.round((Number(v) + Number.EPSILON) * 100) / 100
const dataFin = v => v ? String(v).slice(0, 10).split('-').reverse().join('/') : ''
// Dia (AAAA-MM-DD, fuso local) de um timestamp como criado_em, que chega em UTC: lançada às 22h não vira o dia seguinte.
const diaInclusaoFin = v => {
    const t = v ? new Date(v) : null
    if (!t || isNaN(t)) return ''
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
const hojeFin = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const SITUACOES_FIN = {
    // Pela data (vw_fin_titulos): venceu e não está pago = atrasado; hoje = vence hoje; depois = a vencer.
    'A VENCER': { cor: '#2563eb', texto: 'A vencer' },
    'VENCE HOJE': { cor: '#d97706', texto: 'Vence hoje' },
    ATRASADO: { cor: '#b91c1c', texto: 'Atrasado' },
    PAGO: { cor: '#15803d', texto: 'Pago' },
    CANCELADO: { cor: '#64748b', texto: 'Excluída' }
}
const ORIGENS_FIN = { MANUAL: 'Manual', NF_ENTRADA: 'Nota recebida', CTE: 'CT-e', NF_SAIDA: 'Nota emitida', REEMBOLSO: 'Reembolso', RECORRENCIA: 'Repetição', OMIE: 'Omie', NF_OMIE: 'NF do Omie', DEVOLUCAO: 'Devolução', LOTE: 'Lote' }
// Importadas do Omie (21/11/2026): a origem não existe mais, então se editam e excluem como as lançadas aqui.
const ORIGENS_EDITAVEIS_FIN = ['MANUAL', 'RECORRENCIA', 'OMIE']
const FREQUENCIAS_FIN = [['MENSAL', 'Mensal'], ['SEMANAL', 'Semanal'], ['QUINZENAL', 'Quinzenal (14 dias)'], ['BIMESTRAL', 'Bimestral'],
    ['TRIMESTRAL', 'Trimestral'], ['SEMESTRAL', 'Semestral'], ['ANUAL', 'Anual']]
const nomeFrequenciaFin = f => (FREQUENCIAS_FIN.find(([v]) => v === f) || [])[1] || f || ''
const FORMAS_FIN = [['15', 'Boleto'], ['17', 'PIX'], ['18', 'Transferência'], ['16', 'Depósito'], ['03', 'Cartão de crédito'],
    ['04', 'Cartão de débito'], ['01', 'Dinheiro'], ['14', 'Duplicata mercantil'], ['OMIE', 'Pago no Omie']]
const nomeFormaFin = f => (FORMAS_FIN.find(([v]) => v === f) || [])[1] || f || ''
const TIPOS_CONTA_FIN = { BANCO: 'Banco', CAIXA: 'Caixa', CARTAO: 'Cartão', APLICACAO: 'Aplicação' }

// Opções (categorias, contas, departamentos, empresas): cache da sessão.
let opcoesFinCache = null
async function carregarOpcoesFin(recarregar = false) {
    if (!opcoesFinCache || recarregar) opcoesFinCache = await apiFin('opcoes')
    return opcoesFinCache
}

// <select> de categorias agrupado por grupo; excluídas (só fin/diretoria/adm veem) marcadas.
function opcoesCategoriasFin(categorias, tipo, atual) {
    const aceita = c => !c.grupo && (tipo === 'PAGAR' ? c.tipo !== 'RECEITA' : c.tipo !== 'DESPESA')
    const grupos = new Map()
    for (const c of categorias.filter(aceita)) {
        const g = c.grupo_nome ? `${c.grupo_codigo || ''} ${c.grupo_nome}`.trim() : 'Sem grupo'
        if (!grupos.has(g)) grupos.set(g, [])
        grupos.get(g).push(c)
    }
    return `<option value="">Selecione</option>` + [...grupos].map(([g, lista]) => `
        <optgroup label="${escFin(g)}">${lista.map(c => `
            <option value="${c.id}" ${String(c.id) === String(atual ?? '') ? 'selected' : ''}>${escFin(c.codigo)} · ${escFin(c.nome)}${c.excluida ? ' (excluída)' : ''}</option>`).join('')}
        </optgroup>`).join('')
}

// Conta de empresa paga/recebe fatura de qualquer empresa e de sócio (uma conta por conta real, 26/11/2026: a
// fatura diz de quem é a despesa, a conta de quem era o dinheiro). Cartão de sócio aceita empresa e o próprio
// sócio. Mesma regra do servidor (fin_conta_aceita, migrations/financeiro-contas-unificadas.sql).
const tipoAppFin = app => (opcoesFinCache?.empresas || []).find(e => e.app === app)?.tipo || 'EMPRESA'
const contaAceitaFin = (k, app) => !app || k.app === app || tipoAppFin(k.app) === 'EMPRESA' || tipoAppFin(k.app) !== tipoAppFin(app)
const contaPadraoAppFin = (contas, app) => {
    const pagaPor = (opcoesFinCache?.empresas || []).find(e => e.app === app && e.tipo === 'SOCIO')?.paga_por
    return contas.find(k => k.app === (pagaPor || app) && k.padrao)
}
// <option>s do seletor de empresa: empresas e, separados, os sócios.
const opcoesEmpresasFin = (empresas, atual) => {
    const op = e => `<option value="${escFin(e.app)}" ${e.app === atual ? 'selected' : ''}>${escFin(e.app)}</option>`
    const socios = empresas.filter(e => e.tipo === 'SOCIO')
    return empresas.filter(e => e.tipo !== 'SOCIO').map(op).join('')
        + (socios.length ? `<optgroup label="Sócios">${socios.map(op).join('')}</optgroup>` : '')
}

const opcoesContasFin = (contas, app, atual) => `<option value="">${app ? 'Conta padrão da empresa' : 'Selecione'}</option>` + contas
    .filter(k => contaAceitaFin(k, app))
    .sort((x, y) => (y.app === app) - (x.app === app))
    .map(k => `<option value="${k.id}" ${String(k.id) === String(atual ?? '') ? 'selected' : ''}>${escFin(k.app)} · ${escFin(k.nome)}${k.padrao ? ' (padrão)' : ''}</option>`).join('')

// Forma "Cartão de crédito" (03, 27/11/2026): a Conta vira a lista dos cartões ativos (de qualquer empresa ou sócio,
// os da empresa da nota primeiro) e é obrigatória; o servidor põe a fatura na empresa do cartão e já dá a baixa
// nele, como no reembolso. Outra forma: volta a lista normal de contas.
const opcoesCartoesFin = (contas, app, atual) => '<option value="">Qual cartão foi usado?</option>' + contas
    .filter(k => k.tipo === 'CARTAO')
    .sort((x, y) => (y.app === app) - (x.app === app) || String(x.nome).localeCompare(String(y.nome)))
    .map(k => `<option value="${k.id}" ${String(k.id) === String(atual ?? '') ? 'selected' : ''}>${escFin(k.nome)} · ${escFin(k.app)}</option>`).join('')
const opcoesContaPelaFormaFin = (contas, app, forma, atual) =>
    forma === '03' ? opcoesCartoesFin(contas, app, atual) : opcoesContasFin(contas, app, atual)
function formaContaFin(select, app) {
    const campo = select.closest('.fis-grade')?.querySelector('[name="conta_id"]')
    if (!campo) return
    campo.innerHTML = opcoesContaPelaFormaFin(opcoesFinCache?.contas || [], app, select.value)
    const rotulo = campo.closest('label')?.querySelector('span')
    if (rotulo) rotulo.textContent = select.value === '03' ? 'Cartão *' : 'Conta'
}

// ---------------------------------------------------------------- componentes

// Sim/Não sem valor padrão (dropdown que começa em "Escolha…"): o usuário tem que responder.
function simNaoFin(nome, rotulo, onchange = '') {
    return `
        <div class="fin-pergunta" data-pergunta="${escFin(nome)}">
            <span class="fin-pergunta-rotulo">${rotulo} <b class="fin-obrigatorio">*</b></span>
            <select class="fis-input fin-sim-nao" name="${escFin(nome)}" data-valor="" aria-label="${escFin(rotulo)}"
                onchange="this.dataset.valor = this.value; ${onchange}">
                <option value="">Escolha…</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
            </select>
        </div>`
}
const lerSimNaoFin = (raiz, nome) => {
    const v = raiz.querySelector(`[name="${nome}"]`)?.value
    return v === 'sim' ? true : v === 'nao' ? false : null
}

// Editor de parcelas: [{ vencimento, valor }]. total: valor que as parcelas têm que somar.
function editorParcelasFin(parcelas = [], total = null) {
    const lista = parcelas.length ? parcelas : [{ vencimento: '', valor: total ?? '' }]
    return `
        <div class="fin-parcelas" data-parcelas data-total="${total ?? ''}">
            <div class="fin-parcelas-topo">
                <b>Parcelas</b>
                <label class="fin-dividir">Dividir em <input type="number" min="1" max="120" step="1" class="fis-input" data-dividir value="${lista.length}">
                    vezes mensais a partir de <input type="date" class="fis-input" data-primeiro value="${escFin(lista[0]?.vencimento || '')}"></label>
                <button type="button" class="fis-mini" onclick="dividirParcelasFin(this)">Gerar</button>
            </div>
            <table class="fis-tabela fin-parcelas-tabela">
                <thead><tr><th>#</th><th>Vencimento</th><th class="fis-num">Valor</th><th></th></tr></thead>
                <tbody>${lista.map((p, i) => linhaParcelaFin(p, i)).join('')}</tbody>
            </table>
            <div class="fin-parcelas-rodape">
                <button type="button" class="fis-mini" onclick="adicionarParcelaFin(this)">+ Parcela</button>
                <span data-soma-parcelas></span>
            </div>
        </div>`
}

function linhaParcelaFin(p, i) {
    return `
        <tr>
            <td class="fis-num">${i + 1}</td>
            <td><input type="date" class="fis-input" name="vencimento" value="${escFin(p.vencimento || '')}" oninput="somarParcelasFin(this)"></td>
            <td><input type="number" class="fis-input fis-num" name="valor" min="0.01" step="0.01" value="${p.valor === '' || p.valor == null ? '' : r2Fin(p.valor)}" oninput="somarParcelasFin(this)"></td>
            <td><button type="button" class="fis-remover-linha" title="Tirar parcela" aria-label="Tirar parcela" onclick="removerParcelaFin(this)">${iconeLixeiraFis}</button></td>
        </tr>`
}

function somaMesesFin(iso, meses) {
    const [a, m, d] = iso.split('-').map(Number)
    const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
    const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
    alvo.setUTCDate(Math.min(d, ultimo))
    return alvo.toISOString().slice(0, 10)
}

function dividirParcelasFin(botao) {
    const caixa = botao.closest('[data-parcelas]')
    const n = Math.max(1, Math.min(120, Math.floor(Number(caixa.querySelector('[data-dividir]').value) || 1)))
    const primeiro = caixa.querySelector('[data-primeiro]').value
    if (!primeiro) return popup({ mensagem: 'Informe o vencimento da 1ª parcela.' })
    const total = Number(caixa.dataset.total) || r2Fin(lerParcelasFin(caixa).reduce((a, p) => a + p.valor, 0))
    const centavos = Math.round(total * 100), base = Math.floor(centavos / n)
    caixa.querySelector('tbody').innerHTML = Array.from({ length: n }, (_, i) =>
        linhaParcelaFin({ vencimento: somaMesesFin(primeiro, i), valor: (i === 0 ? centavos - base * (n - 1) : base) / 100 }, i)).join('')
    somarParcelasFin(caixa)
}

function adicionarParcelaFin(botao) {
    const corpo = botao.closest('[data-parcelas]').querySelector('tbody')
    const ultima = corpo.querySelector('tr:last-child [name="vencimento"]')?.value
    corpo.insertAdjacentHTML('beforeend', linhaParcelaFin({ vencimento: ultima ? somaMesesFin(ultima, 1) : '', valor: '' }, corpo.children.length))
    somarParcelasFin(corpo)
}

function removerParcelaFin(botao) {
    const corpo = botao.closest('tbody')
    if (corpo.children.length === 1) return
    botao.closest('tr').remove()
    ;[...corpo.children].forEach((tr, i) => { tr.firstElementChild.textContent = i + 1 })
    somarParcelasFin(corpo)
}

function lerParcelasFin(raiz) {
    const caixa = raiz.matches?.('[data-parcelas]') ? raiz : raiz.querySelector('[data-parcelas]')
    return [...caixa.querySelectorAll('tbody tr')].map(tr => ({
        vencimento: tr.querySelector('[name="vencimento"]').value,
        valor: r2Fin(tr.querySelector('[name="valor"]').value || 0)
    }))
}

function somarParcelasFin(el) {
    const caixa = el.closest?.('[data-parcelas]') || el
    const soma = r2Fin(lerParcelasFin(caixa).reduce((a, p) => a + p.valor, 0))
    const total = caixa.dataset.total === '' ? null : Number(caixa.dataset.total)
    const alvo = caixa.querySelector('[data-soma-parcelas]')
    const confere = total == null || Math.abs(total - soma) <= 0.01
    alvo.className = confere ? 'fis-positivo' : 'fis-negativo'
    alvo.innerHTML = `Soma ${dinheiro(soma)}${total == null ? '' : confere ? ' ✓' : ` · falta ${dinheiro(r2Fin(total - soma))}`}`
    // Rateio em R$ ao lado (entrada de nota): a base é a soma das parcelas.
    const rateio = caixa.parentElement?.querySelector('[data-rateio][data-com-valor]')
    if (rateio) somarRateioFin(rateio)
}

// Rateio por departamento (contratos ORC + setores). Lista FECHADA: o texto digitado só busca; o departamento
// só entra clicando num item da lista (data-valor). Linhas: departamento + %.
// Com { total } (entrada de nota, 18/11/2026, a pedido): cada linha também tem R$. Preencheu o valor, o % é
// recalculado; preencheu o %, o valor é recalculado (data-modo = o que foi mexido por último). A base é a
// soma das parcelas da mesma caixa (ou o total informado, sem parcelas); se ela mudar, a linha em R$ mantém
// o valor e a linha em % mantém o percentual. O servidor recebe só o % (6 casas, soma 100 exata).
const normalFin = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const rotuloDepFin = d => d ? `${d.id}${d.cliente ? ` · ${d.cliente}` : d.tipo === 'SETOR' ? ' · setor' : ''}${d.cidade ? ` (${d.cidade})` : ''}` : ''
const r6Fin = v => Math.round(Number(v) * 1e6) / 1e6
const pctCampoFin = v => String(Number(Number(v).toFixed(4)))
// Departamento que a fatura já tinha mas não está na lista (veio do Omie: "LOGISTICA", "ARQUIVO MORTO"...):
// fica na linha com o próprio código (27/11/2026). Antes a linha abria em branco e o rateio quebrava ao salvar.
const rotuloDepIdFin = id => {
    const dep = (opcoesFinCache?.departamentos || []).find(d => d.id === id)
    return dep ? rotuloDepFin(dep) : id ? `${id} · fora da lista` : ''
}

// { valorDoFormulario: true } (fatura, 21/11/2026, a pedido): R$ e % na mesma linha, a base é o Valor do topo.
function editorRateioFin(departamentos, rateio = [], { total = null, valorDoFormulario = false } = {}) {
    const comValor = total != null || valorDoFormulario
    const lista = rateio.length ? rateio : [{ departamento: '', percentual: 100 }]
    return `
        <div class="fin-rateio" data-rateio ${comValor ? `data-com-valor data-total="${escFin(r2Fin(total || 0))}"` : ''} ${valorDoFormulario ? 'data-total-formulario' : ''}>
            <div class="fin-parcelas-topo"><b>Departamento</b> <small>contrato (ORC) ou setor da lista; vários = rateio em %${comValor ? ' ou em R$' : ''}</small></div>
            <div data-linhas-rateio>${lista.map(r => linhaRateioFin(r, comValor)).join('')}</div>
            <div class="fin-parcelas-rodape">
                <button type="button" class="fis-mini" onclick="adicionarRateioFin(this)">+ Departamento</button>
                ${comValor ? '<small data-soma-rateio></small>' : ''}
            </div>
        </div>`
}

function linhaRateioFin(r, comValor = false) {
    const id = String(r.departamento || '')
    const recalcular = comValor ? ` oninput="editarRateioFin(this, 'pct')"` : ''
    return `
        <div class="fin-rateio-linha" data-modo="pct">
            <div class="fin-escolha" data-valor="${escFin(id)}">
                <input class="fis-input" name="departamento_busca" value="${escFin(rotuloDepIdFin(id))}" placeholder="Buscar contrato, cliente ou setor…" autocomplete="off"
                    onfocus="this.select(); buscarDepFin(this)" oninput="buscarDepFin(this)" onblur="setTimeout(() => fecharBuscaDepFin(this), 150)">
                <div class="fin-escolha-lista" hidden></div>
            </div>
            <input class="fis-input fis-num" type="number" min="0" max="100" step="any" name="percentual" value="${r.percentual ?? ''}"${recalcular}> %
            ${comValor ? `<input class="fis-input fis-num" type="number" min="0" step="0.01" name="valor_rateio" placeholder="R$" oninput="editarRateioFin(this, 'valor')">` : ''}
            <button type="button" class="fis-remover-linha" title="Tirar departamento" aria-label="Tirar departamento" onclick="removerRateioFin(this)">${iconeLixeiraFis}</button>
        </div>`
}

// Base do rateio em R$: soma das parcelas da mesma caixa; sem parcelas, o total informado.
function totalRateioFin(bloco) {
    if (bloco.hasAttribute('data-total-formulario'))
        return Number(bloco.closest('[data-form-fatura]')?.querySelector('[name="valor"]')?.value) || 0
    const parcelas = bloco.parentElement?.querySelector('[data-parcelas]')
    const soma = parcelas ? r2Fin(lerParcelasFin(parcelas).reduce((a, p) => a + p.valor, 0)) : 0
    return soma > 0 ? soma : Number(bloco.dataset.total) || 0
}

function editarRateioFin(input, modo) {
    input.closest('.fin-rateio-linha').dataset.modo = modo
    somarRateioFin(input)
}

function adicionarRateioFin(botao) {
    const bloco = botao.closest('[data-rateio]')
    const comValor = bloco.hasAttribute('data-com-valor')
    // A linha nova já vem com o que falta para 100%.
    const soma = lerRateioFin(bloco, true).reduce((s, l) => s + l.percentual, 0)
    bloco.querySelector('[data-linhas-rateio]').insertAdjacentHTML('beforeend', linhaRateioFin({ departamento: '', percentual: soma < 100 ? pctCampoFin(100 - soma) : '' }, comValor))
    if (comValor) somarRateioFin(bloco)
    bloco.querySelector('[data-linhas-rateio]').lastElementChild.querySelector('[name="departamento_busca"]').focus()
}

function removerRateioFin(botao) {
    const bloco = botao.closest('[data-rateio]')
    botao.closest('.fin-rateio-linha').remove()
    if (bloco.hasAttribute('data-com-valor')) somarRateioFin(bloco)
}

// Recalcula o campo que não manda em cada linha (nunca o que está sendo digitado) e mostra a soma.
function somarRateioFin(el) {
    const bloco = el?.closest?.('[data-rateio]') || el
    if (!bloco?.hasAttribute?.('data-com-valor')) return
    const total = totalRateioFin(bloco)
    const ativo = document.activeElement
    const linhas = [...bloco.querySelectorAll('.fin-rateio-linha')]
    for (const l of linhas) {
        const pct = l.querySelector('[name="percentual"]')
        const val = l.querySelector('[name="valor_rateio"]')
        if (!pct || !val) continue
        if (l.dataset.modo === 'valor') {
            if (pct !== ativo) pct.value = val.value === '' ? '' : total ? pctCampoFin((Number(val.value) || 0) * 100 / total) : ''
        } else if (val !== ativo) {
            val.value = pct.value === '' ? '' : r2Fin(total * (Number(pct.value) || 0) / 100).toFixed(2)
        }
    }
    const alvo = bloco.querySelector('[data-soma-rateio]')
    if (!alvo) return
    const soma = lerRateioFin(bloco, true).reduce((s, l) => s + l.percentual, 0)
    const ok = Math.abs(soma - 100) < 0.001
    const somaValor = r2Fin(total * soma / 100)
    alvo.className = ok ? 'fis-positivo' : 'fis-negativo'
    alvo.textContent = ok
        ? `Soma 100% ✓ · ${dinheiroTexto(total)}`
        : `Soma ${Number(soma.toFixed(4)).toLocaleString('pt-BR')}% (${dinheiroTexto(somaValor)} de ${dinheiroTexto(total)}) · ${soma < 100 ? 'faltam' : 'sobram'} ${dinheiroTexto(Math.abs(r2Fin(total - somaValor)))}`
}

function buscarDepFin(input) {
    const caixa = input.closest('.fin-escolha')
    const lista = caixa.querySelector('.fin-escolha-lista')
    const termo = normalFin(input.value)
    const todos = opcoesFinCache?.departamentos || []
    // O que já está escolhido não filtra (ao focar, mostra tudo de novo).
    const filtro = termo && termo !== normalFin(rotuloDepIdFin(caixa.dataset.valor)) ? termo : ''
    const achados = todos.filter(d => !filtro || normalFin(`${d.id} ${d.cliente || ''} ${d.cidade || ''}`).includes(filtro)).slice(0, 40)
    lista.innerHTML = achados.map(d => `
        <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); escolherDepFin(this, '${escFin(d.id)}')">
            <b>${escFin(d.id)}</b> <span>${escFin(d.cliente || (d.tipo === 'SETOR' ? 'Setor' : ''))}${d.cidade ? ` · ${escFin(d.cidade)}` : ''}</span>
        </button>`).join('') || '<div class="fin-escolha-vazio">Nada encontrado: só contratos e setores da lista.</div>'
    lista.hidden = false
}

function escolherDepFin(botao, id) {
    const caixa = botao.closest('.fin-escolha')
    const dep = (opcoesFinCache?.departamentos || []).find(d => d.id === id)
    caixa.dataset.valor = id
    caixa.querySelector('input').value = rotuloDepFin(dep)
    caixa.querySelector('.fin-escolha-lista').hidden = true
    caixa.classList.remove('invalido')
}

// Saiu do campo sem escolher: volta para o que estava escolhido (texto solto não fica).
function fecharBuscaDepFin(input) {
    const caixa = input.closest('.fin-escolha')
    if (!caixa) return
    caixa.querySelector('.fin-escolha-lista').hidden = true
    input.value = rotuloDepIdFin(caixa.dataset.valor)
}

// todas = true: inclui as linhas sem departamento e não arredonda (para somar). Com R$, a linha guiada pelo
// valor manda o % calculado sobre a base; o resíduo do arredondamento vai para o maior (soma 100 exata).
function lerRateioFin(raiz, todas = false) {
    const bloco = raiz.matches?.('[data-rateio]') ? raiz : raiz.querySelector('[data-rateio]') || raiz
    const comValor = bloco.hasAttribute?.('data-com-valor')
    const total = comValor ? totalRateioFin(bloco) : 0
    // Só as linhas de departamento: as da aba Categorias usam a mesma classe e ficam no mesmo formulário.
    const linhas = [...bloco.querySelectorAll('.fin-rateio-linha:not(.fin-categoria-linha)')].map(l => {
        const valor = Number(l.querySelector('[name="valor_rateio"]')?.value) || 0
        const percentual = comValor && l.dataset.modo === 'valor' && total
            ? valor * 100 / total
            : Number(l.querySelector('[name="percentual"]').value) || 0
        return { departamento: l.querySelector('.fin-escolha').dataset.valor, percentual }
    })
    if (todas) return linhas
    const r = linhas.filter(l => l.departamento)
    if (!comValor) return r
    r.forEach(l => l.percentual = r6Fin(l.percentual))
    const soma = r.reduce((s, l) => s + l.percentual, 0)
    if (r.length && Math.abs(100 - soma) < 0.001) {
        const maior = r.reduce((a, l) => l.percentual > a.percentual ? l : a)
        maior.percentual = r6Fin(maior.percentual + 100 - soma)
    }
    return r
}

// ---------------------------------------------------------------- faturas
// Janela no padrão "Contas a Pagar": barra (Incluir, Repetições), tabela com filtros por coluna, total do
// filtro embaixo da coluna Valor, paginação no rodapé e painel de ações à direita (recolhe pela seta).
// Clique numa linha = escolhe a fatura no painel; duplo clique = abre a fatura; caixinhas = ações em lote.

function telaFaturasPagar() { return telaFaturasFin('PAGAR') }
function telaFaturasReceber() { return telaFaturasFin('RECEBER') }

const ICONES_FIN = {
    pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    incluir: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    excel: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 12l6 6M15 12l-6 6"/>',
    repetir: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    ver: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    editar: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    baixa: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
    parcial: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    vencimento: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    cancelar: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    excluir: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    encerrar: '<circle cx="12" cy="12" r="9"/><rect x="9" y="9" width="6" height="6"/>',
    fechar: '<path d="M6 6l12 12M18 6L6 18"/>',
    baixar: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    raio: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    empresa: '<path d="M4 21V5l8-3v19M12 9h8v12M3 21h18"/><path d="M7 8h2M7 12h2M7 16h2M15 13h2M15 17h2"/>',
    danfe: '<path d="M4 4l17 8-17 8 3-8z"/><path d="M7 12h6"/>',
    seta: '<path d="M10 7l5 5-5 5"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    mapa: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    filtro: '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5z"/>',
    salvar: '<path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9a4 4 0 0 1 0 9"/><path d="M12 12v8M9 15l3-3 3 3"/>',
    anexo: '<path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>',
    voltar: '<path d="M10 7l-5 5 5 5"/><path d="M5 12h14"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    okCheio: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.4"/>',
    ajuda: '<circle cx="12" cy="12" r="9.5"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.2-2.5 3.8"/><circle cx="12" cy="17" r=".9" fill="currentColor"/>',
    alerta: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M12 7v6" stroke="#fff"/><circle cx="12" cy="16.6" r="1.3" fill="#fff" stroke="none"/>'
}
const iconeFin = nome => `<svg class="fin-icone" viewBox="0 0 24 24" aria-hidden="true">${ICONES_FIN[nome] || ''}</svg>`

// Cor do ícone na tabela (padrão Omie: a vencer = círculo verde com ✓); as demais usam a cor da situação.
const COR_ICONE_SITUACAO_FIN = { 'A VENCER': '#2e9e4f' }
const ICONE_SITUACAO_FIN = { ATRASADO: 'alerta', PAGO: 'check', 'A VENCER': 'okCheio', 'VENCE HOJE': 'relogio', CANCELADO: 'cancelar' }
// Faturas a receber falam em recebimento: "Recebido", "recebimento", "recebidas"... (a pagar: "Pago", "pagamento").
function termoFin(chave, tipo = tipoFaturasFin) {
    const receber = tipo === 'RECEBER'
    return {
        pago: receber ? 'recebido' : 'pago', Pago: receber ? 'Recebido' : 'Pago',
        pagas: receber ? 'recebidas' : 'pagas',
        pagamento: receber ? 'recebimento' : 'pagamento', Pagamento: receber ? 'Recebimento' : 'Pagamento',
        favorecido: receber ? 'cliente' : 'favorecido'
    }[chave]
}

function situacaoFin(situacao, tipo = tipoFaturasFin) {
    const s = SITUACOES_FIN[situacao] || {}
    const texto = situacao === 'PAGO' ? termoFin('Pago', tipo) : s.texto
    return `<span class="fin-sit" style="--cor: ${COR_ICONE_SITUACAO_FIN[situacao] || s.cor || '#64748b'}">${iconeFin(ICONE_SITUACAO_FIN[situacao] || 'relogio')}${escFin(texto || situacao || '')}</span>`
}

const POR_PAGINA_FIN = 50
let tipoFaturasFin = 'PAGAR'
let painelFinAberto = true
let faturaAtivaFin = null
let filtroExtraFin = null
const dadosFaturasFin = new Map()

// manterFiltros: volta do formulário com os filtros, a página e a fatura escolhida de antes.
// Menu lateral principal recolhido ao abrir as faturas: a tabela e o painel de ações precisam da largura.
// (mostrarMenus em ferramentas.js alterna .active no menu e na .tela; aberto = .active.)
function recolherMenuPrincipalFin() {
    document.querySelector(".side-menu")?.classList.remove("active")
    document.querySelector(".tela")?.classList.remove("active")
}

async function telaFaturasFin(tipo, filtroExtra = null, manterFiltros = false) {
    // Só ao abrir pelo menu: voltando do formulário, respeita o que a pessoa fez com o menu.
    if (!manterFiltros) recolherMenuPrincipalFin()
    tipoFaturasFin = tipo
    filtroExtraFin = filtroExtra
    if (!manterFiltros) {
        painelFinAberto = false
        faturaAtivaFin = null
        selecaoFin.clear()
        valoresSelecaoFin.clear()
    }
    dadosFaturasFin.clear()
    assinaturaTotaisFin = null
    somasFiltroFin = null
    const pagar = tipo === 'PAGAR'
    tela.innerHTML = `
        <div class="fis-pagina fin-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Faturas a ${pagar ? 'pagar' : 'receber'}</h2>
                    <div class="fin-barra">
                    <button type="button" onclick="formularioFaturaFin('${tipo}')">${iconeFin('incluir')} Incluir</button>
                    <button type="button" onclick="baixarExcelFaturasFin()" title="Com faturas marcadas, baixa só as marcadas; sem marcação, todos os resultados dos filtros aplicados">${iconeFin('excel')} Excel</button>
                    ${pagar ? botaoComprovantesFin() : ''}
                    ${filtroExtra ? `<button type="button" onclick="telaFaturasFin('${tipo}')">${iconeFin('fechar')} Limpar filtro</button>` : ''}
                    </div>
                </header>
                <div class="fin-corpo${painelFinAberto ? '' : ' recolhido'}" data-corpo-fin>
                    <div class="fin-tabela-area" data-tabela-fin></div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelFin()" aria-expanded="${painelFinAberto}"
                            title="${painelFinAberto ? 'Recolher' : 'Mostrar'} as ações">${iconeFin('seta')}</button>
                        <aside class="fin-painel" data-painel-fin></aside>
                    </div>
                </div>
            </section>
        </div>`
    desenharPainelFin()
    try {
        const anterior = manterFiltros ? controles.faturasFin : null
        delete controles.faturasFin
        if (anterior) controles.faturasFin = { filtros: anterior.filtros, filtrosMeta: anterior.filtrosMeta, pagina: anterior.pagina || 1 }
        const area = document.querySelector('[data-tabela-fin]')
        // Cores das tags antes das linhas (chipsTagsPag usa o catálogo já carregado).
        await catalogoTagsPag()
        area.innerHTML = await modTab({
            base: 'vw_fin_titulos',
            pag: 'faturasFin',
            body: 'bodyFaturasFin',
            criarLinha: 'criarLinhaFaturaFin',
            caber: true,
            limite: POR_PAGINA_FIN,
            funcaoAdicional: ['aposCarregarFaturasFin'],
            filtrosFixos: { tipo: { op: '=', value: tipo }, ativa: { op: '=', value: 'S' }, ...(filtroExtra || {}) },
            ordenar: [{ path: 'vencimento', direcao: 'asc' }],
            colunas: {
                '': {},
                'Situação': { chave: 'situacao', tipoPesquisa: 'select', rotulos: pagar ? {} : { PAGO: 'RECEBIDO' } },
                'Vencimento': { chave: 'dia_vencimento', tipoPesquisa: 'data' },
                [pagar ? 'Pago em' : 'Recebido em']: { chave: 'dia_pagamento', tipoPesquisa: 'data' },
                'Inclusão': { chave: 'criado_em', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                'Nota fiscal': { chave: 'nota_fiscal' },
                'Parcela': { chave: 'parcela_texto' },
                [pagar ? 'Fornecedor' : 'Cliente']: { chave: 'participante_nome' },
                'Tags': { chave: 'tags_texto' },
                'CPF/CNPJ': { chave: 'participante_documento' },
                'Valor da conta': { chave: 'valor', tipoOrdenacao: 'numero' },
                'Valor líquido': { chave: 'valor_liquido', tipoOrdenacao: 'numero' },
                'Impostos retidos': { chave: 'impostos_retidos', tipoOrdenacao: 'numero' },
                'Desconto': { chave: 'desconto', tipoOrdenacao: 'numero' },
                'Juros e multas': { chave: 'juros_multa', tipoOrdenacao: 'numero' },
                'Valor pago': { chave: 'valor_pago', tipoOrdenacao: 'numero' },
                // Só a pagar: o comprovante do banco no pagamento (js/financeiro_comprovantes.js).
                ...(pagar ? { 'Comprovante': { chave: 'comprovante', tipoPesquisa: 'select', rotulos: { SIM: '✓', 'NÃO': '✗' } } } : {}),
                'Observação': { chave: 'observacao' },
                'Departamento': { chave: 'departamentos' },
                'Categorias': { chave: 'categorias_texto' },
                'Origem': { chave: 'origem', tipoPesquisa: 'select' },
                'Criado por': { chave: 'criado_por' }
            }
        })
        // Paginação própria no rodapé (a do modTab fica escondida no topo, só para os contadores).
        area.querySelector('.modtab')?.insertAdjacentHTML('beforeend', '<div class="fin-rodape" data-rodape-fin></div>')
        // Faixa de "selecionar todos do filtro": colada no topo do bloco da tabela, dentro dele.
        area.querySelector('.modtab')?.insertAdjacentHTML('afterbegin', '<div class="fin-aviso-selecao" data-aviso-selecao-fin hidden></div>')
        await paginacao('faturasFin')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as faturas: ${escFin(err.message)}` })
    }
}

// Gancho da tabela (modTab funcaoAdicional), depois de cada carga.
async function aposCarregarFaturasFin() {
    prepararTotaisFin()
    prepararSelecaoFin()
    // Funil nos filtros, recolher e arrastar colunas (js/tabelas-cabecalho.js); a pagar e a receber dividem o layout.
    await cabecalhoAvancadoTabela('faturasFin', { prefKey: 'faturas_fin' })
    marcarLinhaAtivaFin()
    desenharRodapeFin()
    return totaisFaturasFin(false)
}

function alternarPainelFin(abrir = null) {
    const corpo = document.querySelector('[data-corpo-fin]')
    if (!corpo) return
    const aberto = abrir ?? corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !aberto)
    const botao = corpo.querySelector('.fin-recolher')
    botao?.setAttribute('aria-expanded', String(aberto))
    if (botao) botao.title = `${aberto ? 'Recolher' : 'Mostrar'} as ações`
    if (!corpo.querySelector('[data-form-fatura]')) painelFinAberto = aberto
}

// Celular: o painel de ações das telas financeiras é uma gaveta que sobe de baixo (css/financeiro.css).
// Tocar fora dela, dentro da tela, fecha pela própria seta (cada tela tem a sua função de alternar);
// o toque não chega ao que está embaixo do escurecido. Pop-ups e a barra do topo ficam de fora.
document.addEventListener('click', evento => {
    if (!matchMedia('(max-width: 800px)').matches) return
    if (!evento.target.closest('.tela')) return
    const lateral = [...document.querySelectorAll('.fin-lateral')].find(l =>
        l.querySelector(':scope > .fin-recolher') &&
        !l.parentElement.classList.contains('recolhido') &&
        !l.parentElement.querySelector('[data-form-fatura]'))
    if (!lateral || lateral.contains(evento.target)) return
    evento.preventDefault()
    evento.stopPropagation()
    lateral.querySelector(':scope > .fin-recolher').click()
}, true)

// ---------------------------------------------------------------- totais embaixo das colunas de valor
// Com faturas marcadas, somam só as marcadas (de qualquer página). Sem nenhuma marcada, somam TODO o filtro
// da tabela (todas as páginas), não só a página aberta; a soma do filtro só recalcula quando o filtro muda.
const COLUNAS_TOTAL_FIN = ['valor', 'valor_liquido', 'impostos_retidos', 'desconto', 'juros_multa', 'valor_pago']
// Só as colunas somadas de uma fatura (guardadas para a soma das marcadas de outras páginas).
const valoresTotaisFin = d => Object.fromEntries(COLUNAS_TOTAL_FIN.map(k => [k, d[k]]))
let assinaturaTotaisFin = null
let somasFiltroFin = null
// Valores das faturas marcadas (id -> { valor }): a seleção atravessa páginas e o dadosFaturasFin só tem a aberta.
const valoresSelecaoFin = new Map()

function escreverTotaisFin() {
    const marcadas = selecaoFin.size
    COLUNAS_TOTAL_FIN.forEach((path, i) => {
        const td = document.querySelector(`[data-total-fin="${path}"]`)
        if (!td) return
        if (marcadas) {
            let soma = 0, faltam = 0
            selecaoFin.forEach(id => {
                const v = (dadosFaturasFin.get(id) || valoresSelecaoFin.get(id))?.[path]
                v == null ? faltam++ : soma += Number(v) || 0
            })
            td.title = `Soma das ${marcadas} fatura(s) marcada(s)${faltam ? ` (${faltam} sem valor carregado)` : ''}. Desmarque todas para ver o total do filtro.`
            td.innerHTML = `${i === 0 ? `<small class="fin-total-rotulo">${marcadas} marcada${marcadas === 1 ? '' : 's'}</small> ` : ''}<span class="fin-sigma">Σ</span> ${dinheiro(r2Fin(soma))}`
            td.classList.add('fin-total-selecao')
        } else {
            td.title = 'Total de todas as faturas do filtro'
            td.innerHTML = `<span class="fin-sigma">Σ</span> ${somasFiltroFin?.[i] == null ? '—' : dinheiro(somasFiltroFin[i])}`
            td.classList.remove('fin-total-selecao')
        }
    })
}

function prepararTotaisFin() {
    const tabela = document.getElementById('bodyFaturasFin')?.closest('table')
    if (!tabela || tabela.tFoot) return
    const chaves = Object.values(controles.faturasFin?.colunas || {}).map(c => c.chave || '')
    const linha = tabela.createTFoot().insertRow()
    linha.className = 'fin-totais'
    chaves.forEach(chave => {
        const td = linha.insertCell()
        if (COLUNAS_TOTAL_FIN.includes(chave)) {
            td.dataset.totalFin = chave
            td.className = 'fis-num'
        }
    })    // Linha vazia (altura em %) que fica com a sobra da altura: com poucas faturas os totais e a
    // paginação continuam no pé da janela, como no Omie. Fica num tbody próprio (o modTab só mexe no dele).
    const enchimento = document.createElement('tbody')
    enchimento.className = 'fin-enchimento'
    enchimento.innerHTML = `<tr><td colspan="${chaves.length}"></td></tr>`
    tabela.insertBefore(enchimento, tabela.tFoot)
}

async function totaisFaturasFin(forcar = true) {
    const ctrl = controles.faturasFin
    if (!ctrl || !document.querySelector('[data-total-fin]')) return
    const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos)
    const assinatura = JSON.stringify(filtros)
    if (!forcar && assinatura === assinaturaTotaisFin) return
    assinaturaTotaisFin = assinatura
    const somas = await Promise.all(COLUNAS_TOTAL_FIN.map(async path => {
        try { return Number((await contarPorCampo({ base: 'vw_fin_titulos', path, modo: 'soma', filtros }))?.total || 0) } catch { return null }
    }))
    if (assinatura !== assinaturaTotaisFin) return
    somasFiltroFin = somas
    escreverTotaisFin()
}

// ---------------------------------------------------------------- Excel da lista
// Com faturas marcadas: só as marcadas (de qualquer página, mesmo fora do filtro). Sem marcação: tudo do filtro ativo.
// Cabeçalho com a logo do GCS, o tipo do relatório, quando/quem gerou e os filtros; tabela com autofiltro,
// moeda/data formatadas, totais por fórmula (SUBTOTAL: ignora o que for filtrado no Excel) e linhas zebradas.
async function baixarExcelFaturasFin() {
    const ctrl = controles.faturasFin
    if (!ctrl) return
    const tipo = tipoFaturasFin
    const pagar = tipo === 'PAGAR'
    overlayAguarde()
    try {
        const marcadas = [...selecaoFin].map(Number).filter(Number.isFinite)
        const filtros = marcadas.length
            ? { id: { modo: 'OR', regras: marcadas.map(id => ({ op: '=', value: id })) } }
            : combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        const ordenar = ctrl.ordenar || [{ path: 'vencimento', direcao: 'asc' }]
        const linhas = []
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_fin_titulos', filtros, ordenar, pagina, limite: 2000 })
            linhas.push(...(r?.resultados || []))
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)

        const opcoes = await carregarOpcoesFin().catch(() => null)
        const nomeCategoria = new Map((opcoes?.categorias || []).map(c => [String(c.id), `${c.codigo || ''} ${c.nome || ''}`.trim()]))
        const categorias = d => {
            const lista = Array.isArray(d.categorias) ? d.categorias : []
            if (lista.length < 2) return d.categoria || ''
            return lista.map(c => `${nomeCategoria.get(String(c.categoria_id)) || c.categoria_id} (${Number(c.percentual)}%)`).join(' / ')
        }
        const departamentos = d => {
            const lista = Array.isArray(d.rateio) ? d.rateio : []
            return lista.length > 1 ? lista.map(r => `${r.departamento} (${Number(r.percentual).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)`).join(' / ') : (d.departamentos || '')
        }
        // Data "pura" no Excel (meio-dia UTC: não muda de dia por fuso).
        const data = v => v ? new Date(`${String(v).slice(0, 10)}T12:00:00Z`) : null
        const textoSituacao = s => s === 'PAGO' ? termoFin('Pago', tipo) : (SITUACOES_FIN[s]?.texto || s || '')

        const corSituacao = { ATRASADO: 'FFB91C1C', PAGO: 'FF15803D', 'VENCE HOJE': 'FFD97706', 'A VENCER': 'FF2563EB', CANCELADO: 'FF64748B' }
        const colunas = [
            { titulo: 'Situação', largura: 13, cor: d => corSituacao[d.situacao], valor: d => textoSituacao(d.situacao) },
            { titulo: 'Vencimento', largura: 12, tipo: 'data', valor: d => data(d.vencimento) },
            { titulo: pagar ? 'Pago em' : 'Recebido em', largura: 12, tipo: 'data', valor: d => data(d.dia_pagamento) },
            { titulo: 'Inclusão', largura: 12, tipo: 'data', valor: d => data(diaInclusaoFin(d.criado_em)) },
            { titulo: 'Empresa', largura: 9, centro: true, valor: d => d.app || '' },
            { titulo: 'Nota fiscal', largura: 12, centro: true, valor: d => d.nota_fiscal || '' },
            { titulo: 'Parcela', largura: 9, centro: true, valor: d => d.parcela_texto || '' },
            { titulo: pagar ? 'Fornecedor' : 'Cliente', largura: 38, valor: d => d.participante_nome || '' },
            { titulo: 'CPF/CNPJ', largura: 19, valor: d => d.participante_documento ? docFormatadoFis(d.participante_documento) : '' },
            { titulo: 'Valor da conta', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.valor) || 0 },
            { titulo: 'Valor líquido', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.valor_liquido) || 0 },
            { titulo: 'Impostos retidos', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.impostos_retidos) || 0 },
            { titulo: 'Desconto', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.desconto) || 0 },
            { titulo: 'Juros e multas', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.juros_multa) || 0 },
            { titulo: 'Valor pago', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.valor_pago) || 0 },
            ...(pagar ? [{ titulo: 'Comprovante', largura: 13, centro: true, valor: d => d.comprovante === 'NÃO' ? '✗' : d.comprovante === 'SIM' ? '✓' : '' }] : []),
            { titulo: 'Observação', largura: 40, quebra: true, valor: d => d.observacao || '' },
            { titulo: 'Categoria', largura: 34, quebra: true, valor: categorias },
            { titulo: 'Departamento', largura: 22, quebra: true, valor: departamentos },
            { titulo: 'Nº documento', largura: 14, valor: d => d.numero_documento || d.documento_numero || '' },
            { titulo: 'Forma', largura: 18, valor: d => (FORMAS_FIN.find(([v]) => v === d.forma_pagamento) || [])[1] || '' },
            { titulo: 'Conta corrente', largura: 22, valor: d => d.conta || '' },
            { titulo: 'Origem', largura: 14, valor: d => ORIGENS_FIN[d.origem] || d.origem || '' },
            { titulo: 'Criado por', largura: 18, valor: d => d.criado_por || '' },
            { titulo: 'Saldo', largura: 15, tipo: 'moeda', soma: true, valor: d => Number(d.saldo) || 0 }
        ]
        await baixarExcelRelatorioGCS({
            titulo: `Faturas a ${pagar ? 'pagar' : 'receber'}`,
            resumo: `${linhas.length} fatura(s)`,
            filtrosTexto: marcadas.length ? `Faturas marcadas na tela: ${marcadas.length}` : `Filtros: ${descreverFiltrosFin(ctrl)}`,
            colunas,
            linhas
        })
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escFin(err.message)}` })
    } finally {
        removerOverlay()
    }
}

// Texto dos filtros da tabela para o cabeçalho do Excel ("Situação: ATRASADO · Vencimento: a partir de 01/11/2026").
function descreverFiltrosFin(ctrl) {
    const colunas = Object.entries(ctrl.colunas || {}).filter(([, c]) => c.chave)
    const ops = { '>=d': 'a partir de', '<=d': 'até', '>=': 'a partir de', '<=': 'até', '=': '' }
    const valor = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v).split('-').reverse().join('/') : String(v)
    const partes = Object.entries(ctrl.filtros || {}).map(([chave, f]) => {
        const lista = (Array.isArray(f) ? f : [f]).filter(x => x && x.value !== '' && x.value != null)
        if (!lista.length) return ''
        const [nome, coluna] = colunas.find(([, c]) => c.chave === chave) || [chave, {}]
        // Filtro escolhido pelo funil (js/tabelas-cabecalho.js): já vem descrito ("Entre ... e ...", "Esse mês"...).
        if (ctrl.filtrosMeta?.[chave] && typeof textoFiltroCab === 'function') return `${nome}: ${textoFiltroCab('faturasFin', chave)}`
        const rotulos = coluna.rotulos || {}
        return `${nome}: ${lista.map(x => `${ops[x.op] ?? ''} ${rotulos[String(x.value).toUpperCase()] || valor(x.value)}`.trim()).join(' e ')}`
    }).filter(Boolean)
    if (Object.keys(ctrl.filtrosFixos || {}).some(k => !['tipo', 'ativa'].includes(k))) partes.push('filtro vindo de outra tela')
    return partes.length ? partes.join(' · ') : 'nenhum (todas as faturas)'
}

// ---------------------------------------------------------------- paginação do rodapé
function desenharRodapeFin() {
    const alvo = document.querySelector('[data-rodape-fin]')
    const ctrl = controles.faturasFin
    if (!alvo || !ctrl) return
    const total = Number(document.getElementById('resultados_faturasFin')?.textContent) || 0
    const paginas = Math.max(1, Number(ctrl.total) || 1)
    const pagina = Math.min(ctrl.pagina || 1, paginas)
    const inicio = total ? (pagina - 1) * POR_PAGINA_FIN + 1 : 0
    const fim = Math.min(total, pagina * POR_PAGINA_FIN)
    const botao = (texto, destino, ativo, titulo = '') =>
        `<button type="button" ${ativo ? `onclick="irPaginaFin(${destino})"` : 'disabled'} ${titulo ? `title="${titulo}"` : ''}>${texto}</button>`
    alvo.innerHTML = `
        <span class="fin-rodape-info"><span>${inicio} - ${fim} de ${total.toLocaleString('pt-BR')} registro${total === 1 ? '' : 's'}</span>${filtrosAtivosRodapeCab(ctrl.pag)}</span>
        <div class="fin-paginas">
            ${botao('|‹', 1, pagina > 1, 'Primeira página')}
            ${botao('‹ anterior', pagina - 1, pagina > 1)}
            <label>Página <input type="number" min="1" max="${paginas}" value="${pagina}" onchange="irPaginaFin(this.value)"></label>
            <span>de ${paginas.toLocaleString('pt-BR')}</span>
            ${botao('próximo ›', pagina + 1, pagina < paginas)}
            ${botao('›|', paginas, pagina < paginas, 'Última página')}
        </div>`
}

async function irPaginaFin(n) {
    const ctrl = controles.faturasFin
    if (!ctrl) return
    const pagina = Math.min(Math.max(1, parseInt(n) || 1), Math.max(1, Number(ctrl.total) || 1))
    if (pagina === ctrl.pagina) return desenharRodapeFin()
    ctrl.pagina = pagina
    await paginacao('faturasFin')
}

// ---------------------------------------------------------------- painel de ações (lateral direita)
function selecionarFaturaFin(id, event) {
    if (event?.target?.closest('input, button, a, select')) return
    faturaAtivaFin = String(id)
    marcarLinhaAtivaFin()
    desenharPainelFin()
    alternarPainelFin(true)
}

function marcarLinhaAtivaFin() {
    document.querySelectorAll('#bodyFaturasFin > tr[data-id]').forEach(tr => tr.classList.toggle('fin-linha-ativa', tr.dataset.id === faturaAtivaFin))
}

// Iniciais do nome (círculo do painel, como no Omie): "RECEITA FEDERAL" -> "RF".
const iniciaisFin = nome => String(nome || '').replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).filter(Boolean)
    .slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?'

// Aberto: ícone + texto. Recolhido (.fin-corpo.recolhido): só os ícones, com o texto no título (passar o mouse).
function desenharPainelFin() {
    const painel = document.querySelector('[data-painel-fin]')
    if (!painel) return
    const pagar = tipoFaturasFin === 'PAGAR'
    const acao = (icone, texto, funcao, { perigo = false, ativo = true, motivo = '' } = {}) => `
        <button type="button" class="fin-acao${perigo ? ' perigo' : ''}" title="${escFin(ativo ? texto : `${texto}: ${motivo}`)}" ${ativo ? `onclick="${funcao}"` : 'disabled'}>
            ${iconeFin(icone)}<span>${texto}</span></button>`
    const cabeca = (circulo, titulo, detalhe = '') => `
        <div class="fin-painel-cabeca" title="${escFin(titulo)}">
            <span class="fin-avatar">${escFin(circulo)}</span>
            <div class="fin-painel-texto"><b>${escFin(titulo)}</b>${detalhe}</div>
        </div>`

    if (selecaoFin.size) {
        painel.innerHTML = `
            ${cabeca(String(selecaoFin.size), `${selecaoFin.size} fatura(s) marcada(s)`, '<small>As ações valem para todas as marcadas.</small>')}
            ${acao('raio', pagar ? 'Pagar agora' : 'Receber agora', 'baixaLoteFin()')}
            ${acao('vencimento', 'Mudar vencimento', 'vencimentoLoteFin()')}
            ${acao('empresa', 'Mudar empresa', 'empresaLoteFin()')}
            <hr>
            ${acao('cancelar', `Cancelar ${termoFin('pagamento')}`, 'cancelarPagamentosFin()', { perigo: true })}
            ${acao('excluir', 'Excluir', 'excluirLoteFin()', { perigo: true })}
            ${acao('fechar', 'Desmarcar todas', 'limparSelecaoFin()')}`
        return
    }

    // Sem fatura escolhida: as mesmas ações, apagadas, com a dica no topo.
    const d = faturaAtivaFin ? dadosFaturasFin.get(faturaAtivaFin) : null
    const nada = 'Clique numa fatura da tabela'
    const id = escFin(d?.id || '')
    const cancelada = d?.situacao === 'CANCELADO'
    const aberta = !!d && !['PAGO', 'CANCELADO'].includes(d.situacao)
    const lancadaAqui = ORIGENS_EDITAVEIS_FIN.includes(d?.origem)
    const comPagamento = Number(d?.pago) > 0
    const motivoQuitada = !d ? nada : cancelada ? 'Fatura excluída' : 'Já está quitada'
    const motivoLancada = !d ? nada : !lancadaAqui ? `Veio de ${(ORIGENS_FIN[d.origem] || d.origem).toLowerCase()}: mexa na origem.` : comPagamento ? `Tem ${termoFin('pagamento')}: cancele o ${termoFin('pagamento')} antes.` : ''
    const motivoCancelar = !d ? nada : cancelada ? 'Fatura excluída' : `Sem ${termoFin('pagamento')} para cancelar`
    const tipo = escFin(d?.tipo || tipoFaturasFin)
    const rec = escFin(d?.recorrencia_id || '')
    painel.innerHTML = `
        ${d
            ? cabeca(iniciaisFin(d.participante_nome), d.participante_nome || '(sem nome)', `<small>${dataFin(d.vencimento)} · ${dinheiro(d.valor)}</small>${situacaoFin(d.situacao)}`)
            : cabeca('?', 'Nenhuma fatura escolhida', '<small>Clique numa linha para ver as ações; duplo clique abre o formulário. Marque várias pela caixinha para agir em lote.</small>')}
        ${acao('ver', 'Ver fatura', `abrirFaturaFin('${id}')`, { ativo: !!d, motivo: nada })}
        ${acao('editar', 'Editar', `formularioFaturaFin('${tipo}', '${id}')`, { ativo: !!d && !cancelada, motivo: d ? 'Fatura excluída' : nada })}
        ${acao('raio', pagar ? 'Pagar agora' : 'Receber agora', `formularioBaixaRapidaFin('${id}')`, { ativo: aberta, motivo: motivoQuitada })}
        ${acao('parcial', `Registrar ${termoFin('pagamento')} (parcial, juros...)`, `formularioFaturaFin('${tipo}', '${id}', null, 'pagamentos')`, { ativo: aberta, motivo: motivoQuitada })}
        ${d ? `<div data-danfe-fin="${id}"></div>` : ''}
        ${d?.recorrencia_id ? `
            ${acao('repetir', 'Editar repetição', `formularioFaturaFin('${tipo}', null, '${rec}')`)}
            ${acao('encerrar', 'Encerrar repetição', `encerrarRecorrenciaFin('${rec}')`)}` : ''}
        <hr>
        ${acao('cancelar', `Cancelar ${termoFin('pagamento')}`, `cancelarPagamentosFin('${id}')`, { perigo: true, ativo: !!d && comPagamento && !cancelada, motivo: motivoCancelar })}
        ${acao('excluir', 'Excluir', `excluirFaturaFin('${id}')`, { perigo: true, ativo: !!d && lancadaAqui && !comPagamento && !cancelada, motivo: cancelada ? 'Já excluída' : motivoLancada })}`
    if (d) mostrarDanfePainelFin(String(d.id))
}

// "Exibir DANFE" no painel: só aparece quando a fatura tem nota achada no GCS (nota que gerou a fatura, nota
// recebida do fornecedor com o mesmo número ou, a receber, a nota emitida no Omie). Resposta guardada por fatura.
const notaFaturaFin = new Map()
async function mostrarDanfePainelFin(id) {
    if (!notaFaturaFin.has(id)) {
        try {
            const { nota } = await apiFiscal('fatura/nota', { id })
            notaFaturaFin.set(id, nota || null)
        } catch {
            return
        }
    }
    const nota = notaFaturaFin.get(id)
    const alvo = document.querySelector(`[data-danfe-fin="${CSS.escape(id)}"]`)
    if (!alvo || !nota) return
    const doc = nota.modelo === 'CTE' ? 'DACTE' : nota.modelo === 'NFSE' ? 'DANFSe' : 'DANFE'
    const texto = nota.modelo === 'CTE' ? `Exibir ${doc} do frete` : nota.direcao === 'ENTRADA' ? `Exibir ${doc} do fornecedor` : `Exibir ${doc}`
    alvo.outerHTML = `
        <button type="button" class="fin-acao" title="${escFin(`${texto}${nota.numero ? ` (nota ${nota.numero})` : ''}`)}" onclick="baixarArquivoFiscal('${escFin(id)}', 'pdf', 'fatura/danfe')">
            ${iconeFin('danfe')}<span>${texto}</span></button>`
}

async function excluirFaturaFin(id, doFormulario = false) {
    const ok = await confirmarPopup({
        titulo: 'Excluir fatura',
        mensagem: `A fatura sai do sistema (fica registrado quem excluiu e quando). Só as lançadas aqui (manual ou repetição) e sem ${termoFin('pagamento')}.`,
        textoConfirmar: 'Excluir'
    })
    if (!ok) return
    if (doFormulario) voltarFaturasFin()
    executarLoteFin({ acao: 'excluir' }, null, [String(id)])
}

// Cancelar = desfazer os pagamentos/recebimentos (todas as baixas, com juros/desconto etc.): a fatura volta a
// ficar em aberto. Sem justificativa. Sem id: as faturas marcadas na tabela.
async function cancelarPagamentosFin(id = null) {
    const varias = !id
    const ok = await confirmarPopup({
        titulo: `Cancelar ${termoFin('pagamento')}${varias ? ` de ${selecaoFin.size} fatura(s)` : ''}`,
        mensagem: `A fatura volta a ficar em aberto (o ${termoFin('pagamento')} sai da conta corrente).`,
        textoConfirmar: `Cancelar ${termoFin('pagamento')}`
    })
    if (!ok) return
    await executarLoteFin({ acao: 'cancelar' }, null, varias ? null : [String(id)])
    if (!varias) posAcaoFaturaFin(id, Boolean(document.querySelector(`[data-fatura-fin="${CSS.escape(String(id))}"]`)))
}

// ---------------------------------------------------------------- seleção e ações em várias faturas
// A seleção vale entre páginas (ids). "Marcar todas" (cabeçalho) marca as da página aberta e mostra o aviso
// acima da tabela, que oferece marcar todas as do filtro (todas as páginas) ou limpar a seleção.
const selecaoFin = new Set()

function guardarValorSelecaoFin(id) {
    const d = dadosFaturasFin.get(id)
    if (d) valoresSelecaoFin.set(id, valoresTotaisFin(d))
}

function limparSelecaoFin() {
    selecaoFin.clear()
    valoresSelecaoFin.clear()
    prepararSelecaoFin()
}

const totalFiltroFin = () => Number(document.getElementById('resultados_faturasFin')?.textContent) || 0

// Marca todas as faturas do filtro aplicado (todas as páginas), buscando ids e valores no banco.
async function selecionarTodasFiltroFin() {
    const ctrl = controles.faturasFin
    if (!ctrl) return
    overlayAguarde()
    try {
        const filtros = combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        let pagina = 1, paginas = 1
        do {
            const r = await pesquisarDB({ base: 'vw_fin_titulos', filtros, ordenar: ctrl.ordenar || [{ path: 'vencimento', direcao: 'asc' }], pagina, limite: 2000 })
            ;(r?.resultados || []).forEach(d => {
                const id = String(d.id)
                selecaoFin.add(id)
                valoresSelecaoFin.set(id, valoresTotaisFin(d))
            })
            paginas = Number(r?.paginas) || 1
            pagina++
        } while (pagina <= paginas && pagina <= 50)
        removerOverlay()
        prepararSelecaoFin()
        if (selecaoFin.size) alternarPainelFin(true)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: `Falha ao marcar as faturas do filtro: ${escFin(err.message)}` })
    }
}

function desenharAvisoSelecaoFin(paginaToda) {
    const aviso = document.querySelector('[data-aviso-selecao-fin]')
    if (!aviso) return
    const n = selecaoFin.size, total = totalFiltroFin()
    if (!n || !paginaToda) { aviso.hidden = true; aviso.innerHTML = ''; return }
    const plural = (q, s, p) => `${q.toLocaleString('pt-BR')} ${q === 1 ? s : p}`
    const limpar = '<a href="#" onclick="event.preventDefault(); limparSelecaoFin()">limpar a seleção</a>'
    aviso.hidden = false
    aviso.innerHTML = n < total
        ? `Você selecionou ${plural(n, 'registro', 'registros')}. Você pode ${limpar} ou <a href="#" onclick="event.preventDefault(); selecionarTodasFiltroFin()">selecionar todos ${plural(total, 'registro', 'registros')} deste filtro</a>`
        : `Você selecionou ${n === total ? 'todos os ' : ''}${plural(n, 'registro', 'registros')}${n === total ? ' deste filtro' : ''}. Você pode ${limpar}`
}

function prepararSelecaoFin() {
    const th = document.querySelector('.fin-tela .tabela thead tr:first-child th:first-child')
    if (th && !th.querySelector('[data-marcar-todas-fin]'))
        th.innerHTML = '<input type="checkbox" class="fin-marcar" data-marcar-todas-fin title="Marcar todas desta página" onclick="event.stopPropagation(); marcarTodasFin(this)">'
    const filtro = document.querySelector('.fin-tela .tabela thead tr:nth-child(2) th:first-child')
    if (filtro?.querySelector('img')) filtro.innerHTML = ''
    document.querySelectorAll('#bodyFaturasFin [data-marcar-fin]').forEach(c => { c.checked = selecaoFin.has(c.value) })
    desenharSelecaoFin()
}

function marcarFaturaFin(caixa) {
    if (caixa.checked) { selecaoFin.add(caixa.value); guardarValorSelecaoFin(caixa.value) }
    else selecaoFin.delete(caixa.value)
    desenharSelecaoFin()
    if (selecaoFin.size) alternarPainelFin(true)
}

function marcarTodasFin(caixa) {
    document.querySelectorAll('#bodyFaturasFin [data-marcar-fin]').forEach(c => {
        c.checked = caixa.checked
        if (caixa.checked) { selecaoFin.add(c.value); guardarValorSelecaoFin(c.value) }
        else selecaoFin.delete(c.value)
    })
    desenharSelecaoFin()
    if (selecaoFin.size) alternarPainelFin(true)
}

function desenharSelecaoFin() {
    const pagina = [...document.querySelectorAll('#bodyFaturasFin [data-marcar-fin]')]
    const todas = document.querySelector('[data-marcar-todas-fin]')
    const marcadas = pagina.filter(c => c.checked).length
    const paginaToda = pagina.length > 0 && marcadas === pagina.length
    if (todas) {
        todas.checked = paginaToda
        todas.indeterminate = marcadas > 0 && marcadas < pagina.length
    }
    desenharAvisoSelecaoFin(paginaToda)
    escreverTotaisFin()
    desenharPainelFin()
}

// Um popup de ação em lote por vez: abrir outro (ou o mesmo de novo) fecha o que estava aberto.
function fecharPopupsLoteFin() {
    document.querySelectorAll('[data-lote-baixa], [data-lote-vencimento], [data-lote-empresa]')
        .forEach(f => removerPopup(f.closest('.popup')?.id))
}

async function baixaLoteFin() {
    fecharPopupsLoteFin()
    let op
    try { op = await carregarOpcoesFin() } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    const pagar = tipoFaturasFin === 'PAGAR'
    popup({
        titulo: `Dar baixa em ${selecaoFin.size} fatura(s)`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-lote-baixa>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Data real ${pagar ? 'do pagamento' : 'do recebimento'} *</span><input class="fis-input" type="date" name="data" max="${hojeFin()}" value="${hojeFin()}"></label>
                        <label class="fis-campo fis-largo"><span>Conta corrente</span><select class="fis-input" name="conta_id">
                            <option value="">A da fatura (ou a padrão da empresa dela)</option>
                            ${op.contas.map(k => `<option value="${k.id}">${escFin(k.app)} · ${escFin(k.nome)}${k.padrao ? ' (padrão)' : ''}</option>`).join('')}
                        </select></label>
                    </div>
                    <small class="fis-dica">Cada fatura é quitada pelo que falta. Escolhendo uma conta, ela vale para as faturas da mesma empresa; as de outras empresas usam a conta delas.</small>
                </div>`
        }],
        botoes: [{ texto: pagar ? 'Marcar como pagas' : 'Marcar como recebidas', img: 'concluido', funcao: 'confirmarBaixaLoteFin(this)' }]
    })
}

function confirmarBaixaLoteFin(botao) {
    const form = document.querySelector('[data-lote-baixa]')
    const data = form.querySelector('[name="data"]').value
    if (!data) return popup({ mensagem: `Informe a data real do ${termoFin('pagamento')}.` })
    return executarLoteFin({ acao: 'baixar', data, conta_id: form.querySelector('[name="conta_id"]').value || null }, botao)
}

function vencimentoLoteFin() {
    fecharPopupsLoteFin()
    popup({
        titulo: `Mudar vencimento de ${selecaoFin.size} fatura(s)`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-lote-vencimento>
                    <label class="fis-campo"><span>Novo vencimento *</span><input class="fis-input" type="date" name="vencimento"></label>
                    <small class="fis-dica">As já ${termoFin('pagas')} ficam como estão.</small>
                </div>`
        }],
        botoes: [{ texto: 'Mudar vencimento', img: 'concluido', funcao: 'confirmarVencimentoLoteFin(this)' }]
    })
}

function confirmarVencimentoLoteFin(botao) {
    const vencimento = document.querySelector('[data-lote-vencimento] [name="vencimento"]').value
    if (!vencimento) return popup({ mensagem: 'Informe o novo vencimento.' })
    return executarLoteFin({ acao: 'vencimento', vencimento }, botao)
}

// Troca a empresa (app) das marcadas, como no formulário: vale em qualquer situação; a conta passa a ser a
// escolhida ou a padrão da empresa nova, e os pagamentos/recebimentos vão para ela.
async function empresaLoteFin() {
    fecharPopupsLoteFin()
    let op
    try { op = await carregarOpcoesFin() } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    const app = ''
    popup({
        titulo: `Mudar empresa de ${selecaoFin.size} fatura(s)`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-lote-empresa>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Nova empresa *</span>
                            <select class="fis-input" name="app" onchange="this.closest('[data-lote-empresa]').querySelector('[name=conta_id]').innerHTML = opcoesContasFin(opcoesFinCache.contas, this.value, '')">
                                <option value="">Selecione</option>${opcoesEmpresasFin(op.empresas, app)}
                            </select></label>
                        <label class="fis-campo fis-largo"><span>Conta corrente</span>
                            <select class="fis-input" name="conta_id"><option value="">Escolha a empresa primeiro</option></select></label>
                    </div>
                    <small class="fis-dica">Vale para pagas e em aberto. Os ${termoFin('pagamento')}s já lançados passam para a conta da empresa nova. As que já são dessa empresa ficam como estão.</small>
                </div>`
        }],
        botoes: [{ texto: 'Mudar empresa', img: 'concluido', funcao: 'confirmarEmpresaLoteFin(this)' }]
    })
}

function confirmarEmpresaLoteFin(botao) {
    const form = document.querySelector('[data-lote-empresa]')
    const app = form.querySelector('[name="app"]').value
    if (!app) return popup({ mensagem: 'Escolha a empresa.' })
    return executarLoteFin({ acao: 'empresa', app, conta_id: form.querySelector('[name="conta_id"]').value || null }, botao)
}

async function excluirLoteFin() {
    const ok = await confirmarPopup({
        titulo: `Excluir ${selecaoFin.size} fatura(s)`,
        mensagem: `Saem da lista. Só as lançadas aqui (manual ou repetição) e sem ${termoFin('pagamento')}; as que vieram de nota ou de reembolso, ou já têm ${termoFin('pagamento')}, ficam e o motivo aparece no fim.`,
        textoConfirmar: 'Excluir'
    })
    if (ok) executarLoteFin({ acao: 'excluir' })
}

// Trava contra duplo clique: o botão do popup é um onclick simples e o 2º clique reenviava o lote (27/11:
// a 1ª chamada trocava a empresa e a 2ª respondia "0 fatura(s)... já é da AC" por cima do resultado certo).
let loteEmAndamentoFin = false
async function executarLoteFin(corpo, botao = null, ids = null) {
    if (loteEmAndamentoFin) return
    loteEmAndamentoFin = true
    try {
        overlayAguarde()
        const r = await apiFin('lote', { ...corpo, ids: ids || [...selecaoFin] })
        removerOverlay()
        if (botao) removerPopup(botao.closest('.popup')?.id)
        fecharPopupsLoteFin()
        // Só um aviso de resultado na tela: o anterior sai quando chega o novo.
        document.querySelectorAll('.balao-aviso').forEach(b => { if (b.querySelector('[data-resultado-lote-fin]')) b.remove() })
        const verbo = { baixar: corpo.acao === 'baixar' && tipoFaturasFin === 'RECEBER' ? 'recebida(s)' : 'paga(s)', vencimento: 'com vencimento novo', empresa: `passada(s) para a ${escFin(corpo.app || '')}`, excluir: 'excluída(s)', cancelar: `com o ${termoFin('pagamento')} cancelado` }[corpo.acao]
        popup({
            titulo: ids ? 'Fatura' : 'Faturas marcadas',
            mensagem: `<span data-resultado-lote-fin hidden></span><b>${r.feitas ?`${r.feitas} fatura(s) ${verbo}.` : 'Nenhuma fatura foi alterada.'}</b>${r.puladas.length ? `<br>${r.feitas ? `${r.puladas.length} das marcadas ficaram de fora` : 'Motivo de cada uma'}:<ul class="fis-lista">${r.puladas.map(p => `<li>${escFin(p.fatura)}: ${escFin(p.motivo)}</li>`).join('')}</ul>` : ''}`,
            imagem: r.puladas.length ? undefined : 'imagens/concluido.png'
        })
        if (!ids) { selecaoFin.clear(); valoresSelecaoFin.clear() }
        if (controles.faturasFin) await paginacao('faturasFin')
        prepararSelecaoFin()
        totaisFaturasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    } finally {
        loteEmAndamentoFin = false
    }
}

function criarLinhaFaturaFin(d) {
    dadosFaturasFin.set(String(d.id), d)
    const id = escFin(d.id)
    return `
        <tr class="fin-linha" onclick="selecionarFaturaFin('${id}', event)" ondblclick="${d.situacao === 'CANCELADO' ? `abrirFaturaFin('${id}')` : `formularioFaturaFin('${escFin(d.tipo || tipoFaturasFin)}', '${id}')`}">
            <td class="fin-col-marcar">
                <input type="checkbox" class="fin-marcar" data-marcar-fin value="${id}" ${selecaoFin.has(String(d.id)) ? 'checked' : ''}
                    onclick="event.stopPropagation(); marcarFaturaFin(this)" ondblclick="event.stopPropagation()" aria-label="Marcar fatura">
            </td>
            <td>${situacaoFin(d.situacao)}</td>
            <td class="fin-centro">${dataFin(d.vencimento)}</td>
            <td class="fin-centro">${d.dia_pagamento ? dataFin(d.dia_pagamento) : '<span class="fin-vazio">&lt;não informado&gt;</span>'}</td>
            <td class="fin-centro">${dataFin(diaInclusaoFin(d.criado_em))}</td>
            <td>${escFin(d.app)}</td>
            <td class="fin-centro fin-doc">${escFin(d.nota_fiscal || '')}</td>
            <td class="fin-centro">${escFin(d.parcela_texto)}</td>
            <td class="fin-obs fin-nome" title="${escFin(d.participante_nome || '')}"><span class="fin-obs-txt">${escFin(d.participante_nome || '')}</span></td>
            <td title="${escFin(d.tags_texto || '')}"><div class="fin-tags-celula">${chipsTagsPag(d.tags)}</div></td>
            <td class="fin-centro fin-doc">${d.participante_documento ? docFormatadoFis(d.participante_documento) : ''}</td>
            <td class="fis-num">${dinheiro(d.valor)}</td>
            <td class="fis-num">${dinheiro(d.valor_liquido)}</td>
            <td class="fis-num">${dinheiro(d.impostos_retidos)}</td>
            <td class="fis-num">${dinheiro(d.desconto)}</td>
            <td class="fis-num">${dinheiro(d.juros_multa)}</td>
            <td class="fis-num">${dinheiro(d.valor_pago)}</td>
            ${(d.tipo || tipoFaturasFin) === 'PAGAR' ? `<td class="fin-centro">${colunaComprovanteFin(d)}</td>` : ''}
            <td class="fin-obs" title="${escFin(d.observacao || '')}"><span class="fin-obs-txt">${escFin(d.observacao || '')}</span></td>
            <td class="fin-obs fin-deps" title="${escFin(d.departamentos || '')}"><span class="fin-obs-txt">${escFin(d.departamentos || '')}</span></td>
            <td class="fin-obs fin-deps" title="${escFin(d.categorias_texto || '')}"><span class="fin-obs-txt">${escFin(d.categorias_texto || '')}</span></td>
            <td><small>${escFin(ORIGENS_FIN[d.origem] || d.origem)}</small></td>
            <td class="fin-obs" title="${escFin(d.criado_por || '')}"><span class="fin-obs-txt">${escFin(d.criado_por || '')}</span></td>
        </tr>`
}

async function abrirFaturaFin(id) {
    overlayAguarde()
    try {
        const { titulo: t, baixas, irmas } = await apiFin('titulo', { id })
        await catalogoTagsPag()
        removerOverlay()
        const anterior = document.querySelector(`[data-fatura-fin="${CSS.escape(String(id))}"]`)?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        const s = SITUACOES_FIN[t.situacao] || {}
        const pagar = t.tipo === 'PAGAR'
        const vivas = baixas.filter(b => !b.estornada)
        const origem = t.documento_id
            ? `<span class="fis-link" onclick="abrirDocumentoFiscal('${escFin(t.documento_id)}')">${escFin(ORIGENS_FIN[t.origem])} ${escFin(t.documento_numero || '')}</span>`
            : t.origem === 'LOTE' && /^LOTE:\d+:/.test(t.origem_id || '') && typeof abrirLoteSalarios === 'function'
                ? `<span class="fis-link" onclick="abrirLoteSalarios(${Number(t.origem_id.split(':')[1])})">${escFin(ORIGENS_FIN.LOTE)}: ${escFin(t.descricao || 'abrir')}</span>`
                : t.origem === 'CTE' && t.origem_id && typeof abrirCteFis === 'function'
                    ? `<span class="fis-link" onclick="abrirCteFis('${escFin(t.origem_id)}')">${escFin(ORIGENS_FIN.CTE)} ${escFin(t.numero_documento || '')}</span>`
                    : escFin(ORIGENS_FIN[t.origem] || t.origem)
        popup({
            titulo: `Fatura a ${pagar ? 'pagar' : 'receber'}`,
            elemento: `
                <div class="fis-painel fis-doc fis-nota" data-fatura-fin="${escFin(t.id)}">
                    <div class="fis-nota-topo ${{ PAGO: 'ok', ATRASADO: 'erro', CANCELADO: 'neutro', 'VENCE HOJE': 'andando' }[t.situacao] || 'rascunho'}">
                        <div class="fis-nota-titulo">
                            <b>${escFin(t.participante_nome || '(sem nome)')}</b>
                            <div class="fis-nota-etiquetas">${etiquetaEst(s.texto || t.situacao, s.cor)} ${etiquetaEst(t.app, '#356443')} ${chipsTagsPag(t.tags)}</div>
                            <small>${escFin(t.observacao || '')}</small>
                        </div>
                        <div class="fis-nota-valor"><span>Saldo</span><b>${dinheiro(t.saldo)}</b></div>
                    </div>
                    ${resumoDocumentoFis(t, [
                        ['Vencimento', dataFin(t.vencimento)],
                        ['Parcela', escFin(t.parcela_texto)],
                        ['Valor', dinheiro(t.valor)],
                        [pagar ? 'Pago' : 'Recebido', `${dinheiro(Number(t.pago) + Number(t.acrescimos || 0))}${t.dia_pagamento ? ` <small>em ${dataFin(t.dia_pagamento)}</small>` : ''}`],
                        ['Categoria', escFin(t.categoria || '—')],
                        ['Conta', escFin(t.conta || 'padrão da empresa')],
                        ['Origem', origem],
                        ['Departamento', escFin(t.departamentos || '')],
                        ['Documento', escFin(t.numero_documento || '')]
                    ])}
                    ${t.observacao ? `<div class="fis-info">${escFin(t.observacao)}</div>` : ''}
                    ${t.situacao === 'CANCELADO' ? `<div class="fis-alerta">Excluída${t.cancelado_por ? ` por ${escFin(t.cancelado_por)}` : ''}${t.cancelado_em ? ` em ${new Date(t.cancelado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''}: ${escFin(t.cancelamento_motivo || '')}</div>` : ''}
                    <div class="fis-acoes-claras fis-nota-acoes">
                        ${!['PAGO', 'CANCELADO'].includes(t.situacao) ? `
                            <button type="button" class="fis-botao" onclick="formularioBaixaRapidaFin('${escFin(t.id)}')">Dar baixa (${pagar ? 'pago' : 'recebido'})</button>
                            <button type="button" class="fis-mini" onclick="formularioFaturaFin('${t.tipo}', '${escFin(t.id)}', null, 'pagamentos')">Registrar ${pagar ? 'pagamento' : 'recebimento'} (parcial, juros...)</button>` : ''}
                        ${t.situacao !== 'CANCELADO' ? `<button type="button" class="fis-mini" onclick="formularioFaturaFin('${t.tipo}', '${escFin(t.id)}')">Editar</button>` : ''}
                        ${t.situacao !== 'CANCELADO' && vivas.length ? `<button type="button" class="fis-mini" onclick="cancelarPagamentosFin('${escFin(t.id)}')">Cancelar ${pagar ? 'pagamento' : 'recebimento'}</button>` : ''}
                        ${['MANUAL', 'RECORRENCIA'].includes(t.origem) && t.situacao !== 'CANCELADO' && !vivas.length ? `<button type="button" class="fis-mini" onclick="excluirFaturaFin('${escFin(t.id)}')">Excluir</button>` : ''}
                        ${t.recorrencia_id ? `<span class="fis-separador"></span><small class="fis-nota-acoes-rotulo">Repete ${escFin(nomeFrequenciaFin(t.recorrencia_frequencia).toLowerCase())}</small>
                            <button type="button" class="fis-mini" onclick="formularioFaturaFin('${t.tipo}', null, '${escFin(t.recorrencia_id)}')">Editar repetição</button>
                            <button type="button" class="fis-mini" onclick="encerrarRecorrenciaFin('${escFin(t.recorrencia_id)}')">Encerrar repetição</button>` : ''}
                    </div>
                    <div class="fis-secao">
                        <div class="fis-secao-topo"><b>${pagar ? 'Pagamentos' : 'Recebimentos'}</b> <span class="fis-contador">${vivas.length}</span></div>
                        ${baixas.length ? `
                        <table class="fis-tabela">
                            <thead><tr><th>Data</th><th>Conta</th><th>Forma</th><th class="fis-num">Valor</th><th class="fis-num">Juros/multa</th><th class="fis-num">Desconto</th><th class="fis-num">Total</th><th>Por</th><th></th></tr></thead>
                            <tbody>${baixas.map(b => `
                                <tr class="${b.estornada ? 'fis-estornado' : ''}">
                                    <td>${dataFin(b.data)}</td>
                                    <td>${escFin(b.conta)}</td>
                                    <td>${escFin(nomeFormaFin(b.forma))}</td>
                                    <td class="fis-num">${dinheiro(b.valor)}</td>
                                    <td class="fis-num">${Number(b.juros) + Number(b.multa) ? dinheiro(Number(b.juros) + Number(b.multa)) : ''}</td>
                                    <td class="fis-num">${Number(b.desconto) ? dinheiro(b.desconto) : ''}</td>
                                    <td><small>${escFin(b.criado_por || '')}${b.estornada ? ` · desfeito${b.estorno_motivo ? `: ${escFin(b.estorno_motivo)}` : ''}` : ''}</small></td>
                                    <td>${b.estornada ? '' : `<button type="button" class="fis-mini" onclick="estornarBaixaFin('${escFin(b.id)}', '${escFin(t.id)}')">Desfazer</button>`}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>` : `<div class="fis-vazio">Nenhum ${pagar ? 'pagamento' : 'recebimento'} registrado.</div>`}
                    </div>
                    ${irmas.length ? `
                    <div class="fis-secao">
                        <div class="fis-secao-topo"><b>Outras parcelas</b></div>
                        <table class="fis-tabela"><tbody>${irmas.map(p => `
                            <tr><td>${escFin(p.parcela_texto)}</td><td>${dataFin(p.vencimento)}</td><td class="fis-num">${dinheiro(p.valor)}</td>
                                <td>${etiquetaEst(SITUACOES_FIN[p.situacao]?.texto || p.situacao, SITUACOES_FIN[p.situacao]?.cor)}</td>
                                <td><button type="button" class="fis-mini" onclick="abrirFaturaFin('${escFin(p.id)}')">Abrir</button></td></tr>`).join('')}
                        </tbody></table>
                    </div>` : ''}
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- formulário da fatura (tela, padrão "Contas a Pagar")
// Topo: iniciais do favorecido, Favorecido (busca no cadastro de clientes), Vencimento, Valor, Categoria, Empresa e
// Conta corrente. Abas: Detalhes (documento, forma, CPF/CNPJ, chave Pix, descrição, observação, anexos),
// Departamentos (rateio), Parcelas (nova), Repetição (nova ou edição da repetição) e Pagamentos (edição).
// Painel à direita: Salvar, Incluir (fatura nova), Pagar agora, Cancelar, Voltar à lista.
let anexosFormFin = []

async function formularioFaturaFin(tipo, id = null, recorrenciaId = null, aba = 'detalhes') {
    let op, dados = null, rec = null
    try {
        overlayAguarde()
        ;[op, dados, rec] = await Promise.all([
            carregarOpcoesFin(),
            id ? apiFin('titulo', { id }) : null,
            recorrenciaId ? apiFin('recorrencia', { id: recorrenciaId }).then(r => r.recorrencia) : null
        ])
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    document.querySelectorAll('[data-fatura-fin], [data-recorrencias-fin]').forEach(p => removerPopup(p.closest('.popup')?.id))
    tipoFaturasFin = tipo
    const t = dados?.titulo || null
    const baixas = dados?.baixas || []
    const base = t || rec
    const pagar = tipo === 'PAGAR'
    // Reembolso: o Financeiro edita livre (valor, vencimento, favorecido); depois disso o reembolso não sobrescreve.
    const manual = !t || ORIGENS_EDITAVEIS_FIN.includes(t.origem) || t.origem === 'REEMBOLSO'
    const cancelada = t?.situacao === 'CANCELADO'
    const nova = !t && !rec
    const app = base?.app || 'AC'
    const termino = rec ? (rec.ocorrencias ? 'VEZES' : rec.termina_em ? 'DATA' : 'NUNCA') : 'NUNCA'
    const titulo = rec ? 'Repetição' : t ? `Fatura a ${pagar ? 'pagar' : 'receber'}` : `Nova fatura a ${pagar ? 'pagar' : 'receber'}`
    const dia = v => v ? String(v).slice(0, 10) : ''
    const vencimento = t ? dia(t.vencimento) : rec ? dia(rec.primeiro_vencimento) : ''
    const valor = t ? r2Fin(t.valor) : rec ? r2Fin(rec.valor) : ''
    // Com pagamento/recebimento registrado (27/11/2026, a pedido): valor, vencimento e favorecido travam; para
    // mudar, cancela-se o pagamento, altera e registra de novo. Departamentos, categorias, tags e obs. seguem livres.
    const comPagamento = Number(t?.pago) > 0
    const livre = manual && !cancelada && !comPagamento
    const travaVencimento = rec || comPagamento || cancelada
    // Data de pagamento no cabeçalho (27/11/2026, a pedido): a do último pagamento ativo; sem pagamento, igual ao vencimento.
    const baixaRecente = baixas.filter(b => !b.estornada && b.data).sort((a, b) => String(b.data).localeCompare(String(a.data)))[0] || null
    anexosFormFin = Array.isArray(t?.anexos) ? [...t.anexos] : []
    const quando = (em, por) => em ? `Em ${new Date(em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${por ? ` por ${escFin(por)}` : ''}` : '—'
    const avisos = [
        !manual ? `Fatura de ${escFin(ORIGENS_FIN[t.origem])}: valor e ${termoFin('favorecido', tipo)} vêm da origem.${comPagamento ? ` Com ${termoFin('pagamento', tipo)}, o vencimento também fica.` : ''}` : '',
        manual && comPagamento && !cancelada ? `Fatura com ${termoFin('pagamento', tipo)} registrado: valor, vencimento e ${termoFin('favorecido', tipo)} não mudam. Para alterar, use <b>Cancelar ${termoFin('pagamento', tipo)}</b>, ajuste e registre de novo.` : '',
        t?.recorrencia_id ? `Ocorrência de uma repetição (${escFin(nomeFrequenciaFin(t.recorrencia_frequencia).toLowerCase())}): a mudança vale só para ela. Para mudar as futuras, edite a repetição.` : '',
        rec ? `A mudança vale para as próximas faturas ainda sem ${termoFin('pagamento', tipo)}. Frequência e 1º vencimento não mudam: para isso, encerre e crie outra.` : '',
        cancelada ? `Fatura excluída${t.cancelamento_motivo ? `: ${escFin(t.cancelamento_motivo)}` : ''}. Não se altera.` : ''
    ].filter(Boolean)
    const abas = [
        ['detalhes', 'Detalhes', true],
        ['categorias', 'Categorias', true],
        ['tags', 'Tags', true],
        ['departamentos', 'Departamentos', true],
        ['parcelas', 'Parcelas', Boolean(t)],
        ['repeticoes', 'Repetições', nova || Boolean(t && !cancelada)],
        ['repeticao', 'Repetição', Boolean(rec)],
        ['pagamentos', pagar ? 'Pagamentos' : 'Recebimentos', Boolean(t)],
        ['aprovacao', 'Aprovação', Boolean(t && pagar)]
    ].filter(a => a[2])
    if (!abas.some(a => a[0] === aba)) aba = 'detalhes'

    tela.innerHTML = `
        <div class="fis-pagina fin-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo"><h2>${titulo}</h2></header>
                <div class="fin-corpo" data-corpo-fin>
                    <div class="fin-form-area" data-form-fatura data-id="${escFin(id || '')}" data-recorrencia="${escFin(recorrenciaId || '')}"
                        data-tipo="${tipo}" data-aba-ativa="${aba}" data-cliente="${escFin(base?.cliente_id || '')}">
                        <div class="fin-form-topo">
                            <div class="fin-avatar fin-avatar-grande" data-avatar-fin>${escFin(iniciaisFin(base?.participante_nome))}</div>
                            <div class="fin-form-grade">
                                <div class="fin-campo fin-campo-favorecido">
                                    <span>${pagar ? 'Favorecido / Fornecedor' : 'Cliente'} <img class="fin-vinculo" data-vinculo-fin src="imagens/link.png" alt="Cadastro" title="Abrir o cadastro" onclick="abrirCadastroFavorecidoFin(event)" ${base?.cliente_id ? '' : 'hidden'}></span>
                                    <span class="opcoes fin-opcoes${livre ? '' : ' travado'}" name="favorecido_fin" ${base?.cliente_id ? `id="${escFin(base.cliente_id)}"` : ''}
                                        ${livre ? 'onclick="abrirFavorecidosFin()"' : `title="${manual && comPagamento ? `Com ${termoFin('pagamento', tipo)}: cancele para alterar` : 'Vem da origem da fatura'}"`}>${escFin(base?.participante_nome || 'Selecione')}</span>
                                    <input type="hidden" name="participante_nome" value="${escFin(base?.participante_nome || '')}">
                                </div>
                                <label class="fin-campo"><span>Vencimento *</span>
                                    <input class="fis-input" type="date" name="vencimento" value="${escFin(vencimento)}" ${travaVencimento ? 'readonly' : ''} oninput="sincronizarTopoFin()"></label>
                                <label class="fin-campo"><span>Valor *${t ? ` <small class="fin-parcela">${escFin(t.parcela_texto)}</small>` : ''}</span>
                                    <input class="fis-input fis-num" type="number" step="0.01" min="0.01" name="valor" value="${valor}" ${livre ? '' : 'readonly'} oninput="sincronizarTopoFin()"></label>
                                <label class="fin-campo"><span>Empresa</span>
                                    <select class="fis-input" name="app" ${cancelada || rec ? 'disabled' : ''} data-app-original="${escFin(t ? app : '')}"
                                        data-pagamentos="${baixas.filter(b => !b.estornada).length}" onchange="trocarEmpresaFormFin(this)">
                                        ${opcoesEmpresasFin(op.empresas, app)}
                                    </select></label>
                                ${rec ? '' : `<label class="fin-campo" title="${baixaRecente ? `Data do último ${termoFin('pagamento', tipo)} registrado` : `Ainda sem ${termoFin('pagamento', tipo)}: acompanha o vencimento`}"><span>Data ${pagar ? 'de pagamento' : 'de recebimento'}</span>
                                    <input class="fis-input" type="date" data-data-pagamento-fin ${baixaRecente ? `data-fixa="1" value="${escFin(dia(baixaRecente.data))}"` : `value="${escFin(vencimento)}"`} readonly tabindex="-1"></label>`}
                                <label class="fin-campo"><span>Conta corrente</span>
                                    <select class="fis-input" name="conta_id" data-conta-original="${escFin(base?.conta_id || '')}" ${cancelada ? 'disabled' : ''}>${opcoesContasFin(op.contas, app, base?.conta_id)}</select></label>
                            </div>
                        </div>
                        ${avisos.map(a => `<div class="fis-info">${a}</div>`).join('')}
                        <div class="fis-info" data-aviso-empresa-fin hidden></div>
                        ${rec ? '' : blocoLeitorFin(t, livre)}
                        <div class="fin-abas" role="tablist">
                            ${abas.map(([chave, nome]) => `<button type="button" role="tab" data-aba="${chave}" aria-selected="${chave === aba}" onclick="mostrarAbaFin('${chave}')">${nome}</button>`).join('')}
                        </div>

                        <div class="fin-aba" data-painel-aba="detalhes" ${aba === 'detalhes' ? '' : 'hidden'}>
                            <div class="fin-form-grade fin-grade-detalhes">
                                ${rec ? '' : `<label class="fin-campo"><span>Nº do documento / nota</span><input class="fis-input" name="numero_documento" maxlength="60" value="${escFin(t?.numero_documento || '')}"></label>`}
                                <label class="fin-campo"><span>Forma de pagamento</span><select class="fis-input" name="forma_pagamento"><option value=""></option>${FORMAS_FIN.filter(([v]) => v !== 'OMIE').map(([v, n]) => `<option value="${v}" ${base?.forma_pagamento === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                                <label class="fin-campo"><span>CPF/CNPJ</span><input class="fis-input" name="participante_documento" value="${escFin(base?.participante_documento ? docFormatadoFis(base.participante_documento) : '')}" ${livre ? '' : 'readonly'}></label>
                                <label class="fin-campo fin-campo-pix"><span>Chave Pix</span><input class="fis-input" name="chave_pix" maxlength="140" value="${escFin(base?.chave_pix || '')}" placeholder="CPF, CNPJ, e-mail, telefone ou aleatória"></label>
                                <label class="fin-campo fin-campo-largo"><span>Observações</span><textarea class="fis-input" name="observacao" rows="3">${escFin(base?.observacao || '')}</textarea></label>
                            </div>
                            ${rec ? '' : `
                            <div class="fin-anexos">
                                <div class="fin-anexos-topo">
                                    <span>Anexos</span>
                                    ${cancelada ? '' : `<label class="fin-anexar">${iconeFin('anexo')} Anexar arquivo<input type="file" multiple hidden onchange="anexarFin(this)"></label>`}
                                </div>
                                <div class="fin-anexos-lista" data-anexos-fin></div>
                            </div>`}
                            ${t ? `
                            <div class="fin-registro">
                                <div><span>Inclusão</span>${quando(t.criado_em, t.criado_por)}</div>
                                <div><span>Última alteração</span>${quando(t.atualizado_em, t.atualizado_por)}</div>
                            </div>` : ''}
                        </div>

                        <div class="fin-aba" data-painel-aba="tags" ${aba === 'tags' ? '' : 'hidden'}>
                            ${abaTagsPag(base?.tags, { editavel: !cancelada })}
                        </div>

                        <div class="fin-aba" data-painel-aba="categorias" ${aba === 'categorias' ? '' : 'hidden'}>
                            ${editorCategoriasFin(base?.categorias?.length ? base.categorias
                                : base?.categoria_id ? [{ categoria_id: base.categoria_id, percentual: 100 }] : [{ categoria_id: '', percentual: 100 }], tipo, cancelada)}
                        </div>

                        <div class="fin-aba" data-painel-aba="departamentos" ${aba === 'departamentos' ? '' : 'hidden'}>
                            ${editorRateioFin(op.departamentos, base?.rateio || [], { valorDoFormulario: true })}
                        </div>

                        ${t ? `
                        <div class="fin-aba" data-painel-aba="parcelas" ${aba === 'parcelas' ? '' : 'hidden'}>
                            ${tabelaParcelasFin(t, dados?.irmas || [], tipo)}
                        </div>` : ''}

                        ${nova || (t && !cancelada) ? `
                        <div class="fin-aba" data-painel-aba="repeticoes" ${aba === 'repeticoes' ? '' : 'hidden'}>
                            ${ferramentaRepeticoesFin(t, dados?.irmas || [])}
                        </div>` : ''}

                        ${rec ? `
                        <div class="fin-aba" data-painel-aba="repeticao" ${aba === 'repeticao' ? '' : 'hidden'}>
                            ${blocoRepetirFin(rec, termino)}
                        </div>` : ''}

                        ${t ? `
                        <div class="fin-aba" data-painel-aba="pagamentos" ${aba === 'pagamentos' ? '' : 'hidden'}>
                            ${abaPagamentosFin(t, baixas, pagar, cancelada)}
                        </div>` : ''}

                        ${t && pagar ? `
                        <div class="fin-aba" data-painel-aba="aprovacao" ${aba === 'aprovacao' ? '' : 'hidden'}>
                            ${abaAprovacaoFin(dados?.aprovacao)}
                        </div>` : ''}
                    </div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelFin()" aria-expanded="true"
                            title="Recolher as ações">${iconeFin('seta')}</button>
                        <aside class="fin-painel" data-painel-form-fin></aside>
                    </div>
                </div>
            </section>
        </div>`

    // Favorecido do cadastro: a foto dele no lugar das iniciais (busca depois de desenhar, sem segurar a tela).
    if (base?.cliente_id) {
        const avatar = document.querySelector('[data-avatar-fin]')
        recuperarDado('clientes', base.cliente_id)
            .then(c => { if (avatar.isConnected && document.querySelector('[data-form-fatura]')?.dataset.cliente === String(base.cliente_id)) pintarAvatarFin(avatar, base.participante_nome, c?.foto) })
            .catch(() => { })
    }
    prepararAbaTagsPag(document.querySelector('[data-form-fatura]') || document)
    desenharAnexosFin()
    desenharPainelFormFin(t, rec)
    sincronizarTopoFin()
    const caixa = document.querySelector('[data-form-fatura] [data-parcelas]')
    if (caixa) somarParcelasFin(caixa)
    const bloco = document.querySelector('[data-form-fatura] [data-bloco-repetir]')
    if (bloco) previaRepeticaoFin(bloco)
    // Fatura nova: o cursor já no leitor (o leitor USB "digita" direto nele).
    if (nova) document.querySelector('[data-leitor-entrada]')?.focus()
}

function desenharPainelFormFin(t, rec) {
    const painel = document.querySelector('[data-painel-form-fin]')
    if (!painel) return
    const tipo = document.querySelector('[data-form-fatura]')?.dataset.tipo || tipoFaturasFin
    const pagar = tipo === 'PAGAR'
    const cancelada = t?.situacao === 'CANCELADO'
    const aberta = t && !['PAGO', 'CANCELADO'].includes(t.situacao)
    const comPagamento = Number(t?.pago) > 0
    const podeExcluir = t && ORIGENS_EDITAVEIS_FIN.includes(t.origem) && !cancelada && !comPagamento
    const acao = (icone, texto, funcao, { perigo = false, ativo = true, motivo = '' } = {}) => `
        <button type="button" class="fin-acao${perigo ? ' perigo' : ''}" title="${escFin(ativo ? texto : `${texto}: ${motivo}`)}" ${ativo ? `onclick="${funcao}"` : 'disabled'}>
            ${iconeFin(icone)}<span>${texto}</span></button>`
    painel.innerHTML = `
        ${acao('salvar', 'Salvar', 'salvarFaturaFin()', { ativo: !cancelada, motivo: 'Fatura excluída' })}
        ${acao('incluir', 'Incluir', `formularioFaturaFin('${tipo}')`)}
        ${t ? acao('raio', pagar ? 'Pagar agora' : 'Receber agora', `formularioBaixaRapidaFin('${escFin(t.id)}')`, { ativo: aberta, motivo: cancelada ? 'Fatura excluída' : 'Já está quitada' }) : ''}
        ${rec ? acao('encerrar', 'Encerrar repetição', `encerrarRecorrenciaFin('${escFin(rec.id)}')`, { ativo: rec.ativa, motivo: 'Já encerrada' }) : ''}
        <hr>
        ${t ? acao('cancelar', `Cancelar ${termoFin('pagamento', tipo)}`, `cancelarPagamentosFin('${escFin(t.id)}')`,
            { perigo: true, ativo: comPagamento && !cancelada, motivo: cancelada ? 'Fatura excluída' : `Sem ${termoFin('pagamento', tipo)} para cancelar` }) : ''}
        ${t ? acao('excluir', 'Excluir', `excluirFaturaFin('${escFin(t.id)}', true)`,
            { perigo: true, ativo: podeExcluir, motivo: cancelada ? 'Já excluída' : comPagamento ? `Tem ${termoFin('pagamento', tipo)}: cancele antes` : 'Veio de outra origem' }) : ''}
        ${acao('voltar', 'Voltar à lista', 'voltarFaturasFin()')}`
}

// Empresa trocada no formulário: as contas passam a ser as da empresa escolhida e, numa fatura que já existe,
// o aviso diz o que acontece com os pagamentos ao salvar (vão para a conta escolhida ou a padrão da nova empresa).
function trocarEmpresaFormFin(select) {
    const form = select.closest('[data-form-fatura]')
    const conta = form.querySelector('[name=conta_id]')
    conta.innerHTML = opcoesContasFin(opcoesFinCache.contas, select.value)
    const aviso = form.querySelector('[data-aviso-empresa-fin]')
    const original = select.dataset.appOriginal
    if (!aviso) return
    if (!original || select.value === original) {
        aviso.hidden = true
        if (original) conta.innerHTML = opcoesContasFin(opcoesFinCache.contas, original, conta.dataset.contaOriginal)
        return
    }
    const n = Number(select.dataset.pagamentos) || 0
    const tipo = form.dataset.tipo
    aviso.innerHTML = `Ao salvar, a fatura passa da <b>${escFin(original)}</b> para a <b>${escFin(select.value)}</b>.`
        + (n ? ` ${n === 1 ? `O ${termoFin('pagamento', tipo)} registrado vai` : `Os ${n} ${termoFin('pagamento', tipo)}s registrados vão`} para a conta escolhida acima (ou a padrão da ${escFin(select.value)}).` : '')
    aviso.hidden = false
}

function mostrarAbaFin(chave) {
    const form = document.querySelector('[data-form-fatura]')
    if (!form) return
    form.dataset.abaAtiva = chave
    form.querySelectorAll('.fin-abas [data-aba]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.aba === chave)))
    form.querySelectorAll('[data-painel-aba]').forEach(p => { p.hidden = p.dataset.painelAba !== chave })
}

function voltarFaturasFin() {
    const tipo = document.querySelector('[data-form-fatura]')?.dataset.tipo || tipoFaturasFin
    return telaFaturasFin(tipo, filtroExtraFin, true)
}

// Vencimento e valor do topo valem para a edição da repetição antiga e para a simulação da aba Repetições.
function sincronizarTopoFin() {
    const form = document.querySelector('[data-form-fatura]')
    if (!form) return
    const vencimento = form.querySelector('[name="vencimento"]').value
    const valor = form.querySelector('[name="valor"]').value
    const dataPagamento = form.querySelector('[data-data-pagamento-fin]:not([data-fixa])')
    if (dataPagamento) dataPagamento.value = vencimento
    const bloco = form.querySelector('[data-bloco-repetir]')
    if (bloco) {
        const primeiro = bloco.querySelector('[name="rep_primeiro"]')
        if (!form.dataset.recorrencia) primeiro.value = vencimento
        bloco.querySelector('[name="rep_valor"]').value = valor
        previaRepeticaoFin(bloco)
    }
    simularRepeticoesFin(true)
    // Valor da fatura mudou (27/11/2026, a pedido): departamentos e categorias se repartem na mesma proporção.
    // A linha digitada em R$ vira o % que ela tinha sobre o valor anterior (antes mantinha o R$ e a soma saía de 100%).
    const anterior = Number(form.dataset.valorAnterior) || 0
    const atual = Number(valor) || 0
    if (anterior && atual && Math.abs(anterior - atual) > 0.0001) {
        for (const l of form.querySelectorAll('.fin-rateio-linha[data-modo="valor"]')) {
            const categoria = l.classList.contains('fin-categoria-linha')
            const pct = l.querySelector(categoria ? '[name="percentual_categoria"]' : '[name="percentual"]')
            const val = l.querySelector(categoria ? '[name="valor_categoria"]' : '[name="valor_rateio"]')
            if (pct && val && val.value !== '') pct.value = String(r6Fin((Number(val.value) || 0) * 100 / anterior))
            l.dataset.modo = 'pct'
        }
    }
    if (atual) form.dataset.valorAnterior = String(atual)
    somarCategoriasFin()
    const rateio = form.querySelector('[data-rateio][data-total-formulario]')
    if (rateio) somarRateioFin(rateio)
}

// ---------------- aba Parcelas: as faturas do mesmo grupo (clique abre a parcela)
function tabelaParcelasFin(t, irmas, tipo) {
    const todas = [{ ...t, atual: true }, ...irmas]
        .sort((a, b) => (Number(a.parcela) || 0) - (Number(b.parcela) || 0) || String(a.vencimento).localeCompare(String(b.vencimento)))
    if (todas.length === 1)
        return '<div class="fis-vazio">Esta fatura não tem outras parcelas. Para criar, use a aba <b>Repetições</b>.</div>'
    return `
        <table class="fis-tabela fin-tabela-parcelas">
            <thead><tr><th>Parcela</th><th>Situação</th><th>Vencimento</th><th class="fis-num">Valor</th></tr></thead>
            <tbody>${todas.map(p => `
                <tr class="${p.atual ? 'fin-parcela-atual' : 'fin-parcela-link'}" ${p.atual ? 'title="Esta fatura"' : `title="Abrir esta parcela" onclick="formularioFaturaFin('${tipo}', '${escFin(p.id)}', null, 'parcelas')"`}>
                    <td>${escFin(p.parcela_texto)}</td>
                    <td>${situacaoFin(p.situacao, tipo)}</td>
                    <td>${dataFin(p.vencimento)} <small>${diaSemanaFin(p.vencimento)}</small></td>
                    <td class="fis-num">${dinheiro(p.valor)}</td>
                </tr>`).join('')}
            </tbody>
        </table>`
}

// ---------------- aba Repetições (como "Incluir Repetições" do Omie): cada repetição vira uma fatura do grupo
const PASSOS_REPETICAO_FIN = { SEMANAL: { dias: 7 }, QUINZENAL: { dias: 14 }, MENSAL: { meses: 1 }, BIMESTRAL: { meses: 2 }, TRIMESTRAL: { meses: 3 }, SEMESTRAL: { meses: 6 }, ANUAL: { meses: 12 } }
const UNIDADES_REPETICAO_FIN = { SEMANAL: 'semanas', QUINZENAL: 'quinzenas', MENSAL: 'meses', BIMESTRAL: 'bimestres', TRIMESTRAL: 'trimestres', SEMESTRAL: 'semestres', ANUAL: 'anos' }

const diaSemanaFin = iso => iso ? ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${String(iso).slice(0, 10)}T12:00:00Z`).getUTCDay()] : ''

// Feriados nacionais (lei): fixos + Sexta-feira Santa (Páscoa − 2). Chave AAAA-MM-DD.
const feriadosCacheFin = {}
function feriadosFin(ano) {
    if (feriadosCacheFin[ano]) return feriadosCacheFin[ano]
    // Páscoa (algoritmo de Meeus/Jones/Butcher).
    const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4
    const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451)
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1
    const pascoa = new Date(Date.UTC(ano, mes - 1, dia))
    pascoa.setUTCDate(pascoa.getUTCDate() - 2)
    const fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '11-20', '12-25'].map(md => `${ano}-${md}`)
    return (feriadosCacheFin[ano] = new Set([...fixos, pascoa.toISOString().slice(0, 10)]))
}

// regra: MANTER | ANTECIPAR (dia útil anterior) | POSTERGAR (próximo dia útil).
function ajustarDiaUtilFin(iso, regra) {
    if (regra === 'MANTER') return iso
    const d = new Date(`${iso}T12:00:00Z`)
    const util = () => ![0, 6].includes(d.getUTCDay()) && !feriadosFin(d.getUTCFullYear()).has(d.toISOString().slice(0, 10))
    for (let n = 0; n < 15 && !util(); n++) d.setUTCDate(d.getUTCDate() + (regra === 'ANTECIPAR' ? -1 : 1))
    return d.toISOString().slice(0, 10)
}

// grupo: parcelas que já existem (fatura aberta + irmãs). A repetição parte do último vencimento do grupo.
// Fatura que veio de nota/Omie/lote (21/11/2026: toda fatura se repete): as repetições são manuais (grupo
// REPETE:<id> no servidor) e ela conta como a parcela 1; as irmãs da origem dela não entram na conta.
function ferramentaRepeticoesFin(t, irmas) {
    const grupo = !t ? [] : t.origem === 'MANUAL' ? [t, ...irmas] : [t, ...irmas.filter(p => p.origem === 'MANUAL')]
    const ultimaParcela = t ? Math.max(1, ...grupo.map(p => p.origem === 'MANUAL' ? Number(p.parcela) || 1 : 1)) : 1
    const ultimoVenc = t ? grupo.map(p => String(p.vencimento).slice(0, 10)).sort().at(-1) : ''
    const dia = Number((ultimoVenc || '').slice(8, 10)) || ''
    return `
        <div class="fin-repeticoes" data-repeticoes-fin data-existentes="${t ? grupo.length : 1}" data-ultima="${ultimaParcela}" data-base="${escFin(ultimoVenc)}"
            oninput="simularRepeticoesFin(false, event)" onchange="simularRepeticoesFin(false, event)">
            <div class="fin-rep-cabeca">
                <b>Selecione de que forma deseja gerar as repetições.</b>
                <small>Elas são geradas a partir do vencimento <b data-rep-base>${ultimoVenc ? dataFin(ultimoVenc) : '(informe o vencimento no topo)'}</b>${t ? ` (parcela ${String(ultimaParcela).padStart(3, '0')})` : ''}.</small>
            </div>
            <div class="fin-form-grade fin-rep-grade">
                <label class="fin-campo fin-rep-largo"><span>Quanto aos sábados, domingos e feriados nacionais</span>
                    <select class="fis-input" name="rep_regra">
                        <option value="MANTER">Manter a data de vencimento</option>
                        <option value="ANTECIPAR">Antecipar para o dia útil anterior</option>
                        <option value="POSTERGAR">Postergar para o próximo dia útil</option>
                    </select></label>
                <label class="fin-campo"><span>Periodicidade</span>
                    <select class="fis-input" name="rep_periodo">${FREQUENCIAS_FIN.map(([v, n]) => `<option value="${v}" ${v === 'MENSAL' ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                <label class="fin-campo" data-rep-dia><span>Repetir todo dia</span>
                    <input class="fis-input fis-num" type="number" min="1" max="31" step="1" name="rep_dia" value="${dia}"></label>
                <label class="fin-campo"><span>Por</span>
                    <div class="fin-rep-por"><input class="fis-input fis-num" type="number" min="0" max="120" step="1" name="rep_qtd" value="" placeholder="0"> <small data-rep-unidade>meses</small></div></label>
            </div>
            <div class="fin-rep-simulacao-topo">
                <span><b>Simulação das repetições</b> <small>(dá para mudar o vencimento e o valor direto na linha)</small></span>
                <button type="button" class="fis-mini" onclick="simularRepeticoesFin(true)">Simular</button>
            </div>
            <table class="fis-tabela fin-rep-tabela">
                <thead><tr><th>Parcela</th><th>Vencimento</th><th></th><th class="fis-num">Valor</th></tr></thead>
                <tbody data-simulacao-fin></tbody>
            </table>
            <small class="fis-dica">As repetições viram faturas ao <b>Salvar</b>, com o mesmo ${termoFin('favorecido')}, categorias, departamentos e conta.</small>
        </div>`
}

// Recalcula a simulação (mudou regra, período, dia, quantidade ou o topo). Mudar vencimento/valor
// numa linha da simulação não recalcula (fica o que a pessoa digitou).
function simularRepeticoesFin(forcar = false, evento = null) {
    const caixa = document.querySelector('[data-repeticoes-fin]')
    if (!caixa) return
    const alvo = evento?.target
    if (!forcar && alvo?.closest?.('[data-simulacao-fin]')) return
    const form = caixa.closest('[data-form-fatura]')
    const v = n => caixa.querySelector(`[name="${n}"]`).value
    const periodo = v('rep_periodo')
    const passo = PASSOS_REPETICAO_FIN[periodo]
    caixa.querySelector('[data-rep-dia]').hidden = !passo.meses
    caixa.querySelector('[data-rep-unidade]').textContent = UNIDADES_REPETICAO_FIN[periodo]
    const nova = !form.dataset.id
    const base = nova ? form.querySelector('[name="vencimento"]').value : caixa.dataset.base
    if (nova) caixa.querySelector('[data-rep-base]').textContent = base ? dataFin(base) : '(informe o vencimento no topo)'
    if (nova && base && !v('rep_dia')) caixa.querySelector('[name="rep_dia"]').value = Number(base.slice(8, 10))
    const valor = r2Fin(form.querySelector('[name="valor"]').value || 0)
    const qtd = Math.max(0, Math.min(120, Math.floor(Number(v('rep_qtd')) || 0)))
    const corpo = caixa.querySelector('[data-simulacao-fin]')
    if (!base || !qtd) {
        corpo.innerHTML = `<tr><td colspan="4" class="fin-vazio">${!base ? 'Informe o vencimento no topo.' : 'Informe por quantos períodos repetir.'}</td></tr>`
        return
    }
    const existentes = Number(caixa.dataset.existentes) || 1
    const ultima = Number(caixa.dataset.ultima) || 1
    const total = existentes + qtd
    const pad = n => String(n).padStart(3, '0')
    const dia = Math.max(1, Math.min(31, Number(v('rep_dia')) || Number(base.slice(8, 10))))
    const linhas = []
    for (let k = 1; k <= qtd; k++) {
        let iso
        if (passo.dias) {
            const d = new Date(`${base}T12:00:00Z`)
            d.setUTCDate(d.getUTCDate() + passo.dias * k)
            iso = d.toISOString().slice(0, 10)
        } else {
            const [a, m] = base.split('-').map(Number)
            const alvoMes = new Date(Date.UTC(a, m - 1 + passo.meses * k, 1))
            const ultimoDia = new Date(Date.UTC(alvoMes.getUTCFullYear(), alvoMes.getUTCMonth() + 1, 0)).getUTCDate()
            alvoMes.setUTCDate(Math.min(dia, ultimoDia))
            iso = alvoMes.toISOString().slice(0, 10)
        }
        iso = ajustarDiaUtilFin(iso, v('rep_regra'))
        linhas.push(`
            <tr>
                <td>${pad(ultima + k)}/${pad(total)}</td>
                <td><input class="fis-input fin-rep-input" type="date" name="rep_vencimento" value="${iso}" oninput="this.closest('tr').querySelector('[data-dia-semana]').textContent = diaSemanaFin(this.value)"></td>
                <td data-dia-semana>${diaSemanaFin(iso)}</td>
                <td class="fis-num"><input class="fis-input fis-num fin-rep-input" type="number" min="0.01" step="0.01" name="rep_valor_linha" value="${valor || ''}"></td>
            </tr>`)
    }
    corpo.innerHTML = linhas.join('')
}

const lerRepeticoesFin = form => [...form.querySelectorAll('[data-simulacao-fin] tr')]
    .map(tr => ({ vencimento: tr.querySelector('[name="rep_vencimento"]')?.value, valor: r2Fin(tr.querySelector('[name="rep_valor_linha"]')?.value || 0) }))
    .filter(p => p.vencimento)

// ---------------- categorias (aba): rateio em % ou em R$ sobre o valor do topo (21/11/2026, a pedido: digitou o
// valor, o % se ajusta; digitou o %, o valor se ajusta; mudou o Valor da fatura, a linha em R$ mantém o valor).
function editorCategoriasFin(lista, tipo, travado = false) {
    return `
        <div class="fin-rateio fin-rateio-categorias" data-categorias-fin data-tipo="${tipo}">
            <div class="fin-parcelas-topo"><b>Categorias *</b> <small>uma só = 100%; várias = rateio em % ou em R$ sobre o valor (tem que somar 100%)</small></div>
            <div data-linhas-categorias>${lista.map(c => linhaCategoriaFin(c, tipo, travado)).join('')}</div>
            <div class="fin-parcelas-rodape">
                ${travado ? '<span></span>' : '<button type="button" class="fis-mini" onclick="adicionarCategoriaFin()">+ Categoria</button>'}
                <span data-soma-categorias></span>
            </div>
        </div>`
}

// Categoria com busca (21/11/2026, a pedido): lista FECHADA como o departamento; o texto só busca, a categoria
// só entra clicando num item (data-valor). Saiu sem escolher, volta para a que estava.
const categoriaFinPorId = id => (opcoesFinCache?.categorias || []).find(c => String(c.id) === String(id ?? ''))
const rotuloCatFin = c => c ? `${c.codigo} · ${c.nome}${c.excluida ? ' (excluída)' : ''}` : ''
// Categoria da fatura que não veio na lista: fica com o id (27/11/2026), em vez de a linha abrir vazia.
const rotuloCatIdFin = id => { const c = categoriaFinPorId(id); return c ? rotuloCatFin(c) : id != null && id !== '' ? `Categoria nº ${id}` : '' }
const aceitaCatFin = (c, tipo) => !c.grupo && (tipo === 'PAGAR' ? c.tipo !== 'RECEITA' : c.tipo !== 'DESPESA')

function buscarCatFin(input) {
    const caixa = input.closest('.fin-escolha')
    const lista = caixa.querySelector('.fin-escolha-lista')
    const tipo = input.closest('[data-categorias-fin]')?.dataset.tipo
    const termo = normalFin(input.value)
    const filtro = termo && termo !== normalFin(rotuloCatIdFin(caixa.dataset.valor)) ? termo : ''
    const achados = (opcoesFinCache?.categorias || [])
        .filter(c => aceitaCatFin(c, tipo))
        .filter(c => !filtro || normalFin(`${c.codigo} ${c.nome} ${c.grupo_codigo || ''} ${c.grupo_nome || ''}`).includes(filtro))
        .slice(0, 60)
    let grupoAnterior = null
    lista.innerHTML = achados.map(c => {
        const g = c.grupo_nome ? `${c.grupo_codigo || ''} ${c.grupo_nome}`.trim() : 'Sem grupo'
        const cab = g !== grupoAnterior ? `<div class="fin-escolha-grupo">${escFin(g)}</div>` : ''
        grupoAnterior = g
        return `${cab}
        <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); escolherCatFin(this, '${escFin(c.id)}')">
            <b>${escFin(c.codigo)}</b> <span>${escFin(c.nome)}${c.excluida ? ' (excluída)' : ''}</span>
        </button>`
    }).join('') || '<div class="fin-escolha-vazio">Nada encontrado: só categorias da lista.</div>'
    lista.hidden = false
}

function escolherCatFin(botao, id) {
    const caixa = botao.closest('.fin-escolha')
    caixa.dataset.valor = id
    caixa.querySelector('input').value = rotuloCatFin(categoriaFinPorId(id))
    caixa.querySelector('.fin-escolha-lista').hidden = true
    caixa.classList.remove('invalido')
    somarCategoriasFin()
}

function fecharBuscaCatFin(input) {
    const caixa = input.closest('.fin-escolha')
    if (!caixa) return
    caixa.querySelector('.fin-escolha-lista').hidden = true
    input.value = rotuloCatIdFin(caixa.dataset.valor)
}

function linhaCategoriaFin(c, tipo, travado = false) {
    const trava = travado ? 'disabled' : ''
    const id = c.categoria_id == null ? '' : String(c.categoria_id)
    return `
        <div class="fin-rateio-linha fin-categoria-linha" data-modo="pct">
            <div class="fin-escolha" data-categoria-escolha data-valor="${escFin(id)}">
                <input class="fis-input" name="categoria_busca" value="${escFin(rotuloCatIdFin(id))}" placeholder="Buscar código ou nome da categoria…" autocomplete="off" ${trava}
                    onfocus="this.select(); buscarCatFin(this)" oninput="buscarCatFin(this)" onblur="setTimeout(() => fecharBuscaCatFin(this), 150)">
                <div class="fin-escolha-lista" hidden></div>
            </div>
            <input class="fis-input fis-num" type="number" min="0" max="100" step="any" name="percentual_categoria" value="${c.percentual ?? ''}" ${trava} oninput="editarCategoriaFin(this, 'pct')"> %
            <input class="fis-input fis-num" type="number" min="0" step="0.01" name="valor_categoria" placeholder="R$" ${trava} oninput="editarCategoriaFin(this, 'valor')">
            ${travado ? '' : `<button type="button" class="fis-remover-linha" title="Tirar categoria" aria-label="Tirar categoria" onclick="removerCategoriaFin(this)">${iconeLixeiraFis}</button>`}
        </div>`
}

function editarCategoriaFin(input, modo) {
    input.closest('.fin-categoria-linha').dataset.modo = modo
    somarCategoriasFin()
}

// Nova linha já com o que falta para 100%.
function adicionarCategoriaFin() {
    const caixa = document.querySelector('[data-categorias-fin]')
    if (!caixa) return
    const falta = r2Fin(100 - lerCategoriasFin(caixa, false).reduce((a, c) => a + c.percentual, 0))
    caixa.querySelector('[data-linhas-categorias]').insertAdjacentHTML('beforeend',
        linhaCategoriaFin({ categoria_id: '', percentual: falta > 0 ? falta : '' }, caixa.dataset.tipo))
    somarCategoriasFin()
}

function removerCategoriaFin(botao) {
    const linhas = botao.closest('[data-linhas-categorias]')
    if (linhas.children.length === 1) {
        const caixa = linhas.querySelector('[data-categoria-escolha]')
        caixa.dataset.valor = ''
        caixa.querySelector('input').value = ''
        linhas.querySelector('[name="percentual_categoria"]').value = 100
    } else botao.closest('.fin-categoria-linha').remove()
    somarCategoriasFin()
}

// soUmaVale100: com uma linha só, ela vale 100% (o campo de % pode estar vazio ou diferente).
function lerCategoriasFin(raiz, soUmaVale100 = true) {
    const linhas = [...raiz.querySelectorAll('.fin-categoria-linha')]
    const total = Number(document.querySelector('[data-form-fatura] [name="valor"]')?.value) || 0
    // Linha guiada pelo R$: o % sai do valor (6 casas); o resíduo do arredondamento vai para a maior (soma 100 exata).
    const lista = linhas.map(l => {
        const valor = Number(l.querySelector('[name="valor_categoria"]')?.value) || 0
        const percentual = l.dataset.modo === 'valor' && total ? valor * 100 / total : Number(l.querySelector('[name="percentual_categoria"]').value) || 0
        return { categoria_id: l.querySelector('[data-categoria-escolha]').dataset.valor || '', percentual: r6Fin(percentual) }
    })
    if (soUmaVale100 && linhas.length === 1) lista[0].percentual = 100
    const r = lista.filter(c => c.categoria_id !== '').map(c => ({ ...c, categoria_id: Number(c.categoria_id) || c.categoria_id }))
    const soma = r.reduce((a, c) => a + c.percentual, 0)
    if (r.length > 1 && Math.abs(100 - soma) < 0.001) {
        const maior = r.reduce((a, c) => c.percentual > a.percentual ? c : a)
        maior.percentual = r6Fin(maior.percentual + 100 - soma)
    }
    return r
}

function somarCategoriasFin() {
    const caixa = document.querySelector('[data-categorias-fin]')
    if (!caixa) return
    const valor = Number(document.querySelector('[data-form-fatura] [name="valor"]')?.value) || 0
    const linhas = [...caixa.querySelectorAll('.fin-categoria-linha')]
    const uma = linhas.length === 1
    const ativo = document.activeElement
    let soma = 0
    for (const l of linhas) {
        const campo = l.querySelector('[name="percentual_categoria"]')
        const emReais = l.querySelector('[name="valor_categoria"]')
        if (uma) { campo.value = 100; l.dataset.modo = 'pct' }
        campo.readOnly = uma
        emReais.readOnly = uma
        if (l.dataset.modo === 'valor') {
            if (campo !== ativo) campo.value = emReais.value === '' ? '' : valor ? pctCampoFin((Number(emReais.value) || 0) * 100 / valor) : ''
        } else if (emReais !== ativo) {
            emReais.value = campo.value === '' || !valor ? '' : r2Fin(valor * (Number(campo.value) || 0) / 100).toFixed(2)
        }
        soma += Number(campo.value) || 0
    }
    soma = r2Fin(soma)
    const alvo = caixa.querySelector('[data-soma-categorias]')
    const confere = Math.abs(soma - 100) <= 0.01
    alvo.className = confere ? 'fis-positivo' : 'fis-negativo'
    alvo.textContent = uma ? '' : `Soma ${soma.toLocaleString('pt-BR')}%${confere ? ' ✓' : soma < 100 ? ` · falta ${r2Fin(100 - soma).toLocaleString('pt-BR')}%` : ` · passou ${r2Fin(soma - 100).toLocaleString('pt-BR')}%`}`
}

// ---------------- favorecido: cxOpcoes na tabela clientes (o mesmo seletor do sistema), com "Cadastrar" no cabeçalho
function abrirFavorecidosFin() {
    controlesCxOpcoes.favorecido_fin = {
        base: 'clientes',
        // Sem ordem forçada (o cxOpcoes ordenaria por nome): fica a ordem nativa do servidor, como no Recebedor.
        ordenar: null,
        retornar: ['nome'],
        funcaoAdicional: ['favorecidoEscolhidoFin'],
        btnExtras: `<button type="button" class="botao-cabecalho-tabela" onclick="formularioCliente()">+ Cadastrar</button>`,
        colunas: {
            'Nome': { chave: 'nome', alinhar: 'esquerda' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' }
        }
    }
    return cxOpcoes('favorecido_fin')
}

// Quadro do favorecido: a foto do cadastro (clientes.foto, arquivo em /uploads ou URL); sem foto, ou se a
// imagem não carregar, as iniciais do nome.
function pintarAvatarFin(el, nome, foto) {
    if (!el) return
    const iniciais = iniciaisFin(nome)
    if (!foto) {
        el.classList.remove('com-foto')
        el.textContent = iniciais
        return
    }
    const img = document.createElement('img')
    img.alt = ''
    img.src = /^https?:\/\//i.test(foto) ? foto : `${api}/uploads/${foto}`
    img.onerror = () => { el.classList.remove('com-foto'); el.textContent = iniciais }
    el.classList.add('com-foto')
    el.replaceChildren(img)
}

// Corrente ao lado de Favorecido / Cliente: abre o cadastro escolhido.
function abrirCadastroFavorecidoFin(event) {
    event?.stopPropagation()
    const form = document.querySelector('[data-form-fatura]')
    const id = form?.querySelector('[name="favorecido_fin"]')?.id || form?.dataset.cliente
    if (id) formularioCliente(Number(id) || id)
}

// Depois de escolher na lista (o cxOpcoes já pôs o nome e o id no span): CPF/CNPJ, chave Pix e iniciais.
async function favorecidoEscolhidoFin() {
    const form = document.querySelector('[data-form-fatura]')
    const span = form?.querySelector('[name="favorecido_fin"]')
    if (!span?.id) return removerOverlay()
    const id = span.id
    let cliente = {}
    try { cliente = await recuperarDado('clientes', id) || {} } catch { }
    removerOverlay()
    if (span.id !== id) return
    const campo = n => form.querySelector(`[name="${n}"]`)
    const nome = cliente.nome || span.textContent.trim()
    campo('participante_nome').value = nome
    campo('participante_documento').value = cliente.cnpj || ''
    if (cliente.chave_pix) campo('chave_pix').value = cliente.chave_pix
    form.dataset.cliente = id
    form.querySelector('[data-vinculo-fin]').hidden = false
    pintarAvatarFin(form.querySelector('[data-avatar-fin]'), nome, cliente.foto)
}

// ---------------- anexos (aba Detalhes): sobem na hora pelo /upload e ficam na fatura ao salvar
function desenharAnexosFin() {
    const alvo = document.querySelector('[data-anexos-fin]')
    if (!alvo) return
    const cancelada = !document.querySelector('.fin-anexar')
    alvo.innerHTML = anexosFormFin.length
        ? anexosFormFin.map((a, i) => criarAnexoVisual(a.nome || a.link, a.link, cancelada ? null : `removerAnexoFin(${i})`)).join('')
        : '<small class="fin-vazio">Nenhum anexo.</small>'
}

async function anexarFin(input) {
    if (!input.files?.length) return
    overlayAguarde()
    const enviados = await importarAnexos({ input })
    removerOverlay()
    input.value = ''
    if (!Array.isArray(enviados)) return
    for (const a of enviados) if (a?.link) anexosFormFin.push({ nome: a.nome || a.link, link: a.link })
    desenharAnexosFin()
}

function removerAnexoFin(i) {
    anexosFormFin.splice(i, 1)
    desenharAnexosFin()
}

// Aba Aprovação da fatura a pagar (27/11/2026, a pedido): o histórico de aprovação do reembolso que a gerou, em
// ordem do mais antigo ao mais novo, com os balões do detalhe do pagamento (cor pelo status) e as autorizações
// de setor. Fatura sem reembolso (manual, nota, lote...) ou título do Omie sem aprovação no GCS: avisa.
function abaAprovacaoFin(ap) {
    if (!ap) return '<div class="fis-vazio">Esta fatura não veio de um reembolso: não há aprovação para mostrar.</div>'
    const quando = s => {
        const m = String(s || '').match(/(\d{2})\/(\d{2})\/(\d{4})\D*(\d{2})?:?(\d{2})?:?(\d{2})?/)
        return m ? new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime() : 0
    }
    const cor = h => typeof imagemEspecifica === 'function' ? imagemEspecifica(h).cor : '#222'
    const historico = Object.values(ap.historico || {})
        .filter(h => h && typeof h === 'object')
        .sort((a, b) => quando(a.data) - quando(b.data))
    const autorizacoes = (Array.isArray(ap.distribuicao) ? ap.distribuicao : [])
        .map(d => d?.autorizacao).filter(a => a?.aprovado_por)
    const balao = (status, quem, data, texto, c) => `
        <div class="pagamento-detalhe-aprovacao" style="--cor: ${c}">
            <div><b>${escFin(status || '')}</b><small>${escFin([quem, data].filter(Boolean).join(' · '))}</small></div>
            ${String(texto || '').trim() ? `<p>${escFin(texto)}</p>` : ''}
        </div>`
    const baloes = [
        ...historico.map(h => balao(h.status, h.usuario, h.data, h.justificativa, cor(h))),
        ...autorizacoes.map(a => balao('Autorização do setor', a.aprovado_por,
            a.aprovado_em ? new Date(a.aprovado_em).toLocaleString('pt-BR') : '', a.comentario, '#4CAF50'))
    ].join('')
    const vazio = ap.criado === 'Integração'
        ? 'Reembolso importado do Omie: a aprovação foi feita lá e não há histórico no GCS.'
        : 'Nenhuma aprovação registrada neste reembolso.'
    // Só a lista do histórico, sem resumo nem botões (27/11, a pedido).
    return baloes ? `<div class="fin-aprovacao-lista">${baloes}</div>` : `<div class="fis-vazio">${vazio}</div>`
}

// Aba Pagamentos da fatura: lista dos pagamentos à esquerda, totais e os botões Registrar / Cancelar à direita.
// "Pagar agora" (painel) é o atalho rápido; aqui ficam o pagamento parcial e os detalhes (desconto, juros, multa...).
function abaPagamentosFin(t, baixas, pagar, cancelada) {
    const vivas = baixas.filter(b => !b.estornada)
    const soma = campo => vivas.reduce((s, b) => s + Number(b[campo] || 0), 0)
    const pago = vivas.reduce((s, b) => s + Number(b.valor) + Number(b.juros) + Number(b.multa) - Number(b.desconto), 0)
    const aberta = !['PAGO', 'CANCELADO'].includes(t.situacao)
    const id = escFin(t.id)
    const pg = pagar ? 'pagamento' : 'recebimento'
    const total = (rotulo, valor, forte = false) => `
        <label class="fis-campo"><span>${rotulo}</span><div class="fin-pag-total ${forte ? 'forte' : ''}">${dinheiro(valor)}</div></label>`
    return `
        <div class="fin-pagamentos">
            <div class="fin-pagamentos-lista">
                <span class="fin-pagamentos-rotulo">${pagar ? 'Pagamentos' : 'Recebimentos'} realizados</span>
                ${baixas.length ? `
                <div class="fis-tabela-rolagem">
                    <table class="fis-tabela">
                        <thead><tr><th>Data</th><th>Conta</th><th>Forma</th><th class="fis-num">Abate</th><th class="fis-num">Desconto</th><th class="fis-num">Juros/multa</th><th class="fis-num">Total ${pagar ? 'pago' : 'recebido'}</th><th>Comprovante</th><th>Por</th><th></th></tr></thead>
                        <tbody>${baixas.map(b => `
                            <tr class="${b.estornada ? 'fis-estornado' : ''}" title="${escFin(b.observacao || '')}">
                                <td>${dataFin(b.data)}</td>
                                <td>${escFin(b.conta)}</td>
                                <td>${escFin(nomeFormaFin(b.forma))}</td>
                                <td class="fis-num">${dinheiro(b.valor)}</td>
                                <td class="fis-num">${Number(b.desconto) ? dinheiro(b.desconto) : ''}</td>
                                <td class="fis-num">${Number(b.juros) + Number(b.multa) ? dinheiro(Number(b.juros) + Number(b.multa)) : ''}</td>
                                <td class="fis-num"><b>${dinheiro(Number(b.valor) + Number(b.juros) + Number(b.multa) - Number(b.desconto))}</b></td>
                                <td>${celulaComprovanteBaixaFin(b, t.id)}</td>
                                <td><small>${escFin(b.criado_por || '')}${b.estornada ? ` · desfeito${b.estorno_motivo ? `: ${escFin(b.estorno_motivo)}` : ''}` : ''}</small></td>
                                <td>${b.estornada ? '' : `<button type="button" class="fis-mini" onclick="estornarBaixaFin('${escFin(b.id)}', '${id}')">Desfazer</button>`}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>` : `<div class="fis-vazio">Nenhum ${pg} registrado.</div>`}
            </div>
            <div class="fin-pagamentos-totais">
                ${total(`Total já ${pagar ? 'pago' : 'recebido'} da fatura`, pago)}
                ${total('Total de descontos e abatimentos', soma('desconto'))}
                ${total('Total de juros, multas e acréscimos', soma('juros') + soma('multa'))}
                ${total(`A ${pagar ? 'pagar' : 'receber'} da fatura`, t.saldo, true)}
            </div>
        </div>
        <div class="fis-acoes-claras fin-pagamentos-acoes">
            <button type="button" class="fis-mini" ${vivas.length && !cancelada ? '' : 'disabled'} onclick="cancelarPagamentosFin('${id}')">Cancelar ${pg}</button>
            <button type="button" class="fis-botao" ${aberta ? '' : 'disabled'} title="${aberta ? '' : cancelada ? 'Fatura excluída' : 'Já está quitada'}" onclick="formularioBaixaFin('${id}')">Registrar ${pg}</button>
        </div>`
}

// Depois de pagar/cancelar/desfazer: com o formulário dessa fatura aberto, recarrega ele (na mesma aba);
// senão, abre a janela da fatura como antes (se pedido).
function posAcaoFaturaFin(id, abrir = true) {
    const form = document.querySelector('[data-form-fatura]')
    if (form && form.dataset.id === String(id)) return formularioFaturaFin(form.dataset.tipo, id, null, form.dataset.abaAtiva)
    if (abrir) abrirFaturaFin(id)
}

function blocoRepetirFin(rec, termino) {
    const data = v => v ? String(v).slice(0, 10) : ''
    return `
        <div class="fin-repetir" data-bloco-repetir ${rec ? '' : 'hidden'} oninput="previaRepeticaoFin(this)" onchange="previaRepeticaoFin(this)">
            <div class="fis-grade">
                <label class="fis-campo"><span>Valor de cada fatura *</span><input class="fis-input" type="number" step="0.01" min="0.01" name="rep_valor" value="${rec ? r2Fin(rec.valor) : ''}"></label>
                <label class="fis-campo"><span>1º vencimento *</span><input class="fis-input" type="date" name="rep_primeiro" value="${escFin(data(rec?.primeiro_vencimento))}" ${rec ? 'disabled' : ''}></label>
                <label class="fis-campo"><span>Repete</span><select class="fis-input" name="rep_frequencia" ${rec ? 'disabled' : ''}>${FREQUENCIAS_FIN.map(([v, n]) => `<option value="${v}" ${(rec?.frequencia || 'MENSAL') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
            </div>
            <div class="fis-grade">
                <label class="fis-campo"><span>Termina</span><select class="fis-input" name="rep_termino">
                    <option value="NUNCA" ${termino === 'NUNCA' ? 'selected' : ''}>Nunca (mantém os próximos 3 meses lançados)</option>
                    <option value="VEZES" ${termino === 'VEZES' ? 'selected' : ''}>Depois de N vezes</option>
                    <option value="DATA" ${termino === 'DATA' ? 'selected' : ''}>Numa data</option>
                </select></label>
                <label class="fis-campo" data-se-termino="VEZES"><span>Quantas vezes</span><input class="fis-input" type="number" min="1" max="240" step="1" name="rep_vezes" value="${rec?.ocorrencias || 12}"></label>
                <label class="fis-campo" data-se-termino="DATA"><span>Último vencimento até</span><input class="fis-input" type="date" name="rep_termina" value="${escFin(data(rec?.termina_em))}"></label>
            </div>
            <small class="fis-dica" data-previa-repeticao></small>
        </div>`
}

function previaRepeticaoFin(el) {
    const bloco = el.closest?.('[data-bloco-repetir]') || el
    const v = n => bloco.querySelector(`[name="${n}"]`).value
    const termino = v('rep_termino')
    bloco.querySelectorAll('[data-se-termino]').forEach(c => { c.hidden = c.dataset.seTermino !== termino })
    const alvo = bloco.querySelector('[data-previa-repeticao]')
    const primeiro = v('rep_primeiro')
    if (!primeiro) { alvo.textContent = 'Informe o 1º vencimento.'; return }
    const passo = { SEMANAL: [7, 0], QUINZENAL: [14, 0], MENSAL: [0, 1], BIMESTRAL: [0, 2], TRIMESTRAL: [0, 3], SEMESTRAL: [0, 6], ANUAL: [0, 12] }[v('rep_frequencia')]
    const data = n => {
        if (passo[1]) return somaMesesFin(primeiro, passo[1] * n)
        const d = new Date(`${primeiro}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + passo[0] * n); return d.toISOString().slice(0, 10)
    }
    const datas = Array.from({ length: 4 }, (_, n) => dataFin(data(n)))
    const fimTexto = termino === 'VEZES' ? `, ${Math.max(1, Number(v('rep_vezes')) || 1)} vezes no total`
        : termino === 'DATA' && v('rep_termina') ? `, até ${dataFin(v('rep_termina'))}` : ', sem data para acabar'
    alvo.textContent = `Vencimentos: ${datas.join(', ')}…${fimTexto}.`
}

async function salvarFaturaFin() {
    const form = document.querySelector('[data-form-fatura]')
    if (!form) return
    const v = n => form.querySelector(`[name="${n}"]`)?.value ?? ''
    const corpo = {
        id: form.dataset.id || undefined, tipo: form.dataset.tipo, app: v('app') || undefined,
        participante_nome: v('participante_nome'), participante_documento: v('participante_documento'), cliente_id: form.dataset.cliente || null,
        numero_documento: v('numero_documento'),
        conta_id: v('conta_id') || null, forma_pagamento: v('forma_pagamento'), observacao: v('observacao'),
        chave_pix: v('chave_pix'), anexos: anexosFormFin, rateio: lerRateioFin(form),
        tags: lerTagsPag(form.querySelector('.tags-pag-aba .tags-pag')),
        // Boleto / Pix lido (js/financeiro_leitor.js); sem o campo no formulário, o servidor não mexe.
        ...(form.querySelector('[name="codigo_barras"]') ? { codigo_barras: v('codigo_barras'), pix_copia_cola: v('pix_copia_cola') } : {})
    }
    // Categorias (aba): uma = 100%; várias têm que somar 100%. A principal (maior %) vai também em categoria_id.
    const categorias = lerCategoriasFin(form)
    if (!categorias.length) {
        mostrarAbaFin('categorias')
        return popup({ mensagem: 'Escolha a categoria na aba <b>Categorias</b>.' })
    }
    const somaCategorias = r2Fin(categorias.reduce((a, c) => a + c.percentual, 0))
    if (Math.abs(somaCategorias - 100) > 0.01) {
        mostrarAbaFin('categorias')
        return popup({ mensagem: `O rateio das categorias soma ${somaCategorias}%: tem que dar 100%.` })
    }
    corpo.categorias = categorias
    corpo.categoria_id = categorias.reduce((a, c) => c.percentual > a.percentual ? c : a).categoria_id
    const recorrenciaId = form.dataset.recorrencia || null
    const repetir = Boolean(recorrenciaId)
    const repeticoes = lerRepeticoesFin(form)
    if (repeticoes.some(p => !(p.valor > 0))) {
        mostrarAbaFin('repeticoes')
        return popup({ mensagem: 'Toda repetição precisa de um valor maior que zero.' })
    }
    let rota = 'titulo/salvar'
    if (repetir) {
        rota = 'recorrencia/salvar'
        Object.assign(corpo, {
            id: recorrenciaId || undefined, valor: v('valor'), primeiro_vencimento: v('vencimento'), frequencia: v('rep_frequencia'),
            termino: v('rep_termino'), ocorrencias: v('rep_vezes'), termina_em: v('rep_termina')
        })
        if (recorrenciaId) {
            const r = (await apiFin('recorrencia', { id: recorrenciaId })).recorrencia
            Object.assign(corpo, { app: r.app, tipo: r.tipo, primeiro_vencimento: String(r.primeiro_vencimento).slice(0, 10), frequencia: r.frequencia })
        }
    } else if (form.dataset.id) Object.assign(corpo, { vencimento: v('vencimento'), valor: v('valor') })
    else {
        if (!v('vencimento') || !(Number(v('valor')) > 0)) return popup({ mensagem: 'Informe o vencimento e o valor.' })
        // A do topo é a 1ª; as da aba Repetições viram as seguintes (mesmo grupo: 001/004, 002/004...).
        corpo.parcelas = [{ vencimento: v('vencimento'), valor: r2Fin(v('valor')) }, ...repeticoes]
    }
    try {
        overlayAguarde()
        const r = await apiFin(rota, corpo)
        // Fatura que já existia + repetições simuladas: cria as novas parcelas do grupo.
        const repetidas = corpo.id && !repetir && repeticoes.length
            ? (await apiFin('titulo/repetir', { id: corpo.id, repeticoes })).ids?.length || 0 : 0
        removerOverlay()
        if (repetir) {
            const partes = [r.criadas ? `${r.criadas} fatura(s) lançada(s)` : '', r.atualizadas ? `${r.atualizadas} futura(s) atualizada(s)` : '', r.canceladas ? `${r.canceladas} cancelada(s) pelo novo término` : ''].filter(Boolean)
            popup({ mensagem: `Repetição salva${partes.length ? `: ${partes.join(', ')}` : ''}.`, imagem: 'imagens/concluido.png', tempo: 4 })
        } else {
            const n = r.ids?.length || 1
            const troca = r.empresa_trocada
            const textoTroca = troca ? ` Empresa: ${escFin(troca.de)} → ${escFin(troca.para)}${troca.pagamentos ? ` (${troca.pagamentos} ${termoFin('pagamento', corpo.tipo)}(s) mudaram de conta)` : ''}.` : ''
            popup({ mensagem: corpo.id ? `Fatura salva${repetidas ? ` e ${repetidas} repetição(ões) criada(s)` : ''}.${textoTroca}` : `${n > 1 ? `${n} faturas lançadas` : 'Fatura lançada'}.`, imagem: 'imagens/concluido.png', tempo: troca ? 5 : 3 })
        }
        voltarFaturasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- repetições

async function telaRecorrenciasFin(tipo) {
    overlayAguarde()
    try {
        const { recorrencias } = await apiFin('recorrencias', { tipo })
        removerOverlay()
        const anterior = document.querySelector('[data-recorrencias-fin]')?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        popup({
            titulo: `Faturas que se repetem · a ${tipo === 'PAGAR' ? 'pagar' : 'receber'}`,
            elemento: `
                <div class="fis-painel" data-recorrencias-fin>
                    <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="formularioFaturaFin('${tipo}', null, null, 'repeticoes')">+ Repetição</button></div>
                    ${recorrencias.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>${tipo === 'PAGAR' ? 'Fornecedor' : 'Cliente'}</th><th>Observação</th><th>Empresa</th><th>Repete</th><th class="fis-num">Valor</th><th>Próximo</th><th>Lançadas</th><th>Termina</th><th></th></tr></thead>
                            <tbody>${recorrencias.map(r => `
                                <tr class="${r.ativa ? '' : 'fis-estornado'}">
                                    <td class="fis-descricao">${escFin(r.participante_nome || '—')}</td>
                                    <td>${escFin(r.observacao || '')}<small class="fin-sub">${escFin(r.categoria || '')}</small></td>
                                    <td>${escFin(r.app)}</td>
                                    <td>${escFin(nomeFrequenciaFin(r.frequencia))}</td>
                                    <td class="fis-num">${dinheiro(r.valor)}</td>
                                    <td>${r.proximo_vencimento ? dataFin(r.proximo_vencimento) : '—'}</td>
                                    <td>${Number(r.geradas || 0)} <small>(${Number(r.pagas || 0)} ${termoFin('pagas', tipo)})</small></td>
                                    <td>${!r.ativa ? `Encerrada ${r.encerrada_em ? dataFin(new Date(r.encerrada_em).toISOString()) : ''}` : r.ocorrencias ? `${r.ocorrencias} vezes` : r.termina_em ? dataFin(r.termina_em) : 'Nunca'}</td>
                                    <td>${r.ativa ? `
                                        <button type="button" class="fis-mini" onclick="formularioFaturaFin('${r.tipo}', null, '${escFin(r.id)}')">Editar</button>
                                        <button type="button" class="fis-mini" onclick="encerrarRecorrenciaFin('${escFin(r.id)}', '${r.tipo}')">Encerrar</button>` : ''}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : '<div class="fis-vazio">Nenhuma fatura que se repete ainda. Em "+ Fatura", marque "Repetir esta fatura".</div>'}
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function encerrarRecorrenciaFin(id, tipo) {
    const ok = await confirmarPopup({
        titulo: 'Encerrar repetição',
        mensagem: `Para de lançar novas faturas e cancela as futuras que ainda não têm ${termoFin('pagamento', tipo)}. As vencidas e as ${termoFin('pagas', tipo)} ficam.`,
        textoConfirmar: 'Encerrar'
    })
    if (!ok) return
    try {
        overlayAguarde()
        const r = await apiFin('recorrencia/encerrar', { id, motivo: 'Encerrada pelo usuário' })
        removerOverlay()
        popup({ mensagem: `Repetição encerrada: ${r.canceladas} fatura(s) futura(s) cancelada(s).`, imagem: 'imagens/concluido.png', tempo: 4 })
        if (tipo) telaRecorrenciasFin(tipo)
        document.querySelectorAll('[data-fatura-fin]').forEach(p => removerPopup(p.closest('.popup')?.id))
        if (controles.faturasFin) { paginacao('faturasFin'); totaisFaturasFin() }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Registrar pagamento (aba Pagamentos da fatura): o completo, com pagamento parcial, desconto, juros, multa,
// abatimento e acréscimo. "Valor da fatura" já vem com o que falta e é o que abate da fatura; o "Valor pago"
// (o que saiu/entrou de fato na conta) é calculado: valor + juros + multa + acréscimo − desconto − abatimento.
// Abatimento grava como desconto e acréscimo como juros.
async function formularioBaixaFin(id) {
    let op, t
    try {
        overlayAguarde()
        ;[op, { titulo: t }] = await Promise.all([carregarOpcoesFin(), apiFin('titulo', { id })])
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const pagar = t.tipo === 'PAGAR'
    const pg = pagar ? 'pagamento' : 'recebimento'
    const contas = op.contas.filter(k => contaAceitaFin(k, t.app))
    const padrao = t.conta_id || contaPadraoAppFin(contas, t.app)?.id
    const num = (nome, rotulo, valor = 0, dica = '') => `
        <label class="fis-campo"><span>${rotulo}${dica ? ` <small title="${dica}">ⓘ</small>` : ''}</span>
            <input class="fis-input fis-num" type="number" step="0.01" min="0" name="${nome}" value="${valor}" oninput="previaBaixaFin(this)"></label>`
    popup({
        titulo: `Registrar ${pg}`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-baixa data-id="${escFin(t.id)}" data-saldo="${r2Fin(t.saldo)}" data-pagar="${pagar ? 1 : ''}">
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Conta corrente *</span><select class="fis-input" name="conta_id">
                            ${contas.length ? contas.map(k => `<option value="${k.id}" ${k.id === padrao ? 'selected' : ''}>${escFin(k.app !== t.app ? `${k.app} · ${k.nome}` : k.nome)}${k.padrao ? ' (padrão)' : ''}</option>`).join('') : '<option value="">Nenhuma conta desta empresa</option>'}
                        </select></label>
                        <label class="fis-campo"><span>Data do ${pg} *</span><input class="fis-input" type="date" name="data" max="${hojeFin()}" value="${hojeFin()}"></label>
                    </div>
                    <div class="fis-grade">
                        ${num('valor', 'Valor da fatura *', r2Fin(t.saldo), `Quanto abate da fatura. Já vem com o que falta; diminua para ${pg} parcial.`)}
                        <label class="fis-campo"><span>Forma</span><select class="fis-input" name="forma">${FORMAS_FIN.filter(([v]) => v !== 'OMIE').map(([v, n]) => `<option value="${v}" ${(t.forma_pagamento || '15') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    </div>
                    <div class="fin-baixa-situacao" data-previa-baixa></div>
                    <div class="fis-grade">
                        ${num('desconto', 'Desconto')}
                        ${num('juros', 'Juros')}
                        ${num('multa', 'Multa')}
                    </div>
                    <div class="fis-grade">
                        ${num('abatimento', 'Abatimento', 0, 'Reduz o que falta sem ser desconto comercial (ex.: devolução, crédito). Grava como desconto.')}
                        ${num('acrescimo', 'Acréscimo', 0, 'Valor a mais que não é juros nem multa (ex.: tarifa). Grava como juros.')}
                    </div>
                    <!-- Faixa só com o valor final do pagamento (27/11, a pedido): sem vencimento/original/já pago/falta. -->
                    <div class="fin-baixa-faixa">
                        <span>Valor ${pagar ? 'pago' : 'recebido'}<b data-valor-pago-baixa>${dinheiroTexto(t.saldo)}</b></span>
                    </div>
                    <label class="fis-campo"><span>Observação deste ${pg}</span><textarea class="fis-input" name="observacao" maxlength="500" rows="3"></textarea></label>
                </div>`
        }],
        botoes: [{ texto: `Confirmar ${pg}`, img: 'concluido', funcao: 'salvarBaixaFin(this)' }]
    })
    previaBaixaFin(document.querySelector('[data-form-baixa] [name="valor"]'))
}

function lerBaixaFin(form) {
    const n = nome => r2Fin(form.querySelector(`[name="${nome}"]`)?.value || 0)
    const saldo = r2Fin(form.dataset.saldo)
    const valor = n('valor')
    const desconto = r2Fin(n('desconto') + n('abatimento'))
    const juros = r2Fin(n('juros') + n('acrescimo'))
    const multa = n('multa')
    const abate = valor
    const pago = r2Fin(valor + juros + multa - desconto)
    return { saldo, valor, desconto, juros, multa, abate, pago }
}

// Diz na hora se a fatura fica quitada, quanto ainda falta, ou se passou do saldo.
function previaBaixaFin(campo) {
    const form = campo?.closest('[data-form-baixa]')
    if (!form) return
    const { saldo, valor, abate, pago } = lerBaixaFin(form)
    const campoPago = form.querySelector('[data-valor-pago-baixa]')
    if (campoPago) campoPago.textContent = dinheiroTexto(pago)
    const quitada = form.dataset.pagar ? 'Esta conta a pagar será quitada' : 'Esta conta a receber será quitada'
    const caixa = form.querySelector('[data-previa-baixa]')
    caixa.className = 'fin-baixa-situacao'
    if (!(valor > 0)) caixa.textContent = 'Informe o valor.'
    else if (pago <= 0) { caixa.classList.add('erro'); caixa.textContent = 'Desconto e abatimento passam do valor: o valor pago ficaria zerado.' }
    else if (abate > saldo + 0.004) {
        caixa.classList.add('erro')
        caixa.innerHTML = `Passa ${dinheiro(abate - saldo)} do que falta (${dinheiro(saldo)}). Se pagou a mais, lance a diferença em juros, multa ou acréscimo.`
    } else if (Math.abs(abate - saldo) < 0.005) { caixa.classList.add('ok'); caixa.textContent = quitada }
    else caixa.innerHTML = `${form.dataset.pagar ? 'Pagamento' : 'Recebimento'} parcial: ainda ficam faltando <b>${dinheiro(saldo - abate)}</b>.`
}

async function salvarBaixaFin(botao) {
    const form = document.querySelector('[data-form-baixa]')
    const v = n => form.querySelector(`[name="${n}"]`).value
    const id = form.dataset.id
    const { saldo, valor, desconto, juros, multa, abate, pago } = lerBaixaFin(form)
    if (!v('conta_id')) return popup({ mensagem: 'Escolha a conta corrente.' })
    if (!v('data')) return popup({ mensagem: `Informe a data do ${termoFin('pagamento')}.` })
    if (!(valor > 0)) return popup({ mensagem: 'Informe o valor.' })
    if (pago <= 0) return popup({ mensagem: 'Desconto e abatimento passam do valor: o valor pago ficaria zerado.' })
    if (abate > saldo + 0.004) return popup({ mensagem: `Passa ${dinheiro(abate - saldo)} do que falta na fatura (${dinheiro(saldo)}). Lance a diferença em juros, multa ou acréscimo.` })
    try {
        overlayAguarde()
        await apiFin('baixar', { titulo_id: id, data: v('data'), valor: abate, juros, multa, desconto, conta_id: v('conta_id'), forma: v('forma'), observacao: v('observacao') })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        posAcaoFaturaFin(id)
        if (controles.faturasFin) { paginacao('faturasFin'); totaisFaturasFin() }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Pagar agora: o rápido. Quita o que falta da fatura escolhendo só a conta e a data real do pagamento.
// Parcial, desconto, juros etc. ficam no "Registrar pagamento" da aba Pagamentos.
async function formularioBaixaRapidaFin(id) {
    let op, t
    try {
        overlayAguarde()
        ;[op, { titulo: t }] = await Promise.all([carregarOpcoesFin(), apiFin('titulo', { id })])
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const pagar = t.tipo === 'PAGAR'
    // Dois campos lado a lado (27/11/2026, a pedido): o vencimento (só consulta, cinza) e a data do pagamento (destacada).
    // Vencimento já passado: a data do pagamento já vem com ele; hoje ou futuro: vem hoje (pagamento não tem data futura).
    const vencimento = String(t.vencimento || '').slice(0, 10)
    const hoje = hojeFin()
    const sugereVencimento = Boolean(vencimento && vencimento < hoje)
    const dataBaixa = sugereVencimento ? vencimento : hoje
    const contas = op.contas.filter(k => contaAceitaFin(k, t.app))
    const padrao = t.conta_id || contaPadraoAppFin(contas, t.app)?.id
    popup({
        titulo: `${pagar ? 'Pagar' : 'Receber'} agora`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-baixa-rapida data-id="${escFin(t.id)}" data-valor="${r2Fin(t.saldo)}" data-forma="${escFin(t.forma_pagamento || '')}">
                    <div class="fin-baixa-resumo">
                        <b>${escFin(t.participante_nome || '')}</b>
                        <span>${t.observacao ? `${escFin(t.observacao)} · ` : ''}parcela ${escFin(t.parcela_texto)} · vence ${dataFin(t.vencimento)}</span>
                        <strong>${dinheiro(t.saldo)}</strong>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Conta corrente *</span><select class="fis-input" name="conta_id">
                            ${contas.length ? contas.map(k => `<option value="${k.id}" ${k.id === padrao ? 'selected' : ''}>${escFin(k.nome)}${k.padrao ? ' (padrão)' : ''}</option>`).join('') : '<option value="">Nenhuma conta desta empresa</option>'}
                        </select></label>
                        <label class="fis-campo fin-baixa-venc" title="Vencimento da fatura (só consulta)"><span>Vencimento da fatura</span><input class="fis-input" type="date" value="${escFin(vencimento)}" readonly tabindex="-1"></label>
                        <label class="fis-campo fin-baixa-data"><span>Data ${pagar ? 'do pagamento' : 'do recebimento'} *</span><input class="fis-input" type="date" name="data" max="${hoje}" value="${dataBaixa}"></label>
                    </div>
                    <small class="fis-dica">Quita o que falta da fatura. Parcial, desconto, juros ou multa: aba ${pagar ? 'Pagamentos' : 'Recebimentos'} da fatura → Registrar ${pagar ? 'pagamento' : 'recebimento'}.</small>
                </div>`
        }],
        botoes: [{ texto: pagar ? 'Marcar como pago' : 'Marcar como recebido', img: 'concluido', funcao: 'salvarBaixaRapidaFin(this)' }]
    })
}

async function salvarBaixaRapidaFin(botao) {
    const form = document.querySelector('[data-form-baixa-rapida]')
    const conta = form.querySelector('[name="conta_id"]').value
    const data = form.querySelector('[name="data"]').value
    const saldo = r2Fin(form.dataset.valor)
    if (!conta) return popup({ mensagem: 'Escolha a conta corrente.' })
    if (!data) return popup({ mensagem: `Informe a data real do ${termoFin('pagamento')}.` })
    const id = form.dataset.id
    try {
        overlayAguarde()
        await apiFin('baixar', { titulo_id: id, data, valor: saldo, conta_id: conta, forma: form.dataset.forma || undefined })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        posAcaoFaturaFin(id, Boolean(document.querySelector(`[data-fatura-fin="${CSS.escape(String(id))}"]`)))
        if (controles.faturasFin) { paginacao('faturasFin'); totaisFaturasFin() }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function estornarBaixaFin(baixaId, tituloId) {
    const ok = await confirmarPopup({ titulo: `Desfazer ${termoFin('pagamento')}`, mensagem: `Este ${termoFin('pagamento')} (com juros, desconto etc.) sai da fatura e da conta corrente.`, textoConfirmar: 'Desfazer' })
    if (!ok) return
    try {
        overlayAguarde()
        await apiFin('baixa/estornar', { baixa_id: baixaId })
        removerOverlay()
        posAcaoFaturaFin(tituloId)
        if (controles.faturasFin) { paginacao('faturasFin'); totaisFaturasFin() }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- contas correntes

// Tabela de contas: filtros (empresa, tipo, busca) e ordenação no próprio navegador.
// Contas desativadas ficam escondidas; o botão mostra para reativar (abrir a conta → Editar conta → "Ativa").
let mostrarInativasContasFin = false
let contasTelaFin = []
const filtroContasFin = { app: '', tipo: '', busca: '', ordem: 'app', desc: false }

function alternarInativasContasFin() {
    mostrarInativasContasFin = !mostrarInativasContasFin
    desenharContasFin()
}

function filtrarContasFin(campo, valor) {
    filtroContasFin[campo] = valor
    if (campo === 'busca') return desenharLinhasContasFin()
    desenharContasFin()
}

function ordenarContasFin(chave) {
    if (filtroContasFin.ordem === chave) filtroContasFin.desc = !filtroContasFin.desc
    else Object.assign(filtroContasFin, { ordem: chave, desc: ['saldo', 'entradas', 'saidas', 'ultimo_movimento'].includes(chave) })
    desenharContasFin()
}

async function telaContasFin() {
    overlayAguarde()
    try {
        const { contas } = await apiFin('contas')
        removerOverlay()
        contasTelaFin = contas
        desenharContasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function contasVisiveisFin({ ignorar = '' } = {}) {
    const f = filtroContasFin
    return contasTelaFin.filter(k => (mostrarInativasContasFin || k.ativo)
        && (ignorar === 'app' || !f.app || k.app === f.app)
        && (ignorar === 'tipo' || !f.tipo || k.tipo === f.tipo))
}

function desenharContasFin() {
    const f = filtroContasFin
    const inativas = contasTelaFin.filter(k => !k.ativo).length
    // Toggle do layout financeiro: .fluxo-chave-empresa (css/fluxo_kanban.css), ativo verde preenchido.
    const chips = (campo, opcoes, base) => `
        <div class="fluxo-chave-empresa" role="group">${opcoes.map(([valor, rotulo]) => `
            <button type="button" class="${f[campo] === valor ? 'ativo' : ''}" onclick="filtrarContasFin('${campo}', '${valor}')"
                title="${base.filter(k => !valor || k[campo] === valor).length} conta(s)">${escFin(rotulo)}</button>`).join('')}
        </div>`
    const apps = [...new Set(contasTelaFin.map(k => k.app))].sort()
    const tipos = Object.keys(TIPOS_CONTA_FIN).filter(t => contasTelaFin.some(k => k.tipo === t))
    const th = (chave, texto, num = false) => {
        const seta = f.ordem === chave ? (f.desc ? ' ▼' : ' ▲') : ''
        return `<th class="${num ? 'fis-num ' : ''}fin-contas-ordem" onclick="ordenarContasFin('${chave}')">${texto}${seta}</th>`
    }
    // Layout do Financeiro (fin-tela: fundo branco, título verde, barra de ações com ícones), igual às Faturas.
    tela.innerHTML = `
        <div class="fis-pagina fin-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo">
                    <h2>Contas correntes</h2>
                    <div class="fin-barra">
                        <button type="button" onclick="formularioContaFin()">${iconeFin('incluir')} Incluir</button>
                        ${inativas ? `<button type="button" onclick="alternarInativasContasFin()">${iconeFin(mostrarInativasContasFin ? 'fechar' : 'ver')} ${mostrarInativasContasFin ? 'Esconder desativadas' : `Mostrar desativadas (${inativas})`}</button>` : ''}
                    </div>
                </header>
                <div class="fin-extrato-barra fin-contas-barra">
                    <input type="search" class="fis-input fin-extrato-busca" placeholder="Buscar conta, banco, agência..." value="${escFin(f.busca)}" oninput="filtrarContasFin('busca', this.value)">
                    ${chips('app', [['', 'Todas'], ...apps.map(a => [a, a])], contasVisiveisFin({ ignorar: 'app' }))}
                    ${chips('tipo', [['', 'Todos'], ...tipos.map(t => [t, TIPOS_CONTA_FIN[t]])], contasVisiveisFin({ ignorar: 'tipo' }))}
                    <span class="fin-contas-dica">Saldo = saldo inicial + recebimentos − pagamentos (a partir da data do saldo inicial). Clique na conta para ver o extrato.</span>
                </div>
                <div class="fis-tabela-rolagem fin-contas-rolagem">
                    <table class="fis-tabela fin-extrato fin-contas">
                        <thead><tr>
                            ${th('app', 'Empresa')}${th('nome', 'Conta')}${th('tipo', 'Tipo')}${th('banco', 'Banco · agência · conta / cartão')}
                            ${th('ultimo_movimento', 'Último movimento')}${th('entradas', 'Entradas', true)}${th('saidas', 'Saídas', true)}${th('saldo', 'Saldo', true)}
                        </tr></thead>
                        <tbody id="bodyContasFin"></tbody>
                        <tfoot id="peContasFin"></tfoot>
                    </table>
                </div>
            </section>
        </div>`
    desenharLinhasContasFin()
}

function desenharLinhasContasFin() {
    const corpo = document.getElementById('bodyContasFin')
    if (!corpo) return
    const f = filtroContasFin
    const termo = (f.busca || '').trim().toLowerCase()
    const num = ['saldo', 'entradas', 'saidas']
    // Cartão: fecha/vence/quem paga no lugar de banco/agência/conta.
    const bancoTexto = k => k.tipo === 'CARTAO'
        ? [k.dia_fechamento && `fecha ${k.dia_fechamento}`, k.dia_vencimento && `vence ${k.dia_vencimento}`, k.conta_pagadora_nome && `paga pelo ${k.conta_pagadora_nome}`].filter(Boolean).join(' · ')
        : [k.banco, k.agencia && `ag ${k.agencia}`, k.conta && `cc ${k.conta}`].filter(Boolean).join(' · ')
    const linhas = contasVisiveisFin()
        .filter(k => !termo || [k.app, k.nome, k.titular, k.banco, bancoTexto(k), TIPOS_CONTA_FIN[k.tipo]].join(' ').toLowerCase().includes(termo))
        .sort((a, b) => {
            const va = a[f.ordem], vb = b[f.ordem]
            const r = num.includes(f.ordem) ? (Number(va) || 0) - (Number(vb) || 0)
                : String(va ?? '').localeCompare(String(vb ?? ''), 'pt-BR', { numeric: true })
            return (f.desc ? -r : r) || String(a.app).localeCompare(b.app) || (b.padrao - a.padrao) || String(a.nome).localeCompare(b.nome, 'pt-BR')
        })
    const sinal = v => Number(v) < 0 ? 'fis-negativo' : ''
    corpo.innerHTML = linhas.map(k => `
        <tr class="fin-contas-linha ${k.ativo ? '' : 'inativo'}" onclick="extratoContaFin('${escFin(k.id)}')">
            <td>${escFin(k.app)}</td>
            <td class="fin-contas-nome" title="${escFin(k.nome)}">${escFin(k.nome)}${k.padrao ? ' <small class="fin-contas-tag">padrão</small>' : ''}${k.ativo ? '' : ' <small class="fin-contas-tag inativa">desativada</small>'}${k.caixa === false && k.tipo !== 'CARTAO' ? ' <small class="fin-contas-tag tecnica" title="Conta técnica: baixa sem mexer em banco, fica fora do Fluxo de Caixa">técnica</small>' : ''}</td>
            <td>${escFin(TIPOS_CONTA_FIN[k.tipo] || k.tipo)}</td>
            <td title="${escFin(bancoTexto(k))}">${escFin(bancoTexto(k) || '—')}</td>
            <td>${k.ultimo_movimento ? dataFin(k.ultimo_movimento) : '—'}</td>
            <td class="fis-num">${dinheiro(k.entradas)}</td>
            <td class="fis-num">${dinheiro(k.saidas)}</td>
            <td class="fis-num ${sinal(k.saldo)}"><b>${dinheiro(k.saldo)}</b></td>
        </tr>`).join('') || `<tr><td colspan="8" class="fis-vazio">Nenhuma conta com esse filtro.</td></tr>`
    const soma = c => linhas.reduce((a, k) => a + (Number(k[c]) || 0), 0)
    document.getElementById('peContasFin').innerHTML = linhas.length ? `
        <tr><td colspan="5">${linhas.length} conta${linhas.length === 1 ? '' : 's'}</td>
            <td class="fis-num">${dinheiro(soma('entradas'))}</td><td class="fis-num">${dinheiro(soma('saidas'))}</td>
            <td class="fis-num ${sinal(soma('saldo'))}"><b>${dinheiro(soma('saldo'))}</b></td></tr>` : ''
}

async function extratoContaFin(contaId) {
    overlayAguarde()
    try {
        const [{ contas }, { movimentos }] = await Promise.all([apiFin('contas'), apiFin('extrato', { conta_id: contaId })])
        removerOverlay()
        const k = contas.find(c => String(c.id) === String(contaId)) || {}
        popup({
            titulo: `${k.app} · ${k.nome}`,
            elemento: `
                <div class="fis-painel popup-consulta" data-conta-fin="${escFin(contaId)}">
                    ${resumoDocumentoFis(k, [
                        ['Saldo', `<span class="${Number(k.saldo) < 0 ? 'fis-negativo' : ''}">${dinheiro(k.saldo)}</span>`],
                        ['Entradas', dinheiro(k.entradas)], ['Saídas', dinheiro(k.saidas)],
                        ['Saldo inicial', `${dinheiro(k.saldo_inicial)}${k.data_saldo_inicial ? ` <small>em ${dataFin(k.data_saldo_inicial)}</small>` : ''}`]
                    ])}
                    <div class="fin-extrato-barra">
                        <input type="search" class="fis-input fin-extrato-busca" placeholder="Buscar fornecedor, categoria, observação..." oninput="filtrarExtratoFin(this)">
                        <div class="fin-extrato-chips" data-tipo="">
                            <button type="button" class="ativo" data-filtro="" onclick="filtrarExtratoFin(this)">Todos <small>${movimentos.length}</small></button>
                            <button type="button" data-filtro="E" onclick="filtrarExtratoFin(this)">Entradas <small>${movimentos.filter(m => Number(m.movimento) >= 0).length}</small></button>
                            <button type="button" data-filtro="S" onclick="filtrarExtratoFin(this)">Saídas <small>${movimentos.filter(m => Number(m.movimento) < 0).length}</small></button>
                        </div>
                        <button type="button" class="fis-mini fin-extrato-editar" onclick="formularioContaFin('${escFin(contaId)}')">Editar conta</button>
                    </div>
                    ${movimentos.length ? `
                    <div class="fis-tabela-rolagem fin-extrato-rolagem">
                        <table class="fis-tabela fin-extrato">
                            <thead><tr><th>Data</th><th>Fornecedor / cliente</th><th>Parcela</th><th>Categoria</th><th>Forma</th><th class="fis-num">Valor</th><th class="fis-num">Saldo</th></tr></thead>
                            <tbody>${(() => {
                                // Saldo depois de cada lançamento: parte do saldo atual (linha mais recente) e volta no tempo.
                                // Lançamentos antes da data do saldo inicial não entram no saldo da conta, então ficam sem saldo.
                                let saldo = Number(k.saldo) || 0
                                const inicio = k.data_saldo_inicial ? String(k.data_saldo_inicial).slice(0, 10) : ''
                                return movimentos.map(m => {
                                    const conta = !inicio || String(m.data).slice(0, 10) >= inicio
                                    const saldoLinha = conta ? saldo : null
                                    if (conta) saldo -= Number(m.movimento) || 0
                                    const obs = m.fatura_observacao || m.descricao || ''
                                    const busca = [m.participante_nome, obs, m.categoria, nomeFormaFin(m.forma), m.parcela_texto].join(' ').toLowerCase()
                                    return `
                                <tr data-tipo="${Number(m.movimento) < 0 ? 'S' : 'E'}" data-busca="${escFin(busca)}">
                                    <td class="fin-extrato-data">${dataFin(m.data)}</td>
                                    <td class="fin-extrato-quem">
                                        <span class="fis-link" onclick="abrirFaturaFin('${escFin(m.titulo_id)}')" title="${escFin(m.participante_nome || '')}">${escFin(m.participante_nome || '—')}</span>
                                        ${obs ? `<small title="${escFin(obs)}">${escFin(obs)}</small>` : ''}
                                    </td>
                                    <td class="fin-extrato-parcela">${escFin(m.parcela_texto || '')}</td>
                                    <td class="fin-extrato-cat" title="${escFin(m.categoria || '')}">${escFin(m.categoria || '—')}</td>
                                    <td class="fin-extrato-forma">${m.forma ? `<span title="${escFin(nomeFormaFin(m.forma))}">${escFin(nomeFormaFin(m.forma))}</span>` : '—'}</td>
                                    <td class="fis-num ${Number(m.movimento) < 0 ? 'fis-negativo' : 'fis-positivo'}"><b>${dinheiro(m.movimento)}</b></td>
                                    <td class="fis-num fin-extrato-saldo ${saldoLinha < 0 ? 'fis-negativo' : ''}">${saldoLinha === null ? '—' : dinheiro(saldoLinha)}</td>
                                </tr>`
                                }).join('')
                            })()}
                            </tbody>
                        </table>
                    </div>` : '<div class="fis-vazio">Nenhum movimento nesta conta.</div>'}
                </div>`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Filtro dos popups de consulta (.popup-consulta): busca + chips Todos/Entradas/Saídas sobre as linhas
// com data-tipo (E/S) e data-busca. Usado pelo extrato da conta e pelo estoque do item.
function filtrarExtratoFin(el) {
    const painel = el.closest('.popup-consulta')
    const chips = painel.querySelector('.fin-extrato-chips')
    if (el.dataset.filtro !== undefined) {
        chips.dataset.tipo = el.dataset.filtro
        chips.querySelectorAll('button').forEach(b => b.classList.toggle('ativo', b === el))
    }
    const tipo = chips.dataset.tipo
    const termo = painel.querySelector('.fin-extrato-busca').value.trim().toLowerCase()
    painel.querySelectorAll('.fin-extrato tbody tr').forEach(tr => {
        tr.style.display = (!tipo || tr.dataset.tipo === tipo) && (!termo || tr.dataset.busca.includes(termo)) ? '' : 'none'
    })
}

async function formularioContaFin(contaId = null) {
    let contas, op
    overlayAguarde()
    try { [{ contas }, op] = await Promise.all([apiFin('contas'), carregarOpcoesFin()]) } catch (err) { removerOverlay(); return popup({ mensagem: mensagemErroEst(err) }) }
    removerOverlay()
    const k = contaId ? contas.find(c => String(c.id) === String(contaId)) : null
    const cartao = k?.tipo === 'CARTAO'
    // Contas que podem pagar a fatura do cartão: bancos e caixas ativos (de qualquer empresa).
    const pagadoras = contas.filter(c => c.tipo !== 'CARTAO' && (c.ativo || String(c.id) === String(k?.conta_pagadora_id)))
    const padraoPagadora = k ? k.conta_pagadora_id : contas.find(c => c.app === 'AC' && c.padrao && c.ativo)?.id
    popup({
        titulo: k ? (cartao ? 'Editar cartão' : 'Editar conta') : 'Nova conta corrente',
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-conta data-id="${escFin(contaId || '')}" data-cartao="${cartao ? 'S' : ''}">
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Empresa</span><select class="fis-input" name="app">${opcoesEmpresasFin(op.empresas, k?.app || 'AC')}</select></label>
                        <label class="fis-campo fis-largo fin-so-conta"><span>Nome</span><input class="fis-input" name="nome" maxlength="80" value="${escFin(k?.nome || '')}" placeholder="ex.: Itaú, Caixa da obra"></label>
                        <label class="fis-campo"><span>Tipo</span><select class="fis-input" name="tipo" onchange="tipoContaFin(this)">${Object.entries(TIPOS_CONTA_FIN).map(([v, n]) => `<option value="${v}" ${(k?.tipo || 'BANCO') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    </div>
                    <div class="fis-grade fin-so-conta">
                        <label class="fis-campo"><span>Banco</span><input class="fis-input" name="banco" maxlength="30" value="${escFin(k?.banco || '')}"></label>
                        <label class="fis-campo"><span>Agência</span><input class="fis-input" name="agencia" maxlength="20" value="${escFin(k?.agencia || '')}"></label>
                        <label class="fis-campo"><span>Conta</span><input class="fis-input" name="conta" maxlength="30" value="${escFin(k?.conta || '')}"></label>
                    </div>
                    <div class="fin-so-cartao">
                        <div class="fis-grade">
                            <label class="fis-campo"><span>Emissor</span><input class="fis-input" name="emissor" maxlength="30" list="emissoresCartaoFin" value="${escFin(cartao ? k?.banco || '' : '')}" placeholder="Santander, Caixa, Itaú…" oninput="nomeCartaoFin()"></label>
                            <label class="fis-campo"><span>Final</span><input class="fis-input" name="cartao_final" maxlength="4" inputmode="numeric" value="${escFin(k?.cartao_final || '')}" placeholder="1234" oninput="this.value = this.value.replace(/\\D/g, ''); nomeCartaoFin()"></label>
                            <label class="fis-campo fis-largo"><span>Titular</span><input class="fis-input" name="titular" maxlength="60" value="${escFin(k?.titular || '')}" placeholder="quem está com o cartão" oninput="nomeCartaoFin()"></label>
                        </div>
                        <datalist id="emissoresCartaoFin">${[...new Set(contas.filter(c => c.tipo === 'CARTAO' && c.banco).map(c => c.banco))].sort().map(b => `<option value="${escFin(b)}">`).join('')}</datalist>
                        <div class="fis-grade">
                            <label class="fis-campo"><span>Fecha dia</span><input class="fis-input" type="number" min="1" max="31" name="dia_fechamento" value="${escFin(k?.dia_fechamento ?? '')}"></label>
                            <label class="fis-campo"><span>Vence dia</span><input class="fis-input" type="number" min="1" max="31" name="dia_vencimento" value="${escFin(k?.dia_vencimento ?? '')}"></label>
                            <label class="fis-campo"><span>Limite</span><input class="fis-input" type="number" step="0.01" min="0" name="limite" value="${escFin(k?.limite ?? '')}" placeholder="opcional"></label>
                        </div>
                        <label class="fis-campo"><span>Fatura paga pela conta</span><select class="fis-input" name="conta_pagadora_id">
                            <option value="">—</option>
                            ${pagadoras.map(c => `<option value="${escFin(c.id)}" ${String(c.id) === String(padraoPagadora) ? 'selected' : ''}>${escFin(c.app)} · ${escFin(c.nome)}</option>`).join('')}
                        </select></label>
                        <div class="fin-nome-cartao">Nome da conta: <b data-nome-cartao-fin></b></div>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Saldo inicial</span><input class="fis-input" type="number" step="0.01" name="saldo_inicial" value="${k?.saldo_inicial ?? 0}"></label>
                        <label class="fis-campo"><span>Data do saldo inicial</span><input class="fis-input" type="date" name="data_saldo_inicial" value="${escFin(k?.data_saldo_inicial ? String(k.data_saldo_inicial).slice(0, 10) : '')}"></label>
                    </div>
                    <label class="fis-check fin-so-conta"><input type="checkbox" name="padrao" ${k?.padrao ? 'checked' : ''}> Conta padrão da empresa</label>
                    <label class="fis-check fin-so-conta" title="Spark Pay, Empréstimo Mútuo, Caixinha...: o que é baixado nela não entra no Fluxo de Caixa"><input type="checkbox" name="tecnica" ${k && k.caixa === false ? 'checked' : ''}> Conta técnica (não é dinheiro de verdade: fica fora do Fluxo de Caixa)</label>
                    <label class="fis-check"><input type="checkbox" name="ativo" ${!k || k.ativo ? 'checked' : ''}> Ativa</label>
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="500" value="${escFin(k?.observacao || '')}"></label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarContaFin(this)' }]
    })
    nomeCartaoFin()
}

// Tipo Cartão: troca banco/agência/conta pelos campos do cartão (css: [data-cartao] .fin-so-conta / .fin-so-cartao).
function tipoContaFin(select) {
    const form = select.closest('[data-form-conta]')
    form.dataset.cartao = select.value === 'CARTAO' ? 'S' : ''
    nomeCartaoFin()
}

// Mesmo nome que o servidor monta: "<emissor> <final> · <titular>".
function nomeCartaoFin() {
    const form = document.querySelector('[data-form-conta]')
    const alvo = form?.querySelector('[data-nome-cartao-fin]')
    if (!alvo) return
    const v = n => form.querySelector(`[name="${n}"]`).value.trim()
    alvo.textContent = [[v('emissor') || 'Cartão', v('cartao_final')].filter(Boolean).join(' '), v('titular')].filter(Boolean).join(' · ')
}

async function salvarContaFin(botao) {
    const form = document.querySelector('[data-form-conta]')
    const v = n => form.querySelector(`[name="${n}"]`)
    const cartao = v('tipo').value === 'CARTAO'
    try {
        overlayAguarde()
        await apiFin('conta/salvar', {
            id: form.dataset.id || undefined, app: v('app').value, nome: v('nome').value, tipo: v('tipo').value,
            banco: cartao ? v('emissor').value : v('banco').value, agencia: v('agencia').value, conta: v('conta').value, saldo_inicial: v('saldo_inicial').value,
            data_saldo_inicial: v('data_saldo_inicial').value, padrao: v('padrao').checked, ativo: v('ativo').checked, observacao: v('observacao').value, caixa: !v('tecnica').checked,
            cartao_final: v('cartao_final').value, titular: v('titular').value, dia_fechamento: v('dia_fechamento').value,
            dia_vencimento: v('dia_vencimento').value, conta_pagadora_id: v('conta_pagadora_id').value, limite: v('limite').value
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        document.querySelectorAll('[data-conta-fin]').forEach(p => removerPopup(p.closest('.popup')?.id))
        carregarOpcoesFin(true).catch(() => { })
        telaContasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- categorias

const estadoCategoriasFin = { lista: [], verExcluidas: false, filtro: '' }

async function telaCategoriasFin() {
    overlayAguarde()
    try {
        const { categorias, ver_excluidas } = await apiFin('categorias')
        removerOverlay()
        Object.assign(estadoCategoriasFin, { lista: categorias, podeExcluidas: ver_excluidas })
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina fin-pagina">
                <div class="cabecalho-pagina"><h2>Categorias</h2></div>
                <div class="fis-painel">
                    <div class="fis-barra-clara">
                        <input class="fis-input fis-busca" placeholder="Buscar categoria…" oninput="estadoCategoriasFin.filtro = this.value.toLowerCase(); desenharCategoriasFin()">
                        ${ver_excluidas ? `<label class="fis-check"><input type="checkbox" onchange="estadoCategoriasFin.verExcluidas = this.checked; desenharCategoriasFin()"> Mostrar excluídas</label>` : ''}
                        <button type="button" class="fis-botao" onclick="formularioCategoriaFin()">+ Categoria</button>
                        <button type="button" class="fis-mini" onclick="formularioCategoriaFin(null, true)">+ Grupo</button>
                    </div>
                    <div class="fin-categorias" data-categorias-fin></div>
                </div>
            </div>`
        desenharCategoriasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function desenharCategoriasFin() {
    const alvo = document.querySelector('[data-categorias-fin]')
    if (!alvo) return
    const { lista, verExcluidas, filtro } = estadoCategoriasFin
    const visivel = c => (verExcluidas || !c.excluida) && (!filtro || `${c.codigo} ${c.nome}`.toLowerCase().includes(filtro))
    const tipos = [['DESPESA', 'Despesas'], ['RECEITA', 'Receitas'], ['TRANSFERENCIA', 'Transferências']]
    const linha = c => `
        <div class="fin-categoria ${c.excluida ? 'excluida' : ''}">
            <span class="fin-cat-codigo">${escFin(c.codigo)}</span>
            <span class="fin-cat-nome">${escFin(c.nome)}${c.excluida ? ' <small>excluída</small>' : ''}</span>
            <small>${Number(c.usos) ? `${c.usos} fatura(s)` : ''}</small>
            <button type="button" class="fis-mini" onclick="formularioCategoriaFin('${c.id}')">Editar</button>
        </div>`
    alvo.innerHTML = tipos.map(([tipo, titulo]) => {
        const grupos = lista.filter(c => c.tipo === tipo && c.grupo)
        const blocos = grupos.map(g => {
            const filhos = lista.filter(c => c.pai_id === g.id && visivel(c))
            if (!filhos.length && !visivel(g)) return ''
            return `<div class="fin-grupo"><div class="fin-grupo-topo">${linha(g)}</div>${filhos.map(linha).join('')}</div>`
        }).join('')
        const soltas = lista.filter(c => c.tipo === tipo && !c.grupo && !c.pai_id && visivel(c)).map(linha).join('')
        return blocos || soltas ? `<h3>${titulo}</h3>${blocos}${soltas}` : ''
    }).join('') || '<div class="fis-vazio">Nada encontrado.</div>'
}

function formularioCategoriaFin(id = null, grupo = false) {
    const c = id ? estadoCategoriasFin.lista.find(x => String(x.id) === String(id)) : null
    const ehGrupo = c ? c.grupo : grupo
    const tipo = c?.tipo || 'DESPESA'
    const grupos = estadoCategoriasFin.lista.filter(x => x.grupo)
    popup({
        titulo: c ? `Editar ${ehGrupo ? 'grupo' : 'categoria'}` : `Novo ${ehGrupo ? 'grupo' : 'categoria'}`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-categoria data-id="${escFin(id || '')}" data-grupo="${ehGrupo ? 1 : ''}">
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Tipo</span><select class="fis-input" name="tipo" onchange="filtrarGruposCategoriaFin(this)">
                            ${[['DESPESA', 'Despesa'], ['RECEITA', 'Receita'], ['TRANSFERENCIA', 'Transferência']].map(([v, n]) => `<option value="${v}" ${tipo === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                        <div class="fis-campo" title="Dado pela hierarquia: o primeiro número livre do ${ehGrupo ? 'tipo' : 'grupo'}"><span>Código</span><b class="fin-cat-codigo-form" data-codigo-categoria>${escFin(c?.codigo || '')}</b></div>
                        <label class="fis-campo fis-largo"><span>Nome</span><input class="fis-input" name="nome" maxlength="80" value="${escFin(c?.nome || '')}"></label>
                    </div>
                    ${ehGrupo ? '' : `<label class="fis-campo"><span>Grupo</span><select class="fis-input" name="pai_id" onchange="previaCodigoCategoriaFin(this)">${grupos.map(g => `<option value="${g.id}" data-tipo="${g.tipo}" ${g.id === c?.pai_id ? 'selected' : ''}>${escFin(g.codigo)} · ${escFin(g.nome)}</option>`).join('')}</select></label>`}
                    ${estadoCategoriasFin.podeExcluidas ? `<label class="fis-check"><input type="checkbox" name="excluida" ${c?.excluida ? 'checked' : ''}> Excluída (fora de uso; só fin, diretoria e adm veem)</label>` : ''}
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarCategoriaFin(this)' }]
    })
    const sel = document.querySelector('[data-form-categoria] [name="tipo"]')
    if (sel) filtrarGruposCategoriaFin(sel)
}

// Prévia do código que o servidor vai dar: prefixo do tipo (0/1/2) ou código do grupo + primeiro número livre.
// Editando sem mudar tipo/grupo, fica o código atual.
function previaCodigoCategoriaFin(campo) {
    const form = campo.closest('[data-form-categoria]')
    const lista = estadoCategoriasFin.lista
    const atual = lista.find(x => String(x.id) === form.dataset.id)
    const grupo = Boolean(form.dataset.grupo)
    const tipo = form.querySelector('[name="tipo"]').value
    const paiId = form.querySelector('[name="pai_id"]')?.value || ''
    const codigo = form.querySelector('[data-codigo-categoria]')
    if (atual && atual.tipo === tipo && atual.grupo === grupo && String(atual.pai_id || '') === String(grupo ? '' : paiId)) return (codigo.textContent = atual.codigo)
    const prefixo = grupo ? { TRANSFERENCIA: '0', RECEITA: '1', DESPESA: '2' }[tipo] : lista.find(x => String(x.id) === paiId)?.codigo
    if (!prefixo) return (codigo.textContent = '')
    const usados = new Set(lista.map(x => String(x.codigo || ''))
        .filter(k => k.startsWith(prefixo + '.') && /^\d{1,3}$/.test(k.slice(prefixo.length + 1)))
        .map(k => Number(k.slice(prefixo.length + 1))))
    let n = 1
    while (n <= 99 && usados.has(n)) n++
    codigo.textContent = n > 99 ? 'sem código livre' : `${prefixo}.${String(n).padStart(2, '0')}`
}

function filtrarGruposCategoriaFin(select) {
    const pai = select.closest('[data-form-categoria]').querySelector('[name="pai_id"]')
    if (!pai) return previaCodigoCategoriaFin(select)
    ;[...pai.options].forEach(o => { o.hidden = o.dataset.tipo !== select.value })
    if (pai.selectedOptions[0]?.hidden) pai.value = [...pai.options].find(o => !o.hidden)?.value || ''
    previaCodigoCategoriaFin(select)
}

async function salvarCategoriaFin(botao) {
    const form = document.querySelector('[data-form-categoria]')
    const v = n => form.querySelector(`[name="${n}"]`)
    try {
        overlayAguarde()
        await apiFin('categoria/salvar', {
            id: form.dataset.id || undefined, grupo: Boolean(form.dataset.grupo), tipo: v('tipo').value,
            // O servidor dá o código sozinho; vai junto só para o servidor antigo, que ainda o exige.
            codigo: (form.querySelector('[data-codigo-categoria]')?.textContent.trim().match(/^[0-9.]+$/) || [])[0],
            nome: v('nome').value, pai_id: v('pai_id')?.value || null, excluida: v('excluida')?.checked || false
        })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        carregarOpcoesFin(true).catch(() => { })
        telaCategoriasFin()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}
