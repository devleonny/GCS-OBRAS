const estadoPlanoDiario = { plano: null, dias: [], data: '', origem: false, alterado: false, carregando: false, renderizando: false, sequencia: 0 }
const numeroPlanoDiario = n => Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const dataPlanoDiario = data => data.split('-').reverse().join('/')
let bibliotecasDocumentoDiario

async function apiPlanoDiario(rota, dados = {}, arquivo = false) {
    const { token } = JSON.parse(localStorage.getItem('acesso') || '{}')
    const resposta = await fetch(`${api}/planos-diarios/${rota}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(dados)
    })
    if (!resposta.ok) {
        const erro = await resposta.json().catch(() => ({}))
        throw new Error(erro.mensagem || 'Falha ao acessar o registro diário.')
    }
    return arquivo ? resposta.blob() : resposta.json()
}

function carregarBibliotecasDiario() {
    const carregar = caminho => new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = new URL(caminho, document.baseURI).href
        script.onload = resolve
        script.onerror = () => { script.remove(); reject(new Error('Não foi possível abrir o documento.')) }
        document.head.append(script)
    })
    bibliotecasDocumentoDiario ??= (async () => {
        if (!window.JSZip) await carregar('js/vendor/jszip.min.js')
        if (!window.docx) await carregar('js/vendor/docx-preview-0.4.1.min.js')
    })().catch(e => { bibliotecasDocumentoDiario = null; throw e })
    return bibliotecasDocumentoDiario
}

async function telaPlanosDiarios() {
    if (acesso.permissao === 'cliente') return popup({ mensagem: 'Acesso restrito à equipe.' })
    try {
        if (estadoPlanoDiario.alterado && !(await confirmarPopup({ mensagem: 'Há alterações sem salvar. Deseja descartá-las?', textoConfirmar: 'Descartar alterações' }))) return
        estadoPlanoDiario.alterado = false
        await carregarListaPlanosDiarios()
        const planos = estadoPlanoDiario.lista
        tela.innerHTML = `<div class="planos-diarios">
            <header class="diario-cabecalho"><div class="diario-escolha"><span>Checklist</span>
                ${campoEscolhaHtml({ fonte: 'planosDiarios', name: 'planoDiarioEscolha', placeholder: 'Pesquise por orçamento, cliente ou obra…', aoMudar: 'escolherPlanoDiario' })}
                ${pode('checklist.projetos') ? '<button type="button" class="diario-novo" onclick="adicionarOrcamentoDiario()">+ Adicionar orçamento</button>' : ''}</div>
                <div class="diario-acoes"><button id="botaoSalvarPlanoDiario" onclick="salvarPlanoDiario()" disabled>Salvar</button>
                <button id="compartilharPlanoDiario" onclick="compartilharPlanoDiario()" hidden>Compartilhar</button>
                <button id="itensPlanoDiario" onclick="editarItensDiario()" hidden>Itens</button>
                <button id="baixarPlanoDiario" onclick="baixarWordPlanoDiario()" disabled>Baixar Word</button>
                <button id="baixarPdfPlanoDiario" onclick="baixarWordPlanoDiario('pdf')" disabled>Baixar PDF</button>
                <button id="excluirPlanoDiario" onclick="excluirDiaPlanoDiario()" hidden>Excluir dia</button>
                <button id="excluirProjetoDiario" onclick="excluirProjetoDiario()" hidden>Excluir checklist</button></div>
            </header><div id="diasPlanoDiario" class="diario-dias"></div>
            <div id="statusPlanoDiario" class="diario-status" role="status" aria-live="polite"></div>
            <div id="planoDiarioConteudo"></div>
            <section id="galeriaPlanoDiario" class="diario-galeria" aria-label="Fotos das seções" hidden></section></div>`
        if (planos.length === 1) {
            await abrirPlanoDiario(planos[0].id)
        } else if (!planos.length) document.getElementById('planoDiarioConteudo').innerHTML = '<p class="diario-vazio">Nenhum checklist. Adicione um orçamento para começar.</p>'
    } catch (e) { popup({ mensagem: e.message }) }
}

async function carregarListaPlanosDiarios() {
    estadoPlanoDiario.lista = (await apiPlanoDiario('lista')).planos
}

// Campo pesquisável do checklist: a lista já veio inteira, com o andamento de cada um.
fontesEscolha.planosDiarios = {
    valor: 'id', rotulo: p => p.titulo, limite: 60,
    detalhe: p => [p.titulo.includes(p.obra) ? '' : p.obra, `${numeroPlanoDiario(p.andamento)}% concluído`,
        p.ultimo ? `último dia ${dataPlanoDiario(p.ultimo)}` : 'sem dias preenchidos'].filter(Boolean).join(' · '),
    buscar: async palavras => (estadoPlanoDiario.lista || []).filter(p => {
        const texto = normEscolha(`${p.titulo} ${p.orcamento} ${p.obra}`)
        return palavras.every(x => texto.includes(x))
    })
}

// Deixa o campo mostrando o checklist aberto, sem disparar a abertura de novo.
function mostrarEscolhaPlanoDiario() {
    const campo = document.querySelector('.ce-campo[name="planoDiarioEscolha"]')
    if (!campo) return
    const { plano } = estadoPlanoDiario
    campo.dataset.valor = plano?.id || ''
    campo.dataset.rotulo = plano?.titulo || ''
    campo.querySelector('.ce-input').value = plano?.titulo || ''
    campo.classList.toggle('ce-preenchido', !!plano)
}

async function escolherPlanoDiario(campo) {
    if (estadoPlanoDiario.carregando || estadoPlanoDiario.renderizando) return mostrarEscolhaPlanoDiario()
    await abrirPlanoDiario(lerEscolha(campo) || '')
}

async function abrirPlanoDiario(id) {
    if (estadoPlanoDiario.carregando || estadoPlanoDiario.renderizando) return
    if (estadoPlanoDiario.alterado && !(await confirmarPopup({ mensagem: 'Há alterações sem salvar. Deseja descartá-las?', textoConfirmar: 'Descartar alterações' }))) {
        return mostrarEscolhaPlanoDiario()
    }
    if (!id) {
        estadoPlanoDiario.plano = null; estadoPlanoDiario.alterado = false
        document.getElementById('planoDiarioConteudo').replaceChildren()
        document.getElementById('diasPlanoDiario').replaceChildren()
        faixaLinkDiario()
        desenharGaleriaPlanoDiario()
        mostrarEscolhaPlanoDiario()
        controlesDocumentoDiario(); return
    }
    try {
        const dados = await apiPlanoDiario('detalhe', { plano: id })
        Object.assign(estadoPlanoDiario, dados, { alterado: false })
        // Checklist de orçamento não tem Origem (Word de referência): abre no dia de hoje.
        estadoPlanoDiario.origem = !dados.modelo.dinamico
        estadoPlanoDiario.data = dados.modelo.dinamico ? dataServidor().toLocaleDateString('en-CA') : dados.plano.inicio
        mostrarEscolhaPlanoDiario()
        await renderizarPlanoDiario()
    } catch (e) { mostrarEscolhaPlanoDiario(); popup({ mensagem: e.message }) }
}

// Ano ainda sendo digitado (0002, 0020...) não abre nada.
async function escolherOutroDiaPlanoDiario(campo) {
    if (!campo.value || !campo.validity.valid) return
    await selecionarDataPlanoDiario(campo.value)
    if (campo.isConnected) campo.value = estadoPlanoDiario.data
}

async function selecionarDataPlanoDiario(data, origem = false) {
    const estado = estadoPlanoDiario
    const campo = estado.documento?.getElementById('dataPlanoDiario')
    if (estado.carregando || estado.renderizando) { if (campo) campo.value = estado.data; return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
        if (campo) campo.value = estado.data
        return popup({ mensagem: 'Selecione uma data válida.' })
    }
    if (estado.alterado && !(await confirmarPopup({ mensagem: 'Há alterações sem salvar. Deseja descartá-las?', textoConfirmar: 'Descartar alterações' }))) { if (campo) campo.value = estado.data; return }
    estado.data = data; estado.origem = origem; estado.alterado = false
    await renderizarPlanoDiario()
}

function controlesDocumentoDiario() {
    const e = estadoPlanoDiario
    const ocupado = e.carregando || e.renderizando
    const salvar = document.getElementById('botaoSalvarPlanoDiario')
    const baixar = document.getElementById('baixarPlanoDiario')
    if (salvar) salvar.disabled = ocupado || (e.origem && !e.alterado) || !e.plano || !e.documento
    if (baixar) baixar.disabled = ocupado || e.alterado || !e.plano || (!e.origem && !e.dias.some(d => d.data_ref === e.data))
    const excluir = document.getElementById('excluirPlanoDiario')
    if (excluir) {
        excluir.hidden = e.origem || !e.plano || !e.dias.some(d => d.data_ref === e.data)
        excluir.disabled = ocupado
    }
    const compartilhar = document.getElementById('compartilharPlanoDiario')
    if (compartilhar) { compartilhar.hidden = !e.plano || !pode('checklist.compartilhar'); compartilhar.disabled = ocupado }
    const pdf = document.getElementById('baixarPdfPlanoDiario')
    if (pdf) pdf.disabled = baixar?.disabled ?? true
    document.querySelectorAll('.diario-escolha input, .diario-escolha button').forEach(el => { el.disabled = ocupado })
    const gerivel = !!e.modelo?.dinamico && !!e.plano && pode('checklist.projetos')
    for (const id of ['itensPlanoDiario', 'excluirProjetoDiario']) {
        const botao = document.getElementById(id)
        if (botao) { botao.hidden = !gerivel; botao.disabled = ocupado }
    }
    e.documento?.querySelectorAll('input').forEach(el => { el.disabled = ocupado; el.readOnly = e.origem && el.type !== 'date' })
    document.querySelectorAll('#diasPlanoDiario button, #diasPlanoDiario input').forEach(el => { el.disabled = ocupado })
}

function desenharDiasPlanoDiario() {
    const e = estadoPlanoDiario
    document.getElementById('diasPlanoDiario').innerHTML = (e.modelo?.dinamico ? '' : `<button type="button" class="diario-dia diario-origem ${e.origem ? 'selecionado' : ''}" onclick="selecionarDataPlanoDiario('${e.plano.inicio}', true)">Origem</button>`)
        + e.dias.slice().sort((a, b) => a.data_ref.localeCompare(b.data_ref)).map(d =>
        `<button type="button" class="diario-dia ${!e.origem && d.data_ref === e.data ? 'selecionado' : ''} ${pendenteLinkDiario(d) ? 'diario-a-conferir' : ''}" onclick="selecionarDataPlanoDiario('${d.data_ref}')"><span aria-label="${pendenteLinkDiario(d) ? 'Preenchido pelo link, a conferir' : 'Preenchido'}">${pendenteLinkDiario(d) ? '●' : '✓'}</span> ${dataPlanoDiario(d.data_ref)}</button>`).join('')
    const salvo = e.dias.some(d => d.data_ref === e.data)
    document.getElementById('diasPlanoDiario').insertAdjacentHTML('beforeend', `
        ${!e.origem && !salvo ? `<button type="button" class="diario-dia diario-novo-dia selecionado">${dataPlanoDiario(e.data)} · ainda não salvo</button>` : ''}
        <label class="diario-outro-dia">Preencher outro dia <input type="date" id="outroDiaPlanoDiario" value="${e.data}" min="2020-01-01" max="2099-12-31"
            onchange="escolherOutroDiaPlanoDiario(this)"></label>`)
    faixaLinkDiario()
}

async function renderizarPlanoDiario() {
    const e = estadoPlanoDiario
    const sequencia = ++e.sequencia
    e.observador?.disconnect()
    e.renderizando = true; e.documento = null
    desenharGaleriaPlanoDiario()
    controlesDocumentoDiario()
    const local = document.getElementById('planoDiarioConteudo')
    local.innerHTML = '<div class="diario-carregando"><img src="gifs/loading-gcs.png" alt="Carregando"></div>'
    desenharDiasPlanoDiario()
    try {
        const [arquivo] = await Promise.all([apiPlanoDiario('visualizar', { plano: e.plano.id, data: e.data, origem: e.origem }, true), carregarBibliotecasDiario()])
        if (sequencia !== e.sequencia || !local.isConnected) return
        const frame = document.createElement('iframe')
        frame.id = 'documentoPlanoDiario'; frame.title = 'Checklist'; frame.setAttribute('sandbox', 'allow-same-origin allow-scripts')
        const pronto = new Promise(resolve => frame.addEventListener('load', resolve, { once: true }))
        frame.srcdoc = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'">
            <style>html,body{margin:0;background:#fff;}
            input{font:inherit;color:inherit;text-align:inherit;box-sizing:border-box;background:transparent;border:0;border-radius:0;margin:0;padding:0;width:100%;min-width:0;outline:0;}
            input:focus{outline:1px solid #96b6a5;outline-offset:2px;}input[type=number]{appearance:textfield;-moz-appearance:textfield;}input::-webkit-inner-spin-button,input::-webkit-outer-spin-button{appearance:none;margin:0;}input[type=date]{font-size:inherit;}
            </style></head><body><main id="documento"></main></body></html>`
        const rolagem = document.createElement('div'); rolagem.className = 'diario-folha'; rolagem.append(frame)
        local.replaceChildren(rolagem)
        await pronto
        const doc = frame.contentDocument
        const estilos = doc.createElement('div')
        doc.body.prepend(estilos)
        await window.docx.renderAsync(arquivo, doc.getElementById('documento'), estilos, {
            className: 'docx', inWrapper: true, ignoreLastRenderedPageBreak: false, useBase64URL: true,
            renderComments: false, renderChanges: false, renderAltChunks: false
        })
        if (sequencia !== e.sequencia || !frame.isConnected) return
        e.documento = doc
        doc.addEventListener('click', ev => { if (ev.target.closest('a')) ev.preventDefault() })
        prepararCamposDocumentoDiario(doc)
        await Promise.all([...doc.images].map(img => img.decode().catch(() => {})))
        if (doc.fonts?.ready) await doc.fonts.ready
        if (sequencia !== e.sequencia || !frame.isConnected) return
        const ajustar = () => { if (frame.isConnected) frame.style.height = `${Math.ceil(doc.getElementById('documento').getBoundingClientRect().height) + 4}px` }
        ajustar()
        const observer = new ResizeObserver(ajustar)
        e.observador = observer
        observer.observe(doc.body)
        frame.addEventListener('load', () => observer.disconnect(), { once: true })
        document.getElementById('statusPlanoDiario').textContent = ''
    } catch (err) {
        if (sequencia === e.sequencia) { local.replaceChildren(); popup({ mensagem: err.message }) }
    } finally {
        if (sequencia === e.sequencia) { e.renderizando = false; controlesDocumentoDiario() }
    }
}

function textoCelulaDiario(celula, valor) {
    const textos = []
    const walker = celula.ownerDocument.createTreeWalker(celula, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) if (walker.currentNode.textContent.trim()) textos.push(walker.currentNode)
    if (textos.length) { textos[0].textContent = valor; textos.slice(1).forEach(t => { t.textContent = '' }) }
    else celula.textContent = valor
}

function prepararCamposDocumentoDiario(doc) {
    const e = estadoPlanoDiario
    const tabelas = doc.querySelectorAll('table')
    if (tabelas.length < 2) throw new Error('O modelo não contém as tabelas esperadas.')
    const gerais = tabelas[0].rows
    const salvo = e.origem ? null : e.dias.find(d => d.data_ref === e.data)
    const anteriores = e.dias.filter(d => d.data_ref < e.data).sort((a, b) => a.data_ref.localeCompare(b.data_ref))
    const dados = e.origem ? e.plano : salvo?.dados || anteriores.at(-1)?.dados || e.plano
    const campo = (celula, id, tipo, valor, atributos = {}) => {
        const formato = doc.defaultView.getComputedStyle(celula.querySelector('span') || celula)
        const input = doc.createElement('input')
        input.id = id; input.type = tipo; input.value = valor
        input.style.font = formato.font; input.style.color = formato.color
        input.required = !(e.modelo?.dinamico && tipo === 'text')
        for (const [nome, valor] of Object.entries(atributos)) input.setAttribute(nome, valor)
        const p = celula.querySelector('p') || celula
        p.replaceChildren(input)
        input.addEventListener('input', () => {
            if (tipo === 'date') return
            e.alterado = true; atualizarNumerosPlanoDiario()
        })
        return input
    }
    const data = campo(gerais[0].cells[3], 'dataPlanoDiario', 'date', e.data, { 'aria-label': gerais[0].cells[2].textContent })
    data.min = '2020-01-01'; data.max = '2099-12-31'
    data.addEventListener('change', () => escolherOutroDiaPlanoDiario(data))
    campo(gerais[1].cells[3], 'gerentePlanoDiario', 'text', dados.gerente || '', { maxlength: 150, 'aria-label': gerais[1].cells[2].textContent })
    campo(gerais[2].cells[1], 'efetivoPlanoDiario', 'number', dados.efetivo ?? e.plano.efetivo, { min: 0, step: 1, 'aria-label': gerais[2].cells[0].textContent })
    campo(gerais[2].cells[3], 'horarioPlanoDiario', 'text', dados.horario || '', { maxlength: 100, 'aria-label': gerais[2].cells[2].textContent })
    e.linhas = e.plano.atividades.map((a, i) => {
        const linha = tabelas[1].rows[i + 1]
        const descricao = linha.cells[1].textContent.trim()
        campo(linha.cells[5], `executadoDiario${a.id}`, 'number', e.origem ? a.diaModelo || 0 : salvo?.dados?.executado?.[a.id] || 0,
            { min: 0, max: a.previsto, step: '0.001', 'data-atividade': a.id, 'aria-label': `${tabelas[1].rows[0].cells[5].textContent}: ${descricao}` })
        return { ...a, descricao, linha }
    })
    // Gráficos pelo tamanho que o servidor dá a eles (468pt de largura, cada um com sua altura):
    // as fotos das seções 03 e 04 (até 425pt) também aparecem e podem vir depois dos gráficos.
    const grafico = altura => [...doc.images]
        .filter(img => img.style.width === '468pt' && Math.abs(parseFloat(img.style.height) - altura) < 0.1).at(-1) || null
    e.graficoResumo = grafico(90.2)
    e.grafico = grafico(257.95)
    e.graficoGeral = grafico(132)
    e.graficos = null
    // Checklist de orçamento: todos os gráficos têm 468pt; o último é o geral, os outros são os grupos de itens.
    if (e.modelo?.dinamico) {
        const todos = [...doc.images].filter(img => img.style.width === '468pt')
        e.graficoGeral = todos.at(-1) || null
        e.graficos = todos.slice(0, -1)
        e.grafico = e.graficos[0] || null
        e.graficoResumo = null
    }
    atualizarNumerosPlanoDiario()
}

function lerPlanoDiario() {
    const e = estadoPlanoDiario
    const doc = e.documento
    return {
        executado: Object.fromEntries([...doc.querySelectorAll('[data-atividade]')].map(input => [input.dataset.atividade, Number(input.value || 0)])),
        gerente: doc.getElementById('gerentePlanoDiario').value,
        efetivo: Number(doc.getElementById('efetivoPlanoDiario').value),
        horario: doc.getElementById('horarioPlanoDiario').value,
        observacoes: e.dias.find(d => d.data_ref === e.data)?.dados?.observacoes || ''
    }
}

// GALERIA DAS SEÇÕES 03 E 04 (abaixo da prévia): fotos com data, comentário e marcações, incluídas,
// alteradas e removidas a qualquer momento e gravadas na hora (/planos-diarios/fotos), sem o Salvar
// do dia. "Fotos da execução" (seção diaria) entram só no relatório do dia delas. Planta/layout entra da
// data em diante: trocar, comentar, apagar marcação ou retirar num dia vale daquele dia em diante, e os
// relatórios anteriores ficam como estavam (links, comentarios, ate; as mesmas regras no servidor). Data, comentário e marcações mudam só pelo editor da foto.

const versaoEmDiario = (lista, data) => (lista || []).filter(v => v.data <= data).sort((a, b) => a.data.localeCompare(b.data)).at(-1)
const linkEmDiario = (foto, data) => versaoEmDiario(foto.links, data)?.link ?? foto.link
const comentarioEmDiario = (foto, data) => versaoEmDiario(foto.comentarios, data)?.texto ?? foto.comentario ?? ''
const diaAbertoDiario = () => estadoPlanoDiario.origem ? estadoPlanoDiario.plano.inicio : estadoPlanoDiario.data
const secaoDiariaDiario = secao => !!estadoPlanoDiario.modelo?.secoes?.find(s => s.secao === secao)?.diaria
const marcacoesEmDiario = (foto, data) => (foto.marcacoes || []).filter(m => m.data <= data && !(m.ate && m.ate <= data))
const CORES_ITENS_DIARIO = ['#1d63ed', '#e11d2e', '#16a34a', '#c99a06', '#7c3aed', '#0e9aa7', '#ea580c', '#be185d', '#4d7c0f', '#475569']

// Tipos de marcação: os da legenda das plantas e a linha livre. Mesma tabela no servidor
// (gcs/SCRIPTS/planos_diarios.js, TIPOS_MARCACAO). Coordenadas de 0 a 1, proporcionais à imagem.
const TIPOS_MARCACAO_DIARIO = {
    rack: { rotulo: 'Rack IDF', cor: '#e11d2e', tracejado: true, forma: 'retangulo' },
    eletroduto_dados: { rotulo: 'Eletroduto de dados', cor: '#16a34a', tracejado: true, forma: 'linha' },
    eletrocalha: { rotulo: 'Eletrocalha', cor: '#c99a06', tracejado: true, forma: 'linha' },
    utp: { rotulo: 'Cabo UTP', cor: '#1d63ed', tracejado: false, forma: 'linha' },
    fibra: { rotulo: 'Fibra óptica', cor: '#e11d2e', tracejado: false, forma: 'linha' },
    eletroduto_eletrico: { rotulo: 'Eletroduto elétrico', cor: '#16a34a', tracejado: false, forma: 'linha' },
    circuito: { rotulo: 'Circuito elétrico', cor: '#1d63ed', tracejado: true, forma: 'linha' },
    camera: { rotulo: 'Câmera', cor: '#35d000', tracejado: false, forma: 'ponto' },
    livre: { rotulo: 'Linha livre', cor: null, tracejado: false, forma: 'linha' },
    item: { rotulo: 'Item do checklist', cor: null, tracejado: false, forma: 'ponto' }
}

// SVG das marcações sobre uma imagem largura x altura (px naturais), igual ao do Word (svgMarcacoes).
// interativo: cada marcação vira um <g data-marcacao> com uma faixa larga invisível para o clique de apagar.
function svgMarcacoesDiario(marcacoes, largura, altura, { interativo = false } = {}) {
    const traco = Math.max(2, largura * 0.0035)
    const raio = Math.max(3, largura * 0.007)
    const n = v => Math.round(v * 10) / 10
    const elementos = marcacoes.map(m => {
        const tipo = TIPOS_MARCACAO_DIARIO[m.tipo]
        if (!tipo) return ''
        const cor = m.tipo === 'livre' ? m.cor : tipo.cor
        const tracejado = tipo.tracejado ? ` stroke-dasharray="${n(traco * 4)} ${n(traco * 3)}"` : ''
        let forma, toque
        if (m.tipo === 'item') {
            const i = (estadoPlanoDiario.plano?.atividades || []).findIndex(a => a.id === m.atividade)
            const rItem = Math.max(6, largura * 0.011)
            forma = `<circle cx="${n(m.x * largura)}" cy="${n(m.y * altura)}" r="${n(rItem)}" fill="${i < 0 ? '#8a968f' : CORES_ITENS_DIARIO[i % CORES_ITENS_DIARIO.length]}" stroke="#fff" stroke-width="${n(traco * 0.5)}"/>`
                + `<text x="${n(m.x * largura)}" y="${n(m.y * altura + rItem * 0.38)}" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${n(rItem * 1.1)}" fill="#fff">${i < 0 ? '?' : i + 1}</text>`
            toque = ''
        } else if (tipo.forma === 'ponto') {
            forma = `<circle cx="${n(m.x * largura)}" cy="${n(m.y * altura)}" r="${n(raio)}" fill="${cor}" stroke="#168b00" stroke-width="${n(traco * 0.4)}"/>`
            toque = `<circle cx="${n(m.x * largura)}" cy="${n(m.y * altura)}" r="${n(raio * 2)}" fill="transparent"/>`
        } else if (tipo.forma === 'retangulo') {
            const r = `x="${n(Math.min(m.x1, m.x2) * largura)}" y="${n(Math.min(m.y1, m.y2) * altura)}" width="${n(Math.abs(m.x2 - m.x1) * largura)}" height="${n(Math.abs(m.y2 - m.y1) * altura)}" fill="none"`
            forma = `<rect ${r} stroke="${cor}" stroke-width="${n(traco)}"${tracejado}/>`
            toque = `<rect ${r} stroke="transparent" stroke-width="${n(traco * 6)}"/>`
        } else {
            const pontos = `points="${m.pontos.map(([x, y]) => `${n(x * largura)},${n(y * altura)}`).join(' ')}" fill="none" stroke-linecap="round" stroke-linejoin="round"`
            forma = `<polyline ${pontos} stroke="${cor}" stroke-width="${n(traco)}"${tracejado}/>`
            toque = `<polyline ${pontos} stroke="transparent" stroke-width="${n(traco * 6)}"/>`
        }
        return interativo ? `<g data-marcacao="${escaparAtributo(m.id)}">${toque}${forma}</g>` : forma
    }).join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none">${elementos}</svg>`
}

// Amostra do tipo nos botões do editor (traço com a cor e o tracejado da legenda).
function amostraMarcacaoDiario(chave, cor) {
    const tipo = TIPOS_MARCACAO_DIARIO[chave]
    const c = cor || tipo.cor
    if (tipo.forma === 'ponto') return `<svg viewBox="0 0 28 14" aria-hidden="true"><circle cx="14" cy="7" r="5" fill="${c}" stroke="#168b00"/></svg>`
    if (tipo.forma === 'retangulo') return `<svg viewBox="0 0 28 14" aria-hidden="true"><rect x="7" y="1.5" width="14" height="11" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 2"/></svg>`
    return `<svg viewBox="0 0 28 14" aria-hidden="true"><line x1="2" y1="7" x2="26" y2="7" stroke="${c}" stroke-width="3"${tipo.tracejado ? ' stroke-dasharray="5 3"' : ''}/></svg>`
}

// Miniatura: as marcações por cima, quando a imagem termina de carregar (o tamanho natural dá o viewBox).
function miniaturaFotoDiario(img) {
    const foto = (estadoPlanoDiario.plano?.galeria || []).find(f => f.id === img.dataset.foto)
    const local = img.parentElement
    local.querySelector('svg')?.remove()
    const marcacoes = foto ? marcacoesEmDiario(foto, diaAbertoDiario()) : []
    if (!marcacoes.length || !img.naturalWidth) return
    local.insertAdjacentHTML('beforeend', svgMarcacoesDiario(marcacoes, img.naturalWidth, img.naturalHeight))
}

function desenharGaleriaPlanoDiario() {
    const e = estadoPlanoDiario
    const area = document.getElementById('galeriaPlanoDiario')
    if (!area) return
    const secoes = e.modelo?.secoes || []
    area.hidden = !e.plano || !secoes.length
    if (area.hidden) return area.replaceChildren()

    const galeria = e.plano.galeria || []
    const dia = diaAbertoDiario()
    area.innerHTML = secoes.map(({ secao, titulo, diaria }) => {
        const todas = galeria.filter(f => f.secao === secao)
        // Fotos da execução: só as do dia aberto. Na Origem, todas (é a visão geral da obra).
        const fotos = todas.filter(f => diaria ? e.origem || f.data === dia : !(f.ate && f.ate <= dia))
            .sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)))
        const plural = n => `${n} ${n === 1 ? 'foto' : 'fotos'}`
        const outras = todas.filter(f => f.data !== dia)
        const diasOutras = [...new Set(outras.map(f => f.data))].sort()
        const resumo = diaria && !e.origem
            ? `${plural(fotos.length)} em ${dataPlanoDiario(dia)} · as fotos dos outros dias continuam nos relatórios deles, não precisa apagar`
            : diaria ? `${plural(fotos.length)} de todos os dias`
            : `${plural(fotos.length)} · mudanças aqui valem de ${dataPlanoDiario(dia)} em diante`
        const layout = !diaria && secao === '03'
        return `
            <div class="diario-galeria-secao" ondragenter="arrastarFotosDiario(event, this)" ondragover="arrastarFotosDiario(event, this)"
                ondragleave="sairArrastarFotosDiario(event, this)" ondrop="soltarFotosDiario(event, '${secao}', this)">
                <div class="diario-galeria-topo">
                    <div><h3>${secao} · ${escaparAtributo(titulo)}</h3><small>${resumo} · clique numa foto para marcar e comentar · arraste fotos para cá</small></div>
                    ${layout ? '<button type="button" class="diario-galeria-layout" onclick="abrirLayoutDiario()">Desenhar layout</button>' : ''}
                    <label class="diario-galeria-adicionar">Adicionar fotos
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                            onchange="enviarFotosGaleriaDiario(this, '${secao}')">
                    </label>
                </div>
                ${diaria && !e.origem && diasOutras.length ? `<div class="diario-galeria-dias"><small>Fotos de outros dias:</small>${diasOutras.map(d =>
                    `<button type="button" onclick="selecionarDataPlanoDiario('${d}')">${dataPlanoDiario(d).slice(0, 5)} (${outras.filter(f => f.data === d).length})</button>`).join('')}</div>` : ''}
                <div class="diario-galeria-grade">
                    ${fotos.length ? fotos.map(f => {
                        const qtde = marcacoesEmDiario(f, dia).length
                        const comentario = comentarioEmDiario(f, dia)
                        // Foto com data depois do documento aberto (a Origem é o dia de início) não entra
                        // nele: avisa no cartão, para não parecer que sumiu.
                        const fora = !diaria && f.data > dia ? `Entra no relatório a partir de ${dataPlanoDiario(f.data)}` : ''
                        return `
                        <figure class="diario-galeria-foto${(diaria ? f.data === dia : f.data <= dia) ? ' no-dia' : ''}">
                            <button type="button" class="diario-galeria-abrir" onclick="abrirEditorFotoDiario('${escaparAtributo(f.id)}')"
                                title="Abrir para marcar e comentar">
                                <span class="diario-galeria-imagem">
                                    <img src="${escaparAtributo(`${api}/uploads/${linkEmDiario(f, dia)}`)}" alt="${escaparAtributo(comentario || f.nome || 'Foto')}"
                                        loading="lazy" data-foto="${escaparAtributo(f.id)}" onload="miniaturaFotoDiario(this)">
                                </span>
                                <span class="diario-galeria-dados">
                                    <b>${dataPlanoDiario(f.data)}</b>
                                    ${qtde ? `<small>${qtde} ${qtde === 1 ? 'marcação' : 'marcações'}</small>` : ''}
                                </span>
                                ${fora ? `<span class="diario-galeria-fora">${fora}</span>` : ''}
                                ${f.link_id ? `<small class="diario-galeria-autor">${escaparAtributo(f.link_nome || f.usuario)} (link)</small>` : ''}
                                ${comentario ? `<span class="diario-galeria-comentario">${escaparAtributo(comentario)}</span>` : ''}
                            </button>
                            ${f.layout ? `<button type="button" class="diario-galeria-desenho" onclick="abrirLayoutDiario('${escaparAtributo(f.id)}')">Editar desenho</button>` : ''}
                            <button type="button" class="diario-galeria-remover" aria-label="Remover foto" title="Remover foto"
                                onclick="removerFotoGaleriaDiario('${escaparAtributo(f.id)}')">×</button>
                        </figure>`
                    }).join('')
                    : '<small class="diario-galeria-vazio">Nenhuma foto nesta seção.</small>'}
                </div>
            </div>`
    }).join('')
}

// ---------- Editor da foto: marcações, data e comentário, gravados juntos no Salvar ----------

function abrirEditorFotoDiario(id) {
    const e = estadoPlanoDiario
    const foto = (e.plano?.galeria || []).find(f => f.id === id)
    if (!foto) return
    const dia = diaAbertoDiario()
    const diaria = secaoDiariaDiario(foto.secao)
    // Novas marcações: na foto da execução valem no dia dela; na planta, do dia aberto em diante.
    const diaAberto = diaria || dia < foto.data ? foto.data : dia
    e.editor = {
        id, ferramenta: null, cor: '#7c3aed', zoom: 100, largura: 0, altura: 0,
        marcacoes: (foto.marcacoes || []).map(m => ({ ...m, pontos: m.pontos?.map(p => [...p]) })),
        desfazer: [], linha: null, retangulo: null, cursor: null, dia: diaAberto, diaria, atividade: e.plano.atividades[0]?.id
    }
    const ferramentas = Object.keys(TIPOS_MARCACAO_DIARIO).filter(t => !['livre', 'item'].includes(t)).map(t => `
        <button type="button" class="diario-ferramenta" data-ferramenta="${t}" onclick="ferramentaEditorDiario('${t}')">
            ${amostraMarcacaoDiario(t)}<span>${TIPOS_MARCACAO_DIARIO[t].rotulo}</span></button>`).join('')
    e.editor.popup = popup({
        titulo: `Foto de ${dataPlanoDiario(foto.data)}`,
        elemento: `
            <div class="diario-editor">
                <div class="diario-editor-ferramentas" role="toolbar" aria-label="Marcações">
                    ${ferramentas}
                    <span class="diario-ferramenta diario-ferramenta-livre" data-ferramenta="livre">
                        <button type="button" onclick="ferramentaEditorDiario('livre')">
                            <span id="amostraLivreDiario">${amostraMarcacaoDiario('livre', e.editor.cor)}</span><span>Linha livre</span></button>
                        <input type="color" value="${e.editor.cor}" aria-label="Cor da linha livre"
                            oninput="corLivreEditorDiario(this.value)">
                    </span>
                    <span class="diario-ferramenta diario-ferramenta-item" data-ferramenta="item">
                        <button type="button" onclick="ferramentaEditorDiario('item')"><span aria-hidden="true">①</span><span>Item</span></button>
                        <select aria-label="Item do checklist a marcar" onchange="itemEditorDiario(this.value)"></select>
                    </span>
                    <span class="diario-editor-separador"></span>
                    <button type="button" class="diario-ferramenta" data-ferramenta="apagar" onclick="ferramentaEditorDiario('apagar')">
                        <span aria-hidden="true">⌫</span><span>Apagar</span></button>
                    <button type="button" class="diario-ferramenta" onclick="desfazerEditorDiario()"><span aria-hidden="true">↶</span><span>Desfazer</span></button>
                    <span class="diario-editor-zoom">
                        <button type="button" onclick="zoomEditorDiario(-25)" aria-label="Diminuir">−</button>
                        <span id="zoomEditorDiario">100%</span>
                        <button type="button" onclick="zoomEditorDiario(25)" aria-label="Aumentar">+</button>
                    </span>
                </div>
                <small id="dicaEditorDiario" class="diario-editor-dica"></small>
                <div class="diario-editor-area">
                    <div class="diario-editor-quadro" id="quadroEditorDiario">
                        <img src="${escaparAtributo(`${api}/uploads/${linkEmDiario(foto, diaAberto)}`)}" alt="" draggable="false" onload="iniciarEditorDiario(this)">
                    </div>
                </div>
                <div class="diario-editor-campos">
                    <label>Data da foto <input type="date" id="dataFotoEditorDiario" value="${escaparAtributo(foto.data)}" required></label>
                    <label>Novas marcações valem a partir de <input type="date" id="dataMarcacoesEditorDiario" value="${escaparAtributo(diaAberto)}" required></label>
                    <label class="diario-editor-comentario">Comentário
                        <textarea id="comentarioEditorDiario" rows="2" maxlength="1000" placeholder="Ex.: em azul o perfilado">${escaparAtributo(comentarioEmDiario(foto, diaAberto))}</textarea></label>
                </div>
                <small class="diario-editor-dica">${diaria ? 'A foto aparece só no relatório do dia dela.'
                    : `Comentário e marcações apagadas mudam de ${dataPlanoDiario(diaAberto)} em diante; os relatórios anteriores ficam como estavam.`}</small>
            </div>`,
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarEditorFotoDiario()' }]
    })
    opcoesItensEditorDiario()
    ferramentaEditorDiario(null)
}

// Marcador de item do checklist: cada opção mostra quantos pontos já há na imagem.
function opcoesItensEditorDiario() {
    const ed = estadoPlanoDiario.editor
    const select = document.querySelector('.diario-ferramenta-item select')
    if (!ed || !select) return
    const visiveis = ed.marcacoes.filter(m => m.tipo === 'item' && !m.ate)
    select.innerHTML = estadoPlanoDiario.plano.atividades.map((a, i) =>
        `<option value="${escaparAtributo(a.id)}" ${a.id === ed.atividade ? 'selected' : ''}>${i + 1}. ${escaparAtributo(a.descricao)} (${visiveis.filter(m => m.atividade === a.id).length}/${numeroPlanoDiario(a.previsto)})</option>`).join('')
}

function itemEditorDiario(id) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    ed.atividade = id
    if (ed.ferramenta !== 'item') ferramentaEditorDiario('item')
}

function iniciarEditorDiario(img) {
    const ed = estadoPlanoDiario.editor
    if (!ed || ed.largura) return
    ed.largura = img.naturalWidth; ed.altura = img.naturalHeight
    const quadro = document.getElementById('quadroEditorDiario')
    quadro.insertAdjacentHTML('beforeend', '<div class="diario-editor-camada"></div>')
    const camada = quadro.querySelector('.diario-editor-camada')
    const posicao = ev => {
        const r = camada.getBoundingClientRect()
        return [Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))]
    }
    camada.addEventListener('pointerdown', ev => {
        if (ev.button !== 0) return
        const [x, y] = posicao(ev)
        const forma = TIPOS_MARCACAO_DIARIO[ed.ferramenta]?.forma
        if (ed.ferramenta === 'apagar') {
            const alvo = ev.target.closest?.('[data-marcacao]')?.dataset.marcacao
            // Na planta, marcação de um dia anterior fica nos relatórios dele: só sai do dia aberto em diante.
            if (alvo) return mudarMarcacoesEditorDiario(ed.marcacoes.flatMap(m => m.id !== alvo ? [m]
                : !ed.diaria && m.data < ed.dia ? [{ ...m, ate: ed.dia }] : []))
        } else if (forma === 'ponto') {
            return adicionarMarcacaoEditorDiario(ed.ferramenta === 'item' ? { tipo: 'item', atividade: ed.atividade, x, y } : { tipo: 'camera', x, y })
        } else if (forma === 'retangulo') {
            ed.retangulo = { x1: x, y1: y, x2: x, y2: y }
            camada.setPointerCapture(ev.pointerId)
        } else if (forma === 'linha') {
            // Clique de novo no último ponto (ou duplo clique) termina a linha.
            const ultimo = ed.linha?.at(-1)
            if (ultimo && Math.hypot((x - ultimo[0]) * ed.largura, (y - ultimo[1]) * ed.altura) < ed.largura * 0.006) return concluirLinhaEditorDiario()
            ed.linha = [...(ed.linha || []), [x, y]]
        }
        desenharEditorDiario()
    })
    camada.addEventListener('pointermove', ev => {
        if (ed.retangulo) { [ed.retangulo.x2, ed.retangulo.y2] = posicao(ev); desenharEditorDiario() }
        else if (ed.linha) { ed.cursor = posicao(ev); desenharEditorDiario() }
    })
    camada.addEventListener('pointerup', () => {
        const r = ed.retangulo
        if (!r) return
        ed.retangulo = null
        if (Math.abs(r.x2 - r.x1) > 0.005 && Math.abs(r.y2 - r.y1) > 0.005) {
            return adicionarMarcacaoEditorDiario({ tipo: 'rack', ...r })
        }
        desenharEditorDiario()
    })
    camada.addEventListener('dblclick', () => concluirLinhaEditorDiario())
    ed.teclas = ev => {
        if (!document.getElementById(ed.popup)) return document.removeEventListener('keydown', ed.teclas)
        if (ev.key === 'Enter' && ed.linha && ev.target.tagName !== 'TEXTAREA') { ev.preventDefault(); concluirLinhaEditorDiario() }
        if (ev.key === 'Escape' && ed.linha) { ev.stopPropagation(); ed.linha = null; ed.cursor = null; desenharEditorDiario() }
    }
    document.addEventListener('keydown', ed.teclas)
    desenharEditorDiario()
}

function desenharEditorDiario() {
    const ed = estadoPlanoDiario.editor
    const camada = document.querySelector('#quadroEditorDiario .diario-editor-camada')
    if (!ed || !camada || !ed.largura) return
    const tipo = TIPOS_MARCACAO_DIARIO[ed.ferramenta]
    // Em andamento: a linha sendo traçada (até o cursor) e o retângulo sendo arrastado.
    const rascunho = []
    if (ed.linha) {
        const pontos = [...ed.linha, ...(ed.cursor ? [ed.cursor] : [])]
        rascunho.push({ id: 'rascunho', tipo: ed.ferramenta, cor: ed.cor, pontos: pontos.length > 1 ? pontos : [pontos[0], pontos[0]] })
    }
    if (ed.retangulo) rascunho.push({ id: 'rascunho', tipo: 'rack', ...ed.retangulo })
    camada.innerHTML = svgMarcacoesDiario([...ed.marcacoes.filter(m => !m.ate || m.ate > ed.dia), ...rascunho], ed.largura, ed.altura, { interativo: true })
    camada.classList.toggle('apagando', ed.ferramenta === 'apagar')
    camada.classList.toggle('sem-ferramenta', !ed.ferramenta)
    const dica = document.getElementById('dicaEditorDiario')
    // O marcador fica ligado para várias marcações seguidas; desliga ao clicar nele de novo.
    if (dica) dica.textContent = !ed.ferramenta ? 'Escolha uma marcação acima. Ela fica ligada até você clicar nela de novo.'
        : ed.ferramenta === 'apagar' ? 'Clique nas marcações para apagar. Clique no marcador de novo para desligar.'
        : tipo?.forma === 'ponto' ? 'Clique na imagem para marcar (quantas vezes quiser). Clique no marcador de novo para desligar.'
        : tipo?.forma === 'retangulo' ? 'Clique e arraste para desenhar o rack (quantos quiser). Clique no marcador de novo para desligar.'
        : ed.linha ? 'Clique para continuar a linha. Para terminar: duplo clique, Enter, clique no último ponto ou no botão do marcador. Esc cancela.'
        : 'Clique ponto a ponto para traçar o caminho.'
}

// Clicar no marcador ativo desliga (e conclui a linha em andamento, se tiver 2 pontos ou mais).
function ferramentaEditorDiario(ferramenta) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    if (ferramenta && ferramenta === ed.ferramenta) {
        concluirLinhaEditorDiario()
        ferramenta = null
    }
    if (ed.linha && ferramenta !== ed.ferramenta) concluirLinhaEditorDiario()
    ed.ferramenta = ferramenta
    document.querySelectorAll('.diario-editor [data-ferramenta]').forEach(b => {
        b.classList.toggle('ativa', b.dataset.ferramenta === ferramenta)
        if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', b.dataset.ferramenta === ferramenta ? 'true' : 'false')
    })
    const amostra = document.getElementById('amostraLivreDiario')
    if (amostra) amostra.innerHTML = amostraMarcacaoDiario('livre', ed.cor)
    desenharEditorDiario()
}

// Trocar a cor liga a linha livre (sem desligar, se já estiver ativa).
function corLivreEditorDiario(cor) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    ed.cor = cor
    if (ed.ferramenta !== 'livre') return ferramentaEditorDiario('livre')
    const amostra = document.getElementById('amostraLivreDiario')
    if (amostra) amostra.innerHTML = amostraMarcacaoDiario('livre', cor)
    desenharEditorDiario()
}

function adicionarMarcacaoEditorDiario(m) {
    const ed = estadoPlanoDiario.editor
    const data = document.getElementById('dataMarcacoesEditorDiario')?.value
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return popup({ mensagem: 'Informe a data a partir da qual as novas marcações valem.' })
    if (ed.marcacoes.length >= 2000) return popup({ mensagem: 'O limite é de 2.000 marcações por foto.' })
    mudarMarcacoesEditorDiario([...ed.marcacoes, { id: crypto.randomUUID(), data, ...m }])
}

function concluirLinhaEditorDiario() {
    const ed = estadoPlanoDiario.editor
    if (!ed?.linha) return
    const pontos = ed.linha.filter((p, i, a) => !i || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1])
    ed.linha = null; ed.cursor = null
    if (pontos.length >= 2)
        return adicionarMarcacaoEditorDiario({ tipo: ed.ferramenta, pontos, ...(ed.ferramenta === 'livre' ? { cor: ed.cor } : {}) })
    desenharEditorDiario()
}

function mudarMarcacoesEditorDiario(marcacoes) {
    const ed = estadoPlanoDiario.editor
    ed.desfazer.push(ed.marcacoes)
    ed.marcacoes = marcacoes
    opcoesItensEditorDiario()
    desenharEditorDiario()
}

function desfazerEditorDiario() {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    if (ed.linha) { ed.linha = ed.linha.length > 1 ? ed.linha.slice(0, -1) : null; return desenharEditorDiario() }
    if (!ed.desfazer.length) return
    ed.marcacoes = ed.desfazer.pop()
    opcoesItensEditorDiario()
    desenharEditorDiario()
}

function zoomEditorDiario(passo) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    ed.zoom = Math.max(25, Math.min(400, ed.zoom + passo))
    document.getElementById('quadroEditorDiario').style.width = `${ed.zoom}%`
    document.getElementById('zoomEditorDiario').textContent = `${ed.zoom}%`
}

async function salvarEditorFotoDiario() {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    concluirLinhaEditorDiario()
    const data = document.getElementById('dataFotoEditorDiario').value
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return popup({ mensagem: 'Informe uma data válida para a foto.' })
    const comentario = document.getElementById('comentarioEditorDiario').value
    // Só os campos de cada forma (o servidor confere tudo de novo).
    const marcacoes = ed.marcacoes.map(({ id, tipo, data, x, y, x1, y1, x2, y2, pontos, cor, ate, atividade }) =>
        ({ id, tipo, data, x, y, x1, y1, x2, y2, pontos, cor, ate, atividade }))
    await gravarGaleriaDiario({ acao: 'alterar', id: ed.id, data, comentario, marcacoes, desde: ed.dia }, 'Foto atualizada.',
        () => { removerPopup(ed.popup); estadoPlanoDiario.editor = null })
}

// aoGravar: roda logo que o servidor confirma (ex.: fechar o editor), antes de redesenhar a prévia.
async function gravarGaleriaDiario(corpo, aviso, aoGravar = null) {
    const e = estadoPlanoDiario
    const status = document.getElementById('statusPlanoDiario')
    let gravou = false
    try {
        const { galeria } = await apiPlanoDiario('fotos', { plano: e.plano.id, ...corpo })
        e.plano.galeria = galeria
        gravou = true
        aoGravar?.()
    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gravar a foto.' })
    } finally {
        desenharGaleriaPlanoDiario()
    }
    if (!gravou) return
    // Redesenhar a prévia descarta números digitados e não salvos: com pendência, só avisa.
    if (e.alterado || e.renderizando) {
        if (status) status.textContent = `${aviso} Salve o dia para vê-las na prévia.`
        return
    }
    await renderizarPlanoDiario()
    if (status && aviso) status.textContent = aviso
}

async function enviarFotosGaleriaDiario(input, secao) {
    try { await enviarArquivosGaleriaDiario([...(input.files || [])], secao, input.closest('label')) }
    finally { input.value = '' }
}

// Arrastar fotos para a seção da galeria: o quadro da seção inteiro aceita o soltar.
// preventDefault aqui faz o tratamento global de arquivos (js/ferramentas.js) não bloquear.
function arrastarFotosDiario(evento, secao) {
    if (!evento.dataTransfer?.types?.includes('Files')) return
    evento.preventDefault()
    evento.dataTransfer.dropEffect = 'copy'
    if (evento.type === 'dragenter' || evento.type === 'dragover') secao.classList.add('soltando')
}

function sairArrastarFotosDiario(evento, secao) {
    if (!secao.contains(evento.relatedTarget)) secao.classList.remove('soltando')
}

async function soltarFotosDiario(evento, secao, quadro) {
    if (!evento.dataTransfer?.types?.includes('Files')) return
    evento.preventDefault()
    quadro.classList.remove('soltando')
    const arquivos = [...evento.dataTransfer.files]
    const imagens = arquivos.filter(f => /^image\/(jpeg|png|webp)$/.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name))
    if (!imagens.length) return popup({ mensagem: 'Solte fotos em JPG, PNG ou WEBP.' })
    await enviarArquivosGaleriaDiario(imagens, secao, quadro.querySelector('.diario-galeria-adicionar'))
    const status = document.getElementById('statusPlanoDiario')
    if (imagens.length < arquivos.length && status)
        status.textContent = `${status.textContent} ${arquivos.length - imagens.length} arquivo(s) que não eram JPG, PNG ou WEBP ficaram de fora.`.trim()
}

// Envia os arquivos (do botão ou arrastados) e inclui na galeria, de 30 em 30 (limite da rota).
async function enviarArquivosGaleriaDiario(arquivos, secao, rotulo) {
    const e = estadoPlanoDiario
    if (!arquivos.length || !e.plano) return
    const status = document.getElementById('statusPlanoDiario')
    rotulo?.classList.add('enviando')
    status.textContent = 'Enviando fotos...'
    try {
        // Data inicial: o dia aberto (na Origem, hoje); dá para trocar em cada foto depois.
        const data = e.origem ? dataServidor().toLocaleDateString('en-CA') : e.data
        for (let i = 0; i < arquivos.length; i += 30) {
            const enviadas = await importarAnexos({ input: { files: arquivos.slice(i, i + 30) } })
            // Em falha o importarAnexos já mostrou o aviso.
            if (!Array.isArray(enviadas) || !enviadas.length) { status.textContent = ''; return }
            await gravarGaleriaDiario({ acao: 'incluir', secao, data,
                fotos: enviadas.filter(a => a?.link).map(a => ({ link: a.link, nome: a.nome || '' })) },
                `Fotos gravadas com data de ${dataPlanoDiario(data)}. ${secaoDiariaDiario(secao) ? 'Elas aparecem na prévia e no Word/PDF desse dia.' : 'Elas aparecem na prévia e no Word/PDF desse dia em diante.'}`)
        }
    } catch (err) {
        status.textContent = ''
        popup({ mensagem: err.message || 'Falha ao enviar as fotos.' })
    } finally {
        rotulo?.classList.remove('enviando')
    }
}

async function removerFotoGaleriaDiario(id) {
    const foto = (estadoPlanoDiario.plano?.galeria || []).find(f => f.id === id)
    if (!foto) return
    const dia = diaAbertoDiario()
    const daquiEmDiante = !secaoDiariaDiario(foto.secao) && foto.data < dia
    const mensagem = daquiEmDiante
        ? `Retirar esta imagem de ${dataPlanoDiario(dia)} em diante? Ela continua nos relatórios de ${dataPlanoDiario(foto.data)} até a véspera.`
        : `Apagar esta foto? Ela sai do relatório de ${dataPlanoDiario(foto.data)} e não volta. Para montar outro dia não é preciso apagar: basta abrir a data dele.`
    if (!(await confirmarPopup({ mensagem, textoConfirmar: daquiEmDiante ? 'Retirar' : 'Apagar foto' }))) return
    await gravarGaleriaDiario({ acao: 'remover', id, desde: dia }, daquiEmDiante ? 'Imagem retirada.' : 'Foto removida.')
}

function atualizarNumerosPlanoDiario() {
    const e = estadoPlanoDiario
    if (!e.documento || !e.linhas) return
    const dados = lerPlanoDiario()
    const itens = e.linhas.map(a => {
        const acumulado = Math.round((Number(a.inicial || 0) + (e.origem ? [] : e.dias).filter(d => d.data_ref < e.data)
            .reduce((s, d) => s + Number(d.dados.executado[a.id] || 0), 0) + dados.executado[a.id]) * 1000) / 1000
        const percentual = a.previsto > 0 ? acumulado / a.previsto * 100 : 0
        textoCelulaDiario(a.linha.cells[4], numeroPlanoDiario(acumulado))
        textoCelulaDiario(a.linha.cells[6], `${numeroPlanoDiario(percentual)}%`)
        return { ...a, percentual }
    })
    if (e.alterado && e.grafico) {
        const svgAtividades = itens => {
            const altura = 65 + itens.length * 49
            return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="${altura}" viewBox="0 0 1100 ${altura}"><rect width="1100" height="${altura}" fill="white"/>
            ${itens.map((a, i) => `<text x="20" y="${67 + i * 49}" font-family="Arial" font-size="15">${escaparAtributo(a.descricao)}</text><rect x="510" y="${49 + i * 49}" width="480" height="24" rx="4" fill="#e6eee9"/><rect x="510" y="${49 + i * 49}" width="${Math.max(0, Math.min(100, a.percentual)) * 4.8}" height="24" rx="4" fill="#269368"/><text x="1000" y="${67 + i * 49}" font-family="Arial" font-size="16">${numeroPlanoDiario(a.percentual)}%</text>`).join('')}</svg>`
        }
        const grupos = e.graficos || [e.grafico]
        const tamanho = e.graficos ? e.modelo.itensPorGrafico : itens.length
        const curtos = !e.graficos ? itens : itens.map((a, i) => {
            const t = `${i + 1}. ${a.descricao}`
            return { ...a, descricao: t.length > 46 ? `${t.slice(0, 45)}…` : t }
        })
        grupos.forEach((img, i) => {
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgAtividades(curtos.slice(i * tamanho, (i + 1) * tamanho)))}`
        })
        if (e.graficoResumo) {
            // Itens do resumo vêm do modelo da obra (ex.: Picus usa outros ids que o iMile).
            const resumo = (e.modelo?.destaques || []).filter(d => itens.some(a => a.id === d.id))
                .map(({ id, rotulo }) => ({ ...itens.find(a => a.id === id), descricao: rotulo }))
            e.graficoResumo.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgAtividades(resumo))}`
        }
        if (e.graficoGeral) {
            const validos = itens.filter(a => Number(a.previsto) > 0 && Number.isFinite(a.percentual))
            const geral = validos.length ? validos.reduce((s, a) => s + Math.max(0, Math.min(100, a.percentual)), 0) / validos.length : 0
            const svgGeral = `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="310" viewBox="0 0 1100 310"><rect width="1100" height="310" fill="white"/><circle cx="170" cy="155" r="100" fill="none" stroke="#e6eee9" stroke-width="30"/><circle cx="170" cy="155" r="100" fill="none" stroke="#269368" stroke-width="30" stroke-dasharray="${geral * Math.PI * 2} ${200 * Math.PI}" transform="rotate(-90 170 155)"/><text x="350" y="90" font-family="Arial" font-size="28" fill="#193c32">Andamento geral</text><text x="350" y="155" font-family="Arial" font-size="52" fill="#269368">${numeroPlanoDiario(geral)}%</text><text x="350" y="200" font-family="Arial" font-size="20" fill="#52685b">Média dos percentuais das atividades</text><text x="350" y="240" font-family="Arial" font-size="20" fill="#52685b">Restante: ${numeroPlanoDiario(100 - geral)}%</text></svg>`
            e.graficoGeral.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgGeral)}`
        }
    }
    controlesDocumentoDiario()
}

async function salvarPlanoDiario() {
    const e = estadoPlanoDiario
    if (e.carregando || e.renderizando || !e.documento) return
    for (const input of e.documento.querySelectorAll('input')) if (!input.reportValidity()) return
    e.carregando = true; controlesDocumentoDiario()
    try {
        await apiPlanoDiario('salvar', { plano: e.plano.id, data: e.data, origem: e.origem, versaoPlano: e.plano.versao,
            versao: e.dias.find(d => d.data_ref === e.data)?.versao || 0, dados: lerPlanoDiario() })
        Object.assign(e, await apiPlanoDiario('detalhe', { plano: e.plano.id }), { alterado: false })
        await renderizarPlanoDiario()
        document.getElementById('statusPlanoDiario').textContent = 'Salvo.'
    } catch (err) { popup({ mensagem: err.message }) }
    finally { e.carregando = false; controlesDocumentoDiario() }
}

async function baixarWordPlanoDiario(formato = 'word') {
    const e = estadoPlanoDiario
    if (e.alterado || e.carregando || e.renderizando) return
    e.carregando = true; controlesDocumentoDiario()
    try {
        const blob = await apiPlanoDiario(formato, { plano: e.plano.id, data: e.data, origem: e.origem }, true)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url; link.download = `Diario-${e.origem ? 'Origem' : e.data}.${formato === 'pdf' ? 'pdf' : 'docx'}`; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 10000)
    } catch (err) { popup({ mensagem: err.message }) }
    finally { e.carregando = false; controlesDocumentoDiario() }
}

async function excluirDiaPlanoDiario() {
    const e = estadoPlanoDiario
    const dia = e.dias.find(d => d.data_ref === e.data)
    if (e.carregando || e.renderizando || e.origem || !dia) return
    if (!(await confirmarPopup({ titulo: 'Excluir checklist do dia', mensagem: `Excluir o checklist de ${dataPlanoDiario(e.data)}? Os acumulados dos dias seguintes serão recalculados.`, textoConfirmar: 'Excluir' }))) return
    e.carregando = true; controlesDocumentoDiario()
    try {
        await apiPlanoDiario('excluir', { plano: e.plano.id, data: e.data, versao: dia.versao })
        Object.assign(e, await apiPlanoDiario('detalhe', { plano: e.plano.id }), { alterado: false })
        await renderizarPlanoDiario()
        document.getElementById('statusPlanoDiario').textContent = 'Dia excluído.'
    } catch (err) { popup({ mensagem: err.message }) }
    finally { e.carregando = false; controlesDocumentoDiario() }
}
