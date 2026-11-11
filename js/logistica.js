// Controle Logístico: substitui a planilha "CONTROLE LOGÍSTICO <MÊS>.xlsx".
// Base controle_logistico (servidor: SCRIPTS/logistica.js + migrations/controle-logistico.sql).
// - Abas iguais às da planilha (coluna categoria).
// - A NF (e/ou o orçamento) preenche valor, tipo, loja, UF, orçamento e material.
// - "NFs sem envio": NFs de venda/remessa recentes ainda não lançadas, para lançar em lote.
// - Rastreio dos Correios (API Rastro): situação, previsão e entrega se atualizam sozinhas de hora em hora.

const ABAS_LOGISTICA = {
    TODOS: { titulo: 'Todos' },
    CORREIOS: { titulo: 'Correios', metodos: ['PAC', 'SEDEX', 'SEDEX 10', 'MINI ENVIOS'] },
    RODOVIARIA: { titulo: 'Rodoviária', metodos: ['PROG', 'RODOVIÁRIA'] },
    JAMEF: { titulo: 'Jamef', metodos: ['JAMEF', 'JADLOG', 'BRASPRESS', 'TRANSPORTADORA'] },
    SSA_CARRETO: { titulo: 'SSA e Carreto', metodos: ['CARRETO', 'MOTOBOY', 'TÉCNICO', 'RETIRADA', 'UBER'] },
    FORA_ESTADO: { titulo: 'Fora do Estado', metodos: ['PAC', 'SEDEX', 'TRANSPORTADORA', 'TÉCNICO'] },
    COMPRAS: { titulo: 'Compras', metodos: ['PAC', 'SEDEX', 'TRANSPORTADORA', 'RETIRADA'] }
}

const SITUACOES_LOGISTICA = ['AGUARDANDO ENVIO', 'POSTADO', 'EM TRÂNSITO', 'AGUARDANDO RETIRADA', 'OCORRÊNCIA', 'EM DEVOLUÇÃO', 'DEVOLVIDO', 'ENTREGUE', 'CANCELADO']
const TIPOS_LOGISTICA = { V: 'Venda', R: 'Remessa', S: 'Serviço' }
const RE_RASTREIO_CORREIOS = /^[A-Z]{2}\d{9}[A-Z]{2}$/

const estadoLogistica = { aba: 'CORREIOS', pendentes: null }

const escLog = valor => escaparAtributo(valor ?? '')
const classeSituacaoLog = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '-')

function dataCurtaLog(iso) {
    const [ano, mes, dia] = String(iso || '').split('-')
    return dia ? `${dia}/${mes}` : ''
}

function hojeLog() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

async function apiLogistica(rota, corpo = {}) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/logistica/${rota}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(corpo)
    })
    const retorno = await resposta.json().catch(() => ({}))
    if (!resposta.ok) throw new Error(retorno.mensagem || retorno.erro || `Falha na logística (${resposta.status})`)
    return retorno
}

// ---------------------------------------------------------------- tela

async function telaLogistica() {
    tela.innerHTML = `
        <div class="pagina-conteudo controle-logistico">
            <div class="cabecalho-pagina"><h2>Controle Logístico</h2></div>
            <div class="logistica-conteudo"></div>
        </div>`
    await abrirAbaLogistica(estadoLogistica.aba)
    contarPendentesLogistica()
}

function colunasLogistica(aba) {
    if (aba === 'COMPRAS')
        return {
            '': {},
            'Método': { chave: 'metodo' },
            'Valor Nota': { chave: 'valor_nota', op: '>=', tipoOrdenacao: 'numero' },
            'Custo Frete': { chave: 'custo_frete', op: '>=', tipoOrdenacao: 'numero' },
            'Remetente': { chave: 'remetente' },
            'Destinatário': { chave: 'loja' },
            'Nota Fiscal': { chave: 'nf' },
            'Data de Saída': { chave: 'data_saida', tipoPesquisa: 'data' },
            'Entrega': { chave: 'previsao_entrega', tipoPesquisa: 'data' },
            'Situação': { chave: 'situacao', tipoPesquisa: 'select' },
        }

    return {
        '': {},
        ...(aba === 'TODOS' ? { 'Aba': { chave: 'categoria', tipoPesquisa: 'select' } } : {}),
        'Método': { chave: 'metodo' },
        'Rastreio': { chave: 'rastreio' },
        'Situação': { chave: 'situacao', tipoPesquisa: 'select' },
        'Vol.': { chave: 'volumes' },
        'Valor Nota': { chave: 'valor_nota', op: '>=', tipoOrdenacao: 'numero' },
        'Custo Frete': { chave: 'custo_frete', op: '>=', tipoOrdenacao: 'numero' },
        'Loja': { chave: 'loja' },
        'Departamentos': { chave: 'orcamento' },
        'Tipo': { chave: 'tipo', tipoPesquisa: 'select' },
        'UF': { chave: 'uf', tipoPesquisa: 'select' },
        'Nota Fiscal': { chave: 'nf' },
        'Data de Saída': { chave: 'data_saida', tipoPesquisa: 'data' },
        'Entrega': { chave: 'previsao_entrega', tipoPesquisa: 'data' },
    }
}

function barraLogistica(abaAtiva) {
    const abas = Object.entries(ABAS_LOGISTICA)
        .map(([chave, { titulo }]) => `
            <button type="button" class="${chave === abaAtiva ? 'ativa' : ''}" aria-selected="${chave === abaAtiva}"
                onclick="abrirAbaLogistica('${chave}')">${titulo}</button>`)
        .join('')

    const pendentes = estadoLogistica.pendentes
    return `
        <div class="logistica-barra">
            <nav class="relatorio-dep-abas" role="tablist">${abas}</nav>
            <span class="logistica-total" title="Soma do custo de frete do que está na lista (segue as pesquisas)">Frete: <b data-total-frete>…</b></span>
            <div class="logistica-acoes">
                <button type="button" onclick="formularioEnvioLogistica()">+ Novo envio</button>
                <button type="button" onclick="painelRequisicoesSemEnvio()">Requisições sem envio</button>
                <button type="button" onclick="painelNotasSemEnvio()">NFs sem envio
                    <b data-pendentes-log${pendentes ? '' : ' hidden'}>${pendentes || ''}</b></button>
                <button type="button" onclick="atualizarRastreiosLogistica()" title="Consulta agora nos Correios os envios ainda não entregues">Atualizar rastreios</button>
                <button type="button" onclick="baixarExcelLogistica()">Excel</button>
            </div>
        </div>`
}

async function abrirAbaLogistica(aba) {
    if (!ABAS_LOGISTICA[aba]) return
    estadoLogistica.aba = aba

    const conteudo = document.querySelector('.logistica-conteudo')
    if (!conteudo) return

    try {
        delete controles.logistica
        conteudo.innerHTML = await modTab({
            base: 'controle_logistico',
            pag: 'logistica',
            body: 'bodyLogistica',
            criarLinha: 'criarLinhaLogistica',
            detalhes: true,
            topoEmLinha: true,
            btnExtras: barraLogistica(aba),
            filtrosFixos: aba === 'TODOS' ? null : { categoria: { op: '=', value: aba.toLowerCase() } },
            funcaoAdicional: ['totalFreteLogistica'],
            ordenar: [
                { path: 'data_saida', direcao: 'desc' },
                { path: 'timestamp', direcao: 'desc', tipoOrdenacao: 'numero' }
            ],
            colunas: colunasLogistica(aba)
        })
        await paginacao('logistica')
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o controle logístico: ${escLog(err.message)}` })
    } finally {
        removerOverlay()
    }
}

async function totalFreteLogistica() {
    const alvo = document.querySelector('[data-total-frete]')
    const ctrl = controles.logistica
    if (!alvo || !ctrl) return
    try {
        const { total } = await contarPorCampo({
            base: 'controle_logistico',
            path: 'custo_frete',
            modo: 'soma',
            filtros: combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {}
        })
        alvo.textContent = dinheiroTexto(total || 0)
    } catch (err) {
        console.error(err)
        alvo.textContent = '—'
    }
}

async function contarPendentesLogistica() {
    try {
        const { notas } = await apiLogistica('notas-pendentes', { dias: 30 })
        estadoLogistica.pendentes = notas.length
        const alvo = document.querySelector('[data-pendentes-log]')
        if (alvo) {
            alvo.textContent = notas.length >= 300 ? '300+' : notas.length
            alvo.hidden = !notas.length
        }
    } catch (err) {
        console.error('[LOGÍSTICA pendentes]', err)
    }
}

function celulaEntregaLog({ previsao_entrega, data_entrega, situacao }) {
    if (data_entrega)
        return `<span class="log-entrega entregue" title="Entregue em ${escLog(conversorDt(data_entrega))}">✔ ${dataCurtaLog(data_entrega)}</span>`
    if (!previsao_entrega) return ''
    const atrasado = previsao_entrega < hojeLog() && !['ENTREGUE', 'CANCELADO', 'DEVOLVIDO'].includes(situacao)
    return `<span class="log-entrega${atrasado ? ' atrasado' : ''}" title="${atrasado ? 'Previsão vencida' : 'Previsão de entrega'}">PREV ${dataCurtaLog(previsao_entrega)}</span>`
}

function celulaRastreioLog({ id, rastreio, rastreio_info }) {
    if (!rastreio) return ''
    const codigo = String(rastreio).trim().toUpperCase()
    const info = rastreio_info || {}
    const ultimo = info.ultimo_evento
    const detalhe = info.mensagem
        ? `<small class="log-alerta">${escLog(info.mensagem)}</small>`
        : ultimo ? `<small title="${escLog(ultimo.descricao)}">${escLog(ultimo.local || ultimo.descricao)}</small>` : ''

    if (!RE_RASTREIO_CORREIOS.test(codigo))
        return `<span class="log-rastreio">${escLog(rastreio)}</span>`

    return `
        <div class="log-rastreio">
            <span class="log-link" onclick="detalhesRastreioLogistica('${escLog(id)}')" title="Ver o histórico nos Correios">${escLog(codigo)}</span>
            ${detalhe}
        </div>`
}

// "Código: X | Qtde: N | Desc: Y" por linha (formato da NF/planilha) → tabela; outro texto vai como está.
function detalhesMaterialLog(material) {
    const texto = String(material || '').trim()
    if (!texto) return '<div class="log-detalhes-vazio">Sem material informado.</div>'

    const itens = texto.split('\n').map(l => l.trim()).filter(Boolean).map(linha => {
        const m = linha.match(/^C[óo]digo:\s*(.*?)\s*\|\s*Qtde:\s*(.*?)\s*\|\s*Desc:\s*(.*)$/i)
        return m ? { codigo: m[1], qtde: m[2], desc: m[3] } : { livre: linha }
    })

    if (itens.some(i => i.livre))
        return `<div class="log-detalhes-livre">${escLog(texto).replace(/\n/g, '<br>')}</div>`

    return `
        <table class="log-itens">
            <thead><tr><th>Código</th><th>Qtde</th><th>Descrição</th></tr></thead>
            <tbody>${itens.map(i => `
                <tr><td>${escLog(i.codigo)}</td><td class="num">${escLog(i.qtde)}</td><td>${escLog(i.desc)}</td></tr>`).join('')}
            </tbody>
        </table>`
}

// Dados da encomenda que vêm do Rastro dos Correios (só envios com rastreio consultado).
function detalhesEncomendaLog(info) {
    if (!info || info.mensagem || !(info.servico || info.peso || info.dimensoes || info.postagem)) return ''
    const p = info.postagem || {}
    const linhas = [
        ['Serviço', p.servico || info.servico],
        ['Frete (Correios)', p.valor != null ? dinheiroTexto(p.valor) : ''],
        ['Postado em', p.data_postagem ? `${conversorDt(p.data_postagem)}${p.hora_postagem ? ` ${p.hora_postagem}` : ''}` : ''],
        ['Peso', info.peso ? `${String(info.peso).replace('.', ',')} kg` : ''],
        ['Peso tarifado', p.peso_tarifado ? `${String(p.peso_tarifado).replace('.', ',')} kg` : ''],
        ['Dimensões', info.dimensoes],
        ['Formato', info.formato]
    ].filter(([, v]) => v)
    return `
        <div class="log-detalhes"><b>Encomenda</b>
            <table class="log-itens">
                <tbody>${linhas.map(([k, v]) => `<tr><th>${k}</th><td>${escLog(v)}</td></tr>`).join('')}</tbody>
            </table>
        </div>`
}

function criarLinhaLogistica(dado) {
    const {
        id, categoria, metodo, volumes, valor_nota, custo_frete, loja, remetente, orcamento, tipo, uf,
        nf, nota_id, data_saida, material, situacao, observacao, rastreio_info
    } = dado || {}

    const aba = estadoLogistica.aba
    const detalhes = `
        <div class="log-detalhes-grade">
            <div class="log-detalhes"><b>Material</b>${detalhesMaterialLog(material)}</div>
            ${detalhesEncomendaLog(rastreio_info)}
            ${detalhesEtiquetaLog(dado)}
            <div class="log-detalhes"><b>Observação</b>${String(observacao || '').trim()
                ? `<div class="log-detalhes-livre">${escLog(observacao).replace(/\n/g, '<br>')}</div>`
                : '<div class="log-detalhes-vazio">Sem observação.</div>'}</div>
        </div>`
    const celulaNF = nf
        ? nota_id
            ? `<span class="log-link" onclick="abrirDANFE('${escLog(nota_id)}')" title="Abrir DANFE">${escLog(nf)}</span>`
            : escLog(nf)
        : ''
    const celulaSituacao = situacao ? `<span class="log-situacao log-${classeSituacaoLog(situacao)}">${escLog(situacao)}</span>` : ''
    const acoes = `
        <td class="log-acoes">
            <img src="imagens/pesquisar.svg" title="Editar" onclick="formularioEnvioLogistica('${escLog(id)}')">
        </td>`

    if (aba === 'COMPRAS')
        return {
            detalhes,
            linha: `
            <tr>
                ${acoes}
                <td>${escLog(metodo)}</td>
                <td>${valor_nota != null ? dinheiro(valor_nota) : ''}</td>
                <td>${custo_frete != null ? dinheiro(custo_frete) : ''}</td>
                <td>${escLog(remetente)}</td>
                <td>${escLog(loja)}</td>
                <td>${celulaNF}</td>
                <td>${conversorDt(data_saida)}</td>
                <td>${celulaEntregaLog(dado)}</td>
                <td>${celulaSituacao}</td>
            </tr>`
        }

    return {
        detalhes,
        linha: `
        <tr>
            ${acoes}
            ${aba === 'TODOS' ? `<td>${escLog(ABAS_LOGISTICA[categoria]?.titulo || categoria)}</td>` : ''}
            <td>${escLog(metodo)}</td>
            <td>${celulaRastreioLog(dado)}</td>
            <td>${celulaSituacao}</td>
            <td style="text-align: center;">${escLog(volumes)}</td>
            <td>${valor_nota != null ? dinheiro(valor_nota) : ''}</td>
            <td>${custo_frete != null ? dinheiro(custo_frete) : ''}</td>
            <td class="log-loja">${escLog(loja)}</td>
            <td>${escLog(orcamento).replace(/\n/g, '<br>')}</td>
            <td style="text-align: center;" title="${escLog(TIPOS_LOGISTICA[tipo] || '')}">${escLog(tipo)}</td>
            <td style="text-align: center;">${escLog(uf)}</td>
            <td>${celulaNF}</td>
            <td>${conversorDt(data_saida)}</td>
            <td>${celulaEntregaLog(dado)}</td>
        </tr>`
    }
}

// ---------------------------------------------------------------- formulário

function campoLog({ rotulo, nome, valor = '', tipo = 'text', extra = '', classe = '' }) {
    return `
        <label class="log-campo ${classe}">
            <span>${rotulo}</span>
            <input name="${nome}" type="${tipo}" value="${escLog(valor)}" ${extra}>
        </label>`
}

function selectLog({ rotulo, nome, valor = '', opcoes, extra = '', classe = '' }) {
    const lista = Array.isArray(opcoes) ? opcoes.map(o => [o, o]) : Object.entries(opcoes)
    return `
        <label class="log-campo ${classe}">
            <span>${rotulo}</span>
            <select name="${nome}" ${extra}>
                ${lista.map(([v, t]) => `<option value="${escLog(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${escLog(t)}</option>`).join('')}
            </select>
        </label>`
}

// Formulário de envio, na ordem do trabalho da logística:
//   1. Nota fiscal → localiza o cliente (loja), o departamento, o valor e os itens.
//   2. Destinatário → loja do cadastro de clientes do GCS + endereço do cadastro (completado pelo CEP).
//      Trocar a loja (ou a NF/orçamento trazer outra) recarrega o endereço.
//   3. Envio → como vai: gerar a etiqueta dos Correios (usa o endereço do passo 2), já tem o
//      rastreio (Correios preenchem o resto) ou sem rastreio (carreto, retirada).
// Campos que vêm de uma fonte (NF, Correios) ficam travados; "Editar manualmente" destrava tudo.

const CAMPOS_RASTREIO_LOG = ['metodo', 'previsao_entrega', 'situacao', 'data_entrega']
const CAMPOS_DESTINO_LOG = ['loja', 'tipo', 'valor_nota', 'material']

function formLog() {
    return [...document.querySelectorAll('[data-log-form]')].at(-1)?.closest('.painel-padrao') || null
}

function estadoFormLog(form) {
    return form?.querySelector('[data-log-form]')?.dataset || {}
}

function setCampoLog(form, nome, valor, { soVazio = false } = {}) {
    if (valor === undefined || valor === null) return
    if (nome === 'loja') return setLojaLog(form, { loja: valor })
    const campo = form?.querySelector(`[name="${nome}"]`)
    if (!campo) return
    if (soVazio && String(campo.value || '').trim()) return
    campo.value = valor
}

// ---------- travas

function travarCampoLog(form, nome, travado) {
    if (nome === 'loja') {
        form.querySelector('[name="loja_log"]')?.classList.toggle('log-travado', travado)
        return
    }
    const campo = form.querySelector(`[name="${nome}"]`)
    if (!campo) return
    if (campo.tagName === 'SELECT') campo.disabled = travado
    else campo.readOnly = travado
    campo.classList.toggle('log-travado', travado)
}

function aplicarTravasLog(form = formLog()) {
    if (!form) return
    const e = estadoFormLog(form)
    const manual = e.manual === 'S'

    // Envio: depende do rastreio.
    travarCampoLog(form, 'rastreio', !manual && (e.rastreio === 'etiqueta' || e.etiqueta === 'S'))
    for (const nome of CAMPOS_RASTREIO_LOG) {
        let travado = e.rastreio === 'pendente' || e.rastreio === 'etiqueta'
        if (e.rastreio === 'encontrado')
            travado = nome === 'metodo' ? Boolean(form.querySelector('[name="metodo"]').value.trim()) : true
        travarCampoLog(form, nome, !manual && travado)
    }

    // Custo do frete e data de saída: travados só quando vieram da postagem real dos Correios.
    for (const nome of ['custo_frete', 'data_saida'])
        travarCampoLog(form, nome, !manual && e.rastreio === 'encontrado' && e.postagem === 'S')

    // Departamento: depende da NF.
    const depTravado = !manual && (e.nf === 'pendente' || (e.nf === 'encontrado' && e.orcDaNota === 'S'))
    form.querySelector('.log-orcamentos')?.classList.toggle('log-travado', depTravado)
    form.querySelectorAll('[name="orc_novo"], [data-add-orc]').forEach(c => { c.disabled = depTravado })

    // Destino: depende da NF; loja/UF vindas do orçamento ficam travadas mesmo sem NF.
    for (const nome of CAMPOS_DESTINO_LOG) {
        let travado = e.nf !== 'manual'
        if (e.nf === 'manual' && nome === 'loja') travado = e.destinoOrc === 'S'
        travarCampoLog(form, nome, !manual && travado)
    }

    // Etiqueta emitida: o modo de envio não muda mais (cancele a etiqueta para trocar).
    form.querySelectorAll('[data-modo-envio]').forEach(b => { b.disabled = e.etiqueta === 'S' })
    form.querySelectorAll('[data-sem-nf]').forEach(b => { b.hidden = e.nf !== 'pendente' })
}

function definirEtapaLog(form, chave, valor) {
    const marcador = form?.querySelector('[data-log-form]')
    if (!marcador) return
    marcador.dataset[chave] = valor
    aplicarTravasLog(form)
}

function editarManualmenteLog() {
    const form = formLog()
    if (!form) return
    definirEtapaLog(form, 'manual', 'S')
}

function semNotaLog() {
    const form = formLog()
    if (!form) return
    form.querySelector('[data-aviso-nf]').innerHTML = '<span class="carregando">Sem NF: informe o departamento e o destino.</span>'
    definirEtapaLog(form, 'nf', 'manual')
}

// ---------- loja (lista de clientes)

function setLojaLog(form, { loja, cliente } = {}) {
    const span = form?.querySelector('[name="loja_log"]')
    if (!span) return
    span.textContent = loja || 'Selecionar'
    span.dataset.vazio = loja ? '' : 'S'
    if (cliente !== undefined) span.id = cliente || ''
}

function abrirLojaLog(span) {
    if (span.classList.contains('log-travado')) return
    controlesCxOpcoes.loja_log = {
        base: 'clientes',
        retornar: ['nome'],
        funcaoAdicional: 'lojaEscolhidaLog',
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ / CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Estado': { chave: 'estado' }
        }
    }
    cxOpcoes('loja_log')
}

async function lojaEscolhidaLog() {
    const form = formLog()
    const span = form?.querySelector('[name="loja_log"]')
    if (!span) return removerOverlay()
    span.dataset.vazio = ''
    const { estado, cidade } = span.id ? await recuperarDado('clientes', span.id) || {} : {}
    const uf = /^[A-Z]{2}$/.test(String(estado || '').trim().toUpperCase())
        ? String(estado).trim().toUpperCase()
        : String(cidade || '').match(/\(([A-Z]{2})\)\s*$/)?.[1]
    if (uf) setCampoLog(form, 'uf', uf)
    carregarDestinatarioLog()
    removerOverlay()
}

// ---------- departamento (lista acumulativa de orçamentos validados)

function orcamentosLog(form) {
    return String(form?.querySelector('[name="orcamento"]')?.value || '').split('\n').map(s => s.trim()).filter(Boolean)
}

function desenharOrcamentosLog(form, lista) {
    form.querySelector('[name="orcamento"]').value = lista.join('\n')
    form.querySelector('.log-orcamentos-lista').innerHTML = lista.length
        ? lista.map(o => `<span class="log-chip">${escLog(o)}<button type="button" title="Tirar" onclick="removerOrcamentoLog('${escLog(o)}')">×</button></span>`).join('')
        : '<span class="log-vazio">Nenhum</span>'
}

async function adicionarOrcamentoLog() {
    const form = formLog()
    if (!form) return
    const campo = form.querySelector('[name="orc_novo"]')
    if (campo.disabled) return
    const digitado = campo.value.trim().toUpperCase().replace(/^ORC[\s_-]*/, 'ORC_')
    const orcamento = /^\d+$/.test(digitado) ? `ORC_${digitado}` : digitado
    const aviso = form.querySelector('[data-aviso-orc]')
    if (!/^ORC_\d+$/.test(orcamento)) {
        aviso.innerHTML = '<span class="log-alerta">Use o número do orçamento (ex.: 6303 ou ORC_6303).</span>'
        return
    }
    const lista = orcamentosLog(form)
    if (lista.includes(orcamento)) {
        campo.value = ''
        return
    }

    aviso.innerHTML = '<span class="carregando">Conferindo o orçamento…</span>'
    try {
        const { orcamento: info } = await apiLogistica('preencher', { orcamento })
        if (!info) {
            aviso.innerHTML = `<span class="log-alerta">${escLog(orcamento)} não existe no GCS.</span>`
            return
        }
        desenharOrcamentosLog(form, [...lista, orcamento])
        campo.value = ''

        // O orçamento só define a loja quando ainda não há loja (sem NF, ou NF sem cliente no cadastro).
        const semLoja = form.querySelector('[name="loja_log"]')?.dataset.vazio === 'S'
        if (!lista.length && info.loja && semLoja) {
            setLojaLog(form, { loja: info.loja, cliente: info.cliente })
            setCampoLog(form, 'uf', info.uf)
            definirEtapaLog(form, 'destinoOrc', 'S')
            carregarDestinatarioLog()
            aviso.innerHTML = `<span class="ok">${escLog(orcamento)}: loja e UF preenchidas pelo cliente do orçamento.</span>`
        } else {
            aviso.innerHTML = `<span class="ok">${escLog(orcamento)} incluído.</span>`
        }
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)}</span>`
    }
}

function removerOrcamentoLog(orcamento) {
    const form = formLog()
    if (!form || form.querySelector('.log-orcamentos')?.classList.contains('log-travado')) return
    const lista = orcamentosLog(form).filter(o => o !== orcamento)
    desenharOrcamentosLog(form, lista)
    if (!lista.length) definirEtapaLog(form, 'destinoOrc', '')
}

// ---------- formulário

async function formularioEnvioLogistica(id = null, inicial = null) {
    try {
        overlayAguarde()
        const dado = id ? await recuperarDado('controle_logistico', id) || {} : {}
        const d = {
            categoria: estadoLogistica.aba === 'TODOS' ? 'CORREIOS' : estadoLogistica.aba,
            volumes: 1,
            app: 'AC',
            data_saida: hojeLog(),
            situacao: 'AGUARDANDO ENVIO',
            ...dado,
            ...(inicial || {})
        }

        // Etapas: envio novo começa travado; editar parte do que já foi encontrado antes.
        const rastreioOk = d.rastreio_info && !d.rastreio_info.mensagem
        const etapaRastreio = id ? (rastreioOk ? 'encontrado' : 'manual') : 'pendente'
        const etapaNF = id ? (d.nota_id ? 'encontrado' : 'manual') : 'pendente'
        const orcDaNota = d.nota_id && d.orcamento ? 'S' : ''

        const abas = Object.fromEntries(Object.entries(ABAS_LOGISTICA).filter(([k]) => k !== 'TODOS').map(([k, v]) => [k, v.titulo]))
        const metodos = [...new Set(Object.values(ABAS_LOGISTICA).flatMap(a => a.metodos || []))]
        const opcoes = (lista, valor) => (Array.isArray(lista) ? lista.map(o => [o, o]) : Object.entries(lista))
            .map(([v, t]) => `<option value="${escLog(v)}" ${String(v) === String(valor ?? '') ? 'selected' : ''}>${escLog(t)}</option>`).join('')
        const input = (nome, valor, extra = '') => `<input class="log-input" name="${nome}" value="${escLog(valor)}" ${extra}>`

        const campo = (rotulo, conteudo, classe = '') => `<div class="log-campo ${classe}"><span>${rotulo}</span>${conteudo}</div>`

        // Modo de envio ao abrir: etiqueta emitida, já tem rastreio, sem rastreio (editar) ou a escolher (novo).
        const etiquetaAtiva = d.etiqueta && !d.etiqueta.cancelada_em
        const modoInicial = etiquetaAtiva ? 'etiqueta' : d.rastreio ? 'rastreio' : id ? 'sem' : ''
        const passo = (n, titulo, dica) => `<legend><span class="log-num">${n}</span> ${titulo}${dica ? ` <small>— ${dica}</small>` : ''}</legend>`

        // Uma linha só do formulário padrão (borda e fundo do popup), com o layout em blocos dentro.
        const elemento = `
            <div class="log-form">
                <input type="hidden" data-log-form data-id="${escLog(id || '')}" data-rastreio="${etapaRastreio}"
                    data-nf="${etapaNF}" data-orc-da-nota="${orcDaNota}" data-destino-orc="" data-manual=""
                    data-postagem="${d.rastreio_info?.postagem ? 'S' : ''}"
                    data-etiqueta="${etiquetaAtiva ? 'S' : ''}" data-modo="${modoInicial}">
                <input type="hidden" name="nota_id" value="${escLog(d.nota_id)}">
                <input type="hidden" name="etiqueta" value="${escLog(d.etiqueta ? JSON.stringify(d.etiqueta) : '')}">
                <input type="hidden" name="requisicao_id" value="${escLog(d.requisicao_id)}">
                <input type="hidden" name="chamado" value="${escLog(d.chamado)}">
                <input type="hidden" name="fluxo" value="${escLog(d.fluxo)}">
                <div class="log-requisicao" data-requisicao></div>

                <fieldset class="log-passo">
                    ${passo(1, 'Nota fiscal', 'localiza o cliente, o departamento e os itens')}
                    <div class="log-grade">
                        ${campo('Nota fiscal', `
                            <div class="log-com-botao">
                                ${input('nf', d.nf, 'inputmode="numeric" placeholder="ex.: 13165" oninput="digitandoNFLog()" onchange="buscarNotaLogistica()" onkeydown="if (event.keyCode === 13) { event.preventDefault(); buscarNotaLogistica({ forcar: true }) }"')}
                                <button type="button" class="log-mini" data-sem-nf onclick="semNotaLog()">Sem NF</button>
                            </div>`, 'log-destaque')}
                        ${campo('Empresa', `<select class="log-input" name="app" onchange="buscarNotaLogistica({ forcar: true })">${opcoes(['', ...empresas], d.app)}</select>`)}
                        ${campo('Departamento', `
                            <div class="log-orcamentos">
                                <input type="hidden" name="orcamento" value="${escLog(d.orcamento)}">
                                <div class="log-orcamentos-lista"></div>
                                <div class="log-com-botao">
                                    <input class="log-input" name="orc_novo" placeholder="Nº do orçamento" onkeydown="if (event.key === 'Enter') { event.preventDefault(); adicionarOrcamentoLog() }">
                                    <button type="button" class="log-mini" data-add-orc onclick="adicionarOrcamentoLog()">Adicionar</button>
                                </div>
                            </div>`, 'log-largo')}
                    </div>
                    <div class="log-aviso" data-aviso-nf></div>
                    <div class="log-aviso" data-aviso-orc></div>
                </fieldset>

                <fieldset class="log-passo">
                    ${passo(2, 'Destinatário', 'cadastro de clientes do GCS')}
                    <div class="log-grade">
                        ${campo('Loja / cliente', `<span class="opcoes" name="loja_log" ${d.cliente ? `id="${escLog(d.cliente)}"` : ''} data-vazio="${d.loja ? '' : 'S'}" onclick="abrirLojaLog(this)">${escLog(d.loja || 'Selecionar')}</span>`, 'log-largo')}
                        ${campo('CPF / CNPJ', input('et_doc', '', 'inputmode="numeric"'))}
                        ${campo('Remetente', input('remetente', d.remetente), 'log-so-compras')}
                        ${campo('Tipo', `<select class="log-input" name="tipo">${opcoes({ '': '', ...TIPOS_LOGISTICA }, d.tipo)}</select>`)}
                        ${campo('Valor da nota (R$)', input('valor_nota', d.valor_nota, 'type="number" min="0" step="0.01"'))}
                    </div>
                    <div class="log-etiqueta-sub">Endereço de entrega <small>— do cadastro, conferido pelo CEP dos Correios</small></div>
                    <div class="log-grade">
                        ${campo('CEP', input('et_cep', '', 'inputmode="numeric" maxlength="9" oninput="digitandoCepLog()" onchange="consultarCepEtiquetaLog()" onkeydown="if (event.keyCode === 13) { event.preventDefault(); consultarCepEtiquetaLog({ forcar: true }) }"'))}
                        ${campo('Logradouro', input('et_logradouro', ''), 'log-largo')}
                        ${campo('Número', input('et_numero', '', 'maxlength="6"'), 'log-destaque')}
                        ${campo('Complemento', input('et_complemento', '', 'maxlength="30"'))}
                        ${campo('Bairro', input('et_bairro', ''))}
                        ${campo('Cidade', input('et_cidade', ''))}
                        ${campo('UF', input('uf', d.uf, 'maxlength="2" style="text-transform: uppercase;"'))}
                        ${campo('Celular', input('et_celular', '', 'inputmode="numeric" placeholder="DDD + número"'))}
                        ${campo('E-mail', input('et_email', '', 'type="email"'))}
                    </div>
                    <div class="log-aviso" data-aviso-destinatario></div>
                </fieldset>

                <fieldset class="log-passo">
                    ${passo(3, 'Envio', 'como vai?')}
                    <div class="log-modos" role="radiogroup">
                        <button type="button" class="log-modo" data-modo-envio="etiqueta" onclick="escolherModoEnvioLog('etiqueta')">
                            <b>Gerar etiqueta</b><small>Emite a etiqueta dos Correios pelo GCS</small></button>
                        <button type="button" class="log-modo" data-modo-envio="rastreio" onclick="escolherModoEnvioLog('rastreio')">
                            <b>Já tenho o rastreio</b><small>Postado no balcão; os Correios preenchem o resto</small></button>
                        <button type="button" class="log-modo" data-modo-envio="sem" onclick="escolherModoEnvioLog('sem')">
                            <b>Sem rastreio</b><small>Carreto, retirada, transportadora</small></button>
                    </div>

                    <div class="log-painel log-painel-etiqueta" hidden>
                        <div class="log-grade">
                            ${campo('Modalidade', `<select class="log-input" name="et_servico">${MODALIDADES_CORREIOS_LOG
                                .map(m => `<option value="${m.codigo}" ${metodoPorServicoLog(d.metodo) === m.nome ? 'selected' : ''}>${m.nome} · ${m.descricao}</option>`).join('')}</select>`)}
                        </div>
                        <div class="log-dimensoes">
                            <button type="button" class="log-mini" data-dimensoes aria-expanded="false" onclick="alternarDimensoesLog()">Informar dimensões</button>
                            <span class="log-dica-etiqueta">Opcional: na agência o pacote é pesado e medido, e o frete é cobrado pelo que for conferido lá.</span>
                        </div>
                        <div class="log-grade" data-campos-dimensoes hidden>
                            ${campo('Peso (kg)', input('et_peso', '', 'type="number" min="0.01" step="0.01"'))}
                            ${campo('Comprimento (cm)', input('et_comprimento', '', 'type="number" min="1" step="1"'))}
                            ${campo('Largura (cm)', input('et_largura', '', 'type="number" min="1" step="1"'))}
                            ${campo('Altura (cm)', input('et_altura', '', 'type="number" min="1" step="1"'))}
                        </div>
                        <div class="log-etiqueta-sub">Conteúdo <small data-et-fonte></small></div>
                        <div data-et-itens></div>
                        <div class="log-aviso" data-aviso-etiqueta></div>
                        <div class="log-etiqueta-acoes">
                            <button type="button" class="log-botao-principal" data-emitir-etiqueta onclick="emitirEtiquetaLog()">Emitir etiqueta</button>
                        </div>
                    </div>

                    <div class="log-painel log-painel-rastreio" hidden>
                        ${campo('Código de rastreio', `
                            ${input('rastreio', d.rastreio, 'placeholder="ex.: QN960272345BR" style="text-transform: uppercase;" oninput="digitandoRastreioLog()" onchange="consultarRastreioFormLog()" onkeydown="if (event.keyCode === 13) { event.preventDefault(); consultarRastreioFormLog({ forcar: true }) }"')}
                            <div class="log-aviso" data-aviso-rastreio></div>`, 'log-destaque')}
                    </div>

                    <div class="log-grade log-status-envio">
                        ${campo('Aba', `<select class="log-input" name="categoria" onchange="alternarCamposCompraLog()">${opcoes(abas, d.categoria)}</select>`)}
                        ${campo('Método de envio', `${input('metodo', d.metodo, 'list="log-metodos" style="text-transform: uppercase;"')}<datalist id="log-metodos">${metodos.map(m => `<option value="${escLog(m)}">`).join('')}</datalist>`)}
                        ${campo('Situação', `<select class="log-input" name="situacao">${opcoes(['', ...SITUACOES_LOGISTICA], d.situacao)}</select>`)}
                        ${campo('Volumes', input('volumes', d.volumes, 'type="number" min="0" step="1"'))}
                        ${campo('Data de saída', input('data_saida', d.data_saida, 'type="date"'))}
                        ${campo('Previsão de entrega', input('previsao_entrega', d.previsao_entrega, 'type="date"'))}
                        ${campo('Entregue em', input('data_entrega', d.data_entrega, 'type="date"'))}
                        ${campo('Custo do frete (R$)', input('custo_frete', d.custo_frete, 'type="number" min="0" step="0.01"'))}
                    </div>
                </fieldset>

                ${campo('Material', `<textarea class="log-input" name="material" rows="3">${escLog(d.material)}</textarea>`, 'log-texto')}
                ${campo('Observação', `<textarea class="log-input" name="observacao" rows="2">${escLog(d.observacao)}</textarea>`, 'log-texto')}
            </div>`

        // Salvar por último: fica no canto direito do rodapé.
        const botoes = [
            ...(id ? [{ texto: 'Excluir', img: 'cancel', funcao: `excluirEnvioLogistica('${escLog(id)}')` }] : []),
            { texto: 'Editar manualmente', img: 'editar', funcao: 'editarManualmenteLog()' },
            { texto: 'Salvar', img: 'concluido', funcao: `salvarEnvioLogistica('${escLog(id || '')}')` }
        ]

        popup({
            titulo: id ? 'Editar envio' : 'Novo envio',
            linhas: [{ elemento }],
            botoes,
            autoDestruicao: ['loja_log']
        })

        const form = formLog()
        form.classList.add('log-form-unica')
        desenharOrcamentosLog(form, orcamentosLog(form))
        alternarCamposCompraLog()
        aplicarTravasLog(form)
        if (d.rastreio_info) mostrarResumoRastreioLog(d.rastreio_info)
        escolherModoEnvioLog(modoInicial, { inicial: true })
        desenharRequisicaoLog(form)
        if (d.etiqueta) mostrarEtiquetaEmitidaLog(form, d.etiqueta, id, Boolean(d.rastreio_info?.postagem))
        // Envio já gravado com loja: mostra o endereço do cadastro (a NF nova recarrega sozinha).
        if (d.cliente) carregarDestinatarioLog()
        // Veio de "NFs sem envio" → busca a NF e já trava o que veio dela.
        if (!id && inicial?.nf) buscarNotaLogistica()
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao abrir o envio: ${escLog(err.message)}` })
    }
}

function alternarCamposCompraLog() {
    const form = formLog()
    if (!form) return
    form.querySelector('.log-form')?.classList.toggle('compras', form.querySelector('[name="categoria"]').value === 'COMPRAS')
}

function aplicarNotaLog(form, nota, infoOrcamento = null) {
    setCampoLog(form, 'nota_id', nota.nota_id)
    setCampoLog(form, 'nf', nota.nf)
    setCampoLog(form, 'app', nota.app)
    setCampoLog(form, 'valor_nota', nota.valor_nota)
    setCampoLog(form, 'tipo', nota.tipo)
    setCampoLog(form, 'material', nota.material)

    const marcador = form.querySelector('[data-log-form]')
    if (nota.orcamento) {
        desenharOrcamentosLog(form, [...new Set([nota.orcamento, ...orcamentosLog(form)])])
        marcador.dataset.orcDaNota = 'S'
    } else {
        marcador.dataset.orcDaNota = ''
    }

    // Loja = cliente da NF (achado pelo CNPJ: sempre presente). O orçamento só entra se a NF não achar.
    const destino = nota.cliente ? nota : infoOrcamento?.loja ? infoOrcamento : nota
    setLojaLog(form, { loja: destino.loja, cliente: destino.cliente || '' })
    setCampoLog(form, 'uf', destino.uf)
    marcador.dataset.destinoOrc = destino === infoOrcamento ? 'S' : ''

    // Uma informação por linha: NF carregada, envios já lançados, falta de orçamento.
    const avisos = []
    if (nota.cancelada) avisos.push('<b class="log-alerta">NF cancelada no Omie.</b>')
    const outros = (nota.lancamentos || []).filter(l => l.id !== marcador.dataset.id)
    if (outros.length) {
        const lista = outros.map(l => `<li>${escLog(ABAS_LOGISTICA[l.categoria]?.titulo || l.categoria)}${l.data_saida ? ` em ${conversorDt(l.data_saida)}` : ''}${l.rastreio ? ` · ${escLog(l.rastreio)}` : ''}</li>`).join('')
        avisos.push(`<span class="log-alerta">Esta NF já tem ${outros.length === 1 ? '1 envio lançado' : `${outros.length} envios lançados`}:</span><ul class="log-aviso-lista">${lista}</ul>`)
    }
    if (!nota.orcamento && !orcamentosLog(form).length)
        avisos.push('A NF não traz o orçamento no Omie: adicione o departamento acima.')
    if (!nota.cliente)
        avisos.push('<span class="log-alerta">O CNPJ da NF não está no cadastro de clientes do GCS: escolha a loja no passo 2.</span>')

    carregarDestinatarioLog()
    form.querySelector('[data-aviso-nf]').innerHTML = [
        `<span class="ok">NF ${escLog(nota.nf)} (${escLog(nota.app)} · ${escLog(nota.categoria_nota)} · emitida ${escLog(nota.emissao)}) carregada.</span>`,
        ...avisos
    ].map(linha => `<div class="log-aviso-linha">${linha}</div>`).join('')
    definirEtapaLog(form, 'nf', 'encontrado')
}

function escolherNotaLog(form, sugestoes, infoOrcamento, titulo) {
    window.__sugestoesLog = { sugestoes, infoOrcamento }
    form.querySelector('[data-aviso-nf]').innerHTML = `
        <div>${titulo}</div>
        <div class="log-opcoes-nf">
            ${sugestoes.map((s, i) => `
                <button type="button" onclick="escolherSugestaoLog(${i})">
                    <b>${escLog(s.app)} · NF ${escLog(s.nf)}</b> ${escLog(s.categoria_nota)} · ${dinheiroTexto(s.valor_nota || 0)}
                    <small>${escLog(s.loja || '')} · ${escLog(s.emissao || '')}${s.lancamentos?.length ? ' · já lançada' : ''}</small>
                </button>`).join('')}
        </div>`
}

function escolherSugestaoLog(i) {
    const form = formLog()
    const { sugestoes, infoOrcamento } = window.__sugestoesLog || {}
    if (form && sugestoes?.[i]) aplicarNotaLog(form, sugestoes[i], infoOrcamento)
}

// ---------- buscas enquanto digita (o onchange só dispara ao sair do campo)

let pausaNFLog = null
function digitandoNFLog() {
    clearTimeout(pausaNFLog)
    const form = formLog()
    const nf = form?.querySelector('[name="nf"]').value.replace(/\D/g, '') || ''
    if (nf.length < 3) return
    pausaNFLog = setTimeout(() => buscarNotaLogistica(), 700)
}

function digitandoRastreioLog() {
    const campo = formLog()?.querySelector('[name="rastreio"]')
    if (campo && RE_RASTREIO_CORREIOS.test(campo.value.trim().toUpperCase())) consultarRastreioFormLog()
}

function digitandoCepLog() {
    const campo = formLog()?.querySelector('[name="et_cep"]')
    if (campo && campo.value.replace(/\D/g, '').length === 8) consultarCepEtiquetaLog()
}

async function buscarNotaLogistica({ forcar = false } = {}) {
    clearTimeout(pausaNFLog)
    const form = formLog()
    if (!form) return
    const nf = form.querySelector('[name="nf"]').value.replace(/\D/g, '')
    const chave = `${form.querySelector('[name="app"]').value}|${nf}`
    if (!forcar && form._ultimaBuscaNF === chave) return
    form._ultimaBuscaNF = chave
    const aviso = form.querySelector('[data-aviso-nf]')
    setCampoLog(form, 'nota_id', '')
    if (!nf) {
        aviso.innerHTML = ''
        definirEtapaLog(form, 'nf', 'pendente')
        return
    }

    aviso.innerHTML = '<span class="carregando">Buscando a NF…</span>'
    try {
        const app = form.querySelector('[name="app"]').value
        const orcamento = orcamentosLog(form)[0] || ''
        const { sugestoes, orcamento: infoOrcamento } = await apiLogistica('preencher', { nf, app, orcamento })
        if (!sugestoes.length) {
            aviso.innerHTML = `<span class="log-alerta">NF ${escLog(nf)} ${app ? `da ${escLog(app)} ` : ''}não encontrada nas notas do Omie: departamento e destino liberados para preencher.</span>`
            definirEtapaLog(form, 'nf', 'manual')
            return
        }
        if (sugestoes.length === 1) return aplicarNotaLog(form, sugestoes[0], infoOrcamento)
        escolherNotaLog(form, sugestoes, infoOrcamento, `Há ${sugestoes.length} notas com o número ${escLog(nf)}. Qual é?`)
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)}: departamento e destino liberados.</span>`
        definirEtapaLog(form, 'nf', 'manual')
    }
}

function metodoPorServicoLog(servico) {
    const s = String(servico || '').toUpperCase()
    if (s.includes('SEDEX 10')) return 'SEDEX 10'
    if (s.includes('SEDEX')) return 'SEDEX'
    if (s.includes('PAC')) return 'PAC'
    if (s.includes('MINI')) return 'MINI ENVIOS'
    return ''
}

function mostrarResumoRastreioLog(info) {
    const aviso = formLog()?.querySelector('[data-aviso-rastreio]')
    if (!aviso || !info) return
    if (info.mensagem) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(info.mensagem)}</span>`
        return
    }
    const u = info.ultimo_evento || {}
    const quando = u.data ? new Date(u.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
    aviso.innerHTML = `
        ${info.situacao ? `<span class="log-situacao log-${classeSituacaoLog(info.situacao)}">${escLog(info.situacao)}</span>` : ''}
        ${escLog(u.descricao || '')} ${u.local ? `· ${escLog(u.local)}` : ''} ${quando ? `· ${escLog(quando)}` : ''}
        ${info.servico ? `<small>${escLog(info.servico)}${info.peso ? ` · ${String(info.peso).replace('.', ',')} kg` : ''}${info.dimensoes ? ` · ${escLog(info.dimensoes)}` : ''}</small>` : ''}
        ${info.postagem
            ? `<small class="ok">Postado em ${conversorDt(info.postagem.data_postagem)}${info.postagem.hora_postagem ? ` ${escLog(info.postagem.hora_postagem)}` : ''} · frete cobrado ${dinheiroTexto(info.postagem.valor)}</small>`
            : info.situacao ? '<small>Postagem ainda sem valor nos Correios: preencha o frete à mão.</small>' : ''}`
}

async function consultarRastreioFormLog({ forcar = false } = {}) {
    const form = formLog()
    if (!form) return
    const campo = form.querySelector('[name="rastreio"]')
    const codigo = campo.value.trim().toUpperCase()
    if (campo.value !== codigo) campo.value = codigo
    if (!forcar && form._ultimoRastreio === codigo) return
    form._ultimoRastreio = codigo
    const aviso = form.querySelector('[data-aviso-rastreio]')

    if (!codigo) {
        aviso.innerHTML = ''
        definirEtapaLog(form, 'rastreio', 'pendente')
        return
    }
    // Código de transportadora (fora do padrão dos Correios): não há consulta, libera o envio.
    if (!RE_RASTREIO_CORREIOS.test(codigo)) {
        aviso.innerHTML = '<span class="carregando">Código fora do padrão dos Correios: preencha o envio à mão.</span>'
        definirEtapaLog(form, 'rastreio', 'manual')
        return
    }

    aviso.innerHTML = '<span class="carregando">Consultando os Correios…</span>'
    try {
        const { rastreio: info } = await apiLogistica('rastrear', { rastreio: codigo })
        if (!info || info.mensagem) {
            aviso.innerHTML = `<span class="log-alerta">${escLog(info?.mensagem || 'Os Correios não devolveram dados para este código.')} Envio liberado para preencher.</span>`
            definirEtapaLog(form, 'rastreio', 'manual')
            return
        }
        mostrarResumoRastreioLog(info)
        setCampoLog(form, 'metodo', metodoPorServicoLog(info.servico), { soVazio: true })
        setCampoLog(form, 'previsao_entrega', info.previsao || '')
        if (info.situacao) setCampoLog(form, 'situacao', info.situacao)
        setCampoLog(form, 'data_entrega', info.data_entrega || '')
        // Postagem real: valor cobrado e data de saída (objeto ainda não postado não traz).
        const marcador = form.querySelector('[data-log-form]')
        if (info.postagem) {
            setCampoLog(form, 'custo_frete', info.postagem.valor)
            setCampoLog(form, 'data_saida', info.postagem.data_postagem)
            marcador.dataset.postagem = 'S'
        } else {
            marcador.dataset.postagem = ''
        }
        definirEtapaLog(form, 'rastreio', 'encontrado')
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)} Envio liberado para preencher.</span>`
        definirEtapaLog(form, 'rastreio', 'manual')
    }
}

function numeroLog(valor) {
    if (valor === '' || valor === null || valor === undefined) return null
    const n = Number(String(valor).replace(',', '.'))
    return Number.isFinite(n) ? n : null
}

// ---------- bloqueios de salvamento: nada sai com etapa pela metade

// Cada pendência: { texto, alvo } (alvo = seletor do campo a destacar).
function pendenciasEnvioLog(form, envio) {
    const e = estadoFormLog(form)
    const val = nome => form.querySelector(`[name="${nome}"]`)?.value?.trim() ?? ''
    const p = []
    const add = (texto, alvo) => p.push({ texto, alvo })

    // 1. Nota fiscal: encontrada, ou marcada "Sem NF" (não fica digitada e sem busca).
    if (e.nf === 'pendente')
        add(val('nf') ? 'A NF ainda está sendo localizada: aguarde ou escolha a nota na lista.' : 'Informe a nota fiscal ou clique em "Sem NF".', '[name="nf"]')

    // 2. Destinatário.
    if (!envio.loja) add('Escolha a loja / cliente (passo 2).', '[name="loja_log"]')
    if (envio.categoria === 'COMPRAS' && !envio.remetente) add('Informe o remetente da compra.', '[name="remetente"]')
    if (!envio.uf) add('Informe a UF do destino.', '[name="uf"]')

    // 3. Envio: precisa escolher como vai e terminar o caminho escolhido.
    if (!envio.categoria) add('Escolha a aba do envio.', '[name="categoria"]')
    const modo = e.modo || ''
    if (!modo) add('Escolha como o envio vai (passo 3): gerar etiqueta, já tenho o rastreio ou sem rastreio.', '.log-modos')

    if (modo === 'etiqueta' && e.etiqueta !== 'S')
        add('A etiqueta ainda não foi emitida: clique em "Emitir etiqueta" ou escolha outra opção no passo 3.', '[data-emitir-etiqueta]')

    if (modo === 'rastreio') {
        if (!envio.rastreio) add('Informe o código de rastreio.', '[name="rastreio"]')
        else if (e.rastreio === 'pendente') add('O rastreio ainda está sendo consultado nos Correios: aguarde.', '[name="rastreio"]')
    }

    // Sem os Correios preenchendo (sem rastreio, ou código de transportadora): dados mínimos à mão.
    const manual = modo === 'sem' || (modo === 'rastreio' && e.rastreio === 'manual')
    if (manual) {
        if (!envio.metodo) add('Informe o método de envio.', '[name="metodo"]')
        if (!envio.situacao) add('Informe a situação.', '[name="situacao"]')
    }
    if (!envio.data_saida && envio.situacao !== 'AGUARDANDO ENVIO' && envio.situacao !== 'CANCELADO')
        add('Informe a data de saída.', '[name="data_saida"]')
    if (envio.data_entrega && envio.data_saida && envio.data_entrega < envio.data_saida)
        add('A data de entrega está antes da data de saída.', '[name="data_entrega"]')
    if (envio.situacao === 'ENTREGUE' && !envio.data_entrega && manual)
        add('Situação ENTREGUE: informe a data em que foi entregue.', '[name="data_entrega"]')

    return p
}

function mostrarPendenciasLog(form, pendencias) {
    form.querySelectorAll('.log-pendente').forEach(el => el.classList.remove('log-pendente'))
    // Mexeu no campo (ou escolheu a opção), sai o destaque.
    if (!form._limpaPendencia) {
        form._limpaPendencia = true
        const limpar = ev => ev.target.closest?.('.log-pendente')?.classList.remove('log-pendente')
        form.addEventListener('input', limpar)
        form.addEventListener('change', limpar)
        form.addEventListener('click', limpar)
    }
    for (const { alvo } of pendencias) {
        const el = alvo && form.querySelector(alvo)
        ;(el?.closest('.log-campo') || el)?.classList.add('log-pendente')
    }
    const primeiro = pendencias.map(x => x.alvo && form.querySelector(x.alvo)).find(Boolean)
    primeiro?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    popup({
        titulo: 'Falta completar o envio',
        mensagem: `Não dá para salvar ainda:<ul class="log-aviso-lista">${pendencias.map(x => `<li>${x.texto}</li>`).join('')}</ul>`
    })
}

async function salvarEnvioLogistica(id = '', { aposSalvar = null } = {}) {
    const form = formLog()
    if (!form) return
    const val = nome => form.querySelector(`[name="${nome}"]`)?.value?.trim() ?? ''
    const lojaSpan = form.querySelector('[name="loja_log"]')

    const categoria = val('categoria')
    const envio = {
        categoria,
        metodo: val('metodo').toUpperCase() || null,
        rastreio: val('rastreio').toUpperCase() || null,
        volumes: numeroLog(val('volumes')),
        app: val('app') || null,
        nota_id: val('nota_id') || null,
        nf: val('nf').replace(/\D/g, '').replace(/^0+/, '') || null,
        valor_nota: numeroLog(val('valor_nota')),
        custo_frete: numeroLog(val('custo_frete')),
        cliente: lojaSpan?.id || null,
        loja: lojaSpan?.dataset.vazio === 'S' ? null : lojaSpan?.textContent.trim() || null,
        remetente: categoria === 'COMPRAS' ? val('remetente') || null : null,
        orcamento: orcamentosLog(form).join('\n') || null,
        tipo: val('tipo') || null,
        uf: val('uf').toUpperCase() || null,
        data_saida: val('data_saida') || null,
        previsao_entrega: val('previsao_entrega') || null,
        data_entrega: val('data_entrega') || null,
        situacao: val('situacao') || null,
        material: val('material') || null,
        observacao: val('observacao') || null
    }
    const etiquetaJson = val('etiqueta')
    if (etiquetaJson) envio.etiqueta = JSON.parse(etiquetaJson)
    envio.requisicao_id = val('requisicao_id') || null
    envio.chamado = envio.requisicao_id ? val('chamado') || null : null
    envio.fluxo = envio.requisicao_id ? val('fluxo') || null : null

    const pendencias = pendenciasEnvioLog(form, envio)
    if (pendencias.length) return mostrarPendenciasLog(form, pendencias)
    // Entregue em → situação ENTREGUE (a menos que tenha sido escolhida outra final).
    if (envio.data_entrega && !['DEVOLVIDO', 'CANCELADO'].includes(envio.situacao))
        envio.situacao = 'ENTREGUE'

    overlayAguarde()
    const idFinal = id || crypto.randomUUID()
    if (!id) envio.usuario = acesso.usuario

    const resposta = await enviar(`controle_logistico/${idFinal}`, envio)
    if (!resposta || resposta.mensagem) {
        removerOverlay()
        return popup({ mensagem: resposta?.mensagem || 'Falha ao salvar o envio: fale com o suporte.' })
    }

    removerPopup(form.closest('.popup')?.id)
    removerOverlay()

    // Código dos Correios: grava o histórico já (a rotina do servidor segue de hora em hora).
    if (envio.rastreio && RE_RASTREIO_CORREIOS.test(envio.rastreio))
        apiLogistica('rastrear', { ids: [idFinal] }).catch(err => console.error('[LOGÍSTICA rastrear]', err))
    if (envio.nota_id) contarPendentesLogistica()
    // Envio ligado a requisição: o chamado recebe EM SEPARAÇÃO / PEÇAS ENVIADAS / PEÇAS DISPONÍVEIS.
    if (envio.requisicao_id)
        apiLogistica('sincronizar', { ids: [idFinal] }).catch(err => console.error('[LOGÍSTICA→OCORRÊNCIA]', err))
    if (aposSalvar) aposSalvar(idFinal)
    return idFinal
}

async function excluirEnvioLogistica(id) {
    const confirmado = await confirmarPopup({ titulo: 'Excluir envio', mensagem: 'Excluir este envio do controle logístico?', textoConfirmar: 'Excluir' })
    if (!confirmado) return
    const form = formLog()
    const resultado = await deletar(`controle_logistico/${id}`)
    if (resultado?.success) {
        removerPopup(form?.closest('.popup')?.id)
        contarPendentesLogistica()
    }
}

// ---------------------------------------------------------------- envio: modo, destinatário e etiqueta

const CAIXA_PADRAO_LOG = 'gcs-log-ultima-caixa'

// Modalidades do contrato (mesmos códigos de SCRIPTS/correios.js → SERVICOS_ETIQUETA). PAC primeiro: é o padrão.
const MODALIDADES_CORREIOS_LOG = [
    { codigo: '03298', nome: 'PAC', descricao: 'mais barato, prazo maior' },
    { codigo: '03220', nome: 'SEDEX', descricao: 'mais rápido' },
    { codigo: '03158', nome: 'SEDEX 10', descricao: 'entrega até as 10h' },
    { codigo: '03140', nome: 'SEDEX 12', descricao: 'entrega até as 12h' }
]

// Etiqueta / rastreio / sem rastreio. Com etiqueta emitida o modo fica fixo.
function escolherModoEnvioLog(modo, { inicial = false } = {}) {
    const form = formLog()
    if (!form) return
    const marcador = form.querySelector('[data-log-form]')
    if (!inicial && marcador.dataset.etiqueta === 'S') return
    marcador.dataset.modo = modo
    const emitida = marcador.dataset.etiqueta === 'S'

    form.querySelectorAll('[data-modo-envio]').forEach(b => {
        const ativo = b.dataset.modoEnvio === modo
        b.classList.toggle('ativo', ativo)
        b.setAttribute('aria-checked', ativo)
    })
    form.querySelector('.log-painel-etiqueta').hidden = modo !== 'etiqueta' || emitida
    form.querySelector('.log-painel-rastreio').hidden = !(modo === 'rastreio' || emitida)
    if (inicial) return aplicarTravasLog(form)

    const avisoRastreio = form.querySelector('[data-aviso-rastreio]')
    if (modo === 'etiqueta') {
        setCampoLog(form, 'rastreio', '')
        avisoRastreio.innerHTML = ''
        definirEtapaLog(form, 'rastreio', 'etiqueta')
        if (!form._etiquetaDados) carregarDestinatarioLog()
        else validarDestinatarioLog(form)
    } else if (modo === 'rastreio') {
        definirEtapaLog(form, 'rastreio', form.querySelector('[name="rastreio"]').value.trim() ? form.querySelector('[data-log-form]').dataset.rastreio : 'pendente')
        form.querySelector('[name="rastreio"]').focus()
    } else {
        setCampoLog(form, 'rastreio', '')
        avisoRastreio.innerHTML = ''
        definirEtapaLog(form, 'rastreio', 'manual')
    }
}

// Peso e medidas ficam ocultos (opcionais). Abrir traz a última caixa usada; fechar limpa,
// para nada ser enviado sem estar à vista.
function alternarDimensoesLog() {
    const form = formLog()
    if (!form) return
    const campos = form.querySelector('[data-campos-dimensoes]')
    const botao = form.querySelector('[data-dimensoes]')
    const abrir = campos.hidden
    campos.hidden = !abrir
    botao.setAttribute('aria-expanded', abrir)
    botao.textContent = abrir ? 'Não informar dimensões' : 'Informar dimensões'
    const nomes = ['et_peso', 'et_comprimento', 'et_largura', 'et_altura']
    if (abrir) {
        try {
            const caixa = JSON.parse(localStorage.getItem(CAIXA_PADRAO_LOG) || 'null')
            if (caixa) for (const k of nomes) setCampoLog(form, k, caixa[k] || '', { soVazio: true })
        } catch { }
        form.querySelector('[name="et_peso"]').focus()
    } else {
        for (const k of nomes) setCampoLog(form, k, '')
    }
}

// Mantido para quem ainda chama (painel antigo): equivale ao modo "sem rastreio".
function semRastreioLog() {
    escolherModoEnvioLog('sem')
}

function desenharItensEtiquetaLog(form, itens, fonte) {
    form._itensEtiqueta = itens
    const total = itens.reduce((t, i) => t + (Number(i.quantidade) || 0) * (Number(i.valor) || 0), 0)
    form.querySelector('[data-et-fonte]').textContent = fonte === 'nf'
        ? '— itens e valores da NF'
        : fonte === 'total' ? '— um item com o total da NF (a nota ainda não tem o preço de cada item)' : '— sem NF: informe o que vai na caixa'
    form.querySelector('[data-et-itens]').innerHTML = fonte === 'nf' || fonte === 'total'
        ? `<table class="log-itens">
                <thead><tr><th>Item</th><th>Qtde</th><th>Valor unit.</th></tr></thead>
                <tbody>${itens.map(i => `<tr><td>${escLog(i.conteudo)}</td><td class="num">${escLog(i.quantidade)}</td><td class="num">${dinheiroTexto(i.valor)}</td></tr>`).join('')}</tbody>
                <tfoot><tr><th colspan="2">Total declarado</th><th class="num">${dinheiroTexto(total)}</th></tr></tfoot>
           </table>`
        : `<div class="log-grade">
                <div class="log-campo log-largo"><span>Descrição</span><input class="log-input" name="et_item_desc" placeholder="ex.: Materiais de CFTV"></div>
                <div class="log-campo"><span>Valor (R$)</span><input class="log-input" name="et_item_valor" type="number" min="0.01" step="0.01"></div>
           </div>`
}

// O que falta no destinatário para a etiqueta (mostrado no passo 2).
function validarDestinatarioLog(form) {
    const val = nome => form.querySelector(`[name="${nome}"]`)?.value?.trim() || ''
    const loja = form.querySelector('[name="loja_log"]')
    const falta = []
    if (!loja || loja.dataset.vazio === 'S') falta.push('a loja (informe a NF ou escolha no cadastro)')
    if (val('et_cep').replace(/\D/g, '').length !== 8) falta.push('o CEP')
    if (!val('et_logradouro')) falta.push('o logradouro')
    if (!val('et_numero')) falta.push('o <b>número</b>')
    if (!val('et_bairro') || !val('et_cidade') || !val('uf')) falta.push('bairro, cidade e UF')
    return falta
}

// Endereço da loja (cadastro de clientes do GCS + CEP) e itens da NF. Chamado quando a loja muda.
async function carregarDestinatarioLog() {
    const form = formLog()
    if (!form) return
    const aviso = form.querySelector('[data-aviso-destinatario]')
    const cliente = form.querySelector('[name="loja_log"]')?.id || null
    const notaId = form.querySelector('[name="nota_id"]').value || null
    if (!cliente && !notaId) {
        aviso.innerHTML = '<span class="carregando">Informe a NF ou escolha a loja: o endereço vem do cadastro do cliente.</span>'
        return
    }

    aviso.innerHTML = '<span class="carregando">Buscando o endereço no cadastro do cliente…</span>'
    try {
        const r = await apiLogistica('etiqueta/preparar', { nota_id: notaId, cliente })
        form._etiquetaDados = r
        const d = r.destinatario || {}
        const e = d.endereco || {}
        // Número digitado à mão vale mais que o do cadastro, se o CEP for o mesmo.
        const numeroDigitado = form.querySelector('[name="et_cep"]').value.replace(/\D/g, '') === e.cep
            ? form.querySelector('[name="et_numero"]').value.trim() : ''
        const campos = { et_doc: d.cpfCnpj, et_cep: e.cep, et_logradouro: e.logradouro, et_numero: numeroDigitado || e.numero,
            et_complemento: e.complemento, et_bairro: e.bairro, et_cidade: e.cidade, uf: e.uf, et_celular: d.celular, et_email: d.email }
        for (const [k, v] of Object.entries(campos)) if (v !== undefined) setCampoLog(form, k, v || '')

        // Modalidades ficam fixas no formulário (MODALIDADES_CORREIOS_LOG): não dependem do cliente.
        form._etiquetaNF = { nf: r.nf, chave_nfe: r.chave_nfe }
        desenharItensEtiquetaLog(form, r.itens || [], r.fonte_itens)

        const falta = validarDestinatarioLog(form)
        aviso.innerHTML = !d.cep_valido && e.cep
            ? '<span class="log-alerta">O CEP do cadastro não existe nos Correios: corrija o CEP.</span>'
            : falta.length
                ? `<span class="log-alerta">Confira: falta ${falta.join(', ')}.</span>`
                : '<span class="ok">Endereço do cadastro, conferido pelo CEP dos Correios.</span>'
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)}</span>`
    }
}

// Compatibilidade com chamadas antigas.
const carregarDestinatarioEtiquetaLog = carregarDestinatarioLog

async function consultarCepEtiquetaLog({ forcar = false } = {}) {
    const form = formLog()
    const cep = form?.querySelector('[name="et_cep"]').value.replace(/\D/g, '')
    if (!form || cep.length !== 8) return
    if (!forcar && form._ultimoCep === cep) return
    form._ultimoCep = cep
    const aviso = form.querySelector('[data-aviso-destinatario]')
    try {
        const { cep: info } = await apiLogistica('etiqueta/preparar', { cep })
        if (!info) return aviso.innerHTML = '<span class="log-alerta">CEP não encontrado nos Correios.</span>'
        setCampoLog(form, 'et_logradouro', info.logradouro)
        setCampoLog(form, 'et_bairro', info.bairro)
        setCampoLog(form, 'et_cidade', info.cidade)
        setCampoLog(form, 'uf', info.uf)
        aviso.innerHTML = '<span class="ok">Endereço atualizado pelo CEP. Confira o número.</span>'
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)}</span>`
    }
}

async function emitirEtiquetaLog() {
    const form = formLog()
    if (!form) return
    const val = nome => form.querySelector(`[name="${nome}"]`)?.value?.trim() ?? ''
    const aviso = form.querySelector('[data-aviso-etiqueta]')
    const botao = form.querySelector('[data-emitir-etiqueta]')
    const loja = form.querySelector('[name="loja_log"]')

    const falta = validarDestinatarioLog(form)
    if (falta.length) {
        aviso.innerHTML = `<span class="log-alerta">Antes de emitir, complete o destinatário (passo 2): ${falta.join(', ')}.</span>`
        form.querySelector('[data-aviso-destinatario]').scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
    }

    let itens = form._itensEtiqueta || []
    if (form.querySelector('[name="et_item_desc"]'))
        itens = [{ conteudo: val('et_item_desc'), quantidade: 1, valor: numeroLog(val('et_item_valor')) }]

    const corpo = {
        servico: val('et_servico'),
        peso_g: Math.round((numeroLog(val('et_peso')) || 0) * 1000),
        comprimento: numeroLog(val('et_comprimento')),
        largura: numeroLog(val('et_largura')),
        altura: numeroLog(val('et_altura')),
        nf: form._etiquetaNF?.nf || val('nf') || null,
        chave_nfe: form._etiquetaNF?.chave_nfe || null,
        itens,
        destinatario: {
            nome: loja.textContent.trim(),
            cpfCnpj: val('et_doc'),
            celular: val('et_celular'),
            email: val('et_email'),
            endereco: {
                cep: val('et_cep'), logradouro: val('et_logradouro'), numero: val('et_numero'), complemento: val('et_complemento'),
                bairro: val('et_bairro'), cidade: val('et_cidade'), uf: val('uf').toUpperCase()
            }
        }
    }

    botao.disabled = true
    aviso.innerHTML = '<span class="carregando">Emitindo a etiqueta nos Correios…</span>'
    try {
        const { etiqueta } = await apiLogistica('etiqueta/emitir', corpo)
        // Lembra a caixa só quando alguém informou medidas (em branco não apaga a anterior).
        if (val('et_peso') || val('et_comprimento'))
            try {
                localStorage.setItem(CAIXA_PADRAO_LOG, JSON.stringify({ et_peso: val('et_peso'), et_comprimento: val('et_comprimento'), et_largura: val('et_largura'), et_altura: val('et_altura') }))
            } catch { }

        // Código no envio, etiqueta guardada; o formulário salva sozinho e abre o rótulo para imprimir.
        form.querySelector('[name="etiqueta"]').value = JSON.stringify(etiqueta)
        setCampoLog(form, 'rastreio', etiqueta.codigo)
        setCampoLog(form, 'metodo', etiqueta.servico_nome || '')
        setCampoLog(form, 'situacao', 'AGUARDANDO ENVIO')
        definirEtapaLog(form, 'etiqueta', 'S')
        escolherModoEnvioLog('etiqueta', { inicial: true })
        mostrarEtiquetaEmitidaLog(form, etiqueta, form.querySelector('[data-log-form]').dataset.id, false)

        await salvarEnvioLogistica(form.querySelector('[data-log-form]').dataset.id, {
            aposSalvar: () => imprimirEtiquetaLog(etiqueta.id, etiqueta.codigo)
        })
        // Salvar com sucesso fecha o formulário; se ele continua aberto, o envio não foi gravado.
        if (document.body.contains(form))
            popup({ mensagem: `Etiqueta <b>${escLog(etiqueta.codigo)}</b> emitida, mas o envio não foi salvo. Clique em Salvar no formulário.` })
    } catch (err) {
        aviso.innerHTML = `<span class="log-alerta">${escLog(err.message)}</span>`
    } finally {
        botao.disabled = false
    }
}

function mostrarEtiquetaEmitidaLog(form, etiqueta, idEnvio, postada) {
    const aviso = form?.querySelector('[data-aviso-rastreio]')
    if (!aviso || !etiqueta) return
    if (etiqueta.cancelada_em) {
        aviso.insertAdjacentHTML('beforeend', `<small class="log-alerta">Etiqueta ${escLog(etiqueta.codigo)} cancelada em ${escLog(new Date(etiqueta.cancelada_em).toLocaleDateString('pt-BR'))}.</small>`)
        return
    }
    const prazo = etiqueta.prazo_postagem ? conversorDt(etiqueta.prazo_postagem) : ''
    aviso.insertAdjacentHTML('beforeend', `
        <div class="log-etiqueta-emitida">
            <span>Etiqueta <b>${escLog(etiqueta.codigo)}</b> emitida pelo GCS${!postada && prazo ? ` · postar até <b>${escLog(prazo)}</b>` : ''}</span>
            <button type="button" class="log-mini" onclick="imprimirEtiquetaLog('${escLog(etiqueta.id)}', '${escLog(etiqueta.codigo)}')">Imprimir</button>
            ${!postada && idEnvio ? `<button type="button" class="log-mini" onclick="cancelarEtiquetaLog('${escLog(idEnvio)}')">Cancelar etiqueta</button>` : ''}
        </div>`)
}

function detalhesEtiquetaLog({ id, etiqueta, rastreio_info } = {}) {
    if (!etiqueta) return ''
    const postada = Boolean(rastreio_info?.postagem)
    const linhas = [
        ['Código', etiqueta.codigo],
        ['Serviço', etiqueta.servico_nome],
        ['Emitida em', etiqueta.emitida_em ? new Date(etiqueta.emitida_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''],
        ['Postar até', !postada && etiqueta.prazo_postagem ? conversorDt(etiqueta.prazo_postagem) : ''],
        ['Caixa', [etiqueta.dimensoes, etiqueta.peso_g ? `${String(etiqueta.peso_g / 1000).replace('.', ',')} kg` : ''].filter(Boolean).join(' · ')
            || (etiqueta.medidas_na_agencia ? 'Pesada e medida na agência' : '')],
        ['Situação', etiqueta.cancelada_em ? 'Cancelada' : postada ? 'Postada' : 'Aguardando postagem']
    ].filter(([, v]) => v)
    const acoes = etiqueta.cancelada_em ? '' : `
        <div class="log-etiqueta-acoes">
            <button type="button" class="log-mini" onclick="imprimirEtiquetaLog('${escLog(etiqueta.id)}', '${escLog(etiqueta.codigo)}')">Imprimir etiqueta</button>
            ${postada ? '' : `<button type="button" class="log-mini" onclick="cancelarEtiquetaLog('${escLog(id)}')">Cancelar etiqueta</button>`}
        </div>`
    return `
        <div class="log-detalhes"><b>Etiqueta</b>
            <table class="log-itens"><tbody>${linhas.map(([k, v]) => `<tr><th>${k}</th><td>${escLog(v)}</td></tr>`).join('')}</tbody></table>
            ${acoes}
        </div>`
}

async function imprimirEtiquetaLog(idPrePostagem, codigo = '') {
    overlayAguarde()
    try {
        const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
        const resposta = await fetch(`${api}/logistica/etiqueta/pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id_prepostagem: idPrePostagem })
        })
        if (!resposta.ok) {
            const erro = await resposta.json().catch(() => ({}))
            throw new Error(erro.mensagem || `Falha ao gerar o rótulo (${resposta.status})`)
        }
        removerOverlay()
        mostrarPreviaPdf(await resposta.blob(), `Etiqueta ${codigo || idPrePostagem}`)
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

async function cancelarEtiquetaLog(idEnvio) {
    const confirmado = await confirmarPopup({
        titulo: 'Cancelar etiqueta',
        mensagem: 'Cancelar a etiqueta nos Correios? Só é possível antes da postagem, e não tem custo. O envio fica com a situação CANCELADO.',
        textoConfirmar: 'Cancelar etiqueta'
    })
    if (!confirmado) return
    overlayAguarde()
    try {
        await apiLogistica('etiqueta/cancelar', { id: idEnvio })
        const form = formLog()
        if (form?.querySelector('[data-log-form]')?.dataset.id === idEnvio) removerPopup(form.closest('.popup')?.id)
        popup({ mensagem: 'Etiqueta cancelada nos Correios.', imagem: 'imagens/concluido.png', tempo: 4 })
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

// ---------------------------------------------------------------- ligação com Ocorrências (requisições)
// O cartão REQUISIÇÃO do chamado mostra o envio ligado; sem envio, "Criar envio". Com o envio, o
// servidor avança o fluxo sozinho (SCRIPTS/logistica_ocorrencias.js).

function desenharRequisicaoLog(form = formLog()) {
    const faixa = form?.querySelector('[data-requisicao]')
    if (!faixa) return
    const req = form.querySelector('[name="requisicao_id"]').value
    const chamado = form.querySelector('[name="chamado"]').value
    faixa.innerHTML = req
        ? `<span>Requisição do chamado <b>${escLog(chamado)}</b>: o fluxo do chamado anda sozinho com este envio (em separação → peças enviadas → peças disponíveis).</span>
           <button type="button" class="log-mini" onclick="desvincularRequisicaoLog()">Desvincular</button>`
        : `<span>Envio para uma requisição de chamado?</span>
           <button type="button" class="log-mini" onclick="painelRequisicoesSemEnvio({ vincular: true })">Vincular a uma requisição</button>`
    faixa.classList.toggle('vinculada', Boolean(req))
}

function desvincularRequisicaoLog() {
    const form = formLog()
    if (!form) return
    for (const nome of ['requisicao_id', 'chamado', 'fluxo']) setCampoLog(form, nome, '')
    desenharRequisicaoLog(form)
}

// Preenche o formulário aberto (ou abre um novo) com os dados da requisição.
async function aplicarRequisicaoLog(requisicaoId, chamado, { abrirNovo = false } = {}) {
    overlayAguarde()
    try {
        const r = await apiLogistica('requisicoes/preparar', { requisicao_id: requisicaoId, chamado })
        if (r.envios > 0 && !(await confirmarPopup({ titulo: 'Requisição já tem envio', mensagem: `Esta requisição já tem ${r.envios} envio(s). Criar outro mesmo assim?`, textoConfirmar: 'Criar outro' })))
            return removerOverlay()

        const inicial = {
            requisicao_id: r.requisicao_id, chamado: r.chamado, fluxo: r.fluxo,
            cliente: r.cliente, loja: r.loja, uf: r.uf, orcamento: r.orcamento, volumes: r.volumes, material: r.material
        }
        const form = formLog()
        if (abrirNovo || !form) {
            removerOverlay()
            return formularioEnvioLogistica(null, inicial)
        }
        // Formulário já aberto: só liga e completa o que estiver vazio.
        for (const nome of ['requisicao_id', 'chamado', 'fluxo']) setCampoLog(form, nome, inicial[nome] || '')
        if (form.querySelector('[name="loja_log"]')?.dataset.vazio === 'S' && r.loja) {
            setLojaLog(form, { loja: r.loja, cliente: r.cliente })
            setCampoLog(form, 'uf', r.uf)
            carregarDestinatarioLog()
        }
        if (r.orcamento && !orcamentosLog(form).includes(r.orcamento)) desenharOrcamentosLog(form, [...orcamentosLog(form), r.orcamento])
        setCampoLog(form, 'material', r.material, { soVazio: true })
        desenharRequisicaoLog(form)
        removerOverlay()
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

function criarEnvioDaRequisicaoLog(requisicaoId, chamado) {
    return aplicarRequisicaoLog(requisicaoId, chamado, { abrirNovo: true })
}

// funcaoAdicional da tabela de Ocorrências: preenche os cartões REQUISIÇÃO numa consulta só.
async function carregarEnviosRequisicoesLog() {
    const caixas = [...document.querySelectorAll('[data-envio-req]')]
    if (!caixas.length) return
    let envios = {}
    try {
        ({ envios } = await apiLogistica('requisicoes/resumo', { requisicoes: caixas.map(c => c.dataset.envioReq) }))
    } catch (err) {
        return console.error('[LOGÍSTICA requisições]', err)
    }
    for (const caixa of caixas) {
        const lista = envios[caixa.dataset.envioReq] || []
        caixa.innerHTML = lista.length
            ? lista.map(e => {
                const codigo = String(e.rastreio || '').toUpperCase()
                const quando = e.data_entrega ? `entregue ${dataCurtaLog(e.data_entrega)}` : e.previsao_entrega ? `previsão ${dataCurtaLog(e.previsao_entrega)}` : ''
                return `
                    <div class="log-envio-cartao">
                        <span class="log-envio-titulo">Envio</span>
                        ${e.situacao ? `<span class="log-situacao log-${classeSituacaoLog(e.situacao)}">${escLog(e.situacao)}</span>` : ''}
                        <span>${escLog(e.metodo || '')}</span>
                        ${codigo ? (RE_RASTREIO_CORREIOS.test(codigo)
                            ? `<span class="log-link" onclick="detalhesRastreioLogistica('${escLog(e.id)}')">${escLog(codigo)}</span>`
                            : `<span>${escLog(codigo)}</span>`) : ''}
                        ${quando ? `<span class="log-envio-quando">${escLog(quando)}</span>` : ''}
                        ${e.ultimo_evento?.descricao && !e.data_entrega ? `<small>${escLog(e.ultimo_evento.descricao)}${e.ultimo_evento.local ? ` · ${escLog(e.ultimo_evento.local)}` : ''}</small>` : ''}
                        <button type="button" class="log-mini" onclick="formularioEnvioLogistica('${escLog(e.id)}')">Abrir envio</button>
                    </div>`
            }).join('')
            : `<div class="log-envio-cartao vazio">
                    <span>Nenhum envio no Controle Logístico.</span>
                    <button type="button" class="log-mini log-mini-destaque" onclick="criarEnvioDaRequisicaoLog('${escLog(caixa.dataset.envioReq)}', '${escLog(caixa.dataset.chamado)}')">Criar envio</button>
               </div>`
    }
}

// Requisições paradas em REQUISIÇÃO e sem envio. { vincular: true } = escolher para o formulário aberto.
async function painelRequisicoesSemEnvio({ vincular = false, dias = 60 } = {}) {
    overlayAguarde()
    try {
        const { requisicoes } = await apiLogistica('requisicoes/pendentes', { dias })
        estadoLogistica.requisicoesPendentes = requisicoes
        const linhas = requisicoes.map((r, i) => `
            <tr>
                <td>${escLog(r.data)}</td>
                <td><b>${escLog(r.chamado)}</b></td>
                <td class="log-loja">${escLog(r.loja || '')}</td>
                <td>${escLog(r.uf || '')}</td>
                <td>${escLog(r.solicitante || '')}</td>
                <td><div class="log-material" title="${escLog(r.material || r.descricao)}">${escLog(r.material || r.descricao || '').replace(/\n/g, '<br>')}</div></td>
                <td><button type="button" class="log-mini log-mini-destaque" onclick="usarRequisicaoPendenteLog(${i}, ${vincular})">${vincular ? 'Vincular' : 'Criar envio'}</button></td>
            </tr>`).join('')

        popup({
            titulo: vincular ? 'Vincular a uma requisição' : 'Requisições sem envio',
            elemento: `
                <div class="log-pendentes">
                    <p class="log-dica">Cartões <b>REQUISIÇÃO</b> dos últimos ${dias} dias que ainda não andaram e não têm envio. Com o envio criado, o chamado passa sozinho para <b>EM SEPARAÇÃO</b>, depois <b>PEÇAS ENVIADAS</b> e <b>PEÇAS DISPONÍVEIS</b>.</p>
                    ${requisicoes.length ? `
                    <div class="log-pendentes-tabela">
                        <table class="tabela">
                            <thead><tr><th>Data</th><th>Chamado</th><th>Loja</th><th>UF</th><th>Solicitante</th><th>Material</th><th></th></tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>` : '<p class="log-dica"><b>Nenhuma requisição esperando envio.</b></p>'}
                </div>`
        })
    } catch (err) {
        popup({ mensagem: `Falha ao buscar as requisições: ${escLog(err.message)}` })
    }
}

async function usarRequisicaoPendenteLog(i, vincular) {
    const r = (estadoLogistica.requisicoesPendentes || [])[i]
    if (!r) return
    removerPopup([...document.querySelectorAll('.popup')].at(-1)?.id)
    await aplicarRequisicaoLog(r.requisicao_id, r.chamado, { abrirNovo: !vincular })
}

// ---------------------------------------------------------------- rastreio

// Janela do rastreio: cabeçalho, etapas, números principais e linha do tempo dos Correios.
const ETAPAS_RASTREIO_LOG = ['Postado', 'Em trânsito', 'Saiu para entrega', 'Entregue']

function etapaRastreioLog(eventos = [], info = {}) {
    const textos = eventos.map(e => String(e.descricao || '').toLowerCase())
    if (info.entregue || textos.some(t => /entregue ao destinat/.test(t))) return 3
    if (textos[0] && /saiu para entrega|aguardando retirada/.test(textos[0])) return 2
    if (textos.some(t => /transfer|encaminhad|recebido|em trânsito|em transito/.test(t))) return 1
    if (textos.some(t => /postado/.test(t))) return 0
    return -1
}

function dataEventoLog(texto) {
    const d = texto ? new Date(texto) : null
    if (!d || Number.isNaN(d.getTime())) return { dia: '', hora: '', semana: '' }
    return {
        dia: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        hora: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        semana: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
    }
}

function copiarRastreioLog(botao, codigo) {
    navigator.clipboard?.writeText(codigo).then(() => {
        botao.textContent = 'Copiado'
        setTimeout(() => { botao.textContent = 'Copiar' }, 1500)
    }).catch(() => {})
}

async function detalhesRastreioLogistica(id) {
    overlayAguarde()
    const dado = await recuperarDado('controle_logistico', id) || {}
    const info = dado.rastreio_info || null
    const eventos = info?.eventos || []
    const postagem = info?.postagem || null
    const codigo = info?.codigo || String(dado.rastreio || '').toUpperCase()
    const situacao = dado.situacao || info?.situacao || ''
    const etapa = etapaRastreioLog(eventos, info || {})
    const hoje = hojeLog()
    const atrasado = info?.previsao && !info?.data_entrega && info.previsao < hoje && !['ENTREGUE', 'CANCELADO', 'DEVOLVIDO'].includes(situacao)

    const cartao = (rotulo, valor, classe = '') => valor
        ? `<div class="log-rt-cartao ${classe}"><span>${rotulo}</span><b>${valor}</b></div>` : ''
    const cartoes = [
        cartao('Previsão de entrega', info?.previsao ? conversorDt(info.previsao) + (atrasado ? ' · atrasado' : '') : '', atrasado ? 'alerta' : ''),
        cartao('Entregue em', info?.data_entrega ? conversorDt(info.data_entrega) : '', info?.data_entrega ? 'ok' : ''),
        cartao('Postado em', postagem?.data_postagem ? `${conversorDt(postagem.data_postagem)}${postagem.hora_postagem ? ` ${escLog(postagem.hora_postagem)}` : ''}` : ''),
        cartao('Frete cobrado', postagem?.valor != null ? dinheiroTexto(postagem.valor) : ''),
        cartao('Peso', info?.peso ? `${String(info.peso).replace('.', ',')} kg` : ''),
        cartao('Caixa', escLog(info?.dimensoes || ''))
    ].join('')

    const etapas = etapa < 0 ? '' : `
        <ol class="log-rt-etapas">
            ${ETAPAS_RASTREIO_LOG.map((nome, i) => `
                <li class="${i < etapa || etapa === 3 ? 'feita' : i === etapa ? 'atual' : ''}">
                    <span class="ponto">${i < etapa || (i === etapa && etapa === 3) ? '✓' : i + 1}</span>
                    <span class="nome">${nome}</span>
                </li>`).join('')}
        </ol>`

    const linhaDoTempo = eventos.map((e, i) => {
        const { dia, hora, semana } = dataEventoLog(e.data)
        const detalhe = e.detalhe && !/survey|pesquisa|medallia/i.test(e.detalhe) ? `<small>${escLog(e.detalhe)}</small>` : ''
        return `
            <li class="log-rt-evento log-${classeSituacaoLog(situacaoEventoLog(e))}${i === 0 ? ' recente' : ''}">
                <div class="log-rt-quando"><b>${escLog(dia)}</b><span>${escLog(semana)} · ${escLog(hora)}</span></div>
                <div class="log-rt-marco"><span></span></div>
                <div class="log-rt-texto">
                    <b>${escLog(e.descricao)}</b>
                    ${e.local ? `<div class="log-rt-local">${escLog(e.local)}${e.destino ? ` <span class="seta">→</span> ${escLog(e.destino)}` : ''}</div>` : ''}
                    ${detalhe}
                </div>
            </li>`
    }).join('')

    popup({
        titulo: 'Rastreio dos Correios',
        elemento: `
            <div class="log-rt">
                <div class="log-rt-topo">
                    <div class="log-rt-codigo">
                        <span class="codigo">${escLog(codigo)}</span>
                        <button type="button" class="log-mini" onclick="copiarRastreioLog(this, '${escLog(codigo)}')">Copiar</button>
                    </div>
                    <div class="log-rt-linha">
                        ${situacao ? `<span class="log-situacao log-${classeSituacaoLog(situacao)}">${escLog(situacao)}</span>` : ''}
                        ${info?.servico ? `<span>${escLog(postagem?.servico || info.servico)}</span>` : ''}
                    </div>
                    ${dado.loja ? `<div class="log-rt-destino">Para <b>${escLog(dado.loja)}</b>${dado.uf ? ` · ${escLog(dado.uf)}` : ''}</div>` : ''}
                </div>
                ${info?.mensagem ? `<p class="log-rt-aviso log-alerta">${escLog(info.mensagem)}</p>` : ''}
                ${!info ? '<p class="log-rt-aviso">Ainda não consultado nos Correios. Clique em "Consultar agora".</p>' : ''}
                ${etapas}
                ${cartoes ? `<div class="log-rt-cartoes">${cartoes}</div>` : ''}
                ${linhaDoTempo ? `<div class="log-rt-titulo">Histórico</div><ul class="log-rt-eventos">${linhaDoTempo}</ul>` : ''}
                ${info?.atualizado_em ? `<div class="log-rt-rodape">Consultado nos Correios em ${escLog(new Date(info.atualizado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }))}</div>` : ''}
            </div>`,
        botoes: [{ texto: 'Consultar agora', img: 'atualizar', funcao: `atualizarRastreioEnvioLog('${escLog(id)}')`, fechar: true }]
    })
}

// Mesma regra do servidor (SCRIPTS/correios.js → situacaoPorEvento), só para colorir a linha do tempo.
function situacaoEventoLog(evento) {
    const d = String(evento?.descricao || '').toLowerCase()
    if (/etiqueta cancelada/.test(d)) return 'CANCELADO'
    if (/etiqueta emitida/.test(d)) return 'AGUARDANDO ENVIO'
    if (/entregue ao destinat/.test(d)) return 'ENTREGUE'
    if (/saiu para entrega|aguardando retirada/.test(d)) return 'AGUARDANDO RETIRADA'
    if (/devol/.test(d)) return 'EM DEVOLUÇÃO'
    if (/n[aã]o entregue|extravi|roub|avaria|ausente|incorreto|n[aã]o atendido|recusad/.test(d)) return 'OCORRÊNCIA'
    if (/postado/.test(d)) return 'POSTADO'
    return 'EM TRÂNSITO'
}

async function atualizarRastreioEnvioLog(id) {
    overlayAguarde()
    try {
        await apiLogistica('rastrear', { ids: [id] })
        removerOverlay()
        detalhesRastreioLogistica(id)
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

async function atualizarRastreiosLogistica() {
    overlayAguarde()
    try {
        const { consultados = 0, atualizados = 0 } = await apiLogistica('rastrear', {})
        popup({
            mensagem: consultados
                ? `${consultados} código(s) consultado(s) nos Correios, ${atualizados} envio(s) atualizado(s).`
                : 'Nenhum envio dos Correios pendente de entrega.',
            imagem: 'imagens/concluido.png',
            tempo: 4
        })
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

// ---------------------------------------------------------------- NFs sem envio

async function painelNotasSemEnvio(dias = 30) {
    overlayAguarde()
    try {
        const { notas } = await apiLogistica('notas-pendentes', { dias })
        estadoLogistica.notasPendentes = notas
        if (Number(dias) === 30) {
            estadoLogistica.pendentes = notas.length
            const alvo = document.querySelector('[data-pendentes-log]')
            if (alvo) {
                alvo.textContent = notas.length >= 300 ? '300+' : notas.length
                alvo.hidden = !notas.length
            }
        }

        const abas = Object.fromEntries(Object.entries(ABAS_LOGISTICA).filter(([k]) => k !== 'TODOS').map(([k, v]) => [k, v.titulo]))
        const linhas = notas.map((n, i) => `
            <tr>
                <td><input type="checkbox" class="log-sel-nf" value="${i}"></td>
                <td><span class="log-link" onclick="abrirDANFE('${escLog(n.nota_id)}')">${escLog(n.nf)}</span></td>
                <td>${escLog(n.app)}</td>
                <td>${escLog(n.emissao)}</td>
                <td title="${escLog(n.categoria_nota)}">${escLog(n.tipo)}</td>
                <td>${dinheiro(n.valor_nota || 0)}</td>
                <td class="log-loja">${escLog(n.loja)}</td>
                <td>${escLog(n.uf)}</td>
                <td>${escLog(n.orcamento || '')}</td>
                <td><div class="log-material" title="${escLog(n.material)}">${escLog(n.material).replace(/\n/g, '<br>')}</div></td>
                <td><button type="button" class="log-mini" onclick="lancarNotaNoFormularioLog(${i})">Abrir</button></td>
            </tr>`).join('')

        popup({
            titulo: 'NFs sem envio',
            elemento: `
                <div class="log-pendentes">
                    <div class="log-pendentes-topo">
                        ${selectLog({ rotulo: 'Período', nome: 'log_dias', valor: dias, opcoes: { 7: 'Últimos 7 dias', 15: 'Últimos 15 dias', 30: 'Últimos 30 dias', 60: 'Últimos 60 dias', 90: 'Últimos 90 dias' }, extra: 'onchange="removerPopup(this.closest(\'.popup\').id); painelNotasSemEnvio(this.value)"' })}
                        ${selectLog({ rotulo: 'Lançar na aba', nome: 'log_aba', valor: estadoLogistica.aba === 'TODOS' ? 'CORREIOS' : estadoLogistica.aba, opcoes: abas })}
                        ${campoLog({ rotulo: 'Método', nome: 'log_metodo', valor: 'PAC', extra: 'list="log-metodos-pend" style="text-transform: uppercase;"' })}
                        ${campoLog({ rotulo: 'Data de saída', nome: 'log_saida', valor: hojeLog(), tipo: 'date' })}
                        <datalist id="log-metodos-pend">${[...new Set(Object.values(ABAS_LOGISTICA).flatMap(a => a.metodos || []))].map(m => `<option value="${escLog(m)}">`).join('')}</datalist>
                    </div>
                    <p class="log-dica">Notas de venda e remessa emitidas no período que ainda não têm envio. Marque e lance em lote (o rastreio e o frete entram depois, no envio), ou use <b>Abrir</b> para lançar uma com todos os dados. NFs que não vão ser enviadas (entrega em mãos, retirada) podem ser <b>ignoradas</b>.</p>
                    ${notas.length ? `
                    <div class="log-pendentes-tabela">
                        <table class="tabela">
                            <thead><tr>
                                <th><input type="checkbox" onchange="document.querySelectorAll('.log-sel-nf').forEach(c => c.checked = this.checked)"></th>
                                <th>NF</th><th>Emp.</th><th>Emissão</th><th>Tipo</th><th>Valor</th><th>Loja</th><th>UF</th><th>Departamento</th><th>Material</th><th></th>
                            </tr></thead>
                            <tbody>${linhas}</tbody>
                        </table>
                    </div>` : '<p class="log-dica"><b>Nenhuma NF pendente no período.</b></p>'}
                </div>`,
            botoes: notas.length ? [
                { texto: 'Lançar selecionadas', img: 'concluido', funcao: 'importarNotasLogistica()' },
                { texto: 'Ignorar selecionadas', img: 'cancel', funcao: 'ignorarNotasLogistica()' }
            ] : []
        })
    } catch (err) {
        popup({ mensagem: `Falha ao buscar as NFs: ${escLog(err.message)}` })
    }
}

function notasSelecionadasLog() {
    const notas = estadoLogistica.notasPendentes || []
    return [...document.querySelectorAll('.log-sel-nf:checked')].map(c => notas[Number(c.value)]).filter(Boolean)
}

async function importarNotasLogistica() {
    const selecionadas = notasSelecionadasLog()
    if (!selecionadas.length) return popup({ mensagem: 'Marque pelo menos uma NF.' })
    const painel = document.querySelector('.log-pendentes')
    const val = nome => painel.querySelector(`[name="${nome}"]`)?.value?.trim() || ''

    overlayAguarde()
    try {
        const { criados, ignorados } = await apiLogistica('importar', {
            notas: selecionadas.map(n => n.nota_id),
            categoria: val('log_aba'),
            metodo: val('log_metodo').toUpperCase(),
            data_saida: val('log_saida')
        })
        removerPopup(painel.closest('.popup')?.id)
        popup({
            mensagem: `${criados} envio(s) lançado(s)${ignorados ? ` (${ignorados} já tinham envio)` : ''}. Complete rastreio e frete em cada um.`,
            imagem: 'imagens/concluido.png',
            tempo: 5
        })
        if (val('log_aba') !== estadoLogistica.aba && estadoLogistica.aba !== 'TODOS' && document.querySelector('.controle-logistico'))
            abrirAbaLogistica(val('log_aba'))
        contarPendentesLogistica()
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

async function ignorarNotasLogistica() {
    const selecionadas = notasSelecionadasLog()
    if (!selecionadas.length) return popup({ mensagem: 'Marque pelo menos uma NF.' })
    const confirmado = await confirmarPopup({
        titulo: 'Ignorar NFs',
        mensagem: `Tirar ${selecionadas.length} NF(s) da lista? Use para notas que não geram envio (entrega em mãos, retirada).`,
        textoConfirmar: 'Ignorar'
    })
    if (!confirmado) return
    const painel = document.querySelector('.log-pendentes')
    const dias = painel?.querySelector('[name="log_dias"]')?.value || 30
    try {
        await apiLogistica('ignorar', { notas: selecionadas.map(n => n.nota_id) })
        removerPopup(painel?.closest('.popup')?.id)
        painelNotasSemEnvio(dias)
    } catch (err) {
        popup({ mensagem: escLog(err.message) })
    }
}

function lancarNotaNoFormularioLog(i) {
    const n = (estadoLogistica.notasPendentes || [])[i]
    if (!n) return
    const painel = document.querySelector('.log-pendentes')
    const val = nome => painel?.querySelector(`[name="${nome}"]`)?.value?.trim() || ''
    formularioEnvioLogistica(null, {
        categoria: val('log_aba') || 'CORREIOS',
        metodo: val('log_metodo').toUpperCase(),
        data_saida: val('log_saida') || hojeLog(),
        nota_id: n.nota_id,
        nf: n.nf,
        app: n.app,
        valor_nota: n.valor_nota,
        tipo: n.tipo,
        cliente: n.cliente,
        loja: n.loja,
        uf: n.uf,
        orcamento: n.orcamento,
        material: n.material
    })
}

// ---------------------------------------------------------------- Excel (mesmo layout da planilha)

async function baixarExcelLogistica() {
    overlayAguarde()
    try {
        const ctrl = controles.logistica || {}
        const { resultados = [] } = await pesquisarDB({
            base: 'controle_logistico',
            filtros: combinarFiltros(ctrl.filtros, ctrl.filtrosFixos) || {},
            ordenar: [{ path: 'data_saida', direcao: 'asc' }],
            pagina: 1,
            limite: 20000
        })

        const livro = new ExcelJS.Workbook()
        const porAba = Object.keys(ABAS_LOGISTICA).filter(k => k !== 'TODOS')
            .map(aba => [aba, resultados.filter(r => r.categoria === aba)])
            .filter(([aba, linhas]) => linhas.length || aba === estadoLogistica.aba)

        const entrega = r => r.data_entrega ? dataCurtaLog(r.data_entrega) : r.previsao_entrega ? `PREV ${dataCurtaLog(r.previsao_entrega)}` : ''

        for (const [aba, linhas] of porAba) {
            const ws = livro.addWorksheet(ABAS_LOGISTICA[aba].titulo.toUpperCase())
            const compras = aba === 'COMPRAS'
            const cabecalho = compras
                ? ['MÉTODO DE ENVIO', 'VALOR NOTA', 'CUSTO FRETE', 'REMETENTE', 'DESTINATÁRIO', 'NOTA FISCAL', 'DATA DE SAIDA', 'ENTREGA', 'MATERIAL', 'SITUAÇÃO', 'OBSERVAÇÃO']
                : ['MÉTODO DE ENVIO', 'RASTREIO', 'VOLUME', 'VALOR NOTA', 'CUSTO FRETE', 'LOJA', 'DEPARTAMENTOS', 'TIPO', 'UF', 'NOTA FISCAL', 'DATA DE SAIDA', 'ENTREGA', 'MATERIAL', 'SITUAÇÃO', 'OBSERVAÇÃO']

            const total = linhas.reduce((s, r) => s + (Number(r.custo_frete) || 0), 0)
            ws.addRow(['', ABAS_LOGISTICA[aba].titulo.toUpperCase(), '', '', '', '', '', '', 'TOTAL', total])
            ws.getCell(1, 10).numFmt = '"R$" #,##0.00'
            ws.addRow(cabecalho)

            for (const r of linhas) {
                const saida = r.data_saida ? conversorDt(r.data_saida) : ''
                ws.addRow(compras
                    ? [r.metodo, numeroLog(r.valor_nota), numeroLog(r.custo_frete), r.remetente, r.loja, r.nf, saida, entrega(r), r.material, r.situacao, r.observacao]
                    : [r.metodo, r.rastreio, numeroLog(r.volumes), numeroLog(r.valor_nota), numeroLog(r.custo_frete), r.loja, r.orcamento, r.tipo, r.uf, r.nf,
                        saida, entrega(r), r.material, r.situacao, r.observacao])
            }

            ws.getRow(1).font = { bold: true, size: 13 }
            ws.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } }
            ws.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF22332A' } }
            ws.views = [{ state: 'frozen', ySplit: 2 }]
            ws.columns.forEach((col, i) => {
                const titulo = cabecalho[i] || ''
                col.width = titulo === 'MATERIAL' ? 60 : ['LOJA', 'DESTINATÁRIO', 'REMETENTE', 'OBSERVAÇÃO'].includes(titulo) ? 40 : 16
                if (['VALOR NOTA', 'CUSTO FRETE'].includes(titulo))
                    ws.getColumn(i + 1).eachCell((c, n) => { if (n > 2) c.numFmt = '"R$" #,##0.00' })
                if (titulo === 'MATERIAL')
                    ws.getColumn(i + 1).alignment = { wrapText: true, vertical: 'top' }
            })
        }

        if (!livro.worksheets.length) livro.addWorksheet('VAZIO')
        const buffer = await livro.xlsx.writeBuffer()
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).toUpperCase()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `CONTROLE LOGÍSTICO ${mes}.xlsx`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch (err) {
        console.error(err)
        popup({ mensagem: `Falha ao gerar o Excel: ${escLog(err.message)}` })
    } finally {
        removerOverlay()
    }
}
