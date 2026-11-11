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

// Formulário no padrão de linhas do GCS. Fluxo guiado para evitar digitação errada:
// - Rastreio é o primeiro campo: método, previsão, situação e entrega ficam travados até a
//   consulta nos Correios. Achou → ficam com o que veio; não achou (ou "Sem rastreio") → liberam.
// - Nota fiscal: departamento e destino ficam travados até a busca da NF. Achou → preenchidos
//   (departamento só libera se a NF não trouxer o orçamento); não achou (ou "Sem NF") → liberam.
// - Departamento é uma lista de orçamentos validados um a um (acumulativa, sem texto livre).
// - Loja escolhida na lista de clientes (cxOpcoes), não digitada.
// - "Editar manualmente" destrava tudo para correções.

const CAMPOS_RASTREIO_LOG = ['metodo', 'previsao_entrega', 'situacao', 'data_entrega']
const CAMPOS_DESTINO_LOG = ['loja', 'uf', 'tipo', 'valor_nota', 'material']

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
    for (const nome of CAMPOS_RASTREIO_LOG) {
        let travado = e.rastreio === 'pendente'
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
        if (e.nf === 'manual' && ['loja', 'uf'].includes(nome)) travado = e.destinoOrc === 'S'
        travarCampoLog(form, nome, !manual && travado)
    }

    form.querySelectorAll('[data-sem-rastreio]').forEach(b => { b.hidden = e.rastreio !== 'pendente' })
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

function semRastreioLog() {
    const form = formLog()
    if (!form) return
    form.querySelector('[data-aviso-rastreio]').innerHTML = '<span class="carregando">Sem rastreio: preencha o envio à mão.</span>'
    definirEtapaLog(form, 'rastreio', 'manual')
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

        // O primeiro orçamento define a loja (a NF pode estar no CNPJ da matriz).
        if (!lista.length && info.loja) {
            setLojaLog(form, { loja: info.loja, cliente: info.cliente })
            setCampoLog(form, 'uf', info.uf)
            definirEtapaLog(form, 'destinoOrc', 'S')
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

        // Uma linha só do formulário padrão (borda e fundo do popup), com o layout em blocos dentro.
        const elemento = `
            <div class="log-form">
                <input type="hidden" data-log-form data-id="${escLog(id || '')}" data-rastreio="${etapaRastreio}"
                    data-nf="${etapaNF}" data-orc-da-nota="${orcDaNota}" data-destino-orc="" data-manual=""
                    data-postagem="${d.rastreio_info?.postagem ? 'S' : ''}">
                <input type="hidden" name="nota_id" value="${escLog(d.nota_id)}">

                <fieldset>
                    <legend>Envio <small>— o rastreio dos Correios preenche o resto</small></legend>
                    <div class="log-grade">
                        ${campo('Rastreio <em>— preenche o envio</em>', `
                            <div class="log-com-botao">
                                ${input('rastreio', d.rastreio, 'placeholder="Código do objeto" style="text-transform: uppercase;" onchange="consultarRastreioFormLog()"')}
                                <button type="button" class="log-mini" data-sem-rastreio onclick="semRastreioLog()">Sem rastreio</button>
                            </div>
                            <div class="log-aviso" data-aviso-rastreio></div>`, 'log-largo log-destaque')}
                        ${campo('Aba', `<select class="log-input" name="categoria" onchange="alternarCamposCompraLog()">${opcoes(abas, d.categoria)}</select>`)}
                        ${campo('Método de envio', `${input('metodo', d.metodo, 'list="log-metodos" style="text-transform: uppercase;"')}<datalist id="log-metodos">${metodos.map(m => `<option value="${escLog(m)}">`).join('')}</datalist>`)}
                        ${campo('Situação', `<select class="log-input" name="situacao">${opcoes(['', ...SITUACOES_LOGISTICA], d.situacao)}</select>`)}
                        ${campo('Previsão de entrega', input('previsao_entrega', d.previsao_entrega, 'type="date"'))}
                        ${campo('Entregue em', input('data_entrega', d.data_entrega, 'type="date"'))}
                        ${campo('Volumes', input('volumes', d.volumes, 'type="number" min="0" step="1"'))}
                        ${campo('Custo do frete (R$)', input('custo_frete', d.custo_frete, 'type="number" min="0" step="0.01"'))}
                        ${campo('Data de saída', input('data_saida', d.data_saida, 'type="date"'))}
                    </div>
                </fieldset>

                <fieldset>
                    <legend>Nota fiscal e departamento <small>— a NF preenche o destino</small></legend>
                    <div class="log-grade">
                        ${campo('Nota fiscal <em>— preenche o destino</em>', `
                            <div class="log-com-botao">
                                ${input('nf', d.nf, 'inputmode="numeric" placeholder="ex.: 13165" onchange="buscarNotaLogistica()"')}
                                <button type="button" class="log-mini" data-sem-nf onclick="semNotaLog()">Sem NF</button>
                            </div>`, 'log-destaque')}
                        ${campo('Empresa', `<select class="log-input" name="app">${opcoes(['', ...empresas], d.app)}</select>`)}
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

                <fieldset>
                    <legend>Destino</legend>
                    <div class="log-grade">
                        ${campo('Remetente', input('remetente', d.remetente), 'log-so-compras')}
                        ${campo('Loja / destinatário', `<span class="opcoes" name="loja_log" ${d.cliente ? `id="${escLog(d.cliente)}"` : ''} data-vazio="${d.loja ? '' : 'S'}" onclick="abrirLojaLog(this)">${escLog(d.loja || 'Selecionar')}</span>`, 'log-largo')}
                        ${campo('UF', input('uf', d.uf, 'maxlength="2" style="text-transform: uppercase;"'))}
                        ${campo('Tipo', `<select class="log-input" name="tipo">${opcoes({ '': '', ...TIPOS_LOGISTICA }, d.tipo)}</select>`)}
                        ${campo('Valor da nota (R$)', input('valor_nota', d.valor_nota, 'type="number" min="0" step="0.01"'))}
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

    // Loja/UF do cliente do orçamento quando houver (a NF pode estar no CNPJ da matriz).
    const destino = infoOrcamento?.loja ? infoOrcamento : nota
    setLojaLog(form, { loja: destino.loja, cliente: destino.cliente || '' })
    setCampoLog(form, 'uf', destino.uf)
    if (infoOrcamento?.loja) marcador.dataset.destinoOrc = 'S'

    const avisos = []
    if (nota.cancelada) avisos.push('<b>NF cancelada no Omie.</b>')
    const outros = (nota.lancamentos || []).filter(l => l.id !== marcador.dataset.id)
    if (outros.length)
        avisos.push(`Esta NF já tem ${outros.length} envio(s) lançado(s): ${outros.map(l => `${escLog(ABAS_LOGISTICA[l.categoria]?.titulo || l.categoria)} ${l.data_saida ? `em ${conversorDt(l.data_saida)}` : ''} ${escLog(l.rastreio || '')}`).join('; ')}.`)
    if (!nota.orcamento && !orcamentosLog(form).length)
        avisos.push('A NF não traz o orçamento no Omie: adicione o departamento abaixo para puxar a loja certa.')

    form.querySelector('[data-aviso-nf]').innerHTML = `<span class="ok">NF ${escLog(nota.nf)} (${escLog(nota.app)} · ${escLog(nota.categoria_nota)} · emitida ${escLog(nota.emissao)}) carregada.</span> ${avisos.join(' ')}`
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

async function buscarNotaLogistica() {
    const form = formLog()
    if (!form) return
    const nf = form.querySelector('[name="nf"]').value.replace(/\D/g, '')
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

async function consultarRastreioFormLog() {
    const form = formLog()
    if (!form) return
    const campo = form.querySelector('[name="rastreio"]')
    const codigo = campo.value.trim().toUpperCase()
    campo.value = codigo
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

async function salvarEnvioLogistica(id = '') {
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

    if (!envio.loja && !envio.nf && !envio.rastreio)
        return popup({ mensagem: 'Informe pelo menos o rastreio, a NF ou a loja.' })
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

// ---------------------------------------------------------------- rastreio

async function detalhesRastreioLogistica(id) {
    overlayAguarde()
    const dado = await recuperarDado('controle_logistico', id) || {}
    const info = dado.rastreio_info
    const eventos = info?.eventos || []

    const linhas = eventos.map(e => `
        <li class="log-evento log-${classeSituacaoLog(situacaoEventoLog(e))}">
            <div class="log-evento-data">${escLog(e.data ? new Date(e.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '')}</div>
            <div>
                <b>${escLog(e.descricao)}</b>
                <div>${escLog(e.local || '')}${e.destino ? ` → ${escLog(e.destino)}` : ''}</div>
                ${e.detalhe && !/survey|pesquisa/i.test(e.detalhe) ? `<small>${escLog(e.detalhe)}</small>` : ''}
            </div>
        </li>`).join('')

    const cabecalho = info
        ? `<div class="log-rastreio-topo">
                <b>${escLog(info.codigo || dado.rastreio)}</b>
                ${info.servico ? `<span>${escLog(info.servico)}</span>` : ''}
                ${info.previsao ? `<span>Previsão: ${conversorDt(info.previsao)}</span>` : ''}
                ${info.data_entrega ? `<span>Entregue: ${conversorDt(info.data_entrega)}</span>` : ''}
                ${info.peso ? `<span>${String(info.peso).replace('.', ',')} kg</span>` : ''}
                ${info.dimensoes ? `<span>${escLog(info.dimensoes)}</span>` : ''}
                <small>Consultado em ${escLog(new Date(info.atualizado_em).toLocaleString('pt-BR'))}</small>
           </div>`
        : `<div class="log-rastreio-topo"><b>${escLog(dado.rastreio)}</b><small>Ainda não consultado nos Correios.</small></div>`

    popup({
        titulo: 'Rastreio dos Correios',
        elemento: `
            <div class="log-rastreio-painel">
                ${cabecalho}
                ${info?.mensagem ? `<p class="log-alerta">${escLog(info.mensagem)}</p>` : ''}
                ${linhas ? `<ul class="log-eventos">${linhas}</ul>` : ''}
            </div>`,
        botoes: [{ texto: 'Consultar agora', img: 'atualizar', funcao: `atualizarRastreioEnvioLog('${escLog(id)}')`, fechar: true }]
    })
}

// Mesma regra do servidor (SCRIPTS/correios.js → situacaoPorEvento), só para colorir a linha do tempo.
function situacaoEventoLog(evento) {
    const d = String(evento?.descricao || '').toLowerCase()
    if (/entregue ao destinat/.test(d)) return 'ENTREGUE'
    if (/aguardando retirada/.test(d)) return 'AGUARDANDO RETIRADA'
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
