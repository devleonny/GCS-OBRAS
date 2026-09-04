async function telaContratos() {

    overlayAguarde()

    const tabela = await modTab({
        base: 'contratos',
        criarLinha: 'criarLinhaContrato',
        body: 'contratos',
        pag: 'contratos',
        colunas: {
            'Contrato': { chave: 'contrato' },
            'Cliente': { chave: 'snapshots.nomeCliente' },
            'Estado': { chave: 'snpahots.estado' },
            'Cidade': { chave: 'snpahots.cidade' },
            'CNPJ': { chave: 'snpahots.cnpj' },
            'Endereço': { chave: 'snpahots.endereco' },
            'Valor': { chave: 'valor_total' },
            'Data vencimento': { chave: 'data_vencimento', tipoPesquisa: 'data' },
            'Contratos': {},
            'Usuário': { chave: 'usuario' },
            'Observação': { chave: 'observacao' },
            'Editar': {}
        }
    })

    tela.innerHTML = montarPagina({ tabela, titulo: 'Contratos', imagem: 'contratos' })

    await paginacao('contratos')

    removerOverlay()

}

function criarLinhaContrato(dados) {

    const {
        id,
        usuario,
        contrato,
        anexos,
        observacao,
        valor_total,
        data_vencimento,
        snapshots
    } = dados || {}

    const { cidade, estado, cnpj, endereco, nomeCliente } = snapshots || {}

    const divAnexos = Object
        .entries(anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
        .join('')


    return `
        <tr>
            <td style="text-align: center;">
                <span class="tag-pendencias">${contrato}</span>
            </td>
            <td>${nomeCliente || ''}</td>
            <td>${estado || ''}</td>
            <td>${cidade || ''}</td>
            <td>${cnpj || ''}</td>
            <td>${endereco || ''}</td>
            <td>${dinheiro(valor_total)}</td>
            <td>${conversorDt(data_vencimento)}</td>
            <td>
                ${divAnexos ? `<div class="local-anexos">${divAnexos}</div>` : `<div style="${horizontal}"><img src="imagens/alerta.png"></div>`}
            </td>
            <td>${usuario || ''}</td>
            <td>${observacao || ''}</td>
            <td style="text-align: center;">
                <img src="imagens/pesquisar2.png" onclick="gerenciarContrato('${id}')">
            </td>
        </tr>
    `

}

async function gerenciarContrato(id) {

    try {

        overlayAguarde()

        const {
            anexos,
            cliente,
            observacao,
            valor_total,
            data_vencimento
        } = id ? await recuperarDado('contratos', id) || {} : {}

        const { nome } = id ? await recuperarDado('clientes', cliente) || {} : {}

        const divAnexos = Object
            .entries(anexos || {})
            .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link))
            .join('')

        controlesCxOpcoes.cliente = {
            base: 'clientes',
            retornar: ['nome'],
            colunas: {
                'Nome': { chave: 'nome' },
                'CNPJ / CPF': { chave: 'cnpj' },
                'Endereço': { chave: 'endereco' },
                'Estado': { chave: 'estado' },
                'Cidade': { chave: 'cidade' }
            }
        }

        const linhas = [
            {
                texto: 'Cliente',
                elemento: `
                <span ${cliente ? `id="${cliente}"` : ''}
                    class="opcoes"
                    name="cliente"
                    onclick="cxOpcoes('cliente')">
                        ${nome || 'Selecionar'}
                </span>
            `
            },
            {
                texto: 'Data de Vencimento',
                elemento: `<input type="date" name="data_vencimento" value="${data_vencimento || ''}">`
            },
            {
                texto: 'Valor',
                elemento: `<div style="${horizontal}; gap: 3px;">R$ <input name="valor_total" type="Number" value="${valor_total || ''}"></div>`
            },
            {
                texto: 'Anexos',
                elemento: `
                <div style="${vertical}; gap: 1rem;">
                    <input id="anexos" type="file">
                    <div class="local-anexos">${divAnexos || ''}</div>
                </div>
                `
            },
            {
                editor: observacao || ''
            }

        ]

        const botoes = [
            {
                texto: 'Salvar',
                img: 'concluido',
                funcao: id ? `salvarContrato('${id}')` : `salvarContrato()`
            }
        ]

        popup({
            linhas,
            botoes
        })

    } catch (err) {

        console.error(err)
        popup({ mensagem: 'Falha ao abrir o contrato: Fale com o suporte.' })

    }

}


async function salvarContrato(id = null) {

    try {

        overlayAguarde()

        const cliente = document.querySelector('[name="cliente"]')?.id

        if (!cliente)
            return popup({ mensagem: 'Não deixe o campo cliente em branco' })

        const { anexos, usuario } = id
            ? await recuperarDado('contratos', id) || {}
            : {}

        id = id || crypto.randomUUID()

        const input = document.getElementById('anexos')
        const novosAnexos = await anexosOcorrencias(input)

        const contrato = {
            anexos: {
                ...anexos,
                ...novosAnexos
            },
            usuario: usuario || acesso.usuario,
            cliente: obVal('cliente'),
            data_vencimento: obVal('data_vencimento'),
            valor_total: Number(obVal('valor_total')),
            observacao: document.querySelector('.editor-conteudo')?.innerHTML || null
        }

        // Padrão de resposta do GCS;
        const { mensagem } = await enviar(`contratos/${id}`, contrato)
        if (mensagem)
            return popup({ mensagem })

        removerTodosPopups()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao salvar o contrato: Fale com o suporte.' })
    }


}