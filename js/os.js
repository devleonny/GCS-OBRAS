async function carregarOS(id) {

    const orcamento = await recuperarDado('dados_orcamentos', id) || {}
    const omie_cliente = orcamento?.dados_orcam?.omie_cliente || ''
    const { nome, cidade, endereco, cnpj } = await recuperarDado('dados_clientes', omie_cliente) || ''
    const contrato = orcamento?.dados_orcam?.chamado || orcamento?.dados_orcam?.contrato || ''

    const modelo = (valor1, valor2) => {

        if (!valor2)
            return ''

        return `
        <div style="${horizontal}; gap: 10px; width: 100%;">
            <label style="white-space: nowrap;"><strong>${valor1}:</strong></label>
            <div class="campos-os" contentEditable="true">${valor2 || ''}</div>
        </div>`
    }

    const acumulado = `
        <div style="${horizontal}; justify-content: space-between; width: 100%; gap: 1vw;">
            <div style="${vertical}; gap: 5px; width: 50%;">
                ${modelo('LOCAL', cidade)}
                ${modelo('ENDEREÇO', endereco)}
                ${modelo('NOME', nome)}
                ${modelo('CNPJ', cnpj)}
                ${modelo('EMPRESA', 'HOPE NETWORK')}
                ${modelo('ORÇAMENTO', contrato)}
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
        </div>`

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

    const elemento = `

        <div class="blc" onclick="gerarPDF('${nome}', '${contrato}')">
            <div class="esquerdo">Baixar</div>
            <div class="direito">PDF</div>
        </div>

        <div id="pdf" style="${vertical}; padding: 2rem; gap: 1rem;">
            <div style="display: flex; align-items: center; justify-content: space-evenly; width: 100%;">
                <img src="https://i.imgur.com/pHNkXRQ.png" style="width: 7rem;">
                <img src="https://i.imgur.com/5zohUo8.png" style="width: 7rem;">
                <img src="https://i.imgur.com/vhCX7qQ.png" style="width: 7rem;">
            </div>

            <div class="tituloOS">RELATÓRIO OBRAS - TERMO DE RECEBIMENTO DA OBRA</div>

            <div style="${vertical}; width: 95%;">
                ${acumulado}
            </div>

            <table class="tabela">
                <thead>${ths}</thead>
                <tbody>${linhas}</tbody>
            </table>

            ${modelo('RESUMO ATIVIDADE', orcamento.dados_orcam.consideracoes)}

            ${modelo('OBSERVAÇÕES DO CLIENTE')}

            ${modelo('TÉCNICOS')}

            <label>De acordo,</label>

            <label>___________________________________________________________________________________</label><br>
            <label>Responsável da Loja</label>        

        </div>
        `

    popup({
        elemento,
        titulo: 'OS'
    })

}

async function gerarPDF(n, c) {

    await pdf({ id: 'pdf', nome: `OS_${n}_${c}`, estilos: ['os', 'gcsobras', 'tabelas'] })

}
