

async function telaRelatorioFotografico(id) {


    const relatorio = await recuperarDado('relatorio_fotografico', id)

    const tabela = await modTab({
        base: [],
        criarLinha: 'criarLinhaRelatorioFotografico',
        colunas: {
            'Foto Antes':{},
            
        }
    })

    const elemento = `
     
        <div class="relatorio-fotografico">


        </div>
    
    `

    tela.innerHTML = elemento
    
}