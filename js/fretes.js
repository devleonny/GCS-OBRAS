


async function telaFretes() {

    overlayAguarde()

    const pag = 'fretes'
    const tabela = await modTab({
        pag,
        base: 'vw_fretes',
        body: 'vw_fretes',
        criarLinha: 'criarLinhafretes',
        filtros: {
            transportadora: { op: '=', value: 'CORREIOS' }
        },
        colunas: {
            'Editar': {},
            'Método de Envio': { chave: 'metodo_envio' },
            'Rastreio': { chave: 'rastreio' },
            'Volumes': {},
            'Valor da Nota': {},
            'Custo Frete': {},
            'Loja': { chave: 'cliente' },
            'Orçamentos': { chave: 'departamento' },
            'Tipo': { chave: 'categoria' },
            'UF': { chave: 'estado' },
            'Nota Fiscal': { chave: 'n_nota' },
            'Data de Saída': { chave: 'data_saida', tipoPesquisa: 'data' },
            'Data de Previsão': { chave: 'data_previsao', tipoPesquisa: 'data' },
            'Data de Entrega': { chave: 'data_saida', tipoPesquisa: 'data' },
            'Material': {},
            'Situação': {},
            'Comentário': {}
        }
    })

    const { resultados } = await pesquisarDB({
        base: 'transportadoras'
    })

    const toolbar = resultados
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((r, i) => `
            <span style="opacity: ${i == 0 ? 1 : 0.5}" 
            onclick="toggleAbas(this); filtrarPorTransportadora('${r.nome}')">${r.nome}</span>`)
        .join('')

    tela.innerHTML = `
        <div style="${vertical};">
            <div class="toolbar-padrao">${toolbar}</div>
            <div class="painel-atras-padrao">
                ${tabela}
            </div>
        </div>
    `

    await paginacao(pag)

    removerOverlay()

}

async function filtrarPorTransportadora(nome) {

    controles.fretes.filtros.transportadora = { op: '=', value: nome }
    await paginacao('fretes')

}

function criarLinhafretes(dados) {

    const {
        id,
        metodo_envio,
        rastreio,
        volumes,
        total,
        custo_frete,
        cliente,
        departamento,
        categoria,
        estado,
        n_nota,
        data_saida,
        data_previsao,
        data_entrega,
        situacao,
        comentario
    } = dados || {}

    const primeirosOrcs = departamento
        ? departamento
            .match(/ORC_\d+/g)
            ?.slice(0, 3) || []
        : []

    const finalDepartamentos = primeirosOrcs
        .map(d => `<span onclick="painelCustos('${d}')" class="etiquetas">${d}</span>`)
        .join('')

    return `
        <tr>
            <td style="text-align: center;">
                <img onclick="envioMaterial('${id}')" src="imagens/pesquisar2.png">
            </td>
            <td>${metodo_envio || ''}</td>
            <td>${rastreio || ''}</td>
            <td>
                <span class="etiquetas">${volumes || 0}</span>
            </td>
            <td>
                <span style="white-space: nowrap;">${dinheiro(total)}</span>
            </td>
            <td>
                <span style="white-space: nowrap;">${dinheiro(custo_frete)}</span>
            </td>
            <td>
                <span style="display: flex; min-width: 200px;">${cliente || ''}</span>    
            </td>
            <td>
                <div style="max-width: 200px; display: flex; flex-wrap: wrap; gap: 2px;">${finalDepartamentos || ''}</div>
            </td>
            <td>${categoria || ''}</td>
            <td>${estado || ''}</td>
            <td>${n_nota || ''}</td>
            <td>${data_saida || ''}</td>
            <td>${data_previsao || ''}</td>
            <td>${data_entrega || ''}</td>
            <td>
                <button>Ver itens</button>
            </td>
            <td>${situacao || ''}</td>
            <td>
                <div style="display: flex; flex-wrap; wrap;">${comentario || ''}</div>
            </td>
        </tr>
    `

}

async function envioMaterial(id = crypto.randomUUID()) {

    try {
        overlayAguarde()

        const {
            metodo_envio,
            transportadora,
            rastreio,
            previsao,
            custo_frete,
            data_saida,
            volumes,
            n_nota,
            comentario
        } = await recuperarDado('fretes', id) || {}

        const { nome: nomeTransportadora } = await recuperarDado('transportadoras', transportadora) || {}

        controlesCxOpcoes.transportadora = {
            base: 'transportadoras',
            retornar: ['nome'],
            colunas: {
                'nome': { chave: 'nome' }
            }
        }

        const linhas = [
            {
                texto: 'Número de rastreio',
                elemento: `<input placeholder="ABC123" class="pedido" name="rastreio" value="${rastreio || ''}">`
            },
            {
                texto: 'Transportadora',
                elemento: `<span ${transportadora ? `id="${transportadora}"` : ''} class="opcoes" name="transportadora" onclick="cxOpcoes('transportadora')">${nomeTransportadora || 'Selecione'}</span>`
            },
            {
                texto: 'Método de Envio',
                elemento: `<input placeholder="exemplo: PAC" name="metodo_envio" value="${metodo_envio || ''}">`
            },
            {
                texto: 'Custo do Frete',
                elemento: `<div>R$ <input placeholder="0,00" type="number" name="custo_frete" value="${custo_frete || ''}"></div>`
            },
            {
                texto: 'Nota Fiscal',
                elemento: `<input placeholder="Número da nota" oninput="buscarDadosNotas(this.value)" name="n_nota" value="${n_nota || ''}">`
            },
            {
                elemento: `<div class="detalhes-nota"></div>`
            },
            {
                texto: 'Volumes',
                elemento: `<input placeholder="0" type="number" name="volumes" value="${volumes || ''}">`
            },
            {
                texto: 'Data de Saída',
                elemento: `<input type="date" name="data_saida" value="${data_saida || ''}">`
            },
            {
                texto: 'Data de Entrega',
                elemento: `<input type="date" name="previsao" value="${previsao || ''}">`
            },
            {
                editor: comentario || ''
            },
        ]

        const botoes = [
            {
                texto: 'Salvar',
                img: 'concluido',
                funcao: `registrarEnvioMaterial('${id}')`
            }
        ]

        popup({ linhas, botoes, titulo: 'Envio de Material' })

        buscarDadosNotas(n_nota)

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao abrir o envio: Fale com o suporte.' })
    }
}

async function buscarDadosNotas(n_nota) {

    const local = document.querySelector('.detalhes-nota')

    local.innerHTML = '<img src="gifs/loading.gif" style="width: 5rem;">'

    if (!n_nota)
        return local.innerHTML = 'Preencha o número da nota para obter detalhes'

    const { resultados } = await pesquisarDB({
        base: 'notas',
        filtros: {
            'n_nota': {
                op: 'includes',
                value: n_nota
            }
        }
    })

    if (!resultados.length)
        return local.innerHTML = 'Nota não localizada'

    const {
        cnpj,
        cliente,
        total,
        categoria,
        departamento
    } = resultados[0] || {}

    const primeirosOrcs = departamento
        .match(/ORC_\d+/g)
        ?.slice(0, 3) || []

    const finalDepartamentos = primeirosOrcs
        .map(d => `<span onclick="painelCustos('${d}')" class="etiquetas">${d}</span>`)
        .join('')

    local.innerHTML = `
        <span><b>Categoria:</b> ${categoria}</span>
        <span><b>CNPJ:</b> ${cnpj}</span>
        <span><b>Cliente:</b> ${cliente}</span>
        <span><b>Total da Nota:</b> ${dinheiro(total)}</span>
        <div>${finalDepartamentos}</div>
    `

}

async function registrarEnvioMaterial(id) {

    try {

        overlayAguarde()

        const transportadora = obVal('transportadora')

        if (!transportadora)
            return popup({ mensagem: 'A transportadora ficou em branco' })

        const dados = {
            metodo_envio: obVal('metodo_envio'),
            rastreio: obVal('rastreio'),
            transportadora,
            custo_frete: Number(obVal('custo_frete') || 0),
            n_nota: obVal('n_nota'),
            volumes: Number(obVal('volumes') || 0),
            data_saida: obVal('data_saida'),
            data_entrega: obVal('data_entrega')
        }

        await enviar(`fretes/${id}`, dados)

        removerPopup()

    } catch (err) {
        console.error(err)
        popup({ mensagem: 'Falha ao salvar o registro de envio: Fale com o suporte.' })
    }

}