async function telaRelatorio() {

    const colunas = {
        '': {},
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Status': { chave: 'snapshots.ultimaCorrecao' },
        'Data da Abertura': { chave: 'data_registro', tipoPesquisa: 'data' },
        'Data do Agendamento': { chave: 'snapshots.dtCorrecao' },
        'Solicitante': { chave: 'usuario' },
        'Executores': { chave: 'snapshots.executores' },
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' },
        'Prioridade': { chave: 'snapshots.prioridade' }
    }

    const tabela = await modTab({
        colunas,
        pag: 'relatorioOcorrencias',
        body: 'bodyRelatorioOcorrencias',
        base: 'dados_ocorrencias',
        filtros: {
            ...(
                acesso.permissao == 'cliente'
                    ? { 'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa } }
                    : {}
            )
        },
        criarLinha: 'criarLinhaRelatorio'
    })

    const modelo = ({ texto, qtde, porcentagem, cor }) => `
        <div style="background-color: ${cor};" class="balao-totais">
            <label>${texto}</label>

            <div style="${horizontal}; gap: 1rem;">
                <label style="font-size: 2rem;">${qtde}</label>
                ${porcentagem ? `<label>${(porcentagem * 100).toFixed(0)}%</label>` : ''}
            </div>

        </div>`

    const contador = await contarPorCampo({
        base: 'dados_ocorrencias',
        filtros: {
            ...(
                acesso.permissao == 'cliente'
                    ? { 'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa } }
                    : {}
            )
        },
        path: 'snapshots.ultimaCorrecao'
    }) || {}

    const { todos, Solucionada } = contador

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio-ocorrencias">

                <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

                <div class="toolbar-itens">

                    <span onclick="baixarExcelRelatorioOcorrencias()" style="cursor: pointer;"><u>Baixar em Excel</u></span>

                    <div class="toolbar-itens">
                        ${modelo({ texto: 'Total', qtde: todos, cor: '#222' })}
                        ${modelo({ texto: 'Solucionados', porcentagem: Solucionada / todos, qtde: Solucionada || 0, cor: '#1d7e45' })}
                        ${modelo({ texto: 'Em Aberto', porcentagem: (todos - Solucionada) / todos, qtde: todos ? (todos - Solucionada) : 0, cor: '#b12425' })}
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Ocorrências'

    await paginacao()

}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots, data_registro } = ocorrencia || {}
    const { ultimaCorrecao, cliente, empresa, tipo, prioridade, sistema } = snapshots || {}

    const status = ultimaCorrecao
    const estilo = status == 'Solucionada'
        ? 'fin'
        : status == 'Não analisada'
            ? 'na'
            : 'and'

    const executores = Object.values(ocorrencia?.correcoes || {})
        .map(correcao => `<span>• ${correcao.executor}</span>`)
        .join('')

    const tds = `
        <td>
            <div style="${horizontal}">
                <img src="imagens/pesquisar2.png" style="width: 2rem; cursor: pointer;" onclick="abrirCorrecaoRelatorio('${id}')">
            </div>
        </td>
        <td>${empresa}</td>
        <td>${id}</td>
        <td>
            <span class="${estilo}">${status}</span>
        </td>
        <td>${data_registro || ''}</td>
        <td>${snapshots?.dtCorrecao || ''}</td>
        <td>${ocorrencia?.usuario || ''}</td>
        <td>
            <div style="${vertical}; gap: 2px;">${executores}</div>
        </td>
        <td>${tipo}</td>
        <td>${cliente?.nome || '-'}</td>
        <td>${cliente?.cidade || '-'}</td>
        <td>${cliente?.estado || '-'}</td>
        <td>${sistema}</td>
        <td>${prioridade}</td>
    `

    return `<tr>${tds}</tr>`

}


async function abrirCorrecaoRelatorio(idOcorrencia) {

    const ocorrencia = await recuperarDado('dados_ocorrencias', idOcorrencia) || {}
    const correcoesOC = ocorrencia?.correcoes || {}
    const { cliente } = ocorrencia?.snapshots || {}
    const thead = ['Executor', 'Descrição', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let correcao of Object.values(correcoesOC)) {

        const { localizacao } = correcao || {}

        let registros = ''
        let imagens = ''

        // Fotos
        imagens = Object.entries(correcao?.fotos || {})
            .map(([link,]) => `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`)
            .join('')

        // Anexos
        imagens = Object.values(correcao?.anexos || {})
            .map(foto => {
                const link = foto.link
                const extensao = link.split('.').pop().toLowerCase()
                if (!extensoes.includes(extensao)) return ''
                return `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`
            })
            .join('')

        linhas += `
            <tr>
                <td>${correcao.executor}</td>
                <td style="width: 200px; text-align: left;">${correcao.descricao}</td>
                <td>
                    ${imagens !== '' ? `<div class="fotos" style="display: grid;">${imagens}</div>` : 'Sem Imagens'}
                </td>
            </tr>`
    }

    const elemento = `
        <div class="detalhes-correcao">

            <span style="font-size: 1.2rem;"><b>Dados da Loja</b></span>
            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: left; gap: 1rem;">
                <div style="${vertical}">
                    ${modelo('Loja', cliente?.nome || '...')}
                    ${modelo('Endereço', cliente?.bairro || '...')}
                </div>

                <div style="${vertical}">
                    ${modelo('Cidade', cliente?.cidade || '...')}
                    ${modelo('Cep', cliente?.cep || '...')}
                </div>
            </div>

            <span style="font-size: 1.2rem;"><b>Correções</b></span>
            <hr style="width: 100%;">

            <div class="blocoTabela" style="width: 100%;">
                <div class="painelBotoes"></div>
                <div class="recorteTabela">
                    <table class="tabela" style="width: max-content; min-width: 100%;">
                        <thead>${thead}</thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
                <div class="rodape-tabela"></div>
            </div>

        </div>
        `

    popup({ elemento, titulo: 'Correções' })
}

async function telaRelatorioCorrecoes() {

    const colunas = {
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao' },
        'Descrição': { chave: 'descricao' },
        'Data Registro': { chave: 'snapshots.datasCorrecoes', tipoPesquisa: 'data' },
        'Solicitante': { chave: 'usuario' },
        'Executor': { chave: 'snapshots.executores' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' }
    }

    const tabela = await modTab({
        colunas,
        filtros: {
            ...(
                acesso.permissao == 'cliente'
                    ? { 'snapshots.cliente.empresa': { op: '=', value: acesso?.empresa } }
                    : {}
            )
        },
        base: 'dados_ocorrencias',
        pag: 'relatorioCorrecoes',
        body: 'bodyCorrecoes',
        criarLinha: 'criarLinhasCorrecoes',
    })

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio-ocorrencias">

                <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

                <span onclick="baixarExcelRelatorioCorrecoes()" style="cursor: pointer;"><u>Baixar em Excel</u></span>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Correções'

    await paginacao()

}

async function criarLinhasCorrecoes(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}
    const { cliente, empresa, sistema } = snapshots || {}
    const { nome, cidade, estado } = cliente || {}

    const linhas = []

    for (const correcao of Object.values(ocorrencia?.correcoes || {})) {

        const { tipoCorrecao, descricao, executor, usuario } = correcao || {}

        const dtRegistro = correcao.data
            ? correcao.data.split(',')[0]
            : ''

        const { nome } = await recuperarDado('correcoes', tipoCorrecao) || 'Não analisada'

        const estilo = nome == 'Solucionada'
            ? 'fin'
            : nome == 'Não analisada'
                ? 'na'
                : 'and'

        const tds = `
        <td>${empresa}</td>
        <td>${id}</td>
        <td>
            <span class="${estilo}">${nome}</span>
        </td>
        <td>
            <div style="white-space: pre-wrap;">
                ${descricao || ''}
            </div>
        </td>
        <td>${dtRegistro}</td>
        <td>${usuario || ''}</td>
        <td>${executor || ''}</td>
        <td>${nome || ''}</td>
        <td>${cidade || ''}</td>
        <td>${estado || ''}</td>
        <td>${sistema}</td>
        `

        linhas.push(`<tr>${tds}</tr>`)
    }

    return linhas.join('')

}

async function telaRelatorioPecas() {

    const colunas = {
        'Chamado': { chave: 'id' },
        'Empresa': { chave: 'snapshots.empresa' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Técnico': { chave: 'correcoes.*.tecnico' },
        'Data Correção': { chave: 'correcoes.*.data', tipoPesquisa: 'data' },
        'Origem': { chave: 'snapshots.equipamentos.*.origem' },
        'Descrição': { chave: 'snapshots.equipamentos.*.descricao' },
        'Unidade': { chave: 'snapshots.equipamentos.*.unidade' },
        'Quantidade': { chave: 'snapshots.equipamentos.*.quantidade' },
        'Modelo': { chave: 'snapshots.equipamentos.*.modelo' },
        'Fabricante': { chave: 'snapshots.equipamentos.*.fabricante' },
    }

    const tabela = await modTab({
        colunas,
        filtros: {
            'correcoes.*.equipamentos': { op: 'NOT_EMPTY' },
            ...(
                acesso.permissao == 'cliente'
                    ? {
                        'snapshots.cliente.empresa': [
                            { op: 'NOT_EMPTY' },
                            { op: '=', value: acesso?.empresa }
                        ]
                    }
                    : {}
            )
        },
        base: 'dados_ocorrencias',
        pag: 'relatorioPecas',
        body: 'bodyPecas',
        criarLinha: 'criarLinhasPecas',
    })

    const acumulado = `
        <div class="pagina-relatorio">
            <div class="toolbar-relatorio-ocorrencias">

                <img src="imagens/GrupoCostaSilva.png" style="width: 5rem;">

                <span onclick="baixarExcelRelatorioPecas()" style="cursor: pointer;"><u>Baixar em Excel</u></span>

            </div>
            ${tabela}
        </div>`

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Peças'

    await paginacao()

}

async function criarLinhasPecas(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}

    const { cliente, empresa } = snapshots || {}

    const linhas = []

    for (const correcao of Object.values(ocorrencia?.correcoes || {})) {

        const { tecnico, equipamentos } = correcao || {}

        if (!equipamentos)
            continue

        const dtRegistro = correcao.data
            ? correcao.data.split(',')[0]
            : ''

        for (const equip of Object.values(equipamentos)) {

            const { descricao, unidade, quantidade, modelo, origem, fabricante } = equip || {}

            const tds = `
                <td>${id}</td>
                <td>${empresa}</td>
                <td>${cliente?.nome || ''}</td>
                <td>${tecnico || ''}</td>
                <td>${dtRegistro}</td>
                <td>${origem || ''}</td>
                <td>${descricao || ''}</td>
                <td>${unidade || ''}</td>
                <td>${quantidade || ''}</td>
                <td>${modelo}</td>
                <td>${fabricante}</td>
                `

            linhas.push(`<tr>${tds}</tr>`)
        }
    }

    return linhas.join('')

}

async function baixarExcelRelatorioOcorrencias() {
    overlayAguarde()

    const schema = {
        view: "vw_relatorio_ocorrencias",
        titulo: `Ocorrencias_${Date.now()}.xlsx`,

        // Atualizado para usar o nome direto da View: 'excluido' (sem alias)
        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        // Definindo as colunas de data para saírem certinhas no Excel
        formatacao: {
            datas: ["Data Registro", "Data Agendamento"]
        }
    }

    // Se o usuário for cliente, esconde as outras empresas. 
    // Usamos schema.filtros (em português, combinando com a declaração acima)
    // E usamos 'id_empresa', que foi o nome que demos à coluna secreta na View
    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Ocorrências_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioCorrecoes() {

    overlayAguarde()
    const schema = {
        view: "vw_relatorio_correcoes",
        titulo: "Relatorio_correcoes.xlsx",

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {}
    }

    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Correções_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }
}

async function baixarExcelRelatorioPecas() {

    overlayAguarde()

    const schema = {
        view: "vw_relatorio_pecas",
        titulo: "Relatorio_pecas.xlsx",

        filtros: [
            { custom: "(excluido IS NULL OR excluido = '')" }
        ],

        formatacao: {}
    }

    if (acesso.permissao === 'cliente') {
        schema.filtros.push({
            field: "id_empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    try {
        await baixarRelatorioExcel(schema, `Peças_${Date.now()}`)
    } catch (err) {
        popup({ mensagem: err.mensage || 'Falha ao gerar Excel' })
    } finally {
        removerOverlay()
    }

}