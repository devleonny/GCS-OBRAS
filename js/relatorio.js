async function telaRelatorio() {

    filtrosPagina = {}

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes')
    empresas = await recuperarDados('empresas')
    tipos = await recuperarDados('tipos')
    sistemas = await recuperarDados('sistemas')
    correcoes = await recuperarDados('correcoes')
    prioridades = await recuperarDados('prioridades')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela({
        colunas: [
            '',
            'Empresa',
            'Chamado',
            'Status',
            'Data Abertura',
            'Hora Abertura',
            'Data Limite',
            'Data da Correção',
            'Dias',
            'Solicitante',
            'Executores',
            'Tipo Correção',
            'Loja',
            'Cidade',
            'Estado',
            'Sistema',
            'Prioridade'
        ],
        funcao: `atualizarRelatorio()`
    })

    const modelo = (texto, name, cor) => `
        <div style="background-color: ${cor};" class="balao-totais">
            <label>${texto}</label>

            <div style="${horizontal}; gap: 1rem;">
                <label name="${name}" style="font-size: 2rem;"></label>
                ${name !== 'totalChamados' ? `<label name="porc_${name}"></label>` : ''}
            </div>

        </div>
    `

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio">

                <img src="imagens/GrupoCostaSilva.png" style="width: 10rem;">

                <div class="toolbar-itens">
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <input id="de" type="date" onchange="pesquisarDatas()">
                        <input id="ate" type="date" onchange="pesquisarDatas()">
                        <span onclick="paraExcel()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>

                    <div style="${horizontal}; gap: 0.5rem;">
                        ${modelo('Total', 'totalChamados', '#222')}
                        ${modelo('Solucionados', 'solucionados', '#1d7e45')}
                        ${modelo('Em Aberto', 'emAberto', '#b12425')}
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    telaInterna.innerHTML = acumulado

    removerOverlay()

    titulo.textContent = 'Relatório de Ocorrências'

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) criarLinhaRelatorio(idOcorrencia, ocorrencia)

    calcularResumo()
    mostrarMenus(false)

}

async function atualizarRelatorio() {
    await atualizarOcorrencias()
    await telaRelatorio()
}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function criarLinhaRelatorio(idOcorrencia, ocorrencia) {

    const status = correcoes[ocorrencia?.tipoCorrecao]?.nome || 'Não analisada'
    const estilo = status == 'Solucionada'
        ? 'fin'
        : status == 'Não analisada'
            ? 'na'
            : 'and'

    const calculos = verificarDtSolucao()

    const [dtAb, hrAb] = ocorrencia.dataRegistro ? ocorrencia.dataRegistro.split(', ') : ['', '']

    const executores = Object.values(ocorrencia?.correcoes || {})
        .map(correcao => `<span>• ${correcao.executor}</span>`)
        .join('')

    const cliente = dados_clientes?.[ocorrencia?.unidade] || {}

    const tds = `
        <td>
            <div style="${horizontal}">
                <img src="imagens/pesquisar2.png" style="width: 2rem; cursor: pointer;" onclick="abrirCorrecaoRelatorio('${idOcorrencia}')">
            </div>
        </td>
        <td>${empresas[ocorrencia?.empresa]?.nome || '-'}</td>
        <td>${idOcorrencia}</td>
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
        <td>${tipos?.[ocorrencia?.tipo]?.nome || '...'}</td>
        <td>${cliente?.nome || '-'}</td>
        <td>${cliente?.cidade || '-'}</td>
        <td>${cliente?.estado || '-'}</td>
        <td>${sistemas?.[ocorrencia?.sistema]?.nome || '...'}</td>
        <td>${prioridades?.[ocorrencia?.prioridade]?.nome || '...'}</td>
    `

    const trExistente = document.getElementById(`OCOR_${idOcorrencia}`)
    if (trExistente) return trExistente.innerHTML = linha

    document.getElementById('body').insertAdjacentHTML('beforeend', `<tr id="OCOR_${idOcorrencia}">${tds}</tr>`)

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

function calcularResumo() {
    const totais = {
        totalChamados: 0,
        solucionados: 0,
        emAberto: 0
    }

    const body = document.getElementById('body')
    const trs = body.querySelectorAll('tr')

    for (const tr of trs) {
        if (tr.style.display == 'none') continue

        const tds = tr.querySelectorAll('td')
        const solucionado = tds[3].querySelector('span').textContent == 'Solucionada'

        totais.totalChamados++

        if (solucionado) {
            totais.solucionados++
        } else {
            totais.emAberto++
        }
    }

    for (const [total, quantidade] of Object.entries(totais)) {
        const el = document.querySelector(`[name="${total}"]`)
        const elPor = document.querySelector(`[name="porc_${total}"]`)
        if (el) el.textContent = quantidade
        if (elPor) elPor.textContent = quantidade == 0 ? '0%' : `${((quantidade / totais.totalChamados) * 100).toFixed(0)}%`
    }
}

async function abrirCorrecaoRelatorio(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia)
    const correcoesOC = ocorrencia?.correcoes || {}
    const thead = ['Executor', 'Tipo Correção', 'Descrição', 'Localização', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let [, correcao] of Object.entries(correcoesOC)) {
        const st = correcoes[correcao.tipoCorrecao].nome
        let registros = ''
        let imagens = ''

        // Fotos
        imagens = Object.entries(correcao?.fotos || {})
            .map(([link, foto]) => `<img name="foto" id="${link}" src="${api}/uploads/GCS/${link}" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        // Anexos
        imagens = Object.values(correcao?.anexos || {})
            .map(foto => {
                const link = foto.link
                const extensao = link.split('.').pop().toLowerCase()
                if (!extensoes.includes(extensao)) return ''
                return `<img name="foto" id="${link}" src="${api}/uploads/GCS/${link}" onclick="ampliarImagem(this, '${link}')">`
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
                <td>${st}</td>
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

    const loja = dados_clientes?.[ocorrencia?.unidade] || {}

    const acumulado = `
        <div class="detalhes-correcao">

            <span style="font-size: 1.2rem;"><b>Dados da Loja</b></span>
            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Loja', loja?.nome || '...')}
                    ${modelo('Endereço', loja?.bairro || '...')}
                </div>

                <div style="${vertical}">
                    ${modelo('Cidade', loja?.cidade || '...')}
                    ${modelo('Cep', loja?.cep || '...')}
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

    popup(acumulado, 'Correções')
}


function ampliarImagem(img) {

    const acumulado = `
        <div style="background-color: #d2d2d2; padding: 0.5rem;">

            <img src="${img.src}" style="width: 100%;">

        </div>
    `

    popup(acumulado, 'Imagem', true)

}

function pesquisarOcorrencias(coluna, texto, id) {
    filtroOcorrencias[coluna] = String(texto).toLowerCase().replace('.', '').trim();

    const tbody = document.getElementById(id);
    const trs = tbody.querySelectorAll('tr');

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        const filtroData = tr.dataset.data;

        // se não passou no filtro de datas, já esconde
        if (filtroData === 'n') {
            tr.style.display = 'none';
            continue;
        }

        let mostrarLinha = true;

        for (const col in filtroOcorrencias) {   // <--- CORRIGIDO
            let filtroTexto = filtroOcorrencias[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input')
                    || tds[col].querySelector('textarea')
                    || tds[col].querySelector('select')
                    || tds[col].textContent;

                let conteudoCelula = element.value ? element.value : element;
                let texto_campo = String(conteudoCelula).toLowerCase().replace('.', '').trim();

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none';
    }
}

function pesquisarDatas() {
    const deInput = document.getElementById('de').value;
    const ateInput = document.getElementById('ate').value;

    const body = document.getElementById('body');
    const trs = body.querySelectorAll('tr');

    if (!deInput || !ateInput) {
        for (const tr of trs) {
            tr.dataset.data = 's';
            tr.style.display = '';
        }
        return;
    }

    const [anoDe, mesDe, diaDe] = deInput.split('-').map(Number);
    const [anoAte, mesAte, diaAte] = ateInput.split('-').map(Number);

    const de = new Date(anoDe, mesDe - 1, diaDe, 0, 0, 0, 0);
    const ate = new Date(anoAte, mesAte - 1, diaAte, 23, 59, 59, 999);

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td');
        const dataAbertura = tds[4]?.textContent.trim();
        if (!dataAbertura) continue;

        const [dataStr] = dataAbertura.split(',');
        const [dia, mes, ano] = dataStr.split('/').map(Number);
        const data = new Date(ano, mes - 1, dia);

        if (data >= de && data <= ate) {
            tr.dataset.data = 's';
            tr.style.display = '';
        } else {
            tr.dataset.data = 'n';
            tr.style.display = 'none';
        }
    }
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

    filtrosPagina = {}

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes')
    empresas = await recuperarDados('empresas')
    tipos = await recuperarDados('tipos')
    sistemas = await recuperarDados('sistemas')
    correcoes = await recuperarDados('correcoes')
    prioridades = await recuperarDados('prioridades')
    dados_ocorrencias = await recuperarDados('dados_ocorrencias')
    const tabela = modeloTabela({
        colunas: [
            'Empresa',
            'Chamado',
            'Tipo Correção',
            'Descrição',
            'Data Registro',
            'Hora Registro',
            'Solicitante',
            'Executor',
            'Loja',
            'Sistema'
        ],
        funcao: `atualizarRelatorio()`
    })

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio">

                <img src="imagens/GrupoCostaSilva.png" style="width: 10rem;">

                <div class="toolbar-itens">
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <input id="de" type="date" onchange="pesquisarDatas()">
                        <input id="ate" type="date" onchange="pesquisarDatas()">
                        <span onclick="paraExcel()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    telaInterna.innerHTML = acumulado

    removerOverlay()

    titulo.textContent = 'Relatório de Correções'

    for (const [idOcorrencia, ocorrencia] of Object.entries(dados_ocorrencias).reverse()) {
        criarLinhasCorrecoes(idOcorrencia, ocorrencia)
    }

    mostrarMenus(false)

}

function criarLinhasCorrecoes(idOcorrencia, ocorrencia) {

    const cliente = dados_clientes?.[ocorrencia?.unidade] || {}

    for (const [idCorrecao, correcao] of Object.entries(ocorrencia?.correcoes || {})) {

        const [data, hora] = correcao.data ? correcao.data.split(', ') : ['-', '-']

        const tds = `
        <td>${empresas?.[ocorrencia?.empresa]?.nome || '-'}</td>
        <td>${idOcorrencia}</td>
        <td>${correcoes?.[correcao?.tipoCorrecao]?.nome || '-'}</td>
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
        <td>${sistemas?.[ocorrencia?.sistema]?.nome || '-'}</td>
        `

        const trExistente = document.getElementById(`CORR_${idCorrecao}`)
        if (trExistente) {
            trExistente.innerHTML = tds
            continue
        }

        document.getElementById('body').insertAdjacentHTML('beforeend', `<tr id="CORR_${idCorrecao}">${tds}</tr>`)
    }

}