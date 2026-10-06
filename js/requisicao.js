async function formularioRequisicao(id = crypto.randomUUID()) {

    overlayAguarde()

    const ativo = controles?.ocorrencias?.ativo

    const pedidos = await pesquisarDB({
        base: 'pedidos',
        filtros: {
            'departamento': {
                op: 'includes',
                value: ativo
            }
        }
    })

    if (!pedidos.resultados.length)
        return popup({ mensagem: 'Crie um pedido antes de criar uma requisição!' })

    const orcamentos = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': {
                op: '=',
                value: ativo
            }
        }
    })

    // Primeiro resultado;
    const orcamento = orcamentos?.resultados?.[0]

    if (!orcamento)
        return popup({ mensagem: `Orçamento ${ativo} provavelmente excluído, fale com o suporte.` })

    const {
        cnpj,
        nome,
        cidade,
        endereco,
        bairro
    } = await recuperarDado('clientes', orcamento?.dados_orcam?.omie_cliente) || {}
    const dadosRequisicao = await recuperarDado('requisicoes', id) || {}
    const { pedido } = await recuperarDado('pedidos', dadosRequisicao?.pedido) || {}
    const {
        avulso = 'N',
        volumes,
        comentario,
        requisicao,
        prazo,
        recebedor
    } = dadosRequisicao

    controlesCxOpcoes.pedido = {
        base: 'pedidos',
        filtros: {
            departamento: { op: 'includes', value: ativo }
        },
        retornar: ['pedido'],
        colunas: {
            'Pedido': { chave: 'pedido' },
            'Tipo': { chave: 'tipo' },
            'Valor': { chave: 'valor' },
        }
    }

    const base = Object.entries(requisicao || orcamento?.dados_composicoes || {})
        .filter(([, { tipo }]) => tipo !== 'SERVIÇO')
        .map(([id, dados]) => ({
            id,
            ...dados
        }))

    const tabela = await modTab({
        base,
        btnExtras: `
        <div id="painelAvulso">
            <button class="etiqueta-chamado" onclick="mudarParaAvulso(true)">Requisição AVULSA</button>
        </div>
        `,
        pag: 'requisicao',
        id,
        lpu_ativa: orcamento?.lpu_ativa,
        funcaoAdicional: ['calcularRequisicao'],
        body: 'bodyRequisicao',
        colunas: {
            'Imagem': {},
            'Cod GCS': { chave: 'codigo' },
            'Cod OMIE': {},
            'Informações do Item': { chave: 'descricao' },
            'Tipo': { chave: 'tipo' },
            'Origem': { chave: 'origem' },
            'Quantidade Enviar': {},
            'Quantidade Orçada': {},
            'Valor Unitário': {},
            'Valor Total': {}
        },
        substituicoes: [
            {
                path: 'codigo',
                campoBusca: 'codigo',
                tabela: 'dados_composicoes',
                retorno: 'omie',
                destino: 'omie'
            }
        ],
        criarLinha: 'criarLinhaRequisicao'
    })

    const modeloLabel = ({ v1, v2 }) => {

        return `
            <div class="campo-requisicao">
                ${v1 ? `<span><small><b>${v1}</b></small></span>` : ''}
                <div>${v2}</div>
            </div>
        `
    }

    const campos = [
        {
            linha: 1,
            v1: 'Número do Pedido',
            v2: `
            <span ${pedido ? `id="${dadosRequisicao?.pedido}"` : ''} name="pedido" class="opcoes" onclick="cxOpcoes('pedido')">
                ${pedido || 'Selecione'}
            </span>
            `
        },
        {
            linha: 1,
            v1: 'Prazo',
            v2: `<input id="prazo" type="date" value="${prazo || ''}">`
        },
        {
            linha: 1,
            v1: 'Quem recebeu?',
            v2: `<input id="recebedor" value="${recebedor || ''}">`
        },
        {
            linha: 1,
            v1: 'Volumes',
            v2: `<input value="${volumes || ''}" id="volumes" type="number">`
        },
        {
            linha: 1,
            v1: 'Comentário',
            v2: `<textarea rows="3" id="comentario">${comentario || ''}</textarea>`
        },
        {
            linha: 2,
            v1: 'Cliente',
            v2: nome
        },
        {
            linha: 2,
            v1: 'CNPJ',
            v2: cnpj
        },
        {
            linha: 2,
            v1: 'Endereço',
            v2: endereco
        },
        {
            linha: 2,
            v1: 'Bairro',
            v2: bairro
        },
        {
            linha: 2,
            v1: 'Cidade',
            v2: cidade
        },
        {
            linha: 2,
            v1: 'Departamento',
            v2: ativo
        },
        {
            linha: 2,
            v1: 'Total',
            v2: `<span class="campo-valor verde" id="total_requisicao"></span> `
        }
    ]

    const linhas = [
        {
            linha: 1,
            titulo: 'Dados da Requisição'
        },
        {
            linha: 2,
            titulo: 'Dados do Cliente'
        }
    ]
        .map(({ linha, titulo }) => {

            const c = campos
                .filter(c => c.linha == linha)
                .map(c => modeloLabel(c))
                .join('')

            return `
                <div class="requisicao-contorno">
                    <div class="requisicao-titulo">
                        ${titulo}
                    </div>
                    <div class="requisicao-dados">
                        ${c}
                    </div>
                </div>
            `
        })
        .join('<hr>')

    const elemento = `
        <div id="pdf" class="requisicao-tela" data-id="${id}">

            ${linhas}
            <hr>
            ${tabela}

        </div>
    `

    const botoes = [
        {
            texto: 'Salvar',
            funcao: `salvarRequisicao('${id}')`,
            img: 'concluido'
        }
    ]

    popup({
        botoes,
        elemento,
        titulo: 'Requisição de Materiais',
        autoDestruicao: ['requisicao']
    })

    if (avulso == 'S')
        await mudarParaAvulso()
    else
        await paginacao('requisicao')

}

async function mudarParaAvulso(removerBase) {

    if (removerBase)
        controles.requisicao.base = []

    await paginacao('requisicao')

    const painelAvulso = document.getElementById('painelAvulso')

    painelAvulso.innerHTML = `<button class="etiqueta-chamado" onclick="adicionarLinhaAvulso()">Adicionar Linha</button>`

}

async function adicionarLinhaAvulso() {

    const existeNovo = controles.requisicao.base
        .some(item => item.codigo == 'novo')

    if (existeNovo)
        return

    controles.requisicao.avulso = 'S'

    controles.requisicao.base.push({
        codigo: 'novo'
    })

    await paginacao('requisicao')

}

async function atualizarItem() {
    const codigo = document.querySelector('[name="novo"]')?.id

    if (!codigo)
        return

    const lpu = String(controles?.requisicao?.lpu_ativa).toLowerCase()
    const { descricao, imagem, snapshots, modelo, fabricante, unidade, tipo } =
        await recuperarDado('dados_composicoes', codigo)

    const custo = snapshots?.[lpu]?.[0] || 0

    const novo = {
        imagem,
        avulso: true,
        custo,
        descricao,
        modelo,
        fabricante,
        unidade,
        tipo,
        codigo
    }

    controles.requisicao.base = controles.requisicao.base
        .filter(item => item.codigo !== 'novo')

    controles.requisicao.base.push(novo)

    await paginacao('requisicao')
}

async function criarLinhaRequisicao(item) {

    const {
        imagem,
        avulso = null,
        codigo,
        custo,
        origem,
        tipo,
        descricao,
        omie,
        qtde_enviar = 0,
        qtde
    } = item || {}

    let descricaoFinal = null

    if (codigo == 'novo') {

        const lpu = controles?.requisicao?.lpu_ativa
            ? String(controles?.requisicao?.lpu_ativa).toLowerCase()
            : null

        controlesCxOpcoes['novo'] = {
            base: 'dados_composicoes',
            retornar: ['descricao'],
            funcaoAdicional: ['atualizarItem'],
            ...(
                lpu ? { filtros: { [`snapshots.${lpu}.0`]: { op: '!=', value: 0 } } } : {}
            ),
            colunas: {
                'Código': { chave: 'codigo' },
                'Descrição': { chave: 'descricao' },
                'Modelo': { chave: 'modelo' },
                'Fabricante': { chave: 'fabricante' },
                ...(
                    lpu ? { 'Valor': { chave: `snapshots.${lpu}.1` } } : {}
                )
            }
        }

        descricaoFinal = `<span class="opcoes" name="novo" onclick="cxOpcoes('novo')">Selecione</span>`

    } else {
        descricaoFinal = `<span>${descricao || ''}</span>`
    }

    const linhaPrincipal = `
        <tr 
            data-avulso=${avulso ? 'S' : 'N'} 
            ${codigo !== 'novo' ? `data-codigo="${codigo}"` : ''}>
            
            <td>
                <img src="${imagem || logo}">
            </td>

            <td style="font-size: 1.2em; white-space: nowrap;">
                ${codigo || ''}
            </td>

            <td>
                <input type="text" oninput="calcularRequisicao()" name="omie" value="${omie || ''}">
            </td>
            
            <td>
                <div style="${vertical}; gap: 2px; text-align: left;">
                    <label><b>DESCRIÇÃO</b></label>
                    ${descricaoFinal}
                </div>
            </td>

            <td>
                <select name="tipo" class="opcoes-select" onchange="calcularRequisicao()">
                    ${opcoesRequisicao.map(o => `<option ${tipo == o ? 'selected' : ''}>${o}</option>`).join('')}
                </option>
            </td>
            <td>
                <select name="origem" class="opcoes-select" onchange="calcularRequisicao()">
                    ${['Matriz', 'Região', 'Kit Técnico'].map(o => `<option ${origem == o ? 'selected' : ''}>${o}</option>`).join('')}
                </option>
            </td>
            
            <td>
                <input 
                    type="number" name="qtde" 
                    oninput="calcularRequisicao()" 
                    min="0" 
                    value="${qtde_enviar || ''}">
            </td>

            <td style="text-align: center;" name="qtde_orcamento">
                ${qtde || 0}
            </td>

            <td style="white-space: nowrap;" name="custo">
                ${dinheiro(custo || 0)}
            </td>

            <td style="white-space: nowrap;" name="total"></td>

        </tr>
        `

    return linhaPrincipal

}

async function calcularRequisicao() {

    // Pesquisa de outras requisições e salvamento em memória para evitar buscas repetitivas;
    const ativo = controles?.ocorrencias?.ativo
    const requisicoes = controles?.requisicao?.pesquisa
        ? controles.requisicao.pesquisa
        : await pesquisarDB({
            base: 'requisicoes',
            filtros: {
                id: {
                    op: '!=',
                    value: controles.requisicao.id
                },
                departamento: {
                    op: 'includes',
                    value: ativo
                }
            }
        })

    controles.requisicao.pesquisa = requisicoes

    const linhas = document.querySelectorAll('#bodyRequisicao tr')

    let total = 0

    controles.requisicao.base ??= []

    for (const linha of linhas) {

        const codigo = linha.dataset.codigo

        if (!codigo)
            continue

        const obVal = (n) => {
            const el = linha.querySelector(`[name="${n}"]`)
            return el
                ? el.value || el.id || el.textContent || null
                : null
        }

        const totalExistente = requisicoes.resultados
            .map(r => Number(r?.requisicao?.[codigo]?.qtde_enviar || 0))
            .reduce((soma, valor) => soma + valor, 0)

        const avulso = linha.dataset.avulso == 'S'
        const qtdeOrcamento = conversor(obVal('qtde_orcamento'))
        const quantidadeRestante = qtdeOrcamento - totalExistente
        const campoQtde = linha.querySelector('[name="qtde"]')

        if (!avulso && Number(campoQtde.value) > quantidadeRestante)
            campoQtde.value = quantidadeRestante

        const custo = conversor(obVal('custo'))
        const qtdeEnviar = Number(campoQtde?.value || 0)
        const totalLinha = custo * qtdeEnviar

        total += totalLinha
        linha.querySelector('[name="total"]').innerHTML = dinheiro(totalLinha)

        // Salvamento
        let item = controles.requisicao.base.find(i => i.codigo == codigo)

        if (!item) {
            item = { codigo }
            controles.requisicao.base.push(item)
        }

        Object.assign(item, {
            custo,
            origem: obVal('origem'),
            omie: obVal('omie'),
            tipo: obVal('tipo'),
            qtde_enviar: qtdeEnviar
        })

    }

    document.querySelector('#total_requisicao').innerHTML = dinheiro(total)
}

async function salvarRequisicao(id) {

    try {

        overlayAguarde()
        const departamento = controles?.ocorrencias?.ativo
        if (!departamento)
            return popup({ mensagem: 'Departamento não encontrado...' })

        const requisicao = await recuperarDado('requisicoes', id) || {}
        const pedido = document.querySelector('[name="pedido"]')?.id

        if (!pedido)
            return popup({ mensagem: 'Escolha um pedido' })

        const dados = {
            ...requisicao,
            avulso: controles?.requisicao?.avulso || 'N',
            departamento,
            executor: acesso.usuario,
            data: new Date().toLocaleString(),
            comentario: document.querySelector('#comentario').value || '',
            pedido,
            recebedor: document.querySelector('#recebedor')?.value || '',
            prazo: document.querySelector('#prazo')?.value || '',
            volumes: document.querySelector('#volumes').value || 0,
            total_requisicao: conversor(document.querySelector('#total_requisicao').textContent),
            requisicao: Object.fromEntries(
                (controles.requisicao.base || [])
                    .map(i => [i.codigo, i])
            )
        }

        await enviar(`requisicoes/${id}`, dados)
        removerPopup()

    } catch (err) {
        console.warn(err)
        popup({ mensagem: err.message || 'Falha ao salvar Requisição' })
    }

}


async function gerarPdfRequisicao(id, visualizar) {

    overlayAguarde()

    const {
        requisicao,
        volumes,
        data,
        empresa,
        executor,
        prazo,
        recebedor,
        transportadora,
        comentario,
        pedido,
        total_requisicao
    } = await recuperarDado('requisicoes', id) || {}

    const ativo = controles?.ocorrencias?.ativo
    const orcamentos = await pesquisarDB({
        base: 'dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': {
                op: '=',
                value: ativo
            }
        }
    })

    // Primeiro resultado;
    const { dados_orcam, snapshots } = orcamentos?.resultados?.[0] || {}

    // Pedido vinculado;
    const dadosPedido = await recuperarDado('pedidos', pedido) || {}

    const dStatus = Object.entries({
        'empresa a faturar': dadosPedido.empresa,
        pagamento: dadosPedido.pagamento,
        pedido: dadosPedido.pedido,
        tipo: dadosPedido.tipo,
        valor_pedido: dadosPedido.valor
            ? dinheiro(dadosPedido.valor)
            : null,
        transportadora,
        volumes,
        empresa,
        executor,
        total_requisicao,
        data,
        prazo: new Date(toTimestamp(prazo)).toLocaleDateString(),
        recebedor
    })
        .filter(([, valor]) => valor)
        .map(([chave, valor]) => {

            if (chave == 'total_requisicao')
                valor = dinheiro(valor)

            return `<span><b>${inicialMaiuscula(chave)}</b> ${valor}</span>`
        })
        .join('')

    const { nome, cnpj, cidade, bairro, endereco, cep } = await recuperarDado('clientes', dados_orcam?.omie_cliente) || {}

    const dCabecalho = Object.entries({
        orçamento: dados_orcam?.contrato,
        chamado: dados_orcam?.chamado,
        nome,
        cnpj,
        endereco,
        bairro,
        cidade,
        cep
    })
        .filter(([, valor]) => valor)
        .map(([chave, valor]) => {
            return `<span><b>${inicialMaiuscula(chave)}</b> ${valor}</span>`
        })
        .join('')

    const colunas = [
        'Imagem',
        'Código GCS',
        'Código OMIE',
        'Descrição',
        'Unidade',
        'Tipo',
        'Origem',
        'Quantidade',
        'Valor Unitário',
        'Valor Total'
    ]
        .map(c => `<th>${c}</th>`)
        .join('')

    const linhas = Object.values(requisicao || {})
        .filter(i => i.qtde_enviar > 0)
        .map(item => {

            const {
                imagem,
                codigo,
                omie,
                descricao,
                modelo,
                fabricante,
                unidade,
                tipo,
                origem,
                qtde_enviar,
                custo
            } = item || {}

            const tFinal = custo * qtde_enviar

            const descFinal = Object.entries({ descricao, modelo, fabricante })
                .filter(([, valor]) => valor)
                .map(([chave, valor]) => {
                    return `<span><b>${chave.toUpperCase()}</b> ${valor}</span>`
                })
                .join('')

            const tr = `
            <tr>
                <td>
                    <img src="${imagem || logo}" style="width: 4rem;">
                </td>
                <td>${codigo}</td>
                <td>${omie || ''}</td>
                <td>
                    <div style="${vertical}; text-align: start;">
                        ${descFinal}
                    </div>
                </td>
                <td>${unidade || ''}</td>
                <td>${tipo || 'ADICIONAL'}</td>
                <td>${origem || ''}</td>
                <td style="text-align: center;">${qtde_enviar || ''}</td>
                <td style="white-space: nowrap;">${dinheiro(custo)}</td>
                <td style="white-space: nowrap;">${dinheiro(tFinal)}</td>
            </tr>
        `

            return tr

        })
        .join('')


    const html = `
        <div id="pdf" style="${vertical}; gap: 1rem; width: 95%; padding: 1rem;">

            <div style="${horizontal}; gap: 1rem;">
                <img style="width: 7rem;" src="https://i.imgur.com/5zohUo8.png">
                <span style="font-size: 1.5rem;">REQUISIÇÃO DE MATERIAIS</span>
            </div>

            <div style="font-size: 12px; ${horizontal}; justify-content: start; gap: 2rem;">

                <div style="${vertical}; gap: 2px;">

                    ${dCabecalho}

                </div>

                <div style="${vertical}; gap: 2px;">

                    ${dStatus}

                </div>

                <div style="${vertical};">
                    <span><b>COMENTÁRIO</b></span>
                    <div style="white-space: pre-wrap; text-align: left;">${comentario || 'Sem comentários'}</div>
                </div>

            </div>
            
            <table class="tabela-v2">
                <thead>
                    ${colunas}
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>

        </div>
        `

    const elemento = `<div>${html}</div>`

    if (visualizar)
        return popup({ elemento, titulo: 'PDF' })

    try {

        const campos = [
            'Requisição',
            ...snapshots?.contrato,
            Date.now()
        ]

        const nome = campos
            .filter(c => c)
            .join('-')

        await pdf({
            html,
            estilos: ['tabelas-parceiro'],
            nome
        })

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte' })

    }

}
