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
    const schema = {
        table: "dados_ocorrencias",
        alias: "o",
        joins: [
            {
                type: "LEFT",
                table: "dados_clientes_ac",
                alias: "c",
                on: "c.id::text = o.unidade::text"
            },
            {
                type: "LEFT",
                table: "empresas",
                alias: "e",
                on: "e.id::text = c.empresa::text"
            },
            {
                type: "LEFT",
                table: "sistemas",
                alias: "s",
                on: "s.id::text = o.sistema::text"
            },
            {
                type: "LEFT",
                table: "prioridades",
                alias: "p",
                on: "p.id::text = o.prioridade::text"
            }
        ],
        columns: [
            { field: "e.nome", as: "Empresa" },
            { field: "o.id", as: "Chamado" },
            {
                custom: `
                    CASE
                        WHEN o.correcoes IS NULL
                             OR trim(o.correcoes::text) = ''
                             OR jsonb_typeof(o.correcoes::jsonb) <> 'array'
                        THEN 'Não analisada'
                        ELSE COALESCE(
                            (
                                SELECT cr.nome
                                FROM jsonb_array_elements(o.correcoes::jsonb) AS je(value)
                                LEFT JOIN correcoes cr
                                    ON cr.id::text = (je.value ->> 'tipoCorrecao')
                                WHERE (je.value ->> 'tipoCorrecao') = 'WRuo2'
                                LIMIT 1
                            ),
                            (
                                SELECT cr.nome
                                FROM jsonb_array_elements(o.correcoes::jsonb) AS je(value)
                                LEFT JOIN correcoes cr
                                    ON cr.id::text = (je.value ->> 'tipoCorrecao')
                                WHERE je.value ->> 'data' IS NOT NULL
                                  AND trim(je.value ->> 'data') <> ''
                                ORDER BY to_timestamp(je.value ->> 'data', 'DD/MM/YYYY, HH24:MI:SS') DESC
                                LIMIT 1
                            ),
                            'Não analisada'
                        )
                    END
                `,
                as: "Status Correção"
            },
            {
                field: "o.data_registro",
                as: "Data Registro",
                type: "date",
                sourceFormat: "br-hora"
            },
            {
                custom: `o.snapshots #>> '{dtCorrecao}'`,
                as: "Data Agendamento",
                type: "date",
                sourceFormat: "br"
            },
            { field: "c.nome", as: "Loja" },
            { field: "c.cidade", as: "Cidade" },
            { field: "c.estado", as: "Estado" },
            { field: "o.descricao", as: "Descrição da Ocorrência" },
            { field: "o.usuario", as: "Solicitante" },
            {
                custom: `
                    (
                        SELECT string_agg(DISTINCT trim(e.value), ', ')
                        FROM jsonb_array_elements(
                            COALESCE(
                                o.snapshots::jsonb #> '{ultimoExecutor}',
                                '[]'::jsonb
                            )
                        ) AS ue(item)
                        CROSS JOIN LATERAL (
                            SELECT ue.item ->> 'executor' AS value
                            WHERE jsonb_typeof(ue.item -> 'executor') = 'string'
                            UNION ALL
                            SELECT value
                            FROM jsonb_array_elements_text(ue.item -> 'executor')
                            WHERE jsonb_typeof(ue.item -> 'executor') = 'array'
                        ) AS e(value)
                        WHERE e.value IS NOT NULL
                    )
                `,
                as: "Executores"
            },
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
            { type: "LEFT", table: "dados_clientes_ac", alias: "c", on: "c.id::text = o.unidade::text" },
            { type: "LEFT", table: "empresas", alias: "e", on: "e.id::text = c.empresa::text" },
            { type: "LEFT", table: "sistemas", alias: "s", on: "s.id::text = o.sistema::text" },
            { type: "LEFT", table: "prioridades", alias: "p", on: "p.id::text = o.prioridade::text" }
        ],
        explode: {
            field: "o.correcoes",
            alias: "cx",
            type: "LEFT",
            mode: "object"
        },
        columns: [
            { field: "e.nome", as: "Empresa" },
            { field: "o.id", as: "Chamado" },
            {
                custom: `
                    (
                        SELECT cr.nome
                        FROM correcoes cr
                        WHERE cr.id::text = NULLIF(cx.value ->> 'tipoCorrecao', '')
                        LIMIT 1
                    )
                `,
                as: "Tipo Correção"
            },
            {
                custom: `cx.value ->> 'data'`,
                as: "Data",
                type: "date",
                sourceFormat: "br-hora"
            },
            {
                custom: `cx.value ->> 'dtCorrecao'`,
                as: "Data Correção",
                type: "date",
                sourceFormat: "iso"
            },
            { field: "c.nome", as: "Loja" },
            { field: "c.cidade", as: "Cidade" },
            { field: "c.estado", as: "Estado" },
            {
                custom: `cx.value ->> 'descricao'`,
                as: "Descrição",
                width: 30
            },
            {
                custom: `cx.value ->> 'usuario'`,
                as: "Solicitante"
            },
            {
                custom: `
                    (
                        SELECT string_agg(DISTINCT trim(exec.value), ', ')
                        FROM jsonb_array_elements_text(
                            CASE
                                WHEN jsonb_typeof(cx.value -> 'executor') = 'array'
                                    THEN cx.value -> 'executor'
                                ELSE '[]'::jsonb
                            END
                        ) AS exec(value)
                    )
                `,
                as: "Executores"
            },
            {
                custom: `cx.value ->> 'tecnico'`,
                as: "Técnico (Peças)"
            },
            { field: "s.nome", as: "Sistema" },
            { field: "p.nome", as: "Prioridade" }
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

async function baixarExcelRelatorioPecas() {

    const schema = {
        table: "dados_ocorrencias",
        alias: "o",
        joins: [
            { type: "LEFT", table: "dados_clientes_ac", alias: "c", on: "c.id::text = o.unidade::text" },
            { type: "LEFT", table: "empresas", alias: "e", on: "e.id = c.empresa" },

            // Substituímos o "explodes" por JOINs Laterais nativos do Postgres para lidar com Arrays.
            {
                type: "INNER",
                table: "LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(o.correcoes::jsonb) = 'array' THEN o.correcoes::jsonb ELSE '[]'::jsonb END)",
                alias: "cx(value)",
                on: "TRUE"
            },
            {
                type: "INNER",
                table: "LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(cx.value -> 'equipamentos') = 'array' THEN cx.value -> 'equipamentos' ELSE '[]'::jsonb END)",
                alias: "eq(value)",
                on: "TRUE"
            }
        ],

        columns: [
            { field: "e.nome", as: "Empresa" },
            { field: "o.id", as: "Chamado" },
            { field: "c.nome", as: "Loja" },
            { field: "c.cidade", as: "Cidade" },
            { field: "c.estado", as: "Estado" },
            {
                custom: "cx.value ->> 'data'",
                as: "Data",
                type: "date",
                sourceFormat: 'br-hora'
            },
            {
                custom: "cx.value ->> 'dtCorrecao'",
                as: "Data Correção",
                type: "date",
                sourceFormat: 'iso'
            },
            { custom: "cx.value ->> 'tecnico'", as: "Técnico" },
            { custom: "eq.value ->> 'origem'", as: "Origem" },

            // O operador #>> '{caminho,filho}' é a forma do Postgres extrair caminhos profundos
            { custom: "o.snapshots #>> '{cliente,nome}'", as: "Cliente" },

            { custom: "eq.value ->> 'codigo'", as: "Código" },
            { custom: "eq.value ->> 'serie'", as: "Nº Série" },
            { custom: "eq.value ->> 'descricao'", as: "Descrição", width: 35 },
            { custom: "eq.value ->> 'modelo'", as: "Modelo" },
            { custom: "eq.value ->> 'fabricante'", as: "Fabricante" },
            { custom: "eq.value ->> 'unidade'", as: "Unidade" },
            { custom: "eq.value ->> 'quantidade'", as: "Quantidade" }
        ],

        filters: [
            { custom: "(o.excluido IS NULL OR o.excluido = '')" },
            // Como mudamos para jsonb_array_elements, a coluna "key" não existe mais, verificamos o "value"
            { custom: "eq.value IS NOT NULL" }
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
    await baixarRelatorioExcel(schema, 'Peças')
    removerOverlay()
}