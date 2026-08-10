


async function telaContratos() {

    const tabela = await modTab({
        base: 'contratos',
        criarLinha: 'criarLinhaContrato',
        body: 'contratos',
        pag: 'contratos',
        colunas: {
            'Contrato': { chave: 'contrato' },
            'Valor': { chave: 'valor_total' },
            'Data vencimento': { chave: 'data_vencimento' },
            'Anexos': {},
            'Usuário': { chave: 'usuario' },
            'Observação': { chave: 'observacao' },
            'Editar': {}
        }
    })

    tela.innerHTML = `
        <div>
            ${tabela}
        </div>
    `

    await paginacao('contratos')

}

function criarLinhaContrato(dados) {

    const {
        id,
        usuario,
        contrato,
        cliente,
        observacao,
        valor_total,
        data_vencimento,
    } = dados || {}


    return `
        <tr>
            <td>${contrato}</td>
            <td>${dinheiro(valor_total)}</td>
            <td>${conversorDt(data_vencimento)}</td>
            <td></td>
            <td>${usuario || ''}</td>
            <td>${observacao || ''}</td>
            <td>
                <img src="imagens/pesquisar2.png" onclick="gerenciarContrato(${id})">
            </td>
        </tr>
    `

}

async function gerenciarContrato(contrato) {

    try {

        overlayAguarde()

        const {
            id,
            usuario,
            cliente,
            observacao,
            valor_total,
            data_vencimento,
        } = contrato ? await recuperarDado('contratos', contrato) : {}

        const { nome } = cliente
            ? await recuperarDado('clientes', cliente)
            : {}

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
                texto: 'Data de Vencimento',
                elemento: `<input type="date" name="data_vencimento" value="${data_vencimento || ''}">`
            },
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
            }
        ]

        const botoes = [
            {
                texto: 'Salvar',
                img: 'concluido',
                funcao: id ? `salvarContrato(${id})` : `salvarContrato()`
            }
        ]

        popup({ linhas, botoes })

    } catch (err) {

        console.log(err)
        popup({ mensagem: 'Falha ao abrir o contrato: Fale com o suporte.' })

    }

}


async function salvarContrato(id) {

    try {

        overlayAguarde()

        const contrato = id ? await recuperarDado('contratos', id) : {}

        const cliente = document.querySelector('[name="cliente"]')?.id

        if (!cliente)
            return popup({ mensagem: 'Não deixe o campo cliente em branco' })

        const mesclado = {
            ...contrato,
            cliente,
            data_vencimento: document.querySelector('[name="data_vencimento"]')?.value
        }

        await enviar(`contratos/${id || '0000'}`, mesclado)

        removerTodosPopups()

    } catch (err) {
        console.log(err)
        popup({ mensagem: 'Falha ao salvar o contrato: Fale com o suporte.' })
    }


}