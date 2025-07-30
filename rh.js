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

    const stringAnexos = Object.entries(anexos)
        .map(([idAnexo, anexo]) => `
            <div class="pasta">
                <div class="aba"></div>
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
        ).join('')


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
    popup(acumulado, 'Gerenciar Pessoa')
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