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
        const { planos } = await apiPlanoDiario('lista')
        tela.innerHTML = `<div class="planos-diarios">
            <header class="diario-cabecalho"><label>Escolha o plano:
                <select id="planoDiarioEscolha" onchange="abrirPlanoDiario(this.value)"><option value="">Selecione</option>
                ${planos.map(p => `<option value="${escaparAtributo(p.id)}">${escaparAtributo(p.titulo)}</option>`).join('')}</select></label>
                <div class="diario-acoes"><button id="botaoSalvarPlanoDiario" onclick="salvarPlanoDiario()" disabled>Salvar</button>
                <button id="baixarPlanoDiario" onclick="baixarWordPlanoDiario()" disabled>Baixar Word</button>
                <button id="baixarPdfPlanoDiario" onclick="baixarWordPlanoDiario('pdf')" disabled>Baixar PDF</button>
                <button id="excluirPlanoDiario" onclick="excluirDiaPlanoDiario()" hidden>Excluir dia</button></div>
            </header><div id="diasPlanoDiario" class="diario-dias"></div>
            <div id="statusPlanoDiario" class="diario-status" role="status" aria-live="polite"></div>
            <div id="planoDiarioConteudo"></div>
            <section id="galeriaPlanoDiario" class="diario-galeria" aria-label="Fotos das seções" hidden></section></div>`
        if (planos.length === 1) {
            document.getElementById('planoDiarioEscolha').value = planos[0].id
            await abrirPlanoDiario(planos[0].id)
        }
    } catch (e) { popup({ mensagem: e.message }) }
}

async function abrirPlanoDiario(id) {
    if (estadoPlanoDiario.carregando || estadoPlanoDiario.renderizando) return
    if (estadoPlanoDiario.alterado && !(await confirmarPopup({ mensagem: 'Há alterações sem salvar. Deseja descartá-las?', textoConfirmar: 'Descartar alterações' }))) {
        document.getElementById('planoDiarioEscolha').value = estadoPlanoDiario.plano?.id || ''
        return
    }
    if (!id) {
        estadoPlanoDiario.plano = null; estadoPlanoDiario.alterado = false
        document.getElementById('planoDiarioConteudo').replaceChildren()
        document.getElementById('diasPlanoDiario').replaceChildren()
        desenharGaleriaPlanoDiario()
        controlesDocumentoDiario(); return
    }
    try {
        const dados = await apiPlanoDiario('detalhe', { plano: id })
        Object.assign(estadoPlanoDiario, dados, { alterado: false })
        estadoPlanoDiario.origem = true
        estadoPlanoDiario.data = dados.plano.inicio
        await renderizarPlanoDiario()
    } catch (e) { popup({ mensagem: e.message }) }
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
    const pdf = document.getElementById('baixarPdfPlanoDiario')
    if (pdf) pdf.disabled = baixar?.disabled ?? true
    const seletor = document.getElementById('planoDiarioEscolha')
    if (seletor) seletor.disabled = ocupado
    e.documento?.querySelectorAll('input').forEach(el => { el.disabled = ocupado; el.readOnly = e.origem && el.type !== 'date' })
    document.querySelectorAll('#diasPlanoDiario button').forEach(el => { el.disabled = ocupado })
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
    document.getElementById('diasPlanoDiario').innerHTML = `<button type="button" class="diario-dia diario-origem ${e.origem ? 'selecionado' : ''}" onclick="selecionarDataPlanoDiario('${e.plano.inicio}', true)">Origem</button>`
        + e.dias.slice().sort((a, b) => a.data_ref.localeCompare(b.data_ref)).map(d =>
        `<button type="button" class="diario-dia ${!e.origem && d.data_ref === e.data ? 'selecionado' : ''}" onclick="selecionarDataPlanoDiario('${d.data_ref}')"><span aria-label="Preenchido">✓</span> ${dataPlanoDiario(d.data_ref)}</button>`).join('')
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
        input.required = true
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
    data.addEventListener('change', () => selecionarDataPlanoDiario(data.value))
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
// do dia. A prévia e o Word/PDF de um dia levam as fotos até aquela data (acumulado), no fim de cada
// seção, com as marcações de data até o dia. Data, comentário e marcações mudam só pelo editor da foto.

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
    livre: { rotulo: 'Linha livre', cor: null, tracejado: false, forma: 'linha' }
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
        if (tipo.forma === 'ponto') {
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
    if (!foto?.marcacoes?.length || !img.naturalWidth) return
    local.insertAdjacentHTML('beforeend', svgMarcacoesDiario(foto.marcacoes, img.naturalWidth, img.naturalHeight))
}

function desenharGaleriaPlanoDiario() {
    const e = estadoPlanoDiario
    const area = document.getElementById('galeriaPlanoDiario')
    if (!area) return
    const secoes = e.modelo?.secoes || []
    area.hidden = !e.plano || !secoes.length
    if (area.hidden) return area.replaceChildren()

    const galeria = e.plano.galeria || []
    const dia = e.origem ? null : e.data
    area.innerHTML = secoes.map(({ secao, titulo }) => {
        const fotos = galeria.filter(f => f.secao === secao)
            .sort((a, b) => b.data.localeCompare(a.data) || String(b.criado_em).localeCompare(String(a.criado_em)))
        const doDia = dia ? fotos.filter(f => f.data <= dia).length : 0
        const resumo = `${fotos.length} ${fotos.length === 1 ? 'foto' : 'fotos'}`
            + (dia ? ` · ${doDia} no relatório de ${dataPlanoDiario(dia)}` : '')
        return `
            <div class="diario-galeria-secao" ondragenter="arrastarFotosDiario(event, this)" ondragover="arrastarFotosDiario(event, this)"
                ondragleave="sairArrastarFotosDiario(event, this)" ondrop="soltarFotosDiario(event, '${secao}', this)">
                <div class="diario-galeria-topo">
                    <div><h3>${secao} · ${escaparAtributo(titulo)}</h3><small>${resumo} · clique numa foto para marcar e comentar · arraste fotos para cá</small></div>
                    <label class="diario-galeria-adicionar">Adicionar fotos
                        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
                            onchange="enviarFotosGaleriaDiario(this, '${secao}')">
                    </label>
                </div>
                <div class="diario-galeria-grade">
                    ${fotos.length ? fotos.map(f => {
                        const qtde = (f.marcacoes || []).length
                        // Foto com data depois do documento aberto (a Origem é o dia de início) não entra
                        // nele: avisa no cartão, para não parecer que sumiu.
                        const referencia = e.origem ? e.plano.inicio : e.data
                        const fora = f.data > referencia ? `Entra no relatório a partir de ${dataPlanoDiario(f.data)}` : ''
                        return `
                        <figure class="diario-galeria-foto${dia && f.data <= dia ? ' no-dia' : ''}">
                            <button type="button" class="diario-galeria-abrir" onclick="abrirEditorFotoDiario('${escaparAtributo(f.id)}')"
                                title="Abrir para marcar e comentar">
                                <span class="diario-galeria-imagem">
                                    <img src="${escaparAtributo(`${api}/uploads/${f.link}`)}" alt="${escaparAtributo(f.comentario || f.nome || 'Foto')}"
                                        loading="lazy" data-foto="${escaparAtributo(f.id)}" onload="miniaturaFotoDiario(this)">
                                </span>
                                <span class="diario-galeria-dados">
                                    <b>${dataPlanoDiario(f.data)}</b>
                                    ${qtde ? `<small>${qtde} ${qtde === 1 ? 'marcação' : 'marcações'}</small>` : ''}
                                </span>
                                ${fora ? `<span class="diario-galeria-fora">${fora}</span>` : ''}
                                ${f.comentario ? `<span class="diario-galeria-comentario">${escaparAtributo(f.comentario)}</span>` : ''}
                            </button>
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
    const diaAberto = e.origem ? e.plano.inicio : e.data
    e.editor = {
        id, ferramenta: 'camera', cor: '#7c3aed', zoom: 100, largura: 0, altura: 0,
        marcacoes: (foto.marcacoes || []).map(m => ({ ...m, pontos: m.pontos?.map(p => [...p]) })),
        desfazer: [], linha: null, retangulo: null, cursor: null
    }
    const ferramentas = Object.keys(TIPOS_MARCACAO_DIARIO).filter(t => t !== 'livre').map(t => `
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
                            oninput="estadoPlanoDiario.editor.cor = this.value; ferramentaEditorDiario('livre')">
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
                        <img src="${escaparAtributo(`${api}/uploads/${foto.link}`)}" alt="" draggable="false" onload="iniciarEditorDiario(this)">
                    </div>
                </div>
                <div class="diario-editor-campos">
                    <label>Data da foto <input type="date" id="dataFotoEditorDiario" value="${escaparAtributo(foto.data)}" required></label>
                    <label>Novas marcações valem a partir de <input type="date" id="dataMarcacoesEditorDiario" value="${escaparAtributo(diaAberto)}" required></label>
                    <label class="diario-editor-comentario">Comentário
                        <textarea id="comentarioEditorDiario" rows="2" maxlength="1000" placeholder="Ex.: em azul o perfilado">${escaparAtributo(foto.comentario || '')}</textarea></label>
                </div>
                <small class="diario-editor-dica">O relatório de cada dia mostra as marcações com data até ele.</small>
            </div>`,
        botoes: [{ texto: 'Salvar', img: 'concluido', funcao: 'salvarEditorFotoDiario()' }]
    })
    ferramentaEditorDiario('camera')
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
            if (alvo) mudarMarcacoesEditorDiario(ed.marcacoes.filter(m => m.id !== alvo))
        } else if (forma === 'ponto') {
            adicionarMarcacaoEditorDiario({ tipo: 'camera', x, y })
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
        if (Math.abs(r.x2 - r.x1) > 0.005 && Math.abs(r.y2 - r.y1) > 0.005) adicionarMarcacaoEditorDiario({ tipo: 'rack', ...r })
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
    camada.innerHTML = svgMarcacoesDiario([...ed.marcacoes, ...rascunho], ed.largura, ed.altura, { interativo: true })
    camada.classList.toggle('apagando', ed.ferramenta === 'apagar')
    const dica = document.getElementById('dicaEditorDiario')
    if (dica) dica.textContent = ed.ferramenta === 'apagar' ? 'Clique numa marcação para apagar.'
        : tipo?.forma === 'ponto' ? 'Clique na imagem para marcar.'
        : tipo?.forma === 'retangulo' ? 'Clique e arraste para desenhar o rack.'
        : ed.linha ? 'Clique para continuar a linha. Duplo clique, Enter ou clique no último ponto termina; Esc cancela.'
        : 'Clique ponto a ponto para traçar o caminho.'
}

function ferramentaEditorDiario(ferramenta) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
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
    if (pontos.length >= 2) adicionarMarcacaoEditorDiario({ tipo: ed.ferramenta, pontos, ...(ed.ferramenta === 'livre' ? { cor: ed.cor } : {}) })
    desenharEditorDiario()
}

function mudarMarcacoesEditorDiario(marcacoes) {
    const ed = estadoPlanoDiario.editor
    ed.desfazer.push(ed.marcacoes)
    ed.marcacoes = marcacoes
    desenharEditorDiario()
}

function desfazerEditorDiario() {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    if (ed.linha) { ed.linha = ed.linha.length > 1 ? ed.linha.slice(0, -1) : null; return desenharEditorDiario() }
    if (!ed.desfazer.length) return
    ed.marcacoes = ed.desfazer.pop()
    desenharEditorDiario()
}

function zoomEditorDiario(passo) {
    const ed = estadoPlanoDiario.editor
    if (!ed) return
    ed.zoom = Math.max(50, Math.min(400, ed.zoom + passo))
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
    const marcacoes = ed.marcacoes.map(({ id, tipo, data, x, y, x1, y1, x2, y2, pontos, cor }) =>
        ({ id, tipo, data, x, y, x1, y1, x2, y2, pontos, cor }))
    await gravarGaleriaDiario({ acao: 'alterar', id: ed.id, data, comentario, marcacoes }, 'Foto atualizada.',
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
                `Fotos gravadas com data de ${dataPlanoDiario(data)}. Elas aparecem na prévia e no Word/PDF desse dia em diante.`)
        }
    } catch (err) {
        status.textContent = ''
        popup({ mensagem: err.message || 'Falha ao enviar as fotos.' })
    } finally {
        rotulo?.classList.remove('enviando')
    }
}

async function removerFotoGaleriaDiario(id) {
    if (!(await confirmarPopup({ mensagem: 'Remover esta foto da galeria? Ela sai de todos os relatórios.', textoConfirmar: 'Remover foto' })))
        return
    await gravarGaleriaDiario({ acao: 'remover', id }, 'Foto removida.')
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
        e.grafico.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgAtividades(itens))}`
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
