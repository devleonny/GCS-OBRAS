let filtroRelatorio = {}
let datas = { de: '', ate: '' }
let apps = []
let appName = ''
let dadosFiltrados = null
let dados_relatorio = {}

async function atualizarRelatorioOmie() {
    overlayAguarde()
    const nuvem = await baixarRelatorio()
    await inserirDados(nuvem, 'dados_relatorio')
    await telaRelatorioOmie()
    removerOverlay()
}

const imgSt = (status) => {
    const imagens = {
        'A VENCER': 'congelado',
        'RECEBIDO': 'aprovado',
        'CANCELADO': 'reprovado',
        'VENCE HOJE': 'pendente'
    }
    return imagens?.[status] || 'reprovado'
}

async function telaRelatorioOmie() {
    overlayAguarde()

    const colunas = ['categoria', 'nNota', 'total', 'parcelas', 'cliente']
    const ths = colunas.map(coluna => `<th>${coluna}</th>`).join('')
    const thsPesquisa = colunas.map(coluna => `
        <th style="text-align:start;background-color:white;"
            contentEditable="true"
            onkeydown="if(event.key==='Enter'){event.preventDefault();renderizarPaginaRelatorioOmie('${coluna}',this.textContent.trim())}">
        </th>
    `).join('')

    const acumulado = `
        <div class="fundo-relatorio">
            <div style="${vertical}; gap: 2px; width: 200px;">
                <span id="atualizado" style="color: white; margin-top: 1vw;"></span>
                <div class="resumoValores" onclick="resetar()">
                    <div class="bloco">
                        <img src="imagens/limpar.png">
                        <span>Limpar Campos</span>
                    </div>
                </div>
                <div id="resumoValores" class="resumoValores"></div>
            </div>

            <div style="${vertical}; width: 80%;">
                
                <div class="borda-tabela">
                    <div class="topo-tabela">
                        <div id="paginacao"></div>
                        <div id="toolbarApps"></div>
                    </div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead>
                                <tr>${ths}</tr>
                                <tr>${thsPesquisa}</tr>
                            </thead>
                            <tbody id="bodyRelatorio"></tbody>
                        </table>
                    </div>
                    <div class="rodape-tabela"></div>
                </div>
            </div>
        </div>`

    const bodyRelatorio = document.getElementById('bodyRelatorio')
    if (!bodyRelatorio) tela.innerHTML = acumulado

    dados_relatorio = await recuperarDados('dados_relatorio') || {}

    // cria toolbar com apps únicos
    criarToolbarApps()

    renderizarPaginaRelatorioOmie()
    criarMenus('relatorio')
    removerOverlay()
}

function resetar() {
    filtroRelatorio = {}
    dadosFiltrados = dados_relatorio
    renderizarPaginaRelatorioOmie()
}

function criarToolbarApps() {
    const toolbar = document.getElementById('toolbarApps')
    if (!toolbar) return

    // pega todos os apps únicos
    const appsUnicos = [...new Set(Object.values(dados_relatorio).map(d => d.app))].filter(Boolean)
    apps = appsUnicos

    // gera botões (com “Todos” no início)
    toolbar.innerHTML = `
        <button onclick="filtrarApp('')" class="btnApp">TODOS</button>
        ${appsUnicos.map(app => `
            <button onclick="filtrarApp('${app}')" class="btnApp">${app}</button>
        `).join('')}
    `
}

function filtrarApp(appSelecionado) {
    // remove classe 'ativo' e destaca botão clicado
    document.querySelectorAll('.btnApp').forEach(btn => btn.classList.remove('ativo'))
    const botao = [...document.querySelectorAll('.btnApp')].find(b => b.textContent === appSelecionado || (appSelecionado === '' && b.classList.contains('todos')))
    if (botao) botao.classList.add('ativo')

    // define filtro de app (ou limpa se for "Todos")
    if (!appSelecionado) delete filtroRelatorio.app
    else filtroRelatorio.app = appSelecionado.toLowerCase()

    paginaAtual = 1
    renderizarPaginaRelatorioOmie()
}

function renderizarPaginaRelatorioOmie(chave, pesquisa) {

    if (!dadosFiltrados || chave && pesquisa == undefined) {
        dadosFiltrados = Object.entries(dados_relatorio)
        filtroRelatorio = {}
    }

    if (chave && pesquisa !== undefined) {
        if (pesquisa.trim() === '') delete filtroRelatorio[chave]
        else filtroRelatorio[chave] = pesquisa.toLowerCase()
        paginaAtual = 1
    }

    let filtrados = Object.entries(dados_relatorio)

    if (Object.keys(filtroRelatorio).length > 0) {
        filtrados = filtrados.filter(([_, dados]) =>
            Object.entries(filtroRelatorio).every(([coluna, valor]) => {
                if (coluna === 'parcelas') {
                    // busca dentro da lista de parcelas pelo status (em maiúsculas)
                    return (dados.parcelas || []).some(p =>
                        String(p.status || '').toUpperCase().includes(valor.toUpperCase())
                    )
                } else {
                    return String(dados[coluna] || '').toLowerCase().includes(valor)
                }
            })
        )
    }

    dadosFiltrados = filtrados

    const inicio = (paginaAtual - 1) * limitePorPagina
    const fim = inicio + limitePorPagina

    const body = document.getElementById('bodyRelatorio')
    if (!body) return

    body.innerHTML = ''
    const pagina = dadosFiltrados.slice(inicio, fim)
    for (const [codOmie, dados] of pagina) criarLinhaRelatorio(codOmie, dados)

    atualizarPaginacao()
    atualizarResumo()
}


function atualizarPaginacao() {
    const totalPaginas = Math.ceil(dadosFiltrados.length / limitePorPagina)
    const topo = document.getElementById('paginacao')
    if (!topo) return

    topo.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:5px;">
            <button onclick="mudarPagina(-1)" ${paginaAtual === 1 ? 'disabled' : ''}><</button>
            <span>Página ${paginaAtual} / ${totalPaginas}</span>
            <button onclick="mudarPagina(1)" ${paginaAtual === totalPaginas ? 'disabled' : ''}>></button>
        </div>
    `
}

function mudarPagina(delta) {
    const totalPaginas = Math.ceil(dadosFiltrados.length / limitePorPagina)
    paginaAtual += delta
    if (paginaAtual < 1) paginaAtual = 1
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas
    renderizarPaginaRelatorioOmie()
}

function criarLinhaRelatorio(codOmie, dados) {
    function parcelas(listaParcelas) {
        if (!listaParcelas?.length) return 'Não Localizado'
        return listaParcelas.map(parcela => `
            <div class="blocoParcela">
                <div style="${vertical}">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <img src="imagens/${imgSt(parcela.status)}.png" style="width: 1.5rem;">
                        <label name="status">${parcela.status}</label>
                    </div>
                    <label style="text-align: left;">${parcela.nomeConta}</label>
                </div>
                <div class="blocoValores">
                    <label name="valorStatus">${dinheiro(parcela.valor)}</label>
                    <label name="vencimento" style="white-space: nowrap;">venc. <strong>${parcela.vencimento}</strong></label>
                </div>
            </div>
        `).join('')
    }

    const tds = `
        <td name="categoria">${dados.categoria}</td>
        <td>${balaoPDF({ nf: dados.nota, codOmie: dados.codOmie, tipo: dados.categoria })}</td>
        <td style="white-space: nowrap;">${dinheiro(dados.total)}</td>
        <td><div style="${vertical}; gap: 1px;">${parcelas(dados?.parcelas)}</div></td>
        <td>
            <div style="display: flex; flex-direction: column; justify-content: start;">
                <label>${dados.cliente}</label>
                <label><strong>${dados.cnpj}</strong></label>
            </div>
        </td>
    `

    const trExistente = document.getElementById(codOmie)
    if (trExistente) return trExistente.innerHTML = tds
    document.getElementById('bodyRelatorio').insertAdjacentHTML('beforeend', `<tr id="${codOmie}">${tds}</tr>`)
}

function atualizarResumo() {
    const divResumo = document.getElementById('resumoValores')
    if (!divResumo) return

    const base = dadosFiltrados?.length ? dadosFiltrados : Object.entries(dados_relatorio)
    if (!base.length) {
        divResumo.innerHTML = ''
        return
    }

    const totaisPorStatus = {}
    const totaisPorCategoria = {}
    let totalGeral = 0
    const filtroStatus = filtroRelatorio.parcelas ? filtroRelatorio.parcelas.toUpperCase() : null

    for (const [_, dados] of base) {
        const parcelas = dados.parcelas || []
        let valorNota = 0

        for (const p of parcelas) {
            const status = (p.status || 'Sem status').toUpperCase()
            const valor = parseFloat(p.valor) || 0
            if (filtroStatus && status !== filtroStatus) continue

            totaisPorStatus[status] = (totaisPorStatus[status] || 0) + valor
            valorNota += valor
        }

        if (valorNota > 0 || !filtroStatus) {
            totalGeral += valorNota > 0 ? valorNota : (parseFloat(dados.total) || 0)
            const cat = dados.categoria || 'Sem categoria'
            totaisPorCategoria[cat] = (totaisPorCategoria[cat] || 0) + (valorNota > 0 ? valorNota : (parseFloat(dados.total) || 0))
        }
    }

    divResumo.querySelectorAll('.valor').forEach(v => v.textContent = dinheiro(0))
    divResumo.querySelectorAll('.bloco').forEach(v => v.style.opacity = 0.5)

    // Total geral
    let blocoTotal = divResumo.querySelector('.bloco[data-tipo="geral"]')
    if (!blocoTotal) {
        blocoTotal = document.createElement('div')
        blocoTotal.className = 'bloco'
        blocoTotal.dataset.tipo = 'geral'
        blocoTotal.innerHTML = `
            <div style="${vertical}">
                <span style="font-size: 0.7rem;">Total geral</span> 
                <span class="valor" style="font-size: 0.9rem;">${dinheiro(totalGeral)}</span>
            </div>
        `
        divResumo.prepend(blocoTotal)
    } else {
        blocoTotal.querySelector('.valor').textContent = dinheiro(totalGeral)
    }
    blocoTotal.style.opacity = 1

    // Categorias
    for (const [cat, valor] of Object.entries(totaisPorCategoria)) {
        let bloco = divResumo.querySelector(`.bloco[data-cat="${cat}"]`)
        if (!bloco) {
            bloco = document.createElement('div')
            bloco.className = 'bloco'
            bloco.dataset.cat = cat
            bloco.onclick = () => renderizarPaginaRelatorioOmie('categoria', cat)
            bloco.innerHTML = `
                <div style="${vertical}">
                    <span style="font-size: 0.7rem;">${cat}</span> 
                    <span class="valor" style="font-size: 0.9rem;">${dinheiro(valor)}</span>
                </div>
            `
            divResumo.appendChild(bloco)
        }
        bloco.querySelector('.valor').textContent = dinheiro(valor)
        bloco.style.opacity = 1
    }

    // Status
    for (const [status, valor] of Object.entries(totaisPorStatus)) {
        let bloco = divResumo.querySelector(`.bloco[data-status="${status}"]`)
        if (!bloco) {
            bloco = document.createElement('div')
            bloco.className = 'bloco'
            bloco.dataset.status = status
            bloco.onclick = () => renderizarPaginaRelatorioOmie('parcelas', status)
            bloco.innerHTML = `
                <img src="imagens/${imgSt(status)}.png">
                <div style="${vertical}">
                    <span style="font-size: 0.7rem;">${status}</span>
                    <span class="valor" style="font-size: 0.9rem;">${dinheiro(valor)}</span>
                </div>
            `
            divResumo.appendChild(bloco)
        }
        bloco.querySelector('.valor').textContent = dinheiro(valor)
        bloco.style.opacity = valor === 0 ? 0.5 : 1
    }
}

async function baixarRelatorio() {
    return new Promise((resolve, reject) => {
        fetch(`${api}/relatorio`, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        })
            .then(response => response.ok ? response.json() : Promise.reject(response.status))
            .then(data => {
                if (data.mensagem) return reject(data.mensagem)
                resolve(data)
            })
            .catch(err => reject(err))
    })
}

async function excelRecebimento() {
    overlayAguarde()
    const response = await fetch(`${api}/excelRelatorio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appName })
    })
    if (!response.ok) throw new Error(`Erro: ${response.status}`)
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${appName}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    removerOverlay()
}
