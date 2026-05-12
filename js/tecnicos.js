async function telaMovimentos() {

    const tabela = await modTab({
        pag: 'estoque_tecnicos',
        base: 'vw_movimentacao_estoque',
        btnExtras: '<span style="font-size: 1.1rem; color: white;">DETALHAMENTO DE MOVIMENTO DE PEÇAS</span>',
        colunas: {
            'Edição': {},
            'Data': { chave: 'data', tipoPesquisa: 'data' },
            'Usuário': { chave: 'usuario' },
            'Técnicos': { chave: 'tecnico' },
            'Ocorrência': { chave: 'id_ocorrencia' },
            'Sinal': {},
            'Operação': { chave: 'operacao' },
            'Quantidade': { chave: 'quantidade' },
            'Origem': { chave: 'origem' },
            'Descrição': { chave: 'descricao' }
        },
        explode: {
            path: 'equipamentos'
        },
        body: 'bodyTecnicos',
        criarLinha: 'criarLinhaMovimento'
    })

    const tabelaResumida = await modTab({
        pag: 'tecnicosResumido',
        base: 'vw_saldo_estoque_tecnicos',
        btnExtras: '<span style="font-size: 1.1rem; color: white;">SALDO DE PEÇAS POR TÉCNICO</span>',
        body: 'tecnicosResumido',
        criarLinha: 'criarLinhaTecsResumido',
        colunas: {
            'Técnico': { chave: 'tecnico' },
            'Descrição': { chave: 'descricao_peca' },
            'Sinal': {},
            'Saldo': {}
        }
    })

    tela.innerHTML = `
        <div class="pagina-relatorio">
            <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

            <div class="painel-tecnicos">
                ${tabelaResumida}
                ${tabela}
            </div>
        </div>
    `
    await paginacao()
}

async function criarLinhaTecsResumido(tec) {

    const { tecnico, descricao_peca, saldo_atual } = tec || {}

    return `
        <tr>
            <td>${tecnico}</td>
            <td>${descricao_peca}</td>
            <td style="text-align: center;">
                <img src="imagens/${saldo_atual > 0 ? 'aprovado' : 'reprovado'}.png">
            </td>
            <td style="text-align: center;">${saldo_atual}</td>
        </tr>
    `

}

async function criarMovimento(id = crypto.randomUUID()) {

    overlayAguarde()

    const { tecnico, equipamentos } = await recuperarDado('estoque_tecnicos', id) || {}

    const listagemEquipamentos = (
        await Promise.all(
            Object.values(equipamentos || {})
                .map(equip => maisLabel(equip))
        )
    ).join('')

    controlesCxOpcoes.tecnico = {
        base: 'dados_setores',
        retornar: ['usuario'],
        colunas: {
            'Usuário': { chave: 'usuario' },
            'Setor': { chave: 'setor' },
            'Permissão': { chave: 'permissao' }
        }
    }

    const linhas = [
        {
            texto: 'Selecione o técnico',
            elemento: `<span ${tecnico ? `id="${tecnico}"` : ''} class="campos" name="tecnico" onclick="cxOpcoes('tecnico')">${tecnico || 'Selecionar'}</span>`
        },
        {
            texto: 'Qual a operação?',
            elemento: `<select id="operacao">${['Recebimento', 'Saída'].map(o => `<option>${o}</option>`).join('')}</select>`
        },
        {
            elemento: `
            <div style="${vertical}; gap: 5px;">
                <div style="${horizontal}; gap: 1rem;">
                    <img src="imagens/baixar.png" onclick="maisLabel({formulario: 'tecnico'})">
                    <span>Adicione equipamentos</span>
                </div>

                <div style="${vertical}; width: 100%; gap: 2px;" id="equipamentos">
                    ${listagemEquipamentos}
                </div>

            </div>
            `
        },
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarMovimento('${id}')` }
    ]

    popup({ linhas, botoes, titulo: 'Criar movimento' })

}

async function salvarMovimento(id) {


    try {
        overlayAguarde()

        const { usuario } = await recuperarDado('estoque_tecnicos', id) || {}

        const obVal = (id) => {
            const elemento = document.getElementById(id)
            return elemento ? elemento : null
        }

        const tecnico = document.querySelector('[name="tecnico"]').id
        if (!tecnico)
            return popup({ mensagem: 'Selecione o técnico' })

        const movimento = {
            tecnicos: [tecnico],
            usuario: usuario
                ? usuario
                : acesso.usuario,
            equipamentos,
            operacao: obVal('operacao').value,
            data: new Date().toISOString().split('T')[0]
        }

        // Equipamentos
        const divs = document.querySelectorAll('[name="equipamentos"]')

        for (const div of divs) {

            const equip = div.querySelector('span')

            if (!equip?.id)
                continue

            const { unidade, modelo, descricao, fabricante } = await recuperarDado('dados_composicoes', equip.id)

            const quantidade = Number(div.querySelector('#quantidade').value)
            const serie = [...div.querySelectorAll('[name="serie"]')]
                .map(input => input.value)

            movimento.equipamentos[equip.id] = {
                codigo: equip.id,
                modelo,
                serie,
                origem: 'Kit',
                id_ocorrencia: 'Saldo',
                descricao,
                fabricante,
                quantidade,
                unidade
            }
        }

        await enviar(`estoque_tecnicos/${id}`, movimento)
        removerPopup()

    } catch (err) {
        popup({ mensagem: 'Falha ao criar o movimento: fale com o suporte' })
    }

}


async function criarLinhaMovimento(movimento) {

    const {
        id,
        usuario,
        tecnico,
        id_ocorrencia,
        operacao,
        data,
        comentario,
        descricao,
        quantidade,
        origem,
    } = movimento || {}

    const sinal = operacao == 'Recebimento'
        ? 'up_estoque'
        : 'down_estoque'

    const funcao = operacao == 'Recebimento'
        ? `<img src="imagens/pesquisar2.png" onclick="criarMovimento('${id}')">`
        : ''

    return `
        <tr>
            <td>${funcao}</td>
            <td>${data ? conversorData(data) : ''}</td>
            <td>${usuario || ''}</td>
            <td>${tecnico ? tecnico.join(', ') : ''}</td>
            <td>${id_ocorrencia || ''}</td>
            <td style="text-align: center;">
                <img src="imagens/${sinal}.png">
            </td>
            <td>${operacao || ''}</td>
            <td>${quantidade || ''}</td>
            <td>${origem || ''}</td>
            <td>${descricao || ''}</td>
        </tr>
    `

}