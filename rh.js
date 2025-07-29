const painelCentral = document.querySelector('.painelCentral')
const tituloRH = document.querySelector('.tituloRH')
let pessoas = {}
const modeloRH = (valor1, elemento) => `
    <div style="${horizontal}; justify-content: space-between; gap: 5px; padding: 5px;">
        <label>${valor1}:</label>
        ${elemento}
    </div>
`

carregarEsquema()

async function carregarEsquema() {

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
                ${dados.nome}
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
        </div>
    `

    painelCentral.innerHTML = ''

    const elemento = document.getElementById(`${idPessoa}`)
    elemento.style.display = elemento.style.display == 'none' ? 'flex' : 'none'

}

async function abrirPastas(idPessoa, idPasta) {

    const pessoa = pessoas[idPessoa]
    const pasta = pessoa.pastas[idPasta]
    const anexos = pasta.anexos

    tituloRH.innerHTML = `
        <div style="${horizontal}; gap: 1vw;">
            <label>${pessoa.nome} > ${pasta.nomePasta}</label>
            <img src="imagens/editar.png" style="width: 2vw; cursor: pointer;" onclick="adicionarPasta('${idPessoa}', '${idPasta}')">
            <img src="imagens/anexo2.png" style="width: 2vw; cursor: pointer;" onclick="adicionarPasta('${idPessoa}')">
        </div>
    `

    const stringAnexos = Object.entries(anexos)
        .map(([idAnexo, anexo]) => `
            <div style="${vertical}; align-items: end;">
                <div class="aba">
                    <img src="imagens/anexo.png" style="width: 1.5vw; padding: 3px;">
                </div>
                <div class="blocoRH">
                    ${modeloRH('Realizado', `<input type="date" value="${anexo?.emissao}">`)}
                    ${modeloRH('Validade', `<input type="date" value="${anexo?.validade}">`)}
                    ${modeloRH('Local', `<input placeholder="Localidade" value="${anexo?.local || ''}">`)}
                    ${modeloRH('Clínica', `<input placeholder="Nome da Clínica" value="${anexo?.clinica || ''}">`)}
                    ${criarAnexoVisual(anexo.nome, anexo.link, 'dsadas')}
                </div>
            </div>
            `
        ).join('')


    painelCentral.innerHTML = stringAnexos

}

async function adicionarPasta(idPessoa, idPasta) {

    const pessoa = await recuperarDado('pessoas', idPessoa)
    const pasta = pessoa?.pastas?.[idPasta] || {}

    const acumulado = `
    <div style="padding: 2vw; background-color: #d2d2d2;">
        ${modeloRH('Nome da Pasta', `<input id="nomePasta" value="${pasta?.nomePasta || ''}">`)}
        <hr style="width: 100%;">
        ${botao('Salvar', idPasta ? `salvarPasta('${idPessoa}', '${idPasta}')` : `salvarPasta('${idPessoa}')`, 'green')}
    </div>
    `
    popup(acumulado, 'Gerenciar Pasta')
}

async function salvarPasta(idPessoa, idPasta) {

    overlayAguarde()

    idPasta ? idPasta : ID5digitos()
    const nomePasta = document.getElementById('nomePasta').value
    let pessoa = await recuperarDado('pessoas', idPessoa)

    if (!pessoa.pastas) pessoa.pastas = {}
    if (!pessoa.pastas[idPasta]) pessoa.pastas[idPasta] = {}

    pessoa.pastas[idPasta].nomePasta = nomePasta

    enviar(`pessoas/${idPessoa}/pastas/${idPasta}/nomePasta`, nomePasta)

    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')
    await carregarEsquema()

    removerPopup()

}

async function adicionarPessoa(idPessoa) {

    const pessoa = await recuperarDado('pessoas', idPessoa) || {}

    const acumulado = `
    <div style="padding: 2vw; background-color: #d2d2d2;">
        ${modeloRH('Nome', `<input id="nome" value="${pessoa?.nome || ''}">`)}
        ${modeloRH('Obra Atual', `<input id="obraAtual" value="${pessoa?.obraAtual || ''}">`)}
        <hr style="width: 100%;">
        ${botao('Salvar', idPessoa ? `salvarPessoa('${idPessoa}')` : 'salvarPessoa()', 'green')}
    </div>
    `
    popup(acumulado, 'Gerenciar Pessoa')
}

async function salvarPessoa(idPessoa) {

    overlayAguarde()

    idPessoa ? idPessoa : ID5digitos()
    const nome = document.getElementById('nome').value
    const obraAtual = document.getElementById('obraAtual').value

    let pessoa = await recuperarDado('pessoas', idPessoa) || {}

    pessoa.nome = nome
    pessoa.obraAtual = obraAtual

    enviar(`pessoas/${idPessoa}/nome`, nome)
    enviar(`pessoas/${idPessoa}/obraAtual`, obraAtual)

    await inserirDados({ [idPessoa]: pessoa }, 'pessoas')
    await carregarEsquema()

    removerPopup()

}