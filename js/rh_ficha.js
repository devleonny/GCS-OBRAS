// ---------------- Ficha do funcionário (RH): exames do ASO, treinamentos e EPIs ----------------
// Visão "Ficha" da tela do RH e bloco dentro do "+" do Por pessoa, no formato da planilha
// FICHA DE EMPREGADOS: dados da pessoa no topo e três colunas (Exames do ASO, Treinamentos, EPIs)
// com vencimento e dias restantes. Exigido sem data = INAPTO (vermelho).
// Bases (gcs/migrations/rh-ficha.sql):
//   rh_exames / rh_epis   catálogos: prazo e quem precisa (exigencias: uma regra por ambiente, com
//                         "só cargos com" e "exceto cargos com"; sem exigencias vale ambientes + exceto_cargos)
//   rh_ficha_itens        lançamentos por pessoa; renovar = novo lançamento, vale o de vencimento mais novo
//   rh_funcionarios       ambiente (CAMPO / ADMINISTRATIVO; sem linha: TÉCNICO = CAMPO) e dispensa dos
//                         exames (dispensa_exames + dispensa_motivo, ex.: sem vínculo CLT)
//   rh_salarios           salário (SIGILOSO): só adm e diretoria (o servidor recusa os outros perfis). Na tela,
//                         todo valor sigiloso leva o cadeado e o aviso "só adm e diretoria" (seloSigiloRH)
// Treinamentos (NR 10, NR 35, PTA, NR 06...) são os documentos do RH (vw_documentos): aqui só leitura,
// o clique abre o formulário de documento de sempre.
const AMBIENTES_RH = ['CAMPO', 'ADMINISTRATIVO']
const TREINAMENTOS_CAMPO_RH = ['NR 06 - EPI', 'NR 10', 'NR 35', 'PTA']
const VEEM_SALARIO_RH = ['adm', 'diretoria']
const EDITAM_CATALOGO_RH = ['adm', 'diretoria']
const estadoFichaRH = { exames: [], epis: [], itens: [], ambientes: new Map(), dispensas: new Map(), salarios: new Map(), ambienteFiltro: 'todos' }

const podeVerSalarioRH = () => VEEM_SALARIO_RH.includes(acesso?.permissao)
const maiusculoRH = texto => normalizarRH(texto).toUpperCase()
const listaFichaRH = valor => {
    if (typeof valor === 'string') try { valor = JSON.parse(valor) } catch { valor = [] }
    return Array.isArray(valor) ? valor.map(v => String(v)) : []
}
const dataISO = valor => /^\d{4}-\d{2}-\d{2}/.test(String(valor || '')) ? String(valor).slice(0, 10) : ''
const somarDiasISO = (iso, dias) => {
    if (!dataISO(iso) || !Number(dias)) return ''
    const d = new Date(`${dataISO(iso)}T12:00:00`)
    d.setDate(d.getDate() + Number(dias))
    return d.toISOString().slice(0, 10)
}
const reaisRH = valor => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ---------------- Regras (puras: testadas em tests/rh-ficha.test.cjs) ----------------

// Ambiente: o escolhido na ficha; sem escolha, técnico = CAMPO e o resto ADMINISTRATIVO.
function ambienteRH(pessoa, ambientes = estadoFichaRH.ambientes) {
    const escolhido = ambientes.get(String(pessoa.id))
    return AMBIENTES_RH.includes(escolhido) ? escolhido : pessoa.tecnico ? 'CAMPO' : 'ADMINISTRATIVO'
}

// Item do catálogo exigido para a pessoa: ambiente na lista e nenhum trecho de cargo que dispense
// (comparação sem acento e em maiúsculas: "ENCARRE" pega ENCARREGADO e o ENCARRECADO digitado errado).
// Regras por ambiente: só cargos com algum trecho de "apenas" (quando houver), nenhum de "exceto".
// "SERVICOS GERAIS" pega SERVIÇOS GERAIS.
function itemExigidoRH(item, ambiente, cargo) {
    if (item.ativo === false) return false
    const cargoNormal = maiusculoRH(cargo)
    const tem = trechos => trechos.some(t => t.trim() && cargoNormal.includes(maiusculoRH(t).trim()))
    return regrasExigenciaRH(item).some(r => r.ambiente === ambiente && (!r.apenas.length || tem(r.apenas)) && !tem(r.exceto))
}

// Regras do item: [{ ambiente, apenas: [trechos], exceto: [trechos] }].
// Sem a coluna exigencias (catálogo antigo), monta a partir de ambientes + exceto_cargos.
function regrasExigenciaRH(item) {
    let regras = item?.exigencias
    if (typeof regras === 'string') try { regras = JSON.parse(regras) } catch { regras = null }
    if (Array.isArray(regras) && regras.length)
        return regras.filter(r => AMBIENTES_RH.includes(r?.ambiente))
            .map(r => ({ ambiente: r.ambiente, apenas: listaFichaRH(r.apenas), exceto: listaFichaRH(r.exceto) }))
    return listaFichaRH(item?.ambientes).map(ambiente => ({ ambiente, apenas: [], exceto: listaFichaRH(item?.exceto_cargos) }))
}

// Resumo legível das regras (lista do catálogo).
function textoExigenciaRH(item) {
    const regras = regrasExigenciaRH(item)
    if (!regras.length) return 'Ninguém'
    return regras.map(r => `${r.ambiente === 'CAMPO' ? 'Campo' : 'Adm.'}${r.apenas.length ? ` só ${r.apenas.join(', ')}` : ''}${r.exceto.length ? ` exceto ${r.exceto.join(', ')}` : ''}`).join(' · ')
}

// Situação de uma linha da ficha. rotulo = o que aparece na coluna "Dias" (como na planilha).
function situacaoFichaRH(vencimento, exigido, hoje = dataServidor()) {
    if (!dataISO(vencimento))
        return exigido
            ? { cor: 'vermelho', rotulo: 'INAPTO', texto: 'Sem data: INAPTO', dias: null }
            : { cor: 'cinza', rotulo: '—', texto: 'Sem vencimento', dias: null }
    const base = new Date(hoje); base.setHours(12, 0, 0, 0)
    const dias = Math.round((new Date(`${dataISO(vencimento)}T12:00:00`) - base) / 86400000)
    if (dias < 0) return { cor: 'vermelho', rotulo: String(dias), texto: `Vencido há ${-dias} dia(s)`, dias }
    if (dias <= DIAS_AVISO_RH) return { cor: 'laranja', rotulo: String(dias), texto: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dia(s)`, dias }
    return { cor: 'verde', rotulo: String(dias), texto: `Em dia (vence em ${dias} dias)`, dias }
}

// Lançamentos de um item, do vencimento mais novo para o mais antigo (o primeiro é o que vale).
function lancamentosRH(itens, idPessoa, tipo, item) {
    return itens
        .filter(i => !i.excluido && String(i.funcionario) === String(idPessoa) && i.tipo === tipo && String(i.item) === String(item))
        .sort((a, b) => (dataISO(b.vencimento) || dataISO(b.realizado)).localeCompare(dataISO(a.vencimento) || dataISO(a.realizado))
            || Number(b.timestamp || 0) - Number(a.timestamp || 0))
}

// Linhas de uma coluna do catálogo (exames ou EPIs): exigidos sempre; não exigidos só com lançamento.
// dispensado: a pessoa não precisa destes itens (ex.: sem vínculo CLT); só os lançados aparecem.
function linhasCatalogoRH(catalogo, tipo, pessoa, ambiente, itens, hoje, dispensado = false) {
    return [...catalogo]
        .filter(c => c.ativo !== false)
        .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        .map(c => {
            const exigido = !dispensado && itemExigidoRH(c, ambiente, pessoa.cargo)
            const historico = lancamentosRH(itens, pessoa.id, tipo, c.id)
            const atual = historico[0] || null
            return { tipo, item: c, exigido, atual, historico, situacao: situacaoFichaRH(atual?.vencimento, exigido, hoje) }
        })
        .filter(l => l.exigido || l.atual)
}

// Treinamentos: os exigidos no campo e qualquer certificado que a pessoa tenha (documentos do RH).
function linhasTreinamentosRH(pessoa, ambiente, hoje) {
    const docs = (pessoa.documentos || []).filter(d => d.doc)
    const tipos = new Set([
        ...(ambiente === 'CAMPO' ? TREINAMENTOS_CAMPO_RH : []),
        ...docs.filter(d => d.pasta === 'CERTIFICADOS' || /^NR /i.test(d.doc) || d.doc === 'PTA').map(d => d.doc)
    ])
    return [...tipos].sort((a, b) => a.localeCompare(b, 'pt-BR')).map(tipo => {
        const doc = docs.filter(d => d.doc === tipo).sort((a, b) => String(b.validadeData || '').localeCompare(String(a.validadeData || '')))[0] || null
        const exigido = ambiente === 'CAMPO' && TREINAMENTOS_CAMPO_RH.includes(tipo)
        const situacao = !doc
            ? situacaoFichaRH(null, exigido, hoje)
            : Number(doc.prazo) && doc.validadeData ? situacaoFichaRH(doc.validadeData, exigido, hoje) : { cor: 'verde', rotulo: '—', texto: 'Sem vencimento', dias: null }
        return { tipo: 'treinamento', nome: tipo, doc, exigido, situacao }
    })
}

function montarFichaRH(pessoa, { exames = estadoFichaRH.exames, epis = estadoFichaRH.epis, itens = estadoFichaRH.itens, ambientes = estadoFichaRH.ambientes, dispensas = estadoFichaRH.dispensas, hoje = dataServidor() } = {}) {
    const ambiente = ambienteRH(pessoa, ambientes)
    const dispensa = dispensas.has(String(pessoa.id)) ? { motivo: dispensas.get(String(pessoa.id)) || '' } : null
    const ficha = {
        ambiente, dispensa,
        exames: linhasCatalogoRH(exames, 'exame', pessoa, ambiente, itens, hoje, !!dispensa),
        treinamentos: linhasTreinamentosRH(pessoa, ambiente, hoje),
        epis: linhasCatalogoRH(epis, 'epi', pessoa, ambiente, itens, hoje)
    }
    // Situação da ficha: só os exigidos contam (não exigido vencido não deixa a pessoa INAPTA).
    const exigidos = [...ficha.exames, ...ficha.treinamentos, ...ficha.epis].filter(l => l.exigido)
    const vermelhos = exigidos.filter(l => l.situacao.cor === 'vermelho')
    const laranjas = exigidos.filter(l => l.situacao.cor === 'laranja')
    const nomes = lista => lista.map(l => l.item?.nome || l.nome).join(', ')
    ficha.situacao = vermelhos.length
        ? { cor: 'vermelho', texto: `${vermelhos.length} vencido(s) / INAPTO: ${nomes(vermelhos)}` }
        : laranjas.length
            ? { cor: 'laranja', texto: `${laranjas.length} a vencer em até ${DIAS_AVISO_RH} dias: ${nomes(laranjas)}` }
            : { cor: 'verde', texto: exigidos.length ? 'Ficha em dia' : dispensa ? 'Dispensado dos exames' : 'Nada exigido para este ambiente/cargo' }
    ficha.resumo = [
        vermelhos.length ? `${vermelhos.length} vencido(s)/INAPTO` : '',
        laranjas.length ? `${laranjas.length} a vencer` : ''
    ].filter(Boolean).join(' · ') || ficha.situacao.texto
    return ficha
}

// ---------------- Carregamento (chamado por carregarRH em js/rh.js) ----------------
// Antes da migração (bases inexistentes) a ficha fica vazia sem quebrar a tela de documentos.
async function carregarFichaRH() {
    const [exames, epis, itens, ambientes, salarios] = await Promise.all([
        pesquisarTodosRH('rh_exames').catch(() => []),
        pesquisarTodosRH('rh_epis').catch(() => []),
        pesquisarTodosRH('rh_ficha_itens').catch(() => []),
        pesquisarTodosRH('rh_funcionarios').catch(() => []),
        podeVerSalarioRH() ? pesquisarTodosRH('rh_salarios').catch(() => []) : []
    ])
    Object.assign(estadoFichaRH, {
        exames, epis,
        itens: itens.filter(i => !i.excluido),
        ambientes: new Map(ambientes.filter(a => a.ambiente).map(a => [String(a.id), a.ambiente])),
        dispensas: new Map(ambientes.filter(a => a.dispensa_exames).map(a => [String(a.id), a.dispensa_motivo || ''])),
        salarios: new Map(salarios.filter(s => s.salario != null && s.salario !== '').map(s => [String(s.id), Number(s.salario)]))
    })
}

// ---------------- Visão "Ficha" ----------------
function telaFichaRH(pessoas) {
    const filtradas = pessoas
        .map(p => ({ p, ficha: montarFichaRH(p) }))
        .filter(({ ficha }) => estadoFichaRH.ambienteFiltro === 'todos' || ficha.ambiente === estadoFichaRH.ambienteFiltro)
        .filter(({ ficha }) => estadoRH.situacao === 'todos' || ficha.situacao.cor === estadoRH.situacao)
    const barra = `
        <div class="rhf-barra">
            <select aria-label="Ambiente" onchange="estadoFichaRH.ambienteFiltro = this.value; renderizarRH()">
                ${[['todos', 'Campo e administrativo'], ['CAMPO', 'Só campo'], ['ADMINISTRATIVO', 'Só administrativo']]
                    .map(([v, t]) => `<option value="${v}" ${estadoFichaRH.ambienteFiltro === v ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            <small>Clique numa linha para lançar a data. Exigido sem data aparece como <b class="rhf-inapto">INAPTO</b>.</small>
            ${EDITAM_CATALOGO_RH.includes(acesso?.permissao) ? '<button type="button" class="secundario" onclick="catalogoFichaRH()">Exames e EPIs exigidos</button>' : ''}
        </div>
        ${podeVerSalarioRH() ? `
        <div class="rhf-aviso-sigilo" role="note">
            ${iconeSigiloRH()}
            <span><b>Você vê informações sigilosas.</b> O que tem este cadeado (salário) aparece só para <b>adm e diretoria</b>;
            os demais perfis não recebem esses valores do servidor e veem a ficha sem eles.</span>
        </div>` : ''}`
    if (!filtradas.length) return `${barra}<p class="rh2-vazio">Nenhum funcionário neste filtro.</p>`
    return `${barra}
        <div class="rhf-lista">${filtradas.map(({ p, ficha }) => fichaPessoaRH(p, ficha)).join('')}</div>
        <p class="rh2-rodape">${filtradas.length} funcionário(s)</p>`
}

// Bloco de uma pessoa. compacto = dentro do "+" do Por pessoa (sem foto/nome, que já estão na linha).
function fichaPessoaRH(p, ficha = montarFichaRH(p), { compacto = false } = {}) {
    const id = escaparAtributo(p.id)
    const gestor = p.gestor ? estadoRH.porId.get(String(p.gestor)) : null
    const salario = estadoFichaRH.salarios.get(String(p.id))
    const dados = [
        p.cnpj, p.cargo, p.setor, p.estado
    ].filter(Boolean).map(escaparAtributo)
    const chipAmbiente = `<button type="button" class="rhf-chip rhf-ambiente ${ficha.ambiente === 'CAMPO' ? 'campo' : ''}" title="Ambiente: define os exames e EPIs exigidos. Clique para trocar ou dispensar dos exames"
        onclick="escolherAmbienteRH('${id}')">${ficha.ambiente}</button>`
    const chipDispensa = ficha.dispensa
        ? `<button type="button" class="rhf-chip rhf-dispensa" title="${escaparAtributo(`Dispensado dos exames do ASO${ficha.dispensa.motivo ? `: ${ficha.dispensa.motivo}` : ''}. Clique para alterar`)}"
            onclick="escolherAmbienteRH('${id}')">Dispensado dos exames</button>`
        : ''
    const chipSalario = podeVerSalarioRH()
        ? `<button type="button" class="rhf-chip rhf-sigilo" title="Sigiloso: só adm e diretoria veem. Clique para alterar" onclick="editarSalarioRH('${id}')">
            ${iconeSigiloRH()} Salário: ${salario != null ? reaisRH(salario) : 'informar'}<span class="rhf-sigilo-texto">só adm/diretoria</span></button>`
        : ''
    return `
        <section class="rhf-ficha ${compacto ? 'compacta' : ''}" data-pessoa="${id}">
            <header class="rhf-topo">
                ${compacto ? '' : fotoPessoaRH(p)}
                <div class="rhf-identificacao">
                    ${compacto ? '' : nomePessoaRH({ ...p, cargo: null })}
                    <div class="rhf-dados">${dados.join('<span aria-hidden="true">·</span>')}${chipAmbiente}${chipDispensa}
                        ${compacto ? '' : `<span>Gestor: ${escaparAtributo(gestor?.nome || '—')}</span>`}${chipSalario}</div>
                </div>
                <span class="rhf-resumo ${ficha.situacao.cor}" title="${escaparAtributo(ficha.situacao.texto)}">${bolinhaRH(ficha.situacao)} ${escaparAtributo(ficha.resumo)}</span>
            </header>
            <div class="rhf-colunas">
                ${colunaFichaRH(p, 'Exames do ASO', ficha.exames, documentoCabecalhoRH(p, 'ASO'), ['Cód.', 'Exame', 'Vence em', 'Dias'],
                    ficha.dispensa ? `Dispensado dos exames${ficha.dispensa.motivo ? `: ${ficha.dispensa.motivo}` : ''}.` : undefined)}
                ${colunaFichaRH(p, 'Treinamentos', ficha.treinamentos, '', ['', 'Treinamento', 'Vence em', 'Dias'])}
                ${colunaFichaRH(p, 'EPIs', ficha.epis, documentoCabecalhoRH(p, 'FICHA DE EPI'), ['CA', 'EPI', 'Vence em', 'Dias'])}
            </div>
        </section>`
}

// Documento ligado à coluna (ASO, Ficha de EPI): situação e clique para abrir/lançar.
function documentoCabecalhoRH(p, tipo) {
    const doc = (p.documentos || []).filter(d => d.doc === tipo).sort((a, b) => String(b.validadeData || '').localeCompare(String(a.validadeData || '')))[0]
    const texto = doc ? `${tipo}: ${doc.validade || 'sem data'}` : `${tipo}: não anexado`
    const acao = doc
        ? `incluirDocumento('${escaparAtributo(doc.id)}')`
        : `incluirDocumento(null, '${escaparAtributo(p.id)}', { doc: '${escaparAtributo(tipo)}' })`
    return `<button type="button" class="rhf-doc" title="${doc ? `Abrir o documento ${escaparAtributo(tipo)}` : `Anexar o ${escaparAtributo(tipo)}`}" onclick="${acao}">
        ${doc ? bolinhaRH(doc.situacao) : '<span class="rh-bolinha cinza" aria-hidden="true"></span>'} ${escaparAtributo(texto)}</button>`
}

function colunaFichaRH(p, titulo, linhas, extra, cabecalho, vazio = 'Nada exigido para este ambiente/cargo.') {
    return `
        <div class="rhf-coluna">
            <div class="rhf-coluna-titulo"><b>${titulo}</b>${extra}</div>
            <div class="rhf-tabela" role="table" aria-label="${escaparAtributo(titulo)}">
                <div class="rhf-linha rhf-cabecalho" role="row">${cabecalho.map(c => `<span role="columnheader">${c}</span>`).join('')}</div>
                ${linhas.length ? linhas.map(l => linhaFichaRH(p, l)).join('') : `<small class="rhf-vazio">${escaparAtributo(vazio)}</small>`}
            </div>
        </div>`
}

function linhaFichaRH(p, l) {
    const id = escaparAtributo(p.id)
    let codigo, nome, vencimento, acao, titulo
    if (l.tipo === 'treinamento') {
        codigo = ''
        nome = l.nome
        vencimento = l.doc?.validadeData
        acao = l.doc
            ? `incluirDocumento('${escaparAtributo(l.doc.id)}')`
            : `incluirDocumento(null, '${id}', { doc: '${escaparAtributo(l.nome)}' })`
        titulo = l.doc ? `Feito em ${l.doc.realizado || '—'}. Clique para abrir o documento` : 'Clique para lançar o documento'
    } else {
        codigo = l.tipo === 'epi' ? (l.atual?.ca || l.item.ca || '') : l.item.id
        nome = l.item.nome
        vencimento = l.atual?.vencimento
        acao = `lancarFichaRH('${id}', '${l.tipo}', '${escaparAtributo(l.item.id)}')`
        const feito = l.atual?.realizado ? `${l.tipo === 'epi' ? 'Entregue' : 'Feito'} em ${dataBRDeISO(l.atual.realizado)}. ` : ''
        titulo = `${feito}${l.exigido ? '' : 'Não exigido para este ambiente/cargo. '}${l.historico.length > 1 ? `${l.historico.length} lançamentos. ` : ''}Clique para lançar ou renovar`
    }
    return `
        <button type="button" class="rhf-linha ${l.exigido ? '' : 'nao-exigido'}" role="row" title="${escaparAtributo(titulo)}" onclick="${acao}">
            <span class="rhf-codigo">${escaparAtributo(codigo)}</span>
            <span class="rhf-nome">${escaparAtributo(nome)}</span>
            <span class="rhf-data">${vencimento ? dataBRDeISO(vencimento) : '—'}</span>
            <span class="rhf-dias ${l.situacao.cor}" title="${escaparAtributo(l.situacao.texto)}">${escaparAtributo(l.situacao.rotulo)}</span>
        </button>`
}

// ---------------- Lançar exame / EPI ----------------
function catalogoItemRH(tipo, item) {
    return (tipo === 'epi' ? estadoFichaRH.epis : estadoFichaRH.exames).find(c => String(c.id) === String(item)) || { id: item, nome: item }
}

// Abre o lançamento que vale (para corrigir) ou um novo (renovar: novo = true, ou sem lançamento).
function lancarFichaRH(idPessoa, tipo, item, { novo = false, idLancamento = null } = {}) {
    const pessoa = estadoRH.porId.get(String(idPessoa)) || { id: idPessoa }
    const catalogo = catalogoItemRH(tipo, item)
    const historico = lancamentosRH(estadoFichaRH.itens, idPessoa, tipo, item)
    const registro = idLancamento ? historico.find(h => h.id === idLancamento) : novo ? null : historico[0]
    const epi = tipo === 'epi'
    const prazo = Number(catalogo.prazo_dias) || 0
    const linhas = [
        { texto: 'Funcionário', elemento: `<b>${escaparAtributo(pessoa.nome || '')}</b>` },
        { texto: epi ? 'EPI' : 'Exame', elemento: `<b>${escaparAtributo(epi ? catalogo.nome : `${catalogo.id} · ${catalogo.nome}`)}</b>` },
        ...(epi ? [{ texto: 'CA', elemento: `<input name="ca" inputmode="numeric" value="${escaparAtributo(registro?.ca ?? catalogo.ca ?? '')}">` }] : []),
        {
            texto: epi ? 'Entregue em' : 'Feito em',
            elemento: `<input name="realizado" type="date" value="${escaparAtributo(dataISO(registro?.realizado))}" data-prazo="${prazo}"
                oninput="sugerirVencimentoRH(this)">`
        },
        {
            texto: 'Vence em',
            elemento: `<div class="rhf-vence">
                <input name="vencimento" type="date" value="${escaparAtributo(dataISO(registro?.vencimento))}">
                ${prazo ? `<small>Preenche sozinho: ${epi ? 'entrega' : 'exame'} + ${prazo} dias.</small>` : ''}</div>`
        },
        { texto: 'Observação', elemento: `<input name="obs" value="${escaparAtributo(registro?.obs || '')}" placeholder="Clínica, resultado, motivo da troca…">` }
    ]
    if (historico.length)
        linhas.push({
            texto: 'Histórico',
            elemento: `<div class="rhf-historico">${historico.map(h => `
                <button type="button" class="${h.id === registro?.id ? 'atual' : ''}" title="Abrir este lançamento"
                    onclick="removerPopup(this.closest('.popup').id); lancarFichaRH('${escaparAtributo(idPessoa)}', '${tipo}', '${escaparAtributo(item)}', { idLancamento: '${escaparAtributo(h.id)}' })">
                    ${epi ? 'Entregue' : 'Feito'} ${h.realizado ? dataBRDeISO(h.realizado) : '—'} · vence ${h.vencimento ? dataBRDeISO(h.vencimento) : '—'}${h.ca ? ` · CA ${escaparAtributo(h.ca)}` : ''}${h.usuario ? ` · ${escaparAtributo(h.usuario)}` : ''}
                </button>`).join('')}</div>`
        })

    const alvo = `'${escaparAtributo(idPessoa)}', '${tipo}', '${escaparAtributo(item)}'`
    const botoes = [{ texto: 'Salvar', img: 'concluido', funcao: `salvarLancamentoFichaRH(this, ${alvo}, ${registro ? `'${escaparAtributo(registro.id)}'` : 'null'})` }]
    if (registro) {
        botoes.push({ texto: 'Renovar (novo lançamento)', img: 'baixar', funcao: `removerPopup(this.closest('.popup').id); lancarFichaRH(${alvo}, { novo: true })` })
        botoes.push({ texto: 'Excluir lançamento', img: 'cancel', funcao: `excluirLancamentoFichaRH(this, '${escaparAtributo(registro.id)}')` })
    }
    popup({ titulo: registro ? `${epi ? 'EPI' : 'Exame'}: corrigir lançamento` : `${epi ? 'Entrega de EPI' : 'Exame'}: novo lançamento`, linhas, botoes })
}

function sugerirVencimentoRH(input) {
    const vence = input.closest('.painel-padrao')?.querySelector('[name="vencimento"]')
    const sugestao = somarDiasISO(input.value, input.dataset.prazo)
    if (vence && sugestao) vence.value = sugestao
}

async function salvarLancamentoFichaRH(botao, idPessoa, tipo, item, idRegistro) {
    const janela = botao.closest('.popup')
    const valor = nome => janela?.querySelector(`[name="${nome}"]`)?.value?.trim() || ''
    const realizado = dataISO(valor('realizado'))
    const vencimento = dataISO(valor('vencimento')) || somarDiasISO(realizado, catalogoItemRH(tipo, item).prazo_dias)
    if (!realizado && !vencimento)
        return popup({ mensagem: 'Informe a data em que foi feito/entregue ou a data de vencimento.' })
    if (realizado && vencimento && vencimento < realizado)
        return popup({ mensagem: 'O vencimento está antes da data em que foi feito.' })

    const anterior = idRegistro ? estadoFichaRH.itens.find(i => i.id === idRegistro) : null
    const registro = {
        id: idRegistro || crypto.randomUUID(),
        funcionario: Number(idPessoa), tipo, item: String(item),
        realizado: realizado || null, vencimento: vencimento || null,
        obs: valor('obs') || null,
        ...(tipo === 'epi' ? { ca: valor('ca') || null } : {}),
        usuario: anterior?.usuario || acesso.usuario
    }
    overlayAguarde()
    const resposta = await enviar(`rh_ficha_itens/${registro.id}`, registro)
    removerOverlay()
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar o lançamento.' })

    estadoFichaRH.itens = [...estadoFichaRH.itens.filter(i => i.id !== registro.id), { ...registro, timestamp: Date.now() }]
    removerPopup(janela?.id)
    renderizarRH()
}

async function excluirLancamentoFichaRH(botao, idRegistro) {
    const janela = botao.closest('.popup')
    if (!await confirmarPopup({ mensagem: 'Excluir este lançamento? Se houver um anterior, ele volta a valer.', textoConfirmar: 'Excluir' })) return
    const resposta = await deletar(`rh_ficha_itens/${idRegistro}`)
    if (!resposta?.success) return
    estadoFichaRH.itens = estadoFichaRH.itens.filter(i => i.id !== idRegistro)
    removerPopup(janela?.id)
    renderizarRH()
}

// ---------------- Ambiente, dispensa e salário ----------------
// Cadeado de valor sigiloso (salário): o mesmo desenho do cadeado das pastas do RH.
function iconeSigiloRH() {
    return `<svg class="rhf-cadeado" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path d="M4.5 7V5a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <rect x="2.5" y="7" width="11" height="8" rx="1.6" fill="currentColor"/></svg>`
}

function escolherAmbienteRH(idPessoa) {
    const pessoa = estadoRH.porId.get(String(idPessoa)) || {}
    const atual = ambienteRH(pessoa)
    const dispensado = estadoFichaRH.dispensas.has(String(idPessoa))
    popup({
        titulo: 'Ambiente e exigências',
        linhas: [
            { texto: 'Funcionário', elemento: `<b>${escaparAtributo(pessoa.nome || '')}</b>` },
            {
                texto: 'Ambiente',
                elemento: `<div class="rhf-vence"><div class="rhf-checks">${AMBIENTES_RH.map(a => `
                    <label><input type="radio" name="ambiente" value="${a}" ${a === atual ? 'checked' : ''}> ${a === 'CAMPO' ? 'Campo' : 'Administrativo'}</label>`).join('')}</div>
                    <small>Define os exames e EPIs exigidos (botão "Exames e EPIs exigidos").</small></div>`
            },
            {
                texto: 'Exames do ASO',
                elemento: `<label><input type="checkbox" name="dispensa_exames" ${dispensado ? 'checked' : ''}> Dispensado dos exames (não fica INAPTO)</label>`
            },
            {
                texto: 'Motivo da dispensa',
                elemento: `<input name="dispensa_motivo" value="${escaparAtributo(estadoFichaRH.dispensas.get(String(idPessoa)) || '')}" placeholder="Ex.: sem vínculo CLT, sócio, estagiário…">`
            }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarAmbienteRH(this, '${escaparAtributo(idPessoa)}')` }]
    })
}

async function salvarAmbienteRH(botao, idPessoa) {
    const janela = botao.closest('.popup')
    const ambiente = janela?.querySelector('[name="ambiente"]:checked')?.value
    const dispensa = !!janela?.querySelector('[name="dispensa_exames"]')?.checked
    const motivo = janela?.querySelector('[name="dispensa_motivo"]')?.value?.trim() || ''
    if (!AMBIENTES_RH.includes(ambiente))
        return popup({ mensagem: 'Escolha o ambiente.' })
    const resposta = await enviar(`rh_funcionarios/${idPessoa}`, {
        id: String(idPessoa), ambiente, dispensa_exames: dispensa, dispensa_motivo: dispensa ? motivo || null : null, usuario: acesso.usuario
    })
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar.' })
    estadoFichaRH.ambientes.set(String(idPessoa), ambiente)
    dispensa ? estadoFichaRH.dispensas.set(String(idPessoa), motivo) : estadoFichaRH.dispensas.delete(String(idPessoa))
    removerPopup(janela?.id)
    renderizarRH()
}

function editarSalarioRH(idPessoa) {
    if (!podeVerSalarioRH()) return
    const pessoa = estadoRH.porId.get(String(idPessoa)) || {}
    const atual = estadoFichaRH.salarios.get(String(idPessoa))
    popup({
        titulo: 'Salário (sigiloso)',
        linhas: [
            {
                elemento: `<div class="rhf-aviso-sigilo">${iconeSigiloRH()}<span><b>Sigiloso:</b> só <b>adm e diretoria</b> veem e alteram.
                    Os demais perfis não recebem este valor.</span></div>`
            },
            { texto: 'Funcionário', elemento: `<b>${escaparAtributo(pessoa.nome || '')}</b>` },
            { texto: 'Salário (R$)', elemento: `<input name="salario" type="number" min="0" step="0.01" value="${atual ?? ''}">` },
            { elemento: '<small>Deixe vazio para apagar.</small>' }
        ],
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarSalarioRH(this, '${escaparAtributo(idPessoa)}')` }]
    })
}

async function salvarSalarioRH(botao, idPessoa) {
    const janela = botao.closest('.popup')
    const texto = janela?.querySelector('[name="salario"]')?.value?.trim() || ''
    const salario = texto === '' ? null : Number(texto)
    if (salario != null && !(salario >= 0))
        return popup({ mensagem: 'Salário inválido.' })
    const resposta = await enviar(`rh_salarios/${idPessoa}`, { id: String(idPessoa), salario, usuario: acesso.usuario })
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar o salário.' })
    salario == null ? estadoFichaRH.salarios.delete(String(idPessoa)) : estadoFichaRH.salarios.set(String(idPessoa), salario)
    removerPopup(janela?.id)
    renderizarRH()
}

// ---------------- Catálogo: exames e EPIs exigidos (adm e diretoria) ----------------
function catalogoFichaRH() {
    const tabela = (tipo, lista) => `
        <div class="rhf-catalogo-grupo">
            <div class="rhf-catalogo-titulo"><b>${tipo === 'epi' ? 'EPIs' : 'Exames do ASO'}</b>
                <button type="button" class="secundario" onclick="removerPopup(this.closest('.popup').id); itemCatalogoRH('${tipo}')">+ ${tipo === 'epi' ? 'EPI' : 'Exame'}</button></div>
            ${[...lista].sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0)).map(c => `
                <button type="button" class="rhf-catalogo-linha ${c.ativo === false ? 'inativo' : ''}" onclick="removerPopup(this.closest('.popup').id); itemCatalogoRH('${tipo}', '${escaparAtributo(c.id)}')">
                    <span>${escaparAtributo(tipo === 'epi' ? `CA ${c.ca || '—'}` : c.id)}</span>
                    <span>${escaparAtributo(c.nome)}</span>
                    <span>${escaparAtributo(textoExigenciaRH(c))}</span>
                    <span>${Number(c.prazo_dias) || 0} dias</span>
                </button>`).join('')}
        </div>`
    popup({
        titulo: 'Exames e EPIs exigidos',
        elemento: `<div class="rhf-catalogo">${tabela('exame', estadoFichaRH.exames)}${tabela('epi', estadoFichaRH.epis)}</div>`
    })
}

// Uma linha por ambiente: marcar = exigido; "só cargos com" restringe; "exceto cargos com" dispensa.
function itemCatalogoRH(tipo, id = null) {
    const epi = tipo === 'epi'
    const c = id ? catalogoItemRH(tipo, id) : { exigencias: [{ ambiente: 'CAMPO' }], prazo_dias: epi ? 180 : 365, ativo: true }
    const regras = new Map(regrasExigenciaRH(c).map(r => [r.ambiente, r]))
    const texto = lista => escaparAtributo((lista || []).join(', '))
    const linhas = [
        ...(epi ? [] : [{ texto: 'Código', elemento: `<input name="codigo" value="${escaparAtributo(c.id || '')}" ${id ? 'disabled' : ''} placeholder="Código da clínica (ex.: 0281)">` }]),
        { texto: 'Nome', elemento: `<input name="nome" value="${escaparAtributo(c.nome || '')}">` },
        ...(epi ? [{ texto: 'CA', elemento: `<input name="ca" inputmode="numeric" value="${escaparAtributo(c.ca || '')}">` }] : []),
        { texto: 'Prazo (dias)', elemento: `<input name="prazo_dias" type="number" min="0" value="${Number(c.prazo_dias) || 0}">` },
        ...AMBIENTES_RH.map(a => {
            const r = regras.get(a)
            return {
                texto: a === 'CAMPO' ? 'Campo' : 'Administrativo',
                elemento: `<div class="rhf-regra" data-ambiente="${a}">
                    <label><input type="checkbox" name="exigido" ${r ? 'checked' : ''}> Exigido</label>
                    <input name="apenas" value="${texto(r?.apenas)}" placeholder="Só cargos com (vazio = todos)">
                    <input name="exceto" value="${texto(r?.exceto)}" placeholder="Exceto cargos com">
                </div>`
            }
        }),
        { elemento: '<small>Trechos do cargo separados por vírgula, sem diferença de acento ou maiúscula (ex.: ENCARRE, SERVICOS GERAIS).</small>' },
        { texto: 'Ordem', elemento: `<input name="ordem" type="number" value="${Number(c.ordem) || 0}">` },
        { texto: 'Ativo', elemento: `<label><input type="checkbox" name="ativo" ${c.ativo === false ? '' : 'checked'}> Aparece na ficha</label>` }
    ]
    popup({
        titulo: id ? `Editar ${epi ? 'EPI' : 'exame'}` : `Novo ${epi ? 'EPI' : 'exame'}`,
        linhas,
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: `salvarItemCatalogoRH(this, '${tipo}', ${id ? `'${escaparAtributo(id)}'` : 'null'})` }]
    })
}

async function salvarItemCatalogoRH(botao, tipo, id) {
    const janela = botao.closest('.popup')
    const campo = nome => janela?.querySelector(`[name="${nome}"]`)
    const nome = campo('nome')?.value?.trim()
    const epi = tipo === 'epi'
    const novoId = id || (epi ? `epi-${crypto.randomUUID().slice(0, 8)}` : campo('codigo')?.value?.trim())
    if (!nome || !novoId)
        return popup({ mensagem: epi ? 'Informe o nome do EPI.' : 'Informe o código e o nome do exame.' })
    const base = epi ? 'rh_epis' : 'rh_exames'
    const lista = epi ? estadoFichaRH.epis : estadoFichaRH.exames
    if (!id && lista.some(c => String(c.id) === novoId))
        return popup({ mensagem: 'Já existe um exame com este código.' })
    const trechos = (bloco, nome) => String(bloco.querySelector(`[name="${nome}"]`)?.value || '').split(',').map(t => t.trim()).filter(Boolean)
    const exigencias = [...janela.querySelectorAll('.rhf-regra')]
        .filter(bloco => bloco.querySelector('[name="exigido"]')?.checked)
        .map(bloco => ({ ambiente: bloco.dataset.ambiente, apenas: trechos(bloco, 'apenas'), exceto: trechos(bloco, 'exceto') }))
    const registro = {
        id: novoId, nome,
        ...(epi ? { ca: campo('ca')?.value?.trim() || null } : {}),
        prazo_dias: Number(campo('prazo_dias')?.value) || 0,
        exigencias,
        // Colunas antigas acompanham (só leitura de quem ainda não tem exigencias).
        ambientes: exigencias.map(r => r.ambiente),
        exceto_cargos: [],
        ordem: Number(campo('ordem')?.value) || 0,
        ativo: !!campo('ativo')?.checked,
        usuario: acesso.usuario
    }
    const resposta = await enviar(`${base}/${novoId}`, registro)
    if (!resposta?.success)
        return popup({ mensagem: resposta?.mensagem || 'Não foi possível salvar.' })
    const atualizada = [...lista.filter(c => String(c.id) !== novoId), registro]
    epi ? estadoFichaRH.epis = atualizada : estadoFichaRH.exames = atualizada
    removerPopup(janela?.id)
    renderizarRH()
    catalogoFichaRH()
}
