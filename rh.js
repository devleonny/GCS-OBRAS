
const pessoas = {
    'dsa25': { nome: 'Fellipe', documentos: { docA: ['1', '2', '3'], docB: ['4', '5'] } },
    '258xx': { nome: 'Leonny', documentos: { docA: ['1', '2', '3'], docB: ['4', '5'] } },
}

carregarEsquema()

async function carregarEsquema() {

    let stringPessoas = ''

    for (const [id, dados] of Object.entries(pessoas)){

        stringPessoas += `
        <div style="${horizontal}; gap: 10px; cursor: pointer;">
            <img src="imagens/pasta.png" style="width: 1.5vw; cursor: pointer;">
            <label>${dados.nome}</label>
        </div>
        `
    }

    const divPessoas = document.querySelector('.divPessoas')
    divPessoas.innerHTML = stringPessoas

}