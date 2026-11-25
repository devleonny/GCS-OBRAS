// Conciliação bancária (Financeiro → Conciliação Bancária), layout financeiro. 24/11/2026.
// Servidor: gcs SCRIPTS/financeiro_conciliacao.js (rotas /financeiro/conciliacao/*), migrations/financeiro-conciliacao.sql.
//
// Conta do banco (ex.: Itaú 4695) = as contas correntes das empresas que usam a mesma conta (IAC, AC, HNK, HNW).
// O extrato entra por OFX (vários arquivos de uma vez; linha repetida é ignorada). Cada linha casa com uma ou mais
// baixas: sozinha (mesmo valor e data, sem outra opção), por sugestão, ou resolvida aqui (dar baixa numa fatura em
// aberto, lançar tarifa/IOF, transferência entre contas, fora do Financeiro). Fechar até uma data: tudo casado até ali;
// o saldo do banco vira o saldo conferido (Fluxo de Caixa) e as baixas até a data travam.

const estadoConc = { painel: false, conta: null, mes: null, filtro: 'TODAS', busca: '', sel: null, aba: null }
let contasConcCache = null
let dadosConc = null
let detalheConc = null
let arquivosConc = []

const SITUACOES_CONC = {
    CASADA: ['Casada', 'cc-chip-casada'],
    SUGESTAO: ['Sugestão', 'cc-chip-sugestao'],
    SEM_PAR: ['Sem par', 'cc-chip-sempar'],
    IGNORADA: ['Fora do Financeiro', 'cc-chip-ignorada'],
    SO_GCS: ['Só no GCS', 'cc-chip-gcs']
}
const chipConc = s => {
    const [t, c] = SITUACOES_CONC[s] || [s, '']
    return `<span class="cc-chip ${c}">${escFin(t)}</span>`
}
// Situação na lista e no cartão da linha: só o ícone (o nome fica na dica e no leitor de tela).
const ICONES_SITUACAO_CONC = {
    CASADA: '<path d="M7 12.5l3.2 3.2L17 9"/>',
    SEM_PAR: '<path d="M8.5 8.5l7 7M15.5 8.5l-7 7"/>',
    SUGESTAO: '<path d="M13 5l-5 8h4l-1 6 5-8h-4z"/>',
    IGNORADA: '<path d="M8 12h8"/>',
    SO_GCS: '<path d="M12 7.5v5.5"/><circle cx="12" cy="16.3" r="0.6"/>'
}
const iconeSitConc = s => {
    const [t] = SITUACOES_CONC[s] || [s]
    return `<span class="cc-sit cc-sit-${String(s).toLowerCase()}" title="${escFin(t)}" role="img" aria-label="${escFin(t)}">
        <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES_SITUACAO_CONC[s] || ''}</svg></span>`
}
const mesNomeConc = m => {
    const [a, n] = String(m || '').split('-')
    return a ? `${['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][Number(n) - 1]}/${a}` : ''
}
const sinalConc = v => `<span class="${Number(v) < 0 ? 'cc-debito' : 'cc-credito'}">${Number(v) < 0 ? '−' : '+'} ${dinheiro(Math.abs(Number(v)))}</span>`
const ontemConc = () => { const d = new Date(`${hojeFin()}T12:00:00`); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10) }

async function acaoConc(rota, corpo, depois = null, mensagemOk = null) {
    try {
        overlayAguarde()
        const r = await apiFin(`conciliacao/${rota}`, corpo)
        removerOverlay()
        if (depois) await depois(r)
        if (mensagemOk) popup({ mensagem: typeof mensagemOk === 'function' ? mensagemOk(r) : mensagemOk, tempo: 3 })
        return r
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
        return null
    }
}

// Mesma janela das Faturas do cartão: título em cima, painel de ações à direita (recolhe pela seta).
function janelaConc(titulo, principal, painel) {
    return `
        <div class="fis-pagina fin-tela cc-tela">
            <section class="fin-janela">
                <header class="fin-janela-topo"><h2>${titulo}</h2></header>
                <div class="fin-corpo${estadoConc.painel ? '' : ' recolhido'}" data-corpo-conc>
                    <div class="fin-tabela-area">${principal}</div>
                    <div class="fin-lateral">
                        <button type="button" class="fin-recolher" onclick="alternarPainelConc()" aria-expanded="${estadoConc.painel}"
                            title="${estadoConc.painel ? 'Recolher' : 'Mostrar'} as ações e informações">${iconeFin('seta')}</button>
                        <aside class="fin-painel cf-painel">${painel}</aside>
                    </div>
                </div>
            </section>
        </div>`
}

function alternarPainelConc() {
    const corpo = document.querySelector('[data-corpo-conc]')
    if (!corpo) return
    estadoConc.painel = corpo.classList.contains('recolhido')
    corpo.classList.toggle('recolhido', !estadoConc.painel)
    corpo.querySelector('.fin-recolher')?.setAttribute('aria-expanded', String(estadoConc.painel))
}

// ------------------------------------------------------------ contas (entrada pelo menu)

function telaConciliacaoFin() {
    recolherMenuPrincipalFin()
    estadoConc.painel = true
    return telaContasConc()
}

async function telaContasConc(todas = false) {
    overlayAguarde()
    try {
        const dados = await apiFin('conciliacao/contas', { todas })
        removerOverlay()
        contasConcCache = dados
        desenharContasConc(todas)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

function desenharContasConc(todas) {
    const { contas, importacoes } = contasConcCache
    const diaUtil = ![0, 6].includes(new Date(`${hojeFin()}T12:00:00`).getDay())
    const semHoje = diaUtil ? contas.filter(c => !c.importou_hoje) : []
    const pendentes = contas.reduce((a, c) => a + c.pendentes + c.so_gcs, 0)
    // Conta com dígito: 961211 → 96121-1.
    const contaDv = v => String(v || '').length > 1 ? `${String(v).slice(0, -1)}-${String(v).slice(-1)}` : String(v || '')
    const cartao = c => {
        const conferida = Boolean(c.conferida_ate)
        const total = c.casadas + c.pendentes + c.ignoradas
        const pct = n => total ? Math.round(n * 100 / total) : 0
        const dif = Number(c.diferenca || 0)
        const principal = (c.contas.find(k => String(k.id) === String(c.conta_principal_id)) || c.contas[0] || {}).app || '?'
        const ult = c.ultima_importacao
        const topo = `
                <div class="cc-cartao-topo">
                    <span class="fin-avatar">${escFin(principal)}</span>
                    <div class="cc-cartao-nome">
                        <b>${escFin(c.nome)}</b>
                        <small>Banco ${escFin(c.banco)} · ag. ${escFin(c.agencia || '—')} · c/c ${escFin(contaDv(c.conta))}</small>
                    </div>
                    <button type="button" class="fis-mini cc-editar" title="Dados e contas correntes ligadas" onclick="formularioContaBancoConc(${c.id})">${iconeFin('editar')}</button>
                </div>`
        const rodape = `
                <div class="cc-cartao-rodape">
                    <small>${conferida ? `Conferida até <b>${dataFin(c.conferida_ate)}</b>` : 'Ainda não fechada'} · desde ${dataFin(c.corte)}</small>
                    <button type="button" class="fis-botao" onclick="abrirConciliarConc(${c.id})">Conciliar</button>
                </div>`
        // Sem extrato: no lugar de saldos e contadores vazios, o passo seguinte.
        if (!ult) return `
            <section class="cc-cartao">
                ${topo}
                <div class="cc-vazio-cartao">
                    <span>${iconeFin('baixar')}</span>
                    <div><b>Nenhum extrato importado</b><small>Importe o OFX desta conta para começar a conciliar.</small></div>
                    <button type="button" class="fis-mini" onclick="importarOfxConc()">Importar OFX</button>
                </div>
                ${rodape}
            </section>`
        const ok = Math.abs(dif) < 0.005
        return `
            <section class="cc-cartao">
                ${topo}
                <div class="cc-ultimo ${semHoje.includes(c) ? 'cc-ultimo-atrasado' : ''}">
                    ${iconeFin('relogio')} Último extrato ${new Date(ult.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${ult.criado_por ? ` por ${escFin(ult.criado_por)}` : ''}
                    ${semHoje.includes(c) ? '<b>· falta o de hoje</b>' : ''}
                </div>
                <div class="cc-saldos">
                    <div><small>Banco</small><b>${c.saldo_banco != null ? dinheiro(c.saldo_banco) : '—'}</b></div>
                    <div><small>GCS</small><b>${conferida ? dinheiro(c.saldo_gcs) : '<span class="cc-cinza" title="O saldo do GCS só vale depois do primeiro fechamento">a conferir</span>'}</b></div>
                    <div class="${ok ? 'cc-saldo-ok' : 'cc-saldo-falta'}"><small>Falta explicar</small><b>${ok ? '✔ R$ 0,00' : dinheiro(dif)}</b></div>
                </div>
                <small class="cc-saldos-dia">Saldos no fim de ${dataFin(c.saldo_dia)}</small>
                <div class="cc-progresso">
                    <div class="cc-barra" title="Casadas / fora do Financeiro / pendentes"><span style="width:${pct(c.casadas)}%"></span><span class="cc-barra-ign" style="width:${pct(c.ignoradas)}%"></span></div>
                    <small>${pct(c.casadas + c.ignoradas)}% resolvido</small>
                </div>
                <div class="cc-chips">
                    <span class="cc-chip cc-chip-casada">Casadas ${c.casadas}</span>
                    <span class="cc-chip cc-chip-sempar">Pendentes ${c.pendentes}</span>
                    <span class="cc-chip cc-chip-gcs">Só no GCS ${c.so_gcs}</span>
                    ${c.ignoradas ? `<span class="cc-chip cc-chip-ignorada">Fora do Financeiro ${c.ignoradas}</span>` : ''}
                </div>
                ${rodape}
            </section>`
    }
    const painel = `
        ${cabecaPainelCartaoFin(String(contas.length), `${contas.length} conta${contas.length === 1 ? '' : 's'} do banco`, `<small>${pendentes} pendência${pendentes === 1 ? '' : 's'} no período aberto</small>`)}
        ${acaoPainelCartaoFin('baixar', 'Importar OFX', 'importarOfxConc()')}
        ${acaoPainelCartaoFin('relogio', todas ? 'Só as últimas importações' : 'Todas as importações', `telaContasConc(${!todas})`)}
        ${acaoPainelCartaoFin('incluir', 'Nova conta do banco', 'formularioContaBancoConc()')}
        ${acaoPainelCartaoFin('editar', 'Contas Correntes', 'telaContasFin()')}
        <hr>
        <small class="cc-nota">Conta com tudo casado até uma data e fechada entra com saldo conferido no Fluxo de Caixa.</small>`
    tela.innerHTML = janelaConc('Conciliação bancária', `
        ${semHoje.length ? `
        <div class="cc-aviso" role="status">
            <span class="cc-aviso-icone">${iconeFin('alerta')}</span>
            <div class="cc-aviso-texto">
                <b>Extrato de hoje (${dataFin(hojeFin())}) ainda não importado${semHoje.length === contas.length && contas.length > 1 ? ' em nenhuma conta' : ` em ${semHoje.length} conta${semHoje.length === 1 ? '' : 's'}`}</b>
                <div class="cc-aviso-contas">${semHoje.map(c => `<span>${escFin(c.nome)}</span>`).join('')}</div>
            </div>
            <button type="button" class="fis-botao" onclick="importarOfxConc()">Importar OFX</button>
        </div>` : ''}
        <div class="cc-cartoes">${contas.map(cartao).join('') || '<div class="fis-vazio">Nenhuma conta do banco cadastrada. Use "Nova conta do banco" no painel.</div>'}</div>
        <section class="cc-bloco">
            <div class="cc-bloco-topo"><b>${todas ? 'Todas as importações' : 'Últimas importações'}</b><small>linha repetida é ignorada (mesmo dia, valor e descrição)</small></div>
            <div class="fis-tabela-rolagem">
                <table class="fis-tabela fin-extrato cc-tabela">
                    <thead><tr><th>Quando</th><th>Conta</th><th>Arquivo</th><th>Período</th><th class="fis-num">Novas</th><th class="fis-num">Já importadas</th><th class="fis-num">Saldo do arquivo</th><th>Quem</th></tr></thead>
                    <tbody>${importacoes.map(i => `
                        <tr>
                            <td>${new Date(i.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                            <td>${escFin(i.conta)}</td>
                            <td title="${escFin(i.arquivo || '')}">${escFin(i.arquivo || '—')}</td>
                            <td>${dataFin(i.de)} a ${dataFin(i.ate)}</td>
                            <td class="fis-num"><b>${i.novas}</b></td>
                            <td class="fis-num">${i.repetidas}</td>
                            <td class="fis-num">${i.saldo_banco != null ? `${dinheiro(i.saldo_banco)} <small class="cf-sub">em ${dataFin(i.saldo_data)}</small>` : '—'}</td>
                            <td>${escFin(i.criado_por || '')}</td>
                        </tr>`).join('') || '<tr><td colspan="8" class="fis-vazio">Nenhum extrato importado ainda.</td></tr>'}</tbody>
                </table>
            </div>
        </section>`, painel)
}

// ------------------------------------------------------------ cadastro da conta do banco

async function formularioContaBancoConc(id = null, preencher = {}) {
    if (!contasConcCache) {
        try { overlayAguarde(); contasConcCache = await apiFin('conciliacao/contas'); removerOverlay() } catch (err) { removerOverlay(); return popup({ mensagem: mensagemErroEst(err) }) }
    }
    const c = id ? contasConcCache?.contas.find(x => String(x.id) === String(id)) : null
    const ligadas = new Set((c?.contas || []).map(k => String(k.id)))
    const v = c || preencher
    const correntes = contasConcCache?.correntes || []
    popup({
        titulo: c ? `Conta do banco · ${c.nome}` : 'Nova conta do banco',
        elemento: `
            <div class="fis-form cc-form" data-conta-banco="${c ? c.id : ''}">
                <div class="fis-grade">
                    <label class="fis-campo fis-largo"><span>Nome</span><input class="fis-input" name="nome" maxlength="80" value="${escFin(v.nome || '')}" placeholder="Ex.: Itaú 4695 · IAC"></label>
                </div>
                <div class="fis-grade">
                    <label class="fis-campo"><span>Banco (código)</span><input class="fis-input" name="banco" maxlength="5" value="${escFin(v.banco || '')}" placeholder="341"></label>
                    <label class="fis-campo"><span>Agência</span><input class="fis-input" name="agencia" maxlength="10" value="${escFin(v.agencia || '')}"></label>
                    <label class="fis-campo"><span>Conta (com dígito)</span><input class="fis-input" name="conta" maxlength="20" value="${escFin(v.conta || '')}"></label>
                    <label class="fis-campo"><span>Conciliar a partir de</span><input class="fis-input" type="date" name="corte" value="${escFin(v.corte || '2026-01-01')}" ${c?.conferida_ate ? 'disabled title="Já tem período fechado"' : ''}></label>
                </div>
                <b class="cc-form-titulo">Contas correntes do Financeiro que usam esta conta</b>
                <small>Marque a de cada empresa que paga ou recebe por ela. A principal (titular) recebe o saldo conferido no fechamento.</small>
                <div class="cc-ligadas">
                    ${correntes.map(k => {
                        const outra = k.conta_bancaria_id && (!c || String(k.conta_bancaria_id) !== String(c.id))
                        return `
                        <div class="cc-ligada ${outra ? 'cc-cinza' : ''}">
                            <label class="fis-check"><input type="checkbox" name="ligada" value="${k.id}" ${ligadas.has(String(k.id)) ? 'checked' : ''} ${outra ? 'disabled' : ''}>
                                <b>${escFin(k.app)}</b> · ${escFin(k.nome)} <small>${escFin([k.banco, k.agencia, k.conta].filter(Boolean).join(' / '))}${outra ? ' · já ligada a outra conta do banco' : ''}${k.caixa === false ? ' · técnica' : ''}</small></label>
                            <label class="fis-check cc-principal" title="Conta principal (titular)"><input type="radio" name="principal" value="${k.id}" ${String(c?.conta_principal_id) === String(k.id) ? 'checked' : ''} ${outra ? 'disabled' : ''}> principal</label>
                        </div>`
                    }).join('')}
                </div>
            </div>`,
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarContaBancoConc(this)' }]
    })
}

async function salvarContaBancoConc(botao) {
    const f = document.querySelector('[data-conta-banco]')
    const v = n => f.querySelector(`[name="${n}"]`)?.value || ''
    const contas = [...f.querySelectorAll('[name="ligada"]:checked')].map(i => i.value)
    const principal = f.querySelector('[name="principal"]:checked')?.value || contas[0]
    const r = await acaoConc('salvarConta', {
        id: f.dataset.contaBanco || null, nome: v('nome'), banco: v('banco'), agencia: v('agencia'), conta: v('conta'),
        corte: v('corte'), contas, conta_principal_id: principal
    })
    if (!r) return
    removerPopup(botao?.closest('.popup')?.id)
    if (arquivosConc.some(a => a.desconhecida)) return reenviarDesconhecidosConc(r.id)
    if (dadosConc && estadoConc.conta && document.querySelector('[data-conciliar]')) return telaConciliarConc()
    telaContasConc()
}

// ------------------------------------------------------------ importar OFX

function importarOfxConc() {
    arquivosConc = []
    popup({
        titulo: 'Importar extrato (OFX)',
        elemento: `
            <div class="cc-importar" data-importar-conc>
                <label class="cc-soltar" ondragover="event.preventDefault(); this.classList.add('cc-soltar-sobre')" ondragleave="this.classList.remove('cc-soltar-sobre')"
                    ondrop="event.preventDefault(); this.classList.remove('cc-soltar-sobre'); lerArquivosOfxConc(event.dataTransfer.files)">
                    ${iconeFin('salvar')}
                    <b>Arraste os arquivos OFX aqui ou clique para escolher</b>
                    <small>Pode mandar vários de uma vez (as contas e os meses que quiser). A conta e o período saem do próprio arquivo.<br>
                        Dica: baixe sempre os últimos 7 dias; o que já foi importado é ignorado.</small>
                    <input type="file" multiple accept=".ofx,.OFX" hidden onchange="lerArquivosOfxConc(this.files); this.value = ''">
                </label>
                <div class="cc-resultados" data-resultados-conc></div>
            </div>`,
        botoes: [{ texto: 'Ir para a conciliação', img: 'concluido', funcao: 'irDaImportacaoConc(this)' }]
    })
}

// OFX 1.x costuma vir em Windows-1252 (CHARSET:1252); 2.x em UTF-8.
async function textoOfxConc(arquivo) {
    const bytes = new Uint8Array(await arquivo.arrayBuffer())
    const cabeca = new TextDecoder('latin1').decode(bytes.slice(0, 400))
    if (/CHARSET:\s*(1252|ISO-?8859)/i.test(cabeca) || /encoding="(windows-1252|iso-8859-1)"/i.test(cabeca)) return new TextDecoder('windows-1252').decode(bytes)
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) } catch { return new TextDecoder('windows-1252').decode(bytes) }
}

async function lerArquivosOfxConc(lista) {
    const arquivos = [...(lista || [])]
    if (!arquivos.length) return
    const lidos = []
    for (const a of arquivos) lidos.push({ nome: a.name, texto: await textoOfxConc(a) })
    const r = await acaoConc('importar', { arquivos: lidos })
    if (!r) return
    for (const [i, res] of r.resultados.entries()) arquivosConc.push({ ...res, texto: lidos[i].texto })
    desenharResultadosConc()
}

function desenharResultadosConc() {
    const caixa = document.querySelector('[data-resultados-conc]')
    if (!caixa) return
    const contas = contasConcCache?.contas || []
    caixa.innerHTML = arquivosConc.map((r, i) => {
        if (r.erro) return `<div class="cc-res cc-res-erro"><b>${escFin(r.arquivo)}</b><small>${escFin(r.erro)}</small></div>`
        if (r.desconhecida) return `
            <div class="cc-res cc-res-neutro">
                <b>Banco ${escFin(r.banco)} · ag. ${escFin(r.agencia || '—')} · conta ${escFin(r.conta)} (não cadastrada)</b>
                <small>${r.linhas} linhas de ${dataFin(r.de)} a ${dataFin(r.ate)} · ${escFin(r.arquivo)}. Esta conta não está ligada a nenhuma conta do banco aqui.</small>
                <div class="cc-res-acoes">
                    ${contas.length ? `<select class="fis-input" data-ligar="${i}"><option value="">É a conta…</option>${contas.map(c => `<option value="${c.id}">${escFin(c.nome)}</option>`).join('')}</select>
                        <button type="button" class="fis-mini" onclick="reenviarDesconhecidosConc(document.querySelector('[data-ligar=&quot;${i}&quot;]').value, ${i})">Importar nela</button>` : ''}
                    <button type="button" class="fis-mini" onclick="formularioContaBancoConc(null, { banco: '${escFin(r.banco)}', agencia: '${escFin(r.agencia)}', conta: '${escFin(r.conta)}' })">Cadastrar conta do banco</button>
                </div>
            </div>`
        const alerta = r.falta || r.saldo_confere === false
        return `
            <div class="cc-res ${alerta ? 'cc-res-erro' : 'cc-res-ok'}">
                <b>${escFin(r.conta)} · ${dataFin(r.de)} a ${dataFin(r.ate)}</b>
                <small>${r.linhas} linhas: <b>${r.novas} novas</b>, ${r.repetidas} já importadas${r.automaticas ? ` · ${r.automaticas} casada${r.automaticas === 1 ? '' : 's'} sozinha${r.automaticas === 1 ? '' : 's'}` : ''}
                    ${r.saldo != null ? ` · saldo do banco ${dinheiro(r.saldo)} em ${dataFin(r.saldo_data)}${r.saldo_confere === true ? ' (confere com o já importado)' : r.saldo_confere === false ? ' · <b>não confere com o já importado: falta linha?</b>' : ''}` : ''}
                    ${r.falta ? ` · <b>faltam dias</b>: o extrato anterior terminou antes. Baixe de ${dataFin(r.falta.de)} a ${dataFin(r.falta.ate)} também.` : ''}</small>
                <small class="cc-cinza">${escFin(r.arquivo)}</small>
            </div>`
    }).join('')
}

// Arquivos de conta não reconhecida: manda de novo dizendo qual é a conta do banco.
async function reenviarDesconhecidosConc(contaId, so = null) {
    if (!contaId) return popup({ mensagem: 'Escolha a conta do banco' })
    const alvo = arquivosConc.map((a, i) => ({ a, i })).filter(({ a, i }) => a.desconhecida && (so == null || i === so))
    if (!alvo.length) return
    const r = await acaoConc('importar', { conta_bancaria_id: contaId, arquivos: alvo.map(({ a }) => ({ nome: a.arquivo, texto: a.texto })) })
    if (!r) return
    r.resultados.forEach((res, j) => { arquivosConc[alvo[j].i] = { ...res, texto: alvo[j].a.texto } })
    await telaContasConc().catch(() => { })
    desenharResultadosConc()
}

function irDaImportacaoConc(botao) {
    const ok = arquivosConc.filter(a => a.conta_bancaria_id)
    removerPopup(botao?.closest('.popup')?.id)
    if (!ok.length) return telaContasConc()
    const ultimo = ok[ok.length - 1]
    abrirConciliarConc(ultimo.conta_bancaria_id, String(ultimo.ate || ultimo.de || hojeFin()).slice(0, 7))
}

// ------------------------------------------------------------ conciliar uma conta

function abrirConciliarConc(id, mes = null) {
    recolherMenuPrincipalFin()
    estadoConc.conta = id
    estadoConc.mes = mes
    estadoConc.filtro = 'TODAS'
    estadoConc.busca = ''
    estadoConc.sel = null
    return telaConciliarConc()
}

async function telaConciliarConc(manterSel = true) {
    overlayAguarde()
    try {
        const [dados] = await Promise.all([apiFin('conciliacao/linhas', { conta_bancaria_id: estadoConc.conta, mes: estadoConc.mes }), carregarOpcoesFin()])
        removerOverlay()
        dadosConc = dados
        estadoConc.mes = dados.mes
        if (!manterSel) estadoConc.sel = null
        // A linha escolhida pode ter sido resolvida: escolhe a próxima pendente.
        const linhas = linhasConc()
        if (estadoConc.sel && !linhas.some(l => l.chave === estadoConc.sel)) estadoConc.sel = null
        if (!estadoConc.sel) estadoConc.sel = (linhas.find(l => ['SUGESTAO', 'SEM_PAR'].includes(l.sit)) || {}).chave || null
        desenharConciliarConc()
        if (estadoConc.sel) escolherLinhaConc(estadoConc.sel, false)
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

// Linhas do extrato + baixas só no GCS numa lista só (o filtro "Só no GCS" mostra estas).
function linhasConc() {
    const d = dadosConc
    const ext = d.linhas.map(l => ({
        ...l, chave: `l${l.id}`, gcs: false,
        sit: l.situacao === 'CASADA' ? 'CASADA' : l.situacao === 'IGNORADA' ? 'IGNORADA' : (l.sugestoes || []).length ? 'SUGESTAO' : 'SEM_PAR'
    }))
    const gcs = d.so_gcs.map(b => ({
        chave: `b${b.id}`, gcs: true, sit: 'SO_GCS', id: b.id, data: b.data, valor: b.mov, baixa: b,
        descricao: [b.participante_nome, b.descricao].filter(Boolean).join(' · ') || `Fatura ${b.titulo_id}`, documento: b.documento
    }))
    return [...ext, ...gcs].sort((a, b) => a.data.localeCompare(b.data) || (a.gcs - b.gcs))
}

function filtrarLinhasConc(linhas) {
    const f = estadoConc.filtro
    const termo = normalFin(estadoConc.busca)
    return linhas.filter(l => (f === 'TODAS' || l.sit === f)
        && (!termo || normalFin(`${l.descricao} ${l.documento || ''} ${Math.abs(l.valor).toFixed(2).replace('.', ',')} ${Math.abs(l.valor).toFixed(2)}`).includes(termo)))
}

function desenharConciliarConc() {
    const d = dadosConc
    const c = d.conta
    const todas = linhasConc()
    const conta = s => todas.filter(l => s === 'TODAS' || l.sit === s).length
    const unicas = d.linhas.filter(l => l.unica && !l.fechada).length
    const falta = Number(d.falta_explicar || 0)
    const meses = [...new Set([d.mes, ...d.meses, hojeFin().slice(0, 7)])].sort().reverse()
    const sugestaoFechar = d.ultima_linha && d.ultima_linha < hojeFin() ? d.ultima_linha : ontemConc()
    const painel = `
        ${cabecaPainelCartaoFin((c.contas.find(k => String(k.id) === String(c.conta_principal_id)) || c.contas[0] || {}).app || '?', `${c.nome} · ${mesNomeConc(d.mes)}`,
            `<small>${c.conferida_ate ? `conferida até ${dataFin(c.conferida_ate)}` : `ainda não fechada · corte ${dataFin(c.corte)}`}</small>`)}
        <div class="cf-infos">
            ${infoPainelCartaoFin(`Saldo do banco (${dataFin(d.saldo_dia)})`, d.saldo_banco != null ? dinheiro(d.saldo_banco) : '—')}
            ${infoPainelCartaoFin(`Saldo do GCS (${dataFin(d.saldo_dia)})`, c.conferida_ate ? dinheiro(d.saldo_gcs) : 'a conferir')}
            ${infoPainelCartaoFin('Falta explicar no mês', Math.abs(falta) < 0.005 ? '✔ R$ 0,00' : dinheiro(falta), Math.abs(falta) < 0.005 ? 'cf-ok' : 'cf-falta')}
        </div>
        <hr>
        ${acaoPainelCartaoFin('check', unicas ? `Confirmar ${unicas} sugestões` : 'Confirmar sugestões', 'confirmarSugestoesConc()', { ativo: unicas > 0, motivo: 'nenhuma sugestão única neste mês' })}
        ${acaoPainelCartaoFin('baixar', 'Importar OFX', 'importarOfxConc()')}
        <hr>
        <div class="cc-fechar" title="Fechado: as baixas até a data travam e a conta entra conferida no Fluxo de Caixa">
            <small>Fechar o período até</small>
            <div class="cc-fechar-linha">
                <input class="fis-input" type="date" data-fechar-ate value="${escFin(sugestaoFechar)}" max="${escFin(ontemConc())}" min="${escFin(c.inicio)}">
                <button type="button" class="fis-mini" onclick="fecharPeriodoConc()">Fechar</button>
            </div>
        </div>
        ${c.conferida_ate ? acaoPainelCartaoFin('voltar', `Reabrir (até ${dataFin(c.conferida_ate)})`, 'reabrirPeriodoConc()') : ''}
        <hr>
        ${acaoPainelCartaoFin('voltar', 'Todas as contas', 'telaContasConc()')}`
    tela.innerHTML = janelaConc(`Conciliar · ${escFin(c.nome)}`, `
        <div data-conciliar>
            <div class="cc-topo">
                <label class="cc-mes">Mês
                    <select class="fis-input" onchange="estadoConc.mes = this.value; estadoConc.sel = null; telaConciliarConc(false)">
                        ${meses.map(m => `<option value="${m}" ${m === d.mes ? 'selected' : ''}>${mesNomeConc(m)}</option>`).join('')}
                    </select>
                </label>
                <div class="cc-filtros">
                    ${[['TODAS', 'Todas'], ['SUGESTAO', 'Sugestões'], ['SEM_PAR', 'Sem par'], ['SO_GCS', 'Só no GCS'], ['CASADA', 'Casadas'], ['IGNORADA', 'Fora do Financeiro']]
                        .map(([k, t]) => `<button type="button" class="cc-filtro ${estadoConc.filtro === k ? 'ativo' : ''}" onclick="estadoConc.filtro = '${k}'; desenharConciliarConc(); if (estadoConc.sel) escolherLinhaConc(estadoConc.sel, false)">${t} <b>${conta(k)}</b></button>`).join('')}
                </div>
            </div>
            ${(d.faltam_dias || []).length ? `<div class="cf-faixa cf-falta">Falta extrato de ${d.faltam_dias.slice(0, 4).map(f => f.de === f.ate ? dataFin(f.de) : `${dataFin(f.de)} a ${dataFin(f.ate)}`).join(', ')}${d.faltam_dias.length > 4 ? '…' : ''}: importe esses dias para poder fechar.</div>` : ''}
            ${d.linhas.length || d.so_gcs.length ? '' : `<div class="cf-faixa">Nenhuma linha de extrato em ${mesNomeConc(d.mes)}. <span class="fis-link" onclick="importarOfxConc()">Importar OFX</span></div>`}
            <div class="cc-area" data-area-conc>
                <div class="cc-coluna-lista">
                    <input class="fis-input cc-busca" type="search" placeholder="Buscar descrição, CPF/CNPJ ou valor…" value="${escFin(estadoConc.busca)}"
                        oninput="estadoConc.busca = this.value; desenharTabelaConc()">
                    <div class="cc-rolagem" data-tabela-conc></div>
                </div>
                <section class="cc-detalhe" data-detalhe-conc><p class="cc-explica cc-escolha">Escolha uma linha à esquerda para ver as opções.</p></section>
            </div>
        </div>`, painel)
    desenharTabelaConc()
    ajustarAlturaConc()
}

// Lista e detalhe lado a lado, até o rodapé da tela (cada um rola sozinho).
function ajustarAlturaConc() {
    const area = document.querySelector('[data-area-conc]')
    if (!area) return
    const caixa = document.querySelector('.tela')
    const fundo = caixa ? caixa.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(caixa).paddingBottom) || 0) : window.innerHeight
    const fimTela = Math.min(fundo, window.innerHeight) - 4
    area.style.height = `${Math.max(fimTela - area.getBoundingClientRect().top, 300)}px`
    // O painel de ações (direita) não pode passar do rodapé: senão a página inteira rola e a lista some embaixo.
    const painel = document.querySelector('[data-corpo-conc] .fin-painel')
    if (painel) {
        painel.style.maxHeight = `${Math.max(fimTela - painel.getBoundingClientRect().top, 300)}px`
        painel.style.overflowY = 'auto'
    }
}
window.addEventListener('resize', () => ajustarAlturaConc())

function desenharTabelaConc() {
    const caixa = document.querySelector('[data-tabela-conc]')
    if (!caixa) return
    const linhas = filtrarLinhasConc(linhasConc())
    const total = linhas.reduce((a, l) => a + Number(l.valor), 0)
    const texto = h => String(h).replace(/<[^>]+>/g, '')
    caixa.innerHTML = `
        <table class="fis-tabela fin-extrato cc-tabela">
            <thead><tr><th class="cc-col-data">Dia</th><th>Descrição no banco</th><th class="fis-num cc-col-valor">Valor</th><th class="cc-col-sit" title="Situação"></th></tr></thead>
            <tbody>${linhas.map(l => {
                const noGcs = l.gcs ? `Baixa sem linha no extrato · ${escFin(l.baixa.conta)}`
                    : l.sit === 'CASADA' ? '→ ' + l.casadas.map(b => escFin([b.participante || b.descricao, b.numero && `nº ${b.numero}`].filter(Boolean).join(' · '))).join(' + ') + (l.casadas.some(b => b.automatico) ? ' (sozinha)' : '')
                    : l.sit === 'IGNORADA' ? escFin(l.observacao || '')
                    : l.sit === 'SUGESTAO' ? '→ ' + escFin(l.sugestoes[0].itens.length > 1 ? `${l.sugestoes[0].itens.length} baixas somam o valor` : [l.sugestoes[0].itens[0]?.participante_nome, l.sugestoes[0].itens[0]?.descricao].filter(Boolean).join(' · ')) + (l.sugestoes.length > 1 ? ` (+${l.sugestoes.length - 1})` : '')
                    : l.antes_corte ? 'antes do corte' : ''
                return `
                <tr class="cc-linha ${estadoConc.sel === l.chave ? 'cc-ativa' : ''} ${l.fechada ? 'cc-fechada' : ''}" data-chave="${l.chave}" onclick="escolherLinhaConc('${l.chave}')">
                    <td class="cc-col-data">${dataFin(l.data).slice(0, 5)}</td>
                    <td class="cc-desc">
                        <span class="cc-desc-banco" title="${escFin(l.descricao || '')}">${escFin(l.descricao || '—')}</span>
                        ${noGcs ? `<small class="cc-desc-gcs" title="${escFin(texto(noGcs))}">${noGcs}</small>` : ''}
                    </td>
                    <td class="fis-num cc-col-valor"><b>${sinalConc(l.valor)}</b></td>
                    <td class="cc-col-sit">${iconeSitConc(l.sit)}${l.fechada ? '<span class="cc-cadeado" title="Período fechado">🔒</span>' : ''}</td>
                </tr>`
            }).join('') || '<tr><td colspan="4" class="fis-vazio">Nada neste filtro.</td></tr>'}</tbody>
            ${linhas.length ? `<tfoot><tr><td colspan="2">${linhas.length} linha${linhas.length === 1 ? '' : 's'}</td><td class="fis-num"><b>${sinalConc(total)}</b></td><td></td></tr></tfoot>` : ''}
        </table>`
}

// ------------------------------------------------------------ uma linha: resolver

// ---- peças visuais do detalhe

// Círculo com as iniciais (cor fixa por nome), como o avatar do painel.
const CORES_AVATAR_CONC = ['#356443', '#1d4f7c', '#7a4a06', '#6d28d9', '#0f766e', '#9d174d', '#4d7c0f', '#b45309']
function avatarConc(nome) {
    const t = String(nome || '?').replace(/[^A-Za-zÀ-ú0-9 ]/g, ' ').trim()
    const p = t.split(/\s+/).filter(x => x.length > 2)
    const ini = ((p[0] || t)[0] || '?') + ((p[1] || '')[0] || '')
    let h = 0
    for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) >>> 0
    return `<span class="cc-avatar" style="background:${CORES_AVATAR_CONC[h % CORES_AVATAR_CONC.length]}">${escFin(ini.toUpperCase())}</span>`
}
const tagConc = (texto, tipo = '') => `<span class="cc-tag ${tipo ? `cc-tag-${tipo}` : ''}">${texto}</span>`
const ICONE_ENTRADA_CONC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7L7 17M7 9v8h8"/></svg>'
const ICONE_SAIDA_CONC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'

// Cartão de cima: entrada/saída, valor grande, descrição do banco e a situação.
function cabecaConc(l) {
    const entrada = Number(l.valor) > 0
    return `
        <div class="cc-heroi ${entrada ? 'cc-heroi-entrada' : 'cc-heroi-saida'}">
            <span class="cc-heroi-icone">${entrada ? ICONE_ENTRADA_CONC : ICONE_SAIDA_CONC}</span>
            <div class="cc-heroi-texto">
                <small>${l.gcs ? 'Baixa no GCS' : entrada ? 'Entrada no banco' : 'Saída do banco'} · ${dataFin(l.data)}</small>
                <b class="cc-heroi-valor">${entrada ? '+' : '−'} ${dinheiro(Math.abs(Number(l.valor)))}</b>
                <span class="cc-heroi-desc" title="${escFin(l.descricao || '')}">${escFin(l.descricao || '—')}</span>
            </div>
            <div class="cc-heroi-sit">${iconeSitConc(l.sit)}${l.documento ? `<small>${escFin(l.documento)}</small>` : ''}</div>
        </div>`
}

// Item de lista (fatura, baixa, sugestão): avatar, nome, detalhes, etiquetas e valor.
function itemConc({ nome, detalhe = '', tags = '', valor = null, depois = '', antes = '', marcar = false, classe = '' }) {
    const tag = marcar ? 'label' : 'div'
    return `
        <${tag} class="cc-item ${classe}">
            ${antes}
            ${avatarConc(nome)}
            <span class="cc-item-texto">
                <b>${escFin(nome || '—')}</b>
                ${detalhe ? `<small>${detalhe}</small>` : ''}
                ${tags ? `<span class="cc-tags">${tags}</span>` : ''}
            </span>
            ${valor != null ? `<b class="cc-item-valor">${sinalConc(valor)}</b>` : ''}
            ${depois}
        </${tag}>`
}

const vazioConc = (icone, texto) => `<div class="cc-vazio-detalhe">${iconeFin(icone)}<span>${texto}</span></div>`

// Barra do rodapé do detalhe: quanto já foi marcado do valor da linha.
function barraSomaConc(soma, alvo, ok) {
    const pct = alvo ? Math.min(100, Math.round(Math.abs(soma) * 100 / Math.abs(alvo))) : 0
    return `
        <div class="cc-soma-info">
            <span>Marcado <b class="${ok ? 'cc-ok' : ''}">${dinheiro(Math.abs(soma))}</b> de ${dinheiro(Math.abs(alvo))}${ok ? ' ✔' : soma ? ` · falta ${dinheiro(Math.abs(Math.abs(alvo) - Math.abs(soma)))}` : ''}</span>
            <div class="cc-soma-barra ${ok ? 'cc-soma-ok' : Math.abs(soma) > Math.abs(alvo) + 0.004 ? 'cc-soma-passou' : ''}"><span style="width:${pct}%"></span></div>
        </div>`
}

async function escolherLinhaConc(chave, redesenhar = true) {
    estadoConc.sel = chave
    if (redesenhar) document.querySelectorAll('[data-tabela-conc] .cc-linha').forEach(tr => tr.classList.toggle('cc-ativa', tr.dataset.chave === chave))
    const l = linhasConc().find(x => x.chave === chave)
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (!l || !caixa) return
    const cabeca = cabecaConc(l)
    if (l.gcs) {
        const b = l.baixa
        caixa.innerHTML = `${cabeca}
            <div class="cc-alerta-gcs">${iconeFin('alerta')}<span>Está baixada no GCS na conta <b>${escFin(b.conta)}</b> (${escFin(b.app)}), mas <b>não aparece no extrato</b>. Ou saiu de outra conta, ou a data está errada, ou ainda não aconteceu.</span></div>
            ${itemConc({ nome: b.participante_nome || b.descricao, detalhe: escFin([b.descricao, b.categoria, b.app].filter(Boolean).join(' · ')),
                tags: [tagConc(`baixa em ${dataFin(b.data)}`), b.criado_por ? tagConc(`por ${escFin(b.criado_por)}`) : ''].join(''), valor: b.mov })}
            <div class="cc-rodape-detalhe">
                ${l.fechada ? '' : `<button type="button" class="fis-mini" onclick="estornarBaixaConc(${b.id})">Desfazer o pagamento</button>`}
                <button type="button" class="fis-botao" onclick="abrirFaturaFin(${b.titulo_id})">Abrir a fatura</button>
            </div>`
        return
    }
    if (l.sit === 'CASADA' || l.sit === 'IGNORADA') {
        caixa.innerHTML = `${cabeca}
            ${l.sit === 'IGNORADA'
                ? `<div class="cc-alerta-gcs cc-alerta-neutro">${iconeFin('cancelar')}<span>Fora do Financeiro, por ${escFin(l.resolvido_por || '')}: <b>${escFin(l.observacao || '')}</b></span></div>`
                : `<b class="cc-sub-titulo">${iconeFin('check')} Casada com ${l.casadas.length === 1 ? 'esta baixa' : `estas ${l.casadas.length} baixas`}</b>
            <div class="cc-lista">${l.casadas.map(b => itemConc({
                nome: b.participante || b.descricao, valor: b.mov,
                detalhe: escFin([b.tipo === 'RECEBER' ? 'Receber' : 'Pagar', b.descricao, b.numero && `nº ${b.numero}`, b.conta].filter(Boolean).join(' · ')),
                tags: [b.automatico ? tagConc('casou sozinha', 'ok') : '', b.criou ? tagConc('baixa feita aqui', 'azul') : '', tagConc(escFin(b.app))].join(''),
                depois: `<button type="button" class="fis-mini" onclick="abrirFaturaFin(${b.titulo_id})">Fatura</button>`
            })).join('')}</div>`}
            <div class="cc-rodape-detalhe">
                ${l.fechada ? '<small class="cc-cinza">Período fechado: reabra para mudar.</small>' : `<button type="button" class="fis-mini" onclick="desfazerLinhaConc(${l.id}, ${l.casadas?.some(b => b.criou) ? 'true' : 'false'})">Desfazer</button>`}
            </div>`
        return
    }
    if (l.fechada) { caixa.innerHTML = `${cabeca}${vazioConc('vencimento', 'Período fechado.')}`; return }
    caixa.innerHTML = `${cabeca}${vazioConc('relogio', 'Procurando faturas e baixas…')}`
    try {
        detalheConc = await apiFin('conciliacao/linha', { id: l.id })
    } catch (err) {
        caixa.innerHTML = `${cabeca}<p class="cc-explica">${escFin(mensagemErroEst(err))}</p>`
        return
    }
    if (estadoConc.sel !== chave) return
    detalheConc.sugestoes = l.sugestoes || []
    detalheConc.cabeca = cabeca
    if (!estadoConc.aba || estadoConc.abaDe !== chave) {
        estadoConc.aba = detalheConc.sugestoes.length ? 'sugestao' : detalheConc.combinacao || detalheConc.faturas.some(f => f.mesmo_documento || Math.abs(f.saldo - Math.abs(l.valor)) < 0.005) ? 'faturas'
            : detalheConc.transferencias.length ? 'transferencia' : detalheConc.baixas.length ? 'baixas' : 'lancar'
        estadoConc.abaDe = chave
    }
    desenharDetalheConc()
}

function desenharDetalheConc() {
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (!caixa || !detalheConc) return
    const { linha: l, tipo, baixas, faturas, combinacao, transferencias, destinos, apps, sugestoes, cabeca } = detalheConc
    const abs = Math.abs(l.valor)
    const abas = [
        ['sugestao', 'raio', 'Sugestões', sugestoes.length, sugestoes.length],
        ['faturas', 'baixa', 'Faturas', faturas.length, true],
        ['baixas', 'check', 'Baixas lançadas', baixas.length, true],
        ['lancar', 'incluir', l.valor < 0 ? 'Lançar despesa' : 'Lançar receita', null, true],
        ['transferencia', 'repetir', 'Transferência', transferencias.length, true]
    ]
    const aba = estadoConc.aba
    let corpo = '', rodape = ''
    if (aba === 'sugestao') {
        corpo = sugestoes.map(s => {
            const um = s.itens.length === 1 ? s.itens[0] : null
            return itemConc({
                nome: um ? (um.participante_nome || um.descricao) : `${s.itens.length} baixas ${s.tipo === 'grupo' ? 'do mesmo dia' : ''}`,
                detalhe: um ? escFin([um.tipo === 'RECEBER' ? 'Receber' : 'Pagar', um.descricao, um.categoria, um.conta].filter(Boolean).join(' · '))
                    : escFin(s.itens.slice(0, 5).map(b => b.participante_nome || b.descricao || '').join(', ') + (s.itens.length > 5 ? '…' : '')),
                tags: [tagConc('valor exato', 'azul'), s.doc ? tagConc('mesmo CPF/CNPJ', 'ok') : '',
                    tagConc(s.dias ? `${s.dias} dia${s.dias === 1 ? '' : 's'} de diferença` : 'mesma data', s.dias ? '' : 'ok'),
                    um ? tagConc(escFin(um.app)) : ''].join(''),
                valor: s.itens.reduce((a, b) => a + b.mov, 0), classe: 'cc-item-sugestao',
                depois: `<button type="button" class="fis-botao" onclick="casarConc(${l.id}, [${s.baixas.join(',')}])">Confirmar</button>`
            })
        }).join('') || vazioConc('raio', 'Sem sugestão.')
    } else if (aba === 'baixas') {
        corpo = `
            <p class="cc-explica">Baixas de ${tipo === 'RECEBER' ? 'recebimento' : 'pagamento'} destas contas, até 10 dias antes ou depois, que ainda não casaram. Marque as que formam esta linha (ex.: as pessoas do lote de salários).</p>
            <div class="cc-lista" data-marcar-baixas>${baixas.map(b => itemConc({
                nome: b.participante_nome || b.descricao, marcar: true, valor: b.mov,
                antes: `<input type="checkbox" value="${b.id}" data-valor="${b.mov}" onchange="somarMarcadasConc()">`,
                detalhe: escFin([b.descricao, b.categoria, b.conta].filter(Boolean).join(' · ')),
                tags: [Math.abs(Math.abs(b.mov) - abs) < 0.005 ? tagConc('valor exato', 'azul') : '', b.data === l.data ? tagConc('mesmo dia', 'ok') : tagConc(`baixa em ${dataFin(b.data)}`),
                    tagConc(escFin(b.app)), b.criado_por ? tagConc(`por ${escFin(b.criado_por)}`) : ''].join('')
            })).join('') || vazioConc('check', 'Nenhuma baixa sem par por perto.')}</div>`
        rodape = `
            <div class="cc-rodape-detalhe">
                <div data-soma-baixas>${barraSomaConc(0, l.valor, false)}</div>
                <button type="button" class="fis-mini" onclick="marcarDiaConc()">Todas do dia ${dataFin(l.data).slice(0, 5)}</button>
                <button type="button" class="fis-botao" data-casar-marcadas disabled onclick="casarMarcadasConc(${l.id})">Casar</button>
            </div>`
    } else if (aba === 'faturas') {
        const marcadas = new Set(combinacao || (faturas.length && Math.abs(faturas[0].saldo - abs) < 0.005 ? [faturas[0].id] : []))
        corpo = `
            <p class="cc-explica">Faturas ${tipo === 'RECEBER' ? 'a receber' : 'a pagar'} em aberto com valor parecido ou do mesmo favorecido.${combinacao ? ' <b>Já marcadas as que somam exatamente o valor.</b>' : ''} A baixa sai com a data da linha (${dataFin(l.data)}).</p>
            <div class="cc-lista" data-marcar-faturas>${faturas.map(f => itemConc({
                nome: f.participante_nome, marcar: true,
                antes: `<input type="checkbox" value="${f.id}" ${marcadas.has(f.id) ? 'checked' : ''} onchange="somarFaturasConc()">`,
                detalhe: escFin([f.numero_documento && `nº ${f.numero_documento}`, f.parcela_texto, f.categoria].filter(Boolean).join(' · ')),
                tags: [Math.abs(f.saldo - abs) < 0.005 ? tagConc('valor exato', 'azul') : '', f.mesmo_documento ? tagConc('mesmo CPF/CNPJ', 'ok') : f.mesmo_nome ? tagConc('nome parecido', 'ok') : '',
                    tagConc(`vence ${dataFin(f.vencimento)}`, f.situacao === 'ATRASADO' ? 'alerta' : ''), tagConc(escFin(f.app))].join(''),
                depois: `<span class="cc-item-campo"><input class="fis-input fis-num cc-valor" type="number" step="0.01" min="0.01" value="${f.saldo.toFixed(2)}" data-saldo="${f.saldo}" oninput="somarFaturasConc()" title="Valor a baixar (saldo ${escFin(dinheiro(f.saldo))})">
                    <button type="button" class="fis-mini" onclick="event.preventDefault(); abrirFaturaFin(${f.id})">Ver</button></span>`
            })).join('') || vazioConc('baixa', 'Nenhuma fatura em aberto parecida. Use "Lançar" se não existir fatura.')}</div>`
        rodape = `<div class="cc-rodape-detalhe cc-rodape-faturas" data-ajuste-faturas></div>`
    } else if (aba === 'lancar') {
        const cats = opcoesFinCache?.categorias || []
        const sugestaoCat = l.valor < 0 ? (/IOF/i.test(l.descricao) ? 94 : /TAR|TARIFA|PACOTE|MANUT/i.test(l.descricao) ? 155 : '') : (/REND|APLIC|RESG/i.test(l.descricao) ? 140 : '')
        const principal = (detalheConc.conta.contas.find(k => String(k.id) === String(detalheConc.conta.conta_principal_id)) || {}).app
        corpo = `
            <p class="cc-explica">Para o que só existe no banco e não tem fatura: tarifa, IOF, juros, rendimento… Vira uma fatura já ${tipo === 'RECEBER' ? 'recebida' : 'paga'} em ${dataFin(l.data)}.</p>
            <div class="fis-form cc-form-lancar" data-lancar-conc>
                <div class="fis-grade">
                    <label class="fis-campo"><span>Empresa</span><select class="fis-input" name="app">${apps.map(a => `<option ${a === principal ? 'selected' : ''}>${escFin(a)}</option>`).join('')}</select></label>
                    <label class="fis-campo fis-largo"><span>Categoria</span><select class="fis-input" name="categoria_id">${opcoesCategoriasFin(cats, tipo, sugestaoCat)}</select></label>
                </div>
                <div class="fis-grade">
                    <label class="fis-campo"><span>${tipo === 'RECEBER' ? 'Pagador' : 'Favorecido'}</span><input class="fis-input" name="participante_nome" maxlength="150" value="${escFin(/TAR|IOF|PACOTE/i.test(l.descricao) ? 'Banco' : '')}"></label>
                    <label class="fis-campo fis-largo"><span>Descrição</span><input class="fis-input" name="descricao" maxlength="300" value="${escFin(l.descricao || '')}"></label>
                </div>
            </div>`
        rodape = `<div class="cc-rodape-detalhe"><button type="button" class="fis-botao" onclick="lancarConc(${l.id})">Lançar ${sinalConc(l.valor)}</button></div>`
    } else if (aba === 'transferencia') {
        corpo = `
            <p class="cc-explica">Dinheiro que só mudou de conta (não é custo nem receita). Lança a saída e a entrada com as categorias de transferência.</p>
            ${transferencias.length ? `<b class="cc-sub-titulo">No extrato de outra conta, com o mesmo valor ao contrário</b>
            <div class="cc-lista">${transferencias.map(t => itemConc({
                nome: t.conta, detalhe: escFin(t.descricao || ''), valor: t.valor,
                tags: [tagConc('valor exato', 'azul'), tagConc(t.data === l.data ? 'mesmo dia' : dataFin(t.data), t.data === l.data ? 'ok' : '')].join(''),
                depois: `<button type="button" class="fis-botao" onclick="transferirConc(${l.id}, { destino_linha_id: ${t.id} })">É esta</button>`
            })).join('')}</div>` : ''}
            <b class="cc-sub-titulo">Ou ${l.valor < 0 ? 'foi para' : 'veio de'} uma conta sem extrato aqui (aplicação, caixinha, mútuo…)</b>
            <div class="cc-botoes">
                <select class="fis-input" data-destino-conc>${destinos.map(k => `<option value="${k.id}">${escFin(k.app)} · ${escFin(k.nome)}${k.caixa === false ? ' (técnica)' : ''}</option>`).join('')}</select>
                <button type="button" class="fis-botao" onclick="transferirConc(${l.id}, { destino_conta_id: document.querySelector('[data-destino-conc]').value })">Lançar transferência</button>
            </div>`
    }
    caixa.innerHTML = `${cabeca}
        <div class="cc-abas" role="tablist">${abas.filter(a => a[4]).map(([k, ic, t, n]) => `
            <button type="button" role="tab" aria-selected="${aba === k}" class="cc-aba ${aba === k ? 'ativo' : ''}" onclick="estadoConc.aba = '${k}'; desenharDetalheConc()">
                ${iconeFin(ic)}<span>${t}</span>${n != null ? `<em>${n}</em>` : ''}</button>`).join('')}
            <button type="button" class="cc-aba cc-aba-ignorar" onclick="ignorarLinhaConc(${l.id})" title="Marcar como fora do Financeiro">${iconeFin('cancelar')}<span>Fora</span></button>
        </div>
        <div class="cc-aba-corpo">${corpo}</div>
        ${rodape}`
    if (aba === 'faturas') somarFaturasConc()
}

const situacaoTextoConc = s => (SITUACOES_FIN[s] || {}).texto || s || ''

function somarMarcadasConc() {
    const marcadas = [...document.querySelectorAll('[data-marcar-baixas] input:checked')]
    const soma = r2Fin(marcadas.reduce((a, i) => a + Number(i.dataset.valor), 0))
    const alvo = r2Fin(detalheConc.linha.valor)
    const ok = Boolean(marcadas.length && Math.abs(soma - alvo) < 0.005)
    const el = document.querySelector('[data-soma-baixas]')
    if (el) el.innerHTML = barraSomaConc(soma, alvo, ok)
    const b = document.querySelector('[data-casar-marcadas]')
    if (b) b.disabled = !ok
}

function marcarDiaConc() {
    const dia = detalheConc.linha.data
    const ids = new Set(detalheConc.baixas.filter(b => b.data === dia).map(b => String(b.id)))
    document.querySelectorAll('[data-marcar-baixas] input').forEach(i => { i.checked = ids.has(i.value) })
    somarMarcadasConc()
}

function somarFaturasConc() {
    const caixa = document.querySelector('[data-ajuste-faturas]')
    if (!caixa) return
    const marcadas = [...document.querySelectorAll('[data-marcar-faturas] .cc-item')].filter(it => it.querySelector('input[type=checkbox]').checked)
    const abs = r2Fin(Math.abs(detalheConc.linha.valor))
    const soma = r2Fin(marcadas.reduce((a, it) => a + Number(it.querySelector('.cc-valor').value || 0), 0))
    const um = marcadas.length === 1 ? Number(marcadas[0].querySelector('.cc-valor').dataset.saldo) : null
    const dif = um != null ? r2Fin(abs - um) : 0
    const bate = Boolean(marcadas.length && Math.abs(soma - abs) < 0.005)
    let ajuste = ''
    if (um != null && Math.abs(dif) >= 0.005 && Math.abs(Number(marcadas[0].querySelector('.cc-valor').value) - um) < 0.005) {
        ajuste = dif > 0
            ? `<label class="fis-check"><input type="radio" name="ajuste" value="juros" checked> Veio ${dinheiro(dif)} a mais: lançar como juros</label>`
            : `<label class="fis-check"><input type="radio" name="ajuste" value="desconto" checked> Veio ${dinheiro(-dif)} a menos e quita a fatura (retenção/desconto)</label>
               <label class="fis-check"><input type="radio" name="ajuste" value="parcial"> Foi só uma parte: baixa parcial de ${dinheiro(abs)}</label>`
    }
    caixa.innerHTML = `
        ${barraSomaConc(soma, abs, bate || Boolean(ajuste))}
        ${ajuste ? `<div class="cc-ajuste">${ajuste}</div>` : ''}
        <button type="button" class="fis-botao" ${marcadas.length && (bate || ajuste) ? '' : 'disabled'} onclick="baixarFaturasConc(${detalheConc.linha.id})">Dar baixa</button>`
}

async function baixarFaturasConc(linhaId) {
    const marcadas = [...document.querySelectorAll('[data-marcar-faturas] .cc-item')].filter(it => it.querySelector('input[type=checkbox]').checked)
    let ajuste = document.querySelector('[data-ajuste-faturas] [name="ajuste"]:checked')?.value || null
    const abs = r2Fin(Math.abs(detalheConc.linha.valor))
    let itens = marcadas.map(it => ({ titulo_id: it.querySelector('input[type=checkbox]').value, valor: it.querySelector('.cc-valor').value }))
    if (ajuste === 'parcial') { itens = [{ titulo_id: itens[0].titulo_id, valor: abs }]; ajuste = null }
    await acaoConc('baixar', { linha_id: linhaId, itens, ajuste }, () => telaConciliarConc(), 'Baixa feita e linha casada')
}

function casarConc(linhaId, baixas) {
    return acaoConc('casar', { linha_id: linhaId, baixas }, () => telaConciliarConc(), 'Linha casada')
}

function casarMarcadasConc(linhaId) {
    const ids = [...document.querySelectorAll('[data-marcar-baixas] input:checked')].map(i => Number(i.value))
    return casarConc(linhaId, ids)
}

function lancarConc(linhaId) {
    const f = document.querySelector('[data-lancar-conc]')
    const v = n => f.querySelector(`[name="${n}"]`).value
    return acaoConc('lancar', { linha_id: linhaId, app: v('app'), categoria_id: v('categoria_id'), participante_nome: v('participante_nome'), descricao: v('descricao') },
        () => telaConciliarConc(), 'Lançado e casado')
}

function transferirConc(linhaId, destino) {
    return acaoConc('transferir', { linha_id: linhaId, ...destino }, () => telaConciliarConc(), 'Transferência lançada')
}

async function ignorarLinhaConc(linhaId) {
    const motivo = await pedirTextoPopup({ titulo: 'Fora do Financeiro', mensagem: 'Por que esta linha não entra no Financeiro? (ex.: aplicação automática, estorno do próprio banco)', minimo: 3, maximo: 300, textoConfirmar: 'Marcar' })
    if (!motivo) return
    return acaoConc('ignorar', { linha_id: linhaId, motivo }, () => telaConciliarConc())
}

async function desfazerLinhaConc(linhaId, criou) {
    if (!await confirmarPopup({ titulo: 'Desfazer', mensagem: criou
        ? 'A linha volta a ficar pendente e o pagamento feito aqui na conciliação é desfeito (a fatura lançada aqui é cancelada; na transferência, os dois lados).'
        : 'A linha volta a ficar pendente. As baixas continuam como estão.', textoConfirmar: 'Desfazer' })) return
    return acaoConc('desfazer', { linha_id: linhaId }, () => telaConciliarConc())
}

async function estornarBaixaConc(baixaId) {
    const motivo = await pedirTextoPopup({ titulo: 'Desfazer o pagamento', mensagem: 'Motivo (a fatura volta a ficar em aberto):', minimo: 5, maximo: 300, textoConfirmar: 'Desfazer' })
    if (!motivo) return
    try {
        overlayAguarde()
        await apiFin('baixa/estornar', { baixa_id: baixaId, motivo })
        removerOverlay()
        await telaConciliarConc()
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
    }
}

async function confirmarSugestoesConc() {
    const n = dadosConc.linhas.filter(l => l.unica && !l.fechada).length
    if (!await confirmarPopup({ titulo: 'Confirmar sugestões', mensagem: `Casar as ${n} linhas de ${mesNomeConc(dadosConc.mes)} que têm uma sugestão só (o mesmo valor, sem outra opção)?`, textoConfirmar: 'Confirmar' })) return
    return acaoConc('confirmarSugestoes', { conta_bancaria_id: estadoConc.conta, mes: dadosConc.mes }, () => telaConciliarConc(false), r => `${r.casadas} linha${r.casadas === 1 ? '' : 's'} casada${r.casadas === 1 ? '' : 's'}`)
}

async function fecharPeriodoConc() {
    const data = document.querySelector('[data-fechar-ate]')?.value
    if (!data) return popup({ mensagem: 'Escolha a data' })
    if (!await confirmarPopup({ titulo: 'Fechar o período', mensagem: `Fechar ${escFin(dadosConc.conta.nome)} até ${dataFin(data)}? O saldo do banco nesse dia vira o saldo conferido no Fluxo de Caixa e as baixas até lá ficam travadas (dá para reabrir).`, textoConfirmar: 'Fechar' })) return
    return acaoConc('fechar', { conta_bancaria_id: estadoConc.conta, data }, () => telaConciliarConc(), r => `Fechada até ${dataFin(r.ate)} com ${dinheiro(r.saldo)}`)
}

async function reabrirPeriodoConc() {
    const c = dadosConc.conta
    if (!await confirmarPopup({ titulo: 'Reabrir', mensagem: `Desfazer o fechamento até ${dataFin(c.conferida_ate)}? O saldo conferido volta ao anterior e as baixas destravam.`, textoConfirmar: 'Reabrir' })) return
    return acaoConc('reabrir', { conta_bancaria_id: c.id }, () => telaConciliarConc(), 'Reaberta')
}
