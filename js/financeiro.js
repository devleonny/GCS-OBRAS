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
const hojeFin = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())

const SITUACOES_FIN = {
    ABERTO: { cor: '#2563eb', texto: 'Em aberto' },
    PARCIAL: { cor: '#d97706', texto: 'Parcial' },
    ATRASADO: { cor: '#b91c1c', texto: 'Atrasado' },
    PAGO: { cor: '#15803d', texto: 'Pago' },
    CANCELADO: { cor: '#64748b', texto: 'Cancelado' }
}
const ORIGENS_FIN = { MANUAL: 'Manual', NF_ENTRADA: 'Nota recebida', NF_SAIDA: 'Nota emitida', REEMBOLSO: 'Reembolso' }
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

const opcoesContasFin = (contas, app, atual) => `<option value="">${app ? 'Conta padrão da empresa' : 'Selecione'}</option>` + contas
    .filter(k => !app || k.app === app)
    .map(k => `<option value="${k.id}" ${String(k.id) === String(atual ?? '') ? 'selected' : ''}>${escFin(k.app)} · ${escFin(k.nome)}${k.padrao ? ' (padrão)' : ''}</option>`).join('')

// ---------------------------------------------------------------- componentes

// Sim/Não sem valor padrão: o usuário tem que responder.
function simNaoFin(nome, rotulo, onchange = '') {
    return `
        <div class="fin-pergunta" data-pergunta="${escFin(nome)}">
            <span class="fin-pergunta-rotulo">${rotulo} <b class="fin-obrigatorio">*</b></span>
            <div class="fin-sim-nao" role="radiogroup" aria-label="${escFin(rotulo)}">
                <label><input type="radio" name="${escFin(nome)}" value="sim" onchange="${onchange}"><span>Sim</span></label>
                <label><input type="radio" name="${escFin(nome)}" value="nao" onchange="${onchange}"><span>Não</span></label>
            </div>
        </div>`
}
const lerSimNaoFin = (raiz, nome) => {
    const v = raiz.querySelector(`[name="${nome}"]:checked`)?.value
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
            <td><button type="button" class="fis-mini" title="Tirar parcela" onclick="removerParcelaFin(this)">×</button></td>
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
}

// Rateio por departamento (contratos ORC + setores). Linhas: departamento + %.
function editorRateioFin(departamentos, rateio = []) {
    const lista = rateio.length ? rateio : [{ departamento: '', percentual: 100 }]
    return `
        <div class="fin-rateio" data-rateio>
            <datalist id="finDepartamentos">${departamentos.map(d => `<option value="${escFin(d.id)}">${escFin(d.cliente || (d.tipo === 'SETOR' ? 'Setor' : ''))}</option>`).join('')}</datalist>
            <div class="fin-parcelas-topo"><b>Departamento</b> <small>contrato (ORC) ou setor; vários = rateio em %</small></div>
            <div data-linhas-rateio>${lista.map(r => linhaRateioFin(r)).join('')}</div>
            <button type="button" class="fis-mini" onclick="this.previousElementSibling.insertAdjacentHTML('beforeend', linhaRateioFin({ departamento: '', percentual: '' }))">+ Departamento</button>
        </div>`
}
function linhaRateioFin(r) {
    return `
        <div class="fin-rateio-linha">
            <input class="fis-input" list="finDepartamentos" name="departamento" value="${escFin(r.departamento || '')}" placeholder="ORC_0000 ou setor">
            <input class="fis-input fis-num" type="number" min="0" max="100" step="0.01" name="percentual" value="${r.percentual ?? ''}"> %
            <button type="button" class="fis-mini" onclick="this.parentElement.remove()">×</button>
        </div>`
}
const lerRateioFin = raiz => [...raiz.querySelectorAll('.fin-rateio-linha')]
    .map(l => ({ departamento: l.querySelector('[name="departamento"]').value.trim(), percentual: Number(l.querySelector('[name="percentual"]').value) || 0 }))
    .filter(r => r.departamento)

// ---------------------------------------------------------------- faturas

function telaFaturasPagar() { return telaFaturasFin('PAGAR') }
function telaFaturasReceber() { return telaFaturasFin('RECEBER') }

let tipoFaturasFin = 'PAGAR'
async function telaFaturasFin(tipo, filtroExtra = null) {
    tipoFaturasFin = tipo
    const pagar = tipo === 'PAGAR'
    tela.innerHTML = `
        <div class="pagina-conteudo fis-pagina fin-pagina">
            <div class="cabecalho-pagina"><h2>Faturas a ${pagar ? 'pagar' : 'receber'}</h2></div>
            <div class="fis-cartoes" data-cartoes-fin></div>
            <div class="fis-conteudo"></div>
        </div>`
    cartoesFaturasFin(tipo)
    try {
        delete controles.faturasFin
        document.querySelector('.fis-conteudo').innerHTML = await modTab({
            base: 'vw_fin_titulos',
            pag: 'faturasFin',
            body: 'bodyFaturasFin',
            criarLinha: 'criarLinhaFaturaFin',
            topoEmLinha: true,
            caber: true,
            filtrosFixos: { tipo: { op: '=', value: tipo }, ...(filtroExtra || {}) },
            btnExtras: `
                <div class="fis-acoes">
                    <button type="button" onclick="formularioFaturaFin('${tipo}')">+ Fatura</button>
                    ${filtroExtra ? `<button type="button" onclick="telaFaturasFin('${tipo}')">Limpar filtro</button>` : ''}
                </div>`,
            ordenar: [{ path: 'vencimento', direcao: 'asc' }],
            colunas: {
                '': {},
                'Vencimento': { chave: 'vencimento', tipoPesquisa: 'data' },
                'Empresa': { chave: 'app', tipoPesquisa: 'select' },
                [pagar ? 'Fornecedor' : 'Cliente']: { chave: 'participante_nome' },
                'Descrição': { chave: 'descricao' },
                'Categoria': { chave: 'categoria', tipoPesquisa: 'select' },
                'Parcela': { chave: 'parcela_texto' },
                'Valor': { chave: 'valor', op: '>=', tipoOrdenacao: 'numero' },
                'Saldo': { chave: 'saldo', op: '>=', tipoOrdenacao: 'numero' },
                'Situação': { chave: 'situacao', tipoPesquisa: 'select' },
                'Origem': { chave: 'origem', tipoPesquisa: 'select' }
            }
        })
        await paginacao('faturasFin')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir as faturas: ${escFin(err.message)}` })
    }
}

async function cartoesFaturasFin(tipo) {
    const alvo = document.querySelector('[data-cartoes-fin]')
    if (!alvo) return
    const soma = async situacao => {
        try {
            const r = await contarPorCampo({ base: 'vw_fin_titulos', path: 'saldo', modo: 'soma', filtros: { tipo: { op: '=', value: tipo }, situacao: { op: '=', value: situacao } } })
            return Number(r?.total || 0)
        } catch { return null }
    }
    const [atrasado, aberto, parcial] = await Promise.all([soma('ATRASADO'), soma('ABERTO'), soma('PARCIAL')])
    const cartao = (valor, texto, cor, situacao) => `
        <button type="button" class="fis-cartao" style="--cor: ${cor}" onclick="telaFaturasFin('${tipo}', { situacao: { op: '=', value: '${situacao}' } })">
            <b>${valor == null ? '—' : dinheiroTexto(valor)}</b><span>${texto}</span></button>`
    alvo.innerHTML = cartao(atrasado, 'atrasado', '#b91c1c', 'ATRASADO') + cartao(aberto, 'em aberto', '#2563eb', 'ABERTO') + cartao(parcial, 'parcial (saldo)', '#d97706', 'PARCIAL')
}

function criarLinhaFaturaFin(d) {
    const s = SITUACOES_FIN[d.situacao] || {}
    return `
        <tr>
            <td class="fis-acoes-linha"><img src="imagens/pesquisar.svg" title="Abrir" onclick="abrirFaturaFin('${escFin(d.id)}')"></td>
            <td>${dataFin(d.vencimento)}</td>
            <td>${escFin(d.app)}</td>
            <td class="fis-descricao">${escFin(d.participante_nome || '')}${d.participante_documento ? `<small>${docFormatadoFis(d.participante_documento)}</small>` : ''}</td>
            <td>${escFin(d.descricao || '')}${d.departamentos ? `<small class="fin-sub">${escFin(d.departamentos)}</small>` : ''}</td>
            <td><small>${escFin(d.categoria || '—')}</small></td>
            <td>${escFin(d.parcela_texto)}</td>
            <td class="fis-num">${dinheiro(d.valor)}</td>
            <td class="fis-num"><b>${dinheiro(d.saldo)}</b></td>
            <td>${etiquetaEst(s.texto || d.situacao, s.cor)}</td>
            <td><small>${escFin(ORIGENS_FIN[d.origem] || d.origem)}</small></td>
        </tr>`
}

async function abrirFaturaFin(id) {
    overlayAguarde()
    try {
        const { titulo: t, baixas, irmas } = await apiFin('titulo', { id })
        removerOverlay()
        const anterior = document.querySelector(`[data-fatura-fin="${CSS.escape(String(id))}"]`)?.closest('.popup')?.id
        if (anterior) removerPopup(anterior)
        const s = SITUACOES_FIN[t.situacao] || {}
        const pagar = t.tipo === 'PAGAR'
        const vivas = baixas.filter(b => !b.estornada)
        const origem = t.documento_id
            ? `<span class="fis-link" onclick="abrirDocumentoFiscal('${escFin(t.documento_id)}')">${escFin(ORIGENS_FIN[t.origem])} ${escFin(t.documento_numero || '')}</span>`
            : escFin(ORIGENS_FIN[t.origem] || t.origem)
        popup({
            titulo: `Fatura a ${pagar ? 'pagar' : 'receber'}`,
            elemento: `
                <div class="fis-painel fis-doc fis-nota" data-fatura-fin="${escFin(t.id)}">
                    <div class="fis-nota-topo ${{ PAGO: 'ok', ATRASADO: 'erro', CANCELADO: 'neutro', PARCIAL: 'andando' }[t.situacao] || 'rascunho'}">
                        <div class="fis-nota-titulo">
                            <b>${escFin(t.participante_nome || '(sem nome)')}</b>
                            <div class="fis-nota-etiquetas">${etiquetaEst(s.texto || t.situacao, s.cor)} ${etiquetaEst(t.app, '#356443')}</div>
                            <small>${escFin(t.descricao || '')}</small>
                        </div>
                        <div class="fis-nota-valor"><span>Saldo</span><b>${dinheiro(t.saldo)}</b></div>
                    </div>
                    ${resumoDocumentoFis(t, [
                        ['Vencimento', dataFin(t.vencimento)],
                        ['Parcela', escFin(t.parcela_texto)],
                        ['Valor', dinheiro(t.valor)],
                        [pagar ? 'Pago' : 'Recebido', dinheiro(t.pago)],
                        ['Categoria', escFin(t.categoria || '—')],
                        ['Conta', escFin(t.conta || 'padrão da empresa')],
                        ['Origem', origem],
                        ['Departamento', escFin(t.departamentos || '')],
                        ['Documento', escFin(t.numero_documento || '')]
                    ])}
                    ${t.observacao ? `<div class="fis-info">${escFin(t.observacao)}</div>` : ''}
                    ${t.situacao === 'CANCELADO' ? `<div class="fis-alerta">Cancelada: ${escFin(t.cancelamento_motivo || '')}</div>` : ''}
                    <div class="fis-acoes-claras fis-nota-acoes">
                        ${['ABERTO', 'PARCIAL', 'ATRASADO'].includes(t.situacao) ? `<button type="button" class="fis-botao" onclick="formularioBaixaFin('${escFin(t.id)}')">Registrar ${pagar ? 'pagamento' : 'recebimento'}</button>` : ''}
                        ${t.situacao !== 'CANCELADO' ? `<button type="button" class="fis-mini" onclick="formularioFaturaFin('${t.tipo}', '${escFin(t.id)}')">Editar</button>` : ''}
                        ${t.origem === 'MANUAL' && t.situacao !== 'CANCELADO' && !vivas.length ? `<button type="button" class="fis-mini" onclick="cancelarFaturaFin('${escFin(t.id)}')">Cancelar fatura</button>` : ''}
                    </div>
                    <div class="fis-secao">
                        <div class="fis-secao-topo"><b>${pagar ? 'Pagamentos' : 'Recebimentos'}</b> <span class="fis-contador">${vivas.length}</span></div>
                        ${baixas.length ? `
                        <table class="fis-tabela">
                            <thead><tr><th>Data</th><th>Conta</th><th>Forma</th><th class="fis-num">Valor</th><th class="fis-num">Juros/multa</th><th class="fis-num">Desconto</th><th>Por</th><th></th></tr></thead>
                            <tbody>${baixas.map(b => `
                                <tr class="${b.estornada ? 'fis-estornado' : ''}">
                                    <td>${dataFin(b.data)}</td>
                                    <td>${escFin(b.conta)}</td>
                                    <td>${escFin(nomeFormaFin(b.forma))}</td>
                                    <td class="fis-num">${dinheiro(b.valor)}</td>
                                    <td class="fis-num">${Number(b.juros) + Number(b.multa) ? dinheiro(Number(b.juros) + Number(b.multa)) : ''}</td>
                                    <td class="fis-num">${Number(b.desconto) ? dinheiro(b.desconto) : ''}</td>
                                    <td><small>${escFin(b.criado_por || '')}${b.estornada ? ` · desfeito: ${escFin(b.estorno_motivo || '')}` : ''}</small></td>
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

async function formularioFaturaFin(tipo, id = null) {
    let op, t = null
    try {
        overlayAguarde()
        ;[op, t] = await Promise.all([carregarOpcoesFin(), id ? apiFin('titulo', { id }).then(r => r.titulo) : null])
        removerOverlay()
    } catch (err) {
        removerOverlay()
        return popup({ mensagem: mensagemErroEst(err) })
    }
    const pagar = tipo === 'PAGAR'
    const manual = !t || t.origem === 'MANUAL'
    const app = t?.app || 'AC'
    popup({
        titulo: t ? 'Editar fatura' : `Nova fatura a ${pagar ? 'pagar' : 'receber'}`,
        linhas: [{
            elemento: `
                <div class="fis-form fin-form" data-form-fatura data-id="${escFin(id || '')}" data-tipo="${tipo}">
                    ${manual ? '' : `<div class="fis-info">Fatura de ${escFin(ORIGENS_FIN[t.origem])}: valor e fornecedor vêm da origem.${Number(t.pago) ? ' Com pagamento, o vencimento também fica.' : ''}</div>`}
                    <div class="fis-grade">
                        ${t ? '' : `<label class="fis-campo"><span>Empresa</span><select class="fis-input" name="app" onchange="this.closest('[data-form-fatura]').querySelector('[name=conta_id]').innerHTML = opcoesContasFin(opcoesFinCache.contas, this.value)">
                            ${op.empresas.map(e => `<option value="${escFin(e.app)}" ${e.app === app ? 'selected' : ''}>${escFin(e.app)}</option>`).join('')}</select></label>`}
                        <label class="fis-campo fis-largo"><span>${pagar ? 'Fornecedor' : 'Cliente'}</span><input class="fis-input" name="participante_nome" maxlength="150" value="${escFin(t?.participante_nome || '')}" ${manual ? '' : 'readonly'}></label>
                        <label class="fis-campo"><span>CPF/CNPJ</span><input class="fis-input" name="participante_documento" value="${escFin(t?.participante_documento || '')}" ${manual ? '' : 'readonly'}></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Descrição</span><input class="fis-input" name="descricao" maxlength="300" value="${escFin(t?.descricao || '')}"></label>
                        <label class="fis-campo"><span>Nº do documento</span><input class="fis-input" name="numero_documento" maxlength="60" value="${escFin(t?.numero_documento || '')}"></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Categoria *</span><select class="fis-input" name="categoria_id">${opcoesCategoriasFin(op.categorias, tipo, t?.categoria_id)}</select></label>
                        <label class="fis-campo"><span>Conta</span><select class="fis-input" name="conta_id">${opcoesContasFin(op.contas, app, t?.conta_id)}</select></label>
                        <label class="fis-campo"><span>Forma</span><select class="fis-input" name="forma_pagamento"><option value=""></option>${FORMAS_FIN.filter(([v]) => v !== 'OMIE').map(([v, n]) => `<option value="${v}" ${t?.forma_pagamento === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    </div>
                    ${t
                        ? `<div class="fis-grade">
                            <label class="fis-campo"><span>Vencimento</span><input class="fis-input" type="date" name="vencimento" value="${escFin(String(t.vencimento).slice(0, 10))}" ${manual || !Number(t.pago) ? '' : 'readonly'}></label>
                            <label class="fis-campo"><span>Valor</span><input class="fis-input" type="number" step="0.01" min="0.01" name="valor" value="${r2Fin(t.valor)}" ${manual ? '' : 'readonly'}></label>
                          </div>`
                        : editorParcelasFin([{ vencimento: '', valor: '' }], null)}
                    ${editorRateioFin(op.departamentos, t?.rateio || [])}
                    <label class="fis-campo"><span>Observação</span><textarea class="fis-input" name="observacao" rows="2">${escFin(t?.observacao || '')}</textarea></label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarFaturaFin(this)' }]
    })
    const caixa = document.querySelector('[data-form-fatura] [data-parcelas]')
    if (caixa) somarParcelasFin(caixa)
}

async function salvarFaturaFin(botao) {
    const form = document.querySelector('[data-form-fatura]')
    const v = n => form.querySelector(`[name="${n}"]`)?.value ?? ''
    const corpo = {
        id: form.dataset.id || undefined, tipo: form.dataset.tipo, app: v('app') || undefined,
        participante_nome: v('participante_nome'), participante_documento: v('participante_documento'),
        descricao: v('descricao'), numero_documento: v('numero_documento'), categoria_id: v('categoria_id') || null,
        conta_id: v('conta_id') || null, forma_pagamento: v('forma_pagamento'), observacao: v('observacao'),
        rateio: lerRateioFin(form)
    }
    if (form.dataset.id) Object.assign(corpo, { vencimento: v('vencimento'), valor: v('valor') })
    else corpo.parcelas = lerParcelasFin(form)
    try {
        overlayAguarde()
        await apiFin('titulo/salvar', corpo)
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        if (corpo.id) abrirFaturaFin(corpo.id)
        if (controles.faturasFin) { paginacao('faturasFin'); cartoesFaturasFin(tipoFaturasFin) }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function cancelarFaturaFin(id) {
    const motivo = prompt('Motivo do cancelamento:')
    if (motivo === null) return
    try {
        overlayAguarde()
        await apiFin('titulo/cancelar', { id, motivo })
        removerOverlay()
        abrirFaturaFin(id)
        if (controles.faturasFin) { paginacao('faturasFin'); cartoesFaturasFin(tipoFaturasFin) }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

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
    const padrao = t.conta_id || op.contas.find(k => k.app === t.app && k.padrao)?.id
    popup({
        titulo: `Registrar ${pagar ? 'pagamento' : 'recebimento'}`,
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-baixa data-id="${escFin(t.id)}">
                    <div class="fis-info">${escFin(t.participante_nome || '')} · parcela ${escFin(t.parcela_texto)} · saldo <b>${dinheiro(t.saldo)}</b></div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Data</span><input class="fis-input" type="date" name="data" max="${hojeFin()}" value="${hojeFin()}"></label>
                        <label class="fis-campo"><span>Valor ${pagar ? 'pago' : 'recebido'} (abate do saldo)</span><input class="fis-input" type="number" step="0.01" min="0.01" max="${t.saldo}" name="valor" value="${r2Fin(t.saldo)}"></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Juros</span><input class="fis-input" type="number" step="0.01" min="0" name="juros" value="0"></label>
                        <label class="fis-campo"><span>Multa</span><input class="fis-input" type="number" step="0.01" min="0" name="multa" value="0"></label>
                        <label class="fis-campo"><span>Desconto</span><input class="fis-input" type="number" step="0.01" min="0" name="desconto" value="0"></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo fis-largo"><span>Conta</span><select class="fis-input" name="conta_id">${op.contas.filter(k => k.app === t.app).map(k => `<option value="${k.id}" ${k.id === padrao ? 'selected' : ''}>${escFin(k.nome)}</option>`).join('')}</select></label>
                        <label class="fis-campo"><span>Forma</span><select class="fis-input" name="forma">${FORMAS_FIN.filter(([v]) => v !== 'OMIE').map(([v, n]) => `<option value="${v}" ${(t.forma_pagamento || '15') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    </div>
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="500"></label>
                </div>`
        }],
        botoes: [{ texto: 'Registrar', img: 'concluido', funcao: 'salvarBaixaFin(this)' }]
    })
}

async function salvarBaixaFin(botao) {
    const form = document.querySelector('[data-form-baixa]')
    const v = n => form.querySelector(`[name="${n}"]`).value
    const id = form.dataset.id
    try {
        overlayAguarde()
        await apiFin('baixar', { titulo_id: id, data: v('data'), valor: v('valor'), juros: v('juros'), multa: v('multa'), desconto: v('desconto'), conta_id: v('conta_id'), forma: v('forma'), observacao: v('observacao') })
        removerOverlay()
        removerPopup(botao?.closest('.popup')?.id)
        abrirFaturaFin(id)
        if (controles.faturasFin) { paginacao('faturasFin'); cartoesFaturasFin(tipoFaturasFin) }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function estornarBaixaFin(baixaId, tituloId) {
    const motivo = prompt('Por que desfazer este pagamento?')
    if (motivo === null) return
    try {
        overlayAguarde()
        await apiFin('baixa/estornar', { baixa_id: baixaId, motivo })
        removerOverlay()
        abrirFaturaFin(tituloId)
        if (controles.faturasFin) { paginacao('faturasFin'); cartoesFaturasFin(tipoFaturasFin) }
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------------------------------------------------------- contas correntes

async function telaContasFin() {
    overlayAguarde()
    try {
        const { contas } = await apiFin('contas')
        removerOverlay()
        const empresas = [...new Set(contas.map(k => k.app))]
        tela.innerHTML = `
            <div class="pagina-conteudo fis-pagina fin-pagina">
                <div class="cabecalho-pagina"><h2>Contas correntes</h2></div>
                <div class="fis-painel">
                    <div class="fis-explica">Saldo = saldo inicial + recebimentos − pagamentos registrados nas faturas (a partir da data do saldo inicial).
                        A conta <b>padrão</b> de cada empresa é sugerida nos pagamentos.</div>
                    <div class="fis-acoes-claras"><button type="button" class="fis-botao" onclick="formularioContaFin()">+ Conta</button></div>
                    ${empresas.map(app => `
                        <div class="est-empresa">
                            <h3>${escFin(app)}</h3>
                            <div class="est-locais">${contas.filter(k => k.app === app).map(k => `
                                <button type="button" class="est-local fin-conta ${k.ativo ? '' : 'inativo'}" onclick="extratoContaFin('${k.id}')">
                                    <span class="est-local-nome">${escFin(k.nome)}${k.padrao ? ' <small>padrão</small>' : ''}${k.ativo ? '' : ' <small>desativada</small>'}</span>
                                    <b class="${Number(k.saldo) < 0 ? 'fis-negativo' : ''}">${dinheiro(k.saldo)}</b>
                                    <span>${escFin(TIPOS_CONTA_FIN[k.tipo] || k.tipo)}${k.banco ? ` · ${escFin(k.banco)}` : ''}${k.agencia ? ` · ag ${escFin(k.agencia)}` : ''}${k.conta ? ` · cc ${escFin(k.conta)}` : ''}</span>
                                </button>`).join('')}
                            </div>
                        </div>`).join('') || '<div class="fis-vazio">Nenhuma conta cadastrada.</div>'}
                </div>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
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
                <div class="fis-painel" data-conta-fin="${escFin(contaId)}">
                    ${resumoDocumentoFis(k, [
                        ['Saldo', `<span class="${Number(k.saldo) < 0 ? 'fis-negativo' : ''}">${dinheiro(k.saldo)}</span>`],
                        ['Entradas', dinheiro(k.entradas)], ['Saídas', dinheiro(k.saidas)],
                        ['Saldo inicial', `${dinheiro(k.saldo_inicial)}${k.data_saldo_inicial ? ` <small>em ${dataFin(k.data_saldo_inicial)}</small>` : ''}`]
                    ])}
                    <div class="fis-acoes-claras"><button type="button" class="fis-mini" onclick="formularioContaFin('${escFin(contaId)}')">Editar conta</button></div>
                    ${movimentos.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela">
                            <thead><tr><th>Data</th><th>Fornecedor / cliente</th><th>Descrição</th><th>Categoria</th><th>Forma</th><th class="fis-num">Valor</th></tr></thead>
                            <tbody>${movimentos.map(m => `
                                <tr>
                                    <td>${dataFin(m.data)}</td>
                                    <td class="fis-descricao"><span class="fis-link" onclick="abrirFaturaFin('${escFin(m.titulo_id)}')">${escFin(m.participante_nome || '—')}</span></td>
                                    <td>${escFin(m.descricao || '')} <small>${escFin(m.parcela_texto)}</small></td>
                                    <td><small>${escFin(m.categoria || '')}</small></td>
                                    <td><small>${escFin(nomeFormaFin(m.forma))}</small></td>
                                    <td class="fis-num ${Number(m.movimento) < 0 ? 'fis-negativo' : 'fis-positivo'}"><b>${dinheiro(m.movimento)}</b></td>
                                </tr>`).join('')}
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

async function formularioContaFin(contaId = null) {
    let contas, op
    try { [{ contas }, op] = await Promise.all([apiFin('contas'), carregarOpcoesFin()]) } catch (err) { return popup({ mensagem: mensagemErroEst(err) }) }
    const k = contaId ? contas.find(c => String(c.id) === String(contaId)) : null
    popup({
        titulo: k ? 'Editar conta' : 'Nova conta corrente',
        linhas: [{
            elemento: `
                <div class="fis-form" data-form-conta data-id="${escFin(contaId || '')}">
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Empresa</span><select class="fis-input" name="app">${op.empresas.map(e => `<option value="${escFin(e.app)}" ${e.app === (k?.app || 'AC') ? 'selected' : ''}>${escFin(e.app)}</option>`).join('')}</select></label>
                        <label class="fis-campo fis-largo"><span>Nome</span><input class="fis-input" name="nome" maxlength="80" value="${escFin(k?.nome || '')}" placeholder="ex.: Itaú, Caixa da obra, Cartão corporativo"></label>
                        <label class="fis-campo"><span>Tipo</span><select class="fis-input" name="tipo">${Object.entries(TIPOS_CONTA_FIN).map(([v, n]) => `<option value="${v}" ${(k?.tipo || 'BANCO') === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Banco (código)</span><input class="fis-input" name="banco" maxlength="10" value="${escFin(k?.banco || '')}"></label>
                        <label class="fis-campo"><span>Agência</span><input class="fis-input" name="agencia" maxlength="20" value="${escFin(k?.agencia || '')}"></label>
                        <label class="fis-campo"><span>Conta</span><input class="fis-input" name="conta" maxlength="30" value="${escFin(k?.conta || '')}"></label>
                    </div>
                    <div class="fis-grade">
                        <label class="fis-campo"><span>Saldo inicial</span><input class="fis-input" type="number" step="0.01" name="saldo_inicial" value="${k?.saldo_inicial ?? 0}"></label>
                        <label class="fis-campo"><span>Data do saldo inicial</span><input class="fis-input" type="date" name="data_saldo_inicial" value="${escFin(k?.data_saldo_inicial ? String(k.data_saldo_inicial).slice(0, 10) : '')}"></label>
                    </div>
                    <label class="fis-check"><input type="checkbox" name="padrao" ${k?.padrao ? 'checked' : ''}> Conta padrão da empresa</label>
                    <label class="fis-check"><input type="checkbox" name="ativo" ${!k || k.ativo ? 'checked' : ''}> Ativa</label>
                    <label class="fis-campo"><span>Observação</span><input class="fis-input" name="observacao" maxlength="500" value="${escFin(k?.observacao || '')}"></label>
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarContaFin(this)' }]
    })
}

async function salvarContaFin(botao) {
    const form = document.querySelector('[data-form-conta]')
    const v = n => form.querySelector(`[name="${n}"]`)
    try {
        overlayAguarde()
        await apiFin('conta/salvar', {
            id: form.dataset.id || undefined, app: v('app').value, nome: v('nome').value, tipo: v('tipo').value,
            banco: v('banco').value, agencia: v('agencia').value, conta: v('conta').value, saldo_inicial: v('saldo_inicial').value,
            data_saldo_inicial: v('data_saldo_inicial').value, padrao: v('padrao').checked, ativo: v('ativo').checked, observacao: v('observacao').value
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
                    <div class="fis-explica">Plano de categorias do GCS (carga inicial: todas as do Omie). Grupos organizam; as faturas usam as categorias dentro deles.
                        <b>Excluídas</b> são as do Omie fora de uso no GCS: só fin, diretoria e adm as veem.</div>
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
                        <label class="fis-campo"><span>Código</span><input class="fis-input" name="codigo" maxlength="20" value="${escFin(c?.codigo || '')}" placeholder="${ehGrupo ? 'ex.: 2.11' : 'ex.: 2.01.99'}"></label>
                        <label class="fis-campo fis-largo"><span>Nome</span><input class="fis-input" name="nome" maxlength="80" value="${escFin(c?.nome || '')}"></label>
                    </div>
                    ${ehGrupo ? '' : `<label class="fis-campo"><span>Grupo</span><select class="fis-input" name="pai_id">${grupos.map(g => `<option value="${g.id}" data-tipo="${g.tipo}" ${g.id === c?.pai_id ? 'selected' : ''}>${escFin(g.codigo)} · ${escFin(g.nome)}</option>`).join('')}</select></label>`}
                    ${estadoCategoriasFin.podeExcluidas ? `<label class="fis-check"><input type="checkbox" name="excluida" ${c?.excluida ? 'checked' : ''}> Excluída (fora de uso; só fin, diretoria e adm veem)</label>` : ''}
                </div>`
        }],
        botoes: [{ texto: 'Salvar', img: 'salvo', funcao: 'salvarCategoriaFin(this)' }]
    })
    const sel = document.querySelector('[data-form-categoria] [name="tipo"]')
    if (sel) filtrarGruposCategoriaFin(sel)
}

function filtrarGruposCategoriaFin(select) {
    const pai = select.closest('[data-form-categoria]').querySelector('[name="pai_id"]')
    if (!pai) return
    ;[...pai.options].forEach(o => { o.hidden = o.dataset.tipo !== select.value })
    if (pai.selectedOptions[0]?.hidden) pai.value = [...pai.options].find(o => !o.hidden)?.value || ''
}

async function salvarCategoriaFin(botao) {
    const form = document.querySelector('[data-form-categoria]')
    const v = n => form.querySelector(`[name="${n}"]`)
    try {
        overlayAguarde()
        await apiFin('categoria/salvar', {
            id: form.dataset.id || undefined, grupo: Boolean(form.dataset.grupo), tipo: v('tipo').value, codigo: v('codigo').value,
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
