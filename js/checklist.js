

async function telaChecklist(contrato) {

    const colunas = {
        'Descrição': {},
        'Rack': {},
        'Pilar': {},
        'Setor': {},
        'IP': {},
        'Local': {},
        'Qtde': {},
        'Equipamento': {},
        'Calha': {},
        'Tubo': {},
        'Cabo': {},

        'Calha': {},
        'Derivação da Calha': {},
        'Infra Tubo': {},
        'Cabo': {},
        'Inst. Equipamento': {},
        'Conf. Equipamento': {},
        'Observações': {}
    }

    const { relatorio } = await baixarChecklist()
    const linhas = relatorio.map(({ descricao, rack, pilar, setor, ip, local, equipamento }) => {

        return `
        <tr>
        
            <td>${descricao}</td>
            <td>${rack}</td>
            <td>${pilar}</td>
            <td>${setor}</td>
            <td>${ip}</td>
            <td>${local}</td>
            <td></td>
            <td>${equipamento}</td>

            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>

        </tr>
        `
    })
    .join('')

    const tabela = `
        <table class="tabela">
            <thead>
                ${Object.keys(colunas).map(col => `<th>${col}</th>`).join('')}
            </thead>
            <tbody>
                ${linhas}
            </tbody>
        </table>
    `

    tela.innerHTML = `
        <div style="${vertical}; padding: 2rem;">
            ${tabela}
        </div>`

}

async function criarLinhaChecklist(checklist) {

    const {
        descricao,
        rack,
        pilar,
        setor,
        ip,
        local,
        equipamento
    } = checklist

    const tr = `
        <tr>
            <td>${descricao}</td>
            <td>${rack}</td>
            <td>${pilar}</td>
            <td>${setor}</td>
            <td>${ip}</td>
            <td>${local}</td>
            <td contentEditable="true"></td>
            <td>${equipamento}</td>

            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    `
    return tr
}


async function baixarChecklist() {

    const { token } = JSON.parse(localStorage.getItem('acesso')) || {}

    const resposta = await fetch(`${read}/checklist`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify()
    })

    if (!resposta.ok) {
        const erro = await resposta.text()
        throw new Error(erro || 'Falha ao consultar o checklist')
    }

    return await resposta.json()
}