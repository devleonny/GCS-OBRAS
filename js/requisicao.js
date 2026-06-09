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
        transportadora,
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

    const campos = `
        <div class="requisicao-contorno" style="width: 500px;">
            <div class="requisicao-titulo">Dados da Requisição</div>
            <div class="requisicao-dados">

                <div style="${vertical}; width: 100%;">
                    <span>Número do Pedido</span>
                    <span ${pedido ? `id="${dadosRequisicao?.pedido}"` : ''} name="pedido" class="opcoes" onclick="cxOpcoes('pedido')">
                        ${pedido || 'Selecione'}
                    </span>
                </div>

                <div style="${vertical}; width: 100%;">
                    <span>Prazo</span>
                    <input id="prazo" type="date" value="${prazo || ''}">
                </div>

                <div style="${vertical}; width: 100%;">
                    <span>Quem recebeu?</span>
                    <input id="recebedor" value="${recebedor || ''}">
                </div>
                
                <div style="${vertical}; width: 100%;">
                    <span>Transportadora</span>
                    <select id="transportadora">
                        ${transportadoras.map(op => `<option ${transportadora == op ? 'selected' : ''}>${op}</option>`).join('')}
                    </select>
                </div>

                <div style="${vertical}; width: 100%;">
                    <span>Volumes</span>
                    <input value="${volumes || ''}" id="volumes" type="number">
                </div>

                <div style="${vertical}; width: 100%;">
                    <label>Comentário</label>
                    <textarea rows="3" id="comentario" style="width: 80%;">${comentario || ''}</textarea>
                </div>

                <button data-ocultar onclick="salvarRequisicao('${id}')">Salvar Requisição</button>
            </div>
        </div>`

    const modeloLabel = (valor1, valor2) => `<label><b>${valor1}</b> ${valor2}</label>`

    const colunas = {
        'Imagem': {},
        'Cod GCS': { chave: 'codigo' },
        'Cod OMIE': {},
        'Informações do Item': { chave: 'descricao' },
        'Tipo': { chave: 'tipo' },
        'Origem': { chave: 'origem' },
        'Quantidade Enviar': {},
        'Quantidade Orçada': {},
        'Valor Unit Bruto': {},
        'Valor Total Bruto': {},
        'Valor Unitário': {},
        'Valor Total': {}
    }

    const base = Object.entries(requisicao || orcamento?.dados_composicoes || {})
        .filter(([, { tipo }]) => tipo !== 'SERVIÇO')
        .map(([id, dados]) => ({
            id,
            ...dados
        }))

    const btnExtras = `
        <div id="painelAvulso">
            <button class="etiqueta-chamado" onclick="mudarParaAvulso(true)">Requisição AVULSA</button>
        </div>
        `

    const tabela = await modTab({
        base,
        btnExtras,
        pag: 'requisicao',
        id,
        lpu_ativa: orcamento?.lpu_ativa,
        funcaoAdicional: ['calcularRequisicao'],
        body: 'bodyRequisicao',
        colunas,
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

    const elemento = `
    <div id="pdf" class="requisicao-tela" data-id="${id}">

        <div class="requisicao-contorno" style="width: 98%">
            <div class="requisicao-cabecalho">
                <img src="https://i.imgur.com/5zohUo8.png">
                <span>REQUISIÇÃO DE COMPRA DE MATERIAL</span>
            </div>
        </div>

        <div style="${horizontal}; gap: 2rem; margin: 10px;">

            ${campos}
                
            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Dados do Cliente</div>
                <div class="requisicao-dados">

                    ${modeloLabel('Cliente', nome || '')}
                    ${modeloLabel('CNPJ', cnpj || '')}
                    ${modeloLabel('Endereço', endereco || '')}
                    ${modeloLabel('Bairro', bairro || '')}
                    ${modeloLabel('Cidade', cidade || '')}
                    ${modeloLabel('Departamento', ativo)}

                </div>
            </div>

            <div class="requisicao-contorno">
                <div class="requisicao-titulo">Total</div>
                <div class="requisicao-dados">
                    <label style="white-space: nowrap;" id="total_requisicao"></label> 
                </div>
            </div>

        </div>

        ${tabela}

    <div>`

    popup({ elemento, cor: 'white', titulo: 'Requisição', autoDestruicao: ['requisicao'] })

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
        adicionais,
        custo_original,
        desconto,
        descricao,
        omie,
        qtde_enviar = 0,
        qtde
    } = item || {}

    // Tipo desconto vem por padrão em dinheiro;
    // No caso de acréscimo a chave "custo" já vem no valor final;

    const total = (custo * qtde) - desconto
    const unitario = custo_original || custo || 0

    const sinal = unitario < custo
        ? '<img src="imagens/up.png" style="width: 1.5rem;">'
        : unitario > custo
            ? '<img src="imagens/down.png" style="width: 1.5rem;">'
            : ''

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
                <input class="requisicao-campo" style="min-width: 10rem;" value="${omie || ''}">
            </td>
            <td>
                <div style="${horizontal}; justify-content: space-between; min-width: 200px; gap: 1rem;">
                    <div style="${vertical}; gap: 2px;">
                        <label><b>DESCRIÇÃO</b></label>
                        ${descricaoFinal}
                    </div>
                    ${codigo ? `<img src="imagens/construcao.png" onclick="abrirAdicionais('${codigo}')">` : ''}
                </div>
            </td>
            <td>
                <select class="opcoesSelect" onchange="atualizarValorRequisicao('${codigo}', 'tipo', this.value)">
                    ${opcoesRequisicao.map(o => `<option ${tipo == o ? 'selected' : ''}>${o}</option>`).join('')}
                </option>
            </td>
            <td>
                <select class="opcoesSelect"  onchange="atualizarValorRequisicao('${codigo}', 'origem', this.value)">
                    ${['Matriz', 'Região', 'Kit Técnico'].map(o => `<option ${origem == o ? 'selected' : ''}>${o}</option>`).join('')}
                </option>
            </td>
            <td>
                <input 
                    class="requisicao-campo" 
                    type="number" name="qtde" 
                    oninput="calcularRequisicao()" 
                    min="0" 
                    value="${qtde_enviar || ''}">
            </td>
            <td style="text-align: center;" name="qtde_orcamento">
                ${qtde || 0}
            </td>

            <td style="white-space: nowrap;" name="unitarioBruto">
                ${dinheiro(unitario || 0)}
            </td>
            <td style="white-space: nowrap;" name="totalBruto"></td>

            <td style="white-space: nowrap;" name="custo">
                ${dinheiro(custo || 0)}
            </td>
            <td>
                <div style="${horizontal}; gap: 1rem;"> 
                    <span name="total" style="white-space: nowrap;"></span>
                    ${sinal}
                </div>
            </td>
        </tr>
        `

    const linhaAdicional = Object.values(adicionais || {})
        .map(a => {
            const tr = `
                    <tr style="background-color: #ededed;">
                        <td></td>
                        <td>${codigo}</td>
                        <td></td>
                        <td>${a.descricao}</td>
                        <td>ITEM ADICIONAL</td>
                        <td style="text-align: center;">${a.qtde}</td>
                        <td colspan="3">${a.comentario}</td>
                    </tr>
                `
            return tr
        })
        .join('')

    return linhaPrincipal + linhaAdicional
}

function atualizarValorRequisicao(codigo, campo, valor) {
    const base = controles.requisicao.base

    if (!Array.isArray(base))
        return

    let item = base.find(i => i.codigo == codigo)

    if (!item) {
        item = { codigo }
        base.push(item)
    }

    item[campo] = valor
}

async function abrirAdicionais(codigo) {
    const ths = ['Descrição', 'Quantidade', 'Comentário', '']
        .map(op => `<th>${op}</th>`)
        .join('')

    const botoes = [
        { texto: 'Adicionar Peça', img: 'baixar', funcao: `criarLinhaPeca()` },
        { texto: 'Salvar', img: 'concluido', funcao: `salvarAdicionais('${codigo}')` }
    ]

    const linhas = [
        {
            elemento: `
            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead><tr>${ths}</tr></thead>
                            <tbody id="linhasManutencao"></tbody>
                        </table>
                    </div>
                <div class="rodape-tabela"></div>
            </div>`
        }
    ]

    popup({ linhas, botoes, titulo: 'Itens Adicionais' })

    const item = (controles.requisicao.base || []).find(i => i.codigo == codigo)
    const adicionais = item?.adicionais || {}

    for (const [codigoAdicional, dados] of Object.entries(adicionais)) {
        criarLinhaPeca(codigoAdicional, dados)
    }
}

async function salvarAdicionais(codigo) {
    const linhas = document.querySelectorAll('#linhasManutencao tr')

    const adicionais = [...linhas].reduce((acc, linha) => {
        const tds = linha.querySelectorAll('td')
        const cod = linha.id

        const span = tds[0].querySelector('span')
        const qtde = Number(tds[1].querySelector('input')?.value || 0)
        const comentario = tds[2].querySelector('textarea')?.value || ''

        acc[cod] = {
            descricao: span.textContent,
            qtde,
            comentario
        }

        return acc
    }, {})

    let item = controles.requisicao.base.find(i => i.codigo == codigo)

    if (!item) {
        item = { codigo }
        controles.requisicao.base.push(item)
    }

    item.adicionais = adicionais

    removerPopup()
    await paginacao()
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

        const totalExistente = requisicoes.resultados
            .map(r => Number(r?.requisicao?.[codigo]?.qtde_enviar || 0))
            .reduce((soma, valor) => soma + valor, 0)

        const avulso = linha.dataset.avulso == 'S'
        const qtdeOrcamento = conversor(linha.querySelector('[name="qtde_orcamento"]').textContent)
        const quantidadeRestante = qtdeOrcamento - totalExistente
        const campoQtde = linha.querySelector('[name="qtde"]')

        if (!avulso && Number(campoQtde.value) > quantidadeRestante)
            campoQtde.value = quantidadeRestante

        const custo = conversor(linha.querySelector('[name="custo"]').textContent)
        const unitarioBruto = conversor(linha.querySelector('[name="unitarioBruto"]').textContent)
        const qtde = Number(campoQtde?.value || 0)

        let item = controles.requisicao.base.find(i => i.codigo == codigo)

        if (!item) {
            item = { codigo }
            controles.requisicao.base.push(item)
        }

        item.qtde_enviar = qtde

        const totalBruto = unitarioBruto * qtde
        const totalLinha = custo * qtde

        total += totalLinha

        linha.querySelector('[name="totalBruto"]').textContent = dinheiro(totalBruto)
        linha.querySelector('[name="total"]').textContent = dinheiro(totalLinha)
    }

    document.querySelector('#total_requisicao').textContent = dinheiro(total)
}

async function salvarRequisicao(id) {

    overlayAguarde()

    try {

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
            transportadora: document.querySelector('#transportadora').value || '',
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
    const { status, dados_orcam, snapshots } = orcamentos?.resultados?.[0] || {}

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

    const dCabecalho = Object.entries({ orçamento: dados_orcam?.contrato, chamado: dados_orcam?.chamado, nome, cnpj, endereco, bairro, cidade, cep })
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

    const linhas = []

    const modTR = (dados) => {

        const { imagem, codigo, omie, descricao, modelo, desconto = 0, fabricante, unidade, tipo, origem, qtde_enviar = 0, custo = 0 } = dados || {}

        // Tipo desconto vem por padrão em dinheiro;
        // No caso de acréscimo a chave "custo" já vem no valor final;

        const tBruto = custo * qtde_enviar
        const tFinal = tBruto - desconto
        const unitario = (tFinal / qtde_enviar).toFixed(2)

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
                    <div style="${vertical}">
                        ${descFinal}
                    </div>
                </td>
                <td>${unidade || ''}</td>
                <td>${tipo || 'ADICIONAL'}</td>
                <td>${origem || ''}</td>
                <td style="text-align: center;">${qtde_enviar || ''}</td>
                <td style="white-space: nowrap;">${dinheiro(unitario)}</td>
                <td style="white-space: nowrap;">${dinheiro(tFinal)}</td>
            </tr>
        `

        return tr
    }

    for (const [codigo, item] of Object.entries(requisicao || {})) {

        const { qtde_enviar = 0, adicionais } = item || {}

        if (qtde_enviar < 1)
            continue

        const produto = await recuperarDado('dados_composicoes', codigo) || {}

        // Item principal || a "descrição" final sobrepõe a do item;
        linhas.push(modTR({ ...produto, ...item }))

        // Adicionais qtde nele é equivalente ao qtde_enviar do Item principal;
        for (const adicional of Object.values(adicionais || {})) {
            linhas.push(modTR({ qtde_enviar: adicional.qtde, ...adicional, codigo: produto.codigo }))
        }

    }

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
            <style>

            @page {
                size: A4;
                margin: 0.5cm;
            }

            body {
                overflow-x: hidden;
                padding: 2rem;
                font-size: 0.7rem;
                font-family: 'Poppins', sans-serif;
                margin: 0;
                padding: 20px;
                display: flex;
                align-items: start;
                justify-content: start;
                flex-direction: column;
                gap: 0.5rem;
            }

            .header {
                width: 100%;
                text-align: center;
                margin-bottom: 20px;
                padding: 10px 0;
                border-radius: 5px;
            }

            .header img {
                height: 70px;
            }

            .tabela {
                width: 100%;
                border-collapse: collapse;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 20px;
            }

            .tabela th {
                background-color: #dfdede;
                padding: 10px;
                text-align: left;
            }

            .tabela th, .tabela td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }

            .tabela td {
                background-color: #ffffff;
            }

            .tabela tr:nth-child(even) td {
                background-color: #f9f9f9;
            }

            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }

            </style>
        </head>
        <body>

            <div style="${horizontal}; width: 100%; justify-content: space-between;">
                <span style="font-size: 1.5rem;">REQUISIÇÃO DE MATERIAIS</span>
                <img style="width: 7rem;" src="https://i.imgur.com/5zohUo8.png">
            </div>

            <div style="${horizontal}; justify-content: start; width: 100%; gap: 2rem;">

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

            <br>
            
            <table class="tabela">
                <thead>
                    ${colunas.map(c => `<th>${c}</th>`).join('')}
                </thead>
                <tbody>
                    ${linhas.join('')}
                </tbody>
            </table>
        </body>
        </html>`

    const elemento = `<div style="padding: 2rem;">${htmlContent}</div>`

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

        await gerarPdfOnline(htmlContent, nome)
        removerOverlay()

    } catch (err) {
        popup({ mensagem: err.message || 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte' })

    }

}
