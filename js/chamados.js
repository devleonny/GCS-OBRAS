let idManutencao = null
let statusChamados = null

async function telaChamados() {

    mostrarMenus(false)

    const colunas = {
        'Última alteração': { chave: 'data' },
        'Status': { chave: 'status_manutencao' },
        'Chamado': { chave: 'chamado' },
        'Loja': { chave: 'snapshots.loja' },
        'Técnico': { chave: 'snapshots.tecnico' },
        'Último analista': { chave: 'usuario' },
        'Previsão': { chave: 'previsao' },
        'Ações': {}
    }

    const tabela = modTab({
        pag: 'chamados',
        funcaoAdicional: ['formatacaoPaginaChamados'],
        colunas,
        criarLinha: 'criarLinhaManutencao',
        body: 'bodyChamados',
        base: 'dados_manutencao'
    })

    const acumulado = `
        <div style="${horizontal}; width: 95vw;">
            <img src="imagens/nav.png" style="width: 2rem;" onclick="scrollar('prev')">
            <div id="toolbar"></div>
            <img src="imagens/nav.png" style="width: 2rem; transform: rotate(180deg);" onclick="scrollar('next')">
        </div>

        <div style="${vertical}; width: 95vw;">
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    await carregarToolbarChamados()

    await paginacao()

    criarMenus('chamados')

}

function criarLinhaManutencao(manutencao) {

    const idManutencao = manutencao.id

    const tds = `
        <td>${manutencao?.data || '--'}</td>
        <td>${manutencao?.status_manutencao || '--'}</td>
        <td>${manutencao.chamado || 'SEM CHAMADO'}</td>
        <td>
            <span style="text-align: left;">
                ${manutencao?.snapshots?.loja?.[0] || ''}<br>
                <b>${manutencao?.snapshots?.loja?.[1] || ''}</b>
                ${manutencao?.snapshots?.loja?.[2] || ''}<br>
            </span>
        </td>
        <td>
            <span style="text-align: left;">
                ${manutencao?.snapshots?.tecnico?.[0] || ''}<br>
                <b>${manutencao?.snapshots?.tecnico?.[1] || ''}</b>
                ${manutencao?.snapshots?.tecnico?.[2] || ''}<br>
            </span>
        </td>
        <td>${manutencao?.usuario || ''}</td>
        <td>
            <input style="display: none;" name="datas" value="${manutencao?.previsao || ''}">
            ${formatarData(manutencao?.previsao) || '--'}
        </td>
        <td style="text-align: center;">
            <img onclick="criarManutencao('${idManutencao}')" src="imagens/pesquisar2.png">
        </td>`

    return `<tr id="${idManutencao}">${tds}</tr>`
}

function imgManut(status) {
    let imagem;

    switch (status) {
        case 'MANUTENÇÃO':
            imagem = 'avencer'
            break
        case 'REQUISIÇÃO AVULSA':
            imagem = 'avulso'
            break
        case 'MATERIAL SEPARADO':
            imagem = 'estoque'
            break
        case 'MATERIAL ENVIADO':
            imagem = 'logistica'
            break
        case 'FINALIZADO':
            imagem = 'concluido'
            break
        case 'EMITIR NOTA':
            imagem = 'financeiro'
            break
        default:
            imagem = 'cancel'
    }

    return imagem
}


function formatacaoPaginaChamados() {

    const status = controles?.chamados?.filtros?.status_manutencao?.value || 'todos'
    const abas = document.querySelectorAll('.aba-toolbar')

    abas.forEach(a => a.style.opacity = 0.5)

    const aba = document.querySelector(`[name="${status}"]`)
    if (aba) aba.style.opacity = 1

}

async function carregarToolbarChamados() {

    const cont1 = await contarPorCampo({ base: 'dados_manutencao', path: 'status_manutencao' })

    const contToolbar = {
        ...cont1
    }

    const toolbar = document.getElementById('toolbar')
    const pag = 'chamados'

    for (const [campo, contagem] of Object.entries(contToolbar)) {

        const tool = toolbar.querySelector(`[name="${campo}"]`)
        if (tool) {
            tool.querySelector('span').textContent = contagem
            continue
        }

        const filtros = campo == 'todos'
            ? '{}'
            : `{ 'status_manutencao': {op:'=', value: '${campo}'} }`

        const novaTool = `
            <div
                style="opacity: 0.5; height: 3rem;"
                class="aba-toolbar"
                name="${campo}"
                onclick="
                controles.${pag}.pagina = 1; 
                controles.${pag}.filtros = ${filtros};
                paginacao()">
                <label>${campo.toUpperCase()}</label>
                <span>${contagem}</span>
            </div>
            `
        toolbar.insertAdjacentHTML('beforeend', novaTool)
    }

}

async function criarManutencao(id = ID5digitos()) {

    const manutencao = await recuperarDado('dados_manutencao', id) || {}
    const cliente = await recuperarDado('dados_clientes', manutencao?.codigo_cliente)
    const tecnico = await recuperarDado('dados_clientes', manutencao?.codigo_tecnico)

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const tabela = ` 
        <div class="borda-tabela" style="width: 90%;">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody id="linhasManutencao"></tbody>
                    </table>
                </div>
            <div class="rodape-tabela"></div>
        </div>
    `

    const opcoes = ['MANUTENÇÃO', 'EMITIR NOTA', 'REQUISIÇÃO AVULSA', 'MATERIAL SEPARADO', 'MATERIAL ENVIADO', 'FINALIZADO', 'REPROVADO']
        .map(op => `<option ${manutencao?.status_manutencao == op ? 'selected' : ''}>${op}</option>`)
        .join('')

    const modelo = (texto, elemento) => `
        <div style="${vertical}">
            <span><b>${texto}</b></span>
            <div class="manutencao-formulario">${elemento}</div>
        </div>
        `
    const kitTecnico = manutencao?.chamado == 'KIT TÉCNICO' ? true : false
    const formulario = `
        <div class="bloco-chamados-principal">
            
            <div class="bloco-chamados">
                ${modelo('Cliente | Loja', `<span ${manutencao?.codigo_cliente ? `id="${manutencao?.codigo_cliente}"` : ''} class="opcoes" name="cliente" onclick="cxOpcoes('cliente', 'dados_clientes', ['nome', 'cnpj', 'endereco'])">${cliente?.nome || 'Selecione'}</span>`)}
                ${modelo('Técnico', `<span ${manutencao?.codigo_tecnico ? `id="${manutencao?.codigo_tecnico}"` : ''} class="opcoes" name="tecnico" onclick="cxOpcoes('tecnico', 'dados_clientes', ['nome', 'cnpj', 'endereco'])">${tecnico?.nome || 'Selecione'}</span>`)}
                ${modelo('Comentário', `<textarea name="comentario" rows="7">${manutencao?.comentario || ''}</textarea>`)}
                
                <br>

                <label class="anexos-formulario" for="anexos">Incluir anexos</label>
                <input type="file" onchange="infoAnexos(this)" id="anexos" style="display: none" multiple>

                <br>
                <div class="arquivos">Sem anexos para importação</div>

                <div id="lista-anexos" style="${vertical}">
                    ${Object.entries(manutencao?.anexos || {}).map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, ``)).join('')}
                </div>
                
            </div>

            <div class="bloco-chamados">

                ${modelo('Status', `<select name="status_manutencao">${opcoes}</select>`)}

                ${modelo('Kit Técnico', `<input ${kitTecnico ? 'checked' : ''} name="kitTecnico" type="checkbox" style="width: 1.5rem; height: 1.5rem; cursor: pointer;" onclick="modoKit(this)">`)}

                ${modelo('Chamado', `<input name="chamado" type="text" value="${manutencao?.chamado || ''}">`)}

                ${modelo('Previsão', `<input name="previsao" type="date" value="${manutencao?.previsao || ''}">`)}
                
                ${modelo('NF', `<input name="nf" value="${manutencao?.nf || ''}">`)}

            </div>

        </div>
        `

    const historico = Object.entries(manutencao?.historico || {})
        .map(([id, dados]) => `
            <div class="item-historico">
                <img src="imagens/${imgManut(dados.status_manutencao)}.png">
                <div style="${vertical}">
                    ${modelo('Data', dados.data)}
                    ${modelo('Status', dados.status_manutencao)}
                    ${modelo('Usuário', dados.usuario)}
                    ${modelo('Comentário', dados.comentario)}
                </div>
            </div>`)
        .join('')

    const elemento = `
        <div name="pdfChamado" style="${vertical}; width: 100%; height: 50vh; overflow: auto; padding: 2rem 0 2rem 0;">
            ${formulario}
            <div style="${horizontal}; width: 100%;">${tabela}</div>
            <br>
            <hr style="width: 90%;">
            <div style="${vertical}; width: 90%;">${historico}</div>
        </div>
        `

    const botoes = [
        { texto: 'Adicionar Peça', img: 'chamados', funcao: `criarLinhaPeca()` },
        { texto: 'Salvar', img: 'concluido', funcao: `enviarManutencao('${idManutencao}')` },
        { texto: 'PDF', img: 'pdf', funcao: `gerarPDFChamados()` },
    ]

    if (manutencao) botoes.push({ texto: 'Excluir Manutenção', img: 'cancel', funcao: `confirmarExclusaoManutencao('${idManutencao}')` })

    popup({ elemento, botoes, titulo: `Requisição de Materiais` })

    modoKit({ checked: kitTecnico })

    for (const [id, peca] of Object.entries(manutencao?.pecas || {})) {
        criarLinhaPeca(id, peca)
    }
}

function salvarPrimeiroUsuario(historico) {

    if (historico && dicionario(historico)) {
        const primeiraChave = Object.keys(historico)[0];
        return historico[primeiraChave].usuario
    }

    return historico;
}

async function gerarPDFChamados() {

    overlayAguarde()

    const manutencao = await recuperarDado('dados_manutencao', idManutencao) || {}
    const campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    const pessoas = ['tecnico', 'cliente']
    let divs = ''

    console.log(manutencao);


    if (!manutencao) return removerOverlay()

    for (const pessoa of pessoas) {

        let elementos = ''
        const codigo = manutencao[`codigo_${pessoa}`]

        if (codigo == '') continue

        const dados = await recuperarDado('dados_clientes', codigo) || {}

        campos.forEach(campo => {
            elementos += `<label style="text-align: left;"><strong>${campo.toUpperCase()}: </strong>${dados[campo]}</label>`
        })

        divs += `
            <div style="display: flex; flex-direction: column; aling-items: start; justify-content: left;">
                <label style="font-size: 1.5em;">${pessoa.toUpperCase()}</label>
                ${elementos}
            </div>
        `
    }

    let cabecalho = `
        <div style="display: flex; align-items: start; justify-content: left; gap: 5rem;">
            ${divs}
        </div>`

    let linhas = ''
    for (const [pc, peca] of Object.entries(manutencao?.pecas || {})) {

        const item = await recuperarDado('dados_estoque', pc) || {}

        linhas += `
        <tr>
            <td>${item.partnumber ?? "-"}</td>
            <td style="text-align: center;">${peca.quantidade}</td>
            <td>${peca.comentario ?? "-"}</td>
            <td>${peca.descricao ?? "-"}</td>
        </tr>
        `
    }

    const tabela = `
        <label style="font-size: 1.5em;">REQUISIÇÃO ${manutencao.chamado}</label>
        <table class="tabela">
            <thead>
                <th>Part Number</th>
                <th>Quantidade</th>
                <th>Comentário</th>
                <th>Descrição</th>
            </thead>
            <tbody>${linhas}</tbody>
        </table>
    `

    const html = `
        <html>

        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>
                body {
                    display: flex;
                    flex-direction: column;
                    justify-content: start;
                    align-items: start;
                    padding: 3vw;
                    gap: 10px;    
                    font-family: 'Poppins', sans-serif;
                    font-size: 1.0em;
                }

                table {
                    font-size: 1.0em;
                    border-collapse: collapse;
                }
                
                th {
                    background-color: #d2d2d2;
                }

                th, td {
                    border: 1px solid #222;
                    padding: 3px;
                }

                @media print {
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    header,
                    footer {
                        display: none !important;
                    }

                    .table-container {
                        margin-right: 0;
                    }
                }                    
            
            </style>
        </head>

        <body>
            <div style="width: 100%; display: flex; align-items: center; justify-content: start; gap: 20px;">
                <img src="https://i.imgur.com/qZLbNfb.png" style="width: 20vw; border-radius: 3px;">
                <label style="font-size: 2.0em;">Requisição de Materiais <br> Manutenção/Avulso</label>
            </div>
            <hr style="width: 90%;">
            ${cabecalho}
            <hr style="width: 90%;">
            ${tabela}
        </body>

        </html>
    `;

    const nome = `REQUISICAO ${manutencao?.chamado || 'Sem chamado'}`

    await gerarPdfOnline(html, nome);

    removerOverlay()
}

function infoAnexos(input) {

    const div = document.querySelector('.arquivos')
    div.innerHTML = ''
    for (const file of input.files) {
        div.innerHTML += `
        <div style="${horizontal}; gap: 10px;">
            <img src="imagens/anexo.png">
            <span>${String(file.name).slice(0, 15)}...</span>
        </div>
        `
    }
}

function criarLinhaPeca(id = ID5digitos(), peca) {

    const linhasManutencao = document.getElementById('linhasManutencao')

    controlesCxOpcoes[id] = {
        colunas: {
            'partnumber': { chave: 'partnumber' },
            'Descrição': { chave: 'descricao' },
            'Categoria': { chave: 'categoria' },
            'Marca': { chave: 'marca' }
        },
        retornar: ['descricao'],
        base: 'dados_estoque'
    }

    const tds = `
        <td>
            <div style="${horizontal}; justify-content: end; gap: 5px; width: 100%;">
                <span class="opcoes" id="${id}" name="${id}" onclick="cxOpcoes('${id}', 'dados_estoque', ['descricao', 'partnumber'])">${peca?.descricao || 'Selecione'}</span>
                <img data-modalidade="tradicional" src="imagens/ajustar.png" style="width: 1.2rem;" onclick="mudarEdicao(this)">
            </div>
        </td>
        <td>
            <input value="${peca?.quantidade || peca?.qtde || 0}">
        </td>
        <td>
            <textarea>${peca?.comentario || ''}</textarea>
        </td>
        <td><img src="imagens/cancel.png" onclick="this.parentElement.parentElement.remove()"></td>
    `
    const trExistente = document.getElementById(id)
    if (trExistente)
        return trExistente.innerHTML = tds

    linhasManutencao.insertAdjacentHTML('beforeend', `<tr id="${id}">${tds}</tr>`)
}

function mudarEdicao(img) {
    const modalidade = img.dataset.modalidade
    const cod = ID5digitos()
    let elemento = ""

    if (modalidade === "livre") {
        elemento = `<span class="opcoes" name="${cod}" onclick="cxOpcoes('${cod}', 'dados_estoque', ['descricao', 'partnumber'])">Selecione</span>`
    } else {
        elemento = `<textarea class="opcoes" name="${cod}"></textarea>`
    }

    img.dataset.modalidade = modalidade == 'livre' ? 'tradicional' : 'livre'
    img.previousElementSibling?.remove()
    img.insertAdjacentHTML("beforebegin", elemento)
}

async function enviarManutencao() {

    idManutencao = idManutencao || ID5digitos()

    overlayAguarde()

    const obVal = (name) => {
        const elemento = document.querySelector(`[name="${name}"]`)
        return elemento
    }

    let pecas = {}
    const tbody = document.getElementById('linhasManutencao')
    const trs = tbody.querySelectorAll('tr')
    for (const tr of trs) {
        const tds = tr.querySelectorAll('td')
        const codigo = tds[0].querySelector('.opcoes').getAttribute('name')
        const item = await recuperarDado('dados_estoque', codigo) || {}

        pecas[codigo] = {
            partnumber: item?.partnumber || '',
            descricao: tds[0].querySelector('.opcoes')?.textContent || tds[0].querySelector('.opcoes')?.value,
            quantidade: Number(tds[1].querySelector('input')?.value || 0),
            comentario: tds[2].querySelector('textarea')?.value || ''
        }
    }

    const manutencao = await recuperarDado('dados_manutencao', idManutencao) || {}
    let novaManutencao = {
        ...manutencao,
        usuario: acesso.usuario,
        previsao: obVal('previsao').value,
        status_manutencao: obVal('status_manutencao').value,
        nf: obVal('nf').value,
        data: new Date().toLocaleString('pt-BR'),
        comentario: obVal('comentario').value,
        chamado: obVal('chamado').value,
        codigo_cliente: obVal('cliente').id,
        codigo_tecnico: obVal('tecnico').id,
        pecas
    }

    const recorte = {
        comentario: novaManutencao.comentario,
        usuario: novaManutencao.usuario,
        data: novaManutencao.data,
        status_manutencao: novaManutencao.status_manutencao
    }

    if (!novaManutencao.historico) novaManutencao.historico = {}

    novaManutencao.historico[ID5digitos()] = recorte

    if (!novaManutencao.anexos) novaManutencao.anexos = {}

    const anexos = document.getElementById('anexos')
    const importacao = await importarAnexos({ anexos })

    for (const anexo of importacao) {
        novaManutencao.anexos[anexo.link] = anexo
    }

    await inserirDados({ [idManutencao]: novaManutencao }, 'dados_manutencao')
    enviar(`dados_manutencao/${idManutencao}`, novaManutencao)

    removerPopup()

}

function confirmarExclusaoManutencao(id) {

    const botoes = [
        { texto: 'Confirmar', img: '', funcao: `excluirManutencao('${id}')` }
    ]

    popup({ mensagem: 'Confirmar exclusão?', botoes, nra: true })

}

async function excluirManutencao(id) {

    await deletarDB('dados_manutencao', id)

    deletar(`dados_manutencao/${id}`)

}

function modoKit(input) {
    const chamado = document.querySelector('[name="chamado"]')
    const ativar = input.checked
    chamado.parentElement.parentElement.style.display = ativar ? 'none' : 'flex'
    chamado.value = ativar ? 'KIT TÉCNICO' : ''
}


async function excelChamados() {
    const tabela = document.querySelector('.tabela')
    if (!tabela) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Chamados')
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

function formatarData(dataISO) {
    if (!dataISO) return "--"; // Retorna um placeholder caso a data seja inválida ou vazia

    let partes = dataISO.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`; // Converte "YYYY-MM-DD" para "DD/MM/YYYY"
    }
    return dataISO; // Retorna a data original caso não esteja no formato esperado
}