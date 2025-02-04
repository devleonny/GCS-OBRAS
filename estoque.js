let filtrosAtivosEstoques = {}
let filtrosRelatorio = {}
let colunas = ['partnumber', 'categoria', 'marca', 'descricao', 'estoque', 'localizacao_novo', 'estoque_usado', 'localizacao_usado', 'inventario', 'valor_compra']

atualizar_estoque()

async function atualizar_estoque() {
    let div = document.getElementById('estoque')

    if (div) {
        carregamento('estoque')
    }

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    if (Object.keys(dados_estoque) == 0) {
        let estoque_nuvem = await receber('dados_estoque') || {}
        await inserirDados(descodificarUTF8(estoque_nuvem), 'dados_estoque')
    }

    await carregar_estoque()
}

async function carregar_estoque() {

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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

    let thc = ''
    let ths = ''
    let linhas = ''
    colunas.forEach((col, i) => {

        let indice_correto = i + 1
        let coluna = String(col).toUpperCase()
        thc += `<th style="cursor: pointer; position: relative;" onclick="filtrar_tabela('${indice_correto}', 'tabela_estoque', this)">${coluna}</th>`

        if (coluna == 'EXCLUIR') {
            ths = `<th style="background-color: white; position: relative; border-radius: 0px;"></th>`
        } else {
            ths += `
            <th style="background-color: white; position: relative; border-radius: 0px;">
                <img src="imagens/pesquisar2.png" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 15px;">
                <input style="width: 100%; font-size: 1.1vw;" style="text-align: center;" oninput="pesquisar_em_estoque(${indice_correto}, this.value, filtrosAtivosEstoques, 'body')">
            </th>
            `
        }
    })

    for (item in dados_estoque) {

        if (item !== 'id') {
            let dados_item = dados_estoque[item]

            let tds = ''

            colunas.forEach(chave => {

                let info = dados_item[chave] || ''
                let elemento = `<input style="background-color: transparent; cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;" value="${info}" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>`
                let quantidade = ''
                let cor = ''
                let valor = ''

                if (chave == 'descricao' || chave == 'inventario') {
                    elemento = `<textarea style="border: none; border-radius: 0px;" oninput="exibir_botao(this, '${chave}')" ${apenas_leitura}>${info}</textarea>`

                } else if (chave == 'Excluir') {

                    elemento = `
                    <div style="display: flex; align-items: center; justify-content: center;">
                        <img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_linha_excluir_item(this)">
                    </div>
                `
                } else if (chave.includes('valor_compra')) {

                    valor = calcular_cmc(dados_item.valor_compra)

                    let color = valor == 0 ? '#222' : 'white'

                    elemento = `
                    <label style="color: ${color}; cursor: pointer; text-align: center;" onclick="abrir_valores('${item}', '${chave}')">${dinheiro(valor)}</label>
                    `

                } else if (chave.includes('estoque')) {

                    quantidade = info.quantidade

                    for (his in info.historico) {

                        let historico = info.historico[his]

                        if (historico.operacao == 'entrada') {
                            quantidade += historico.quantidade
                        } else if (historico.operacao == 'saida') {
                            quantidade -= historico.quantidade
                        }

                    }

                    elemento = `<label style="cursor: pointer; font-size: 25px; text-align: center; color: white; width: 100%; padding: 5px;" onclick="abrir_estoque('${item}', '${chave}')">${quantidade}</label>`

                }

                if (chave !== 'id') {

                    if (quantidade !== '') {
                        cor = conversor(quantidade) > 0 ? '#4CAF50' : '#B12425'
                    }

                    if (valor !== '') {
                        cor = conversor(valor) > 0 ? '#097fe6' : ''
                    }

                    tds += `
                    <td style="background-color: ${cor}">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                            <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_estoque(this, '${item}', '${chave}')">
                            ${elemento}
                        </div>
                    </td>
                `
                }
            })

            linhas += `
            <tr>
                <td style="display: none;">${item}</td>
                ${tds}
            </tr>
        `
        }
    }

    let acumulado = `
        <div style="height: max-content; max-height: 70vh; width: max-content; max-width: 90vw; overflow: auto; background-color: #222222bf; border-radius: 5px;">
            <table class="tabela_e" id="tabela_estoque">
                <thead>
                    <tr>${thc}</tr>
                    <tr id="thead_pesquisa">${ths}</tr>
                </thead>  
                <tbody id="body">${linhas}</tbody>
            </table>
        </div>
    
    `

    div_estoque.innerHTML = acumulado

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
        <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;">
        <label style="position: absolute; bottom: 5px; right: 15px; font-size: 0.7em;" id="data">${data}</label>

        <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
            <label>Informar valor de Compra</label>
        </div>

        <div style="color: #222; position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px;">
            <img src="imagens/LG.png" style="width: 70px; height: 70px;">
            <label style="width: 300px; text-align: left;">${item.descricao}</label>
        </div>

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
                        <img src="imagens/cancel.png" style="width: 25px; heigth: 25px; cursor: pointer;" onclick="excluir_preco('${codigo}', '${cpr}')">
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
                        <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'conversao', this)">
                        <input class="numero-bonito" style="font-size: 1.2em;" value="${compra.conversao}" oninput="exibir_botao(this)" ${readOnly}>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'fornecedor', this)">
                        <textarea maxlength="100" style="border-radius: 0px; border: none;" oninput="exibir_botao(this)" ${readOnly}>${compra.fornecedor}</textarea>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer;">
                        <img src="imagens/concluido.png" style="display: none; width: 25px; height: 25px; cursor: pointer;" onclick="salvar_dados_compra('${codigo}', '${cpr}', 'comentario', this)">
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

            <hr style="width: 80%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%; gap: 10px;">
                <label>CMC - Custo Médio de Compra</label>
                <label style="border-radius: 5px; padding: 10px; font-size: 35px; color: white; background-color: #097fe6; margin: 5px;">${dinheiro(valor)}</label>
            </div>

            <hr style="width: 80%;">

            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="background-color: #B12425; white; border-radius: 3px; width: 100%; border-radius: 3px;">
                <table class="tabela_e" style="width: 100%; border-collapse: collapse;">
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

    openPopup_v2(acumulado)
}

async function salvar_dados_compra(codigo, cpr, campo, img) {
    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let elemento = img.nextElementSibling
    if (dados_estoque[codigo] && dados_estoque[codigo].valor_compra[cpr]) {

        elemento = campo == 'conversao' ? conversor(elemento.value) : elemento.value
        dados_estoque[codigo].valor_compra[cpr][campo] = elemento

        await inserirDados(dados_estoque, 'dados_estoque')
        await enviar('PUT', `dados_estoque/${codigo}/valor_compra/${cpr}/${campo}`, elemento)
        await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())
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

    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
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
        await enviar('PUT', `dados_estoque/${codigo}/valor_compra/${id}`, codificarUTF8(compra))
        await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())
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
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let item = dados_estoque[codigo]
    let estoque = item[stq] || {}
    let atual = estoque.quantidade ? estoque.quantidade : 0
    let inicial = atual
    let linhas = ''

    if (estoque.historico) {
        atual = estoque.quantidade

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
                exclusao = `<img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_historico('${codigo}', '${stq}','${chave}')">`
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
            <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                <label>Histórico</label>
            </div>

            <div style="background-color: #B12425; white; border-radius: 3px; width: 100%; border-radius: 3px;">
                <table class="tabela_e" style="width: 100%; border-collapse: collapse;">
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

        <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;">
        <label style="position: absolute; bottom: 5px; right: 15px; font-size: 0.7em;" id="data">${data}</label>

        <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
            <label>Movimentação de estoque</label>
        </div>

        <div style="color: #222; position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px;">
            <img src="imagens/LG.png" style="width: 70px; height: 70px;">
            <label style="width: 300px; text-align: left;">${item.descricao}</label>
        </div>

        <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px; height: 140px;">
            
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
                <textarea maxlength="100" placeholder="Comentário" id="comentario"></textarea>
            </div>

            <img src="imagens/concluido.png" style="cursor: pointer;" onclick="salvar_movimento('${codigo}', '${stq}')">

        </div>

        <div style="position: relative; display: flex; justify-content: space-evenly; align-items: center; background-color: white; border-radius: 5px; margin: 5px; height: 130px;">
         
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 60%;">
                <label style="color: #222;">Saldo Atual</label>
                <label style="background-color: #4CAF50; font-size: 35px; height: 50px; width: 90%; border-radius: 5px;">${atual}</label>
            </div>
        
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center;">

                <label style="color: #222;">Saldo Inicial</label>

                <div style="display: flex; justify-content: center; align-items: center; gap: 5px;">
                    <input class="numero-bonito" style="background-color: #B12425;" value="${inicial}">
                    <img src="imagens/concluido.png" style="cursor: pointer; width: 30px; height: 30px;" onclick="salvar_movimento('${codigo}', '${stq}', this)">
                </div>
            
            </div>

        </div>

        ${div_historico}

    `

    openPopup_v2(acumulado)

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
    let acesso = JSON.parse(localStorage.getItem('acesso')) || {}
    let id = gerar_id_5_digitos()

    remover_popup()
    openPopup_v2(`
        <div style="display: flex; gap: 10px; align-items: center; justify-content: center;">
            <img src="gifs/loading.gif" style="width: 70px;">
            <label>Salvando...</label>
        </div>
    `)

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
    await enviar('PUT', `dados_estoque/${codigo}/${stq}/historico/${id}`, codificarUTF8(movimento))

    if (inicial !== undefined) {
        await enviar('PUT', `dados_estoque/${codigo}/${stq}/quantidade`, estoque.quantidade)
    }
    await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())
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

function incluir_linha() {
    let body = document.getElementById('body')
    let tds = ''

    colunas.forEach(campo => {
        let elemento = `<input style="background-color: transparent; cursor: pointer; text-align: center; padding: 10px; border-radius: 3px;")">`
        let cor = ''
        if (campo == 'descricao' || campo == 'inventario') {
            elemento = `<textarea style="border: none;"></textarea>`

        } else if (campo == 'Excluir') {

            elemento = `
            <div style="display: flex; align-items: center; justify-content: center;">
                <img src="imagens/cancel.png" style="cursor: pointer; width: 25px; height: 25px;" onclick="remover_linha_excluir_item(this)">
                <img src="imagens/concluido.png" style="display: width: 25px; height: 25px; cursor: pointer;" onclick="salvar_linha(this)">
            </div>
            `

        } else if (campo.includes('estoque') || campo.includes('valor_compra')) {
            elemento = `<label style="cursor: pointer; font-size: 25px; text-align: center; color: white; width: 100%;">X</label>`
            cor = '#222'
        }

        tds += `
            <td style="background-color: ${cor}">
                <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                    ${elemento}
                </div>
            </td>
        `
    })

    let linha = `
    <tr>
        ${tds}
    </tr>
    `
    body.insertAdjacentHTML('beforebegin', linha)

}

async function salvar_linha(img) {
    let tr = img.closest('tr')
    let codigo = gerar_id_5_digitos()
    let tds = tr.querySelectorAll('td')

    let dados_estoque = await recuperarDados('dados_estoque') || {}

    let item = {
        partnumber: tds[1].querySelector('input').value,
        categoria: tds[2].querySelector('input').value,
        marca: tds[3].querySelector('input').value,
        estoque: {
            quantidade: 0,
            historico: {}
        },
        estoque_usado: {
            quantidade: 0,
            historico: {}
        },
        descricao: tds[4].querySelector('textarea').value,
        localizacao_novo: tds[6].querySelector('input').value,
        localizacao_usado: tds[8].querySelector('input').value,
        inventario: tds[9].querySelector('textarea').value,
    }

    dados_estoque[codigo] = item
    await inserirDados(dados_estoque, 'dados_estoque')

    filtrosAtivosEstoques[5] = item.descricao

    retomar_paginacao()

    await enviar('PUT', `dados_estoque/${codigo}`, codificarUTF8(item))
    await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())

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
        await enviar('PUT', `dados_estoque/${codigo}/${chave}`, codificarUTF8(elemento.value))
        await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())

    } else if (!dados_estoque[codigo]) { //29 PERMANENTE; Objetos criados no primeiro momento;

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
        await enviar('PUT', `dados_estoque/${codigo}`, codificarUTF8(dados_estoque[codigo]))
        await enviar('PUT', `dados_estoque/${codigo}/timestamp`, Date.now())
    }

}

async function retomar_paginacao(codigo, stq) {
    await carregar_estoque()

    let tabela_estoque = document.getElementById('tabela_estoque')
    let thead = tabela_estoque.querySelector('thead')
    let trs = thead.querySelectorAll('tr')
    let ths = trs[1].querySelectorAll('th')

    for (coluna in filtrosAtivosEstoques) {
        let texto = filtrosAtivosEstoques[coluna]
        ths[coluna - 1].querySelector('input').value = texto
        pesquisar_em_estoque(coluna, texto, filtrosAtivosEstoques, 'tabela_estoque')
    }

    let inputs = document.body.querySelectorAll('input.datas_estoque')
    if (inputs.length > 0) {
        let data_entrada = inputs[0].value
        let data_saida = inputs[1].value
        remover_popup()
        relatorio_movimento()
        inputs = document.body.querySelectorAll('input.datas_estoque')
        inputs[0].value = data_entrada
        inputs[1].value = data_saida
        atualizar_dados_relatorio()
    } else if (codigo !== undefined && stq !== undefined) {
        remover_popup()
        await abrir_estoque(codigo, stq)
    }

}

function pesquisar_em_estoque(coluna, texto, filtro, id) {

    filtro[coluna] = texto.toLowerCase();

    var tabela_itens = document.getElementById(id);
    var trs = tabela_itens.querySelectorAll('tr');
    let contador = 0

    trs.forEach(function (tr) {
        var tds = tr.querySelectorAll('td');

        var mostrarLinha = true;

        for (var col in filtro) {
            var filtroTexto = filtro[col];

            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input') || tds[col].querySelector('textarea') || tds[col].textContent
                let conteudoCelula = element.value ? element.value : element
                let texto_campo = String(conteudoCelula).toLowerCase()

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false;
                    break;
                }
            }
        }

        mostrarLinha ? contador++ : ''

        tr.style.display = mostrarLinha ? '' : 'none';
    });

    let contagem = document.getElementById('contagem')
    if (contagem) {
        contagem.textContent = contador
    }

}

function relatorio_movimento() {

    let acumulado = `
    <img src="imagens/BG.png" style="position: absolute; top: 0px; left: 5px; height: 70px;;">

    <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
        <label>Relatório de Movimentos</label>
    </div>

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

    openPopup_v2(acumulado)

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
                        <img src="${img}" style="width: 25px; height: 25px;">
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
                <input style="width: 100%;" style="text-align: center;" placeholder="${coluna}" oninput="pesquisar_em_estoque(${i}, this.value, filtrosRelatorio, 'body2')">
            </th>
            `
        })

        if (linhas == '') {
            thsearch = ''
            linhas = `
            <tr>
                <td colspan="9" style="color: #222;">Sem resultados<td>
            </tr>
            `
        }

        let tabela = `
        <label>Relatório</label>
        <div style="background-color: #097fe6; border-radius: 5px;">
            <table class="tabela_e" style="width: 100%;">
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
