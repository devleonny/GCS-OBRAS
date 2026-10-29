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
                <button id="marcarPlantasDiario" onclick="alternarMarcacaoPlanoDiario()" aria-pressed="false" disabled>Marcar plantas</button>
                <button id="baixarPlanoDiario" onclick="baixarWordPlanoDiario()" disabled>Baixar Word</button>
                <button id="baixarPdfPlanoDiario" onclick="baixarWordPlanoDiario('pdf')" disabled>Baixar PDF</button>
                <button id="excluirPlanoDiario" onclick="excluirDiaPlanoDiario()" hidden>Excluir dia</button></div>
            </header><div id="diasPlanoDiario" class="diario-dias"></div>
            <div id="statusPlanoDiario" class="diario-status" role="status" aria-live="polite"></div>
            <div id="planoDiarioConteudo"></div></div>`
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
    const marcar = document.getElementById('marcarPlantasDiario')
    if (marcar) {
        marcar.disabled = ocupado || !e.documento
        marcar.setAttribute('aria-pressed', e.modoMarcar ? 'true' : 'false')
    }
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
    e.plantas?.forEach(({ imagem, camada }) => {
        imagem.style.cursor = e.modoMarcar && !ocupado ? 'crosshair' : ''
        camada.querySelectorAll('button').forEach(b => { b.disabled = ocupado || !e.modoMarcar; b.style.pointerEvents = b.disabled ? 'none' : 'auto' })
    })
}

async function renderizarPlanoDiario() {
    const e = estadoPlanoDiario
    const sequencia = ++e.sequencia
    e.observador?.disconnect()
    e.modoMarcar = false; e.plantas = []
    e.renderizando = true; e.documento = null
    controlesDocumentoDiario()
    const local = document.getElementById('planoDiarioConteudo')
    local.innerHTML = '<div class="diario-carregando"><img src="gifs/loading.gif" alt="Carregando"></div>'
    document.getElementById('diasPlanoDiario').innerHTML = `<button type="button" class="diario-dia diario-origem ${e.origem ? 'selecionado' : ''}" onclick="selecionarDataPlanoDiario('${e.plano.inicio}', true)">Origem</button>`
        + e.dias.slice().sort((a, b) => a.data_ref.localeCompare(b.data_ref)).map(d =>
        `<button type="button" class="diario-dia ${!e.origem && d.data_ref === e.data ? 'selecionado' : ''}" onclick="selecionarDataPlanoDiario('${d.data_ref}')"><span aria-label="Preenchido">✓</span> ${dataPlanoDiario(d.data_ref)}</button>`).join('')
    try {
        const [arquivo] = await Promise.all([apiPlanoDiario('visualizar', { plano: e.plano.id, data: e.data, origem: e.origem, semMarcacoes: true }, true), carregarBibliotecasDiario()])
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
        prepararMarcacoesPlanoDiario(doc)
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
    e.graficoResumo = [...doc.images].at(-3)
    e.grafico = [...doc.images].at(-2)
    e.graficoGeral = [...doc.images].at(-1)
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
        observacoes: e.dias.find(d => d.data_ref === e.data)?.dados?.observacoes || '',
        marcacoes: e.marcacoes || []
    }
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
            const resumo = [['10', 'Eletrocalha'], ['8', 'Cabo'], ['7', 'Instalação Câmeras']]
                .map(([id, descricao]) => ({ ...itens.find(a => a.id === id), descricao }))
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

function prepararMarcacoesPlanoDiario(doc) {
    const e = estadoPlanoDiario
    const ultimo = e.origem ? null : e.dias.filter(d => d.data_ref <= e.data && Array.isArray(d.dados?.marcacoes))
        .sort((a, b) => b.data_ref.localeCompare(a.data_ref))[0]
    e.marcacoes = (ultimo?.dados.marcacoes ?? e.plano.marcacoesOrigem ?? []).map(m => ({ ...m }))
    const imagens = [...doc.images]
    e.plantas = ['image2.png', 'image3.png', 'image4.png'].map((nome, i) => {
        const imagem = imagens[i + 1]
        const largura = imagem.getBoundingClientRect().width
        const camada = doc.createElement('span')
        camada.style.cssText = `display:inline-block;position:relative;vertical-align:top;width:${largura}px;max-width:100%;`
        imagem.parentNode.insertBefore(camada, imagem)
        camada.append(imagem)
        imagem.style.width = '100%'; imagem.style.display = 'block'
        imagem.draggable = false
        imagem.addEventListener('click', ev => {
            if (!e.modoMarcar || e.carregando || e.renderizando) return
            if (e.marcacoes.length >= 2000) return popup({ mensagem: 'O limite é de 2.000 marcações por registro.' })
            const r = imagem.getBoundingClientRect()
            e.marcacoes.push({ id: crypto.randomUUID(), imagem: nome,
                x: Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)),
                y: Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)) })
            e.alterado = true; desenharMarcacoesPlanoDiario(); controlesDocumentoDiario()
        })
        return { nome, imagem, camada }
    })
    desenharMarcacoesPlanoDiario()
}

function desenharMarcacoesPlanoDiario() {
    const e = estadoPlanoDiario
    for (const { nome, camada } of e.plantas || []) {
        camada.querySelectorAll('button').forEach(b => b.remove())
        for (const m of e.marcacoes.filter(m => m.imagem === nome)) {
            const bolinha = camada.ownerDocument.createElement('button')
            bolinha.type = 'button'; bolinha.title = 'Remover marcação'; bolinha.setAttribute('aria-label', 'Remover marcação')
            bolinha.style.cssText = `position:absolute;left:${m.x * 100}%;top:${m.y * 100}%;width:1.4%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:#35d000;border:1px solid #168b00;padding:0;margin:0;cursor:pointer;box-sizing:border-box;`
            bolinha.addEventListener('click', ev => {
                ev.stopPropagation()
                if (!e.modoMarcar || e.carregando || e.renderizando) return
                e.marcacoes = e.marcacoes.filter(p => p.id !== m.id)
                e.alterado = true; desenharMarcacoesPlanoDiario(); controlesDocumentoDiario()
            })
            camada.append(bolinha)
        }
    }
    controlesDocumentoDiario()
}

function alternarMarcacaoPlanoDiario() {
    const e = estadoPlanoDiario
    if (e.carregando || e.renderizando || !e.documento) return
    e.modoMarcar = !e.modoMarcar
    controlesDocumentoDiario()
}
