const gerarOptions = async (path) => {

    const contagem =
        Object.keys(await contarPorCampo({
            base: 'dados_estoque',
            path
        }))
            .filter(i => i !== 'todos')
            .map(i => `<option>${i.toUpperCase()}</option>`)
            .join('')

    return contagem
}

async function telaEstoque() {

    mostrarMenus(false)

    const colunas = {
        'Editar': {},
        'Código Omie': { chave: 'partnumber' },
        'Categoria': { chave: 'categoria' },
        'Marca': { chave: 'marca' },
        'Descrição': { chave: 'descricao' },
        'Estoque Matriz': {},
        'Estoque Usado': {},
        'Estoque SP': {},
        'Valor CMC': {}
    }

    const tabela = await modTab({
        pag: 'estoque',
        base: 'dados_estoque',
        colunas,
        body: 'bodyEstoque',
        criarLinha: 'criarLinhaEstoque',
    })

    tela.innerHTML = `<dia class="painel-estoque">${tabela}</div>`

    await paginacao()

    criarMenus('estoque')

}

function criarLinhaEstoque(item) {

    const { id } = item

    const modelo = (texto) => `<td>${texto || ''}</td>`

    const modeloEst = (qtde, nomeEstoque) => {
        const bg = qtde == 0 ? '' : qtde < 0 ? '#b36060bf' : '#4CAF50bf'
        return `<td><label onclick="abrirEstoque('${id}', '${nomeEstoque}')" class="label-estoque" style="background-color: ${bg};">${qtde}</label></td>`
    }

    // Estoque 
    const estoques = ['estoque', 'estoque_sp', 'estoque_usado']
    let quantidades = {}
    for (const estoque of estoques) {

        quantidades[estoque] ??= 0
        quantidades[estoque] = item?.[estoque]?.quantidade || 0

        for (const [id, movimento] of Object.entries(item?.[estoque]?.historico || {})) {
            if (!movimento.quantidade) continue

            if (movimento.operacao == 'saida') {
                quantidades[estoque] -= movimento.quantidade
            } else if (movimento.operacao == 'entrada') {
                quantidades[estoque] += movimento.quantidade
            }
        }
    }

    const valores = Object.entries(item?.valor_compra || {})
    const ultimaCompra = valores?.[valores.length - 1]?.[1]?.vl_compra || 0

    const tds = `
        <td>
            <img src="imagens/editar.png" style="cursor: pointer; width: 2vw;" onclick="incluirItemEstoque('${id}')">
        </td>
        ${modelo(item.partnumber)}
        ${modelo(item.categoria)}
        ${modelo(item.marca)}
        <td style="text-align: left;">${item.descricao}</td>
        ${modeloEst(quantidades.estoque, 'estoque')}
        ${modeloEst(quantidades.estoque_usado, 'estoque_usado')}
        ${modeloEst(quantidades.estoque_sp, 'estoque_sp')}
        <td>
            <label onclick="abrirValores('${id}')" class="label-estoque" style="background-color: ${ultimaCompra !== 0 ? '#097fe6bf' : ''}">
                ${dinheiro(ultimaCompra)}
            </label>
        </td>
        `
    return `<tr>${tds}</tr>`
}

function calcularCmc(objeto) {

    let valor = 0
    if (dicionario(objeto) && Object.keys(objeto).length > 0) {

        let total_unit = 0
        let total_compras = 0

        for (id in objeto) {
            let compra = objeto[id]

            total_unit += (compra.vl_compra / compra.conversao)
            total_compras++
        }

        valor = total_unit / total_compras

    }

    return valor

}

async function abrirValores(codigo) {

    const item = await recuperarDado('dados_estoque', codigo)

    const linhas = Object.entries(item.valor_compra || {})
        .sort((a, b) => {
            const dataA = parseDataBR(a[1].data)
            const dataB = parseDataBR(b[1].data)
            return dataB - dataA
        })
        .map(([cpr, compra]) => {
            const tr = `
                <tr>
                    <td style="white-space: nowrap;">${dinheiro(compra.vl_compra)}</td>
                    <td>${compra.data}</td>
                    <td>${compra.unidade}</td>
                    <td>${compra.conversao}</td>
                    <td>${compra.fornecedor}</td>
                    <td>${compra.comentario}</td>
                    <td>${compra.usuario}</td>
                    <td>
                        <img src="imagens/pesquisar2.png" onclick="formularioValorCompra('${codigo}', '${cpr}')">
                    </td>
                </tr>`
            return tr
        })
        .join('')


    const valor = calcularCmc(item.valor_compra)

    const painel = `
        <div style="${horizontal}; margin: 2px; gap: 1rem;">
            <img src="imagens/GrupoCostaSilva.png" style="width: 6rem;">
            <div style="${vertical}">
                <label>Descrição</label>
                <label>${item.descricao}</label>
            </div>
        </div>

        <hr>

        <div style="${horizontal}; width: 100%; gap: 10px;">
            <label>CMC - Custo Médio de Compra</label>
            <label class="cmc">${dinheiro(valor)}</label>
        </div>

        <hr>

        <div style="${vertical}; width: 100%;">
            <div class="topo-tabela">
                <button onclick="formularioValorCompra('${codigo}')">Adicionar Preço</button>
            </div>
            <div class="div-tabela">
                <table class="tabela">
                    <thead>
                        <th>Valor</th>
                        <th>Data</th>
                        <th>Unidade</th>
                        <th>Conversão</th>
                        <th>Fornecedor</th>
                        <th>Comentário</th>
                        <th>Usuário</th>
                        <th>Excluir</th>
                    </thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>
            <div class="rodape-tabela"></div>
        </div>`

    const elemento = `
        <div class="painel-registro">
            ${painel}
        </div>`

    const painelExistente = document.querySelector('.painel-registro')
    if (painelExistente)
        return painelExistente.innerHTML = painel

    popup({ elemento, titulo: 'Informar valor de Compra' })
}

async function formularioValorCompra(codigo, cpr) {

    const produto = await recuperarDado('dados_estoque', codigo) || {}
    const { vl_compra, unidade, conversao, fornecedor, comentario } = produto?.valor_compra?.[cpr] || {}

    const linhas = [
        {
            texto: 'Valor de Compra',
            elemento: `<input type="number" id="vl_compra" value="${vl_compra || ''}">`
        },
        {
            texto: 'Unidade',
            elemento: `<input type="number" value="1" id="unidade" value="${unidade || ''}">`
        },
        {
            texto: 'Conversão',
            elemento: `<input type="number" value="1" id="conversao" value="${conversao || ''}">`
        },
        {
            texto: 'Fornecedor',
            elemento: `
                <input id="fornecedor" list="datalist_fornecedor" value="${fornecedor || ''}">
                <datalist id="datalist_fornecedor">${await gerarOptions('valor_compra.*.fornecedor')}</datalist>
                `
        },
        {
            texto: 'Comentário',
            elemento: `
                <input id="comentario" list="datalist_comentario" value="${comentario || ''}">
                <datalist id="datalist_comentario">${await gerarOptions('valor_compra.*.comentario')}</datalist>
                `
        }
    ]

    const funcao = cpr
        ? `salvarValor('${codigo}', '${cpr}')`
        : `salvarValor('${codigo}')`

    const botoes = [
        { texto: 'Salvar Preço', img: 'concluido', funcao }
    ]

    if (cpr)
        botoes.push({ texto: 'Excluir', img: 'cancel', funcao: `excluirPreco('${codigo}', '${cpr}')` })

    popup({ botoes, linhas, titulo: 'Gerenciar Preço' })

}

async function excluirPreco(codigo, cpr) {

    const produto = await recuperarDado('dados_estoque', codigo)
    delete produto.valor_compra[cpr]

    await inserirDados({ [codigo]: produto }, 'dados_estoque')
    deletar(`dados_estoque/${codigo}/valor_compra/${cpr}`)

    removerPopup()
    await abrirValores(codigo)
}

async function salvarValor(codigo, cpr = ID5digitos()) {

    overlayAguarde()

    const produto = await recuperarDado('dados_estoque', codigo) || {}

    const vl_compra = document.getElementById('vl_compra')
    const unidade = document.getElementById('unidade')
    const conversao = document.getElementById('conversao')
    const fornecedor = document.getElementById('fornecedor')
    const comentario = document.getElementById('comentario')

    const compra = {
        vl_compra: Number(vl_compra.value),
        unidade: Number(unidade.value),
        conversao: Number(conversao.value),
        fornecedor: fornecedor.value,
        comentario: comentario.value,
        usuario: acesso.usuario,
        data: new Date().toLocaleString('pt-BR')
    }

    produto.valor_compra ??= {}
    produto.valor_compra[cpr] = compra

    await inserirDados({ [codigo]: produto }, 'dados_estoque')
    await enviar(`dados_estoque/${codigo}/valor_compra/${cpr}`, compra)

    removerPopup() //Formulário
    await abrirValores(codigo)

}

function parseDataBR(dataBR) {
    const [dia, mes, anoHora] = dataBR.split('/');
    const [ano, hora] = anoHora.split(', ');
    return new Date(`${ano}-${mes}-${dia}T${hora}:00`);
}

async function abrirEstoque(codigo, stq) {

    const item = await recuperarDado('dados_estoque', codigo)
    const estoque = item?.[stq] || {}
    let atual = conversor(estoque?.quantidade || 0)
    let inicial = atual
    let linhas = ''

    const historicoArray = Object.entries(estoque?.historico || {})
        .sort((a, b) => {
            const dataA = parseDataBR(a[1].data)
            const dataB = parseDataBR(b[1].data)
            return dataB - dataA;
        })

    for (const [chave, historico] of historicoArray) {

        const img = historico.operacao == 'entrada'
            ? 'imagens/up_estoque.png'
            : historico.operacao == 'inicial'
                ? 'imagens/zero.png'
                : 'imagens/down_estoque.png'

        let exclusao = ''
        if (
            (historico.operacao == 'inicial' && acesso.permissao == 'adm') ||
            (historico.operacao !== 'inicial' && (acesso.permissao == 'adm' || acesso.usuario == historico.usuario))
        ) {
            exclusao = `<img src="imagens/cancel.png" onclick="removerHistorico('${codigo}', '${stq}','${chave}')">`
        }

        linhas += `
            <tr>
                <td><img src="${img}" style="width: 15px; height: 15px;"></td>
                <td style="padding: 5px;">${historico.quantidade}</td>
                <td style="padding: 5px;">${historico.operacao}</td>
                <td style="padding: 5px;">${historico.data}</td>
                <td style="padding: 5px;">${historico.usuario}</td>
                <td><textarea style="padding: 0px; border: none; border-radius: 0px;" readonly>${historico.comentario}</textarea></td>
                <td>
                    <div style="display: flex; justify-content: center; align-items: center;">
                        ${exclusao}
                    </div>
                </td>
            </tr>
            `

        if (historico.operacao == 'entrada') {
            atual += historico.quantidade

        } else if (historico.operacao == 'saida') {
            atual -= historico.quantidade
        }
    }

    let divHistorico = ''
    if (Object.keys(estoque?.historico || {}).length > 0) {
        divHistorico = `
            <hr>

            <div style="${horizontal}; font-size: 1.2rem; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
                    <div class="div-tabela">
                        <table class="tabela">
                            <thead>
                                <th>Sin</th>
                                <th>Qt.</th>
                                <th>Operação</th>
                                <th>Data</th>
                                <th>Usuário</th>
                                <th>Comentário</th>
                                <th>Excluir</th>
                            </thead>
                            <tbody style="color: #222;">${linhas}</tbody>
                        </table>
                    </div>
                <div class="rodape-tabela"></div>
            </div>
        `
    }

    const painel = `

        <label id="movimento" style="display: none;">${codigo}/${stq}</label>

        <div style="${horizontal}; gap: 1rem;">
            <img src="imagens/GrupoCostaSilva.png" style="width: 6rem;">
            <div style="${vertical}">
                <label>Descrição</label>
                <label>${item.descricao}</label>
            </div>
        </div>

        <hr>

        <div style="${horizontal}; width: 100%;">
            
            <div style="${vertical};">
                <label>Saída</label>
                <input class="campo-verde" style="background-color: #B12425;" id="saida" oninput="bloquearInput(this)">
            </div>
            <div style="${vertical};">
                <label>Entrada</label>
                <input class="campo-verde" id="entrada" oninput="bloquearInput(this)">
            </div>

            <div style="${vertical};">
                <label>Comentário</label>
                <textarea maxlength="100" id="comentario"></textarea>
            </div>

            <img src="imagens/concluido.png" onclick="salvarMovimento('${codigo}', '${stq}')">

        </div>

        <hr>

        <div style="${horizontal}; width: 100%;">
        
            <div style="${vertical}; width: 60%;">
                <label>Saldo Atual</label>
                <label style="color: white; background-color: #4CAF50; font-size: 35px; height: 50px; width: 90%; border-radius: 5px;">${atual}</label>
            </div>
        
            <div style="${vertical}">

                <label>Saldo Inicial</label>

                <div style="${horizontal}; gap: 5px;">
                    <input class="campo-verde" style="background-color: #B12425;" value="${inicial}">
                    <img src="imagens/concluido.png" onclick="salvarMovimento('${codigo}', '${stq}', this)">
                </div>
            
            </div>
        </div>

        ${divHistorico}

    `
    const elemento = `
        <div class="painel-registro">
            ${painel}
        </div>`

    const painelExistente = document.querySelector('.painel-registro')
    if(painelExistente)
        return painelExistente.innerHTML = painel

    popup({ elemento, titulo: 'Movimentação de estoque' })

}

function bloquearInput(elemento) {

    let id = elemento.id
    let outro = id == 'entrada' ? 'saida' : 'entrada'

    let input_um = document.getElementById(id)
    let input_outro = document.getElementById(outro)

    if (input_um.value !== '') {
        input_outro.readOnly = true
    } else {
        input_outro.readOnly = false
    }

}

async function removerHistorico(codigo, stq, chave) {

    const produto = await recuperarDado('dados_estoque', codigo)
    delete produto[stq].historico[chave]

    await inserirDados({ [codigo]: produto }, 'dados_estoque')
    deletar(`dados_estoque/${codigo}/${stq}/historico/${chave}`)

    await abrirEstoque(codigo, stq)

}

async function salvarMovimento(codigo, stq, inicial) {

    const comentario = document.getElementById('comentario')
    const entrada = document.getElementById('entrada')
    const saida = document.getElementById('saida')
    const id = ID5digitos()

    let item = await recuperarDado('dados_estoque', codigo)
    if (!dicionario(item[stq]) || !item[stq].historico) {
        item[stq] = {
            historico: {},
            quantidade: 0
        }
    }

    let estoque = item[stq]

    const movimento = {
        data: new Date().toLocaleString('pt-BR'),
        usuario: acesso.usuario,
        comentario: comentario.value,
    }

    if (entrada && entrada.value !== '') {

        movimento.operacao = 'entrada'
        movimento.quantidade = conversor(entrada.value)

    } else if (saida && saida.value !== '') {

        movimento.operacao = 'saida'
        movimento.quantidade = conversor(saida.value)

    } else if (inicial !== undefined) {

        let div = inicial.parentElement
        let input = div.querySelector('input')

        movimento.operacao = 'inicial'
        movimento.quantidade = conversor(input.value)
        estoque.quantidade = conversor(input.value)

    } else {
        return
    }

    estoque.historico[id] = movimento

    await inserirDados({ [codigo]: item }, 'dados_estoque')
    enviar(`dados_estoque/${codigo}/${stq}/historico/${id}`, movimento)

    if (inicial !== undefined) {
        enviar(`dados_estoque/${codigo}/${stq}/quantidade`, estoque.quantidade)
    }

    await abrirEstoque(codigo, stq)

}

function exibir_botao(elemento, chave) {

    if (String(chave).includes('estoque')) {
        if (conversor(elemento.value) > 0) {
            elemento.style.backgroundColor = '#4CAF50'
        } else {
            elemento.style.backgroundColor = '#B12425'
        }
    }

    let img = elemento.previousElementSibling;
    img.style.display = 'block'

}

async function incluirItemEstoque(codigo) {

    const produto = await recuperarDado('dados_estoque', codigo) || {}

    const linhas = [
        { texto: 'Código Omie', elemento: `<input name="partnumber" value="${produto?.omie || ''}">` },
        {
            texto: 'Categoria',
            elemento: `<input name="categoria" list="categorias" value="${produto?.categoria || ''}">
            <datalist id="categorias">${await gerarOptions('categoria')}</datalist>`
        },
        {
            texto: 'Marca',
            elemento: `<input name="marca" list="marcas" value="${produto?.marca || ''}">
            <datalist id="marcas">${await gerarOptions('marca')}</datalist>
        `},
        { texto: 'Descrição', elemento: `<textarea name="descricao" rows="5">${produto?.descricao || ''}</textarea>` },
    ]

    const botoes = [
        { texto: 'Salvar', img: 'concluido', funcao: `salvarItemEstoque(${codigo ? `'${codigo}'` : false})` }
    ]

    if (codigo) botoes.push({
        texto: 'Excluir', img: 'cancel', funcao: `removerLinhaEstoque('${codigo}')`
    })


    popup({ linhas, botoes, titulo: 'Cadastro de Item' })

}

async function salvarItemEstoque(codigo) {

    overlayAguarde()

    const obVal = (name) => {
        const el = document.querySelector(`[name="${name}"]`)
        return el.value
    }

    codigo = codigo || ID5digitos()

    const item = await recuperarDado('dados_estoque', codigo) || {}

    const novosDados = {
        partnumber: obVal('partnumber'),
        categoria: obVal('categoria'),
        marca: obVal('marca'),
        descricao: obVal('descricao')
    }

    const mesclado = {
        ...item,
        ...novosDados
    }

    await inserirDados({ [codigo]: mesclado }, 'dados_estoque')
    removerPopup()

    enviar(`dados_estoque/${codigo}`, mesclado)

}

async function removerLinhaEstoque(codigo) {

    const item = await recuperarDado('dados_estoque', codigo)

    const mensagem = `
        <div style="${vertical};">
            <label>Deseja excluir este item?</label>
            <label>${item.partnumber} - ${item.descricao}</label>
        </div>`

    const botoes = [
        { texto: 'Confirmar', funcao: `confirmarExclusaoEstoque('${codigo}')`, img: 'concluido' }
    ]

    popup({ mensagem, botoes, titulo: 'Remover item' })

}

async function confirmarExclusaoEstoque(codigo) {

    removerPopup()
    removerPopup()

    await deletarDB('dados_estoque', codigo)
    deletar(`dados_estoque/${codigo}`)
}

async function relatorioMovimento() {

    const colunas = {
        'Código Omie': { chave: 'patnumber' },
        'Descrição': { chave: 'descricao' },
        'Data': { chave: 'data' },
        'Operação': { chave: 'operacao' },
        'Sin': {},
        'Quantidade': {},
        'Usuário': {},
        'Comentário': {}
    }

    const tabela = await modTab({
        base: 'dados_estoque',
        colunas,
        pag: 'movimentos',
        criarLinha: 'criarLinhaMovimento',
        body: 'bodyMovimentos'
    })

    const elemento = `
        <div class="painel-registro">

            <div class="filtros">
                
                <div style="${vertical}">
                    <label>De</label>
                    <input name="campos_data" type="date">
                </div>

                <div style="${vertical}">
                    <label>Até</label>
                    <input name="campos_data" type="date">
                </div>

                <img src="imagens/concluido.png" onclick="pesquisarMovimentos()">

            </div>

            <br>

            ${tabela}

        </div>`

    popup({ elemento, titulo: 'Relatório de Movimentos' })

    await paginacao()

}

async function pesquisarMovimentos() {

    const datas = [...document.querySelectorAll('[name="campos_data"]')]

    controles.movimentos.filtros = {
        'estoque.historico.*.data': [
            { op: '>=d', value: datas?.[0]?.value },
            { op: '<=d', value: datas?.[1]?.value }
        ]
    }

    await paginacao()

}

async function criarLinhaMovimento(produto) {

    const trs = []

    const { partnumber, descricao } = produto || {}

    const filtros = controles?.movimentos?.filtros?.['estoque.historico.*.data'] || {}

    for (const item of Object.values(produto?.estoque?.historico || {})) {

        const { operacao, data, quantidade, usuario, comentario } = item

        if (!multiplasRegras(data, filtros))
            continue

        const img = item.operacao == 'entrada'
            ? 'imagens/up_estoque.png'
            : item.operacao == 'inicial'
                ? 'imagens/zero.png'
                : 'imagens/down_estoque.png'

        trs.push(`
            <tr>
                <td>${partnumber}</td>
                <td style="text-align: left;">${descricao}</td>
                <td style="padding: 5px;">${data}</td>
                <td>${operacao}</td>
                <td><img src="${img}" style="width: 2vw;"></td>
                <td>${quantidade}</td>
                <td>${usuario}</td>
                <td style="text-align: left;">${comentario}</td>
            </tr>
        `)
    }

    return trs.join('')
}