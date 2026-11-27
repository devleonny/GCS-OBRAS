// Conciliação bancária (Financeiro → Conciliação Bancária), layout financeiro. 24/11/2026.
// Servidor: gcs SCRIPTS/financeiro_conciliacao.js (rotas /financeiro/conciliacao/*), migrations/financeiro-conciliacao.sql.
//
// Conta do banco (ex.: Itaú 4695) = as contas correntes das empresas que usam a mesma conta (IAC, AC, HNK, HNW).
// O extrato entra por OFX (vários arquivos de uma vez; linha repetida é ignorada). Cada linha casa com uma ou mais
// baixas: sozinha (mesmo valor e data, sem outra opção), por sugestão, ou resolvida aqui (dar baixa numa fatura em
// aberto, lançar tarifa/IOF, transferência entre contas, fora do Financeiro). Fechar até uma data: tudo casado até ali;
// o saldo do banco vira o saldo conferido (Fluxo de Caixa) e as baixas até a data travam.

// multi: chaves das linhas juntadas com Ctrl + clique (grupo N × N); com 2 ou mais, o detalhe trabalha com a soma.
const estadoConc = { painel: false, conta: null, mes: null, filtro: 'TODAS', busca: '', dias: null, sel: null, aba: null, multi: [] }
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
        if (mensagemOk) popup({ imagem: 'imagens/concluido.png', mensagem: typeof mensagemOk === 'function' ? mensagemOk(r) : mensagemOk, tempo: 3 })
        return r
    } catch (err) {
        removerOverlay()
        popup({ mensagem: mensagemErroEst(err) })
        return null
    }
}

// Janela no layout financeiro: título em cima, painel de ações à direita (recolhe pela seta).
const acaoPainelConc = (icone, texto, funcao, { ativo = true, motivo = '' } = {}) => `
    <button type="button" class="fin-acao" title="${escFin(ativo ? texto : `${texto}: ${motivo}`)}" ${ativo ? `onclick="${funcao}"` : 'disabled'}>
        ${iconeFin(icone)}<span>${texto}</span></button>`
// Informação do painel: some quando o painel está recolhido (fica só nos títulos dos ícones).
const infoPainelConc = (rotulo, valor, classe = '') => `<div class="cf-info ${classe}"><small>${rotulo}</small><b>${valor}</b></div>`
const cabecaPainelConc = (circulo, titulo, detalhe = '') => `
    <div class="fin-painel-cabeca" title="${escFin(titulo)}">
        <span class="fin-avatar">${escFin(circulo)}</span>
        <div class="fin-painel-texto"><b>${escFin(titulo)}</b>${detalhe}</div>
    </div>`

function janelaConc(titulo, principal, painel, classe = '') {
    return `
        <div class="fis-pagina fin-tela cc-tela ${classe}">
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
        // Mesma conta do % de dentro (mês): resolvidas sobre extrato + "só no GCS", arredondado para baixo
        // (só mostra 100% com tudo resolvido). Aqui é o período aberto todo, desde o corte/último fechamento.
        const total = c.casadas + c.pendentes + c.ignoradas + (c.so_gcs || 0)
        const pct = n => total ? Math.floor(n * 100 / total) : 0
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
                    <div class="${ok ? 'cc-saldo-ok' : 'cc-saldo-falta'}"><small>Falta explicar</small><b title="${ok ? '' : escFin(dinheiroTexto(dif))}">${ok ? '✔ R$ 0,00' : dinheiro(dif)}</b></div>
                </div>
                <small class="cc-saldos-dia">Saldos no fim de ${dataFin(c.saldo_dia)}</small>
                <div class="cc-progresso">
                    <div class="cc-barra" title="Desde ${dataFin(c.inicio)}: casadas / fora do Financeiro / pendentes e só no GCS"><span style="width:${pct(c.casadas)}%"></span><span class="cc-barra-ign" style="width:${pct(c.ignoradas)}%"></span></div>
                    <small>${pct(c.casadas + c.ignoradas)}% resolvido desde ${dataFin(c.inicio)}</small>
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
        ${cabecaPainelConc(String(contas.length), `${contas.length} conta${contas.length === 1 ? '' : 's'} do banco`, `<small>${pendentes} pendência${pendentes === 1 ? '' : 's'} no período aberto</small>`)}
        ${acaoPainelConc('baixar', 'Importar OFX', 'importarOfxConc()')}
        ${acaoPainelConc('relogio', todas ? 'Só as últimas importações' : 'Todas as importações', `telaContasConc(${!todas})`)}
        ${acaoPainelConc('incluir', 'Nova conta do banco', 'formularioContaBancoConc()')}
        ${acaoPainelConc('editar', 'Contas Correntes', 'telaContasFin()')}
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
    // Já aberta (mesmo minimizada): só traz para a frente, sem abrir outra nem perder o que foi importado.
    const aberta = document.querySelector('[data-importar-conc]')
    if (aberta) return trazerJanelaParaFrente(aberta)
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
                    ${r.saldo != null ? ` · saldo do banco ${dinheiro(r.saldo)} em ${dataFin(r.saldo_data)}${r.saldo_confere === true ? ` (confere com o já importado${r.saldo_diferenca ? `; ${dinheiro(Math.abs(r.saldo_diferenca))} de rendimento ainda não listado pelo banco` : ''})` : r.saldo_confere === false ? ` · <b>não confere com o já importado: diferença de ${dinheiro(r.saldo_diferenca)}. Falta linha?</b>` : ''}` : ''}
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
    estadoConc.dias = null
    estadoConc.sel = null
    estadoConc.multi = []
    return telaConciliarConc()
}

async function telaConciliarConc(manterSel = true) {
    overlayAguarde()
    try {
        const [dados] = await Promise.all([apiFin('conciliacao/linhas', { conta_bancaria_id: estadoConc.conta, mes: estadoConc.mes }), carregarOpcoesFin()])
        removerOverlay()
        dadosConc = dados
        estadoConc.mes = dados.mes
        if (!manterSel) { estadoConc.sel = null; estadoConc.multi = [] }
        // A linha escolhida pode ter sido resolvida: escolhe a próxima pendente.
        const linhas = linhasConc()
        if (estadoConc.sel && !linhas.some(l => l.chave === estadoConc.sel)) estadoConc.sel = null
        if (!estadoConc.sel) estadoConc.sel = (linhas.find(l => ['SUGESTAO', 'SEM_PAR'].includes(l.sit)) || {}).chave || null
        // Recarregar (depois de casar, lançar, desfazer...) não tira a pessoa do lugar: a lista e o painel voltam
        // na mesma rolagem.
        const rolagem = ['[data-tabela-conc]', '.cc-tela .fin-painel'].map(s => [s, document.querySelector(s)?.scrollTop || 0])
        desenharConciliarConc()
        if (manterSel) rolagem.forEach(([s, y]) => { const el = document.querySelector(s); if (el) el.scrollTop = y })
        // O grupo só continua se as linhas ainda estão pendentes.
        estadoConc.multi = estadoConc.multi.filter(k => podeJuntarConc(linhas.find(l => l.chave === k)))
        if (estadoConc.multi.length < 2) estadoConc.multi = []
        reabrirSelecaoConc()
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

// Dia (ou intervalo de dias) escolhido no calendário ao lado da busca.
const noDiaConc = l => !estadoConc.dias || (l.data >= estadoConc.dias.de && l.data <= estadoConc.dias.ate)

function filtrarLinhasConc(linhas) {
    const f = estadoConc.filtro
    const termo = normalFin(estadoConc.busca)
    return linhas.filter(l => (f === 'TODAS' || l.sit === f) && noDiaConc(l)
        && (!termo || normalFin(`${l.descricao} ${l.documento || ''} ${Math.abs(l.valor).toFixed(2).replace('.', ',')} ${Math.abs(l.valor).toFixed(2)}`).includes(termo)))
}

// Painel da direita (situações, saldos, fechar): separado para a atualização ao vivo trocar só ele.
function painelConciliarConc() {
    const d = dadosConc
    const c = d.conta
    const todas = linhasConc()
    const conta = s => todas.filter(l => (s === 'TODAS' || l.sit === s) && noDiaConc(l)).length
    const unicas = d.linhas.filter(l => l.unica && !l.fechada).length
    const falta = Number(d.falta_explicar || 0)
    const meses = [...new Set([d.mes, ...d.meses, hojeFin().slice(0, 7)])].sort().reverse()
    const sugestaoFechar = d.ultima_linha && d.ultima_linha < hojeFin() ? d.ultima_linha : ontemConc()
    // Quanto do mês já está resolvido: casadas + fora do Financeiro sobre tudo da lista (extrato + só no GCS).
    // Uma baixa "só no GCS" que casa some da lista, então o total encolhe junto e o 100% fecha.
    const resolvidas = conta('CASADA') + conta('IGNORADA')
    const pct = todas.length ? Math.floor(resolvidas / todas.length * 100) : 0
    const progresso = todas.length ? `
        <div class="cc-progresso ${pct === 100 ? 'cc-progresso-ok' : ''}" title="${resolvidas} de ${todas.length} resolvidas em ${mesNomeConc(d.mes)} (casadas ou fora do Financeiro). O % do cartão da conta é do período aberto todo.">
            <b>${pct}%</b>
            <div class="cc-progresso-barra"><span style="width:${pct}%"></span></div>
        </div>` : ''
    const painel = `
        ${cabecaPainelConc((c.contas.find(k => String(k.id) === String(c.conta_principal_id)) || c.contas[0] || {}).app || '?', `${c.nome} · ${mesNomeConc(d.mes)}`,
            `<small>${c.conferida_ate ? `conferida até ${dataFin(c.conferida_ate)}` : `ainda não fechada · corte ${dataFin(c.corte)}`}</small>`)}
        <label class="cc-mes cc-so-aberto">Mês
            <select class="fis-input" onchange="estadoConc.mes = this.value; estadoConc.dias = null; telaConciliarConc(false)">
                ${meses.map(m => `<option value="${m}" ${m === d.mes ? 'selected' : ''}>${mesNomeConc(m)}</option>`).join('')}
            </select>
        </label>
        ${progresso}
        <div class="cc-filtros" role="group" aria-label="Filtrar as linhas">
            ${[['TODAS', 'Todas'], ['SUGESTAO', 'Sugestões'], ['SEM_PAR', 'Sem par'], ['SO_GCS', 'Só no GCS'], ['CASADA', 'Casadas'], ['IGNORADA', 'Fora do Financeiro']]
                .map(([k, t]) => `<button type="button" class="fin-acao cc-filtro ${estadoConc.filtro === k ? 'ativo' : ''}" aria-pressed="${estadoConc.filtro === k}" title="${t} (${conta(k)})"
                    onclick="estadoConc.filtro = '${k}'; desenharConciliarConc(); reabrirSelecaoConc()">
                    ${k === 'TODAS' ? `<span class="cc-sit cc-sit-todas" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 8h10M7 12h10M7 16h10"/></svg></span>` : iconeSitConc(k)}<span>${t}</span><em>${conta(k)}</em></button>`).join('')}
        </div>
        <hr>
        <div class="cf-infos">
            ${infoPainelConc(`Saldo do banco (${dataFin(d.saldo_dia)})`, d.saldo_banco != null ? dinheiro(d.saldo_banco) : '—')}
            ${infoPainelConc(`Saldo do GCS (${dataFin(d.saldo_dia)})`, c.conferida_ate ? dinheiro(d.saldo_gcs) : 'a conferir')}
            ${infoPainelConc('Falta explicar no mês', Math.abs(falta) < 0.005 ? '✔ R$ 0,00' : dinheiro(falta), Math.abs(falta) < 0.005 ? 'cf-ok' : 'cf-falta')}
        </div>
        <hr>
        ${acaoPainelConc('check', unicas ? `Confirmar ${unicas} sugestões` : 'Confirmar sugestões', 'confirmarSugestoesConc()', { ativo: unicas > 0, motivo: 'nenhuma sugestão única neste mês' })}
        ${acaoPainelConc('baixar', 'Importar OFX', 'importarOfxConc()')}
        <hr>
        <div class="cc-fechar" title="Fechado: as baixas até a data travam e a conta entra conferida no Fluxo de Caixa">
            <small>Fechar o período até</small>
            <div class="cc-fechar-linha">
                <input class="fis-input" type="date" data-fechar-ate value="${escFin(sugestaoFechar)}" max="${escFin(ontemConc())}" min="${escFin(c.inicio)}">
                <button type="button" class="fis-mini" onclick="fecharPeriodoConc()">Fechar</button>
            </div>
        </div>
        ${c.conferida_ate ? acaoPainelConc('voltar', `Reabrir (até ${dataFin(c.conferida_ate)})`, 'reabrirPeriodoConc()') : ''}
        <hr>
        ${acaoPainelConc('voltar', 'Todas as contas', 'telaContasConc()')}`
    return painel
}

function desenharConciliarConc() {
    const d = dadosConc
    const c = d.conta
    const painel = painelConciliarConc()
    tela.innerHTML = janelaConc(`Conciliar · ${escFin(c.nome)}`, `
        <div data-conciliar>
            ${(d.faltam_dias || []).length ? `<div class="cf-faixa cf-falta">Falta extrato de ${d.faltam_dias.slice(0, 4).map(f => f.de === f.ate ? dataFin(f.de) : `${dataFin(f.de)} a ${dataFin(f.ate)}`).join(', ')}${d.faltam_dias.length > 4 ? '…' : ''}: importe esses dias para poder fechar.</div>` : ''}
            ${d.linhas.length || d.so_gcs.length ? '' : `<div class="cf-faixa">Nenhuma linha de extrato em ${mesNomeConc(d.mes)}. <span class="fis-link" onclick="importarOfxConc()">Importar OFX</span></div>`}
            <div class="cc-area" data-area-conc>
                <div class="cc-coluna-lista">
                    <div class="cc-busca-linha">
                        <input class="fis-input cc-busca" type="search" placeholder="Buscar descrição, CPF/CNPJ ou valor…" value="${escFin(estadoConc.busca)}"
                            oninput="estadoConc.busca = this.value; desenharTabelaConc()">
                        <div class="cc-cal" data-cal-conc>${botaoCalConc()}</div>
                    </div>
                    <div class="cc-rolagem" data-tabela-conc></div>
                </div>
                <section class="cc-detalhe" data-detalhe-conc><p class="cc-explica cc-escolha">Escolha uma linha à esquerda para ver as opções.</p></section>
            </div>
        </div>`, painel, 'cc-tela-conciliar')
    desenharTabelaConc()
    ajustarAlturaConc()
}

// ---- calendário do mês (filtro por dia)

function rotuloDiasConc() {
    const d = estadoConc.dias
    if (!d) return 'Dia'
    return d.de === d.ate ? dataFin(d.de).slice(0, 5) : `${dataFin(d.de).slice(0, 5)} a ${dataFin(d.ate).slice(0, 5)}`
}

function botaoCalConc() {
    const ativo = Boolean(estadoConc.dias)
    return `
        <button type="button" class="fis-mini cc-cal-botao ${ativo ? 'ativo' : ''}" title="Filtrar por dia do mês (Shift + clique escolhe um intervalo)" aria-haspopup="dialog"
            onclick="alternarCalConc(event)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>
            <span>${rotuloDiasConc()}</span>
        </button>
        ${ativo ? `<button type="button" class="fis-mini cc-cal-limpar" title="Todos os dias" aria-label="Todos os dias" onclick="escolherDiaConc(event, null)">✕</button>` : ''}`
}

function alternarCalConc(ev) {
    ev.stopPropagation()
    const caixa = document.querySelector('[data-cal-conc]')
    if (!caixa) return
    if (caixa.querySelector('.cc-cal-pop')) return fecharCalConc()
    caixa.insertAdjacentHTML('beforeend', `<div class="cc-cal-pop" role="dialog" aria-label="Escolher dia" onclick="event.stopPropagation()">${gradeCalConc()}</div>`)
    setTimeout(() => document.addEventListener('click', fecharCalConc, { once: true }))
}

function fecharCalConc() {
    document.querySelector('[data-cal-conc] .cc-cal-pop')?.remove()
}

// Grade do mês da conciliação: cada dia mostra quantas linhas tem (no filtro de situação e na busca)
// e um ponto laranja quando ainda há linha a resolver.
function gradeCalConc() {
    const [a, m] = dadosConc.mes.split('-').map(Number)
    const primeiro = new Date(a, m - 1, 1).getDay()
    const total = new Date(a, m, 0).getDate()
    const salvo = estadoConc.dias
    estadoConc.dias = null
    const linhas = filtrarLinhasConc(linhasConc())
    estadoConc.dias = salvo
    const porDia = {}
    linhas.forEach(l => {
        const k = l.data.slice(0, 10)
        porDia[k] = porDia[k] || { n: 0, pend: false }
        porDia[k].n++
        if (['SUGESTAO', 'SEM_PAR', 'SO_GCS'].includes(l.sit)) porDia[k].pend = true
    })
    const hoje = hojeFin()
    const celulas = Array.from({ length: primeiro }, () => '<span></span>')
    for (let i = 1; i <= total; i++) {
        const dia = `${dadosConc.mes}-${String(i).padStart(2, '0')}`
        const info = porDia[dia]
        const sel = salvo && dia >= salvo.de && dia <= salvo.ate
        celulas.push(`<button type="button" class="cc-cal-dia ${info ? '' : 'cc-cal-vazio'} ${sel ? 'cc-cal-sel' : ''} ${dia === hoje ? 'cc-cal-hoje' : ''}"
            title="${dataFin(dia)}${info ? ` · ${info.n} linha${info.n === 1 ? '' : 's'}${info.pend ? ' · com pendência' : ''}` : ' · nada'}"
            onclick="escolherDiaConc(event, '${dia}')"><b>${i}</b>${info ? `<small>${info.n}</small>` : '<small>&nbsp;</small>'}${info?.pend ? '<i aria-hidden="true"></i>' : ''}</button>`)
    }
    return `
        <div class="cc-cal-topo"><b>${mesNomeConc(dadosConc.mes)}</b><small>Shift + clique: intervalo</small></div>
        <div class="cc-cal-semana">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(x => `<span>${x}</span>`).join('')}</div>
        <div class="cc-cal-grade">${celulas.join('')}</div>
        <button type="button" class="fis-mini cc-cal-todos" onclick="escolherDiaConc(event, null)">Todos os dias</button>`
}

// Clique = só aquele dia (clicar de novo no mesmo dia solta); Shift + clique = do dia já escolhido até este
// (o calendário fica aberto para ajustar o intervalo).
function escolherDiaConc(ev, dia) {
    ev.stopPropagation()
    const d = estadoConc.dias
    const intervalo = Boolean(ev.shiftKey && dia && d)
    if (!dia) estadoConc.dias = null
    else if (intervalo) estadoConc.dias = dia < d.de ? { de: dia, ate: d.ate } : { de: d.de, ate: dia }
    else estadoConc.dias = d && d.de === dia && d.ate === dia ? null : { de: dia, ate: dia }
    fecharCalConc()
    document.removeEventListener('click', fecharCalConc)
    desenharConciliarConc()
    reabrirSelecaoConc()
    if (intervalo) alternarCalConc(ev)
}

// Lista, detalhe e painel ocupam a altura visível só pelo CSS (.cc-tela-conciliar): a área do sistema (.tela)
// não rola; cada um rola sozinho. Só volta a rolagem da .tela para o topo (vinha de outra tela).
function ajustarAlturaConc() {
    const caixa = document.querySelector('.tela')
    if (caixa) caixa.scrollTop = 0
}

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
                    : l.sit === 'CASADA' ? '→ ' + (l.grupo_linhas ? `[junto com mais ${l.grupo_linhas.length - 1}] ` : '') + l.casadas.map(b => escFin([b.participante || b.descricao, b.numero && `nº ${b.numero}`].filter(Boolean).join(' · '))).join(' + ') + (l.casadas.some(b => b.automatico) ? ' (sozinha)' : '')
                    : l.sit === 'IGNORADA' ? escFin(l.observacao || '')
                    : l.sit === 'SUGESTAO' ? '→ ' + escFin(l.sugestoes[0].itens.length > 1 ? `${l.sugestoes[0].itens.length} baixas somam o valor` : [l.sugestoes[0].itens[0]?.participante_nome, l.sugestoes[0].itens[0]?.descricao].filter(Boolean).join(' · ')) + (l.sugestoes.length > 1 ? ` (+${l.sugestoes.length - 1})` : '')
                    : l.antes_corte ? 'antes do corte' : ''
                return `
                <tr class="cc-linha ${linhaAtivaConc(l.chave) ? 'cc-ativa' : ''} ${estadoConc.multi.includes(l.chave) ? 'cc-no-grupo' : ''} ${l.fechada ? 'cc-fechada' : ''}" data-chave="${l.chave}" onmousedown="if (event.ctrlKey || event.metaKey) event.preventDefault()" onclick="cliqueLinhaConc(event, '${l.chave}')">
                    <td class="cc-col-data">${dataFin(l.data).slice(0, 5)}</td>
                    <td class="cc-desc">
                        <span class="cc-desc-banco" title="${escFin(l.descricao || '')}">${escFin(l.descricao || '—')}</span>
                        ${noGcs ? `<small class="cc-desc-gcs" title="${escFin(texto(noGcs))}">${noGcs}</small>` : ''}
                    </td>
                    <td class="fis-num cc-col-valor"><b>${sinalConc(l.valor)}</b></td>
                    <td class="cc-col-sit">${iconeSitConc(l.sit)}${l.fechada ? '<span class="cc-cadeado" title="Período fechado">🔒</span>' : ''}</td>
                </tr>`
            }).join('') || '<tr><td colspan="4" class="fis-vazio">Nada neste filtro.</td></tr>'}</tbody>
            ${linhas.length ? `<tfoot><tr><td colspan="2">${linhas.length} linha${linhas.length === 1 ? '' : 's'} <small class="cc-cinza" title="Para casar vários PIX/depósitos com várias faturas ou baixas de uma vez">· Ctrl + clique junta linhas</small></td><td class="fis-num"><b>${sinalConc(total)}</b></td><td></td></tr></tfoot>` : ''}
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
function itemConc({ nome, detalhe = '', tags = '', valor = null, depois = '', antes = '', marcar = false, classe = '', data = '' }) {
    const tag = marcar ? 'label' : 'div'
    const v = valor != null ? Math.abs(Number(valor)).toFixed(2) : ''
    return `
        <${tag} class="cc-item ${classe}"${v ? ` data-busca="${v} ${v.replace('.', ',')}"` : ''}${data ? ` data-data="${escFin(String(data).slice(0, 10))}"` : ''}>
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

// Busca local nas listas já carregadas (Baixas lançadas e baixas de uma linha já casada): favorecido,
// descrição, categoria, conta, nº ou valor (1234,56 / 1234.56) e data da baixa (de/até). Marcadas não somem.
const buscaListaConc = alvo => `
    <div class="cc-busca-faturas">
        <input class="fis-input" type="search" data-busca-lista placeholder="Buscar favorecido, nº, descrição, categoria ou valor…" oninput="filtrarListaConc(this, '${alvo}')">
        <label class="cc-busca-data" title="Baixa a partir de"><span>Baixa de</span><input class="fis-input" type="date" data-de-lista onchange="filtrarListaConc(this, '${alvo}')" onkeydown="tabParaAteConc(event, '[data-ate-lista]')"></label>
        <label class="cc-busca-data" title="Baixa até"><span>até</span><input class="fis-input" type="date" data-ate-lista onchange="filtrarListaConc(this, '${alvo}')"></label>
        <button type="button" class="fis-mini" data-limpar-lista hidden onclick="this.parentElement.querySelectorAll('input').forEach(i => { i.value = '' }); filtrarListaConc(this, '${alvo}')">Limpar</button>
    </div>`

// Tab no campo "de" vai direto para o "até" (o navegador parava antes, nas partes da data).
function tabParaAteConc(ev, seletor) {
    if (ev.key !== 'Tab' || ev.shiftKey) return
    const ate = ev.target.closest('.cc-busca-faturas')?.querySelector(seletor)
    if (!ate) return
    ev.preventDefault()
    ate.focus()
}

function filtrarListaConc(el, alvo) {
    const caixa = el.closest('.cc-busca-faturas')
    const termos = normalFin(caixa.querySelector('[data-busca-lista]').value).split(/s+/).filter(Boolean)
    const de = caixa.querySelector('[data-de-lista]').value, ate = caixa.querySelector('[data-ate-lista]').value
    caixa.querySelector('[data-limpar-lista]').hidden = !(termos.length || de || ate)
    const lista = document.querySelector(alvo)
    if (!lista) return
    let visiveis = 0
    lista.querySelectorAll('.cc-item').forEach(it => {
        const texto = `${normalFin(it.textContent)} ${it.dataset.busca || ''}`
        const d = it.dataset.data || ''
        const mostra = Boolean(it.querySelector('input[type=checkbox]:checked'))
            || (termos.every(t => texto.includes(t)) && (!de || (d && d >= de)) && (!ate || (d && d <= ate)))
        it.hidden = !mostra
        if (mostra) visiveis++
    })
    const vazio = lista.querySelector('[data-vazio-busca]')
    if (!visiveis && (termos.length || de || ate)) { if (!vazio) lista.insertAdjacentHTML('beforeend', `<div data-vazio-busca>${vazioConc('baixa', 'Nada com essa busca.')}</div>`) }
    else vazio?.remove()
}

const vazioConc = (icone, texto) => `<div class="cc-vazio-detalhe">${iconeFin(icone)}<span>${texto}</span></div>`

// Barra do rodapé do detalhe: quanto já foi marcado do valor da linha.
function barraSomaConc(soma, alvo, ok) {
    const pct = alvo ? Math.min(100, Math.round(Math.abs(soma) * 100 / Math.abs(alvo))) : 0
    // Diferença com o nome certo: passou do valor da linha é "acima", ainda não chegou é "falta".
    const dif = Math.abs(Math.abs(alvo) - Math.abs(soma))
    const passou = Math.abs(soma) > Math.abs(alvo) + 0.004
    return `
        <div class="cc-soma-info">
            <span class="cc-soma-texto"><span>Marcado <b class="${ok ? 'cc-ok' : ''}">${dinheiro(Math.abs(soma))}</b></span> <span>de ${dinheiro(Math.abs(alvo))}${ok ? '&nbsp;<b class="cc-ok">✔</b>' : ''}</span>${!ok && soma ? ` <span>· ${passou ? `<b class="cc-acima">${dinheiro(dif)} acima</b>` : `falta ${dinheiro(dif)}`}</span>` : ''}</span>
            <div class="cc-soma-barra ${ok ? 'cc-soma-ok' : Math.abs(soma) > Math.abs(alvo) + 0.004 ? 'cc-soma-passou' : ''}"><span style="width:${pct}%"></span></div>
        </div>`
}

// ---- várias linhas juntas (Ctrl + clique): N linhas do extrato × N faturas/baixas, pela soma

const linhaAtivaConc = chave => estadoConc.multi.length ? estadoConc.multi.includes(chave) : estadoConc.sel === chave
const podeJuntarConc = l => Boolean(l && !l.gcs && ['SUGESTAO', 'SEM_PAR'].includes(l.sit) && !l.fechada)

function pintarLinhasConc() {
    document.querySelectorAll('[data-tabela-conc] .cc-linha').forEach(tr => {
        tr.classList.toggle('cc-ativa', linhaAtivaConc(tr.dataset.chave))
        tr.classList.toggle('cc-no-grupo', estadoConc.multi.includes(tr.dataset.chave))
    })
}

function reabrirSelecaoConc() {
    if (estadoConc.multi.length > 1) return escolherGrupoConc()
    if (estadoConc.sel) return escolherLinhaConc(estadoConc.sel, false)
}

function cliqueLinhaConc(ev, chave) {
    if (!(ev.ctrlKey || ev.metaKey)) {
        estadoConc.multi = []
        return escolherLinhaConc(chave)
    }
    ev.preventDefault()
    const todas = linhasConc()
    const l = todas.find(x => x.chave === chave)
    if (!podeJuntarConc(l)) return popup({ mensagem: 'Só dá para juntar linhas do extrato que ainda estão pendentes (sem casar e fora do período fechado).' })
    // Começa pela linha que já estava aberta, se ela também pode entrar.
    let m = estadoConc.multi.length ? [...estadoConc.multi]
        : (estadoConc.sel !== chave && podeJuntarConc(todas.find(x => x.chave === estadoConc.sel)) ? [estadoConc.sel] : [])
    if (m.includes(chave)) m = m.filter(k => k !== chave)
    else {
        const primeira = todas.find(x => x.chave === m[0])
        if (primeira && Math.sign(primeira.valor) !== Math.sign(l.valor)) return popup({ mensagem: 'Junte só saídas ou só entradas.' })
        m.push(chave)
    }
    if (m.length >= 2) {
        estadoConc.multi = m
        estadoConc.sel = chave
        pintarLinhasConc()
        return escolherGrupoConc()
    }
    estadoConc.multi = []
    if (m.length === 1) return escolherLinhaConc(m[0])
    estadoConc.sel = null
    pintarLinhasConc()
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (caixa) caixa.innerHTML = '<p class="cc-explica cc-escolha">Escolha uma linha à esquerda para ver as opções.</p>'
}

async function escolherGrupoConc(silencioso = false) {
    const todas = linhasConc()
    const ls = estadoConc.multi.map(k => todas.find(x => x.chave === k)).filter(Boolean)
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (ls.length < 2 || !caixa) return
    const marca = estadoConc.multi.join(',')
    const total = r2Fin(ls.reduce((a, l) => a + Number(l.valor), 0))
    const datas = ls.map(l => l.data).sort()
    const cabeca = `${cabecaConc({ valor: total, data: datas[datas.length - 1], descricao: `${ls.length} linhas juntas`, sit: 'SEM_PAR' })}
        <div class="cc-grupo-linhas">
            <span class="cc-tags">${ls.map(l => `<span class="cc-tag cc-tag-azul" title="${escFin(l.descricao || '')}">${dataFin(l.data).slice(0, 5)} · ${dinheiro(Math.abs(l.valor))}<button type="button" class="cc-tag-tirar" title="Tirar do grupo" onclick="cliqueLinhaConc({ ctrlKey: true, preventDefault() {} }, '${l.chave}')">×</button></span>`).join('')}</span>
            <small class="cc-cinza">Marque as faturas ou baixas que somam o total. Ctrl + clique na lista junta ou tira linhas.</small>
        </div>`
    const guardado = silencioso && detalheConc?.grupo?.join(',') === ls.map(l => l.id).join(',') ? guardarDetalheConc() : null
    if (!guardado) caixa.innerHTML = `${cabeca}${vazioConc('relogio', 'Procurando faturas e baixas…')}`
    const ids = ls.map(l => l.id)
    let det
    try {
        det = await apiFin('conciliacao/linha', { id: ids[0], ids })
    } catch (err) {
        if (!guardado) caixa.innerHTML = `${cabeca}<p class="cc-explica">${escFin(mensagemErroEst(err))}</p>`
        return
    }
    if (estadoConc.multi.join(',') !== marca) return
    if (guardado && document.activeElement?.closest?.('[data-detalhe-conc]') && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return adiarVivoConc()
    detalheConc = det
    detalheConc.grupo = ids
    detalheConc.sugestoes = []
    detalheConc.cabeca = cabeca
    if (estadoConc.abaDe !== `g:${marca}`) {
        estadoConc.aba = detalheConc.combinacao ? 'faturas' : detalheConc.baixas.length ? 'baixas' : 'faturas'
        estadoConc.abaDe = `g:${marca}`
    }
    if (guardado) restaurarDetalheConc(guardado)
    else desenharDetalheConc()
}

async function escolherLinhaConc(chave, redesenhar = true, silencioso = false) {
    estadoConc.sel = chave
    if (redesenhar) pintarLinhasConc()
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
                : `${l.grupo_linhas ? `<div class="cc-alerta-gcs cc-alerta-neutro">${iconeFin('check')}<span>Casada <b>junto com ${l.grupo_linhas.length - 1 === 1 ? 'outra linha' : `outras ${l.grupo_linhas.length - 1} linhas`}</b> do extrato
                    (${l.grupo_linhas.map(g => `${dataFin(g.data).slice(0, 5)} ${dinheiro(Math.abs(g.valor))}`).join(' + ')} = <b>${dinheiro(Math.abs(l.grupo_linhas.reduce((a, g) => a + g.valor, 0)))}</b>): as baixas abaixo são do grupo todo. Desfazer desfaz o grupo.</span></div>` : ''}
            <b class="cc-sub-titulo">${iconeFin('check')} Casada com ${l.casadas.length === 1 ? 'esta baixa' : `estas ${l.casadas.length} baixas`}</b>
            ${l.casadas.length > 1 ? buscaListaConc('[data-lista-casadas]') : ''}
            <div class="cc-lista" data-lista-casadas>${l.casadas.map(b => itemConc({
                nome: b.participante || b.descricao, valor: b.mov, data: b.data,
                detalhe: escFin([b.tipo === 'RECEBER' ? 'Receber' : 'Pagar', b.descricao, b.numero && `nº ${b.numero}`, b.conta].filter(Boolean).join(' · ')),
                tags: [b.automatico ? tagConc('casou sozinha', 'ok') : '', b.criou ? tagConc('baixa feita aqui', 'azul') : '', b.data ? tagConc(`baixa em ${dataFin(String(b.data).slice(0, 10))}`) : '', tagConc(escFin(b.app))].join(''),
                depois: `<button type="button" class="fis-mini" onclick="abrirFaturaFin(${b.titulo_id})">Fatura</button>`
            })).join('')}</div>`}
            <div class="cc-rodape-detalhe">
                ${l.fechada ? '<small class="cc-cinza">Período fechado: reabra para mudar.</small>' : `<button type="button" class="fis-mini" onclick="desfazerLinhaConc(${l.id}, ${l.casadas?.some(b => b.criou) ? 'true' : 'false'}, ${l.grupo_linhas ? l.grupo_linhas.length : 0})">Desfazer</button>`}
            </div>`
        return
    }
    if (l.fechada) { caixa.innerHTML = `${cabeca}${vazioConc('vencimento', 'Período fechado.')}`; return }
    // Atualização ao vivo da mesma linha: sem o "Procurando…", e o que a pessoa marcou/buscou volta depois.
    const guardado = silencioso && !detalheConc?.grupo && detalheConc?.linha?.id === l.id && caixa.querySelector('.cc-abas') ? guardarDetalheConc() : null
    if (guardado && estadoConc.aba === 'lancar') return
    if (!guardado) caixa.innerHTML = `${cabeca}${vazioConc('relogio', 'Procurando faturas e baixas…')}`
    let det
    try {
        det = await apiFin('conciliacao/linha', { id: l.id })
    } catch (err) {
        if (!guardado) caixa.innerHTML = `${cabeca}<p class="cc-explica">${escFin(mensagemErroEst(err))}</p>`
        return
    }
    if (estadoConc.sel !== chave) return
    if (guardado && document.activeElement?.closest?.('[data-detalhe-conc]') && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return adiarVivoConc()
    detalheConc = det
    detalheConc.sugestoes = l.sugestoes || []
    detalheConc.cabeca = cabeca
    if (!estadoConc.aba || estadoConc.abaDe !== chave) {
        estadoConc.aba = detalheConc.sugestoes.length ? 'sugestao' : detalheConc.combinacao || detalheConc.faturas.some(f => f.mesmo_documento || Math.abs(f.saldo - Math.abs(l.valor)) < 0.005) ? 'faturas'
            : detalheConc.transferencias.length ? 'transferencia' : detalheConc.baixas.length ? 'baixas' : 'lancar'
        estadoConc.abaDe = chave
    }
    if (guardado) restaurarDetalheConc(guardado)
    else desenharDetalheConc()
}

// ---- atualização ao vivo (27/11/2026, a pedido): fatura, pagamento, conta corrente ou empresa mudou em qualquer
// tela (por qualquer pessoa) → o servidor avisa pelo websocket (vw_fin_titulos / vw_fin_contas) e esta tela
// recarrega sozinha: lista, painel e a linha aberta, sem tirar ninguém do lugar.

// O que o detalhe tem e não pode perder: faturas marcadas e a busca, baixas marcadas, filtros das listas,
// destino da transferência e a rolagem.
function guardarDetalheConc() {
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (!caixa || !detalheConc) return null
    if (estadoConc.aba === 'faturas' && caixa.querySelector('[data-marcar-faturas]')) guardarMarcadasFatConc()
    return {
        det: detalheConc,
        baixas: [...caixa.querySelectorAll('[data-marcar-baixas] input:checked')].map(i => i.value),
        lista: ['[data-busca-lista]', '[data-de-lista]', '[data-ate-lista]'].map(s => [s, caixa.querySelector(s)?.value || '']),
        destino: caixa.querySelector('[data-destino-conc]')?.value || null,
        rolagem: ['[data-detalhe-conc]', '.cc-aba-corpo', '[data-marcar-faturas]', '[data-marcar-baixas]'].map(s => [s, document.querySelector(s)?.scrollTop || 0])
    }
}

function restaurarDetalheConc(g) {
    const antigo = g.det
    const novo = detalheConc
    novo.diaFat = antigo.diaFat
    novo.buscaFat = antigo.buscaFat
    // Marcadas que ainda estão em aberto (estão nas candidatas novas ou na busca, que roda de novo abaixo).
    novo.marcadasFat = antigo.marcadasFat
    const buscando = Boolean(novo.buscaFat && (novo.buscaFat.busca.trim() || novo.buscaFat.de || novo.buscaFat.ate))
    if (novo.marcadasFat && !buscando) {
        const abertas = new Set(novo.faturas.map(f => String(f.id)))
        novo.marcadasFat = new Map([...novo.marcadasFat].filter(([id]) => abertas.has(id)))
    }
    // Enquanto a busca refaz, a lista mostra o resultado anterior (sem piscar).
    if (buscando) { novo.faturasBusca = antigo.faturasBusca; novo.fatPorId = antigo.fatPorId; novo.vivo = true }
    desenharDetalheConc()
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (!caixa) return
    if (g.baixas.length) {
        const marcar = new Set(g.baixas)
        caixa.querySelectorAll('[data-marcar-baixas] input[type=checkbox]').forEach(i => { i.checked = marcar.has(i.value) })
        somarMarcadasConc()
    }
    let filtrou = false
    g.lista.forEach(([s, v]) => { const i = caixa.querySelector(s); if (i && v) { i.value = v; filtrou = i } })
    if (filtrou) filtrarListaConc(filtrou, caixa.querySelector('[data-marcar-baixas]') ? '[data-marcar-baixas]' : '[data-lista-casadas]')
    if (g.destino) { const d = caixa.querySelector('[data-destino-conc]'); if (d && [...d.options].some(o => o.value === g.destino)) d.value = g.destino }
    g.rolagem.forEach(([s, y]) => { const el = document.querySelector(s); if (el) el.scrollTop = y })
    if (estadoConc.aba === 'faturas' && buscando) buscarFaturasConc()
}

let timerVivoConc = null
let vivoEmCursoConc = false
// A pessoa está digitando no detalhe (valor a baixar, busca, data): espera ela sair do campo.
function adiarVivoConc() {
    clearTimeout(timerVivoConc)
    timerVivoConc = setTimeout(atualizarAoVivoConc, 2500)
}

// Chamada pelo js/websocket.js quando muda fatura/pagamento/conta.
async function atualizarAoVivoConc() {
    clearTimeout(timerVivoConc)
    if (!document.querySelector('.cc-tela-conciliar') || !estadoConc.conta || !dadosConc) return
    // Ação desta tela em andamento (o fim dela já recarrega) ou outra atualização no meio: tenta de novo daqui a pouco.
    if (vivoEmCursoConc || sOverlay) return adiarVivoConc()
    const ativo = document.activeElement
    const digitando = ativo && /^(INPUT|TEXTAREA|SELECT)$/.test(ativo.tagName) && ativo.closest('.cc-tela-conciliar')
    vivoEmCursoConc = true
    try {
        const conta = estadoConc.conta, mes = dadosConc.mes
        const dados = await apiFin('conciliacao/linhas', { conta_bancaria_id: conta, mes })
        if (!document.querySelector('.cc-tela-conciliar') || estadoConc.conta !== conta || dadosConc.mes !== mes) return
        dadosConc = dados
        const linhas = linhasConc()
        // Lista da esquerda: só a tabela (a busca e o calendário ficam como estão).
        const tabela = document.querySelector('[data-tabela-conc]')
        const y = tabela?.scrollTop || 0
        desenharTabelaConc()
        if (tabela) tabela.scrollTop = y
        // Painel da direita: troca se ninguém está mexendo nele (data de fechar).
        const painel = document.querySelector('.cc-tela .fin-painel')
        if (painel && !(digitando && painel.contains(ativo))) {
            const yp = painel.scrollTop
            painel.innerHTML = painelConciliarConc()
            painel.scrollTop = yp
        }
        estadoConc.multi = estadoConc.multi.filter(k => podeJuntarConc(linhas.find(l => l.chave === k)))
        if (estadoConc.multi.length < 2) estadoConc.multi = []
        pintarLinhasConc()
        // Linha aberta: a mesma continua aberta, com os dados novos (ou mostra que foi resolvida por outra pessoa).
        if (estadoConc.multi.length > 1) await escolherGrupoConc(true)
        else if (estadoConc.sel && linhas.some(l => l.chave === estadoConc.sel)) await escolherLinhaConc(estadoConc.sel, false, true)
    } catch (err) {
        console.warn('Conciliação ao vivo:', err?.message || err)
    } finally {
        vivoEmCursoConc = false
    }
}

function desenharDetalheConc() {
    const caixa = document.querySelector('[data-detalhe-conc]')
    if (!caixa || !detalheConc) return
    const { linha: l, tipo, baixas, faturas, combinacao, transferencias, destinos, apps, sugestoes, cabeca, grupo } = detalheConc
    const abs = Math.abs(l.valor)
    const abas = [
        ['sugestao', 'raio', 'Sugestões', sugestoes.length, sugestoes.length],
        ['faturas', 'baixa', 'Faturas', (detalheConc.faturasBusca || faturas).length, true],
        ['baixas', 'check', 'Baixas lançadas', baixas.length, true],
        ['lancar', 'incluir', l.valor < 0 ? 'Lançar despesa' : 'Lançar receita', null, !grupo],
        ['transferencia', 'repetir', 'Transferência', transferencias.length, !grupo]
    ]
    const aba = estadoConc.aba
    let corpo = '', rodape = ''
    if (aba === 'sugestao') {
        corpo = sugestoes.map(s => {
            const um = s.itens.length === 1 ? s.itens[0] : null
            return itemConc({
                nome: um ? (um.participante_nome || um.descricao) : `${s.itens.length} baixas ${s.tipo === 'grupo' ? 'do mesmo dia' : ''}`,
                detalhe: um ? escFin([um.tipo === 'RECEBER' ? 'Receber' : 'Pagar', um.parcela_texto && `parcela ${um.parcela_texto}`, um.descricao, um.categoria, um.conta].filter(Boolean).join(' · '))
                    : escFin(s.itens.slice(0, 5).map(b => b.participante_nome || b.descricao || '').join(', ') + (s.itens.length > 5 ? '…' : '')),
                tags: [tagConc('valor exato', 'azul'), s.doc ? tagConc('mesmo CPF/CNPJ', 'ok') : '',
                    tagConc(`baixa em ${dataFin(s.itens[0].data)}${s.dias ? ` · ${s.dias} dia${s.dias === 1 ? '' : 's'} de diferença` : ''}`, s.dias ? '' : 'ok'),
                    um?.vencimento ? tagConc(`vence ${dataFin(um.vencimento)}`) : '',
                    um ? tagConc(escFin(um.app)) : '', um?.criado_por ? tagConc(`por ${escFin(um.criado_por)}`) : ''].join(''),
                valor: s.itens.reduce((a, b) => a + b.mov, 0), classe: 'cc-item-sugestao',
                depois: `<button type="button" class="fis-botao" onclick="casarConc(${l.id}, [${s.baixas.join(',')}])">Confirmar</button>`
            })
        }).join('') || vazioConc('raio', 'Sem sugestão.')
    } else if (aba === 'baixas') {
        corpo = `
            <p class="cc-explica">Baixas de ${tipo === 'RECEBER' ? 'recebimento' : 'pagamento'} destas contas, até 10 dias antes ou depois, que ainda não casaram. ${grupo ? 'Marque as que formam o total das linhas juntas.' : 'Marque as que formam esta linha (ex.: as pessoas do lote de salários).'}</p>
            ${baixas.length > 1 ? buscaListaConc('[data-marcar-baixas]') : ''}
            <div class="cc-lista" data-marcar-baixas>${baixas.map(b => itemConc({
                nome: b.participante_nome || b.descricao, marcar: true, valor: b.mov, data: b.data,
                antes: `<input type="checkbox" value="${b.id}" data-valor="${b.mov}" onchange="somarMarcadasConc()">`,
                detalhe: escFin([b.parcela_texto && `parcela ${b.parcela_texto}`, b.descricao, b.categoria, b.conta].filter(Boolean).join(' · ')),
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
        // Abre filtrada pelo vencimento no dia da linha (no grupo, do primeiro ao último dia) (27/11/2026, a pedido).
        // Fatura em aberto não tem data de pagamento: o vencimento é a data que ela tem. Limpar mostra as parecidas
        // (valor ou favorecido) de qualquer vencimento.
        if (!detalheConc.buscaFat) {
            detalheConc.diaFat = { de: (l.datas || [l.data])[0], ate: l.data }
            detalheConc.buscaFat = { busca: '', ...detalheConc.diaFat }
            detalheConc.buscarFat = true
        }
        const b = detalheConc.buscaFat
        const buscando = Boolean(b.busca.trim() || b.de || b.ate)
        if (!detalheConc.marcadasFat) {
            // Com baixa sugerida, o pagamento já está lançado: não pré-marca fatura (baixaria outra parcela em dobro).
            const ini = sugestoes.length ? [] : combinacao || (faturas.length && Math.abs(faturas[0].saldo - abs) < 0.005 ? [faturas[0].id] : [])
            detalheConc.marcadasFat = new Map(ini.map(id => [String(id), faturas.find(f => f.id === id).saldo.toFixed(2)]))
        }
        corpo = `
            ${sugestoes.length ? `<p class="cc-explica"><b>Atenção:</b> já existe baixa lançada que bate com esta linha (aba Sugestões). Baixar uma fatura aqui cria outro pagamento.</p>` : ''}
            <p class="cc-explica" data-explica-fat>${explicaFaturasConc()}</p>
            <div class="cc-busca-faturas">
                <input class="fis-input" type="search" data-busca-fat placeholder="Buscar favorecido, CPF/CNPJ, nº, descrição ou valor…" value="${escFin(b.busca)}" oninput="filtrarFaturasConc()">
                <label class="cc-busca-data" title="Vencimento a partir de"><span>Vence de</span><input class="fis-input" type="date" data-de-fat value="${escFin(b.de)}" onchange="filtrarFaturasConc(true)" onkeydown="tabParaAteConc(event, '[data-ate-fat]')"></label>
                <label class="cc-busca-data" title="Vencimento até"><span>até</span><input class="fis-input" type="date" data-ate-fat value="${escFin(b.ate)}" onchange="filtrarFaturasConc(true)"></label>
                <button type="button" class="fis-mini" data-limpar-fat ${buscando ? '' : 'hidden'} onclick="limparBuscaFaturasConc()" title="Ver as de valor parecido ou do mesmo favorecido, de qualquer vencimento">Limpar</button>
                <button type="button" class="fis-mini" data-dia-fat ${faturasDoDiaConc() ? 'hidden' : ''} onclick="faturasDoDiaFiltroConc()">Do dia ${escFin(rotuloDiaFatConc())}</button>
            </div>
            <div class="cc-lista" data-marcar-faturas>${listaFaturasConc()}</div>`
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
                    <div class="fis-campo cc-favorecido" data-favorecido-conc>${campoFavorecidoConc()}</div>
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
            <button type="button" role="tab" data-aba="${k}" aria-selected="${aba === k}" class="cc-aba ${aba === k ? 'ativo' : ''}" onclick="if (estadoConc.aba === 'faturas') guardarMarcadasFatConc(); estadoConc.aba = '${k}'; desenharDetalheConc()">
                ${iconeFin(ic)}<span>${t}</span>${n != null ? `<em>${n}</em>` : ''}</button>`).join('')}
            ${grupo ? '' : `<button type="button" class="cc-aba cc-aba-ignorar" onclick="ignorarLinhaConc(${l.id})" title="Marcar como fora do Financeiro">${iconeFin('cancelar')}<span>Fora</span></button>`}
        </div>
        <div class="cc-aba-corpo">${corpo}</div>
        ${rodape}`
    if (aba === 'faturas') {
        somarFaturasConc()
        if (detalheConc.buscarFat) { detalheConc.buscarFat = false; buscarFaturasConc() }
    }
}

const rotuloDiaFatConc = () => {
    const d = detalheConc?.diaFat
    if (!d) return ''
    return d.de === d.ate ? dataFin(d.de).slice(0, 5) : `${dataFin(d.de).slice(0, 5)} a ${dataFin(d.ate).slice(0, 5)}`
}

// A busca está no filtro inicial: só o vencimento no dia da linha, sem texto.
const faturasDoDiaConc = () => {
    const b = detalheConc?.buscaFat, d = detalheConc?.diaFat
    return Boolean(b && d && !b.busca.trim() && b.de === d.de && b.ate === d.ate)
}

function explicaFaturasConc() {
    const { linha: l, tipo, combinacao, grupo, buscaFat: b } = detalheConc
    const nome = `Faturas ${tipo === 'RECEBER' ? 'a receber' : 'a pagar'} em aberto`
    const buscando = Boolean(b.busca.trim() || b.de || b.ate)
    const texto = faturasDoDiaConc() ? `${nome} que vencem ${detalheConc.diaFat.de === detalheConc.diaFat.ate ? 'em' : 'de'} ${rotuloDiaFatConc()} (dia da linha). <b>Limpar</b> mostra as de valor parecido ou do mesmo favorecido, de qualquer vencimento.`
        : buscando ? `${nome} encontradas pela busca (as marcadas ficam no topo).`
        : `${nome} com valor parecido ou do mesmo favorecido.${combinacao ? ' <b>Já marcadas as que somam exatamente o valor.</b>' : ''} Não achou? Busque abaixo.`
    return `${texto} A baixa sai com a data da linha${grupo ? ' mais recente' : ''} (${dataFin(l.data)}).`
}

function faturasDoDiaFiltroConc() {
    const d = detalheConc?.diaFat
    if (!d) return
    const campos = { '[data-busca-fat]': '', '[data-de-fat]': d.de, '[data-ate-fat]': d.ate }
    Object.entries(campos).forEach(([s, v]) => { const i = document.querySelector(s); if (i) i.value = v })
    filtrarFaturasConc(true)
}

// Itens da aba Faturas: sem busca, as candidatas do servidor; com busca, o resultado dela. As marcadas
// (detalheConc.marcadasFat: id → valor a baixar) ficam sempre no topo, mesmo que a busca não as traga.
function listaFaturasConc() {
    const { linha: l, faturas } = detalheConc
    const abs = Math.abs(l.valor)
    const porId = detalheConc.fatPorId || (detalheConc.fatPorId = new Map())
    faturas.forEach(f => porId.set(String(f.id), f))
    const res = detalheConc.faturasBusca
    ;(res || []).forEach(f => porId.set(String(f.id), f))
    const marcadas = detalheConc.marcadasFat
    const b = detalheConc.buscaFat
    // Busca pedida e ainda sem resposta (abrir já filtrado pelo dia): só as marcadas e o aviso, sem piscar as candidatas.
    const esperando = !res && Boolean(b && (b.busca.trim() || b.de || b.ate))
    const base = esperando ? [] : res || faturas
    const lista = [...[...marcadas.keys()].filter(id => !base.some(f => String(f.id) === id)).map(id => porId.get(id)).filter(Boolean), ...base]
    const itens = lista.map(f => {
        const marcada = marcadas.has(String(f.id))
        return itemConc({
            nome: f.participante_nome, marcar: true,
            antes: `<input type="checkbox" value="${f.id}" ${marcada ? 'checked' : ''} onchange="somarFaturasConc()">`,
            detalhe: escFin([f.numero_documento && `nº ${f.numero_documento}`, f.parcela_texto, f.descricao && f.descricao !== f.participante_nome ? f.descricao : '', f.categoria].filter(Boolean).join(' · ')),
            tags: [Math.abs(f.saldo - abs) < 0.005 ? tagConc('valor exato', 'azul') : '', f.mesmo_documento ? tagConc('mesmo CPF/CNPJ', 'ok') : f.mesmo_nome ? tagConc('nome parecido', 'ok') : '',
                tagConc(`vence ${dataFin(f.vencimento)}`, f.situacao === 'ATRASADO' ? 'alerta' : ''), tagConc(escFin(f.app))].join(''),
            depois: `<span class="cc-item-campo"><input class="fis-input fis-num cc-valor" type="number" step="0.01" min="0.01" value="${marcada ? marcadas.get(String(f.id)) : f.saldo.toFixed(2)}" data-saldo="${f.saldo}" oninput="somarFaturasConc()" title="Valor a baixar (saldo ${escFin(dinheiroTexto(f.saldo))})">
                <button type="button" class="fis-mini" onclick="event.preventDefault(); abrirFaturaFin(${f.id})">Ver</button></span>`
        })
    }).join('')
    if (esperando) return `${itens}${vazioConc('relogio', 'Procurando faturas…')}`
    return itens || (res && faturasDoDiaConc() ? vazioConc('baixa', `Nenhuma fatura em aberto vencendo em ${rotuloDiaFatConc()}. Clique em Limpar para ver as de valor parecido ou do mesmo favorecido, de qualquer vencimento.`)
        : res ? vazioConc('baixa', 'Nenhuma fatura em aberto com essa busca. Se já foi paga no GCS, procure na aba "Baixas lançadas".')
        : vazioConc('baixa', 'Nenhuma fatura em aberto parecida. Busque acima ou use "Lançar" se não existir fatura.'))
}

// Guarda as marcadas (e o valor digitado) antes de redesenhar a lista.
function guardarMarcadasFatConc() {
    const m = new Map()
    document.querySelectorAll('[data-marcar-faturas] .cc-item').forEach(it => {
        const cb = it.querySelector('input[type=checkbox]')
        if (cb?.checked) m.set(cb.value, it.querySelector('.cc-valor').value)
    })
    detalheConc.marcadasFat = m
}

function redesenharListaFatConc() {
    const caixa = document.querySelector('[data-marcar-faturas]')
    if (!caixa) return
    caixa.innerHTML = listaFaturasConc()
    const b = detalheConc.buscaFat
    const limpar = document.querySelector('[data-limpar-fat]')
    if (limpar) limpar.hidden = !(b.busca.trim() || b.de || b.ate)
    const doDia = document.querySelector('[data-dia-fat]')
    if (doDia) doDia.hidden = faturasDoDiaConc()
    const explica = document.querySelector('[data-explica-fat]')
    if (explica) explica.innerHTML = explicaFaturasConc()
    // Contador da aba: o que a lista mostra agora (filtro do dia, busca ou as candidatas).
    const em = document.querySelector('.cc-aba[data-aba="faturas"] em')
    if (em) em.textContent = (detalheConc.faturasBusca || detalheConc.faturas).length
    somarFaturasConc()
}

let timerBuscaFatConc = null
function filtrarFaturasConc(agora = false) {
    clearTimeout(timerBuscaFatConc)
    timerBuscaFatConc = setTimeout(buscarFaturasConc, agora ? 0 : 350)
}

async function buscarFaturasConc() {
    const det = detalheConc
    if (!det || !document.querySelector('[data-marcar-faturas]')) return
    guardarMarcadasFatConc()
    det.buscaFat = {
        busca: document.querySelector('[data-busca-fat]')?.value || '',
        de: document.querySelector('[data-de-fat]')?.value || '',
        ate: document.querySelector('[data-ate-fat]')?.value || ''
    }
    const b = det.buscaFat
    if (!b.busca.trim() && !b.de && !b.ate) { det.faturasBusca = null; redesenharListaFatConc(); return }
    const pedido = (det.pedidoFat || 0) + 1
    det.pedidoFat = pedido
    document.querySelector('[data-marcar-faturas]').classList.add('cc-carregando')
    try {
        const r = await apiFin('conciliacao/faturas', { id: det.linha.id, busca: b.busca, de: b.de, ate: b.ate })
        if (detalheConc !== det || det.pedidoFat !== pedido) return
        det.faturasBusca = r.faturas || []
        // Busca refeita pela atualização ao vivo: marcada que não está mais em aberto (paga/excluída por alguém) sai.
        if (det.vivo) {
            det.vivo = false
            det.fatPorId = new Map()
            guardarMarcadasFatConc()
            const abertas = new Set([...det.faturas, ...det.faturasBusca].map(f => String(f.id)))
            det.marcadasFat = new Map([...det.marcadasFat].filter(([id]) => abertas.has(id)))
            document.querySelector('[data-marcar-faturas]')?.classList.remove('cc-carregando')
            redesenharListaFatConc()
            return
        }
    } catch (err) {
        if (detalheConc !== det || det.pedidoFat !== pedido) return
        det.faturasBusca = []
        popup({ mensagem: mensagemErroEst(err) })
    }
    document.querySelector('[data-marcar-faturas]')?.classList.remove('cc-carregando')
    guardarMarcadasFatConc()
    redesenharListaFatConc()
}

function limparBuscaFaturasConc() {
    ['[data-busca-fat]', '[data-de-fat]', '[data-ate-fat]'].forEach(s => { const i = document.querySelector(s); if (i) i.value = '' })
    filtrarFaturasConc(true)
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
    const grupo = detalheConc.grupo || null
    await acaoConc('baixar', { linha_id: linhaId, linhas: grupo, itens, ajuste }, () => { estadoConc.multi = []; return telaConciliarConc() }, grupo ? 'Baixa feita e linhas casadas' : 'Baixa feita e linha casada')
}

function casarConc(linhaId, baixas, linhas = null) {
    return acaoConc('casar', { linha_id: linhaId, baixas, linhas }, () => { estadoConc.multi = []; return telaConciliarConc() }, linhas ? 'Linhas casadas' : 'Linha casada')
}

function casarMarcadasConc(linhaId) {
    const ids = [...document.querySelectorAll('[data-marcar-baixas] input:checked')].map(i => Number(i.value))
    return casarConc(linhaId, ids, detalheConc.grupo || null)
}

// Favorecido da aba Lançar: do cadastro (seletor que só aceita quem existe, leva CPF/CNPJ e o vínculo) ou texto
// livre (tarifa, IOF: "Banco"). O botão de pessoa alterna; a escolha vale para as próximas linhas. Tarifa/IOF
// começa no texto livre com "Banco".
function campoFavorecidoConc(cadastro = null) {
    const l = detalheConc.linha
    const tarifa = /TAR|IOF|PACOTE/i.test(l.descricao || '')
    if (cadastro === null) cadastro = !tarifa && estadoConc.favCadastro !== false
    return `
        <span class="cc-favorecido-rotulo">${l.valor > 0 ? 'Pagador' : 'Favorecido'}${cadastro ? ' <small>do cadastro</small>' : ''}
            <button type="button" class="cc-favorecido-modo ${cadastro ? 'ativo' : ''}" aria-pressed="${cadastro}" onclick="alternarFavorecidoConc()"
                title="${cadastro ? 'Escolhendo do cadastro de clientes. Clique para digitar livre' : 'Texto livre. Clique para escolher do cadastro de clientes'}">${iconeFin('pessoa')}</button>
        </span>
        ${cadastro
            ? `<span class="opcoes fin-opcoes" name="favorecido_conc" data-modo="cadastro" onclick="abrirFavorecidoConc()">Selecione</span>`
            : `<input class="fis-input" name="participante_nome" data-modo="livre" maxlength="150" value="${escFin(tarifa ? 'Banco' : '')}">`}`
}

function alternarFavorecidoConc() {
    const caixa = document.querySelector('[data-favorecido-conc]')
    if (!caixa) return
    const cadastro = !caixa.querySelector('[data-modo="cadastro"]')
    estadoConc.favCadastro = cadastro
    caixa.innerHTML = campoFavorecidoConc(cadastro)
}

function abrirFavorecidoConc() {
    controlesCxOpcoes.favorecido_conc = {
        base: 'clientes',
        ordenar: null,
        retornar: ['nome'],
        btnExtras: `<button type="button" class="botao-cabecalho-tabela" onclick="formularioCliente()">+ Cadastrar</button>`,
        colunas: {
            'Nome': { chave: 'nome', alinhar: 'esquerda' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' }
        }
    }
    return cxOpcoes('favorecido_conc')
}

function lancarConc(linhaId) {
    const f = document.querySelector('[data-lancar-conc]')
    const v = n => f.querySelector(`[name="${n}"]`)?.value
    const corpo = { linha_id: linhaId, app: v('app'), categoria_id: v('categoria_id'), descricao: v('descricao') }
    const sel = f.querySelector('[name="favorecido_conc"]')
    if (sel) {
        if (!sel.id) return popup({ mensagem: 'Escolha o favorecido no cadastro (ou troque pelo botão de pessoa para digitar livre).' })
        corpo.cliente_id = sel.id
    } else corpo.participante_nome = v('participante_nome')
    return acaoConc('lancar', corpo, () => telaConciliarConc(), 'Lançado e casado')
}

function transferirConc(linhaId, destino) {
    return acaoConc('transferir', { linha_id: linhaId, ...destino }, () => telaConciliarConc(), 'Transferência lançada')
}

async function ignorarLinhaConc(linhaId) {
    const motivo = await pedirTextoPopup({ titulo: 'Fora do Financeiro', mensagem: 'Por que esta linha não entra no Financeiro? (ex.: aplicação automática, estorno do próprio banco)', minimo: 3, maximo: 300, textoConfirmar: 'Marcar' })
    if (!motivo) return
    return acaoConc('ignorar', { linha_id: linhaId, motivo }, () => telaConciliarConc())
}

async function desfazerLinhaConc(linhaId, criou, noGrupo = 0) {
    if (!await confirmarPopup({ titulo: 'Desfazer', mensagem: (noGrupo ? `Esta linha foi casada junto com outras ${noGrupo - 1}: todas as ${noGrupo} voltam a ficar pendentes. ` : '') + (criou
        ? 'A linha volta a ficar pendente e o pagamento feito aqui na conciliação é desfeito (a fatura lançada aqui é cancelada; na transferência, os dois lados).'
        : 'A linha volta a ficar pendente. As baixas continuam como estão.'), textoConfirmar: 'Desfazer' })) return
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
