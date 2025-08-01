const painelCentral = document.querySelector('.painelCentral')
const tituloRH = document.querySelector('.tituloRH')
let filtrosRH = {}
let pessoas = {}

const modeloRH = (valor1, elemento, funcao) => {
    return `
    <div style="${horizontal}; justify-content: space-between; width: 100%; margin-left: 5px;">
        <label>${valor1}:</label>
        ${elemento}
        ${funcao ? `<img onclick="${funcao}" src="imagens/concluido.png" style="display: none; width: 1.5vw;">` : ''}
    </div>
`}

carregarEsquema()

async function carregarEsquema() {

    painelCentral.innerHTML = ''
    tituloRH.innerHTML = ''

    await sincronizarDados('pessoas')
    pessoas = await recuperarDados('pessoas')

    let stringPessoas = ''

    for (const [idPessoa, dados] of Object.entries(pessoas)) {

        const pastas = pessoas[idPessoa]?.pastas || {}

        const stringPastas = Object.entries(pastas)
            .map(([idPasta, pasta]) => `
                <div class="btnPessoas" onclick="abrirPastas('${idPessoa}', '${idPasta}')">
                    <img src="imagens/pasta.png">
                    ${pasta.nomePasta}
                </div>`).join('')

        stringPessoas += `
        <div style="${vertical}; width: 100%;">
            <div class="btnPessoas" onclick="mostrarPastas('${idPessoa}', '${dados.nome}')">
                <img src="imagens/pasta.png">
                <div style="${vertical}; gap: 3px;">
                    <span style="font-size: 0.9vw;">${dados.nome}</span>
                </div>
            </div>
            <div id="${idPessoa}" style="display: none; justify-content: start; flex-direction: column; align-items: start; margin-left: 2vw; width: 90%;">
                ${stringPastas}
            </div>
        </div>
        `
    }

    const divPessoas = document.querySelector('.divPessoas')
    divPessoas.innerHTML = stringPessoas

}

async function mostrarPastas(idPessoa, nome) {

    tituloRH.innerHTML = `
        <div style="${horizontal}; gap: 1vw;">
            <label>${nome}</label>
            <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" onclick="adicionarPessoa('${idPessoa}')">
            <img src="imagens/pasta.png" style="width: 2vw; cursor: pointer;" onclick="adicionarPasta('${idPessoa}')">
            <img src="imagens/lixeira.png" style="width: 2vw; cursor: pointer;" onclick="confirmarExclusaoPessoa('${idPessoa}', '${nome}')">
        </div>
    `

    painelCentral.innerHTML = ''

    const elemento = document.getElementById(`${idPessoa}`)
    elemento.style.display = elemento.style.display == 'none' ? 'flex' : 'none'

}

function confirmarExclusaoPessoa(idPessoa, nome) {

    const acumulado = `
        <div style="${horizontal}; padding: 2vw; background-color: #d2d2d2; gap: 1vw;">
            <label>Tem certeza que deseja excluir ${nome}?</label>
            ${botao('Confirmar', `excluirPessoaRH('${idPessoa}')`, 'green')}
        </div>
    `

    popup(acumulado, 'ALERTA')

}

async function excluirPessoaRH(idPessoa) {

    removerPopup()

    overlayAguarde()

    await deletarDB('pessoas', idPessoa)

    await deletar(`pessoas/${idPessoa}`)

    await carregarEsquema()

    removerOverlay()

}

async function abrirPastas(idPessoa, idPasta) {

    pessoas = await recuperarDados('pessoas')

    const pessoa = pessoas[idPessoa]
    const pasta = pessoa.pastas[idPasta]
    const anexos = pasta?.anexos || {}

    tituloRH.innerHTML = `
        <div style="${horizontal}; gap: 1vw;">

            <label>${pessoa.nome} > ${pasta.nomePasta}</label>

            <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" onclick="adicionarPasta('${idPessoa}', '${idPasta}')">

            <label for="anexo" style="${horizontal};">
                <img src="imagens/anexo2.png" style="width: 2vw; cursor: pointer;">
                <input type="file" style="display: none;" id="anexo" onchange="adicionarAnexo(this, '${idPessoa}', '${idPasta}')">
            </label>

            <img src="imagens/lixeira.png" style="width: 2vw; cursor: pointer;" onclick="confirmarExclusaoPasta('${idPessoa}', '${idPasta}')">
        </div>
    `

    let stringAnexos = ''
    for (const idAnexo of Object.keys(anexos)) stringAnexos += await pastaHTML(idPessoa, idPasta, idAnexo)

    painelCentral.style.display = 'grid'
    painelCentral.innerHTML = stringAnexos

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
                <select id="doc_${idAnexo}" onchange="calcularVencimento('${idPessoa}', '${idPasta}', '${idAnexo}'); ${funcao('doc')}">${opcoesDocs}</select>
            </div>
            <div class="blocoRH">
                ${modeloRH('Realizado', `<input id="emissao_${idAnexo}" type="date" onchange="calcularVencimento('${idPessoa}', '${idPasta}', '${idAnexo}');" value="${anexo?.emissao || ''}">`)}
                ${modeloRH('Validade', `<input id="validade_${idAnexo}" type="date" onchange="${funcao('validade')}" value="${anexo?.validade || ''}">`)}
                ${modeloRH('Local', `<input id="local_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Localidade" value="${anexo?.local || ''}">`, funcao('local'))}
                ${modeloRH('Clínica', `<input id="clinica_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Nome da Clínica" value="${anexo?.clinica || ''}">`, funcao('clinica'))}
                ${modeloRH('Contato', `<input id="contato_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Tel/E-mail" value="${anexo?.contato || ''}">`, funcao('contato'))}
                <div style="${horizontal}; justify-content: space-between; width: 100%;">
                    ${criarAnexoVisual(anexo.nome, anexo.link)}
                    ${botao('Excluir', `confirmarExclusaoAnexo('${idPessoa}', '${idPasta}', '${idAnexo}')`, '#B12425')}
                </div>
            </div>
        </div>
    `

    if (!mostrarPopup) return pasta

    const acumulado = `
        <div style="${horizontal}; padding: 2vw; background-color: #d2d2d2;">
            ${pasta}
        </div>
    `
    popup(acumulado, pessoa.pastas[idPasta].nomePasta, true)
}

async function calcularVencimento(idPessoa, idPasta, idAnexo) {

    const emissao = document.getElementById(`emissao_${idAnexo}`)
    const data = new Date(emissao.value)
    const tipo = document.getElementById(`doc_${idAnexo}`).value
    const validade = document.getElementById(`validade_${idAnexo}`)

    let periodo = 365
    if (tipo === 'NR 10' || tipo === 'NR 35') periodo = 730

    const dataVencimento = new Date(data)
    dataVencimento.setDate(dataVencimento.getDate() + periodo)

    try {
        validade.value = dataVencimento.toISOString().slice(0, 10) // yyyy-mm-dd
    } catch {
        return
    }

    await salvarDadosDocumento('emissao', idPessoa, idPasta, idAnexo)
    await salvarDadosDocumento('validade', idPessoa, idPasta, idAnexo)

}

function confirmarExclusaoPasta(idPessoa, idPasta) {

    const acumulado = `
        <div style="${horizontal}; padding: 2vw; background-color: #d2d2d2; gap: 1vw;">
            <label>Tem certeza que deseja excluir esta pasta?</label>
            ${botao('Confirmar', `excluirPastaRH('${idPessoa}', '${idPasta}')`, 'green')}
        </div>
    `

    popup(acumulado, 'ALERTA')

}

async function excluirPastaRH(idPessoa, idPasta) {

    removerPopup()

    overlayAguarde()

    let pessoa = await recuperarDado('pessoas', idPessoa)

    delete pessoa.pastas[idPasta]

    await deletar(`pessoas/${idPessoa}/pastas/${idPasta}`)

    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

    await carregarEsquema()

    removerOverlay()

}

function mostrarBtn(input) {
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

    const acumulado = `
        <div style="${horizontal}; padding: 2vw; background-color: #d2d2d2; gap: 1vw;">
            <label>Tem certeza que deseja excluir este anexo?</label>
            ${botao('Confirmar', `excluirAnexoRH('${idPessoa}', '${idPasta}', '${idAnexo}')`, 'green')}
        </div>
    `

    popup(acumulado, 'ALERTA')

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

    const anexos = await importarAnexos(input)

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

    const acumulado = `
    <div style="padding: 2vw; background-color: #d2d2d2;">
        ${modeloRH('Nome da Pasta', `<input id="nomePasta" value="${pasta?.nomePasta || ''}">`)}
        <hr style="width: 100%;">
        ${botao('Salvar', funcao, 'green')}
    </div>
    `
    popup(acumulado, 'Gerenciar Pasta')
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
    await carregarEsquema()

    removerPopup()

}

async function adicionarPessoa(idPessoa) {

    const pessoa = await recuperarDado('pessoas', idPessoa) || {}

    const acumulado = `
    <div style="padding: 2vw; background-color: #d2d2d2;">
        ${modeloRH('Nome', `<input id="nome" value="${pessoa?.nome || ''}">`)}
        <hr style="width: 100%;">
        ${botao('Salvar', idPessoa ? `salvarPessoa('${idPessoa}')` : 'salvarPessoa()', 'green')}
    </div>
    `
    popup(acumulado, 'Gerenciar Local')
}

async function salvarPessoa(idPessoa) {

    overlayAguarde()

    idPessoa = idPessoa ? idPessoa : ID5digitos()
    const nome = document.getElementById('nome').value

    let pessoa = await recuperarDado('pessoas', idPessoa) || {}

    pessoa.nome = nome

    await enviar(`pessoas/${idPessoa}/nome`, nome)
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')
    await carregarEsquema()

    removerPopup()

}

function expiraEm(dataString) {

    let dias = '--'

    if (dataString !== '--') {

        const [ano, mes, dia] = dataString.split('-')
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

async function carregarEsquemaTabela() {

    const tituloRH = document.querySelector('.tituloRH')
    tituloRH.innerHTML = `
        <div style="${horizontal}; gap: 1vw;">
            <img src="imagens/duplicar.png" style="width: 2vw;">
            <span>Documentos</span>
        </div>
    `

    pessoas = await recuperarDados('pessoas')
    let colunas = {
        th: '',
        thPesquisa: ''
    }

    const campos = ['Nome & Grupo', 'Estado', 'Clínica', 'Validade', 'Expiração', 'Arquivo']
        .map((op, col) => {

            let pesquisa = `
                <input placeholder="${inicialMaiuscula(op)}" oninput="pesquisarGenerico('${col}', this.value, filtrosRH, 'bodyRH')">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw;">
            `

            if (op == 'Expiração') {
                pesquisa = `<select style="cursor: pointer;" oninput="pesquisarGenerico('${col}', this.value, filtrosRH, 'bodyRH')">
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

    let linhas = ''

    // Pessoas nesse contexto foi mudado para cidade-estado;
    for (const [idPessoa, pessoa] of Object.entries(pessoas)) {

        const pastas = pessoa?.pastas || {}

        for (const [idPasta, pasta] of Object.entries(pastas)) {

            const anexos = pasta?.anexos || {}

            for (const [idAnexo, anexo] of Object.entries(anexos)) {
                linhas += carregarLinha({ idPessoa, idPasta, idAnexo, pessoa })
            }
        }
    }

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes" style="align-items: center; justify-content: center;">
                <label style="width: 80%; text-align: center;">Controle de Documentos</label>

                <div style="${horizontal}; width: 20%; gap: 5px;">
                    <label>Todos</label>
                    <input type="checkbox" onclick="marcarTodos(this)" style="width: 1.5vw; height: 1.5vw;">
                    ${botao('Baixar', `baixarArquivos()`, 'green')}
                </div>
            </div>
            <div style="${vertical}; height: max-content; max-height: 70vh; overflow-y: auto;">
                <table class="tabela">
                    <thead>
                        <tr>${colunas.th}</tr>
                        <tr>${colunas.thPesquisa}</tr>
                    </thead>
                    <tbody id="bodyRH">
                        ${linhas}
                    </tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `

    painelCentral.style.display = 'flex'
    painelCentral.innerHTML = acumulado

}

function carregarLinha({ idPessoa, idPasta, idAnexo, pessoa }) {

    const pasta = pessoa.pastas[idPasta]
    const anexo = pasta.anexos[idAnexo]
    const validade = anexo?.validade || '--'
    const tempoExpiracao = expiraEm(validade)
    const opcoesDocs = ['', 'ASO', 'NR 06 - EPI', 'NR 10', 'NR 35', 'PTA']
        .map(op => `<option ${anexo?.doc == op ? 'selected' : ''}>${op}</option>`).join('')

    const dt = (data) => {
        if (!data) return '--'
        const [ano, mes, dia] = data.split('-')
        return `${dia}/${mes}/${ano}`
    }

    const linha = `
        <tr id="linha_${idAnexo}">
            <td>
                <div style="${horizontal}; justify-content: start; gap: 5px;">
                    <img src="imagens/pasta.png" style="width: 1.5vw; cursor: pointer;" onclick="pastaHTML('${idPessoa}', '${idPasta}', '${idAnexo}', true)">
                    <label style="text-align: left;">${pasta.nomePasta}</label>
                </div>
            </td>
            <td>${pessoa.nome}</td>
            <td>
                ${anexo?.clinica || '--'}<br>
                <strong>${anexo?.local || ''}</strong>
            </td>
            <td>${dt(anexo.validade)}</td>
            <td>
                <input style="display: none;" value="${tempoExpiracao.status}">
                <div style="${horizontal}; justify-content: left; gap: 5px;">
                    <img src="${tempoExpiracao.icone}" style="width: 1.5vw;">
                    <label>${tempoExpiracao.dias}</label>
                </div>
            </td>
            <td>
                <div style="${horizontal}; gap: 5px;">
                    <div class="capsula">
                        <div class="esquerda">
                            <select id="doc_${idAnexo}" onchange="salvarDadosDocumento('doc', '${idPessoa}', '${idPasta}', '${idAnexo}')">${opcoesDocs}</select>
                        </div>
                        <div class="direita" title="${anexo.nome}" onclick="abrirArquivo('${anexo.link}')">
                            Ver
                        </div>
                    </div>
                    <input data-url="${anexo.link}" data-nome="${anexo.nome}" name="docs" type="checkbox" style="width: 1.5vw; height: 1.5vw;">
                </div>
            </td>
        </tr>`

    const linhaAnexo = document.getElementById(`linha_${idAnexo}`)

    if (linhaAnexo) return linhaAnexo.innerHTML = linha

    return linha
}

function marcarTodos(input) {

    const checks = document.querySelectorAll('[name=docs]')

    for (const check of checks) {
        const tr = check.closest('tr')
        if (tr.style.display !== 'none') check.checked = input.checked
    }

}

async function baixarArquivos() {

    overlayAguarde()

    const checkboxes = document.querySelectorAll('[name=docs]:checked')
    if (checkboxes.length === 0) return popup(mensagem('Nenhum arquivo selecionado'), 'ALERTA')

    const zip = new JSZip()

    for (let i = 0; i < checkboxes.length; i++) {
        const url = `https://leonny.dev.br/uploads/${checkboxes[i].dataset.url}`
        const nomeArquivo = checkboxes[i].dataset.nome

        const response = await fetch(url)
        const blob = await response.blob()

        zip.file(nomeArquivo, blob)
    }

    const conteudoZip = await zip.generateAsync({ type: 'blob' })

    removerOverlay()

    saveAs(conteudoZip, 'documentos.zip')
}
