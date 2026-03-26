
async function telaChamados() {

    mostrarMenus(false)

    const colunas = {
        'Última alteração': { chave: 'data', tipoPesquisa: 'data' },
        'Status': { chave: 'status_manutencao', tipoPesquisa: 'select' },
        'Chamado': { chave: 'chamado' },
        'Loja': { chave: 'snapshots.loja' },
        'Técnico': { chave: 'snapshots.tecnico' },
        'Último analista': { chave: 'usuario' },
        'Previsão': { chave: 'previsao' },
        'Ações': {}
    }

    const tabela = await modTab({
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
        </div>`

    tela.innerHTML = acumulado

    await carregarToolbarChamados()

    await paginacao()

    criarMenus('chamados')

}

function criarLinhaManutencao(manutencao) {

    const { id, data, status_manutencao, snapshots, previsao, usuario } = manutencao || {}
    const { tecnico, loja, departamento } = snapshots || {}

    const tds = `
        <td>${data || ''}</td>
        <td>${status_manutencao || '--'}</td>
        <td>${departamento || ''}</td>
        <td>
            <span style="text-align: left;">
                ${loja?.[0] || ''}<br>
                <b>${loja?.[1] || ''}</b>
                ${loja?.[2] || ''}<br>
            </span>
        </td>
        <td>
            <span style="text-align: left;">
                ${tecnico?.[0] || ''}<br>
                <b>${tecnico?.[1] || ''}</b>
                ${tecnico?.[2] || ''}<br>
            </span>
        </td>
        <td>${usuario || ''}</td>
        <td>
            ${formatarData(previsao) || ''}
        </td>
        <td style="text-align: center;">
            <img onclick="criarManutencao('${id}')" src="imagens/pesquisar2.png">
        </td>`

    return `<tr>${tds}</tr>`
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

async function criarManutencao(id = crypto.randomUUID()) {

    const manutencao = await recuperarDado('dados_manutencao', id) || {}
    const { snapshots } = manutencao
    const cliente = await recuperarDado('dados_clientes', manutencao?.codigo_cliente)
    const tecnico = await recuperarDado('dados_clientes', manutencao?.codigo_tecnico)

    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const tabela = `
        <div class="borda-tabela">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead><tr>${ths}</tr></thead>
                        <tbody id="linhasManutencao"></tbody>
                    </table>
                </div>
            <div class="rodape-tabela"></div>
        </div>`

    const opcoes = ['MANUTENÇÃO', 'EMITIR NOTA', 'REQUISIÇÃO AVULSA', 'MATERIAL SEPARADO', 'MATERIAL ENVIADO', 'FINALIZADO', 'REPROVADO']
        .map(op => `<option ${manutencao?.status_manutencao == op ? 'selected' : ''}>${op}</option>`)
        .join('')

    const modelo = (texto, elemento) => `
        <div style="${vertical}">
            <span><b>${texto}</b></span>
            <div class="manutencao-formulario">${elemento}</div>
        </div>`

    const kitTecnico = manutencao?.chamado == 'KIT TÉCNICO'

    controlesCxOpcoes.cliente = {
        base: 'dados_clientes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Endereço': { chave: 'endereco' }
        }
    }

    controlesCxOpcoes.tecnico = {
        base: 'dados_clientes',
        retornar: ['nome'],
        colunas: {
            'Nome': { chave: 'nome' },
            'CNPJ/CPF': { chave: 'cnpj' },
            'Cidade': { chave: 'cidade' },
            'Endereço': { chave: 'endereco' }
        }
    }

    controlesCxOpcoes.chamado = {
        base: 'departamentos_AC',
        retornar: ['descricao'],
        colunas: {
            'Departamento': { chave: 'descricao' },
        }
    }

    const historico = Object.values(manutencao?.historico || {})
        .map((dados) => `
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

    const linhas = [
        {
            texto: 'Cliente ou Loja',
            elemento: `
            <span ${manutencao?.codigo_cliente ? `id="${manutencao?.codigo_cliente}"` : ''} 
        class="opcoes" name="cliente" onclick="cxOpcoes('cliente')">${cliente?.nome || 'Selecione'}</span>`
        },
        {
            texto: 'Técnico',
            elemento: `<span ${manutencao?.codigo_tecnico ? `id="${manutencao?.codigo_tecnico}"` : ''} 
            class="opcoes" name="tecnico" onclick="cxOpcoes('tecnico')">${tecnico?.nome || 'Selecione'}</span>`
        },
        {
            texto: 'Chamado',
            elemento: `<span ${manutencao?.chamado ? `id="${manutencao?.chamado}"` : ''} 
            class="opcoes" name="chamado" onclick="cxOpcoes('chamado')">${snapshots?.departamento || 'Selecione'}</span>`
        },
        {
            texto: 'Kit Técnico',
            elemento: `<input ${kitTecnico ? 'checked' : ''} 
            name="kitTecnico" 
            type="checkbox" 
            style="width: 1.5rem; height: 1.5rem; cursor: pointer;" 
            onchange="verificarKit()">`
        },
        {
            texto: 'Comentário',
            elemento: `<textarea name="comentario" rows="7">${manutencao?.comentario || ''}</textarea>`
        },
        {
            texto: 'Incluir anexos',
            elemento: `
            <div style="${vertical}; align-items: end; gap: 5px;">
                <input type="file" id="anexos" multiple>
                <div id="lista-anexos" style="${vertical}; align-items: end;">
                    ${Object.values(manutencao?.anexos || {}).map((anexo) => criarAnexoVisual(anexo.nome, anexo.link, ``)).join('')}
                </div>
            </div>
            `
        },
        {
            texto: 'Status',
            elemento: `<select name="status_manutencao">${opcoes}</select>`
        },
        {
            texto: 'Previsão',
            elemento: `<input name="previsao" type="date" value="${manutencao?.previsao || ''}">`
        },
        {
            texto: 'NF',
            elemento: `<input name="nf" value="${manutencao?.nf || ''}">`
        },
        {
            elemento: tabela
        },
        {
            elemento: `<div style="${vertical}; gap: 2px; width: 100%;">${historico}</div>`
        }
    ]

    const botoes = [
        { texto: 'Adicionar Peça', img: 'chamados', funcao: `criarLinhaPeca()` },
        { texto: 'Salvar', img: 'concluido', funcao: `enviarManutencao('${id}')` },
        { texto: 'PDF', img: 'pdf', funcao: `gerarPDFChamados('${id}')` },
    ]

    if (manutencao)
        botoes.push({ texto: 'Excluir Manutenção', img: 'cancel', funcao: `confirmarExclusaoManutencao('${id}')` })

    popup({ linhas, botoes, titulo: `Requisição de Materiais`, autoDestruicao: ['cliente', 'tecnico'] })

    verificarKit()

    for (const [id, peca] of Object.entries(manutencao?.pecas || {})) {
        criarLinhaPeca(id, peca)
    }
}

function verificarKit() {

    const kit = document.querySelector('[name="kitTecnico"]')
    const cham = document.querySelector('[name="chamado"]')
    const linha = cham.closest('.linha-padrao')

    if (kit.checked) {
        linha.style.display = 'none'
        cham.removeAttribute('id')
        cham.textContent = 'Selecione'
    } else {
        linha.style.display = 'flex'
    }

}

function salvarPrimeiroUsuario(historico) {

    if (historico && dicionario(historico)) {
        const primeiraChave = Object.keys(historico)[0];
        return historico[primeiraChave].usuario
    }

    return historico;
}

async function gerarPDFChamados(idManutencao) {

    overlayAguarde()

    const manutencao = await recuperarDado('dados_manutencao', idManutencao) || {}
    const campos = ['nome', 'cnpj', 'bairro', 'cep', 'cidade', 'estado']
    const pessoas = ['tecnico', 'cliente']
    let divs = ''

    if (!manutencao)
        return removerOverlay()

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
                <span class="opcoes" id="${id}" name="${id}" onclick="cxOpcoes('${id}')">${peca?.descricao || 'Selecione'}</span>
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

    controlesCxOpcoes[cod] = {
        base: 'dados_estoque',
        retornar: ['descricao'],
        colunas: {
            'Descrição': { chave: 'descricao' },
            'Marca': { chave: 'marca' }
        }
    }

    if (modalidade === "livre") {
        elemento = `<span class="opcoes" name="${cod}" onclick="cxOpcoes('${cod}')">Selecione</span>`
    } else {
        elemento = `<textarea class="opcoes" name="${cod}"></textarea>`
    }

    img.dataset.modalidade = modalidade == 'livre' ? 'tradicional' : 'livre'
    img.previousElementSibling?.remove()
    img.insertAdjacentHTML("beforebegin", elemento)
}

async function enviarManutencao(idManutencao = crypto.randomUUID()) {

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

    const kit = obVal('kitTecnico').checked
    const chamado = kit
        ? 'KIT TÉCNICO'
        : obVal('chamado')?.id || null

    if (!chamado)
        return popup({ mensagem: 'Escolha um chamado ou marque como KIT TÉCNICO' })

    const manutencao = await recuperarDado('dados_manutencao', idManutencao) || {}
    const comentario = obVal('comentario').value
    const previsao = obVal('previsao').value

    if (!previsao)
        return popup({ mensagem: 'Defina uma data de previsão' })

    const novaManutencao = {
        ...manutencao,
        id: idManutencao,
        usuario: acesso.usuario,
        previsao,
        status_manutencao: obVal('status_manutencao').value,
        nf: obVal('nf').value,
        data: new Date().toLocaleString('pt-BR'),
        comentario,
        chamado,
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

    novaManutencao.historico ??= {}

    novaManutencao.historico[ID5digitos()] = recorte

    novaManutencao.anexos ??= {}

    const input = document.getElementById('anexos')
    const importacao = await importarAnexos({ input })

    for (const anexo of importacao) {
        novaManutencao.anexos[anexo.link] = anexo
    }

    await inserirDados({ [idManutencao]: novaManutencao }, 'dados_manutencao')
    enviar(`dados_manutencao/${idManutencao}`, novaManutencao)

    // Ações para esta manutenção;
    const acao = {
        id: idManutencao,
        origem: {
            id: idManutencao,
            base: 'dados_manutencao',
            titulo: 'REQUISIÇÃO AVULSA'
        },
        responsavel: [
            'Tayna',
            'Emmanoel'
        ],
        status: 'pendente',
        prazo: previsao,
        acao: comentario,
        usuario: acesso.usuario,
        registro: Date.now()
    }

    await inserirDados({ [idManutencao]: acao }, 'acoes')
    enviar(`acoes/${idManutencao}`, acao)

    removerPopup()

}

function confirmarExclusaoManutencao(id) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirManutencao('${id}')` }
    ]

    popup({ mensagem: 'Confirmar exclusão?', botoes, nra: false })

}

async function excluirManutencao(id) {

    await deletarDB('dados_manutencao', id)
    deletar(`dados_manutencao/${id}`)

    // Caso exista ação;
    await deletarDB('acoes', id)
    deletar(`acoes/${id}`)

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