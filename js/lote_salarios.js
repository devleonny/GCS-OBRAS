// ---------------- Financeiro → Lote de Salários (21/11/2026) ----------------
// Popup com todas as pessoas (tag FUNCIONÁRIO + quem recebeu salário nos últimos 75 dias), pré-preenchido com
// o último salário lançado (empresa, conta, valor, forma) ou o salário do RH. Salva sozinho no servidor a cada
// mudança (gcs fin_lotes): fecha e abre igual, até alguém lançar. Lançar = uma fatura a pagar por linha marcada
// (origem LOTE). Lote lançado abre igual e continua editável: as mudanças ficam pendentes até "Aplicar"
// (atualiza as faturas sem pagamento, cria as novas e cancela as tiradas) ou "Descartar".
// Rotas: financeiro/salarios/* (acesso financeiro.lote_salarios). Salário é sigiloso: nada vai para localStorage.

const estadoLoteSal = {
    id: null, versao: null, situacao: 'RASCUNHO', emEdicao: false, titulo: '', competencia: '', cabecalho: {}, itens: [],
    faturas: {}, base: new Map(), op: null, categoriaSalario: null, filtro: '',
    timer: null, salvando: null, pendente: false, erro: null, salvoEm: null, popupId: null, observador: null
}
const SITUACAO_LOTE_SAL = { RASCUNHO: 'Rascunho', LANCADO: 'Lançado' }

const novaChaveSal = () => crypto.randomUUID()
const mesSal = ym => ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : ''
const marcadasSal = () => estadoLoteSal.itens.filter(i => i.incluir && Number(i.valor) > 0)
const faturaSal = i => estadoLoteSal.faturas[i.chave] || null
const pagaSal = i => Number(faturaSal(i)?.pago) > 0

// 5º dia útil do mês seguinte à competência (seg–sex, sem feriados nacionais).
function quintoDiaUtilSal(ym) {
    const [a, m] = ym.split('-').map(Number)
    const d = new Date(Date.UTC(m === 12 ? a + 1 : a, m === 12 ? 0 : m, 1, 12))
    let uteis = 0
    for (let n = 0; n < 40; n++) {
        const iso = d.toISOString().slice(0, 10)
        if (![0, 6].includes(d.getUTCDay()) && !feriadosFin(d.getUTCFullYear()).has(iso) && ++uteis === 5) return iso
        d.setUTCDate(d.getUTCDate() + 1)
    }
    return null
}
const modaSal = lista => {
    const c = new Map()
    for (const v of lista.filter(Boolean)) c.set(v, (c.get(v) || 0) + 1)
    return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] || null
}

// ---------------- lista dos lotes

async function telaLotesSalarios() {
    if (typeof recolherMenuPrincipalFin === 'function') recolherMenuPrincipalFin()
    overlayAguarde()
    try {
        const { lotes } = await apiFin('salarios/lotes')
        removerOverlay()
        tela.innerHTML = `
            <div class="fis-pagina fin-pagina cx-pagina" data-tela-lotes>
                <header class="cx-topo">
                    <div><h2>Lote de Salários</h2><small>Lance a folha de uma vez. O rascunho fica guardado até você decidir lançar, e o lote lançado abre igual para editar.</small></div>
                    <div class="cx-acoes">
                        <button type="button" class="fis-botao" onclick="abrirLoteSalarios()">+ Novo lote</button>
                        ${pode('financeiro.fluxo_caixa') ? '<button type="button" class="fis-mini" onclick="telaFluxoCaixa()">Fluxo de caixa</button>' : ''}
                    </div>
                </header>
                <div class="fis-painel">
                    ${lotes.length ? `
                    <div class="fis-tabela-rolagem">
                        <table class="fis-tabela cx-lotes">
                            <thead><tr><th>Competência</th><th>Lote</th><th>Situação</th><th class="fis-num">Pessoas</th><th class="fis-num">Total</th><th>Faturas</th><th>Última mudança</th><th></th></tr></thead>
                            <tbody>${lotes.map(l => `
                                <tr class="cx-lote-linha" onclick="abrirLoteSalarios(${l.id})">
                                    <td><b>${mesSal(l.competencia)}</b></td>
                                    <td>${escFin(l.titulo)}</td>
                                    <td><span class="cx-selo cx-selo-${l.situacao === 'RASCUNHO' ? 'alerta' : 'ok'}">${SITUACAO_LOTE_SAL[l.situacao]}</span>
                                        ${l.em_edicao ? '<span class="cx-selo cx-selo-alerta">alterações não aplicadas</span>' : ''}</td>
                                    <td class="fis-num">${l.linhas}</td>
                                    <td class="fis-num">${dinheiro(l.total)}</td>
                                    <td>${l.faturas ? `${l.faturas} lançadas${l.pagas ? ` · ${l.pagas} pagas` : ''}` : '—'}</td>
                                    <td><small>${escFin(l.atualizado_por || l.criado_por || '')} · ${new Date(l.atualizado_em).toLocaleString('pt-BR')}</small></td>
                                    <td><button type="button" class="fis-mini" title="Começa um lote novo com as mesmas pessoas, valores e categorias"
                                        onclick="event.stopPropagation(); abrirLoteSalarios(null, ${l.id})">Copiar para novo mês</button></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>` : '<div class="fis-vazio">Nenhum lote ainda. Clique em "+ Novo lote": a lista já vem com as pessoas e o último salário de cada uma.</div>'}
                </div>
            </div>`
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- abrir / montar

function linhaDaPessoaSal(p, cab) {
    const valor = Number(p.ultimo_valor) || Number(p.salario_rh) || 0
    return {
        chave: novaChaveSal(), incluir: valor > 0, cliente_id: p.cliente_id, nome: p.nome, documento: p.documento || '',
        app: p.ultimo_app || cab.app, conta_id: p.ultima_conta || null, categoria_id: estadoLoteSal.categoriaSalario,
        valor, vencimento: null, departamento: p.ultimo_departamento || null, forma_pagamento: p.ultima_forma || cab.forma_pagamento || null,
        chave_pix: p.chave_pix || null, observacao: null
    }
}

async function abrirLoteSalarios(id = null, copiarDe = null) {
    overlayAguarde()
    try {
        const [op, base, atual] = await Promise.all([
            carregarOpcoesFin(), apiFin('salarios/base'), id || copiarDe ? apiFin('salarios/lote', { id: id || copiarDe }) : null
        ])
        removerOverlay()
        Object.assign(estadoLoteSal, {
            op, base: new Map(base.pessoas.map(p => [String(p.cliente_id), p])), categoriaSalario: base.categoria_salario_id,
            filtro: '', pendente: false, erro: null, salvoEm: null, faturas: {}, timer: null
        })
        if (id) {
            const l = atual.lote
            const fonte = l.situacao === 'LANCADO' && l.edicao ? l.edicao : l
            Object.assign(estadoLoteSal, {
                id: l.id, versao: atual.versao, situacao: l.situacao, emEdicao: Boolean(l.edicao), faturas: atual.faturas || {},
                titulo: fonte.titulo || l.titulo, competencia: fonte.competencia || l.competencia,
                cabecalho: { ...(fonte.cabecalho || {}) }, itens: (fonte.itens || []).map(i => ({ ...i }))
            })
        } else {
            const hoje = hojeFin()
            const competencia = hoje.slice(0, 7)
            const cab = {
                vencimento: quintoDiaUtilSal(competencia), app: modaSal(base.pessoas.map(p => p.ultimo_app)) || op.empresas[0]?.app || null,
                conta_id: null, forma_pagamento: modaSal(base.pessoas.map(p => p.ultima_forma)), categoria_id: base.categoria_salario_id, observacao: null
            }
            let itens
            if (copiarDe) {
                const l = atual.lote
                const fonte = l.edicao || l
                itens = (fonte.itens || []).map(i => ({ ...i, chave: novaChaveSal(), vencimento: null }))
                Object.assign(cab, { ...(fonte.cabecalho || {}), vencimento: quintoDiaUtilSal(competencia) })
            } else {
                itens = base.pessoas.map(p => linhaDaPessoaSal(p, cab))
            }
            Object.assign(estadoLoteSal, {
                id: null, versao: null, situacao: 'RASCUNHO', emEdicao: false, competencia,
                titulo: `Salários ${mesSal(competencia)}`, cabecalho: cab, itens
            })
        }
        estadoLoteSal.popupId = popup({
            titulo: 'Lote de salários',
            confirmarFechar: false,
            linhas: [{ elemento: '<div class="cx-lote" data-lote-sal></div>' }]
        })
        // Ao fechar o popup, grava o que estiver pendente.
        estadoLoteSal.observador?.disconnect()
        estadoLoteSal.observador = new MutationObserver(() => {
            if (document.getElementById(estadoLoteSal.popupId)) return
            estadoLoteSal.observador.disconnect()
            if (estadoLoteSal.pendente) salvarLoteSal()
            if (document.querySelector('[data-tela-lotes]')) setTimeout(() => telaLotesSalarios(), 400)
        })
        estadoLoteSal.observador.observe(document.body, { childList: true, subtree: true })
        desenharLoteSal()
        // Lote novo já nasce guardado.
        if (!estadoLoteSal.id) agendarSalvarLoteSal(0)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// ---------------- desenho

function desenharLoteSal() {
    const raiz = document.querySelector('[data-lote-sal]')
    if (!raiz) return
    const e = estadoLoteSal
    const op = e.op
    const cab = e.cabecalho
    const lancado = e.situacao === 'LANCADO'
    const apps = [...new Set(e.itens.map(i => i.app).filter(Boolean))].sort()
    const contaDoApp = app => modaSal(e.itens.filter(i => i.app === app).map(i => i.conta_id)) || ''
    raiz.innerHTML = `
        ${lancado ? `<div class="cx-aviso ${e.emEdicao ? 'cx-aviso-alerta' : 'cx-aviso-info'}">${e.emEdicao
            ? '<b>Há alterações ainda não aplicadas às faturas.</b> Elas ficam guardadas até você clicar em "Aplicar alterações" ou "Descartar".'
            : `<b>Lote lançado.</b> Pode editar à vontade: as mudanças ficam pendentes até você aplicar. Faturas já pagas não mudam valor, data, empresa nem categoria.`}</div>` : ''}
        <div class="cx-lote-cab">
            <label class="fis-campo"><span>Nome do lote</span><input class="fis-input" name="titulo" maxlength="120" value="${escFin(e.titulo)}" oninput="editarCabLoteSal(this)"></label>
            <label class="fis-campo"><span>Competência</span><input class="fis-input" type="month" name="competencia" value="${escFin(e.competencia)}" onchange="editarCabLoteSal(this)"></label>
            <label class="fis-campo"><span>Vencimento</span><input class="fis-input" type="date" name="vencimento" value="${escFin(cab.vencimento || '')}" onchange="editarCabLoteSal(this)">
                <small>Vale para as linhas sem data própria. Sugestão: 5º dia útil.</small></label>
            <label class="fis-campo"><span>Forma de pagamento</span>
                <select class="fis-input" name="forma_pagamento" onchange="editarCabLoteSal(this)">
                    <option value="">—</option>${FORMAS_FIN.map(([v, n]) => `<option value="${v}" ${cab.forma_pagamento === v ? 'selected' : ''}>${n}</option>`).join('')}
                </select><small>Muda a de todas as linhas.</small></label>
            ${apps.map(app => `
            <label class="fis-campo"><span>Conta que paga (${escFin(app)})</span>
                <select class="fis-input" data-conta-app="${escFin(app)}" onchange="editarContaAppLoteSal(this)">${opcoesContasFin(op.contas, app, contaDoApp(app))}</select></label>`).join('')}
            <label class="fis-campo cx-lote-obs"><span>Observação nas faturas</span><input class="fis-input" name="observacao" maxlength="500" value="${escFin(cab.observacao || '')}" oninput="editarCabLoteSal(this)"></label>
        </div>
        <div class="cx-lote-barra">
            <input type="search" class="fis-input" placeholder="Filtrar por nome ou CPF…" value="${escFin(e.filtro)}" oninput="estadoLoteSal.filtro = this.value; filtrarLoteSal()">
            <button type="button" class="fis-mini" onclick="marcarTodasLoteSal(true)">Marcar todas</button>
            <button type="button" class="fis-mini" onclick="marcarTodasLoteSal(false)">Desmarcar todas</button>
            <button type="button" class="fis-mini" title="Nas linhas marcadas, valor = salário cadastrado no RH" onclick="valoresLoteSal('rh')">Valor = salário do RH</button>
            <button type="button" class="fis-mini" title="Nas linhas marcadas, valor = último salário lançado para a pessoa" onclick="valoresLoteSal('ultimo')">Valor = último pago</button>
            <div class="fin-escolha cx-lote-busca">
                <input class="fis-input" placeholder="+ Adicionar pessoa (nome ou CPF)…" autocomplete="off" oninput="buscarPessoaLoteSal(this)" onblur="setTimeout(() => { const l = this.nextElementSibling; if (l) l.hidden = true }, 200)">
                <div class="fin-escolha-lista" hidden></div>
            </div>
        </div>
        <datalist id="lote-sal-deps">${(op.departamentos || []).map(d => `<option value="${escFin(d.id)}">${escFin(d.cliente || (d.tipo === 'SETOR' ? 'setor' : ''))}</option>`).join('')}</datalist>
        <div class="fis-tabela-rolagem cx-lote-rolagem">
            <table class="fis-tabela cx-lote-tabela">
                <thead><tr>
                    <th></th><th>Pessoa</th><th class="fis-num">Salário RH</th><th class="fis-num">Último pago</th><th class="fis-num">Valor</th>
                    <th>Empresa</th><th>Categoria</th><th>Departamento</th><th>Vencimento</th><th>Fatura</th><th></th>
                </tr></thead>
                <tbody data-linhas-lote>${e.itens.map(linhaLoteSal).join('')}</tbody>
            </table>
        </div>
        <footer class="cx-lote-rodape">
            <div data-totais-lote></div>
            <div class="cx-lote-status" data-status-lote role="status"></div>
            <div class="cx-lote-botoes">${botoesLoteSal()}</div>
        </footer>`
    filtrarLoteSal()
    escreverTotaisLoteSal()
    escreverStatusLoteSal()
}

function linhaLoteSal(i) {
    const e = estadoLoteSal
    const p = e.base.get(String(i.cliente_id)) || {}
    const f = faturaSal(i)
    const travada = pagaSal(i)
    const trava = travada ? 'disabled' : ''
    const cpf = String(i.documento || '').replace(/\D/g, '')
    return `
        <tr data-chave="${escFin(i.chave)}" class="${i.incluir ? '' : 'cx-lote-fora'}" data-busca="${escFin(normalFin(`${i.nome} ${cpf} ${p.cargo || ''}`))}">
            <td><input type="checkbox" name="incluir" aria-label="Lançar ${escFin(i.nome)}" ${i.incluir ? 'checked' : ''} ${trava} onchange="editarLinhaLoteSal(this)"></td>
            <td class="cx-lote-pessoa"><b>${escFin(i.nome || '—')}</b><small>${escFin([p.cargo, cpf ? `CPF ${cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}` : ''].filter(Boolean).join(' · '))}</small></td>
            <td class="fis-num">${p.salario_rh != null ? dinheiro(p.salario_rh) : '—'}</td>
            <td class="fis-num">${p.ultimo_valor != null ? `${dinheiro(p.ultimo_valor)}<small>${escFin(dataFin(p.ultimo_vencimento))}</small>` : '—'}</td>
            <td class="fis-num"><input class="fis-input fis-num" type="number" min="0" step="0.01" name="valor" value="${Number(i.valor) || ''}" ${trava} oninput="editarLinhaLoteSal(this)"></td>
            <td><select class="fis-input" name="app" ${trava} onchange="editarLinhaLoteSal(this)">${(e.op.empresas || []).map(x => `<option value="${escFin(x.app)}" ${x.app === i.app ? 'selected' : ''}>${escFin(x.app)}</option>`).join('')}</select></td>
            <td><select class="fis-input cx-lote-cat" name="categoria_id" ${trava} onchange="editarLinhaLoteSal(this)">${opcoesCategoriasFin(e.op.categorias || [], 'PAGAR', i.categoria_id)}</select></td>
            <td><input class="fis-input" name="departamento" list="lote-sal-deps" value="${escFin(i.departamento || '')}" placeholder="sem" onchange="editarLinhaLoteSal(this)"></td>
            <td><input class="fis-input" type="date" name="vencimento" value="${escFin(i.vencimento || '')}" title="Em branco: o vencimento do lote" ${trava} onchange="editarLinhaLoteSal(this)"></td>
            <td>${f ? `<span class="fis-link" onclick="abrirFaturaFin('${escFin(f.id)}')">${escFin(situacaoTextoSal(f))}</span>` : '<small>—</small>'}</td>
            <td class="cx-lote-acoes">
                <button type="button" class="fis-mini" title="Outra linha para a mesma pessoa (ex.: adiantamento, vale)" onclick="duplicarLinhaLoteSal('${escFin(i.chave)}')">+</button>
                ${travada ? '' : `<button type="button" class="fis-remover-linha" title="Tirar do lote" aria-label="Tirar do lote" onclick="removerLinhaLoteSal('${escFin(i.chave)}')">${iconeLixeiraFis}</button>`}
            </td>
        </tr>`
}

const situacaoTextoSal = f => f.situacao === 'PAGO' ? 'Paga' : Number(f.pago) > 0 ? 'Paga em parte' : f.situacao === 'ATRASADO' ? 'Atrasada' : 'A pagar'

function botoesLoteSal() {
    const e = estadoLoteSal
    const n = marcadasSal().length
    if (e.situacao === 'RASCUNHO') return `
        ${e.id ? '<button type="button" class="fis-mini" onclick="excluirLoteSal()">Excluir rascunho</button>' : ''}
        <button type="button" class="fis-botao" onclick="lancarLoteSal()">Lançar ${n} fatura${n === 1 ? '' : 's'}</button>`
    return `
        <button type="button" class="fis-mini" onclick="desfazerLoteSal()">Desfazer lançamento</button>
        ${e.emEdicao ? `
        <button type="button" class="fis-mini" onclick="descartarLoteSal()">Descartar alterações</button>
        <button type="button" class="fis-botao" onclick="lancarLoteSal()">Aplicar alterações</button>` : ''}`
}

function escreverTotaisLoteSal() {
    const el = document.querySelector('[data-totais-lote]')
    if (!el) return
    const m = marcadasSal()
    const porApp = new Map()
    for (const i of m) porApp.set(i.app || '?', (porApp.get(i.app || '?') || 0) + Number(i.valor))
    const total = m.reduce((a, i) => a + Number(i.valor), 0)
    el.innerHTML = `<b>${m.length}</b> de ${estadoLoteSal.itens.length} linhas · total <b>${dinheiro(total)}</b>
        ${porApp.size > 1 ? `<small>${[...porApp].map(([a, v]) => `${escFin(a)} ${dinheiro(v)}`).join(' · ')}</small>` : ''}`
    const botoes = document.querySelector('.cx-lote-botoes')
    if (botoes) botoes.innerHTML = botoesLoteSal()
}

function escreverStatusLoteSal() {
    const el = document.querySelector('[data-status-lote]')
    if (!el) return
    const e = estadoLoteSal
    el.className = `cx-lote-status${e.erro ? ' cx-ruim' : ''}`
    el.textContent = e.erro ? `Não salvou: ${e.erro}` : e.salvando || e.pendente ? 'Salvando…'
        : e.salvoEm ? `Guardado às ${e.salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : ''
}

function filtrarLoteSal() {
    const termo = normalFin(estadoLoteSal.filtro).trim()
    document.querySelectorAll('[data-linhas-lote] tr').forEach(tr => { tr.hidden = Boolean(termo) && !tr.dataset.busca.includes(termo) })
}

// ---------------- edição

const itemSal = chave => estadoLoteSal.itens.find(i => i.chave === chave)

function editarCabLoteSal(input) {
    const e = estadoLoteSal
    const v = input.value
    if (input.name === 'titulo') e.titulo = v
    else if (input.name === 'competencia') {
        const antes = e.competencia
        e.competencia = v
        // Vencimento ainda o sugerido do mês anterior: acompanha a competência.
        if (v && e.cabecalho.vencimento === quintoDiaUtilSal(antes || v)) {
            e.cabecalho.vencimento = quintoDiaUtilSal(v)
            const venc = document.querySelector('[data-lote-sal] [name="vencimento"]')
            if (venc) venc.value = e.cabecalho.vencimento
        }
        if (/^Salários \d{2}\/\d{4}$/.test(e.titulo)) {
            e.titulo = `Salários ${mesSal(v)}`
            const t = document.querySelector('[data-lote-sal] [name="titulo"]')
            if (t) t.value = e.titulo
        }
    } else if (input.name === 'forma_pagamento') {
        e.cabecalho.forma_pagamento = v || null
        e.itens.filter(i => !pagaSal(i)).forEach(i => { i.forma_pagamento = v || null })
    } else e.cabecalho[input.name] = v || null
    agendarSalvarLoteSal()
}

function editarContaAppLoteSal(select) {
    const app = select.dataset.contaApp
    estadoLoteSal.itens.filter(i => i.app === app).forEach(i => { i.conta_id = Number(select.value) || null })
    agendarSalvarLoteSal()
}

function editarLinhaLoteSal(input) {
    const tr = input.closest('tr')
    const i = itemSal(tr.dataset.chave)
    if (!i) return
    const campo = input.name
    if (campo === 'incluir') { i.incluir = input.checked; tr.classList.toggle('cx-lote-fora', !input.checked) }
    else if (campo === 'valor') {
        i.valor = Math.max(0, Number(input.value) || 0)
        if (i.valor > 0 && !i.incluir) { i.incluir = true; tr.querySelector('[name="incluir"]').checked = true; tr.classList.remove('cx-lote-fora') }
    } else if (campo === 'categoria_id') i.categoria_id = Number(input.value) || null
    else if (campo === 'app') {
        i.app = input.value
        // Conta da outra empresa não serve: pega a que as outras linhas dessa empresa usam.
        i.conta_id = modaSal(estadoLoteSal.itens.filter(x => x !== i && x.app === i.app).map(x => x.conta_id))
        agendarSalvarLoteSal()
        return desenharLoteSal()
    } else i[campo] = input.value || null
    escreverTotaisLoteSal()
    agendarSalvarLoteSal()
}

function marcarTodasLoteSal(sim) {
    const termo = normalFin(estadoLoteSal.filtro).trim()
    const visiveis = new Set([...document.querySelectorAll('[data-linhas-lote] tr:not([hidden])')].map(tr => tr.dataset.chave))
    estadoLoteSal.itens.filter(i => (!termo || visiveis.has(i.chave)) && !pagaSal(i)).forEach(i => { i.incluir = sim })
    desenharLoteSal()
    agendarSalvarLoteSal()
}

function valoresLoteSal(fonte) {
    let sem = 0
    for (const i of estadoLoteSal.itens.filter(x => x.incluir && !pagaSal(x))) {
        const p = estadoLoteSal.base.get(String(i.cliente_id)) || {}
        const v = fonte === 'rh' ? p.salario_rh : p.ultimo_valor
        if (v == null) { sem++; continue }
        i.valor = Number(v)
    }
    desenharLoteSal()
    agendarSalvarLoteSal()
    if (sem) popup({ mensagem: `${sem} linha(s) marcada(s) sem ${fonte === 'rh' ? 'salário no RH' : 'salário lançado antes'}: ficaram com o valor que já tinham.` })
}

function duplicarLinhaLoteSal(chave) {
    const i = itemSal(chave)
    if (!i) return
    const nova = { ...i, chave: novaChaveSal(), valor: 0, incluir: true, categoria_id: null, vencimento: null, observacao: null }
    estadoLoteSal.itens.splice(estadoLoteSal.itens.indexOf(i) + 1, 0, nova)
    desenharLoteSal()
    agendarSalvarLoteSal()
    document.querySelector(`[data-chave="${CSS.escape(nova.chave)}"] [name="categoria_id"]`)?.focus()
}

function removerLinhaLoteSal(chave) {
    estadoLoteSal.itens = estadoLoteSal.itens.filter(i => i.chave !== chave)
    desenharLoteSal()
    agendarSalvarLoteSal()
}

let buscaPessoaSalTimer = null
function buscarPessoaLoteSal(input) {
    clearTimeout(buscaPessoaSalTimer)
    const lista = input.nextElementSibling
    const termo = input.value.trim()
    if (termo.length < 2) { lista.hidden = true; return }
    buscaPessoaSalTimer = setTimeout(async () => {
        try {
            const { participantes } = await apiFin('participantes', { termo })
            lista.innerHTML = participantes.map(p => `
                <button type="button" class="fin-escolha-item" onmousedown="event.preventDefault(); adicionarPessoaLoteSal(${escFin(JSON.stringify(p))}, this)">
                    <b>${escFin(p.nome || p.razao_social)}</b> <span>${escFin(p.cnpj || '')}${p.cidade ? ` · ${escFin(p.cidade)}` : ''}</span>
                </button>`).join('') || '<div class="fin-escolha-vazio">Ninguém com esse nome ou CPF no cadastro.</div>'
            lista.hidden = false
        } catch (err) {
            lista.innerHTML = `<div class="fin-escolha-vazio">${escFin(err.message)}</div>`
            lista.hidden = false
        }
    }, 250)
}

function adicionarPessoaLoteSal(p, botao) {
    const e = estadoLoteSal
    const base = e.base.get(String(p.id)) || { cliente_id: String(p.id), nome: p.nome || p.razao_social, documento: p.cnpj, chave_pix: p.chave_pix }
    const linha = linhaDaPessoaSal(base, e.cabecalho)
    linha.incluir = true
    e.itens.push(linha)
    const caixa = botao.closest('.fin-escolha')
    caixa.querySelector('input').value = ''
    caixa.querySelector('.fin-escolha-lista').hidden = true
    desenharLoteSal()
    agendarSalvarLoteSal()
    document.querySelector(`[data-chave="${CSS.escape(linha.chave)}"] [name="valor"]`)?.focus()
}

// ---------------- salvar sozinho

function agendarSalvarLoteSal(espera = 700) {
    estadoLoteSal.pendente = true
    estadoLoteSal.erro = null
    escreverStatusLoteSal()
    clearTimeout(estadoLoteSal.timer)
    estadoLoteSal.timer = setTimeout(() => salvarLoteSal(), espera)
}

// Uma gravação por vez; o que mudar durante a gravação vai na seguinte.
async function salvarLoteSal() {
    const e = estadoLoteSal
    clearTimeout(e.timer)
    if (e.salvando) { await e.salvando.catch(() => { }); if (!e.pendente) return }
    e.pendente = false
    const corpo = {
        id: e.id, versao: e.versao, titulo: e.titulo, competencia: e.competencia,
        cabecalho: e.cabecalho, itens: e.itens
    }
    e.salvando = apiFin('salarios/salvar', corpo)
    escreverStatusLoteSal()
    try {
        const r = await e.salvando
        e.id = r.id
        e.versao = r.versao
        e.salvoEm = new Date()
        if (r.situacao === 'LANCADO' && !e.emEdicao) {
            e.emEdicao = true
            const raiz = document.querySelector('[data-lote-sal]')
            if (raiz) desenharLoteSal()
        }
    } catch (err) {
        e.erro = err.message
        e.pendente = true
        if (err.status === 409) popup({ mensagem: escFin(err.message) })
    } finally {
        e.salvando = null
        escreverStatusLoteSal()
        if (e.pendente && !e.erro) agendarSalvarLoteSal()
    }
}

async function garantirSalvoLoteSal() {
    if (estadoLoteSal.pendente || estadoLoteSal.salvando) await salvarLoteSal()
    if (estadoLoteSal.salvando) await estadoLoteSal.salvando.catch(() => { })
    if (estadoLoteSal.erro) throw new Error(estadoLoteSal.erro)
}

// ---------------- ações

async function lancarLoteSal() {
    const e = estadoLoteSal
    const m = marcadasSal()
    const total = m.reduce((a, i) => a + Number(i.valor), 0)
    const semVenc = m.filter(i => !i.vencimento && !e.cabecalho.vencimento).length
    if (semVenc) return popup({ mensagem: 'Informe o vencimento do lote (ou de cada linha).' })
    const aplicar = e.situacao === 'LANCADO'
    const ok = await confirmarPopup({
        titulo: aplicar ? 'Aplicar alterações' : 'Lançar o lote',
        mensagem: aplicar
            ? `As faturas do lote vão ficar iguais à lista: ${m.length} linhas, total ${dinheiro(total)}. Faturas de linhas tiradas são canceladas.`
            : `Lançar ${m.length} fatura${m.length === 1 ? '' : 's'} a pagar, total ${dinheiro(total)}, vencendo em ${dataFin(e.cabecalho.vencimento)}${m.some(i => i.vencimento) ? ' (algumas com data própria)' : ''}?`,
        textoConfirmar: aplicar ? 'Aplicar' : 'Lançar'
    })
    if (!ok) return
    overlayAguarde()
    try {
        await garantirSalvoLoteSal()
        const r = await apiFin('salarios/lancar', { id: e.id })
        removerOverlay()
        await recarregarLoteSal()
        popup({
            imagem: 'imagens/concluido.png', tempo: 5,
            mensagem: `${r.criadas ? `${r.criadas} fatura(s) criada(s). ` : ''}${r.alteradas ? `${r.alteradas} conferida(s)/atualizada(s). ` : ''}${r.canceladas ? `${r.canceladas} cancelada(s).` : ''}`
        })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function recarregarLoteSal() {
    const r = await apiFin('salarios/lote', { id: estadoLoteSal.id })
    const l = r.lote
    const fonte = l.situacao === 'LANCADO' && l.edicao ? l.edicao : l
    Object.assign(estadoLoteSal, {
        versao: r.versao, situacao: l.situacao, emEdicao: Boolean(l.edicao), faturas: r.faturas || {},
        titulo: fonte.titulo || l.titulo, competencia: fonte.competencia || l.competencia,
        cabecalho: { ...(fonte.cabecalho || {}) }, itens: (fonte.itens || []).map(i => ({ ...i })), pendente: false, erro: null
    })
    desenharLoteSal()
    if (document.querySelector('[data-tela-lotes]')) telaLotesSalarios()
}

async function descartarLoteSal() {
    if (!await confirmarPopup({ titulo: 'Descartar alterações', mensagem: 'O lote volta a ficar igual às faturas lançadas.', textoConfirmar: 'Descartar' })) return
    overlayAguarde()
    try {
        clearTimeout(estadoLoteSal.timer)
        estadoLoteSal.pendente = false
        if (estadoLoteSal.salvando) await estadoLoteSal.salvando.catch(() => { })
        await apiFin('salarios/descartar', { id: estadoLoteSal.id })
        removerOverlay()
        await recarregarLoteSal()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function desfazerLoteSal() {
    const motivo = await pedirTextoPopup({
        titulo: 'Desfazer o lançamento',
        mensagem: 'Todas as faturas do lote são canceladas e ele volta a ser rascunho (com as pessoas e valores de agora). Só dá se nenhuma tiver pagamento. Motivo:',
        minimo: 5, maximo: 250, textoConfirmar: 'Desfazer'
    })
    if (!motivo) return
    overlayAguarde()
    try {
        await garantirSalvoLoteSal()
        const r = await apiFin('salarios/desfazer', { id: estadoLoteSal.id, motivo })
        removerOverlay()
        await recarregarLoteSal()
        popup({ mensagem: `${r.canceladas} fatura(s) cancelada(s). O lote voltou a ser rascunho.` })
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function excluirLoteSal() {
    if (!await confirmarPopup({ titulo: 'Excluir rascunho', mensagem: 'O rascunho some da lista de lotes. Nenhuma fatura é afetada.', textoConfirmar: 'Excluir' })) return
    overlayAguarde()
    try {
        clearTimeout(estadoLoteSal.timer)
        estadoLoteSal.pendente = false
        if (estadoLoteSal.salvando) await estadoLoteSal.salvando.catch(() => { })
        await apiFin('salarios/excluir', { id: estadoLoteSal.id })
        removerOverlay()
        removerPopup(estadoLoteSal.popupId)
        if (document.querySelector('[data-tela-lotes]')) telaLotesSalarios()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}
