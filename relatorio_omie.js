let filtroRelatorio = {}
let datas = { de: '', ate: '' }
let apps = []
carregarTabela()

async function atualizarRelatorio() {

    overlayAguarde()
    const nuvem = await baixarRelatorio()
    let dados_relatorio = await recuperarDados('dados_relatorio') || {}

    for (const [app, apps] of Object.entries(nuvem)) {

        if (app == 'atualizado') continue

        if (!dados_relatorio[app]) dados_relatorio[app] = {}

        let relatorioApp = dados_relatorio[app]

        for (let [tipo, tipos] of Object.entries(apps)) {

            if (!relatorioApp[tipo]) relatorioApp[tipo] = {}

            relatorioApp[tipo] = {
                ...relatorioApp[tipo],
                ...tipos
            }
        }
    }

    dados_relatorio.atualizado = nuvem.atualizado

    await inserirDados(dados_relatorio, 'dados_relatorio')

    await carregarTabela()

    removerOverlay()

}

const imagensStatus = (status) => {

    const imagens = {
        'A VENCER': 'congelado',
        'RECEBIDO': 'aprovado',
        'CANCELADO': 'reprovado',
        'VENCE HOJE': 'pendente'
    }

    return imagens?.[status] || 'reprovado'
}

async function carregarTabela(app) {

    let dados_relatorio = await recuperarDados('dados_relatorio') || {}

    document.getElementById('atualizado').textContent = `Atualizado em: ${dados_relatorio?.atualizado || '--'}`

    let tabelas = {}

    for (const [app, relatorioApp] of Object.entries(dados_relatorio)) {

        if (app == 'atualizado') continue

        if (!filtroRelatorio[app]) filtroRelatorio[app] = {}

        if (!tabelas[app]) {
            tabelas[app] = {
                linhas: ''
            }
        }

        for (const [tipo, tipos] of Object.entries(relatorioApp)) {
            processarDados(tipos)
        }

        function parcelas(listaParcelas) {

            let stringParcelas = ''

            for (const parcela of listaParcelas) {

                stringParcelas += `
                    <div class="blocoParcela">

                        <div style="flex-direction: column;">
                            <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                                <img src="imagens/${imagensStatus(parcela.status)}.png" style="width: 1.5vw;">
                                <label name="status" style="font-size: 0.7vw;">${parcela.status}</label>
                            </div>
                            <label style="font-size: 0.7vw;" title="${parcela.conta}">${parcela.conta.slice(0, 10)}...</label>
                        </div>

                        <div class="blocoValores">
                            <label name="valorStatus" style="font-size: 1.0vw;">${dinheiro(parcela.valor)}</label>
                            <label name="vencimento" style="font-size: 0.7vw; white-space: nowrap;">venc. <strong>${parcela.vencimento}</strong></label>
                        </div>

                    </div>
                `
            }

            stringParcelas = stringParcelas == '' ? 'Não Localizado' : stringParcelas

            return stringParcelas
        }

        function processarDados(dados) {
            for ([nf, nota] of Object.entries(dados)) {

                if (!nota.dataRegistro) continue

                let timestampData = dataJS(nota.dataRegistro)

                if ((datas.de !== '' && datas.ate !== '') && !(timestampData >= datas.de && timestampData <= datas.ate)) continue

                const tipo = nota.categoria == 'serviço' ? 'serviço' : 'venda_remessa'
                tabelas[app].linhas += `
                    <tr>
                        <td name="categoria">${nota.categoria}</td>
                        <td>
                            ${balaoPDF(nf, nota.dataRegistro, nota.codOmie, tipo, app)}
                        </td>
                        <td style="font-size: 1.2vw;">${dinheiro(nota.total)}</td>
                        <td>${parcelas(nota.parcelas)}</td>
                        <td>
                            <div style="display: flex; flex-direction: column; justify-content: start;">
                                <label style="font-size: 1.0vw;">${nota.cliente}</label>
                                <label style="font-size: 0.8vw;"><strong>${nota.cnpj}</strong></label>
                            </div>
                        </td>
                    </tr>
                    `
            }
        }
    }

    let stringTabelas = ''
    let toolbarApp = ''
    apps = []
    for (const [app, dados] of Object.entries(tabelas)) {

        let ths = ''
        let thsPesquisa = ''
        let colunasOFF = ['DANFE', 'Data Registro']
        let colunas = ['Tipo', 'NF & Data Registro', 'Total', 'Parcelas', 'Cliente & CNPJ']
            .map((coluna, i) => {
                ths += `<th>${coluna}</th>`

                if (colunasOFF.includes(coluna)) {
                    thsPesquisa += `<th style="background-color: white;"></th>`
                } else {
                    thsPesquisa += `
                    <th style = "background-color: white;" >
                        <div style="display: flex; align-items: center; justify-content: center;">
                            <input oninput="pesquisar_generico('${i}', this.value, filtroRelatorio['${app}'], 'bodyRelatorio_${app}'); calcularResumo('${app}')">
                            <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
                        </div>
                    </th>
            `}
            })

        apps.push(app)

        toolbarApp += `
            <div class="itensToolbar" id="toolbar_${app}" onclick="mostrarTabela('${app}')">
                <label>${app}</label>
            </div>
        `

        stringTabelas += `
            <table class="tabela" id="${app}">
                <thead>
                    <tr>${ths}</tr>
                    <tr>${thsPesquisa}</tr>
                </thead>

                <tbody id="bodyRelatorio_${app}">
                    ${dados.linhas}
                </tbody>
            </table>
        `
    }

    let acumulado = `
        <div id="divRelatorio" class="relatorioDiv">

            <div class="blocoEsquerdo">
        
                <label class="titulos">Data Emissão NF</label>
                <div class="filtros">
                    <div>
                        <label>De</label>
                        <input type="date" onchange="dataPesquisa(this.value, 'de')">
                    </div>
                    <div>
                        <label>Até</label>
                        <input type="date" onchange="dataPesquisa(this.value, 'ate')">
                    </div>
                </div>

                <div id="resumoValores"></div>
            
            </div>
            <div style="flex-direction: column;">
                <div class="toolbarRelatorio">
                    ${toolbarApp}
                </div>
                <div style="height: 50vw; overflow: auto;" id="tabelas">
                    ${stringTabelas}
                </div>
            </div>
        </div>
        `

    let divRelatorio = document.getElementById('divRelatorio')
    if (divRelatorio) {
        document.querySelector('.toolbarRelatorio').innerHTML = toolbarApp
        document.getElementById('tabelas').innerHTML = stringTabelas
    } else {
        document.body.insertAdjacentHTML('beforeend', acumulado)
    }

    mostrarTabela(app ? app : apps[0])
}

async function limparFiltros(app) {

    await carregarTabela(app)
    filtroRelatorio[app] = {}
    carregarFiltros(app)
}

function dataJS(data) {
    const [dia, mes, ano] = data.split('/').map(Number)
    return new Date(ano, mes - 1, dia, 0, 0, 0).getTime()
}

async function dataPesquisa(dt, campo) {

    const [ano, mes, dia] = dt.split('-').map(Number)

    const timestamp = new Date(ano, mes - 1, dia, 0, 0, 0).getTime()
    datas[campo] = isNaN(timestamp) ? '' : timestamp

    await carregarTabela()

}


function calcularResumo(app) {

    let resumoValores = {
        status: {},
        categorias: {}
    }

    const tabela = document.getElementById(app)
    const status = tabela.querySelectorAll('[name="status"]')
    const valorStatus = tabela.querySelectorAll('[name="valorStatus"]')
    const categorias = tabela.querySelectorAll('[name="categoria"]')

    const termoST = filtroRelatorio[app]['3'] || ''
    const termoCAT = filtroRelatorio[app]['0'] || ''

    categorias.forEach(td => {

        const tr = td.closest('tr')

        const statusTD = tr.querySelectorAll('td')[3].querySelectorAll('[name="status"]')
        const valores = tr.querySelectorAll('td')[3].querySelectorAll('[name="valorStatus"]')
        let valor = 0

        valores.forEach((td, i) => {
            if (termoST == '' || (statusTD[i].textContent == String(termoST).toUpperCase())) valor += conversor(td.textContent)
        })

        // Por Status, caso a linha esteja visível;
        const somar = tr.style.display !== 'none'
        const categoria = td.textContent

        if (!resumoValores.categorias[categoria]) resumoValores.categorias[categoria] = 0
        if ((somar && termoCAT == categoria) || termoCAT == '') resumoValores.categorias[categoria] += valor

    })

    status.forEach((st, i) => {

        const valor = conversor(valorStatus[i].textContent)

        // Por Status, caso a linha esteja visível;
        const somar = st.closest('tr').style.display !== 'none'

        if (!resumoValores.status[st.textContent]) resumoValores.status[st.textContent] = 0
        if ((somar && termoST == String(st.textContent).toLowerCase()) || termoST == '') resumoValores.status[st.textContent] += valor

    })

    for ([st, valor] of Object.entries(resumoValores.status)) {

        let localValor = document.getElementById(st)
        if (localValor) localValor.textContent = dinheiro(valor)

    }

    for ([cat, valor] of Object.entries(resumoValores.categorias)) {

        let localValor = document.getElementById(cat)
        if (localValor) localValor.textContent = dinheiro(valor)

    }

    return resumoValores

}

function carregarFiltros(app) {

    const resumoValores = calcularResumo(app)

    const termoST = filtroRelatorio[app]['3'] || ''
    const termoCAT = filtroRelatorio[app]['0'] || ''

    const indStatus = Object.entries(resumoValores.status)
        .map(([st, valor]) => `
            <div class="blocoParcela">

                <input ${termoST == String(st).toLowerCase() ? 'checked' : ''} style="cursor: pointer; width: 1.5vw; height: 1.5vw;" type="radio" onclick="pesquisar_generico(3, '${st}', filtroRelatorio['${app}'], 'bodyRelatorio_${app}'); calcularResumo('${app}')" name="inputStatus" style="cursor: pointer; width: 1.5vw; height: 1.5vw;">

                <div style="flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <img src="imagens/${imagensStatus(st)}.png" style="width: 1.5vw;">
                        <label name="status" style="white-space: nowrap; font-size: 0.7vw;">${st}</label>
                    </div>
                </div>

                <div class="blocoValores">
                    <label name="valorStatus" style="white-space: nowrap; font-size: 0.8vw;" id="${st}">${dinheiro(valor)}</label>
                </div>

            </div>
        `)
        .join('')

    const indCategorias = Object.entries(resumoValores.categorias)
        .map(([cat, valor]) => `
            <div class="blocoParcela">

                <input ${termoCAT == String(cat).toLowerCase() ? 'checked' : ''} style="cursor: pointer; width: 1.5vw; height: 1.5vw;" type="radio" name="inputCategoria" onclick="pesquisar_generico(0, '${cat}', filtroRelatorio['${app}'], 'bodyRelatorio_${app}'); calcularResumo('${app}')" style="width: 1.5vw; height: 1.5vw;">

                <div style="flex-direction: column;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 3px;">
                        <label name="status" style="white-space: nowrap; font-size: 0.7vw;">${cat}</label>
                    </div>
                </div>

                <div class="blocoValores">
                    <label name="valorStatus" style="white-space: nowrap; font-size: 0.8vw;" id="${cat}">${dinheiro(valor)}</label>
                </div>

            </div>
        `)
        .join('')

    let acumulado = `
        ${botao('Limpar Filtros', `limparFiltros('${app}')`)}
        <br>
        <div style="${vertical}; gap: 3px;">
            <label class="titulos">Status Recebimento</label>
            <label style="font-size: 0.7vw; color: white;">[Clique para filtrar]</label>
            ${indStatus}
        </div>
        <br>
        <div style="${vertical}; gap: 3px;">
            <label class="titulos">Filtrar por Tipo</label>
            <label style="font-size: 0.7vw; color: white;">[Clique para filtrar]</label>
            ${indCategorias}
        </div>
        `

    if (indStatus == '') return

    document.getElementById('resumoValores').innerHTML = acumulado

}

function mostrarTabela(app) {

    apps.forEach(appNome => {
        document.getElementById(appNome).style.display = 'none'
        document.getElementById(`toolbar_${appNome}`).style.opacity = '0.5'
    })

    let tabelaApp = document.getElementById(app)
    if (!tabelaApp) return

    tabelaApp.style.display = 'table-row'
    document.getElementById(`toolbar_${app}`).style.opacity = '1'

    carregarFiltros(app)
}

async function baixarRelatorio() {

    const dados_relatorio = await recuperarDados('dados_relatorio') || {}

    let timestamps = {}

    for (const [app, apps] of Object.entries(dados_relatorio)) {

        if (app == 'atualizado') continue

        if (!timestamps[app]) timestamps[app] = {}
        let timestampApp = timestamps[app]

        for (const [tipo, tipos] of Object.entries(apps)) {

            if (!timestampApp[tipo]) timestampApp[tipo] = 0

            for (const [nf, nota] of Object.entries(tipos)) {
                if (nota.timestamp && nota.timestamp > timestampApp[tipo]) {
                    timestampApp[tipo] = nota.timestamp
                }
            }
        }

    }

    return new Promise((resolve, reject) => {
        fetch("https://leonny.dev.br/relatorio", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ timestamps })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erro na requisição: ${response.status} ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                resolve(data);
            })
            .catch(err => {
                console.error(err)
                reject()
            });
    })
}

function exportarExcel(idTabela) {
    const tabela = document.getElementById(idTabela)
    const wb = XLSX.utils.table_to_book(tabela, { sheet: "Planilha" })
    XLSX.writeFile(wb, 'dados.xlsx')
}