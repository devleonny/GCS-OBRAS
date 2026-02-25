let nomeCliente = ''
let chamado = ''

carregarOS()

async function carregarOS() {

    const orcamento = JSON.parse(localStorage.getItem('pdf')) || {}
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const cliente = await recuperarDado('dados_clientes', omie_cliente)
    let dados = document.getElementById('dados')
    let resumoAtividade = document.getElementById('resumoAtividade')

    nomeCliente = cliente.nome
    chamado = orcamento.dados_orcam.contrato

    const modelo = (valor1, valor2) => {

        return `
        <div style="${horizontal}; gap: 10px; width: 100%;">
            <label style="white-space: nowrap;"><strong>${valor1}:</strong></label>
            <div class="campos" contentEditable="true">${valor2 || ''}</div>
        </div>`}

    const acumulado = `
        <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 1vw;">
            <div style="${vertical}; gap: 5px; width: 50%;">
                ${modelo('LOCAL', cliente.cidade)}
                ${modelo('ENDEREÇO', cliente.bairro)}
                ${modelo('NOME', cliente.nome)}
                ${modelo('CNPJ', cliente.cnpj)}
                ${modelo('EMPRESA', 'HOPE NETWORK')}
                ${modelo('ORÇAMENTO', orcamento.dados_orcam.contrato)}
                ${modelo('INÍCIO DA ATIVIDADE')}
                ${modelo('TÉRMINO DA ATIVIDADE')}
                ${modelo('STATUS')}
            </div>
            <div style="${vertical}; width: 50%; gap: 5px;">
                ${modelo('DATA', new Date().toLocaleDateString('pt-BR'))}
                ${modelo('CIDADE')}
                ${modelo('FUNÇÃO')}
                ${modelo('TELEFONE')}
                ${modelo('TÉCNICO')}
            </div>
        </div>
    `
    const ths = ['SERVIÇOS', 'INICIADOS', 'CONCLUÍDOS', 'STATUS']
        .map(op => `<th>${op}</th>`).join('')

    const col1 = ['INFRAESTRUTURA', 'PASSAGEM DE CABO', 'INSTALAÇÃO', 'CONFIGURAÇÃO E TESTES']
    let linhas = ''

    for (let i = 0; i < 4; i++) {
        let tds = ''
        for (let j = 0; j < 4; j++) {
            tds += `<td contentEditable="true">${j == 0 ? `${i + 1} - ${col1[i]}` : ''}</td>`
        }
        linhas += `<tr>${tds}</tr>`
    }

    const tabela = `
        <table>
            <thead>${ths}</thead>
            <tbody>${linhas}</tbody>
        </table>
    `

    resumoAtividade.innerHTML = `
        <div id="pdf" style="${vertical}">
            ${tabela}
            <br>
            ${modelo('RESUMO ATIVIDADE', orcamento.dados_orcam.consideracoes)}
            <br>
            ${modelo('OBSERVAÇÕES DO CLIENTE')}
            <br>
            ${modelo('TÉCNICOS')}

            <br>
            <br>

            <label>De acordo,</label>
            <br>
            <br>
            <label>___________________________________________________________________________________</label><br>
            <label>Responsável da Loja</label>
        </div>
    `

    dados.innerHTML = acumulado

}

async function gerarPDF() {

    await irPdf({ id: 'pdf', estilos: ['os', 'estilo'], nome: nomeChamado })

}
