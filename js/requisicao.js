// Chamado que recebe as correções: orçamento vinculado registra no master.
async function chamadoDaRequisicao(departamento) {
    const { master } = await recuperarDado('contratos_vinculados', departamento) || {}
    const idChamado = master || departamento
    const ocorrencia = await recuperarDado('dados_ocorrencias', idChamado)
    return { idChamado, ocorrencia }
}

// Ferramentas e materiais de funcionários e parceiros têm fluxo próprio (js/colaboradores.js).
async function formularioRequisicao(id = crypto.randomUUID()) {

    overlayAguarde()

    const ativo = controles?.ocorrencias?.ativo

    const {
        pedido,
        volumes,
        comentario,
        requisicao,
        prazo,
        recebedor
    } = await recuperarDado('requisicoes', id) || {}

    const { idChamado, ocorrencia } = await chamadoDaRequisicao(ativo)

    const pedidos = await pesquisarDB({
        base: 'pedidos',
        filtros: {
            'departamento': {
                op: 'includes',
                value: ativo
            }
        },
        limite: 500
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

    // Fluxo da correção de Logística: só escolhe na primeira gravação da requisição;
    const escolherFluxo = ocorrencia && !ocorrencia.correcoes?.[id]
    const fluxos = {}
    for (const c of Object.values(ocorrencia?.correcoes || {})) {
        const aba = c.aba || 'geral'
        if (String(c.tipoCorrecaoNome || '').includes('PAGAMENTO DE PARCEIRO'))
            fluxos[aba] = null
        else if (fluxos[aba] !== null && (!fluxos[aba] || toTimestamp(c.data) > toTimestamp(fluxos[aba].data)))
            fluxos[aba] = c
    }

    const opcoesFluxo = Object.entries(fluxos)
        .filter(([, ultima]) => ultima)
        .sort(([, a], [, b]) => toTimestamp(b.data) - toTimestamp(a.data))
        .map(([aba, { data }]) => {
            const status = ocorrencia?.snapshots?.abas?.[aba]?.nome || 'Sem status'
            return `<option value="${aba}">${status} - ${String(data || '').slice(0, 10)}</option>`
        })
        .join('')

    const opcoesPedido = pedidos.resultados
        .map(({ id: idPedido, pedido: numero, tipo, valor }) => {
            const texto = [numero, tipo, valor != null ? dinheiro(valor) : '']
                .filter(Boolean)
                .join(' - ')
            return `<option value="${idPedido}" ${idPedido == pedido ? 'selected' : ''}>${texto}</option>`
        })
        .join('')

    const salvos = requisicao || {}

    // Sempre parte do orçamento, com o que já foi preenchido por cima;
    const itensOrcamento = Object.entries(orcamento?.dados_composicoes || {})
        .filter(([, { tipo }]) => tipo !== 'SERVIÇO')
        .map(([id, dados]) => {
            const { qtde_enviar, origem, omie, tipo, custo } = salvos[dados.codigo] || {}
            return {
                id,
                ...dados,
                ...Object.fromEntries(
                    Object.entries({ qtde_enviar, origem, omie, tipo, custo })
                        .filter(([, valor]) => valor !== undefined)
                ),
                avulso: false
            }
        })

    // Itens fora do orçamento ficam no topo;
    const codigosOrcamento = new Set(itensOrcamento.map(i => i.codigo))
    const itensExtras = Object.values(salvos)
        .filter(i => i?.codigo && !codigosOrcamento.has(i.codigo))
        .map(i => ({ ...i, avulso: true }))

    const base = [...itensExtras, ...itensOrcamento]

    const tabela = await modTab({
        base,
        pag: 'requisicao',
        alturaMinima: '60dvh',
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
            <div class="campo-requisicao${v1 === 'Comentário' ? ' requisicao-campo-comentario' : ''}">
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
                <select name="pedido">
                    <option value="">Selecione</option>
                    ${opcoesPedido}
                </select>
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
        ...(escolherFluxo
            ? [{
                linha: 1,
                v1: 'Fluxo',
                v2: `
                    <select id="fluxoRequisicao">
                        <option value="">Selecione</option>
                        <option value="novo">Novo fluxo</option>
                        ${opcoesFluxo}
                    </select>
                `
            }]
            : []
        ),
        {
            linha: 1,
            v1: 'Comentário',
            v2: `<textarea rows="2" id="comentario">${comentario || ''}</textarea>`
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
                <section class="requisicao-contorno requisicao-grupo-${linha}">
                    <div class="requisicao-titulo">
                        ${titulo}
                    </div>
                    <div class="requisicao-dados">
                        ${c}
                    </div>
                </section>
            `
        })
        .join('')

    const elemento = `
        <div id="pdf" class="requisicao-tela requisicao-formulario" data-id="${id}">

            <div class="requisicao-cabecalho-cartoes">${linhas}</div>
            ${tabela}

        </div>
    `

    const botoes = [
        {
            texto: 'Adicionar item',
            funcao: 'adicionarItemRequisicao()',
            img: 'adicionar'
        },
        {
            texto: 'Salvar',
            funcao: `salvarRequisicao('${id}')`,
            img: 'concluido'
        }
    ]

    popup({
        botoes,
        elemento,
        conteudoRodape: `<div class="rodape-resumo"><span>Total da requisição</span><strong id="total_requisicao">${dinheiro(0)}</strong></div>`,
        titulo: 'Requisição de Materiais',
        autoDestruicao: ['requisicao']
    })

    controles.requisicao.idChamado = idChamado

    await paginacao('requisicao')

}

// Inclui um item que não existe no orçamento;
async function adicionarItemRequisicao() {

    const existeNovo = controles.requisicao.base
        .some(item => item.codigo == 'novo')

    if (existeNovo)
        return

    controles.requisicao.base.unshift({
        codigo: 'novo',
        avulso: true
    })

    await paginacao('requisicao')

}

async function removerItemRequisicao(codigo) {

    controles.requisicao.base = controles.requisicao.base
        .filter(item => item.codigo !== codigo)

    await paginacao('requisicao')

}

async function atualizarItem() {
    const codigo = document.querySelector('[name="novo"]')?.id

    if (!codigo)
        return

    const existente = controles.requisicao.base.find(item => item.codigo == codigo)
    if (existente) {
        await removerItemRequisicao('novo')
        return popup({ mensagem: existente.avulso ? 'Este item já foi adicionado.' : 'Este item já está no orçamento, use a linha dele.' })
    }

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
        .map(item => item.codigo == 'novo' ? novo : item)

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
                <img src="${imagem || logo}" onerror="this.onerror = null; this.src = logo">
            </td>

            <td style="font-size: 1.2em; white-space: nowrap;">
                <div style="${horizontal}; gap: 5px;">
                    ${avulso ? `<img src="imagens/excluir.png" style="width: 1.5rem; cursor: pointer;" title="Remover item" onclick="removerItemRequisicao('${codigo}')">` : ''}
                    <span>${codigo == 'novo' ? '' : codigo || ''}</span>
                </div>
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

    // O saldo do orçamento só é consumido por requisições do mesmo departamento;
    const saidas = requisicoes.resultados
        .filter(r => [r.departamento].flat().includes(ativo))

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

        const totalExistente = saidas
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

        const { idChamado } = controles.requisicao
        const requisicao = await recuperarDado('requisicoes', id) || {}
        const pedido = document.querySelector('[name="pedido"]')?.value
        const campoFluxo = document.querySelector('#fluxoRequisicao')

        if (!pedido)
            return popup({ mensagem: 'Escolha um pedido' })

        if (campoFluxo && !campoFluxo.value)
            return popup({ mensagem: 'Escolha o fluxo da requisição: um existente ou "Novo fluxo"' })

        const aba = !campoFluxo || campoFluxo.value == 'novo' ? id : campoFluxo.value

        // Guarda só o que vai ser enviado e os itens extras; o restante vem do orçamento;
        const itens = (controles.requisicao.base || [])
            .filter(i => i.codigo && i.codigo !== 'novo' && (i.avulso || Number(i.qtde_enviar) > 0))

        const dados = {
            ...requisicao,
            avulso: itens.some(i => i.avulso) ? 'S' : 'N',
            departamento,
            executor: acesso.usuario,
            data: dataServidor().toLocaleString(),
            comentario: document.querySelector('#comentario').value || '',
            pedido,
            recebedor: document.querySelector('#recebedor')?.value || '',
            prazo: document.querySelector('#prazo')?.value || '',
            volumes: document.querySelector('#volumes').value || 0,
            total_requisicao: conversor(document.querySelector('#total_requisicao').textContent),
            requisicao: Object.fromEntries(itens.map(i => [i.codigo, i]))
        }

        const resultado = await enviar(`requisicoes/${id}`, dados)
        if (!resultado?.success)
            throw new Error(resultado?.mensagem || 'Falha ao salvar Requisição')

        // Orçamento vinculado registra a correção no chamado master;
        const chamado = idChamado || departamento
        const ocorrencia = await recuperarDado('dados_ocorrencias', chamado)

        if (ocorrencia && !ocorrencia.correcoes?.[id]) {
            const correcao = {
                aba,
                data: dados.data,
                datas: {},
                descricao: 'Requisição de materiais criada',
                dtCorrecao: dataServidor().toISOString().slice(0, 10),
                setor: ['LOGÍSTICA'],
                tipoCorrecao: '4Zmd3',
                usuario: acesso.usuario
            }

            const resultadoCorrecao = await enviar(`dados_ocorrencias/${chamado}/correcoes/${id}`, correcao)
            if (!resultadoCorrecao?.success)
                throw new Error('Requisição salva, mas a correção de Logística não foi criada. Salve novamente para tentar de novo.')
        }

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
        total_requisicao,
        departamento
    } = await recuperarDado('requisicoes', id) || {}

    const ativo = departamento || controles?.ocorrencias?.ativo
    const orcamentos = await pesquisarDB({
        base: 'mvw_dados_orcamentos',
        filtros: {
            'dados_orcam.contrato': {
                op: '=',
                value: ativo
            }
        }
    })

    // Primeiro resultado;
    const { 
        dados_orcam,
        contrato 
    } = orcamentos?.resultados?.[0] || {}

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
        prazo: prazo ? new Date(toTimestamp(prazo)).toLocaleDateString() : null,
        recebedor
    })
        .filter(([, valor]) => valor)
        .map(([chave, valor]) => {

            if (chave == 'total_requisicao')
                valor = dinheiro(valor)

            return `<span><b>${inicialMaiuscula(chave)}</b> ${valor}</span>`
        })
        .join('')

    const {
        nome,
        cnpj,
        cidade,
        bairro,
        endereco,
        cep
    } = await recuperarDado('clientes', dados_orcam?.omie_cliente) || {}

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
                    <img src="${imagem || logo}" style="width: 4rem;" onerror="this.onerror = null; this.src = logo">
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

        // contrato pode vir como texto ou lista; espalhar o texto separava letra por letra;
        const campos = [
            'Requisição',
            ...[contrato || ativo].flat(),
            agoraServidor()
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
        console.error(err)
        popup({ mensagem: 'Falha ao gerar o PDF, tente novamente ou fale com o Suporte!' })
    }

}
