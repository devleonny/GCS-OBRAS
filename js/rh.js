let tituloRH = null
let pastaAberta = null

const modeloRH = (valor1, elemento, funcao) => {
    return `
    <div style="${horizontal}; justify-content: space-between; width: 100%; margin-left: 5px;">
        <label>${valor1}:</label>
        ${elemento}
        ${funcao ? `<img onclick="${funcao}" src="imagens/concluido.png" style="display: none; width: 1.5vw;">` : ''}
    </div>
`}

async function telaRH() {

    mostrarMenus(false)

    criarMenus('rh')

    let stringPessoas = ''

    for (const [idPessoa, dados] of Object.entries(db.pessoas)) {

        const pastas = db.pessoas[idPessoa]?.pastas || {}

        const stringPastas = Object.entries(pastas)
            .map(([idPasta, pasta]) => `
                <div class="btnPessoas" onclick="abrirPastas('${idPessoa}', '${idPasta}')">
                    <img src="imagens/pasta.png">
                    <span>${pasta.nomePasta}</span>
                </div>`).join('')

        stringPessoas += `
        <div style="${vertical}; width: 100%;">
            <div class="btnPessoas" onclick="mostrarPastas('${idPessoa}', '${dados.nome}')">
                <img src="imagens/pasta.png">
                <span>${dados.nome}</span>
                <img src="imagens/baixar.png" onclick="adicionarPasta('${idPessoa}')" style="width: 1.2rem;">
            </div>
            <div id="${idPessoa}" style="display: none; justify-content: start; flex-direction: column; align-items: start; margin-left: 2vw; width: 90%;">
                ${stringPastas}
            </div>
        </div>
        `
    }

    const acumulado = `
        <div class="tela-rh">
            <div class="esquema-pessoas">${stringPessoas}</div>
            <div class="divPessoas"></div>
        </div>
    `

    const esquema = document.querySelector('.esquema-pessoas')
    if(!esquema) tela.innerHTML = acumulado

    document.querySelector('.esquema-pessoas').innerHTML = stringPessoas

    if (pastaAberta) mostrarPastas(pastaAberta)

    await telaRHTabela()
}

async function mostrarPastas(idPessoa) {

    pastaAberta = idPessoa
    const elemento = document.getElementById(`${idPessoa}`)
    elemento.style.display = elemento.style.display == 'none' ? 'flex' : 'none'

}

function confirmarExclusaoPessoa(idPessoa, nome) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPessoaRH('${idPessoa}')` }
    ]

    popup({ elemento: `Tem certeza que deseja excluir ${nome}?`, botoes })

}

async function excluirPessoaRH(idPessoa) {

    removerPopup()

    overlayAguarde()

    await deletarDB('pessoas', idPessoa)

    await deletar(`pessoas/${idPessoa}`)

    await telaRH()

    removerOverlay()

}

async function abrirPastas(idPessoa, idPasta) {

    const pessoa = db.pessoas[idPessoa]
    const pasta = pessoa.pastas[idPasta]
    const anexos = pasta?.anexos || {}

    let arquivos = { 'Não classificados': '' }

    for (const [idAnexo, anexo] of Object.entries(anexos)) {

        if (!anexo.doc) {
            arquivos['Não classificados'] += await pastaHTML(idPessoa, idPasta, idAnexo)
            continue
        }

        if (!arquivos[anexo.doc]) arquivos[anexo.doc] = ''

        arquivos[anexo.doc] += `
            <div style="${horizontal}; gap: 5px;">
                <img src="imagens/anexo2.png" style="width: 1.5vw;">
                <span style="color: white;">${anexo.validade}</span>
            </div>
        `
    }

    let esquemaHTML = ''
    for (const idAnexo of Object.keys(anexos)) esquemaHTML += await pastaHTML(idPessoa, idPasta, idAnexo)

    const elemento = `
        <div class="painel-pessoa">
            <div style="${horizontal}; gap: 5px;">

                <label>${pessoa.nome} > ${pasta.nomePasta}</label>

                <img src="imagens/editar.png" style="width: 1.8rem;" onclick="adicionarPasta('${idPessoa}', '${idPasta}')">

                <label for="anexo" style="${horizontal};">
                    <img src="imagens/anexo.png" style="width: 1.8rem;">
                    <input type="file" style="display: none;" id="anexo" onchange="adicionarAnexo(this, '${idPessoa}', '${idPasta}')">
                </label>

                <img src="imagens/cancel.png" style="width: 1.8rem;" onclick="confirmarExclusaoPasta('${idPessoa}', '${idPasta}')">
            </div>
            <div class="pessoas">
                ${esquemaHTML}
            </div>
        </div>
    `

    const painel = document.querySelector('.painel-pessoa')
    if (painel) return painel.innerHTML = acumulado

    popup({ elemento, titulo: pessoa.nome })

}

async function pastaHTML(idPessoa, idPasta, idAnexo, mostrarPopup) {

    const pessoa = await recuperarDado('pessoas', idPessoa)
    const anexo = pessoa.pastas[idPasta].anexos[idAnexo]

    const funcao = (campo) => `salvarDadosDocumento('${campo}', '${idPessoa}', '${idPasta}', '${idAnexo}')`
    const opcoesDocs = ['', 'ASO', 'NR 06 - EPI', 'NR 10', 'NR 35', 'PTA']
        .map(op => `<option ${anexo?.doc == op ? 'selected' : ''}>${op}</option>`).join('')

    const pasta = `
        <div class="pasta">
            <div class="aba">
                <select id="doc_${idAnexo}" onchange="calcularVencimento('${idPessoa}', '${idPasta}', '${idAnexo}', 'doc')">${opcoesDocs}</select>
            </div>
            <div class="blocoRH">
                ${modeloRH('Realizado', `<input id="emissao_${idAnexo}" type="date" onchange="calcularVencimento('${idPessoa}', '${idPasta}', '${idAnexo}');" value="${anexo?.emissao || ''}">`)}
                ${modeloRH('Validade', `<input id="validade_${idAnexo}" type="date" onchange="${funcao('validade')}" value="${anexo?.validade || ''}">`)}
                ${modeloRH('Local', `<input id="local_${idAnexo}" oninput="mostrarBtnRH(this)" placeholder="Localidade" value="${anexo?.local || ''}">`, funcao('local'))}
                ${modeloRH('Clínica', `<input id="clinica_${idAnexo}" oninput="mostrarBtnRH(this)" placeholder="Nome da Clínica" value="${anexo?.clinica || ''}">`, funcao('clinica'))}
                ${modeloRH('Contato', `<input id="contato_${idAnexo}" oninput="mostrarBtnRH(this)" placeholder="Tel/E-mail" value="${anexo?.contato || ''}">`, funcao('contato'))}
                <div style="${horizontal}; justify-content: space-between; width: 100%;">
                    ${criarAnexoVisual(anexo.nome, anexo.link)}
                    ${botao('Excluir', `confirmarExclusaoAnexo('${idPessoa}', '${idPasta}', '${idAnexo}')`, '#B12425')}
                </div>
            </div>
        </div>
    `

    if (!mostrarPopup) return pasta

    const elemento = `
        <div style="${horizontal};">
            ${pasta}
        </div>
    `
    popup({ elemento, titulo: pessoa.pastas[idPasta].nomePasta })
}

async function calcularVencimento(idPessoa, idPasta, idAnexo, campo) {

    const emissao = document.getElementById(`emissao_${idAnexo}`)
    const data = new Date(emissao.value)
    const tipo = document.getElementById(`doc_${idAnexo}`).value
    const validade = document.getElementById(`validade_${idAnexo}`)

    const [ano] = emissao.value.split('-')
    if (Number(ano) < 2000) return

    let periodo = 365
    if (tipo === 'NR 10' || tipo === 'NR 35') periodo = 730

    const dataVencimento = new Date(data)
    dataVencimento.setDate(dataVencimento.getDate() + periodo)

    if (campo == 'doc') await salvarDadosDocumento('doc', idPessoa, idPasta, idAnexo)

    try {
        validade.value = dataVencimento.toISOString().slice(0, 10) // yyyy-mm-dd
    } catch {
        return
    }

    await salvarDadosDocumento('emissao', idPessoa, idPasta, idAnexo)
    await salvarDadosDocumento('validade', idPessoa, idPasta, idAnexo)

}

function confirmarExclusaoPasta(idPessoa, idPasta) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirPastaRH('${idPessoa}', '${idPasta}')` }
    ]

    popup({ elemento: 'Deseja excluir esta pasta?', botoes })

}

async function excluirPastaRH(idPessoa, idPasta) {

    removerPopup()

    overlayAguarde()

    let pessoa = await recuperarDado('pessoas', idPessoa)

    delete pessoa.pastas[idPasta]

    await deletar(`pessoas/${idPessoa}/pastas/${idPasta}`)

    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

    await telaRH()

    removerPopup()

}

function mostrarBtnRH(input) {
    input.nextElementSibling.style.display = 'block'
}

async function salvarDadosDocumento(campo, idPessoa, idPasta, idAnexo) {

    const elemento = document.getElementById(`${campo}_${idAnexo}`)

    // Apenas seguir se for campo de data e a data for válida
    const data = new Date(elemento.value)
    const [ano] = elemento.value.split('-')

    if ((campo === 'validade' || campo === 'emissao') && Number(ano) < 2000) return

    overlayAguarde()

    if (campo == 'clinica' || campo == 'local' || campo == 'contato') elemento.nextElementSibling.style.display = 'none'

    const valor = elemento.value
    let pessoa = await recuperarDado('pessoas', idPessoa)
    let pasta = pessoa.pastas[idPasta]
    let anexo = pasta.anexos[idAnexo]

    anexo[campo] = valor

    await enviar(`pessoas/${idPessoa}/pastas/${idPasta}/anexos/${idAnexo}/${campo}`, valor)
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

    carregarLinha({ idPessoa, idPasta, idAnexo, pessoa })

    removerOverlay()

}

function confirmarExclusaoAnexo(idPessoa, idPasta, idAnexo) {

    const botoes = [
        { texto: 'Confirmar', img: 'concluido', funcao: `excluirAnexoRH('${idPessoa}', '${idPasta}', '${idAnexo}')` }
    ]

    popup({ elemento: 'Deseja excluir este anexo?', botoes })

}

async function excluirAnexoRH(idPessoa, idPasta, idAnexo) {

    removerPopup()

    overlayAguarde()

    let pessoa = await recuperarDado('pessoas', idPessoa)

    delete pessoa.pastas[idPasta].anexos[idAnexo]

    await deletar(`pessoas/${idPessoa}/pastas/${idPasta}/anexos/${idAnexo}`)

    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

    await abrirPastas(idPessoa, idPasta)

    removerOverlay()

}

async function adicionarAnexo(input, idPessoa, idPasta) {

    overlayAguarde()

    const anexos = await importarAnexos({ input })

    let pessoa = await recuperarDado('pessoas', idPessoa)
    let pasta = pessoa.pastas[idPasta]

    if (!pasta.anexos) pasta.anexos = {}

    const idAnexo = ID5digitos()
    pasta.anexos[idAnexo] = anexos[0]

    await enviar(`pessoas/${idPessoa}/pastas/${idPasta}/anexos/${idAnexo}`, anexos[0])
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

    await abrirPastas(idPessoa, idPasta)

    removerOverlay()
}

async function adicionarPasta(idPessoa, idPasta) {

    const funcao = idPasta ? `salvarPasta('${idPessoa}', '${idPasta}')` : `salvarPasta('${idPessoa}')`
    const pessoa = await recuperarDado('pessoas', idPessoa)
    const pasta = pessoa?.pastas?.[idPasta] || {}

    const elemento = `
        <div style="${horizontal};">

            <input style="padding: 5px; border-radius: 3px;" id="nomePasta" placeholder="Nome" value="${pasta?.nomePasta || ''}">
            <button onclick="${funcao}">Salvar</button>

        </div>
    `
    popup({ elemento, titulo: 'Gerenciar Pasta' })
}

async function salvarPasta(idPessoa, idPasta) {

    overlayAguarde()

    idPasta = idPasta ? idPasta : ID5digitos()
    const nomePasta = document.getElementById('nomePasta').value
    let pessoa = await recuperarDado('pessoas', idPessoa)

    if (!pessoa.pastas) pessoa.pastas = {}
    if (!pessoa.pastas[idPasta]) pessoa.pastas[idPasta] = {}

    pessoa.pastas[idPasta].nomePasta = nomePasta

    await enviar(`pessoas/${idPessoa}/pastas/${idPasta}/nomePasta`, nomePasta)
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')
    await telaRH()

    removerPopup()

}

async function adicionarPessoa(idPessoa) {

    const pessoa = await recuperarDado('pessoas', idPessoa) || {}

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: idPessoa ? `salvarPessoa('${idPessoa}')` : 'salvarPessoa()' }
    ]

    const linhas = [
        {texto: 'Nome', elemento: `<input id="nome" value="${pessoa?.nome || ''}">`}
    ]
    
    popup({ botoes, linhas, titulo: 'Gerenciar Local' })
}

async function salvarPessoa(idPessoa) {

    overlayAguarde()

    idPessoa = idPessoa ? idPessoa : ID5digitos()
    const nome = document.getElementById('nome').value

    let pessoa = await recuperarDado('pessoas', idPessoa) || {}

    pessoa.nome = nome

    await enviar(`pessoas/${idPessoa}/nome`, nome)
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')
    await telaRH()

    removerPopup()

}

function expiraEm(dataString) {

    let dias = '--'

    if (dataString !== '--') {

        const dataInformada = new Date(dataString)
        const hoje = new Date()

        dataInformada.setHours(0, 0, 0, 0)
        hoje.setHours(0, 0, 0, 0)

        const diferencaMs = dataInformada - hoje
        dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24))

    } else {
        dias = dataString
    }

    let icone = 'gifs/interrogacao.gif'
    let status = 'Desconhecido'
    if (dias < 30) {
        icone = 'imagens/offline.png'
        status = 'Vencido'
    } else if (dias < 60) {
        icone = 'imagens/pendente.png'
        status = 'Próximo'
    } else if (dias >= 60) {
        icone = 'imagens/online.png'
        status = 'Ativo'
    }

    return { dias, icone, status }
}

async function telaRHTabela() {

    let colunas = {
        th: '',
        thPesquisa: ''
    }

    const campos = ['Nome & Grupo', 'Estado', 'Clínica', 'Validade', 'Expiração', 'Arquivo']
        .map((op, col) => {

            let pesquisa = `
                <input style="padding: 5px;" placeholder="${inicialMaiuscula(op)}" oninput="pesquisarGenerico('${col}', this.value, 'bodyRH')">
            `

            if (op == 'Expiração') {
                pesquisa = `<select style="cursor: pointer;" oninput="pesquisarGenerico('${col}', this.value, 'bodyRH')">
                    ${['', 'Desconhecido', 'Próximo', 'Vencido', 'Ativo'].map(op2 => `<option>${op2}</option>`).join('')}
                </select>`
            }

            colunas.thPesquisa += `
            <th style="background-color: white; padding: 0px;">
                <div style="${horizontal}">
                    ${pesquisa}
                </div>
            </th>
            `
            colunas.th += `<th>${op}</th>`
        })


    const acumulado = `
        <div class="blocoTabela">
            <div class="painelBotoes">

                <div style="${horizontal}; justify-content: end; width: 100%; gap: 5px;">
                    <label>Todos</label>
                    <input type="checkbox" onclick="marcarTodosRH(this)" style="width: 1.5rem;">
                    <button onclick="baixarArquivos()">Baixar</button>
                </div>

            </div>
            <div class="recorteTabela">
                <table class="tabela">
                    <thead>
                        <tr>${colunas.th}</tr>
                        <tr>${colunas.thPesquisa}</tr>
                    </thead>
                    <tbody id="bodyRH"></tbody>
                </table>
            </div>

            <div class="rodape-tabela"></div>
        </div>
    `

    const divPessoas = document.querySelector('.divPessoas')
    divPessoas.innerHTML = acumulado

    // Pessoas nesse contexto foi mudado para cidade-estado;
    for (const [idPessoa, pessoa] of Object.entries(db.pessoas)) {

        const pastas = pessoa?.pastas || {}

        for (const [idPasta, pasta] of Object.entries(pastas)) {

            const anexos = pasta?.anexos || {}

            for (const [idAnexo,] of Object.entries(anexos)) {
                carregarLinha({ idPessoa, idPasta, idAnexo, pessoa })
            }
        }
    }

}

function carregarLinha({ idPessoa, idPasta, idAnexo, pessoa }) {

    const pasta = pessoa.pastas[idPasta]
    const anexo = pasta.anexos[idAnexo]
    const validade = anexo?.validade || '--'
    const tempoExpiracao = expiraEm(validade)

    const dt = (data) => {
        if (!data) return '--'
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    const linha = `
        <td>
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <img src="imagens/pasta.png" style="width: 1.8rem; cursor: pointer;" onclick="pastaHTML('${idPessoa}', '${idPasta}', '${idAnexo}', true)">
                <label style="text-align: left;">${pasta.nomePasta}</label>
            </div>
        </td>
        <td>${pessoa.nome}</td>
        <td style="text-align: left;">
            <input style="display: none;" value="${pessoa.nome}">
            ${anexo?.clinica || '--'}<br>
            <strong>${anexo?.local || ''}</strong>
        </td>
        <td>${dt(anexo.validade)}</td>
        <td>
            <input style="display: none;" value="${tempoExpiracao.status}">
            <div style="${horizontal}; justify-content: left; gap: 5px;">
                <img src="${tempoExpiracao.icone}" style="width: 1.2rem;">
                <label>${tempoExpiracao.dias}</label>
            </div>
        </td>
        <td>
            <input value="${anexo?.doc || '--'}" style="display: none;">
            <div style="${horizontal}; justify-content: start; gap: 5px;">
                <input data-url="${anexo.link}" data-nome="${anexo.nome}" name="docs" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                <div class="capsula">
                    <div class="esquerda">
                        ${anexo?.doc || '--'}
                    </div>
                    <div class="direita" title="${anexo.nome}" onclick="abrirArquivo('${anexo.link}')">
                        Ver
                    </div>
                </div>
            </div>
        </td>`

    const linhaAnexo = document.getElementById(idAnexo)

    if (linhaAnexo) return linhaAnexo.innerHTML = linha

    const bodyRH = document.getElementById('bodyRH')
    bodyRH.insertAdjacentHTML('beforeend', `
        <tr id="${idAnexo}">
            ${linha}
        </tr>`)
}

function marcarTodosRH(input) {

    const checks = document.querySelectorAll('[name=docs]')

    for (const check of checks) {
        const tr = check.closest('tr')
        if (tr.style.display !== 'none') check.checked = input.checked
    }

}

async function baixarArquivos() {

    overlayAguarde()

    const checkboxes = document.querySelectorAll('[name=docs]:checked')
    if (checkboxes.length === 0) return popup({ mensagem: 'Nenhum arquivo selecionado' })

    const zip = new JSZip()

    for (let i = 0; i < checkboxes.length; i++) {
        const url = `${api}/uploads/GCS/${checkboxes[i].dataset.url}`
        const nomeArquivo = checkboxes[i].dataset.nome

        const response = await fetch(url)
        const blob = await response.blob()

        zip.file(nomeArquivo, blob)
    }

    const conteudoZip = await zip.generateAsync({ type: 'blob' })

    removerOverlay()

    saveAs(conteudoZip, 'documentos.tar')
}

async function rhExcel() {

    const telaRH = document.querySelector('.divPessoas')
    if (!telaRH) return popup({ mensagem: 'Para gerar esse excel, vá até a tela de RH' })

    const tabela = document.querySelector('.tabela')
    if (!tabela) return popup({ mensagem: 'Tabela não encontrada' })

    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('Dados')

    // Cabeçalhos
    const cabecalhos = [...tabela.querySelectorAll('thead th')].map(th => th.innerText.trim())
    planilha.addRow(cabecalhos)

    // Linhas
    const linhas = tabela.querySelectorAll('tbody tr')
    linhas.forEach(tr => {
        const dados = [...tr.querySelectorAll('td')].map(td => {
            const input = td.querySelector('input')
            return input ? input.value.trim() : td.innerText.trim()
        })
        planilha.addRow(dados)
    })

    // Gera o Excel
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `RH.xlsx`
    link.click()
}
