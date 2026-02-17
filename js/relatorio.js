async function telaRelatorio() {

    const colunas = {
        '': {},
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Status': {},
        'Data Abertura': {},
        'Hora Abertura': {},
        'Data Limite': {},
        'Data da Correção': {},
        'Dias': {},
        'Solicitante': {},
        'Executores': {},
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' },
        'Prioridade': { chave: 'snapshots.prioridade' }
    }

    const tabela = modTab({
        colunas,
        pag: 'relatorioOcorrencias',
        body: 'bodyRelatorioOcorrencias',
        base: 'dados_ocorrencias',
        criarLinha: 'criarLinhaRelatorio'
    })

    const modelo = ({ texto, qtde, porcentagem, cor }) => `
        <div style="background-color: ${cor};" class="balao-totais">
            <label>${texto}</label>

            <div style="${horizontal}; gap: 1rem;">
                <label style="font-size: 2rem;">${qtde}</label>
                ${porcentagem ? `<label>${(porcentagem * 100).toFixed(0)}%</label>` : ''}
            </div>

        </div>`

    const contador = await contarPorCampo({
        base: 'dados_ocorrencias',
        path: 'snapshots.ultimaCorrecao'
    }) || {}

    const { todos, Solucionada } = contador

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio-ocorrencias">

                <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

                <div class="toolbar-itens">
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <span onclick="paraExcel()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>

                    <div style="${vertical}; gap: 0.5rem;">
                        <input id="de" type="date" onchange="pesquisarDatas('relatorioOcorrencias')">
                        <input id="ate" type="date" onchange="pesquisarDatas('relatorioOcorrencias')">
                    </div>

                    <div class="toolbar-itens">
                        ${modelo({ texto: 'Total', qtde: todos, cor: '#222' })}
                        ${modelo({ texto: 'Solucionados', porcentagem: Solucionada / todos, qtde: Solucionada, cor: '#1d7e45' })}
                        ${modelo({ texto: 'Em Aberto', porcentagem: (todos - Solucionada) / todos, qtde: (todos - Solucionada), cor: '#b12425' })}
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Ocorrências'

    mostrarMenus(false)

    await paginacao()


}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}
    const { ultimaCorrecao, cliente, empresa, tipo, prioridade, sistema } = snapshots || {}

    const status = ultimaCorrecao
    const estilo = status == 'Solucionada'
        ? 'fin'
        : status == 'Não analisada'
            ? 'na'
            : 'and'

    const calculos = verificarDtSolucao()

    const [dtAb, hrAb] = ocorrencia.dataRegistro
        ? ocorrencia.dataRegistro.split(', ')
        : ['', '']

    const executores = Object.values(ocorrencia?.correcoes || {})
        .map(correcao => `<span>• ${correcao.executor}</span>`)
        .join('')

    const tds = `
        <td>
            <div style="${horizontal}">
                <img src="imagens/pesquisar2.png" style="width: 2rem; cursor: pointer;" onclick="abrirCorrecaoRelatorio('${id}')">
            </div>
        </td>
        <td>${empresa}</td>
        <td>${id}</td>
        <td>
            <span class="${estilo}">${status}</span>
        </td>
        <td>${dtAb}</td>
        <td>${hrAb}</td>
        <td>${dtAuxOcorrencia(ocorrencia?.dataLimiteExecucao)}</td>
        <td>${calculos.dtSolucaoStr}</td>
        <td> 
            ${calculos.dias
            ? `
                <div style="${horizontal}; justify-content: start; gap: 5px;">
                    <img src="imagens/${calculos.img}.png" style="width: 1.5rem;">
                    <span>${calculos.dias || 'Sem Previsão'}</span>
                </div>`
            : 'Sem Previsão'
        }
        </td>
        <td>${ocorrencia?.usuario || ''}</td>
        <td>
            <div style="${vertical}; gap: 2px;">${executores}</div>
        </td>
        <td>${tipo}</td>
        <td>${cliente?.nome || '-'}</td>
        <td>${cliente?.cidade || '-'}</td>
        <td>${cliente?.estado || '-'}</td>
        <td>${sistema}</td>
        <td>${prioridade}</td>
    `

    return `<tr>${tds}</tr>`

    function verificarDtSolucao() {
        if (!ocorrencia.dataLimiteExecucao) {
            return { dtSolucaoStr: '-', dias: false, img: 'pendente' }
        }

        const [ano, mes, dia] = ocorrencia.dataLimiteExecucao.split('-').map(Number);
        const dataLimite = new Date(ano, mes - 1, dia);
        dataLimite.setHours(0, 0, 0, 0);

        let dtSolucaoStr = '-';
        let dias = 0;

        // pegar a última correção válida
        const correcao = Object.values(ocorrencia?.correcoes || {}).find(c => c.tipoCorrecao === 'WRuo2') || {}

        let dtReferencia = null

        if (correcao.data) {
            const [dataStr, horaStr] = correcao.data.split(', ')
            const [dia, mes, ano] = dataStr.split('/').map(Number)
            const [hora, minuto] = horaStr.split(':').map(Number)

            const dtSolucao = new Date(ano, mes - 1, dia, hora, minuto)
            dtSolucao.setHours(0, 0, 0, 0)

            dtSolucaoStr = dtSolucao.toLocaleDateString('pt-BR')
            dtReferencia = dtSolucao
        } else {
            dtReferencia = new Date()
            dtReferencia.setHours(0, 0, 0, 0)
        }

        dias = Math.round((dataLimite - dtReferencia) / (1000 * 60 * 60 * 24));

        if (isNaN(dias)) dias = false

        const img = dias < 0 ? 'offline' : dtSolucaoStr !== '' ? 'online' : 'pendente'

        return { dtSolucaoStr, dias, img };
    }

}


async function abrirCorrecaoRelatorio(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const correcoesOC = ocorrencia?.correcoes || {}
    const { cliente } = ocorrencia?.snapshots || {}
    const thead = ['Executor', 'Tipo Correção', 'Descrição', 'Localização', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let correcao of Object.values(correcoesOC)) {
        const { nome } = await recuperarDado('correcoes', correcao.tipoCorrecao) || {}
        let registros = ''
        let imagens = ''

        // Fotos
        imagens = Object.entries(correcao?.fotos || {})
            .map(([link, foto]) => `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        // Anexos
        imagens = Object.values(correcao?.anexos || {})
            .map(foto => {
                const link = foto.link
                const extensao = link.split('.').pop().toLowerCase()
                if (!extensoes.includes(extensao)) return ''
                return `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`
            })
            .join('')


        for (let [dt, dado] of Object.entries(correcao?.datas || {})) {

            let rastreio = 'Processando localização...'
            if (dado.geolocalizacao) {
                rastreio = `
                    <span>${dado.geolocalizacao.address.road}</span>
                    <strong><span>${dado.geolocalizacao.address.city}</span></strong>
                    <span>${dado.geolocalizacao.address.postcode}</span>
                `
            }

            registros += `
                <div class="bloco-localizacao">
                    <label>${new Date(Number(dt)).toLocaleString('pt-BR')}</label>
                    <div style="${vertical};">
                        ${rastreio}
                    </div>
                </div>
            `
        }

        linhas += `
            <tr>
                <td>${correcao.executor}</td>
                <td>${nome}</td>
                <td style="width: 200px; text-align: left;">${correcao.descricao}</td>
                <td>
                    <div style="${vertical}; gap: 1px;">
                        ${registros}
                    </div>
                </td>
                <td>
                    ${imagens !== '' ? `<div class="fotos" style="display: grid;">${imagens}</div>` : 'Sem Imagens'}
                </td>
            </tr>`
    }

    const elemento = `
        <div class="detalhes-correcao">

            <span style="font-size: 1.2rem;"><b>Dados da Loja</b></span>
            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Loja', cliente?.nome || '...')}
                    ${modelo('Endereço', cliente?.bairro || '...')}
                </div>

                <div style="${vertical}">
                    ${modelo('Cidade', cliente?.cidade || '...')}
                    ${modelo('Cep', cliente?.cep || '...')}
                </div>
            </div>

            <span style="font-size: 1.2rem;"><b>Correções</b></span>
            <hr style="width: 100%;">

            <div class="blocoTabela" style="width: 100%;">
                <div class="painelBotoes"></div>
                <div class="recorteTabela">
                    <table class="tabela" style="width: max-content; min-width: 100%;">
                        <thead>${thead}</thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `

    popup({ elemento, titulo: 'Correções' })
}

async function pesquisarDatas(pag) {
    const deInput = document.getElementById('de').value
    const ateInput = document.getElementById('ate').value

    controles[pag].filtros ??= {}

    controles[pag].filtros = {
        ...controles[pag].filtros,
        'dataRegistro': [
            { op: '>=d', value: deInput },
            { op: '<=d', value: ateInput },
        ]
    }

    await paginacao()

}

async function paraExcel() {
    const tabela = document.querySelector('.tabela')
    if (!tabela) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Ocorrências')
    const trs = tabela.querySelectorAll('tr')

    for (let i = 0; i < trs.length; i++) {
        const tds = trs[i].querySelectorAll('td, th')
        const row = []

        for (let j = 1; j < tds.length; j++) {
            const td = tds[j]
            const select = td.querySelector('select')
            const input = td.querySelector('input')

            if (select) row.push(select.value)
            else if (input) row.push(input.value)
            else row.push(td.textContent.trim())
        }

        worksheet.addRow(row)
    }

    worksheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: worksheet.columnCount }
    }

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell(cell => {
            cell.alignment = { vertical: 'top', horizontal: 'left' }
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            }

            if (rowNumber === 1) {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD9D9D9' }
                }
                cell.font = { bold: true }
            }
        })
    })

    worksheet.columns.forEach(col => {
        let max = 10
        col.eachCell(cell => {
            const len = String(cell.value || '').length
            if (len > max) max = len
        })
        col.width = Math.min(max + 2, 45)
    })

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `relatorio-${Date.now()}.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

async function telaRelatorioCorrecoes() {

    const colunas = {
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'snapshots.empresa' },
        'Tipo Correção': { chave: 'snapshots.empresa' },
        'Descrição': { chave: 'snapshots.empresa' },
        'Data Registro': { chave: 'snapshots.empresa' },
        'Hora Registro': { chave: 'snapshots.empresa' },
        'Solicitante': { chave: 'snapshots.empresa' },
        'Executor': { chave: 'snapshots.empresa' },
        'Loja': { chave: 'snapshots.empresa' },
        'Sistema': { chave: 'snapshots.empresa' }
    }

    const tabela = modTab({
        colunas,
        base: 'dados_ocorrencias',
        pag: 'relatorioCorrecoes',
        body: 'bodyCorrecoes',
        criarLinha: 'criarLinhasCorrecoes',
    })

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio-ocorrencias">

                <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

                <div class="toolbar-itens">
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <span onclick="paraExcel()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>

                    <div style="${vertical}; gap: 0.5rem;">
                        <input id="de" type="date" onchange="pesquisarDatas('relatorioCorrecoes')">
                        <input id="ate" type="date" onchange="pesquisarDatas('relatorioCorrecoes')">
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Correções'

    await paginacao()

    mostrarMenus(false)

}

async function criarLinhasCorrecoes(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}

    const { cliente, empresa, sistema } = snapshots || {}

    const linhas = []

    for (const correcao of Object.values(ocorrencia?.correcoes || {})) {

        const [data, hora] = correcao.data ? correcao.data.split(', ') : ['-', '-']

        const tds = `
        <td>${empresa}</td>
        <td>${id}</td>
        <td>${await recuperarDado('correcoes', correcao?.tipoCorrecao)?.nome || 'Não analisada'}</td>
        <td>
            <div>
                ${String(correcao?.descricao || '').replace('\n', '<br>')}
            </div>
        </td>
        <td>${data}</td>
        <td>${hora}</td>
        <td>${correcao?.usuario || '-'}</td>
        <td>${correcao?.executor || '-'}</td>
        <td>${cliente?.nome || '-'}</td>
        <td>${sistema}</td>
        `

        linhas.push(`<tr>${tds}</tr>`)
    }

    return linhas.join('')

}