

async function telaChecklist(contrato) {

    const tabela = await modTab({
        base: 'checklist_base',
        body: 'checklist',
        pag: 'checklist',
        criarLinha: 'criarLinhaChecklist',
        colunas: {
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
    })

    tela.innerHTML = `
    <div style="${vertical}; padding: 2rem;">
        <button>
            <img src="imagens/salvar.png">
            Salvar
        </button>
        ${tabela}
    </div>`

    await paginacao('checklist')

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

