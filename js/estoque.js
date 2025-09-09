let filtrosAtivosEstoques = {}
let filtrosRelatorio = {}
let filtrosComplexos = {}
let colunasEstoque = ['editar', 'partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'estoque_usado', 'estoque_sp', 'valor_compra']

async function atualizarEstoque() {

    await sincronizarDados('dados_estoque')
    await telaEstoque()

}

async function telaEstoque() {

    overlayAguarde()

    let thc = ''
    let ths = ''

    colunasEstoque.forEach((col, i) => {

        thc += `
            <th>
                <div style="${horizontal}; justify-content: start; gap: 3px;">
                    ${col != 'editar' ? `<img src="imagens/aaz.png" style="width: 2vw;" onclick="filtroColunas(${i}, this, true)">` : ''}
                    <label>${inicialMaiuscula(col)}</label>
                </div>
            </th>
            `
        ths += `<th style="background-color: #c1c1c1; border: solid 1px white; text-align: left;" ${col !== 'excluir' ? `oninput="pesquisarGenerico(${i}, this.textContent, filtrosAtivosEstoques, 'bodyEstoque')" contentEditable="true"` : ''}></th>`

    })

    const acumulado = `
        <div style="${vertical}; width: 95vw;">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                <table class="tabela" id="tabela_estoque">
                    <thead>
                        <tr>${thc}</tr>
                        <tr id="thead_pesquisa">${ths}</tr>
                    </thead>  
                    <tbody id="bodyEstoque"></tbody>
                </table>
            </div>
            <div class="rodapeTabela"></div>
        </div>
    `
    const bodyEstoque = document.getElementById('bodyEstoque')
    if(!bodyEstoque) tela.innerHTML = acumulado

    let idsAtivos = []
    const dados_estoque = await recuperarDados('dados_estoque') || {}
    for (const [codigo, item] of Object.entries(dados_estoque)) {
        criarLinhaEstoque(codigo, item)
        idsAtivos.push(codigo)
    }

    // Trecho para eleminar linhas incoerentes;
    const linhas = document.getElementById('bodyEstoque')
    const trs = linhas.querySelectorAll('tr')
    const idsAtuais = Array.from(trs).map(tr => tr.id).filter(id => id)
    for (const idAtual of idsAtuais) {
        if (!idsAtivos.includes(idAtual)) document.getElementById(idAtual).remove()
    }

    criarMenus('estoque')

    removerOverlay()

}

function criarLinhaEstoque(codigo, item) {

    const modelo = (texto) => `<td>${texto}</td>`

    const modeloEst = (qtde, nomeEstoque) => {
        const bg = qtde == 0 ? '' : qtde < 0 ? '#b36060bf' : '#4CAF50bf'
        return `<td><label onclick="abrirEstoque('${codigo}', '${nomeEstoque}')" class="label-estoque" style="background-color: ${bg};">${qtde}</label></td>`
    }

    // Estoque 
    const estoques = ['estoque', 'estoque_sp', 'estoque_usado']
    let quantidades = {}
    for (const estoque of estoques) {

        if (!quantidades[estoque]) quantidades[estoque] = item?.[estoque]?.quantidade || 0

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
            <img src="imagens/editar.png" style="cursor: pointer; width: 2vw;" onclick="incluirItemEstoque('${codigo}')">
        </td>
        ${modelo(item.partnumber)}
        ${modelo(item.categoria)}
        ${modelo(item.marca)}
        <td style="text-align: left;">${item.descricao}</td>
        ${modeloEst(quantidades.estoque, 'estoque')}
        ${modeloEst(quantidades.estoque_usado, 'estoque_usado')}
        ${modeloEst(quantidades.estoque_sp, 'estoque_sp')}
        <td>
            <label onclick="abrirValores('${codigo}')" class="label-estoque" style="background-color: ${ultimaCompra !== 0 ? '#097fe6bf' : ''}">
                ${dinheiro(ultimaCompra)}
            </label>
        </td>
        `
    const trExistente = document.getElementById(codigo)
    if (trExistente) return trExistente.innerHTML = tds

    document.getElementById('bodyEstoque').insertAdjacentHTML('beforeend', `<tr id="${codigo}">${tds}</tr>`)
}

function pegarValor(td) {
    const input = td.querySelector('input');
    if (input) return input.value;

    const select = td.querySelector('select');
    if (select) return select.options[select.selectedIndex].text;

    const textarea = td.querySelector('textarea');
    if (textarea) return textarea.value;

    return td.textContent.trim();
}

function filtroColunas(col, th) {

    const filtro = document.querySelector('.filtro')
    if (filtro) filtro.remove()

    let tabela = document.getElementById('tabela_estoque')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')
    let opcoes = {
        desmarcadas: '',
        marcadas: ''
    }
    let termos = []

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        termos.push(pegarValor(tds[col]))

    })

    termos = [...new Set(termos)]

    termos.forEach(op => {

        let marcado = (filtrosComplexos?.[col] || []).includes(op)
        opcoes[marcado ? 'marcadas' : 'desmarcadas'] += `
        <div class="opcao">
            <input type="checkbox" onchange="acumularPesquisa('${col}', '${op}', this)" ${marcado ? 'checked' : ''}>
            <label>${op}</label>
        </div>
        `
    })

    let posicao = th.getBoundingClientRect()
    let left = posicao.left + window.scrollX
    let top = posicao.bottom + window.scrollY

    const acumulado = `
        <div class="filtro" style="top: ${top}px; left: ${left}px;">
            <span class="close" onclick="this.parentElement.remove()">×</span>
            <label class="opcao" style="width: 80%;" onclick="filtrar_tabela('${col}', 'tabela_estoque')">Filtrar A a Z</label>

            <hr style="width: 100%;">
            <label>Pesquisar</label>
            <input oninput="filtrarOpcoes(this)" style="width: 95%;">

            <div class="opcao">
                <input type="checkbox" onchange="marcarTodos('${col}', this)" ${(filtrosComplexos?.[col] || []).length == termos.length ? 'checked' : ''}>
                <label>Marcar todos</label>
            </div>

            <div id="caixaOpcoes">
                ${opcoes.marcadas}
                ${opcoes.desmarcadas}
            </div>

        </div>
        `

    document.body.insertAdjacentHTML('beforeend', acumulado)

}

function marcarTodos(col, inputTodos) {
    let caixaOpcoes = document.getElementById('caixaOpcoes')
    if (caixaOpcoes) {
        let divs = caixaOpcoes.querySelectorAll('div')

        divs.forEach(div => {

            let inputDiv = div.querySelector('input')
            let labelDiv = div.querySelector('label')
            inputDiv.checked = inputTodos.checked

            salvarTermos(col, labelDiv.textContent, inputDiv)

        })
    }

    executarPesquisa()

}

function salvarTermos(col, termo, input) {
    if (input.checked) {

        if (!filtrosComplexos[col]) {
            filtrosComplexos[col] = []
        }

        if (!filtrosComplexos[col].includes(termo)) {
            filtrosComplexos[col].push(termo)
        }

    } else {

        if (filtrosComplexos[col]) {
            filtrosComplexos[col] = filtrosComplexos[col].filter(t => t !== termo);
        }
    }
}

function executarPesquisa() {
    // Filtro cruzado
    let tabela = document.getElementById('tabela_estoque')
    let tbody = tabela.querySelector('tbody')
    let trs = tbody.querySelectorAll('tr')

    trs.forEach(tr => {

        let tds = tr.querySelectorAll('td')
        let mostrar = true

        for (col in filtrosComplexos) {

            if (!filtrosComplexos[col] || filtrosComplexos[col].length == 0) {
                delete filtrosComplexos[col]
                break
            }

            if (!filtrosComplexos[col].includes(pegarValor(tds[col]))) {
                mostrar = false
                break
            }

        }

        tr.style.display = mostrar ? 'table-row' : 'none'

    })

    let thead = tabela.querySelector('thead')
    let trsTH = thead.querySelectorAll('tr')
    let ths = trsTH[0].querySelectorAll('th')

    ths.forEach((th, i) => {
        let img = th.querySelector('img')
        if (img) {
            img.src = filtrosComplexos[i] ? 'imagens/filtro.png' : 'imagens/aaz.png'
        }
    })

}

function acumularPesquisa(col, termo, input) {

    salvarTermos(col, termo, input)
    executarPesquisa()

}

function filtrarOpcoes(input) {

    let caixaOpcoes = document.getElementById('caixaOpcoes')

    if (caixaOpcoes) {
        let divs = caixaOpcoes.querySelectorAll('div')

        divs.forEach(div => {
            let label = div.querySelector('label').textContent.toLowerCase()
            let termo = input.value.toLowerCase()

            label.includes(termo) ? div.style.display = '' : div.style.display = 'none'

        })
    }
}

function calcular_cmc(objeto) {

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

function calcular_maior(objeto) {

    let maior = 0

    if (dicionario(objeto) && Object.keys(objeto).length > 0) {

        for (id in objeto) {

            let compra = objeto[id]

            let valor = compra.vl_compra / compra.conversao

            if (maior < valor) {

                maior = compra.vl_compra / compra.conversao

            }

        }

    }

    return maior

}

async function abrirValores(codigo) {

    const dados_estoque = await recuperarDados('dados_estoque') || {}
    const item = dados_estoque[codigo]
    let tabela = ''
    let opcoes = {
        resultados: {
            fornecedor: [],
            comentario: []
        },
        datalists: {
            fornecedor: '',
            comentario: ''
        }
    }

    for (produto in dados_estoque) {
        let item = dados_estoque[produto]
        if (item.valor_compra && dicionario(item.valor_compra)) {
            for (compra in item.valor_compra) {
                let compra_item = item.valor_compra[compra]
                opcoes.resultados.fornecedor.push(compra_item.fornecedor)
                opcoes.resultados.comentario.push(compra_item.comentario)
            }
        }
    }

    opcoes.resultados.fornecedor = [...new Set(opcoes.resultados.fornecedor)]
    opcoes.resultados.comentario = [...new Set(opcoes.resultados.comentario)]

    opcoes.resultados.fornecedor.forEach(fornecedor => {
        opcoes.datalists.fornecedor += `<option value="${fornecedor}">`
    })

    opcoes.resultados.comentario.forEach(comentario => {
        opcoes.datalists.comentario += `<option value="${comentario}">`
    })

    if (dicionario(item.valor_compra)) {

        let historicoCompra = Object.entries(item.valor_compra);
        historicoCompra.sort((a, b) => {
            const dataA = parseDataBR(a[1].data);
            const dataB = parseDataBR(b[1].data);
            return dataB - dataA;
        });

        item.valor_compra = Object.fromEntries(historicoCompra);

        let linhas = ''
        for (cpr in item.valor_compra) {
            let compra = item.valor_compra[cpr]
            let readOnly = 'readOnly'
            let exclusao = ''

            if (acesso.permissao == 'adm' || acesso.usuario == compra.usuario) {
                readOnly = ''
                exclusao = `
                    <div style="display: flex; justify-content: center; align-items: center;">
                        <img src="imagens/cancel.png" style="width: 2vw; cursor: pointer;" onclick="excluir_preco('${codigo}', '${cpr}')">
                    </div>                
                `
            }

            linhas += `
            <tr>
                <td>${dinheiro(compra.vl_compra)}</td>
                <td>${compra.data}</td>
                <td>${compra.unidade}</td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvarDadosCompra('${codigo}', '${cpr}', 'conversao', this)">
                        <input class="campo-verde" style="font-size: 1.2em;" value="${compra.conversao}" oninput="exibir_botao(this)" ${readOnly}>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvarDadosCompra('${codigo}', '${cpr}', 'fornecedor', this)">
                        <textarea maxlength="100" style="border-radius: 0px; border: none;" oninput="exibir_botao(this)" ${readOnly}>${compra.fornecedor}</textarea>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvarDadosCompra('${codigo}', '${cpr}', 'comentario', this)">
                        <textarea maxlength="100" style="border-radius: 0px; border: none;" oninput="exibir_botao(this)" ${readOnly}>${compra.comentario}</textarea>
                    </div>                
                </td>
                <td>${compra.usuario}</td>
                <td>
                    ${exclusao}
                </td>
            </tr>
            `
        }

        const valor = calcular_cmc(item.valor_compra)
        tabela = `

            <hr style="width: 100%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%; gap: 10px;">
                <label>CMC - Custo Médio de Compra</label>
                <label style="border-radius: 5px; padding: 10px; font-size: 35px; color: white; background-color: #097fe6; margin: 5px;">${dinheiro(valor)}</label>
            </div>

            <hr style="width: 100%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="${vertical}; width: 100%;">
                <div class="topo-tabela"></div>
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
                            <tbody style="color: #222;">${linhas}</tbody>
                        </table>
                    </div>
                <div class="rodapeTabela"></div>
            </div>
        `
    }

    const acumulado = `
        <div class="painel-registro">
        
            <div style="color: #222; display: flex; justify-content: start; align-items: center; margin: 2px; gap: 3vw;">
                <img src="imagens/LG.png" style="width: 5vw;">
                <div style="display: flex; justify-content: center; align-items: start; flex-direction: column;">
                    <label style="font-size: 0.7vw;">Descrição</label>
                    <label style="font-size: 1.0vw;">${item.descricao}</label>
                </div>
            </div>

            <hr style="width: 100%;">

            <div style="${horizontal}; gap: 10px;">
            
                <div style="display: flex; justify-content: center;">
                    
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Valor de Compra</label>
                        <input class="campo-verde" style="background-color: #097fe6;" id="vl_compra">
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Unidade</label>
                        <input class="campo-verde" value="1" id="unidade" readOnly>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Conversão</label>
                        <input class="campo-verde" value="1" id="conversao">
                    </div>

                </div>

                <div style="display: flex; justify-content: center; align-items: center; gap: 10px;"> 

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Fornecedor</label>
                        <input class="campo-verde" id="fornecedor" list="datalist_fornecedor">
                        <datalist id="datalist_fornecedor">${opcoes.datalists.fornecedor}</datalist>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                        <label style="color: #222;">Comentário</label>
                        <input class="campo-verde" id="comentario" list="datalist_comentario">
                        <datalist id="datalist_comentario">${opcoes.datalists.comentario}</datalist>
                    </div>

                </div>

                <img src="imagens/concluido.png" style="cursor: pointer;" onclick="salvarValor('${codigo}')">

            </div>

            ${tabela}

        </div>
    `

    popup(acumulado, 'Informar valor de Compra')
}

async function salvarDadosCompra(codigo, cpr, campo, img) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let elemento = img.nextElementSibling
    if (dados_estoque[codigo] && dados_estoque[codigo].valor_compra[cpr]) {

        elemento = campo == 'conversao' ? conversor(elemento.value) : elemento.value
        dados_estoque[codigo].valor_compra[cpr][campo] = elemento

        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar(`dados_estoque/${codigo}/valor_compra/${cpr}/${campo}`, elemento)

    }

    removerPopup()
    await abrirValores(codigo)
}

async function excluir_preco(codigo, cpr) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (dados_estoque[codigo] && dados_estoque[codigo].valor_compra[cpr]) {
        delete dados_estoque[codigo].valor_compra[cpr]
    }

    await deletar(`dados_estoque/${codigo}/valor_compra/${cpr}`)
    await inserirDados(dados_estoque, 'dados_estoque')

    removerPopup()
    await abrirValores(codigo)
}

async function salvarValor(codigo) {

    overlayAguarde()

    let item = await recuperarDado('dados_estoque', codigo) || {}

    const vl_compra = document.getElementById('vl_compra')
    const unidade = document.getElementById('unidade')
    const conversao = document.getElementById('conversao')
    const fornecedor = document.getElementById('fornecedor')
    const comentario = document.getElementById('comentario')

    if (!item.valor_compra || !dicionario(item.valor_compra)) item.valor_compra = {}

    const id = ID5digitos()

    const compra = {
        vl_compra: conversor(vl_compra.value),
        unidade: conversor(unidade.value),
        conversao: conversor(conversao.value),
        fornecedor: fornecedor.value,
        comentario: comentario.value,
        usuario: acesso.usuario,
        data: new Date().toLocaleString('pt-BR')
    }

    item.valor_compra[id] = compra

    await inserirDados({ [codigo]: item }, 'dados_estoque')
    await enviar(`dados_estoque/${codigo}/valor_compra/${id}`, compra)

    removerPopup()
    await telaEstoque()
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

    const historicoArray = Object.entries(estoque?.historico || {});
    historicoArray.sort((a, b) => {
        const dataA = parseDataBR(a[1].data);
        const dataB = parseDataBR(b[1].data);
        return dataB - dataA;
    });

    for (const [chave, historico] of historicoArray) {

        const img = historico.operacao == 'entrada' ? 'imagens/up_estoque.png' : historico.operacao == 'inicial' ? 'imagens/zero.png' : 'imagens/down_estoque.png'

        let exclusao = ''
        if (
            (historico.operacao == 'inicial' && acesso.permissao == 'adm') ||
            (historico.operacao !== 'inicial' && (acesso.permissao == 'adm' || acesso.usuario == historico.usuario))
        ) {
            exclusao = `<img src="imagens/cancel.png" style="cursor: pointer; width: 2vw;" onclick="remover_historico('${codigo}', '${stq}','${chave}')">`
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
            <hr style="width: 99%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label style="color: #222; font-size: 1.5vw;">Histórico</label>
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
                <div class="rodapeTabela"></div>
            </div>
        `
    }

    const acumulado = `

    <div class="painel-registro">

        <label id="movimento" style="display: none;">${codigo}/${stq}</label>

        <div style="color: #222; position: relative; display: flex; justify-content: start; align-items: center; margin: 2px; gap: 3vw;">
            <img src="imagens/LG.png" style="width: 5vw;">
            <div style="display: flex; justify-content: center; align-items: start; flex-direction: column;">
                <label style="font-size: 0.7vw;">Descrição</label>
                <label style="font-size: 1.0vw;">${item.descricao}</label>
            </div>
        </div>

        <hr style="width: 100%;">

        <div style="${horizontal}; width: 100%;">
            
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Saída</label>
                <input class="campo-verde" style="background-color: #B12425;" id="saida" oninput="inputs(this)">
            </div>
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Entrada</label>
                <input class="campo-verde" id="entrada" oninput="inputs(this)">
            </div>

            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <label style="color: #222;">Comentário</label>
                <textarea maxlength="100" rows="5" id="comentario"></textarea>
            </div>

            <img src="imagens/concluido.png" style="width: 3vw; cursor: pointer;" onclick="salvarMovimento('${codigo}', '${stq}')">

        </div>

        <hr style="width: 100%;">

        <div style="${horizontal}; width: 100%;">
        
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 60%;">
                <label>Saldo Atual</label>
                <label style="color: white; background-color: #4CAF50; font-size: 35px; height: 50px; width: 90%; border-radius: 5px;">${atual}</label>
            </div>
        
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">

                <label>Saldo Inicial</label>

                <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                    <input class="campo-verde" style="background-color: #B12425;" value="${inicial}">
                    <img src="imagens/concluido.png" style="cursor: pointer; width: 3vw;" onclick="salvarMovimento('${codigo}', '${stq}', this)">
                </div>
            
            </div>
        </div>

        ${divHistorico}

    </div>
    `

    popup(acumulado, 'Movimentação de estoque')

}

function inputs(elemento) {

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

async function remover_historico(codigo, stq, chave) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]

    if (item[stq].historico && item[stq].historico[chave]) {
        delete item[stq].historico[chave]
    }

    await inserirDados(dados_estoque, 'dados_estoque')
    await deletar(`dados_estoque/${codigo}/${stq}/historico/${chave}`)

    removerPopup()
    await abrirEstoque(codigo, stq)

}

async function salvarMovimento(codigo, stq, inicial) {

    const comentario = document.getElementById('comentario')
    const entrada = document.getElementById('entrada')
    const saida = document.getElementById('saida')
    const id = ID5digitos()

    removerPopup()

    let item = await recuperarDado('dados_estoque', codigo)
    if (!dicionario(item[stq]) || !item[stq].historico) {
        item[stq] = {
            historico: {},
            quantidade: 0
        };
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

    await telaEstoque()
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

    const dados_estoque = await recuperarDados('dados_estoque')
    let categorias = []
    let marcas = []

    for (const [codigo, produto] of Object.entries(dados_estoque)) {
        if (produto.categoria && !categorias.includes(produto.categoria)) categorias.push(produto.categoria)
        if (produto.marca && !categorias.includes(produto.marca)) marcas.push(produto.marca)
    }

    const produto = dados_estoque?.[codigo] || {}

    const acumulado = `
        <div class="painel-registro">

            <div style="${horizontal}; gap: 15px;">

                <div style="${vertical}">
                
                    ${modelo('Omie / Partnumber', `<input name="partnumber" value="${produto?.partnumber || ''}">`)}
                    
                    ${modelo('Categoria', `<input name="categoria" list="categorias" value="${produto?.categoria || ''}">`)}

                    <datalist id="categorias">${categorias.map(op => `<option>${op}</option>`).join('')}</datalist>

                    ${modelo('Marca', `<input name="marca" list="marcas" value="${produto?.marca || ''}">`)}

                    <datalist id="marcas">${marcas.map(op => `<option>${op}</option>`).join('')}</datalist>

                </div>

                ${modelo('Descrição', `<textarea name="descricao" rows="5">${produto?.descricao || ''}</textarea>`)}

            </div>

            <hr style="width: 100%;">

            <div style="${horizontal}; justify-content: space-between; width: 100%;">
                <button style="background-color: green;" onclick="salvarItemEstoque(${codigo ? `'${codigo}'` : false})">Salvar</button>
                ${codigo ? `<button onclick="removerLinhaEstoque('${codigo}')">Excluir</button>` : ''}
            </div>

        </div>
    `

    popup(acumulado, 'Cadastro de Item');

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
    await telaEstoque()

    removerPopup()

    enviar(`dados_estoque/${codigo}`, mesclado)

}

async function removerLinhaEstoque(codigo) {

    const item = await recuperarDado('dados_estoque', codigo)

    popup(`
        <div style="${vertical}; padding: 2vw; background-color: #d2d2d2;">
            <label>Deseja excluir este item?</label>
            <label>${item.partnumber} - ${item.descricao}</label>
            <button onclick="confirmarExclusaoEstoque('${codigo}')">Confirmar</button>
        </div>
    `, 'Tem certeza?', true)

}

async function confirmarExclusaoEstoque(codigo) {

    removerPopup()
    removerPopup()
    const tr = document.getElementById(codigo)
    if (tr) tr.remove()

    deletarDB('dados_estoque', codigo)
    deletar(`dados_estoque/${codigo}`)
}

function relatorioMovimento() {

    const acumulado = `
        <div class="painel-registro">

            <div style="${horizontal}; gap: 10px;">
                
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">De</label>
                    <input class="datas_estoque" type="date" onchange="atualizarDadosRelatorio()">
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">Até</label>
                    <input class="datas_estoque" type="date" onchange="atualizarDadosRelatorio()">
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">Movimentos</label>
                    <label style="${horizontal}; background-color: #097fe6; color: white;" class="campo-verde" id="contagem">0</label>
                </div>

            </div>

            <div id="relatorio"></div>

        </div>
    `

    popup(acumulado, 'Relatório de Movimentos')

}

async function atualizarDadosRelatorio() {

    const dados_estoque = await recuperarDados('dados_estoque') || {}
    const relatorio = document.getElementById('relatorio')

    if (relatorio) {

        let inputs = document.body.querySelectorAll('input.datas_estoque')

        let [anoI, mesI, diaI] = String(inputs[0].value).split('-')
        let inicial = new Date(anoI, mesI - 1, diaI)
        let [anoF, mesF, diaF] = String(inputs[1].value).split('-')
        let final = new Date(anoF, mesF - 1, diaF)
        final.setHours(23, 59, 59, 999);

        let filtrados = []

        for (const [codigo, produto] of Object.entries(dados_estoque)) {

            if (produto.estoque && produto.estoque.historico) {
                let historico = produto.estoque.historico

                for (his in historico) {
                    let movimento = historico[his]
                    movimento.partnumber = produto.partnumber
                    movimento.descricao = produto.descricao
                    movimento.origem = 'novo'

                    let [dsd, dsh] = String(movimento.data).split(', ')
                    let [dia, mes, ano] = String(dsd).split('/')
                    let data = new Date(ano, mes - 1, dia);

                    if (data >= inicial && data <= final) {
                        filtrados.push(movimento)
                    }

                }
            }

            if (produto.estoque_usado && produto.estoque_usado.historico) {
                let historico = produto.estoque_usado.historico

                for (his in historico) {
                    let movimento = historico[his]
                    movimento.partnumber = produto.partnumber
                    movimento.descricao = produto.descricao
                    movimento.origem = 'usado'

                    let [dsd, dsh] = String(movimento.data).split(', ')
                    let [dia, mes, ano] = String(dsd).split('/')
                    let data = new Date(ano, mes - 1, dia);

                    if (data >= inicial && data <= final) {
                        filtrados.push(movimento)
                    }

                }
            }
        }

        let linhas = ''
        let contagem = document.getElementById('contagem')
        if (contagem) contagem.textContent = filtrados.length

        filtrados.forEach(item => {

            let img = item.operacao == 'entrada' ? 'imagens/up_estoque.png' : item.operacao == 'inicial' ? 'imagens/zero.png' : 'imagens/down_estoque.png'

            linhas += `
            <tr>
                <td>${item.origem}</td>
                <td>${item.partnumber}</td>
                <td style="text-align: left;">${item.descricao}</td>
                <td style="padding: 5px;">${item.data}</td>
                <td>${item.operacao}</td>
                <td><img src="${img}" style="width: 2vw;"></td>
                <td>${item.quantidade}</td>
                <td>${item.usuario}</td>
                <td style="text-align: left;">${item.comentario}</td>
            </tr>
            `
        })

        const colunas = ['Origem', 'Partnumber', 'Descrição', 'Data', 'Operação', 'Sin', 'Quantidade', 'Usuário', 'Comentário']
        let ths = ''
        let thsearch = ''

        colunas.forEach((coluna, i) => {
            ths += `<th>${coluna}</th>`
            thsearch += `<th style="background-color: white; text-align: left;" contentEditable="true" oninput="pesquisarGenerico(${i}, this.textContent, filtrosRelatorio, 'body2')"></th>`
        })

        if (linhas == '') {
            thsearch = ''
            linhas = `
            <tr>
                <td colspan="9" style="color: #222; text-align: center;">Sem resultados</td>
            </tr>
            `
        }

        const tabela = `
        <div style="${vertical}; width: 100%;">
            <div class="topo-tabela"></div>
                <div class="div-tabela">
                    <table class="tabela">
                        <thead>
                            <tr>${ths}</tr>
                            <tr style="background-color: white;">${thsearch}</tr>
                        <thead>
                        <tbody id="body2">${linhas}</tbody>
                    </table>
                </div>
            <div class="rodapeTabela"></div>
        </div>
        `

        relatorio.innerHTML = tabela

    }

}