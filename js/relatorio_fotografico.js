

async function telaRelatorioFotografico(id) {


    const relatorio = await recuperarDado('relatorio_fotografico', id)

    const tabela = await modTab({
        base: [],
        criarLinha: 'criarLinhaRelatorioFotografico',
        colunas: {
            'Foto Antes': {},
            'Foto Depois': {},
            'Comentários': {}
        }
    })

    const elemento = `
        <div class="relatorio-fotografico">
            ${tabela}
        </div>
    `

    tela.innerHTML = elemento

}