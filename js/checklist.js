
async function telaChecklist(idOrcamento = 'ORCA_1faf8f5a-7413-40ac-98d7-11d3d015489f') {

    const {
        dados_orcam,
        dados_composicoes
    } = await recuperarDado('dados_orcamentos', idOrcamento) || {}

    const { contrato, omie_cliente } = dados_orcam || {}
    const { nome } = await recuperarDado('clientes', omie_cliente) || {}

    const {
        checklist
    } = await recuperarDado('vw_checklist', idOrcamento)

    const totais = {}

    for (const { tipo, custo, qtde } of Object.values(dados_composicoes || {})) {

        totais[tipo] ??= {
            total: 0,
            qtde: 0
        }

        totais[tipo].total += (qtde * custo)
        totais[tipo].qtde += 1

    }

    const blocos = Object.entries(totais)
        .map(([tipo, { total, qtde }]) => {

            const estilo = tipo.replaceAll(' ', '-')

            return `
                <div class="tag-checklist ${estilo}">
                    <div style="${vertical}">
                        <span>${tipo}</span>
                        <span>${qtde} Itens</span>
                    </div>
                    <span>${dinheiro(total)}</span>
                </div>
            `
        })
        .join('')

    const itensInst = checklist
        .filter(item => item.filtro == 'INSTALAÇÃO')

    const itensConf = checklist
        .filter(item => item.filtro == 'CONFIGURAÇÃO')

    tela.innerHTML = `
        <div class="painel-geral-checklist">

            <span class="titulo-checklist">${contrato} - ${nome}</span>
            <div class="checklist-painel">
                ${blocos}
            </div>

            <div style="${horizontal}; align-items: start; flex-direction: row; gap: 1rem;">

                ${await tabela(itensInst, 'inst', 'INSTALAÇÃO')}
                ${await tabela(itensConf, 'conf', 'CONFIGURAÇÃO')}

            </div>

        </div>
    `
    await paginacao()

    async function tabela(base, pag, titulo) {

        if (!base.length)
            return ''

        const t = await modTab({
            pag,
            body: pag,
            id: idOrcamento,
            base,
            ordenar: {
                path: 'descricao',
                direcao: 'asc'
            },
            filtros: {
                'filtro': { op: '!=', value: null }
            },
            criarLinha: 'criarLinhaChecklist',
            colunas: {
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Unidade': { chave: 'unidade' },
                'Quantidade': { chave: 'qtde' },
                'Realizado': {},
                'Andamento': {},
                'Registrar': {}
            },
        })

        return `
            <div style="flex-direction: column;">
                <span class="titulo-2">${titulo}</span>
                ${t}
            </div>
        `

    }

}

async function criarLinhaChecklist(item) {

    const {
        codigo,
        descricao,
        unidade,
        qtde,
        realizado,
    } = item


    const andamento = Number(((realizado / qtde) * 100).toFixed(0))

    return `
        <tr>
            <td>${codigo}</td>
            <td>${descricao}</td>
            <td>${unidade}</td>
            <td>${qtde}</td>
            <td>${realizado || 0}</td>
            <td>
                ${divPorcentagem(andamento)}
            </td>
            <td style="text-align: center;">
                <img src="imagens/lapis.png" onclick="registrarChecklist('${codigo}')">
            </td>
        </tr>
    `

}

async function registrarChecklist(codigo) {

    const hoje = new Date().toISOString().slice(0, 10)

    const linhas = [
        {
            texto: 'Quantidade realizada',
            elemento: `<input id="realizado" type="number">`
        },
        {
            texto: 'Data da atividade',
            elemento: `<input type="date" value="${hoje}">`
        }
    ]

    const botoes = [
        {
            texto: 'Salvar',
            funcao: `salvarRegistroChecklist('${codigo}')`,
            img: 'concluido'
        }
    ]

    popup({
        linhas,
        botoes
    })

}

async function salvarRegistroChecklist(codigo) {

    try {

        overlayAguarde()
        const id_orcamento = controles?.checklist?.id
        const realizado = Number(document.getElementById('realizado')?.value || 0)

        if (realizado === 0)
            return popup({ mensagem: 'Realizado não pode ser 0' })

        await enviar(`checklist/${crypto.randomUUID()}`, {
            codigo,
            id_orcamento,
            realizado
        })

        removerTodosPopups()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao registrar a quantidade: Fale com o suporte.' })
    }

}