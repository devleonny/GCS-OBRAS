const painelCentral = document.querySelector('.painelCentral')
const tituloRH = document.querySelector('.tituloRH')
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
    painelCentral.style.display = 'grid'

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

    Object.entries(anexos)
        .map(([idAnexo, anexo]) => {

            const opcoesDocs = ['', 'ASO', 'NR 06 - EPI', 'NR 10', 'NR 35', 'PTA']
                .map(op => `<option ${anexo?.doc == op ? 'selected' : ''}>${op}</option>`).join('')

            stringAnexos += `
            <div class="pasta">
                <div class="aba">
                    <select id="doc_${idAnexo}" onchange="salvarDadosDocumento('doc', '${idPessoa}', '${idPasta}', '${idAnexo}')">${opcoesDocs}</select>
                </div>
                <div class="blocoRH">
                    ${modeloRH('Realizado', `<input id="emissao_${idAnexo}" type="date" onchange="salvarDadosDocumento('emissao', '${idPessoa}', '${idPasta}', '${idAnexo}')" value="${anexo?.emissao || ''}">`)}
                    ${modeloRH('Validade', `<input id="validade_${idAnexo}" type="date" onchange="salvarDadosDocumento('validade', '${idPessoa}', '${idPasta}', '${idAnexo}')" value="${anexo?.validade || ''}">`)}
                    ${modeloRH('Local', `<input id="local_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Localidade" value="${anexo?.local || ''}">`, `salvarDadosDocumento('local', '${idPessoa}', '${idPasta}', '${idAnexo}')`)}
                    ${modeloRH('Clínica', `<input id="clinica_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Nome da Clínica" value="${anexo?.clinica || ''}">`, `salvarDadosDocumento('clinica', '${idPessoa}', '${idPasta}', '${idAnexo}')`)}
                    ${modeloRH('Contato', `<input id="contato_${idAnexo}" oninput="mostrarBtn(this)" placeholder="Tel/E-mail" value="${anexo?.contato || ''}">`, `salvarDadosDocumento('contato', '${idPessoa}', '${idPasta}', '${idAnexo}')`)}
                    <div style="${horizontal}; justify-content: space-between; width: 100%;">
                        ${criarAnexoVisual(anexo.nome, anexo.link)}
                        ${botao('Excluir', `confirmarExclusaoAnexo('${idPessoa}', '${idPasta}', '${idAnexo}')`, '#B12425')}
                    </div>
                </div>
            </div>
            `
        })

    painelCentral.innerHTML = stringAnexos

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
    if (campo == 'clinica' || campo == 'local' || campo == 'contato') elemento.nextElementSibling.style.display = 'none'

    const valor = elemento.value
    let pessoa = await recuperarDado('pessoas', idPessoa)
    let pasta = pessoa.pastas[idPasta]
    let anexo = pasta.anexos[idAnexo]

    anexo[campo] = valor

    await enviar(`pessoas/${idPessoa}/pastas/${idPasta}/anexos/${idAnexo}/${campo}`, valor)
    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')

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
    let data = '--'
    if (dataString !== '--') {

        const [ano, mes, dia] = dataString.split('-')
        const dataInformada = new Date(dataString)
        const hoje = new Date()

        dataInformada.setHours(0, 0, 0, 0)
        hoje.setHours(0, 0, 0, 0)

        const diferencaMs = dataInformada - hoje
        dias = Math.floor(diferencaMs / (1000 * 60 * 60 * 24))
        data = `${dia}/${mes}/${ano}`

    } else {
        dias = dataString
    }

    let icone = 'gifs/interrogacao.gif'
    if (dias < 30) {
        icone = 'imagens/offline.png'
    } else if (dias < 60) {
        icone = 'imagens/pendente.png'
    } else if (dias >= 60) {
        icone = 'imagens/online.png'
    }

    return { dias, icone, data }
}

carregarEsquemaTabela()

async function carregarEsquemaTabela() {

    pessoas = await recuperarDados('pessoas')

    const colunas = ['Nome & Grupo', 'Estado', 'Validade', 'Expiração', 'Arquivo']
        .map(op => `<th>${op}</th>`).join('')
    let linhas = ''

    // Pessoas nesse contexto foi mudado para cidade-estado;
    for (const [idPessoa, pessoa] of Object.entries(pessoas)) {

        const pastas = pessoa?.pastas || {}

        for (const [idPasta, pasta] of Object.entries(pastas)) {

            const anexos = pasta?.anexos || {}

            for (const [idAnexo, anexo] of Object.entries(anexos)) {

                const validade = anexo?.validade || '--'
                const tempoExpiracao = expiraEm(validade)
                const opcoesDocs = ['', 'ASO', 'NR 06 - EPI', 'NR 10', 'NR 35', 'PTA']
                    .map(op => `<option ${anexo?.doc == op ? 'selected' : ''}>${op}</option>`).join('')

                linhas += `
                <tr>
                    <td>${pasta.nomePasta}</td>
                    <td>${pessoa.nome}</td>
                    <td>
                        <input type="date" value="${validade}">
                    </td>
                    <td>
                        <div style="${horizontal}; justify-content: left; gap: 5px;">
                            <img src="${tempoExpiracao.icone}" style="width: 1.5vw;">
                            <label>${tempoExpiracao.dias}</label>
                        </div>
                    </td>
                    <td>
                        <div class="capsula">
                            <div class="esquerda">
                                <select id="doc_${idAnexo}" onchange="salvarDadosDocumento('doc', '${idPessoa}', '${idPasta}', '${idAnexo}')">${opcoesDocs}</select>
                            </div>
                            <div class="direita" title="${anexo.nome}" onclick="abrirArquivo('${anexo.link}')">
                                Ver
                            </div>
                        </div>
                    </td>
                </tr>
                `
            }

        }

    }

    let acumulado = `
        <div style="${vertical};">
            <div class="painelBotoes" style="align-items: center; justify-content: center;"></div>
            <div style="${vertical}; height: max-content; max-height: 70vh; overflow-y: auto;">
                <table class="tabela">
                    <thead>
                        <tr>${colunas}</tr>
                    </thead>
                    <tbody>
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