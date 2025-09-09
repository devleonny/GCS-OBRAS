


async function telaChecklist() {

    const orcamento = await recuperarDado('dados_orcamentos', id_orcam)

    let ths = ''
    let pesquisa = ''
    const colunas = ['Serviços', 'Quantidade', 'Serviço Executado', 'Diferença', 'Média do Serviço <br> Soma / dia trabalhado', 'Percentual de rendimento', 'Previsão de finalização']
        .forEach(op => {
            ths += `<th>${op}</th>`
        })
    
    let linhas = ''
    for(const [codigo, produto] of Object.entries(orcamento?.dados_composicoes || {})) {
        if(produto.tipo == 'VENDA') continue

        linhas += `
        <tr>
            <td>${produto.descricao}</td>


        </tr>
        `
    }

    const acumulado = `
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">

            <div style="${vertical};">
                <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela" id="tabela_composicoes">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${pesquisa}</tr>
                        </thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `

    popup(acumulado, 'Checklist')

}