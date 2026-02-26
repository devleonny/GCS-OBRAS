async function telaRelatorio() {

    const colunas = {
        '': {},
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Status': { chave: 'snapshots.ultimaCorrecao' },
        'Data Abertura': { chave: 'dataRegistro' },
        'Hora Abertura': {},
        'Data Limite': { chave: 'snapshots.dtCorrecao' },
        'Solicitante': { chave: 'usuario' },
        'Executores': { chave: 'snapshots.executores' },
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao' },
        'Loja': { chave: 'snapshots.cliente.nome' },
        'Cidade': { chave: 'snapshots.cliente.cidade' },
        'Estado': { chave: 'snapshots.cliente.estado' },
        'Sistema': { chave: 'snapshots.sistema' },
        'Prioridade': { chave: 'snapshots.prioridade' }
    }

    const tabela = modTab({
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
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <span onclick="baixarExcelRelatorioOcorrencias()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>

                    <div style="${vertical}; gap: 0.5rem;">
                        <input id="de" type="date" onchange="pesquisarDatas('relatorioOcorrencias')">
                        <input id="ate" type="date" onchange="pesquisarDatas('relatorioOcorrencias')">
                    </div>

                    <div class="toolbar-itens">
                        ${modelo({ texto: 'Total', qtde: todos, cor: '#222' })}
                        ${modelo({ texto: 'Solucionados', porcentagem: Solucionada / todos, qtde: Solucionada, cor: '#1d7e45' })}
                        ${modelo({ texto: 'Em Aberto', porcentagem: (todos - Solucionada) / todos, qtde: (todos - Solucionada), cor: '#b12425' })}
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Ocorrências'

    mostrarMenus(false)

    await paginacao()


}

function dtAuxOcorrencia(dt) {

    if (!dt || '') return '-'

    const [ano, mes, dia] = dt.split('-')

    return `${dia}/${mes}/${ano}`
}

async function criarLinhaRelatorio(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}
    const { ultimaCorrecao, cliente, empresa, tipo, prioridade, sistema } = snapshots || {}

    const status = ultimaCorrecao
    const estilo = status == 'Solucionada'
        ? 'fin'
        : status == 'Não analisada'
            ? 'na'
            : 'and'

    const [dtAb, hrAb] = ocorrencia.dataRegistro
        ? ocorrencia.dataRegistro.split(', ')
        : ['', '']

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
        <td>${dtAb}</td>
        <td>${hrAb}</td>
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
    const thead = ['Executor', 'Tipo Correção', 'Descrição', 'Localização', 'Imagens']
        .map(op => `<th>${op}</th>`)
        .join('')

    let linhas = ''
    for (let correcao of Object.values(correcoesOC)) {
        const { nome } = await recuperarDado('correcoes', correcao.tipoCorrecao) || {}
        let registros = ''
        let imagens = ''

        // Fotos
        imagens = Object.entries(correcao?.fotos || {})
            .map(([link, foto]) => `<img name="foto" id="${link}" src="${api}/uploads/${link}" onclick="ampliarImagem(this, '${link}')">`)
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


        for (let [dt, dado] of Object.entries(correcao?.datas || {})) {

            let rastreio = 'Processando localização...'
            if (dado.geolocalizacao) {
                rastreio = `
                    <span>${dado.geolocalizacao.address.road}</span>
                    <strong><span>${dado.geolocalizacao.address.city}</span></strong>
                    <span>${dado.geolocalizacao.address.postcode}</span>
                `
            }

            registros += `
                <div class="bloco-localizacao">
                    <label>${new Date(Number(dt)).toLocaleString('pt-BR')}</label>
                    <div style="${vertical};">
                        ${rastreio}
                    </div>
                </div>
            `
        }

        linhas += `
            <tr>
                <td>${correcao.executor}</td>
                <td>${nome}</td>
                <td style="width: 200px; text-align: left;">${correcao.descricao}</td>
                <td>
                    <div style="${vertical}; gap: 1px;">
                        ${registros}
                    </div>
                </td>
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

async function pesquisarDatas(pag) {
    const deInput = document.getElementById('de').value
    const ateInput = document.getElementById('ate').value

    controles[pag].filtros ??= {}

    controles[pag].filtros = {
        ...controles[pag].filtros,
        'dataRegistro': [
            { op: '>=d', value: deInput },
            { op: '<=d', value: ateInput },
        ]
    }

    await paginacao()

}

async function telaRelatorioCorrecoes() {

    const colunas = {
        'Empresa': { chave: 'snapshots.empresa' },
        'Chamado': { chave: 'id' },
        'Tipo Correção': { chave: 'snapshots.ultimaCorrecao' },
        'Descrição': { chave: 'descricao' },
        'Data Registro': { chave: 'snapshots.datasCorrecoes' },
        'Solicitante': { chave: 'usuario' },
        'Executor': { chave: 'snapshots.executores' },
        'Loja': { chave: 'snapshots.cliente' },
        'Sistema': { chave: 'snapshots.sistema' }
    }

    const tabela = modTab({
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

                <div class="toolbar-itens">
                    <div style="${vertical}; gap: 0.5rem;">
                        <span>Data de abertura</span>
                        <span onclick="baixarExcelRelatorioCorrecoes()" style="cursor: pointer;"><u>Baixar em Excel</u></span>
                    </div>

                    <div style="${vertical}; gap: 0.5rem;">
                        <input id="de" type="date" onchange="pesquisarDatas('relatorioCorrecoes')">
                        <input id="ate" type="date" onchange="pesquisarDatas('relatorioCorrecoes')">
                    </div>
                </div>

            </div>
            ${tabela}
        </div>
    `

    tela.innerHTML = acumulado

    titulo.textContent = 'Relatório de Correções'

    await paginacao()

    mostrarMenus(false)

}

async function criarLinhasCorrecoes(ocorrencia) {

    const { id, snapshots } = ocorrencia || {}

    const { cliente, empresa, sistema } = snapshots || {}

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
            <div style="pre-wrap: wrap;">
                ${descricao || ''}
            </div>
        </td>
        <td>${dtRegistro}</td>
        <td>${usuario || ''}</td>
        <td>${executor || ''}</td>
        <td>${cliente?.nome || ''}</td>
        <td>${sistema}</td>
        `

        linhas.push(`<tr>${tds}</tr>`)
    }

    return linhas.join('')

}

async function baixarExcelRelatorioOcorrencias() {

    const schema = {
        table: "dados_ocorrencias",
        alias: "o",
        joins: [
            {
                type: "LEFT",
                table: "dados_clientes",
                alias: "c",
                on: `c.id = o.unidade`
            },
            {
                type: "LEFT",
                table: "empresas",
                alias: "e",
                on: `e.id = c.empresa`
            },
            {
                type: "LEFT",
                table: "sistemas",
                alias: "s",
                on: `s.id = o.sistema`
            },
            {
                type: "LEFT",
                table: "prioridades",
                alias: "p",
                on: `p.id = o.prioridade`
            }
        ],
        columns: [
            { field: "e.nome", as: "Empresa" },
            { field: "o.id", as: "Chamado" },
            {
                custom: `
                CASE
                WHEN NOT json_valid(o.correcoes) THEN 'Não analisada'
                ELSE COALESCE(

                    -- 1) se existir WRuo2 em qualquer item, retorna ele
                    (
                    SELECT cr.nome
                    FROM json_each(o.correcoes) je
                    LEFT JOIN correcoes cr
                        ON cr.id = trim(json_extract(je.value, '$.tipoCorrecao'))
                    WHERE trim(json_extract(je.value, '$.tipoCorrecao')) = 'WRuo2'
                    LIMIT 1
                    ),

                    -- 2) senão, retorna a última correção por data (dd/mm/aaaa)
                    (
                    SELECT cr.nome
                    FROM json_each(o.correcoes) je
                    LEFT JOIN correcoes cr
                        ON cr.id = trim(json_extract(je.value, '$.tipoCorrecao'))
                    WHERE json_extract(je.value, '$.data') IS NOT NULL
                        AND trim(json_extract(je.value, '$.data')) <> ''
                    ORDER BY date(
                        substr(json_extract(je.value, '$.data'), 7, 4) || '-' ||
                        substr(json_extract(je.value, '$.data'), 4, 2) || '-' ||
                        substr(json_extract(je.value, '$.data'), 1, 2)
                    ) DESC
                    LIMIT 1
                    ),

                    -- 3) fallback
                    'Não analisada'
                )
                END
            `,
                as: "Status Correção"
            },
            {
                field: "o.dataRegistro",
                as: "Data Registro",
                type: "date",
                sourceFormat: 'br'
            },
            { field: "o.descricao", as: "Descrição da Ocorrência" },
            { field: "o.usuario", as: "Solicitante" },
            {
                jsonArray: {
                    field: "o.correcoes",
                    path: "$",
                    property: "executor"
                },
                as: "Executores",
            },
            { field: "c.nome", as: "Loja" },
            { field: "c.cidade", as: "Cidade" },
            { field: "c.estado", as: "Estado" },
            { field: "s.nome", as: "Sistema" },
            { field: "p.nome", as: "Prioridade" }
        ],
        filters: [
            {
                custom: "(o.excluido IS NULL OR o.excluido = '')"
            }
        ],
        orderBy: "o.timestamp DESC"
    }

    if (acesso.permissao === 'cliente') {
        schema.filters.push({
            field: "c.empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    overlayAguarde()
    await baixarRelatorioExcel(schema, 'Ocorrências')
    removerOverlay()

}

async function baixarExcelRelatorioCorrecoes() {

    const schema = {
        table: "dados_ocorrencias",
        alias: "o",

        joins: [
            {
                type: "LEFT",
                table: "dados_clientes",
                alias: "c",
                on: `c.id = o.unidade`
            },
            {
                type: "LEFT",
                table: "empresas",
                alias: "e",
                on: `e.id = c.empresa`
            },
            {
                type: "LEFT",
                table: "sistemas",
                alias: "s",
                on: `s.id = o.sistema`
            },
            {
                type: "LEFT",
                table: "prioridades",
                alias: "p",
                on: `p.id = o.prioridade`
            },
        ],

        explode: {
            field: "o.correcoes",
            path: "$",
            alias: "cx",
            type: "LEFT"
        },

        columns: [
            { field: "e.nome", as: "Empresa" },
            { field: "o.id", as: "Chamado" },
            {
                custom: `json_extract(cx.value, '$.executor')`,
                as: "Executor"
            },
            {
                custom: `json_extract(cx.value, '$.data')`,
                type: "date",
                sourceFormat: 'br',
                as: "Data"
            },
            {
                custom: `json_extract(cx.value, '$.descricao')`,
                as: "Descrição",
                width: 30,
            },
            {
                field: 's.nome',
                as: "Sistema"
            },
            {
                field: 'p.nome',
                as: "Prioridade"
            },
            {
                custom: `
                    (
                    SELECT cr.nome
                    FROM correcoes cr
                    WHERE cr.id = trim(json_extract(cx.value, '$.tipoCorrecao'))
                    LIMIT 1
                    )
                `,
                as: "Tipo Correção"
            }
        ],

        filters: [
            { custom: "(o.excluido IS NULL OR o.excluido = '')" }
        ],

        orderBy: "o.timestamp DESC"
    }

    if (acesso.permissao === 'cliente') {
        schema.filters.push({
            field: "c.empresa",
            op: "=",
            value: acesso.empresa
        })
    }

    overlayAguarde()
    await baixarRelatorioExcel(schema, 'Correções')
    removerOverlay()


}