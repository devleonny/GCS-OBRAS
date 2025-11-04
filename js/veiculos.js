let filtroVeiculos = {}

const modeloLabel = (valor1, elemento) => `
<div style="text-align: left; width: 100%; display: flex; align-items: start; justify-content: start; flex-direction: column; gap: 5px;">
    <label>${valor1}</label>
    ${elemento}
</div>
`
const labelDupla = (valor1, valor2) => `
    <div style="display: flex; flex-direction: column; align-items: start;">
        <label style="font-size: 0.7vw;"><strong>${valor1}</strong></label>
        <label style="font-size: 0.9vw;">${valor2}</label>
    </div>
`
const botaoVeiculos = (valor1, funcao, cor) => `
    <div class="botoes" style="background-color: ${cor};" onclick="${funcao}">
        <label>${valor1}</label>
    </div>
`
const categorias = {
    'Combustível': 'combustivel',
    'Pedágio': 'pedagio',
    'Multas': 'multas',
    'Custos Extras': 'extras'
}

async function atualizarDadosVeiculos() {
    await sincronizarDados('motoristas')
    await sincronizarDados('dados_clientes')
    await sincronizarDados('veiculos')
    await sincronizarDados('custo_veiculos')
    await telaVeiculos()
}

async function telaVeiculos() {

    overlayAguarde()

    dados_clientes = await recuperarDados('dados_clientes') || {}
    const veiculos = await recuperarDados('veiculos') || {}
    const motoristas = await recuperarDados('motoristas') || {}
    const custo_veiculos = await recuperarDados('custo_veiculos') || {}

    // Objeto genérico auxiliar para o form de custos;
    let tempMotoristas = {}
    for (const omie of Object.keys(motoristas)) {
        const cliente = dados_clientes[omie] || {}
        tempMotoristas[omie] = {
            nome: cliente.nome || '???',
            cidade: cliente.cidade || '???'
        }
    }

    await inserirDados(tempMotoristas, 'tempMotoristas')

    const listagens = {
        motorista: '',
        veículo: ''
    }

    listagens.motorista = Object.entries(motoristas)
        .map(([idMotorista, motorista]) =>
            `<div class="diVeiculos" onclick="novoMotorista('${idMotorista}')">
                <img src="imagens/${veiculos?.[motorista.veiculo]?.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">

                <div style="${vertical}">
                    <label name="motorista">${dados_clientes?.[idMotorista]?.nome || ''}</label>
                    <label><strong>${veiculos?.[motorista.veiculo]?.modelo || ''}</strong> ${veiculos?.[motorista.veiculo]?.placa || 'Sem veículo'}</label>
                </div>
            </div>
            `)
        .join('')

    listagens.veículo = Object.entries(veiculos)
        .map(([idVeiculo, veiculo]) => `
            <div class="diVeiculos" onclick="novoVeiculo('${idVeiculo}')">
                <img src="imagens/${veiculo.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1.5vw;">

                <div style="${vertical}">
                    <label name="veículo"><strong>${veiculo.modelo}</strong></label>
                    <label name="veículo">${veiculo.placa}</label>
                    <label name="veículo">${veiculo.status}</label>
                </div>
            </div>
            `)
        .join('')

    let ths = '', tsh = ''
    const colunas = ['Usuário & Data', 'Veículo', 'Data Pagamento', 'Valor', 'Realizado', 'Cartão', 'Comentário', 'Editar']
        .map((coluna, i) => {

            if (coluna == 'Editar' || coluna == 'Anexos') {
                tsh += '<th style="background-color: white;"></th>'
            } else if (coluna == 'Data Pagamento') {
                tsh += `
                    <th style="background-color: white;">
                        <input onchange="pesquisarEmVeiculos()" type="date" name="inicio">
                        <input onchange="pesquisarEmVeiculos()" type="date" name="fim">
                    </th>
                `
            } else {
                tsh += `<th contentEditable="true" style="text-align: left; background-color: white;" oninput="pesquisarEmVeiculos({coluna: ${i}, texto: this.textContent})"></th>`
            }

            ths += `<th>${coluna}</th>`
        })

    const pesquisa = (modalidade) => `
        <div style="${horizontal}; background-color: white; border-radius: 3px; margin-left: 5px;  margin-right: 5px;">
            <input style="border: none; border-radius: 15px;" oninput="pesquisarBotoes(this, '${modalidade}')" placeholder="Pesquisar ${modalidade}">
            <img src="imagens/pesquisar2.png" style="width: 1.5vw; padding: 0.5rem;">
        </div>
    `

    const tabelaAux = (nomeTabela) => `
        <div class="tabela-auxiliar">
            <div class="painelBotoes" style="${horizontal}; padding-bottom: 3px; padding-top: 5px;">
                ${pesquisa(nomeTabela)}
                <img src="imagens/pasta.png" onclick="mostrarTabelaAux(this)" style="width: 2rem; padding: 0.5rem;">
            </div>
            <div id="${nomeTabela}" class="fundoPainelLateral">${listagens[nomeTabela]}</div>
            <div class="rodapeTabela"></div>
        </div>
    `

    const acumulado = `
        <div class="tela-veiculos">
            <div style="position: relative; z-index: 10;">
                <div style="position: absolute; left: 0;">${tabelaAux('motorista')}</div>
                <div style="position: absolute; transform: translateX(300px);">${tabelaAux('veículo')}</div>
            </div>
            <div style="${vertical}; margin-top: 5rem; width: 100%;">
                <div class="painelBotoes" style="justify-content: end; margin-right: 2rem;">
                    <div class="total-tabela">
                        <label>Total de pagamento <b>Realizado</b></label>
                        <span name="total">--</span>
                    </div>
                </div>
                <div class="div-tabela">
                    <table class="tabela" style="width: 100%;">
                        <thead>
                            <tr>${ths}</tr>
                            <tr>${tsh}</tr>
                        </thead>
                        <tbody id="bodyVeiculos"></tbody>
                    </table>
                </div>
                <div class="rodapeTabela"></div>
            </div>

        </div>
    `
    const telaVeiculos = document.querySelector('.tela-veiculos')
    if (!telaVeiculos) tela.innerHTML = acumulado

    criarMenus('veiculos')

    removerOverlay()

    for (const [idCusto, custo] of Object.entries(custo_veiculos)) {
        const nome = dados_clientes[custo.motorista].nome
        const veiculo = veiculos[custo.veiculo]
        criarLinhaVeiculo({ custo, nome, veiculo, idCusto })
    }

    pesquisarEmVeiculos()
}

function mostrarTabelaAux(img) {
    const listagem = img.parentElement.nextElementSibling
    const alturaAtual = listagem.style.height

    listagem.style.height = alturaAtual === '0px' || !alturaAtual ? 'max-content' : '0px'
}

function criarLinhaVeiculo({ custo, nome, veiculo, idCusto }) {

    function conversorData(data) {

        if (!data) return ''

        let [ano, mes, dia] = data.split('-')
        let dataFormatada = `${dia}/${mes}/${ano}`

        return dataFormatada
    }

    const anexos = Object.entries(custo?.anexos || {})
        .map(([idAnexo, anexo]) => criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo('${idCusto}', '${idAnexo}', this)`)).join('')

    const editavel = acesso.permissao == 'adm' || acesso.setor == 'FINANCEIRO'

    const tds = `
        <td style="text-align: left;">
            <div style="${vertical}">
                <label><strong>${custo.usuario}</strong></label>
                <label>${custo.data}</label>
            </div>
        </td>

        <td>
            <div style="${horizontal};justify-content: start; gap: 0.5rem; width: 300px;">
                <img src="imagens/${veiculo?.status == 'Locado' ? 'aprovado' : 'reprovado'}.png" style="width: 1rem;">
                <div style="${vertical}; text-align: left;">
                    <label title="${nome}">${nome.slice(0, 20)}...</label>
                    <label>${veiculo?.placa}</label>
                    <label>${veiculo?.modelo}</label>
                </div>
            </div>
        </td>

        <td>
            <input name="datas" style="display: none" value="${custo.data_pagamento}">
            <label>${conversorData(custo.data_pagamento)}</label>
        </td>

        <td>
            <label style="white-space: nowrap;">${dinheiro(custo.custo_total)}</label>
        </td>

        <td>
            <input type="number" name="valores" style="display: none" value="${custo?.realizado || 0}">
            <div style="${horizontal}; gap: 2px;">
                <span>R$</span>
                <input oninput="atualizarRealizado(this)" class="campoRequisicao" type="number" value="${custo?.realizado || ''}" ${editavel ? '' : 'readOnly'}>
            </div>
        </td>

        <td>${veiculo?.cartao || 'Não informado'}</td>
        <td style="text-align: start; width: 400px;">${custo.comentario}</td>

        <td>
            <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
                <img src="imagens/pesquisar2.png" style="width: 1.5vw; cursor: pointer;" onclick="painelAtalhos('${idCusto}')">
            </div>
        </td>`

    const tr = document.getElementById(idCusto)
    if (tr) return tr.innerHTML = tds
    document.getElementById('bodyVeiculos').insertAdjacentHTML('beforeend', `<tr id="${idCusto}">${tds}</tr>`)
}

async function atualizarRealizado(input) {

    const realizado = Number(input.value)
    const tr = input.closest('tr')
    const idCusto = tr.id
    let custo = await recuperarDado('custo_veiculos', idCusto)
    custo.realizado = realizado

    enviar(`custo_veiculos/${idCusto}/realizado`, realizado)
    await inserirDados({ [idCusto]: custo }, 'custo_veiculos')

}

function pesquisarEmVeiculos({ coluna, texto } = {}) {

    const inicio = document.querySelector('[name="inicio"]').value
    const fim = document.querySelector('[name="fim"]').value

    const dtInicio = inicio ? new Date(...inicio.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null
    const dtFinal = fim ? new Date(...fim.split('-').map((v, i) => i === 1 ? v - 1 : v)) : null

    if (coluna !== undefined && coluna !== null) {
        filtroVeiculos[coluna] = String(texto).toLowerCase()
    }

    const trs = document.querySelectorAll('#bodyVeiculos tr')
    let total = 0

    for (const tr of trs) {
        const tds = tr.querySelectorAll('td')
        let mostrarLinha = true

        // filtros de texto
        for (const [col, filtroTexto] of Object.entries(filtroVeiculos)) {
            if (filtroTexto && col < tds.length) {
                let element = tds[col].querySelector('input, textarea, select') || tds[col].textContent
                let conteudo = element.value ? element.value : element
                let texto_campo = String(conteudo).toLowerCase().replace('.', '')

                if (!texto_campo.includes(filtroTexto)) {
                    mostrarLinha = false
                    break
                }
            }
        }

        // filtro de data
        const dataPagamento = tds[2].querySelector('[name="datas"]').value
        if (dataPagamento && dtInicio && dtFinal) {
            const dataConvertida = new Date(...dataPagamento.split('-').map((v, i) => i === 1 ? v - 1 : v))

            if (dataConvertida < dtInicio || dataConvertida > dtFinal) {
                mostrarLinha = false
            }
        }

        tr.style.display = mostrarLinha ? '' : 'none'

        if (mostrarLinha) {
            total += Number(tr.querySelector('[name="valores"]').value) || 0
        }
    }

    document.querySelector('[name="total"]').textContent = dinheiro(total)
}

async function painelAtalhos(idCusto) {

    const custo = await recuperarDado('custo_veiculos', idCusto)

    const acumulado = `
    <div style="${vertical}; gap: 5px; background-color: #d2d2d2; padding: 2vw;">
        ${modeloBotoes('duplicar', 'Duplicar Pagamento', `painelValores('${idCusto}', true)`)}
        ${modeloBotoes('editar', 'Editar Pagamento', `painelValores('${idCusto}')`)}
        ${(acesso.permissao == 'adm' || acesso.usuario == custo.usuario) ? modeloBotoes('excluir', 'Excluir Pagamento', `painelExcluir('${idCusto}')`) : ''}
    </div>
    `
    popup(acumulado, 'Atalhos')
}

function pesquisarBotoes(input, modalidade) {
    const container = document.getElementById(modalidade);
    const termo = input.value.toLowerCase();
    const divs = container.querySelectorAll('div');

    for (let div of divs) {
        const labels = div.querySelectorAll(`[name="${modalidade}"]`);
        let tdsTermos = '';

        for (let label of labels) {
            tdsTermos += ' ' + label.textContent.toLowerCase();
        }

        const visivel = tdsTermos.includes(termo) || termo === '';
        div.style.display = visivel ? 'flex' : 'none';
    }
}

function painelExcluir(idCusto) {

    let acumulado = `
    <div style="display: flex; align-items: center; gap: 2vw; justify-content: center; padding: 2vw; background-color: #d2d2d2;">

        <label>Deseja excluir este lançamento?</label>
        
        ${botao('Confirmar', `excluirCusto('${idCusto}')`, `green`)}
    
    </div>
    `

    popup(acumulado, 'Tem certeza?')
}

async function excluirCusto(idCusto) {

    removerPopup()
    overlayAguarde()
    await deletarDB('custo_veiculos', idCusto)
    deletar(`custo_veiculos/${idCusto}`)
    const linha = document.getElementById(idCusto)
    if (linha) linha.remove()
    removerOverlay()

}

async function painelValores(idCusto, duplicar) {

    const custo = await recuperarDado('custo_veiculos', idCusto) || {}
    const motorista = await recuperarDado('dados_clientes', custo?.motorista)

    const campos = `
        <div class="campos-form-custos">
            ${modeloLabel('KM', `<input oninput="calcularValorCombustivel()" value="${custo?.km || ''}" type="number" id="km" type="number">`)}
            ${modeloLabel('Litros', `<input oninput="calcularValorCombustivel(true)" value="${custo?.litros || ''}" type="number" id="litros" type="number">`)}
            ${modeloLabel('KM/L', `<input oninput="calcularValorCombustivel()" value="${custo?.kml || ''}" type="number" id="kml" type="number">`)}
            ${modeloLabel('Valor Combustível', `<input oninput="calcularValorCombustivel()" value="${custo?.combustivel || ''}" type="number" id="combustivel" type="number">`)}
            ${modeloLabel('Custo Total', `<input value="${custo?.custo_total || ''}" type="number" id="custo_total" type="number">`)}
            ${modeloLabel('Data do Pagamento', `<input id="data_pagamento" type="date" value="${custo?.data_pagamento || ''}">`)}
        </div>

            ${modeloLabel('Comentário', `<textarea rows="10" style="padding: 0.5rem;" id="comentario">${custo?.comentario || ''}</textarea>`)}

        <div id="dados_veiculos"></div>

        <br>

        ${modeloLabel('Motorista', `
            <span ${custo?.motorista ? `id="${custo?.motorista}"` : ''} name="nameMotorista" class="opcoes" onclick="cxOpcoes('nameMotorista', 'tempMotoristas', ['nome', 'cidade'])">
                ${motorista?.nome || 'Selecione'}
            </span>
        `)}
    `
    const funcao = !idCusto ? `salvarValores()` : duplicar ? `salvarValores(false)` : `salvarValores('${idCusto}')`

    const acumulado = `
        <div class="paineis">
            ${campos}
            <hr style="width: 100%;">
            <button onclick="${funcao}">Adicionar Custo</button>
        </div>
    `
    popup(acumulado, 'Adicionar Custo')

    dadosVeiculo()
}

function calcularValorCombustivel(valorManual) {
    const km = obterValores('km')
    const kml = obterValores('kml')
    const litros = valorManual ? obterValores('litros') : Math.ceil(km / kml)
    const combustivel = obterValores('combustivel')

    const resultado = litros * combustivel
    const proximoMultiploDe10 = Math.ceil(resultado / 10) * 10

    if (!valorManual) document.getElementById('litros').value = litros
    document.getElementById('custo_total').value = proximoMultiploDe10
}

async function salvarValores(idCusto) {

    overlayAguarde()

    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    const motorista = await recuperarDado('motoristas', idMotorista)
    idCusto = idCusto || ID5digitos()

    const custo_total = obterValores('custo_total')
    const data_pagamento = obterValores('data_pagamento')

    if (custo_total == '') return popup(mensagem(`Preencha o valor do pagamento`), 'ALERTA', true)
    if (data_pagamento == '') return popup(mensagem(`Preencha a data de pagamento`), 'ALERTA', true)

    const dados = {
        motorista: idMotorista,
        veiculo: motorista.veiculo,
        categoria: 'Combustível',
        custo_total,
        combustivel: obterValores('combustivel'),
        kml: obterValores('kml'),
        comentario: obterValores('comentario'),
        data_pagamento,
        data: new Date().toLocaleString(),
        usuario: acesso.usuario,
        km: obterValores('km'),
        listros: obterValores('litros')
    }

    enviar(`custo_veiculos/${idCusto}`, dados)
    await inserirDados({ [idCusto]: dados }, 'custo_veiculos')
    await telaVeiculos()

    removerPopup()
}

async function novoVeiculo(idVeiculo) {

    let veiculos = await recuperarDados('veiculos') || {}
    let veiculo = veiculos[idVeiculo]
    let opcoes = ['Locado', 'Devolvido']
        .map(op => `<option ${veiculo?.status == op ? 'selected' : ''}>${op}</opcoes>`)
        .join('')
    let funcao = idVeiculo ? `salvarVeiculo('${idVeiculo}')` : 'salvarVeiculo()'

    const acumulado = `
    <div class="paineis">
        ${modeloLabel('Placa', `<input value="${veiculo?.placa || ''}" id="placa" placeholder="Placa">`)}
        ${modeloLabel('Modelo', `<input value="${veiculo?.modelo || ''}" id="modelo" placeholder="Modelo">`)}
        ${modeloLabel('Final do Cartão', `<input value="${veiculo?.cartao || ''}" id="cartao" placeholder="Final do Cartão abastecimento">`)}
        ${modeloLabel('Status', `
            <select id="status">
                ${opcoes}
            </select>
            `)}
        <hr style="width: 100%;">
        <button onclick="${funcao}">Salvar</button>
    </div>`

    popup(acumulado, 'Novo Veículo')
}

function obterValores(id) {
    const elemento = document.getElementById(id);
    const tipo = elemento.type;

    if (tipo === "number") return Number(elemento.value);

    return elemento.value;
}

async function salvarVeiculo(idVeiculo) {

    overlayAguarde()
    let veiculos = await recuperarDados('veiculos') || {}
    idVeiculo = idVeiculo || ID5digitos()
    let veiculo = {
        modelo: obterValores('modelo'),
        placa: obterValores('placa'),
        status: obterValores('status'),
        cartao: obterValores('cartao')
    }

    veiculos[idVeiculo] = veiculo

    enviar(`veiculos/${idVeiculo}`, veiculo)
    await inserirDados(veiculos, 'veiculos')
    await telaVeiculos()

    removerPopup()
    removerOverlay()
}

async function dadosVeiculo() {

    const idVeiculo = document.querySelector('[name="nameVeiculo"]')
    if (!idVeiculo) return
    const veiculo = await recuperarDado('veiculos', idVeiculo.id)

    const acumulado = `
        <div class="contorno-destaque">
            <img src="imagens/veiculo.png" style="width: 3rem;">
            <div style="display: flex; justify-content: start; align-items: start; flex-direction: column;">
                ${labelDupla('Final do Cartão', veiculo?.cartao || 'Não informado')}
                ${labelDupla('Modelo', veiculo?.modelo)}
                ${labelDupla('Placa', veiculo?.placa)}
                ${labelDupla('Status', veiculo?.status)}
            </div>
        </div>
    `

    const div = document.getElementById('dados_veiculos')
    div.innerHTML = veiculo ? acumulado : ''

}

async function novoMotorista(idMotorista) {

    const cliente = await recuperarDado('dados_clientes', idMotorista)
    const motorista = await recuperarDado('motoristas', idMotorista) || {}
    const idVeiculo = motorista?.veiculo || ''
    const veiculo = await recuperarDado('veiculos', idVeiculo)

    const acumulado = `
        <div class="paineis">

            ${modeloLabel('Motorista', `
                <span ${idMotorista ? `id="${idMotorista}"` : ''} name="nameMotorista" class="opcoes" onclick="cxOpcoes('nameMotorista', 'dados_clientes', ['nome', 'cidade'])">
                    ${cliente?.nome || 'Selecione'}
                </span>
            `)}

            ${modeloLabel('Veículo', `
                <div style="${horizontal}; gap: 5px;">
                    <span ${idVeiculo ? `id="${idVeiculo}"` : ''} name="nameVeiculo" class="opcoes" onclick="cxOpcoes('nameVeiculo', 'veiculos', ['placa', 'modelo'], 'dadosVeiculo()')">
                        ${veiculo?.placa || 'Selecione'}
                    </span>
                    <img src="imagens/cancel.png" style="width: 1.5rem;" onclick="removerVeiculo()">
                </div>
            `)}

            <div id="dados_veiculos"></div>

            <hr style="width: 100%;">

            <div style="${horizontal}; width: 100%; justify-content: space-between;">
                <button onclick="salvarMotorista()">Salvar</button>
                ${idMotorista ? `<button onclick="confirmarExcluirItem()" style="background-color: #B12425;">Excluir</button>` : ''}
            </div>
   
        </div>
    `
    popup(acumulado, 'Novo Motorista')

    dadosVeiculo()
}

function removerVeiculo() {
    const idVeiculo = document.querySelector('[name="nameVeiculo"]')
    idVeiculo.textContent = 'Selecione'
    idVeiculo.removeAttribute('id')
    dadosVeiculo()
}

function confirmarExcluirItem() {

    const acumulado = `
        <div style="${horizontal}; background-color: #d2d2d2; padding: 2rem;">
            <span>Tem certeza que deseja remover o item?</span>
            <button onclick="excluirItem()">Confirmar</button>
        </div>
    `

    popup(acumulado, 'Pense bem... não é tarde demais... ainda...', true)
}

async function excluirItem() {

    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    if (!idMotorista) return

    removerPopup()
    overlayAguarde()

    deletarDB('motoristas', idMotorista)
    deletar(`motoristas/${idMotorista}`)

    await telaVeiculos()

}

async function salvarMotorista() {

    overlayAguarde()
    const idMotorista = document.querySelector('[name="nameMotorista"]').id
    if (!idMotorista) return popup(mensagem('Escolha um motorista'), 'AVISO', true)

    const idVeiculo = document.querySelector('[name="nameVeiculo"]').id || null
    const motorista = {
        veiculo: idVeiculo
    }

    enviar(`motoristas/${idMotorista}`, motorista)
    await inserirDados({ [idMotorista]: motorista }, 'motoristas')

    await telaVeiculos()
    removerPopup()
    removerOverlay()
}

async function removerAnexo(idCusto, idAnexo, img) {

    let custo_veiculos = await recuperarDados('custo_veiculos')
    let custo = custo_veiculos[idCusto]

    delete custo.anexos[idAnexo]

    deletar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`)
    await inserirDados(custo_veiculos, 'custo_veiculos')

    img.parentElement.remove()
}

async function salvarAnexoCusto(input) {

    let dadosAnexos = await importarAnexos(input)
    let custo_veiculos = await recuperarDados('custo_veiculos')
    let idCusto = input.id
    let custo = custo_veiculos[idCusto]

    if (!custo.anexos) custo.anexos = {}

    dadosAnexos.forEach(anexo => {
        let idAnexo = ID5digitos()
        custo.anexos[idAnexo] = anexo
        input.nextElementSibling.insertAdjacentHTML('afterend', criarAnexoVisual(anexo.nome, anexo.link, `removerAnexo('${idCusto}', '${idAnexo}', this)`))
        enviar(`custo_veiculos/${idCusto}/anexos/${idAnexo}`, anexo)
    })

    await inserirDados(custo_veiculos, 'custo_veiculos')

}

async function veiculosExcel() {

    const tabela = document.querySelector('.tabela')
    if (!tabela) return popup(mensagem('Tabela não encontrada'), 'Alerta', true)

    const workbook = new ExcelJS.Workbook()
    const planilha = workbook.addWorksheet('Dados')

    // Captura cabeçalho
    const cabecalhos = [...tabela.querySelectorAll('thead th')].map(th => th.innerText.trim())
    planilha.addRow(cabecalhos)

    // Captura linhas
    const linhas = tabela.querySelectorAll('tbody tr')
    linhas.forEach(tr => {
        const dados = [...tr.querySelectorAll('td')].map(td => td.innerText.trim())
        planilha.addRow(dados)
    })

    // Gera o arquivo Excel
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })

    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `veiculos.xlsx`
    link.click()

}