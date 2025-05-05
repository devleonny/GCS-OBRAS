let filtrosAtivosEstoques = {}
let filtrosRelatorio = {}
let filtrosComplexos = {}
let colunas = ['partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'estoque_usado', 'estoque_sp', 'valor_compra']
let acesso = JSON.parse(localStorage.getItem('acesso')) || {}

carregar_estoque()

async function recuperar_estoque() {
    let estoque_nuvem = await receber('dados_estoque') || {}
    await inserirDados(estoque_nuvem, 'dados_estoque')
    await carregar_estoque()
}

async function carregar_estoque() {

    document.body.insertAdjacentHTML("beforebegin", overlay_aguarde())

    let autorizado = false
    let div_estoque = document.getElementById('estoque')

    if (acesso.permissao == 'adm' || acesso.permissao == 'log') {
        autorizado = true
        document.getElementById('adicionar_item').style.display = 'flex'

        if (!colunas.includes('Excluir')) {
            colunas.unshift('Excluir')
        }

    }

    let apenas_leitura = autorizado ? '' : 'readonly'
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (Object.keys(dados_estoque).length == 0) {
        return await recuperar_estoque()
    }

    let thc = ''
    let ths = ''
    let linhas = ''
    colunas.forEach((col, i) => {

        let indice_correto = i + 1
        let coluna = inicial_maiuscula(col)
        thc += `
            <th style="cursor: pointer; position: relative;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 2vw;">
                    <label>${coluna}</label>
                    ${coluna != 'Excluir' ? `<img src="imagens/aaz.png" style="width: 2vw;" onclick="filtroColunas(${indice_correto}, this, true)">` : ''}
                </div>
            </th>
            `

        coluna == 'Excluir' ?
            ths = `<th style="background-color: white; position: relative; border-radius: 0px;"></th>`
            :
            ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%; font-size: 1.1vw;" style="text-align: center;" oninput="pesquisar_generico(${indice_correto}, this.value, filtrosAtivosEstoques, 'body')">
            </th>
            `
    })

    let dados_estoque_ordenado = Object.entries(dados_estoque)
        .sort(([, a], [, b]) => (b.timestamp || 0) - (a.timestamp || 0))
        .reduce((acc, [key, value]) => {
            acc[key] = value;
            return acc;
        }, {});



    for (item in dados_estoque_ordenado) {

        let dados_item = dados_estoque[item]

        let tds = ''

        colunas.forEach(chave => {

            let info = dados_item[chave] || ''
            let elemento = `<input style="background-color: transparent; cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" value="${info}" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>`
            let quantidade = ''
            let cor = ''
            let valor = ''

            if (chave == 'descricao') {
                elemento = `<textarea style="font-size; 0.7vw; border: none; border-radius: 0px; width: 15vw;" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>${info}</textarea>`

            } else if (chave == 'Excluir') {

                elemento = `
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <img src="imagens/cancel.png" style="cursor: pointer; width: 2vw;" onclick="remover_linha_excluir_item(this)">
                    </div>
                `
            } else if (chave.includes('valor_compra')) {

                valor = calcular_maior(dados_item.valor_compra)

                elemento = `
                    <label  class="labelEstoque" style="background-color: ${valor != 0 ? '#097fe6bf' : ''};" onclick="abrir_valores('${item}', '${chave}')">${dinheiro(valor)}</label>
                    `

            } else if (chave.includes('estoque')) {

                quantidade = info.quantidade || 0

                for (his in info.historico) {

                    let historico = info.historico[his]

                    if (historico.operacao == 'entrada') {
                        quantidade += historico.quantidade
                    } else if (historico.operacao == 'saida') {
                        quantidade -= historico.quantidade
                    }

                }

                if (quantidade !== '') {
                    cor = conversor(quantidade) > 0 ? '#4CAF50bf' : '#b36060bf'
                }

                elemento = `<label class="labelEstoque" style="background-color: ${cor}" onclick="abrir_estoque('${item}', '${chave}')">${quantidade}</label>`

            }

            tds += `
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvar_dados_estoque(this, '${item}', '${chave}')">
                        ${elemento}
                    </div>
                </td>
            `

        })

        linhas += `
            <tr>
                <td style="display: none;">${item}</td>
                ${tds}
            </tr>
        `

    }

    let acumulado = `
        <div style="height: max-content; max-height: 70vh; width: max-content; max-width: 90vw; overflow: auto; background-color: #d2d2d2; border-radius: 5px;">
            <table class="tabela" id="tabela_estoque">
                <thead>
                    <tr>${thc}</tr>
                    <tr id="thead_pesquisa">${ths}</tr>
                </thead>  
                <tbody id="body">${linhas}</tbody>
            </table>
        </div>
    
    `

    div_estoque.innerHTML = acumulado

    document.getElementById("aguarde").remove()

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

    let filtro = document.getElementById('filtro')
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

    let acumulado = `
        <div id="filtro" class="filtro" style="top: ${top}px; left: ${left}px;">
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
        let col = i + 1 // Existe uma coluna oculta, então pula-se 1 coluna;
        let img = th.querySelector('img')
        if (img) {
            img.src = filtrosComplexos[col] ? 'imagens/filtro.png' : 'imagens/aaz.png'
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

async function abrir_valores(codigo) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]

    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

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

    let acumulado = `
        <label style="position: absolute; bottom: 5px; right: 15px; font-size: 0.7em;" id="data">${data}</label>

        <div style="color: #222; position: relative; display: flex; justify-content: start; align-items: center; margin: 2px; gap: 3vw;">
            <img src="imagens/LG.png" style="width: 5vw;">
            <div style="display: flex; justify-content: center; align-items: start; flex-direction: column;">
                <label style="font-size: 0.7vw;">Descrição</label>
                <label style="font-size: 1.0vw;">${item.descricao}</label>
            </div>
        </div>

        <hr style="width: 100%;">

        <div style="display: flex; align-items: center; justify-content: space-evenly; gap: 10px; background-color: white; border-radius: 5px; margin: 5px; padding: 10px;">
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
                <div style="display: flex; justify-content: center;">
                    
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Valor de Compra</label>
                        <input class="numero-bonito" style="background-color: #097fe6;" id="vl_compra">
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Unidade</label>
                        <input class="numero-bonito" value="1" id="unidade" readOnly>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Conversão</label>
                        <input class="numero-bonito" value="1" id="conversao">
                    </div>

                </div>

                <div style="display: flex; justify-content: center; align-items: center; gap: 10px;"> 

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                        <label style="color: #222;">Fornecedor</label>
                        <input class="numero-bonito" id="fornecedor" list="datalist_fornecedor">
                        <datalist id="datalist_fornecedor">${opcoes.datalists.fornecedor}</datalist>
                    </div>

                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%;">
                        <label style="color: #222;">Comentário</label>
                        <input class="numero-bonito" id="comentario" list="datalist_comentario">
                        <datalist id="datalist_comentario">${opcoes.datalists.comentario}</datalist>
                    </div>

                </div>

            </div>

            <img src="imagens/concluido.png" style="cursor: pointer;" onclick="salvar_valor('${codigo}')">

        </div>

        `

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
            <tr style="font-size: 0.7em;">
                <td>${dinheiro(compra.vl_compra)}</td>
                <td>${compra.data}</td>
                <td>${compra.unidade}</td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'conversao', this)">
                        <input class="numero-bonito" style="font-size: 1.2em;" value="${compra.conversao}" oninput="exibir_botao(this)" ${readOnly}>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'fornecedor', this)">
                        <textarea maxlength="100" style="border-radius: 0px; border: none;" oninput="exibir_botao(this)" ${readOnly}>${compra.fornecedor}</textarea>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 2vw; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'comentario', this)">
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

        let valor = calcular_cmc(item.valor_compra)
        acumulado += `

            <hr style="width: 100%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%; gap: 10px;">
                <label>CMC - Custo Médio de Compra</label>
                <label style="border-radius: 5px; padding: 10px; font-size: 35px; color: white; background-color: #097fe6; margin: 5px;">${dinheiro(valor)}</label>
            </div>

            <hr style="width: 100%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="background-color: #d2d2d2; white; border-radius: 3px; width: 100%; border-radius: 3px;">
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
            
        `
    }

    openPopup_v2(acumulado, 'Informar valor de Compra')
}

async function salvar_dados_compra(codigo, cpr, campo, img) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let elemento = img.nextElementSibling
    if (dados_estoque[codigo] && dados_estoque[codigo].valor_compra[cpr]) {

        elemento = campo == 'conversao' ? conversor(elemento.value) : elemento.value
        dados_estoque[codigo].valor_compra[cpr][campo] = elemento

        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar(`dados_estoque/${codigo}/valor_compra/${cpr}/${campo}`, elemento)

    }

    remover_popup()
    await abrir_valores(codigo)
}

async function excluir_preco(codigo, cpr) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (dados_estoque[codigo] && dados_estoque[codigo].valor_compra[cpr]) {
        delete dados_estoque[codigo].valor_compra[cpr]
    }

    await deletar(`dados_estoque/${codigo}/valor_compra/${cpr}`)
    await inserirDados(dados_estoque, 'dados_estoque')

    remover_popup()
    await abrir_valores(codigo)
}

async function salvar_valor(codigo) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let data = document.getElementById('data')

    if (dados_estoque[codigo]) {

        let vl_compra = document.getElementById('vl_compra')
        let unidade = document.getElementById('unidade')
        let conversao = document.getElementById('conversao')
        let fornecedor = document.getElementById('fornecedor')
        let comentario = document.getElementById('comentario')

        let item = dados_estoque[codigo]

        if (!item.valor_compra || !dicionario(item.valor_compra)) {
            item.valor_compra = {}
        }

        let id = gerar_id_5_digitos()

        let compra = {
            vl_compra: conversor(vl_compra.value),
            unidade: conversor(unidade.value),
            conversao: conversor(conversao.value),
            fornecedor: fornecedor.value,
            comentario: comentario.value,
            usuario: acesso.usuario,
            data: data.textContent
        }

        item.valor_compra[id] = compra

        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar(`dados_estoque/${codigo}/valor_compra/${id}`, compra)

    }

    remover_popup()
    await carregar_estoque()
    await abrir_valores(codigo)

}

function parseDataBR(dataBR) {
    const [dia, mes, anoHora] = dataBR.split('/');
    const [ano, hora] = anoHora.split(', ');
    return new Date(`${ano}-${mes}-${dia}T${hora}:00`);
}

async function abrir_estoque(codigo, stq) {

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]
    let estoque = item[stq] || {}
    let atual = conversor(estoque.quantidade ? estoque.quantidade : 0)
    let inicial = atual
    let linhas = ''

    if (estoque.historico) {

        let historicoArray = Object.entries(estoque.historico);
        historicoArray.sort((a, b) => {
            const dataA = parseDataBR(a[1].data);
            const dataB = parseDataBR(b[1].data);
            return dataB - dataA;
        });
        estoque.historico = Object.fromEntries(historicoArray);

        for (chave in estoque.historico) {

            let historico = estoque.historico[chave]

            let img = historico.operacao == 'entrada' ? 'imagens/up_estoque.png' : historico.operacao == 'inicial' ? 'imagens/zero.png' : 'imagens/down_estoque.png'

            let exclusao = ''
            if (
                (historico.operacao == 'inicial' && acesso.permissao == 'adm') ||
                (historico.operacao !== 'inicial' && (acesso.permissao == 'adm' || acesso.usuario == historico.usuario))
            ) {
                exclusao = `<img src="imagens/cancel.png" style="cursor: pointer; width: 2vw;" onclick="remover_historico('${codigo}', '${stq}','${chave}')">`
            }

            linhas += `
            <tr style="font-size: 0.7em;">
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
    }

    let data = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    });

    let div_historico = ''
    if (estoque.historico && Object.keys(estoque.historico).length > 0) {
        div_historico = `
            <hr style="width: 99%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label style="color: #222; font-size: 1.5vw;">Histórico</label>
            </div>

            <div style="background-color: #d2d2d2; white; border-radius: 3px; width: 100%; border-radius: 3px;">
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
        `
    }

    let acumulado = `

        <label id="movimento" style="display: none;">${codigo}/${stq}</label>

        <label style="position: absolute; bottom: 5px; right: 15px; font-size: 0.7em;" id="data">${data}</label>

        <div style="background-color: white; border-radius: 5px;"> 

            <div style="color: #222; position: relative; display: flex; justify-content: start; align-items: center; margin: 2px; gap: 3vw;">
                <img src="imagens/LG.png" style="width: 5vw;">
                <div style="display: flex; justify-content: center; align-items: start; flex-direction: column;">
                    <label style="font-size: 0.7vw;">Descrição</label>
                    <label style="font-size: 1.0vw;">${item.descricao}</label>
                </div>
            </div>

            <hr style="width: 99%;">

            <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; margin: 2px; height: 140px;">
                
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">Saída</label>
                    <input class="numero-bonito" style="background-color: #B12425;" id="saida" oninput="inputs(this)">
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">Entrada</label>
                    <input class="numero-bonito" id="entrada" oninput="inputs(this)">
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <label style="color: #222;">Comentário</label>
                    <textarea maxlength="100" rows="5" id="comentario"></textarea>
                </div>

                <img src="imagens/concluido.png" style="width: 3vw; cursor: pointer;" onclick="salvar_movimento('${codigo}', '${stq}')">

            </div>

            <hr style="width: 99%;">

            <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; height: 130px;">
            
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 60%;">
                    <label>Saldo Atual</label>
                    <label style="color: white; background-color: #4CAF50; font-size: 35px; height: 50px; width: 90%; border-radius: 5px;">${atual}</label>
                </div>
            
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">

                    <label>Saldo Inicial</label>

                    <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                        <input class="numero-bonito" style="background-color: #B12425;" value="${inicial}">
                        <img src="imagens/concluido.png" style="cursor: pointer; width: 3vw;" onclick="salvar_movimento('${codigo}', '${stq}', this)">
                    </div>
                
                </div>
            </div>

            ${div_historico}

        </div>

    `

    openPopup_v2(acumulado, 'Movimentação de estoque')

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

    remover_popup()
    await abrir_estoque(codigo, stq)

}

async function salvar_movimento(codigo, stq, inicial) {

    let data = document.getElementById('data')
    let comentario = document.getElementById('comentario')
    let entrada = document.getElementById('entrada')
    let saida = document.getElementById('saida')
    let id = gerar_id_5_digitos()

    remover_popup()

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    let item = dados_estoque[codigo]
    if (!dicionario(item[stq]) || !item[stq].historico) {
        item[stq] = {
            historico: {},
            quantidade: 0
        };
    }
    let estoque = item[stq]

    let movimento = {
        data: data.textContent,
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

    await inserirDados(dados_estoque, 'dados_estoque')
    await enviar(`dados_estoque/${codigo}/${stq}/historico/${id}`, movimento)

    if (inicial !== undefined) {
        await enviar(`dados_estoque/${codigo}/${stq}/quantidade`, estoque.quantidade)
    }

    await retomar_paginacao(codigo, stq)

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

async function incluir_linha() {
    let estoque_nuvem = await receber('dados_estoque') || {};

    let categoriasSet = new Set();
    let marcasSet = new Set();

    Object.values(estoque_nuvem).forEach(item => {
        if (item.categoria) categoriasSet.add(item.categoria);
        if (item.marca) marcasSet.add(item.marca);
    });

    let categoriasArray = Array.from(categoriasSet);
    let marcasArray = Array.from(marcasSet);

    let acumulado = `

    <div class="formulario">

        <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
            <label>PartNumber</label>
            <input value="CADASTRAR">
        </div>

        <div style="position: relative; display: flex; justify-content: center; flex-direction: column; align-items: start;">
            <label>Categoria</label>
            <input id="categorias">
            <div id="categorias-dropdown"></div> <!-- 🔥 Dropdown de categoria -->
        </div>

        <div style="position: relative; display: flex; justify-content: center; flex-direction: column; align-items: start;">
            <label>Marca</label>
            <input id="marca">
            <div id="marca-dropdown"></div> <!-- 🔥 Dropdown de marca -->
        </div>

        <div style="display: flex; justify-content: center; flex-direction: column; align-items: start;">
            <label>Descrição</label>
            <textarea></textarea>
        </div>

        <button onclick="salvar_item(this)">Salvar</button>

    </div>
    `;

    openPopup_v2(acumulado, 'Cadastro de Item');

    // 🔥 Ativa os auto-completes após abrir o popup
    setupAutoComplete("categorias", "categorias-dropdown", categoriasArray);
    setupAutoComplete("marca", "marca-dropdown", marcasArray);
}

/**
 * Configura o auto-complete no campo de categorias.
 */
function setupAutoComplete(inputId, dropdownId, dataArray) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    // 🔥 Estilizando o dropdown corretamente
    dropdown.style.position = "absolute";
    dropdown.style.width = `${input.offsetWidth}px`; // 🔥 Ajusta a largura para bater com o input
    dropdown.style.left = `${input.offsetLeft}px`; // 🔥 Alinha com o input
    dropdown.style.top = `${input.offsetTop + input.offsetHeight}px`; // 🔥 Fica logo abaixo do input
    dropdown.style.backgroundColor = "#fff";
    dropdown.style.border = "1px solid #ccc";
    dropdown.style.borderRadius = "5px"; // 🔥 Bordas arredondadas
    dropdown.style.boxShadow = "0px 4px 8px rgba(0,0,0,0.2)"; // 🔥 Sombreamento leve
    dropdown.style.maxHeight = "150px";
    dropdown.style.overflowY = "auto";
    dropdown.style.zIndex = "1000"; // 🔥 Mantém o dropdown acima de outros elementos
    dropdown.style.display = "none"; // Começa escondido

    // 🖱 Evento de entrada no input
    input.addEventListener("input", () => {
        const search = input.value.trim().toLowerCase();
        dropdown.innerHTML = ""; // Limpa opções anteriores

        if (!search) {
            dropdown.style.display = "none"; // Esconde se vazio
            return;
        }

        // Filtra opções que começam com a entrada do usuário
        const filtered = dataArray.filter(item => item.toLowerCase().includes(search));

        if (filtered.length === 0) {
            dropdown.style.display = "none"; // Se não houver resultados, esconde
            return;
        }

        filtered.forEach(item => {
            const option = document.createElement("div");
            option.textContent = item;
            option.style.padding = "8px";
            option.style.cursor = "pointer";
            option.style.borderBottom = "1px solid #eee";
            option.style.transition = "background 0.3s";
            option.style.fontSize = "14px";

            // 🔥 Efeito hover para melhorar a UX
            option.addEventListener("mouseenter", () => {
                option.style.backgroundColor = "#f5f5f5";
            });

            option.addEventListener("mouseleave", () => {
                option.style.backgroundColor = "white";
            });

            option.addEventListener("click", () => {
                input.value = item; // Define o valor selecionado
                dropdown.style.display = "none"; // Esconde o dropdown
            });

            dropdown.appendChild(option);
        });

        dropdown.style.display = "block"; // Mostra o dropdown
    });

    // 🔥 Reposiciona o dropdown caso a tela seja redimensionada
    window.addEventListener("resize", () => {
        dropdown.style.width = `${input.offsetWidth}px`;
        dropdown.style.left = `${input.offsetLeft}px`;
        dropdown.style.top = `${input.offsetTop + input.offsetHeight}px`;
    });

    // Oculta o dropdown quando clica fora
    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = "none";
        }
    });
}

async function salvar_item(button) {

    remover_popup()
    let div_maior = button.parentElement
    let codigo = gerar_id_5_digitos()
    let inputs = div_maior.querySelectorAll('input, textarea')

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let item = {
        partnumber: inputs[0].value,
        categoria: inputs[1].value,
        marca: inputs[2].value,
        estoque: {
            quantidade: 0,
            historico: {}
        },
        estoque_usado: {
            quantidade: 0,
            historico: {}
        },
        estoque_sp: {
            quantidade: 0,
            historico: {}
        },
        descricao: inputs[3].value,
        inventario: '',
        timestamp: new Date().getTime()
    }

    dados_estoque[codigo] = item
    await inserirDados(dados_estoque, 'dados_estoque')

    await retomar_paginacao()
    enviar(`dados_estoque/${codigo}`, item)

}

async function remover_linha_excluir_item(elemento) {

    let tr = elemento.closest('tr')
    let tds = tr.querySelectorAll('td')
    let codigo = tds[0].textContent
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (dados_estoque[codigo]) {

        let item = dados_estoque[codigo]

        openPopup_v2(`
            <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
                <img src="gifs/alerta.gif" style="width: 3vw; height: 3vw;">
                <label>Deseja excluir este item?</label>
            </div>
            <label style="font-size: 0.7em;">${item.partnumber} - ${item.descricao}</label>
            <div style="display: flex; justify-content: center; align-items: center; gap: 15px;">
                <button onclick="confirmar_exclusao('${codigo}')">Confirmar</button>
            </div>
        `)

    } else {
        tr.remove()
        delete dados_estoque[codigo]
        await inserirDados(dados_estoque, 'dados_estoque')
        await carregar_estoque()
    }

}

async function confirmar_exclusao(codigo) {

    remover_popup()

    let dados_estoque = await recuperarDados('dados_estoque') || {}
    delete dados_estoque[codigo]
    await inserirDados(dados_estoque, 'dados_estoque')
    await deletar(`dados_estoque/${codigo}`)
    await carregar_estoque()
}

async function salvar_dados_estoque(img, codigo, chave) {

    img.style.display = 'none'

    let elemento = img.nextElementSibling;

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (dados_estoque[codigo] && Object.hasOwn(dados_estoque[codigo], chave)) {
        dados_estoque[codigo][chave] = elemento.value

        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar(`dados_estoque/${codigo}/${chave}`, elemento.value)

    } else if (!dados_estoque[codigo]) { // 29 PERMANENTE; Objetos criados no primeiro momento;

        dados_estoque[codigo] = {
            id: codigo,
            partnumber: '',
            categoria: '',
            marca: '',
            descricao: '',
            estoque: {
                quantidade: 0,
                historico: {}
            },
            localizacao_novo: '',
            estoque_usado: {
                quantidade: 0,
                historico: {}
            },
            localizacao_usado: '',
            inventario: '',
            valor_compra: 0
        }

        dados_estoque[codigo][chave] = elemento.value
        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar(`dados_estoque/${codigo}`, dados_estoque[codigo])

    }

}

async function retomar_paginacao(codigo, stq) {
    await carregar_estoque()

    remover_popup()

    if (Object.keys(filtrosComplexos).length > 0) {
        executarPesquisa()
    } else {
        let tabela_estoque = document.getElementById('tabela_estoque')
        let thead = tabela_estoque.querySelector('thead')
        let trs = thead.querySelectorAll('tr')
        let ths = trs[1].querySelectorAll('th')

        for (coluna in filtrosAtivosEstoques) {
            let texto = filtrosAtivosEstoques[coluna]
            ths[coluna - 1].querySelector('input').value = texto
            pesquisar_generico(coluna, texto, filtrosAtivosEstoques, 'tabela_estoque')
        }
    }

    let inputs = document.body.querySelectorAll('input.datas_estoque')
    if (inputs.length > 0) {
        let data_entrada = inputs[0].value
        let data_saida = inputs[1].value
        relatorio_movimento()
        inputs = document.body.querySelectorAll('input.datas_estoque')
        inputs[0].value = data_entrada
        inputs[1].value = data_saida
        atualizar_dados_relatorio()
    } else if (codigo !== undefined && stq !== undefined) {
        await abrir_estoque(codigo, stq)
    }

}

function relatorio_movimento() {

    let acumulado = `

    <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px; padding: 20px; height: 80px; gap: 20px;">
        
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <label style="color: #222;">De</label>
            <input class="datas_estoque" type="date" onchange="atualizar_dados_relatorio()">
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <label style="color: #222;">Até</label>
            <input class="datas_estoque" type="date" onchange="atualizar_dados_relatorio()">
        </div>

        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <label style="color: #222;">Movimentos</label>
            <label style="background-color: #097fe6; color: white;" class="numero-bonito" id="contagem">0</label>
        </div>

    </div>

    <div id="relatorio"></div>
    `

    openPopup_v2(acumulado, 'Relatório de Movimentos')

}

async function atualizar_dados_relatorio() {

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let relatorio = document.getElementById('relatorio')

    if (relatorio) {

        let inputs = document.body.querySelectorAll('input.datas_estoque')

        let [anoI, mesI, diaI] = String(inputs[0].value).split('-')
        let inicial = new Date(anoI, mesI - 1, diaI)
        let [anoF, mesF, diaF] = String(inputs[1].value).split('-')
        let final = new Date(anoF, mesF - 1, diaF)
        final.setHours(23, 59, 59, 999);

        let filtrados = []

        for (item in dados_estoque) {

            let produto = dados_estoque[item]

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
        if (contagem) {
            contagem.textContent = filtrados.length
        }
        filtrados.forEach(item => {

            let img = item.operacao == 'entrada' ? 'imagens/up_estoque.png' : item.operacao == 'inicial' ? 'imagens/zero.png' : 'imagens/down_estoque.png'

            linhas += `
            <tr style="color: #222; font-size: 0.7em;">
                <td>${item.origem}</td>
                <td>${item.partnumber}</td>
                <td><textarea style="border: none; border-radius: 0px;" readonly>${item.descricao}</textarea></td>
                <td style="padding: 5px;">${item.data}</td>
                <td>${item.operacao}</td>
                <td>
                    <div>
                        <img src="${img}" style="width: 2vw;">
                    </div>
                </td>
                <td>${item.quantidade}</td>
                <td style="padding: 5px;">${item.usuario}</td>
                <td><textarea style="border: none; border-radius: 0px;" readonly>${item.comentario}</textarea></td>
            </tr>
            `
        })

        let colunas = ['Origem', 'Partnumber', 'Descrição', 'Data', 'Operação', 'Sin', 'Quantidade', 'Usuário', 'Comentário']
        let ths = ''
        let thsearch = ''

        colunas.forEach((coluna, i) => {
            ths += `<th>${coluna}</th>`
            thsearch += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_generico(${i}, this.value, filtrosRelatorio, 'body2')">
            </th>
            `
        })

        if (linhas == '') {
            thsearch = ''
            linhas = `
            <tr>
                <td colspan="9" style="color: #222; text-align: center;">Sem resultados</td>
            </tr>
            `
        }

        let tabela = `
        <label>Relatório</label>
        <div style="border-radius: 5px;">
            <table class="tabela">
                <thead>
                    <tr>${ths}</tr>
                    <tr style="background-color: white;">${thsearch}</tr>
                <thead>
                <tbody id="body2">${linhas}</tbody>
            </table>
        </div>
        `

        relatorio.innerHTML = tabela

    }

}